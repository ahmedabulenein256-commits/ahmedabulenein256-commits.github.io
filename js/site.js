/* Ahmed Abulenein — site behaviour (no dependencies) */
(() => {
  const d = document, html = d.documentElement, body = d.body;
  const reduce = matchMedia('(prefers-reduced-motion: reduce)').matches;
  const fine = matchMedia('(hover: hover) and (pointer: fine)').matches;
  const store = { get(k) { try { return sessionStorage.getItem(k); } catch (e) { return null; } },
                  set(k, v) { try { sessionStorage.setItem(k, v); } catch (e) {} } };

  /* ---------- loader (first visit of the session, home page only) ---------- */
  const loader = d.querySelector('.loader');
  const ready = () => requestAnimationFrame(() => html.classList.add('ready'));
  if (loader && !store.get('aa-seen') && !reduce) {
    store.set('aa-seen', '1');
    const finish = () => { loader.classList.add('done'); setTimeout(ready, 250); };
    const t0 = performance.now();
    const go = () => setTimeout(finish, Math.max(0, 1900 - (performance.now() - t0)));
    if (d.readyState === 'complete') go(); else addEventListener('load', go, { once: true });
    setTimeout(finish, 3800); // never hold the page hostage
  } else {
    if (loader) loader.remove();
    ready();
  }

  /* ---------- header: solid after scroll, hide on scroll down ---------- */
  const hdr = d.querySelector('.hdr');
  let lastY = scrollY, ticking = false;
  const onScroll = () => {
    const y = scrollY;
    if (hdr && !html.classList.contains('menu-open')) {
      hdr.classList.toggle('solid', y > 40);
      hdr.classList.toggle('hide', y > 320 && y > lastY + 2);
      if (y < lastY - 2) hdr.classList.remove('hide');
    }
    lastY = y;
    parallax(y);
    ticking = false;
  };
  addEventListener('scroll', () => { if (!ticking) { ticking = true; requestAnimationFrame(onScroll); } }, { passive: true });

  /* ---------- hero: pick resolution, parallax ---------- */
  const heroVid = d.querySelector('.hero video');
  if (heroVid) {
    const src = innerWidth > 1100 ? heroVid.dataset.hd : heroVid.dataset.sd;
    if (!reduce && src) {
      heroVid.src = src;
      heroVid.addEventListener('playing', () => heroVid.classList.add('on'), { once: true });
      heroVid.play().catch(() => {});
      // only decode the hero while it is on screen and the tab is visible
      let heroOn = true;
      if ('IntersectionObserver' in window) new IntersectionObserver(([en]) => {
        heroOn = en.isIntersecting; heroOn && !d.hidden ? heroVid.play().catch(() => {}) : heroVid.pause();
      }, { threshold: 0.05 }).observe(heroVid);
      d.addEventListener('visibilitychange', () => { d.hidden || !heroOn ? heroVid.pause() : heroVid.play().catch(() => {}); });
    }
  }
  function parallax(y) {
    if (!heroVid || reduce || innerWidth < 700 || y > innerHeight * 1.2) return;
    heroVid.style.transform = `translate3d(0,${y * 0.18}px,0) scale(${1.06 + y * 0.00012})`;
    const copy = d.querySelector('.hero .copy');
    if (copy) copy.style.opacity = Math.max(0, 1 - y / (innerHeight * 0.7));
  }

  /* ---------- reveals ---------- */
  const io = 'IntersectionObserver' in window ? new IntersectionObserver((es) => {
    es.forEach((e) => { if (e.isIntersecting) { e.target.classList.add('in'); io.unobserve(e.target); } });
  }, { rootMargin: '0px 0px -8% 0px', threshold: 0.08 }) : null;
  d.querySelectorAll('.rv, .mask').forEach((el) => io ? io.observe(el) : el.classList.add('in'));

  /* ---------- tile hover loops (lazy) ---------- */
  d.querySelectorAll('.tile[data-loop]').forEach((t) => {
    if (!fine || reduce) return;
    let v = null;
    t.addEventListener('mouseenter', () => {
      if (!v) {
        v = d.createElement('video');
        Object.assign(v, { muted: true, loop: true, playsInline: true, preload: 'auto' });
        v.setAttribute('muted', ''); v.setAttribute('aria-hidden', 'true');
        v.src = t.dataset.loop;
        if (t.querySelector('.media.vert')) v.className = 'fg';
        t.querySelector('.media').appendChild(v);
        v.addEventListener('playing', () => v.classList.add('on'));
      }
      v.play().catch(() => {});
    });
    t.addEventListener('mouseleave', () => { if (v) { v.pause(); } });
  });

  /* ---------- custom cursor ---------- */
  if (fine && !reduce) {
    const c = d.createElement('div'); c.className = 'cursor'; c.innerHTML = '<span></span>';
    body.appendChild(c);
    const label = c.firstChild;
    let x = -100, y = -100, cx = x, cy = y;
    addEventListener('mousemove', (e) => { x = e.clientX; y = e.clientY; c.style.opacity = 1; }, { passive: true });
    d.addEventListener('mouseleave', () => { c.style.opacity = 0; });
    let running = false;
    const loop = () => {
      cx += (x - cx) * 0.22; cy += (y - cy) * 0.22;
      c.style.transform = `translate3d(${cx}px,${cy}px,0)`;
      if (Math.abs(x - cx) + Math.abs(y - cy) > 0.3) requestAnimationFrame(loop); else running = false;
    };
    addEventListener('mousemove', () => { if (!running) { running = true; requestAnimationFrame(loop); } }, { passive: true });
    d.addEventListener('mouseover', (e) => {
      const el = e.target.closest('[data-cursor]');
      if (el) { label.textContent = el.dataset.cursor; c.classList.add('big'); } else c.classList.remove('big');
    });
  }

  /* ---------- film modal ---------- */
  const modal = d.querySelector('.modal');
  if (modal) {
    const mv = modal.querySelector('video'), mcap = modal.querySelector('.cap');
    let opener = null;
    const open = (src, title, vertical) => {
      opener = d.activeElement;
      mv.src = src; mv.classList.toggle('vert', !!vertical);
      mcap.textContent = title || '';
      modal.classList.add('open'); html.style.overflow = 'hidden';
      mv.play().catch(() => {});
      modal.querySelector('.x').focus({ preventScroll: true });
    };
    const close = () => { modal.classList.remove('open'); html.style.overflow = ''; mv.pause(); if (opener) opener.focus({ preventScroll: true }); setTimeout(() => { mv.removeAttribute('src'); mv.load(); }, 600); };
    d.addEventListener('click', (e) => {
      const b = e.target.closest('[data-film]');
      if (b) { e.preventDefault(); open(b.dataset.film, b.dataset.title, b.dataset.vertical === '1'); }
    });
    modal.querySelector('.x').addEventListener('click', close);
    modal.addEventListener('click', (e) => { if (e.target === modal) close(); });
    addEventListener('keydown', (e) => { if (e.key === 'Escape' && modal.classList.contains('open')) close(); });
  }

  /* ---------- case-study players ---------- */
  d.querySelectorAll('.player').forEach((p) => {
    const v = p.querySelector('video'), b = p.querySelector('.playbtn');
    if (!v || !b) return;
    b.addEventListener('click', () => {
      d.querySelectorAll('.player video').forEach((o) => { if (o !== v) o.pause(); });
      if (!v.src) v.src = v.dataset.src;
      v.controls = true; b.classList.add('off'); v.play().catch(() => {});
    });
  });

  /* ---------- work filters (grouped) ---------- */
  const filters = d.querySelector('.filters');
  if (filters) {
    const groups = [...d.querySelectorAll('.group')];
    const apply = (f) => {
      filters.querySelectorAll('button').forEach((b) => b.setAttribute('aria-pressed', b.dataset.f === f));
      groups.forEach((g) => {
        const show = f === 'all' || g.dataset.group === f;
        g.classList.toggle('hidden', !show);
        if (show) g.querySelectorAll('.rv').forEach((t) => t.classList.add('in'));
      });
    };
    filters.addEventListener('click', (e) => { const b = e.target.closest('button'); if (b) { apply(b.dataset.f); history.replaceState(null, '', b.dataset.f === 'all' ? location.pathname : '#' + b.dataset.f); } });
    const h = location.hash.slice(1);
    if (h && filters.querySelector(`[data-f="${h}"]`)) apply(h);
  }

  /* ---------- mobile menu ---------- */
  const mb = d.querySelector('.menu-btn');
  if (mb) mb.addEventListener('click', () => {
    const o = html.classList.toggle('menu-open');
    mb.setAttribute('aria-expanded', o);
    if (o) hdr.classList.remove('hide');
  });

  /* ---------- brief form -> email / WhatsApp ---------- */
  const form = d.querySelector('#brief');
  if (form) {
    const compose = () => {
      const f = new FormData(form), g = (k) => (f.get(k) || '').toString().trim();
      const lines = [`Name: ${g('name')}`, `Company / brand: ${g('company')}`, `Email: ${g('email')}`, `Project type: ${g('type')}`,
        `Budget range: ${g('budget')}`, `Timeline: ${g('timeline')}`, '', g('message')];
      return { subject: `New project — ${g('company') || g('name')}`, body: lines.join('\n') };
    };
    form.addEventListener('submit', (e) => {
      e.preventDefault();
      if (!form.reportValidity()) return;
      const m = compose();
      location.href = `mailto:${form.dataset.to}?subject=${encodeURIComponent(m.subject)}&body=${encodeURIComponent(m.body)}`;
      const s = form.querySelector('.status-line'); if (s) s.textContent = 'Your email app should open with the brief filled in. If it doesn’t, write to ' + form.dataset.to + '.';
    });
    const wa = form.querySelector('[data-wa]');
    if (wa) wa.addEventListener('click', (e) => {
      e.preventDefault();
      if (!form.reportValidity()) return;
      const m = compose();
      window.open(`https://wa.me/${form.dataset.wa}?text=${encodeURIComponent(m.subject + '\n\n' + m.body)}`, '_blank', 'noopener');
    });
  }

  /* ---------- page transitions ---------- */
  if (!reduce) {
    d.addEventListener('click', (e) => {
      const a = e.target.closest('a[href]');
      if (!a || e.defaultPrevented || e.metaKey || e.ctrlKey || e.shiftKey || e.button !== 0) return;
      if (a.target === '_blank' || a.hasAttribute('download') || a.dataset.film) return;
      const u = new URL(a.href, location.href);
      if (u.origin !== location.origin || (u.pathname === location.pathname && u.hash)) return;
      if (/^(mailto|tel|https?:\/\/wa\.me)/.test(a.getAttribute('href'))) return;
      e.preventDefault();
      html.classList.add('leaving');
      setTimeout(() => { location.href = a.href; }, 420);
    });
    addEventListener('pageshow', (e) => { if (e.persisted) html.classList.remove('leaving', 'menu-open'); });
  }

  /* ---------- year ---------- */
  d.querySelectorAll('[data-year]').forEach((el) => { el.textContent = new Date().getFullYear(); });
  onScroll();
})();
