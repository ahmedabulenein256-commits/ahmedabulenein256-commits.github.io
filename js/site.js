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
    const go = () => setTimeout(finish, Math.max(0, 1100 - (performance.now() - t0)));
    if (d.readyState === 'complete') go(); else addEventListener('load', go, { once: true });
    setTimeout(finish, 2600); // never hold the page hostage
  } else {
    if (loader) loader.remove();
    ready();
  }

  /* ---------- smooth scrolling on desktop (Lenis) ---------- */
  let lenis = null;
  if (fine && !reduce && globalThis.Lenis) {
    lenis = new globalThis.Lenis({ lerp: 0.12, wheelMultiplier: 1, smoothWheel: true, anchors: true });
    const raf = (t) => { lenis.raf(t); requestAnimationFrame(raf); };
    requestAnimationFrame(raf);
    window.__lenis = lenis;
  }

  /* ---------- header: solid after scroll, hide on scroll down ---------- */
  const hdr = d.querySelector('.hdr');
  let lastY = scrollY, ticking = false, scrolling = false, scrollT = 0;
  const mbar = d.querySelector('.mbar');
  const onScroll = () => {
    const y = scrollY;
    if (hdr && !html.classList.contains('menu-open')) {
      hdr.classList.toggle('solid', y > 40);
      hdr.classList.toggle('hide', y > 320 && y > lastY + 2);
      if (y < lastY - 2) hdr.classList.remove('hide');
    }
    lastY = y;
    if (mbar) mbar.classList.toggle('show', y > innerHeight * 0.7 && innerHeight + y < d.documentElement.scrollHeight - 260);
    scrolling = true; clearTimeout(scrollT); scrollT = setTimeout(() => { scrolling = false; }, 160);
    ticking = false;
  };
  addEventListener('scroll', () => { if (!ticking) { ticking = true; requestAnimationFrame(onScroll); } }, { passive: true });

  /* ---------- hero: pick resolution, parallax ---------- */
  const heroVid = d.querySelector('.hero video');
  if (heroVid) {
    const src = innerWidth <= 700 ? heroVid.dataset.m : innerWidth > 1100 ? heroVid.dataset.hd : heroVid.dataset.sd;
    if (!reduce && src) {
      // start the background film after the page has loaded, so first paint and scrolling stay smooth
      const startHero = () => { heroVid.src = src; heroVid.play().catch(() => {}); };
      const later = () => ('requestIdleCallback' in window ? requestIdleCallback(startHero, { timeout: 1200 }) : setTimeout(startHero, 300));
      if (d.readyState === 'complete') later(); else addEventListener('load', later, { once: true });
      heroVid.addEventListener('playing', () => heroVid.classList.add('on'), { once: true });
      // only decode the hero while it is on screen and the tab is visible
      let heroOn = true;
      if ('IntersectionObserver' in window) new IntersectionObserver(([en]) => {
        heroOn = en.isIntersecting; if (!heroVid.src) return; heroOn && !d.hidden ? heroVid.play().catch(() => {}) : heroVid.pause();
      }, { threshold: 0.05 }).observe(heroVid);
      d.addEventListener('visibilitychange', () => { if (!heroVid.src) return; d.hidden || !heroOn ? heroVid.pause() : heroVid.play().catch(() => {}); });
    }
  }
  /* ---------- word-by-word headings ---------- */
  if (!reduce) d.querySelectorAll('h2.rv').forEach((h) => {
    let i = 0;
    const walk = (n) => [...n.childNodes].forEach((c) => {
      if (c.nodeType === 3) {
        const f = d.createDocumentFragment();
        c.textContent.split(/(\s+)/).forEach((t) => {
          if (!t) return;
          if (/^\s+$/.test(t)) { f.appendChild(d.createTextNode(t)); return; }
          const w = d.createElement('span'); w.className = 'w';
          const inner = d.createElement('span'); inner.textContent = t; inner.style.transitionDelay = (i++ * 0.06) + 's';
          w.appendChild(inner); f.appendChild(w);
        });
        c.replaceWith(f);
      } else if (c.nodeType === 1 && c.tagName !== 'BR') walk(c);
    });
    walk(h); h.classList.add('wsplit');
  });

  /* ---------- count-up numbers ---------- */
  const countUp = (el) => {
    const end = +el.dataset.count, t0 = performance.now(), dur = 1400;
    const step = (t) => { const k = Math.min(1, (t - t0) / dur); el.textContent = Math.round(end * (1 - Math.pow(1 - k, 3))); if (k < 1) requestAnimationFrame(step); };
    requestAnimationFrame(step);
  };
  if ('IntersectionObserver' in window) {
    const cio = new IntersectionObserver((es) => es.forEach((en) => { if (en.isIntersecting) { if (!reduce) countUp(en.target); cio.unobserve(en.target); } }), { threshold: 0.6 });
    d.querySelectorAll('[data-count]').forEach((el) => { if (!reduce) el.textContent = '0'; cio.observe(el); });
  }

  /* ---------- growing showreel ---------- */
  const reel = d.querySelector('.reel-sec');
  if (reel) {
    const frame = reel.querySelector('.reel-frame'), rv = reel.querySelector('video');
    const big = () => innerWidth > 700 && !reduce;
    let inView = false;
    const grow = () => {
      if (!big() || !inView) return;
      const r = reel.getBoundingClientRect(), span = r.height - innerHeight;
      const p = Math.min(1, Math.max(0, -r.top / (span * 0.75)));
      frame.style.transform = `scale(${0.6 + 0.4 * p})`;
    };
    addEventListener('scroll', () => requestAnimationFrame(grow), { passive: true });
    addEventListener('resize', grow);
    if ('IntersectionObserver' in window) new IntersectionObserver(([en]) => {
      inView = en.isIntersecting;
      if (inView) { if (!rv.src) rv.src = rv.dataset.src; if (!d.hidden) rv.play().catch(() => {}); grow(); } else rv.pause();
    }, { rootMargin: '200px 0px' }).observe(reel);
    reel.querySelector('[data-reel-sound]').addEventListener('click', () => {
      if (!rv.src) rv.src = rv.dataset.src;
      rv.currentTime = 0; rv.muted = false; rv.loop = false; rv.controls = true;
      reel.classList.add('sound'); rv.play().catch(() => {});
      if (big()) scrollTo({ top: reel.offsetTop + (reel.offsetHeight - innerHeight) * 0.8, behavior: 'smooth' });
    });
  }

  /* ---------- reveals ---------- */
  const io = 'IntersectionObserver' in window ? new IntersectionObserver((es) => {
    es.forEach((e) => { if (e.isIntersecting) { e.target.classList.add('in'); io.unobserve(e.target); } });
  }, { rootMargin: '0px 0px -8% 0px', threshold: 0.08 }) : null;
  d.querySelectorAll('.rv, .mask').forEach((el) => io ? io.observe(el) : el.classList.add('in'));

  /* ---------- tile loops: hover intent on desktop, centred card on phones ---------- */
  const makeLoop = (t) => {
    let v = t._v;
    if (!v) {
      v = t._v = d.createElement('video');
      Object.assign(v, { muted: true, loop: true, playsInline: true, preload: 'auto' });
      v.setAttribute('muted', ''); v.setAttribute('playsinline', ''); v.setAttribute('aria-hidden', 'true');
      v.src = t.dataset.loop;
      if (t.querySelector('.media.vert')) v.className = 'fg';
      t.querySelector('.media').appendChild(v);
      v.addEventListener('playing', () => v.classList.add('on'));
    }
    return v;
  };
  if (!reduce) d.querySelectorAll('.tile[data-loop]').forEach((t) => {
    if (fine) {
      let timer = 0;
      const start = () => { clearTimeout(timer); timer = setTimeout(() => { if (!scrolling && t.matches(':hover')) makeLoop(t).play().catch(() => {}); }, 220); };
      t.addEventListener('mouseenter', start);
      t.addEventListener('mousemove', () => { if (!t._v || t._v.paused) start(); }, { passive: true });
      t.addEventListener('mouseleave', () => { clearTimeout(timer); if (t._v) t._v.pause(); });
    }
  });
  // phones: play the loop of the card that is centred in a swipe rail, one at a time
  if (!fine && !reduce && 'IntersectionObserver' in window) {
    const rio = new IntersectionObserver((es) => es.forEach((en) => {
      const t = en.target;
      if (en.isIntersecting && en.intersectionRatio > 0.8) makeLoop(t).play().catch(() => {});
      else if (t._v) t._v.pause();
    }), { threshold: [0, 0.8] });
    d.querySelectorAll('.rail .tile[data-loop]').forEach((t) => rio.observe(t));
  }
  // swipe hint + progress under each rail (phones)
  d.querySelectorAll('.grid.rail').forEach((rail) => {
    const n = rail.querySelectorAll('.tile').length; if (n < 2) return;
    const h = d.createElement('div'); h.className = 'rail-hint';
    h.innerHTML = `<span>${html.dir === 'rtl' ? 'اسحب' : 'Swipe'} · <b class="c">1</b>/${n}</span><i><b></b></i>`;
    rail.after(h);
    const bar = h.querySelector('i b'), c = h.querySelector('.c');
    const upd = () => { const max = rail.scrollWidth - rail.clientWidth || 1; const p = Math.min(1, Math.abs(rail.scrollLeft) / max);
      bar.style.width = (100 / n + p * (100 - 100 / n)) + '%'; c.textContent = Math.round(p * (n - 1)) + 1; };
    rail.addEventListener('scroll', () => requestAnimationFrame(upd), { passive: true }); upd();
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
      modal.classList.add('open'); html.style.overflow = 'hidden'; if (lenis) lenis.stop();
      mv.play().catch(() => {});
      modal.querySelector('.x').focus({ preventScroll: true });
    };
    const close = () => { modal.classList.remove('open'); html.style.overflow = ''; if (lenis) lenis.start(); mv.pause(); if (opener) opener.focus({ preventScroll: true }); setTimeout(() => { mv.removeAttribute('src'); mv.load(); }, 600); };
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
      const pv = p.querySelector('.pv'); if (pv) { pv.pause(); pv.remove(); }
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
    if (lenis) o ? lenis.stop() : lenis.start();
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

  /* ---------- reading progress (project pages) ---------- */
  const prog = d.querySelector('.progress i');
  if (prog) {
    const upd = () => { const h = d.documentElement.scrollHeight - innerHeight; prog.style.transform = `scaleX(${h > 0 ? Math.min(1, scrollY / h) : 0})`; };
    addEventListener('scroll', () => requestAnimationFrame(upd), { passive: true }); upd();
  }
  addEventListener('pageshow', (e) => { if (e.persisted) html.classList.remove('leaving', 'menu-open'); });

  /* ---------- year ---------- */
  d.querySelectorAll('[data-year]').forEach((el) => { el.textContent = new Date().getFullYear(); });
  onScroll();
})();
