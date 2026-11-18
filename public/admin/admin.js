(() => {
  const $ = (id) => document.getElementById(id);
  const el = (tag, props = {}, ...kids) => {
    const e = Object.assign(document.createElement(tag), props);
    kids.flat().forEach((k) => e.append(k));
    return e;
  };

  // Bo'limlar va maydonlar tavsifi
  const SECTIONS = {
    site: { title: 'Asosiy ma’lumotlar' },
    poems: { title: 'She’rlar', single: 'She’r', fields: [
      ['title', 'Sarlavha'], ['date', 'Sana / yil', 'short'], ['text', 'She’r matni', 'area', 12]] },
    books: { title: 'Kitoblar', single: 'Kitob', fields: [
      ['title', 'Nomi'], ['year', 'Yil', 'short'], ['description', 'Tavsif', 'area', 4],
      ['cover', 'Muqova rasmi', 'image'], ['link', 'Havola (ixtiyoriy)', 'url']] },
    media: { title: 'Media', single: 'Media', fields: [
      ['type', 'Turi', 'type'], ['title', 'Nomi'], ['description', 'Tavsif (ixtiyoriy)', 'area', 2],
      ['src', 'Fayl yoki havola', 'file']] },
    contacts: { title: 'Aloqa', single: 'Aloqa' },
    news: { title: 'Yangiliklar', single: 'Yangilik', fields: [
      ['title', 'Sarlavha'], ['date', 'Sana', 'date'], ['text', 'Matn', 'area', 8], ['image', 'Rasm', 'image']] },
  };
  const SITE_FIELDS = [
    ['name', 'Ism-familiya'], ['role', 'Kasbi (masalan: Shoir va yozuvchi)'], ['tagline', 'Bosh sahifadagi qisqa so‘z', 'area', 2],
    ['heroImage', 'Bosh sahifadagi rasm (portret)', 'image'],
    ['aboutTitle', '“Haqida” bo‘limi sarlavhasi'], ['about', 'O‘zi haqida (bo‘sh qator = yangi abzas)', 'area', 10],
    ['quote', 'Sevimli iqtibos / epigraf', 'area', 2],
  ];

  let data = null, tab = 'site', dirty = false;

  async function api(url, opts = {}) {
    const r = await fetch(url, { credentials: 'same-origin', ...opts });
    const j = await r.json().catch(() => ({}));
    if (r.status === 401 && url !== '/api/login') { showLogin(); throw new Error('Qayta kiring'); }
    if (!r.ok) throw new Error(j.error || 'Xatolik');
    return j;
  }
  function status(msg, cls = '') { const s = $('status'); s.textContent = msg; s.className = 'status ' + cls; }
  function markDirty() { dirty = true; status('Saqlanmagan o‘zgarishlar', 'dirty'); }

  // ----- Maydon yaratish -----
  function field(obj, [key, label, type, rows]) {
    const wrap = el('label', { className: 'field' }, el('span', { textContent: label }));
    if (type === 'image') {
      const img = el('div', { className: 'img-field' });
      const render = () => {
        img.replaceChildren(
          obj[key] ? el('img', { src: obj[key], alt: '' }) : el('div', { className: 'ph', textContent: 'rasm yo‘q' }),
          el('div', { className: 'img-actions' },
            el('button', { type: 'button', className: 'btn small', textContent: obj[key] ? 'Almashtirish' : 'Rasm yuklash', onclick: () => pick() }),
            obj[key] ? el('button', { type: 'button', className: 'btn small danger', textContent: 'O‘chirish', onclick: () => { obj[key] = ''; markDirty(); render(); } }) : ''));
      };
      const pick = () => {
        const inp = el('input', { type: 'file', accept: 'image/jpeg,image/png,image/webp,image/gif' });
        inp.onchange = async () => {
          const f = inp.files[0]; if (!f) return;
          status('Rasm yuklanmoqda…');
          try {
            const j = await api('/api/upload', { method: 'POST', body: f });
            obj[key] = j.url; markDirty(); render();
          } catch (e) { status(e.message, 'bad'); }
        };
        inp.click();
      };
      render();
      return el('div', { className: 'field' }, el('span', { textContent: label }), img);
    }
    if (type === 'type') {
      const sel = el('select', {}, ...[['image', 'Rasm'], ['video', 'Video'], ['audio', 'Audio']].map(([v, t]) => el('option', { value: v, textContent: t })));
      sel.value = obj[key] || 'image';
      obj[key] = sel.value;
      sel.onchange = () => { obj[key] = sel.value; markDirty(); render(); };
      return el('label', { className: 'field' }, el('span', { textContent: label }), sel);
    }
    if (type === 'file') {
      const kind = obj.type || 'image';
      const url = el('input', { type: 'text', value: obj[key] || '', placeholder: kind === 'video' ? 'Fayl yuklang yoki YouTube / to‘g‘ridan-to‘g‘ri havola qo‘ying' : 'Fayl yuklang yoki havola qo‘ying (https://...)' });
      url.oninput = () => { obj[key] = url.value; markDirty(); };
      const accept = { image: 'image/*', video: 'video/mp4,video/webm', audio: 'audio/mpeg,audio/ogg,audio/wav,audio/mp4' }[kind];
      const btn = el('button', { type: 'button', className: 'btn small', textContent: 'Fayl yuklash', onclick: () => {
        const inp = el('input', { type: 'file', accept });
        inp.onchange = async () => {
          const f = inp.files[0]; if (!f) return;
          status(`Yuklanmoqda (${(f.size / 1048576).toFixed(1)} MB)…`);
          try {
            const j = await api('/api/upload', { method: 'POST', body: f });
            if (j.kind !== kind) throw new Error(`Bu fayl ${j.kind} turida, tanlangan tur: ${kind}`);
            obj[key] = j.url; markDirty(); render(); status('Yuklandi ✓ — saqlashni unutmang', 'dirty');
          } catch (e) { status(e.message, 'bad'); }
        };
        inp.click();
      } });
      const preview = !obj[key] ? '' : kind === 'image' ? el('img', { src: obj[key], alt: '', style: 'max-width:160px;border-radius:8px' })
        : kind === 'audio' ? el('audio', { src: obj[key], controls: true, style: 'width:100%' })
        : /^\/uploads\//.test(obj[key]) ? el('video', { src: obj[key], controls: true, preload: 'metadata', style: 'max-width:280px;border-radius:8px' }) : '';
      return el('div', { className: 'field' }, el('span', { textContent: label }), url, el('div', { className: 'img-actions' }, btn), preview);
    }
    const input = type === 'area'
      ? el('textarea', { rows: rows || 4, value: obj[key] || '' })
      : el('input', { type: type === 'date' ? 'date' : type === 'url' ? 'url' : 'text', value: obj[key] || '' });
    if (type === 'area') input.style.minHeight = (rows || 4) * 26 + 'px';
    input.oninput = () => { obj[key] = input.value; markDirty(); };
    wrap.append(input);
    return wrap;
  }
  const grid = (fields, obj) => {
    const out = []; let i = 0;
    while (i < fields.length) {
      if (fields[i][2] === 'short' && fields[i + 1] && fields[i + 1][2] !== 'area') {
        out.push(el('div', { className: 'row2' }, field(obj, fields[i]), field(obj, fields[i + 1]))); i += 2;
      } else out.push(field(obj, fields[i++]));
    }
    return out;
  };

  // ----- Ko'rinishlar -----
  function render() {
    $('tabs').replaceChildren(...Object.entries(SECTIONS).map(([k, v]) =>
      el('button', { className: k === tab ? 'on' : '', textContent: v.title + (k !== 'site' ? ` (${data[k].length})` : ''), onclick: () => { tab = k; render(); } })));
    const main = $('main'); main.replaceChildren();
    if (tab === 'site') {
      main.append(el('div', { className: 'item' }, ...grid(SITE_FIELDS, data.site)));
      return;
    }
    if (tab === 'contacts') return renderContacts(main);
    const sec = SECTIONS[tab], list = data[tab];
    main.append(el('div', { className: 'h2' }, el('h2', { textContent: sec.title }),
      el('button', { className: 'btn primary', textContent: '+ ' + sec.single + ' qo‘shish', onclick: () => {
        const o = { id: 'i' + Date.now().toString(36) };
        sec.fields.forEach(([k]) => (o[k] = ''));
        if (tab === 'news') o.date = new Date().toISOString().slice(0, 10);
        list.unshift(o); markDirty(); render();
      } })));
    if (!list.length) main.append(el('div', { className: 'note', textContent: 'Hozircha hech narsa yo‘q. Yuqoridagi tugma orqali qo‘shing.' }));
    list.forEach((o, i) => {
      const move = (d) => { const j = i + d; if (j < 0 || j >= list.length) return; [list[i], list[j]] = [list[j], list[i]]; markDirty(); render(); };
      main.append(el('div', { className: 'item' },
        el('div', { className: 'item-head' }, el('b', { textContent: o.title || 'Nomsiz ' + sec.single.toLowerCase() }),
          el('button', { className: 'btn small', textContent: '↑', title: 'Yuqoriga', onclick: () => move(-1) }),
          el('button', { className: 'btn small', textContent: '↓', title: 'Pastga', onclick: () => move(1) }),
          el('button', { className: 'btn small danger', textContent: 'O‘chirish', onclick: () => {
            if (confirm('Rostdan ham o‘chirmoqchimisiz?')) { list.splice(i, 1); markDirty(); render(); }
          } })),
        ...grid(sec.fields, o)));
    });
  }

  const icon = (c) => {
    if (c.img) return el('img', { src: c.img, alt: '', style: 'width:24px;height:24px;object-fit:contain;flex:none' });
    const ns = 'http://www.w3.org/2000/svg', v = document.createElementNS(ns, 'svg'), p = document.createElementNS(ns, 'path');
    v.setAttribute('viewBox', '0 0 24 24'); p.setAttribute('d', c.path); p.setAttribute('fill', c.color); v.append(p); return v;
  };
  function renderContacts(main) {
    const list = data.contacts, C = CONTACTS;
    main.append(el('div', { className: 'h2' }, el('h2', { textContent: 'Aloqa' })),
      el('div', { className: 'note', textContent: 'Qo‘shmoqchi bo‘lgan platformani tanlang — faqat to‘ldirilganlari saytda ko‘rinadi. Foydalanuvchi nomi (@nom), raqam yoki to‘liq havola yozishingiz mumkin.' }));
    main.append(el('div', { className: 'picker' }, ...C.LIST.map((c) =>
      el('button', { type: 'button', className: 'pick', title: c.label + ' qo‘shish', onclick: () => {
        list.push({ id: 'c' + Date.now().toString(36), type: c.key, value: '' }); markDirty(); render();
        setTimeout(() => { const ins = document.querySelectorAll('.crow input'); ins[ins.length - 1]?.focus(); }, 0);
      } }, icon(c), el('span', { textContent: c.label })))));
    if (!list.length) main.append(el('div', { className: 'note', textContent: 'Hali aloqa qo‘shilmagan.' }));
    list.forEach((o, i) => {
      const c = C.byKey[o.type];
      const input = el('input', { type: 'text', value: o.value, placeholder: c.placeholder });
      input.oninput = () => { o.value = input.value; markDirty(); };
      const sel = el('select', {}, ...C.LIST.map((x) => el('option', { value: x.key, textContent: x.label })));
      sel.value = o.type; sel.onchange = () => { o.type = sel.value; markDirty(); render(); };
      const move = (d) => { const j = i + d; if (j < 0 || j >= list.length) return; [list[i], list[j]] = [list[j], list[i]]; markDirty(); render(); };
      main.append(el('div', { className: 'item crow' }, el('div', { className: 'cico' }, icon(c)), sel, input,
        el('button', { className: 'btn small', textContent: '↑', onclick: () => move(-1) }),
        el('button', { className: 'btn small', textContent: '↓', onclick: () => move(1) }),
        el('button', { className: 'btn small danger', textContent: 'O‘chirish', onclick: () => { list.splice(i, 1); markDirty(); render(); } })));
    });
  }

  async function save() {
    status('Saqlanmoqda…');
    try { data = await api('/api/content', { method: 'PUT', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify(data) }); dirty = false; status('Saqlandi ✓', 'ok'); render(); }
    catch (e) { status(e.message, 'bad'); }
  }

  function showLogin() { $('app').hidden = true; $('login').hidden = false; }
  async function start() {
    data = await (await fetch('/api/content')).json();
    $('login').hidden = true; $('app').hidden = false; status(''); render();
  }

  $('loginForm').onsubmit = async (e) => {
    e.preventDefault(); $('loginErr').textContent = '';
    try { await api('/api/login', { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ password: $('pw').value }) }); $('pw').value = ''; start(); }
    catch (err) { $('loginErr').textContent = err.message; }
  };
  $('save').onclick = save;
  $('logout').onclick = async () => { await api('/api/logout', { method: 'POST' }); location.reload(); };
  addEventListener('beforeunload', (e) => { if (dirty) { e.preventDefault(); e.returnValue = ''; } });
  addEventListener('keydown', (e) => { if ((e.ctrlKey || e.metaKey) && e.key === 's' && !$('app').hidden) { e.preventDefault(); save(); } });

  api('/api/me').then((m) => (m.auth ? start() : showLogin()));
})();
