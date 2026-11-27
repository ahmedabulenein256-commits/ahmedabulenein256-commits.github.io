import * as THREE from './three.module.min.js';

const html = document.documentElement;
const reduce = matchMedia('(prefers-reduced-motion: reduce)').matches;
const clamp = (v, a = 0, b = 1) => Math.min(b, Math.max(a, v));
const smooth = (a, b, v) => { const t = clamp((v - a) / (b - a)); return t * t * (3 - 2 * t); };
const lerp = (a, b, t) => a + (b - a) * t;

/* ---------- menu ---------- */
const burger = document.getElementById('burger');
const setMenu = (open) => {
  html.classList.toggle('menu-open', open);
  burger.setAttribute('aria-expanded', open);
  burger.setAttribute('aria-label', open ? 'Close menu' : 'Open menu');
};
burger.addEventListener('click', () => setMenu(!html.classList.contains('menu-open')));
document.querySelectorAll('#panel a').forEach(a => a.addEventListener('click', () => setMenu(false)));
addEventListener('keydown', e => { if (e.key === 'Escape') setMenu(false); });

/* ---------- section reveals (once) ---------- */
const io = new IntersectionObserver((es) => es.forEach(e => {
  if (e.isIntersecting) { e.target.classList.add('in'); io.unobserve(e.target); }
}), { rootMargin: '0px 0px -10% 0px' });
document.querySelectorAll('.rv').forEach(el => io.observe(el));
setTimeout(() => document.querySelectorAll('.rv:not(.in)').forEach(el => {
  if (el.getBoundingClientRect().top < innerHeight) el.classList.add('in');
}), 3000);

/* ---------- tagline, word by word ---------- */
const tag = document.getElementById('tag');
tag.innerHTML = tag.textContent.trim().split(/\s+/).map(w => `<span class="w">${w}</span>`).join(' ');
const words = [...tag.querySelectorAll('.w')];
const tagTick = () => {
  const line = innerHeight * 0.72;
  for (const w of words) if (!w.classList.contains('on') && w.getBoundingClientRect().top < line) w.classList.add('on');
};

/* ---------- nav current item ---------- */
const navLinks = [...document.querySelectorAll('.nav .links a')];
const navTargets = navLinks.map(a => document.querySelector(a.getAttribute('href')));
const navTick = () => {
  let cur = 0;
  navTargets.forEach((t, i) => { if (t && t.getBoundingClientRect().top < innerHeight * 0.5) cur = i; });
  navLinks.forEach((a, i) => i === cur ? a.setAttribute('aria-current', 'true') : a.removeAttribute('aria-current'));
};

let roomTick = null;
let ticking = false;
const onScroll = () => {
  if (ticking) return;
  ticking = true;
  requestAnimationFrame(() => { ticking = false; tagTick(); navTick(); if (roomTick) roomTick(); });
};
addEventListener('scroll', onScroll, { passive: true });
addEventListener('resize', onScroll);
onScroll();

/* ---------- the screening room ---------- */
function initRoom() {
  const canvas = document.getElementById('gl');
  const stage = document.getElementById('stage');
  const room = document.getElementById('room');
  const hero = document.getElementById('hero');
  const hint = document.getElementById('hint');
  const hud = document.getElementById('hud');
  const info = document.getElementById('info');
  const rail = document.getElementById('rail');
  const el = id => document.getElementById(id);

  const PORTRAIT = new Set(['maseer', 'orvane', 'verdelle', 'lofte']);
  const items = [...document.querySelectorAll('#list a')].map(a => ({
    href: a.getAttribute('href'),
    slug: a.getAttribute('href').replace(/^work\/|\.html$/g, ''),
    title: a.querySelector('.t').textContent,
    kind: a.dataset.kind,
    loop: a.dataset.loop ? 'media/' + a.dataset.loop : null,
    img: 'media/' + a.dataset.img,
    sm: a.querySelector('img').getAttribute('src'),
  }));
  const N = items.length;
  const small = Math.min(innerWidth, innerHeight) < 700 || navigator.maxTouchPoints > 1;

  let renderer;
  try {
    renderer = new THREE.WebGLRenderer({ canvas, antialias: !small, powerPreference: 'high-performance' });
  } catch (e) { return false; }
  renderer.setPixelRatio(Math.min(devicePixelRatio || 1, small ? 1.5 : 2));
  renderer.outputColorSpace = THREE.SRGBColorSpace;
  renderer.setClearColor(0x000000, 1);

  html.classList.add('gl');
  stage.appendChild(hero);
  room.style.setProperty('--len', (1 + N * 0.85).toFixed(2));

  const scene = new THREE.Scene();
  scene.fog = new THREE.Fog(0x000000, 9, 30);
  const camera = new THREE.PerspectiveCamera(40, 1, 0.1, 200);
  scene.add(new THREE.AmbientLight(0xffffff, 0.5));
  const key = new THREE.DirectionalLight(0xffffff, 2.2);
  key.position.set(-4, 6, 5);
  scene.add(key);

  const S = 7, CY = 1.3, FLOOR = -0.26;
  let X = 3.6, D = 5.2, narrow = false, spread = 0;
  const SX = 4.2;

  /* reflection fade */
  const gc = document.createElement('canvas'); gc.width = 4; gc.height = 128;
  const gx = gc.getContext('2d');
  const grad = gx.createLinearGradient(0, 0, 0, 128);
  grad.addColorStop(0, '#000'); grad.addColorStop(0.45, '#000'); grad.addColorStop(1, '#fff');
  gx.fillStyle = grad; gx.fillRect(0, 0, 4, 128);
  const fadeMap = new THREE.CanvasTexture(gc);

  const loader = new THREE.TextureLoader();
  const cover = (tex, iw, ih, pa) => {
    const ia = iw / ih;
    if (ia > pa) { tex.repeat.set(pa / ia, 1); tex.offset.set((1 - pa / ia) / 2, 0); }
    else { tex.repeat.set(1, ia / pa); tex.offset.set(0, (1 - ia / pa) / 2); }
  };
  const frameMat = new THREE.MeshStandardMaterial({ color: 0x272727, roughness: 0.35, metalness: 0.7 });

  const screens = items.map((it, i) => {
    const portrait = PORTRAIT.has(it.slug);
    const w = portrait ? 1.6875 : 3.3, h = portrait ? 3 : 1.85625;
    const g = new THREE.Group();
    const geo = new THREE.PlaneGeometry(w, h);
    const mat = new THREE.MeshBasicMaterial({ color: 0x000000 });
    const mesh = new THREE.Mesh(geo, mat);
    mesh.userData.i = i;
    const frame = new THREE.Mesh(new THREE.BoxGeometry(w + 0.07, h + 0.07, 0.06), frameMat);
    frame.position.z = -0.035;
    const rmat = new THREE.MeshBasicMaterial({ color: 0x000000, transparent: true, opacity: 0.28, alphaMap: fadeMap, side: THREE.DoubleSide, depthWrite: false });
    const refl = new THREE.Mesh(geo, rmat);
    refl.scale.y = -1;
    const cy = FLOOR + 0.06 + h / 2;
    refl.position.y = -2 * (cy - FLOOR);
    g.add(frame, mesh, refl);
    scene.add(g);
    const s = { it, i, g, mesh, cy, mat, rmat, pa: w / h, side: i % 2 ? 1 : -1, lum: 0, hov: 0, hi: false, video: null, playing: false };
    const setMap = (tex, iw, ih) => {
      tex.colorSpace = THREE.SRGBColorSpace;
      cover(tex, iw, ih, s.pa);
      mat.map = tex; rmat.map = tex; mat.needsUpdate = true; rmat.needsUpdate = true;
      s.ready = true;
    };
    s.setMap = setMap;
    loader.load(it.sm, t => { if (!s.hi && !s.playing) setMap(t, t.image.width, t.image.height); html.classList.add('lit'); });
    return s;
  });
  setTimeout(() => html.classList.add('lit'), 1500);

  const hiRes = (s) => {
    if (s.hi) return; s.hi = true;
    loader.load(s.it.img, t => { if (!s.playing) s.setMap(t, t.image.width, t.image.height); });
  };
  const play = (s) => {
    if (!s.it.loop) return;
    if (!s.video) {
      const v = document.createElement('video');
      v.muted = true; v.loop = true; v.playsInline = true; v.preload = 'auto'; v.src = s.it.loop;
      s.video = v;
      v.addEventListener('playing', () => {
        if (s.vtex) return;
        s.vtex = new THREE.VideoTexture(v);
        s.playing = true;
        s.setMap(s.vtex, v.videoWidth, v.videoHeight);
      });
    }
    if (s.video.paused) s.video.play().catch(() => {});
  };
  const pause = (s) => { if (s.video && !s.video.paused) s.video.pause(); };

  /* monumental name behind everything */
  const NAME_Z = 34;
  let nameMesh = null, nameAspect = 6;
  const buildName = () => {
    const c = document.createElement('canvas');
    const x = c.getContext('2d');
    const font = (px) => `600 ${px}px Manrope, system-ui, sans-serif`;
    x.font = font(200);
    const tw = x.measureText('ABULENEIN').width;
    c.width = 2048; const px = 200 * (2000 / tw); c.height = Math.ceil(px * 0.86);
    x.font = font(px); x.fillStyle = '#313131'; x.textBaseline = 'alphabetic'; x.textAlign = 'center';
    x.fillText('ABULENEIN', 1024, px * 0.79);
    const t = new THREE.CanvasTexture(c); t.colorSpace = THREE.SRGBColorSpace;
    nameAspect = c.width / c.height;
    nameMesh = new THREE.Mesh(new THREE.PlaneGeometry(1, 1), new THREE.MeshBasicMaterial({ map: t, transparent: true, fog: false, depthWrite: false }));
    nameMesh.renderOrder = -1;
    scene.add(nameMesh);
    layout();
  };
  (document.fonts && document.fonts.load ? document.fonts.load('600 100px Manrope') : Promise.resolve()).then(buildName, buildName);

  let nameY = 6;
  function layout() {
    const w = stage.clientWidth, h = stage.clientHeight;
    renderer.setSize(w, h, false);
    const a = w / h;
    camera.aspect = a;
    narrow = a < 1;
    camera.fov = narrow ? 58 : 40;
    X = narrow ? 1.15 : clamp(2.2 + a, 3, 4.2);
    D = narrow ? 6.8 : 5.2;
    camera.updateProjectionMatrix();
    screens.forEach(s => {
      if (narrow) { s.g.position.set(s.i * SX, s.cy, 0); s.g.rotation.y = 0; }
      else { s.g.position.set(s.side * X * (1 + spread), s.cy, -s.i * S); s.g.rotation.y = Math.atan2(-s.side * X, D); }
    });
    if (nameMesh) {
      const halfH = Math.tan(THREE.MathUtils.degToRad(camera.fov / 2)) * NAME_Z;
      const width = 2 * halfH * a * 0.94;
      nameMesh.scale.set(width, width / nameAspect, 1);
      nameY = CY + halfH * (narrow ? 0.66 : 0.6);
    }
  }
  layout();
  addEventListener('resize', layout);

  /* rail */
  const U0 = -0.55, U1 = N - 1 + 0.3;
  const railBtns = items.map((it, i) => {
    const b = document.createElement('button');
    b.type = 'button'; b.setAttribute('aria-label', it.title);
    b.addEventListener('click', () => {
      const top = room.getBoundingClientRect().top + scrollY;
      scrollTo({ top: top + ((i - U0) / (U1 - U0)) * (room.offsetHeight - innerHeight), behavior: 'smooth' });
    });
    rail.appendChild(b);
    return b;
  });
  el('hudT').textContent = String(N).padStart(2, '0');

  /* scroll state */
  let p = 0, uT = U0, uC = U0 - 0.45, active = -1, swapT = 0;
  roomTick = () => {
    const r = room.getBoundingClientRect();
    p = clamp(-r.top / (room.offsetHeight - innerHeight));
    uT = lerp(U0, U1, p);
  };
  roomTick();

  const setActive = (k) => {
    if (k === active) return;
    active = k;
    railBtns.forEach((b, i) => b.classList.toggle('on', i === k));
    info.classList.add('swap');
    clearTimeout(swapT);
    swapT = setTimeout(() => {
      const it = items[k];
      el('hudN').textContent = String(k + 1).padStart(2, '0');
      el('hudTitle').textContent = it.title;
      el('hudKind').textContent = it.kind;
      el('hudLink').setAttribute('href', it.href);
      info.classList.remove('swap');
    }, 200);
  };

  /* pointer */
  const mouse = new THREE.Vector2(0, 0), mC = new THREE.Vector2(0, 0), ndc = new THREE.Vector2(2, 2);
  const ray = new THREE.Raycaster();
  let hover = -1, pointerIn = false;
  const meshes = screens.map(s => s.mesh);
  stage.addEventListener('pointermove', e => {
    const r = stage.getBoundingClientRect();
    ndc.set(((e.clientX - r.left) / r.width) * 2 - 1, -((e.clientY - r.top) / r.height) * 2 + 1);
    if (e.pointerType === 'mouse') { mouse.copy(ndc); pointerIn = true; }
  });
  stage.addEventListener('pointerleave', () => { pointerIn = false; ndc.set(2, 2); mouse.set(0, 0); });
  const pick = () => {
    ray.setFromCamera(ndc, camera);
    const hit = ray.intersectObjects(meshes, false)[0];
    return hit && hit.distance < 16 ? hit.object.userData.i : -1;
  };
  canvas.addEventListener('click', e => {
    const r = stage.getBoundingClientRect();
    ndc.set(((e.clientX - r.left) / r.width) * 2 - 1, -((e.clientY - r.top) / r.height) * 2 + 1);
    const i = pick();
    if (i >= 0) location.href = items[i].href;
  });

  /* loop */
  let running = true, last = performance.now(), mediaT = 0;
  new IntersectionObserver(es => { running = es[0].isIntersecting; if (!running) screens.forEach(pause); }).observe(stage);
  const look = new THREE.Vector3(), fwd = new THREE.Vector3();

  function frame(now) {
    requestAnimationFrame(frame);
    if (!running || document.hidden) { last = now; return; }
    const dt = Math.min(0.05, (now - last) / 1000); last = now;
    uC += (uT - uC) * (1 - Math.exp(-dt * 3.2));
    mC.lerp(mouse, 1 - Math.exp(-dt * 4));

    const k = clamp(Math.round(uC), 0, N - 1);
    const d = Math.abs(uC - k);
    const w = smooth(0.5, 0.14, d);
    const s = screens[k];
    const zc = D - uC * S;

    const heroMix = 1 - smooth(-0.5, 0, uC);
    if (narrow) {
      camera.position.set(uC * SX, CY, D);
      fwd.set(uC * SX, CY, 0);
      look.copy(fwd).lerp(s.g.position, w * 0.9);
      camera.lookAt(look);
      if (nameMesh) nameMesh.position.set(uC * SX * 0.94, nameY, D - NAME_Z);
    } else {
      if (Math.abs(heroMix * 0.5 - spread) > 0.002) {
        spread = heroMix * 0.5;
        for (const sc of screens) sc.g.position.x = sc.side * X * (1 + spread);
      }
      camera.position.set(-s.side * 0.55 * w + mC.x * 0.3, CY + mC.y * 0.14, zc);
      fwd.set(mC.x * 0.6, CY, zc - 12);
      look.copy(fwd).lerp(s.g.position, w * 0.9);
      camera.lookAt(look);
      if (nameMesh) nameMesh.position.set(0, nameY, zc - NAME_Z);
    }

    if (pointerIn) {
      const h = pick();
      if (h !== hover) { hover = h; canvas.style.cursor = h >= 0 ? 'pointer' : ''; }
    } else if (hover !== -1) { hover = -1; canvas.style.cursor = ''; }

    for (const sc of screens) {
      const on = sc.i === k ? w : 0;
      const target = sc.ready ? Math.max(lerp(0.42, 1, on), heroMix * 0.8, sc.i === hover ? 1 : 0) : 0;
      sc.lum += (target - sc.lum) * (1 - Math.exp(-dt * 5));
      sc.mat.color.setScalar(sc.lum); sc.rmat.color.setScalar(sc.lum);
      sc.hov += ((sc.i === hover ? 1 : 0) - sc.hov) * (1 - Math.exp(-dt * 8));
      const sv = 1 + sc.hov * 0.035; sc.g.scale.set(sv, sv, 1);
    }

    mediaT += dt;
    if (mediaT > 0.25) {
      mediaT = 0;
      const reach = small ? 0.8 : 1.35;
      for (const sc of screens) {
        const dist = Math.abs(uC - sc.i);
        if (dist < 2.2) hiRes(sc);
        if (dist < reach) play(sc); else pause(sc);
      }
      setActive(k);
    }

    const ho = 1 - smooth(0, 0.035, p);
    hero.style.opacity = ho.toFixed(3);
    hero.style.transform = `translateY(${(-(1 - ho) * 32).toFixed(1)}px)`;
    hero.classList.toggle('gone', ho < 0.05);
    hint.style.opacity = ho.toFixed(3);
    const uo = smooth(-0.3, -0.02, uC);
    hud.style.opacity = uo.toFixed(3);
    hud.classList.toggle('on', uo > 0.5);

    renderer.render(scene, camera);
  }
  requestAnimationFrame(frame);
  window.__room = { screens, camera, get u() { return uC; } };
  return true;
}

if (!reduce) {
  try { initRoom(); } catch (e) { html.classList.remove('gl'); console.warn('room', e); }
}
