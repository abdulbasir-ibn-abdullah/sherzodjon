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
