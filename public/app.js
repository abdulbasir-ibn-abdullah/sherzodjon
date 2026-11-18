(() => {
  const $ = (id) => document.getElementById(id);
  const el = (tag, cls, text) => { const e = document.createElement(tag); if (cls) e.className = cls; if (text != null) e.textContent = text; return e; };
  const safeUrl = (u) => /^(https?:\/\/|mailto:|tel:)/i.test(u) ? u : '';

  // Mavzu
  const root = document.documentElement;
  const saved = (() => { try { return localStorage.getItem('theme'); } catch { return null; } })();
  root.dataset.theme = saved || (matchMedia('(prefers-color-scheme: dark)').matches ? 'dark' : 'light');
  $('theme').onclick = () => {
    root.dataset.theme = root.dataset.theme === 'dark' ? 'light' : 'dark';
    try { localStorage.setItem('theme', root.dataset.theme); } catch {}
  };
  addEventListener('scroll', () => $('nav').classList.toggle('scrolled', scrollY > 10), { passive: true });

  const modal = $('modal');
  const open = (build) => { const b = $('modalBody'); b.replaceChildren(); build(b); modal.showModal(); };
  $('close').onclick = () => modal.close();
  modal.addEventListener('click', (e) => { if (e.target === modal) modal.close(); });

  function paragraphs(target, text) {
    target.replaceChildren();
    (text || '').split(/\n\s*\n/).filter(Boolean).forEach((p) => target.append(el('p', null, p.trim())));
  }

  fetch('/api/content').then((r) => r.json()).then((d) => {
    const s = d.site;
    document.title = `${s.name} — ${s.role}`;
    $('brand').textContent = s.name;
    $('name').textContent = s.name;
    $('role').textContent = s.role;
    $('tagline').textContent = s.tagline;
    $('initials').textContent = (s.name || '?').trim().charAt(0).toUpperCase();
    if (s.heroImage) {
      const img = new Image();
      img.alt = s.name; img.fetchPriority = 'high';
      img.src = s.heroImage;
      $('portrait').replaceChildren(img);
    }
    $('aboutTitle').textContent = s.aboutTitle || 'Men haqimda';
    paragraphs($('aboutBody'), s.about);
    $('quote').textContent = s.quote;
    $('copy').textContent = `© ${new Date().getFullYear()} ${s.name}. Barcha huquqlar himoyalangan.`;

    // She'rlar
    const poems = $('poemList');
    d.poems.forEach((p) => {
      const c = el('button', 'card poem');
      c.append(el('h3', null, p.title), el('div', 'excerpt', p.text));
      if (p.date) c.append(el('div', 'meta', p.date));
      c.onclick = () => open((b) => { b.append(el('h3', null, p.title), el('div', 'text', p.text)); if (p.date) b.append(el('div', 'meta', p.date)); });
      poems.append(c);
    });
    // Kitoblar
    d.books.forEach((k) => {
      const c = el('article', 'card book');
      const cover = el('div', 'cover');
      if (k.cover) { const i = new Image(); i.alt = k.title; i.loading = 'lazy'; i.src = k.cover; cover.append(i); } else cover.textContent = k.title;
      const body = el('div', 'body');
      body.append(el('h3', null, k.title));
      if (k.year) body.append(el('div', 'meta', k.year));
      if (k.description) body.append(el('p', null, k.description));
      if (safeUrl(k.link)) { const a = el('a', 'meta', 'Batafsil →'); a.href = k.link; a.target = '_blank'; a.rel = 'noopener'; a.style.display = 'inline-block'; body.append(a); }
      c.append(cover, body);
      $('bookList').append(c);
    });
    // Media (yorliqlar: rasm / video / audio)
    const KINDS = [['image', 'Rasmlar'], ['video', 'Videolar'], ['audio', 'Audiolar']];
    const yt = (u) => { const m = /(?:youtube\.com\/(?:watch\?(?:.*&)?v=|embed\/|shorts\/)|youtu\.be\/)([\w-]{11})/.exec(u); return m ? m[1] : null; };
    const mediaSrc = (u) => (u.startsWith('/uploads/') ? u : safeUrl(u));
    const items = (d.media || []).filter((m) => mediaSrc(m.src));
    const kinds = KINDS.filter(([k]) => items.some((m) => m.type === k));
    const panel = $('mediaPanel'), tabs = $('mediaTabs');
    function showKind(kind) {
      [...tabs.children].forEach((t) => t.setAttribute('aria-selected', t.dataset.kind === kind));
      panel.replaceChildren();
      const list = items.filter((m) => m.type === kind);
      if (kind === 'image') {
        const g = el('div', 'gallery');
        list.forEach((m) => {
          const b = el('button', 'shot'); b.type = 'button';
          const i = new Image(); i.src = mediaSrc(m.src); i.alt = m.title || ''; i.loading = 'lazy';
          b.append(i); if (m.title) b.append(el('span', null, m.title));
          b.onclick = () => lightbox(mediaSrc(m.src), m.title);
          g.append(b);
        });
        panel.append(g);
      } else if (kind === 'video') {
        const g = el('div', 'videos');
        list.forEach((m) => {
          const c = el('article', 'card vid'), f = el('div', 'frame'), id = yt(m.src);
          if (id) {
            const fr = document.createElement('iframe');
            fr.src = `https://www.youtube-nocookie.com/embed/${id}`; fr.loading = 'lazy'; fr.title = m.title || 'Video';
            fr.allow = 'accelerometer; encrypted-media; gyroscope; picture-in-picture; fullscreen'; fr.allowFullscreen = true;
            fr.referrerPolicy = 'strict-origin-when-cross-origin'; f.append(fr);
          } else {
            const v = document.createElement('video'); v.controls = true; v.preload = 'metadata'; v.playsInline = true; v.src = mediaSrc(m.src); f.append(v);
          }
          const b = el('div', 'body'); b.append(el('h3', null, m.title || 'Video'));
          if (m.description) b.append(el('p', null, m.description));
          c.append(f, b); g.append(c);
        });
        panel.append(g);
      } else {
        const g = el('div', 'audios');
        list.forEach((m) => {
          const c = el('article', 'card aud');
          const a = document.createElement('audio'); a.controls = true; a.preload = 'none'; a.src = mediaSrc(m.src);
          c.append(el('h3', null, m.title || 'Audio'));
          if (m.description) c.append(el('p', null, m.description));
          c.append(a); g.append(c);
        });
        panel.append(g);
      }
      // Boshqa yorliqqa o'tganda ijro to'xtaydi (panel qayta quriladi)
    }
    function lightbox(src, alt) {
      open((b) => { const i = new Image(); i.src = src; i.alt = alt || ''; b.append(i); if (alt) b.append(el('div', 'meta', alt)); });
    }
    kinds.forEach(([k, label], n) => {
      const t = el('button', 'tab', label); t.type = 'button'; t.role = 'tab'; t.dataset.kind = k;
      t.append(el('small', null, String(items.filter((m) => m.type === k).length)));
      t.onclick = () => { history.replaceState(null, '', '#media'); showKind(k); };
      tabs.append(t);
    });
    if (kinds.length) { showKind(kinds[0][0]); $('media').hidden = false; $('mediaBtn').hidden = false; }
    const na = document.querySelector('nav a[data-sec="media"]'); if (na) na.hidden = !kinds.length;
    if (location.hash === '#media' && kinds.length) $('media').scrollIntoView();

    // Yangiliklar
    d.news.slice().sort((a, b) => (b.date || '').localeCompare(a.date || '')).forEach((n) => {
      const c = el('article', 'card newsitem');
      if (n.image) { const i = new Image(); i.alt = ''; i.loading = 'lazy'; i.src = n.image; c.append(i); }
      const body = el('div', 'body');
      if (n.date) body.append(el('div', 'meta', n.date));
      body.append(el('h3', null, n.title), el('p', null, n.text.length > 140 ? n.text.slice(0, 140) + '…' : n.text));
      c.append(body);
      c.onclick = () => open((b) => {
        if (n.image) { const i = new Image(); i.alt = ''; i.src = n.image; b.append(i); }
        b.append(el('h3', null, n.title), el('div', 'text', n.text));
        if (n.date) b.append(el('div', 'meta', n.date));
      });
      $('newsList').append(c);
    });
    for (const k of ['poems', 'books', 'news']) {
      const has = d[k].length > 0;
      $(k).hidden = !has;
      const a = document.querySelector(`nav a[data-sec="${k}"]`); if (a) a.hidden = !has;
    }
    // Aloqa
    const L = [['Telegram', s.telegram], ['Instagram', s.instagram], ['Facebook', s.facebook], ['YouTube', s.youtube]];
    if (s.email) L.unshift(['Email', 'mailto:' + s.email]);
    const links = $('links');
    L.forEach(([n, u]) => { if (safeUrl(u)) { const a = el('a', null, n); a.href = u; a.target = '_blank'; a.rel = 'noopener'; links.append(a); } });
    if (!links.children.length) $('contact').hidden = true;
  });
})();
