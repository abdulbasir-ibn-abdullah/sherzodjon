'use strict';
// Bog'lamasiz (dependency-free) Node.js server: statik fayllar + admin API.
const http = require('http');
const fs = require('fs');
const path = require('path');
const crypto = require('crypto');

const PORT = process.env.PORT || 3000;
const ROOT = __dirname;
const PUBLIC = path.join(ROOT, 'public');
const UPLOADS = path.join(ROOT, 'uploads');
const DATA = path.join(ROOT, 'data', 'content.json');
const DEFAULT = path.join(ROOT, 'data', 'default.json');
const MAX_JSON = 1024 * 1024;
const MAX_IMG = 8 * 1024 * 1024;

// Parol va sessiya kaliti. Ishlab chiqarishda ADMIN_PASSWORD ni albatta o'zgartiring!
const PASSWORD = process.env.ADMIN_PASSWORD || 'admin123';
const SECRET = process.env.SESSION_SECRET || crypto.randomBytes(32).toString('hex');
if (!process.env.ADMIN_PASSWORD) {
  console.warn('⚠  ADMIN_PASSWORD o‘rnatilmagan — standart parol "admin123" ishlatilmoqda. Uni o‘zgartiring!');
}

const MIME = {
  '.html': 'text/html; charset=utf-8', '.css': 'text/css; charset=utf-8',
  '.js': 'text/javascript; charset=utf-8', '.json': 'application/json; charset=utf-8',
  '.svg': 'image/svg+xml', '.png': 'image/png', '.jpg': 'image/jpeg', '.jpeg': 'image/jpeg',
  '.webp': 'image/webp', '.gif': 'image/gif', '.ico': 'image/x-icon',
};
const IMG_EXT = { 'image/jpeg': '.jpg', 'image/png': '.png', 'image/webp': '.webp', 'image/gif': '.gif' };

// ---------- Ma'lumotlar ----------
function loadContent() {
  try { return JSON.parse(fs.readFileSync(DATA, 'utf8')); }
  catch { return JSON.parse(fs.readFileSync(DEFAULT, 'utf8')); }
}
function saveContent(obj) {
  fs.mkdirSync(path.dirname(DATA), { recursive: true });
  const tmp = DATA + '.tmp';
  fs.writeFileSync(tmp, JSON.stringify(obj, null, 2));
  fs.renameSync(tmp, DATA);
}
const str = (v, max) => (typeof v === 'string' ? v.slice(0, max) : '');
function sanitize(input) {
  const d = loadContent();
  const s = (input && input.site) || {};
  const site = {};
  for (const k of Object.keys(d.site)) site[k] = str(s[k], k === 'about' ? 20000 : 500);
  const list = (arr, fields, max) =>
    (Array.isArray(arr) ? arr : []).slice(0, 500).map((it, i) => {
      const o = { id: str(it && it.id, 40) || 'i' + Date.now().toString(36) + i };
      for (const [f, m] of fields) o[f] = str(it && it[f], m);
      return o;
    });
  return {
    site,
    books: list(input.books, [['title', 200], ['year', 20], ['description', 3000], ['cover', 300], ['link', 500]]),
    poems: list(input.poems, [['title', 200], ['date', 40], ['text', 20000]]),
    news: list(input.news, [['title', 200], ['date', 40], ['text', 20000], ['image', 300]]),
  };
}

// ---------- Auth ----------
const sign = (v) => crypto.createHmac('sha256', SECRET).update(v).digest('hex');
function makeToken() {
  const exp = String(Date.now() + 7 * 24 * 3600 * 1000);
  return exp + '.' + sign(exp);
}
function validToken(t) {
  if (!t) return false;
  const [exp, sig] = t.split('.');
  if (!exp || !sig || Number(exp) < Date.now()) return false;
  const a = Buffer.from(sig), b = Buffer.from(sign(exp));
  return a.length === b.length && crypto.timingSafeEqual(a, b);
}
function cookie(req, name) {
  const m = (req.headers.cookie || '').split(/;\s*/).find((c) => c.startsWith(name + '='));
  return m ? decodeURIComponent(m.slice(name.length + 1)) : '';
}
const isAuth = (req) => validToken(cookie(req, 'sid'));
const safeEq = (a, b) => {
  const x = crypto.createHash('sha256').update(a).digest();
  const y = crypto.createHash('sha256').update(b).digest();
  return crypto.timingSafeEqual(x, y);
};
const fails = new Map(); // ip -> {n, t}  (brute-force himoyasi)

// ---------- Yordamchilar ----------
function send(res, code, body, headers = {}) {
  const isObj = typeof body === 'object' && !Buffer.isBuffer(body);
  res.writeHead(code, {
    'Content-Type': isObj ? 'application/json; charset=utf-8' : 'text/plain; charset=utf-8',
    'X-Content-Type-Options': 'nosniff',
    ...headers,
  });
  res.end(isObj ? JSON.stringify(body) : body);
}
function readBody(req, limit) {
  return new Promise((resolve, reject) => {
    const chunks = []; let n = 0;
    req.on('data', (c) => {
      n += c.length;
      if (n > limit) { reject(Object.assign(new Error('Fayl juda katta'), { code: 413 })); req.destroy(); return; }
      chunks.push(c);
    });
    req.on('end', () => resolve(Buffer.concat(chunks)));
    req.on('error', reject);
  });
}
function sniffImage(buf) {
  if (buf.length < 12) return null;
  if (buf[0] === 0xff && buf[1] === 0xd8) return 'image/jpeg';
  if (buf.slice(0, 8).equals(Buffer.from([0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a]))) return 'image/png';
  if (buf.slice(0, 4).toString() === 'RIFF' && buf.slice(8, 12).toString() === 'WEBP') return 'image/webp';
  if (buf.slice(0, 3).toString() === 'GIF') return 'image/gif';
  return null;
}
function serveFile(req, res, file, cache) {
  fs.stat(file, (err, st) => {
    if (err || !st.isFile()) return send(res, 404, 'Topilmadi');
    res.writeHead(200, {
      'Content-Type': MIME[path.extname(file).toLowerCase()] || 'application/octet-stream',
      'Content-Length': st.size,
      'Cache-Control': cache,
      'X-Content-Type-Options': 'nosniff',
    });
    if (req.method === 'HEAD') return res.end();
    fs.createReadStream(file).pipe(res);
  });
}
function within(base, rel) {
  const p = path.normalize(path.join(base, rel));
  return p.startsWith(base + path.sep) || p === base ? p : null;
}

// ---------- Server ----------
const server = http.createServer(async (req, res) => {
  try {
    const url = new URL(req.url, 'http://x');
    const p = decodeURIComponent(url.pathname);

    if (p.startsWith('/api/')) {
      res.setHeader('Cache-Control', 'no-store');
      if (p === '/api/content' && req.method === 'GET') return send(res, 200, loadContent());
      if (p === '/api/me' && req.method === 'GET') return send(res, 200, { auth: isAuth(req) });

      if (p === '/api/login' && req.method === 'POST') {
        const ip = req.socket.remoteAddress;
        const f = fails.get(ip);
        if (f && f.n >= 5 && Date.now() - f.t < 15 * 60 * 1000)
          return send(res, 429, { error: 'Juda ko‘p urinish. 15 daqiqadan so‘ng qayta urinib ko‘ring.' });
        let body = {};
        try { body = JSON.parse((await readBody(req, 4096)).toString() || '{}'); } catch {}
        if (typeof body.password === 'string' && safeEq(body.password, PASSWORD)) {
          fails.delete(ip);
          const secure = req.headers['x-forwarded-proto'] === 'https' ? '; Secure' : '';
          return send(res, 200, { ok: true }, {
            'Set-Cookie': `sid=${makeToken()}; HttpOnly; SameSite=Strict; Path=/; Max-Age=${7 * 86400}${secure}`,
          });
        }
        fails.set(ip, { n: (f && Date.now() - f.t < 15 * 60 * 1000 ? f.n : 0) + 1, t: Date.now() });
        return send(res, 401, { error: 'Parol noto‘g‘ri' });
      }
      if (p === '/api/logout' && req.method === 'POST')
        return send(res, 200, { ok: true }, { 'Set-Cookie': 'sid=; HttpOnly; SameSite=Strict; Path=/; Max-Age=0' });

      // Quyidagilar faqat admin uchun
      if (!isAuth(req)) return send(res, 401, { error: 'Kirish talab qilinadi' });

      if (p === '/api/content' && req.method === 'PUT') {
        let obj;
        try { obj = JSON.parse((await readBody(req, MAX_JSON)).toString()); }
        catch (e) { return send(res, e.code || 400, { error: e.message || 'Noto‘g‘ri JSON' }); }
        const clean = sanitize(obj || {});
        saveContent(clean);
        return send(res, 200, clean);
      }
      if (p === '/api/upload' && req.method === 'POST') {
        let buf;
        try { buf = await readBody(req, MAX_IMG); } catch (e) { return send(res, e.code || 400, { error: e.message }); }
        const type = sniffImage(buf);
        if (!type) return send(res, 415, { error: 'Faqat JPG, PNG, WEBP yoki GIF rasm yuklash mumkin' });
        fs.mkdirSync(UPLOADS, { recursive: true });
        const name = Date.now().toString(36) + crypto.randomBytes(4).toString('hex') + IMG_EXT[type];
        fs.writeFileSync(path.join(UPLOADS, name), buf);
        return send(res, 200, { url: '/uploads/' + name });
      }
      return send(res, 404, { error: 'Topilmadi' });
    }

    if (req.method !== 'GET' && req.method !== 'HEAD') return send(res, 405, 'Method not allowed');

    if (p.startsWith('/uploads/')) {
      const f = within(UPLOADS, p.slice('/uploads/'.length));
      return f ? serveFile(req, res, f, 'public, max-age=31536000, immutable') : send(res, 404, 'Topilmadi');
    }
    let rel = p === '/' ? 'index.html' : p.slice(1);
    if (rel === 'admin' || rel === 'admin/') rel = 'admin/index.html';
    const f = within(PUBLIC, rel);
    return f ? serveFile(req, res, f, 'no-cache') : send(res, 404, 'Topilmadi');
  } catch (e) {
    console.error(e);
    send(res, 500, { error: 'Server xatosi' });
  }
});

server.listen(PORT, () => console.log(`Sayt:  http://localhost:${PORT}\nAdmin: http://localhost:${PORT}/admin`));
