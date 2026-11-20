// Boot: decide between the 3D film and the static page, then run one loop that
// maps scroll position to chapter position `u`, fades the copy, drives the HUD
// and renders the world.
import { BRAND } from './brand.js';
import { Scroller } from './scroll.js';

const root = document.documentElement;
document.querySelectorAll('[data-brand]').forEach((n) => { n.textContent = BRAND; });

const coarse = window.matchMedia('(pointer: coarse)').matches;
const mobile = coarse || window.innerWidth <= 860;
const force = new URLSearchParams(location.search).get('mode');

function hasWebGL2() {
  try { return !!document.createElement('canvas').getContext('webgl2'); } catch { return false; }
}

const clamp = (x, a = 0, b = 1) => Math.min(b, Math.max(a, x));
const smooth = (a, b, x) => { const t = clamp((x - a) / (b - a)); return t * t * (3 - 2 * t); };

if (root.classList.contains('is-loading-film')) {
  if (force === '3d' || hasWebGL2()) {
    start3D().catch((err) => {
      console.error('3D scene failed, showing the static page', err);
      root.classList.remove('is-loading-film', 'is-3d', 'is-mobile-film');
      document.querySelectorAll('.chapter').forEach((s) => { s.style.height = ''; });
    });
  } else {
    root.classList.remove('is-loading-film');
  }
}

async function start3D() {
  const canvas = document.getElementById('gl');
  const { createWorld, rulesShotWeight } = await import('./world.js?v=insights-heatmap-1');
  if (!root.classList.contains('is-loading-film')) return;
  const title = mobile ? createTitleTexture() : null;
  const [world] = await Promise.all([
    createWorld(canvas, { mobile, title }),
    document.fonts.load('400 100px "Instrument Serif"').catch(() => {}),
  ]);
  if (!root.classList.contains('is-loading-film')) {
    world.renderer.dispose();
    world.renderer.forceContextLoss();
    return;
  }
  if (mobile) world.refreshTitle();
  const initialScroll = window.scrollY;
  const pricing = document.getElementById('start');
  const pricingOffset = pricing.getBoundingClientRect().top;
  const initialChapter = [...document.querySelectorAll('.chapter[id]')].reverse().find((chapter) => chapter.offsetTop <= initialScroll);
  root.classList.add('is-3d');
  root.classList.toggle('is-mobile-film', mobile);
  if (mobile) world.resize();
  const chapters = [...document.querySelectorAll('.chapter')];
  const narrow = () => window.innerWidth <= 860;
  let vhUsed = window.innerHeight;
  const layout = () => {
    const vh = vhUsed;
    chapters.forEach((c) => {
      const len = parseFloat((narrow() && c.dataset.lenM) || c.dataset.len || 2);
      c.style.height = `${len * vh}px`;
    });
    return chapters.map((c, i) => ({
      el: c, i, top: c.offsetTop, h: c.offsetHeight, name: c.dataset.name,
      brake: c.dataset.brake?.split(' ').map(Number),
      beats: [...c.querySelectorAll('.beat')].map((b) => ({ el: b, range: b.dataset.range.split(' ').map(Number), o: -1 })),
    }));
  };
  let L = layout();
  // chapter k spans [top, end): `end` is the next chapter's top, or the last scrollable point
  const endOf = (c) => (L[c.i + 1] ? L[c.i + 1].top : c.top + c.h - vhUsed);
  const yFor = (c, p) => c.top + p * (endOf(c) - c.top);
  // A chapter link opens its first scene. A scene link lands on that scene.
  const stopFor = (target) => {
    const chapter = target?.closest('.chapter');
    const c = L.find((x) => x.el === chapter);
    if (!c) return null;
    if (c.i === 0) return 0;
    const beat = c.beats.find((b) => b.el === target) ?? c.beats[0];
    return yFor(c, (beat?.range[0] ?? 0) + 0.1);
  };

  const scroller = new Scroller({ smoothWheel: !mobile });
  let mobileY = null;
  let lastMotion = 0;
  canvas.addEventListener('webglcontextlost', (e) => { e.preventDefault(); location.replace(`${location.pathname}?mode=static${location.hash}`); });

  if (mobile) {
    document.querySelectorAll('.screenshot').forEach((screenshot) => {
      const beat = screenshot.closest('.beat') ?? screenshot.previousElementSibling;
      const link = document.createElement('a');
      link.className = 'film-screenshot';
      link.href = screenshot.href;
      link.textContent = screenshot.querySelector('span').textContent;
      link.setAttribute('aria-label', `${link.textContent}: ${screenshot.querySelector('img').alt}`);
      beat.appendChild(link);
    });
  }

  const mobileCards = mobile ? [...document.querySelectorAll('#reach .beat, #choice .beat, #rules .beat, #insights .beat')] : [];
  const cardHeights = new Map();
  let ruleCardHeight = 0;
  let headerHeight = 0;
  let cardInset = 0;
  if (mobileCards.length) {
    const header = document.querySelector('.hud');
    const measure = () => {
      mobileCards.forEach((card) => cardHeights.set(card, card.offsetHeight));
      ruleCardHeight = Math.max(...mobileCards
        .filter((card) => card.closest('#rules, #insights'))
        .map((card) => cardHeights.get(card)));
      cardInset = parseFloat(getComputedStyle(mobileCards[0]).bottom) || 0;
      headerHeight = header.offsetHeight;
      lastDrawnY = NaN;
      requestFrame();
    };
    const observer = new ResizeObserver(measure);
    [header, ...mobileCards].forEach((element) => observer.observe(element));
  }

  // A fixed scene has no useful native scroll position of its own.
  document.querySelectorAll('a[href^="#"]').forEach((a) => a.addEventListener('click', (e) => {
    if (e.defaultPrevented || e.button !== 0 || e.metaKey || e.ctrlKey || e.shiftKey || e.altKey) return;
    const target = document.getElementById(a.hash.slice(1));
    const stop = stopFor(target);
    if (stop === null) return;
    e.preventDefault();
    target.tabIndex = -1;
    target.focus({ preventScroll: true });
    window.scrollTo(0, stop);
    mobileY = null;
    requestFrame();
    history.replaceState(null, '', a.hash);
  }));
  // keyboard: tabbing into a faded beat brings its chapter to it
  document.querySelectorAll('.beat').forEach((b) => b.addEventListener('focusin', (e) => {
    if (!e.target.matches('a[href]')) return;
    const c = L.find((x) => x.el.contains(b));
    const beat = c?.beats.find((x) => x.el === b);
    if (c && beat && beat.o < 0.5) scroller.scrollTo(yFor(c, beat.range[0] + 0.1));
  }));

  // opening mask: the name is cut out of a linen veil on a 2D canvas at screen
  // resolution. (A CSS-scaled SVG mask re-rasterised at up to 90x and cost
  // 100-200 ms per frame, which froze scrolling in and out of the intro.)
  const intro = document.querySelector('.intro');
  const mask = mobile ? null : createIntroMask(intro.querySelector('.intro__canvas'));
  const hud = document.querySelector('.hud');
  const speedEl = hud.querySelector('[data-speed]');
  const barEl = hud.querySelector('[data-speed-bar]');
  const noEl = hud.querySelector('[data-chapter-no]');
  const nameEl = hud.querySelector('[data-chapter-name]');
  const navLinks = [...hud.querySelectorAll('.hud__nav a')];
  let shownChapter = -1;

  let scrambleId = 0;
  function scramble(el, text) {
    const chars = 'ABCDEFGHIJKLMNOPQRSTUVWXYZ0123456789/';
    const id = ++scrambleId;
    let f = 0;
    const tick = () => {
      if (id !== scrambleId) return;
      f++;
      el.textContent = text.split('').map((ch, i) => (i < f / 2 || ch === ' ' ? ch : chars[(Math.random() * chars.length) | 0])).join('');
      if (f / 2 < text.length) requestAnimationFrame(tick);
    };
    tick();
  }

  // relayout keeps the visitor at the same point of the film; iOS toolbar
  // show/hide (small height-only changes on touch) does not relayout at all
  let lastW = window.innerWidth;
  let currentU = 0;
  window.addEventListener('resize', () => {
    const w = window.innerWidth, h = window.innerHeight;
    if (mobile && w === lastW && Math.abs(h - vhUsed) < 160) return;
    lastW = w; vhUsed = h;
    const u = currentU;
    const pricingOffset = pricing.getBoundingClientRect().top;
    L = layout();
    world.resize();
    mask?.resize();
    const k = Math.min(L.length - 1, Math.floor(u));
    const y = u >= L.length
      ? window.scrollY + pricing.getBoundingClientRect().top - pricingOffset
      : yFor(L[k], u - k);
    window.scrollTo(0, y);
    scroller.target = scroller.current = scroller.prev = scroller.lastY = window.scrollY;
    mobileY = null;
    lastDrawnY = NaN;
    requestFrame();
  });

  let last = performance.now();
  let speedShown = 0, speedText = '', barText = '';
  let errors = 0;
  let hintShown = '', introShown = null;
  let framePending = false;
  let lastDrawnY = NaN;
  function requestFrame() {
    if (framePending) return;
    framePending = true;
    requestAnimationFrame(loop);
  }
  function loop(now) {
    framePending = false;
    if (!mobile) requestFrame();
    try { step(now); errors = 0; } catch (err) {
      console.error(err);
      if (++errors > 3) location.replace(`${location.pathname}?mode=static${location.hash}`);
      else requestFrame();
    }
  }
  function step(now) {
    const dt = clamp((now - last) / 1000, 0.001, 0.05);
    last = now;
    const rawY = mobile ? Math.max(0, window.scrollY) : scroller.update(dt);
    const filmEnd = L.at(-1).top + L.at(-1).h;
    let y = rawY;
    if (mobile) {
      if (mobileY === null || rawY >= filmEnd || Math.abs(rawY - mobileY) > vhUsed * 1.5) {
        mobileY = rawY;
      } else {
        // Safari's native scroll offset can arrive in bursts. Sample on the frame
        // clock and ease very briefly, including after the finger reverses.
        mobileY += (rawY - mobileY) * (1 - Math.exp(-dt / 0.028));
        if (Math.abs(rawY - mobileY) < 0.6) mobileY = rawY;
      }
      y = mobileY;
      if (y < filmEnd && (y !== rawY || now - lastMotion < 130)) requestFrame();
      if (y === lastDrawnY) return;
    }

    // chapter position u: continuous across the document
    let u = 0;
    let brake = 0;
    let cardHeight = 0;
    for (const c of L) {
      const end = endOf(c);
      const p = clamp((y - c.top) / Math.max(1, end - c.top));
      if (y >= c.top || c.i === 0) u = c.i + p;
      const live = y >= c.top - 1 && (y < end || !L[c.i + 1]);
      for (const b of c.beats) {
        const [a, z] = b.range;
        const fade = 0.07;
        const o = live ? Math.min(smooth(a, a + fade, p), 1 - smooth(z - fade, z, p)) : 0;
        const measuredHeight = cardHeights.get(b.el);
        if (measuredHeight && live) {
          const presence = smooth(a - 0.1, a, p) * (1 - smooth(z, z + 0.1, p));
          cardHeight = Math.max(cardHeight, measuredHeight * presence);
        }
        if (Math.abs(o - b.o) > 0.002 || (o === 0) !== (b.o === 0)) {
          b.o = o;
          b.el.style.setProperty('--o', o.toFixed(3));
          b.el.classList.toggle('is-on', o > 0.5);
        }
      }
      if (c.brake && live) {
        const [b0, b1] = c.brake;
        brake = Math.max(brake, smooth(b0 - 0.04, b0 + 0.02, p) * (1 - smooth(b1 - 0.06, b1, p)));
      }
    }
    u = Number.isFinite(u) ? clamp(u, 0, L.length) : 0;
    currentU = u;
    scroller.brake = brake;

    // opening mask
    const p0 = clamp(y / Math.max(1, L[1].top));
    const z = smooth(0.05, 0.42, p0);
    const scale = 1 + Math.pow(z, 2.6) * 90;
    // the letters dissolve while the camera flies through them, so a paused scroll never shows broken glyphs
    const veil = 1 - smooth(0.12, 0.3, p0);
    mask?.draw(scale, veil);
    const hint = (1 - smooth(0, 0.06, p0)).toFixed(3);
    if (hint !== hintShown) { hintShown = hint; intro.style.setProperty('--hint', hint); }
    const introOn = veil > 0.001 || p0 < 0.06;
    if (introOn !== introShown) { introShown = introOn; intro.style.visibility = introOn ? 'visible' : 'hidden'; }

    // HUD: the speed meter explains the brake, so it only shows around it
    if (!mobile) {
      const v = Math.abs(scroller.velocity);
      speedShown += (v - speedShown) * Math.min(1, dt * 10);
      const st = Math.round(speedShown).toLocaleString('en-US');
      if (st !== speedText) { speedText = st; speedEl.textContent = st; }
      const bt = `${Math.min(100, (speedShown / 3500) * 100).toFixed(0)}%`;
      if (bt !== barText) { barText = bt; barEl.style.width = bt; }
      hud.classList.toggle('is-braking', brake > 0.5);
      hud.classList.toggle('show-meter', u > 0.7 && u < 2.1);
    }
    const ci = Math.min(L.length - 1, Math.floor(u + 0.0001));
    if (ci !== shownChapter) {
      shownChapter = ci;
      noEl.textContent = String(ci).padStart(2, '0');
      if (!mobile) scramble(nameEl, (L[ci].name || '').toUpperCase());
      navLinks.forEach((a) => {
        const sectionID = L[ci].el.id || 'start';
        a.setAttribute('aria-current', String(a.hash === `#${sectionID}`));
      });
    }

    if (!mobile || y < filmEnd || !root.classList.contains('is-ready')) {
      const top = headerHeight + 8;
      const movingBottom = window.innerHeight - Math.max(cardHeight, 140);
      const rulesBottom = vhUsed - Math.max(ruleCardHeight, 140);
      const held = mobile ? rulesShotWeight(u) : 0;
      // Each card gets the same space while the phone is held in place.
      const bottom = movingBottom + (rulesBottom - movingBottom) * held - cardInset - 14;
      const screenSpace = mobile && cardHeights.size && bottom > top
        ? { height: bottom - top, center: (top + bottom) / 2 }
        : null;
      world.frame(u, dt, scroller.velocity, screenSpace, scale, veil);
    }
    lastDrawnY = y;
    if (!root.classList.contains('is-ready')) {
      root.classList.add('is-ready');
      root.classList.remove('is-loading-film');
    }
  }
  if (mobile) {
    const followScroll = () => { lastMotion = performance.now(); requestFrame(); };
    window.addEventListener('scroll', followScroll, { passive: true });
    window.addEventListener('touchmove', followScroll, { passive: true });
  }

  // The page can already be scrolled when the film finishes loading.
  const id = location.hash.slice(1);
  const target = document.getElementById(id);
  if (pricingOffset <= 0) {
    window.scrollTo(0, window.scrollY + pricing.getBoundingClientRect().top - pricingOffset);
  } else if (target) {
    const stop = stopFor(target);
    if (stop !== null) window.scrollTo(0, stop);
    else if (id === 'start' || id === 'questions') target.scrollIntoView();
  } else if (initialChapter && initialChapter !== chapters[0]) {
    window.scrollTo(0, stopFor(initialChapter));
  }
  requestFrame();
}

function createTitleTexture() {
  const canvas = document.createElement('canvas');
  const ctx = canvas.getContext('2d');
  return { canvas, resize(w, h) {
    // Rasterize the title once per size/font change. Its zoom and dissolve are
    // texture coordinates in the scene shader, with no per-frame canvas paint.
    const resolution = Math.min(4, 4096 / w);
    const fontSize = Math.min(360, Math.max(48, w * 0.185));
    const band = Math.ceil(fontSize * 2);
    canvas.width = Math.ceil(w * resolution);
    canvas.height = Math.ceil(band * resolution);
    ctx.scale(resolution, resolution);
    const setFont = (px) => {
      ctx.font = `400 ${px}px "Instrument Serif", Georgia, serif`;
      if ('letterSpacing' in ctx) ctx.letterSpacing = `${(-0.035 * px).toFixed(1)}px`;
    };
    setFont(fontSize);
    setFont(fontSize * Math.min(1, w * 0.9 / Math.max(1, ctx.measureText(BRAND).width)));
    ctx.textAlign = 'center';
    ctx.textBaseline = 'middle';
    ctx.fillText(BRAND, w / 2, band / 2);
    const prefix = BRAND.slice(0, BRAND.lastIndexOf('S'));
    const originX = (w / 2 - ctx.measureText(BRAND).width / 2
      + ctx.measureText(prefix).width + ctx.measureText('S').width * 0.2) / w;
    return { originX, heightFraction: band / h };
  } };
}

function createIntroMask(canvas) {
  const ctx = canvas.getContext('2d');
  let w = 0, h = 0, dpr = 1, fontPx = 100, ox = 0, oy = 0, lastKey = '';
  const font = () => {
    ctx.font = `400 ${fontPx}px "Instrument Serif", Georgia, serif`;
    if ('letterSpacing' in ctx) ctx.letterSpacing = `${(-0.035 * fontPx).toFixed(1)}px`;
    ctx.textAlign = 'center';
    ctx.textBaseline = 'middle';
  };
  const resize = () => {
    dpr = Math.min(window.devicePixelRatio || 1, 2);
    w = window.innerWidth; h = window.innerHeight;
    canvas.width = Math.round(w * dpr); canvas.height = Math.round(h * dpr);
    fontPx = Math.min(360, Math.max(48, w * 0.185));
    ctx.setTransform(1, 0, 0, 1, 0, 0);
    font();
    // the whole name fits in 90% of the width, whatever it is called
    const fit = (w * 0.9) / Math.max(1, ctx.measureText(BRAND).width);
    if (fit < 1) { fontPx *= fit; font(); }
    // zoom into the last capital (the "S" of Scroll): the fly-through ends inside a letter
    const full = ctx.measureText(BRAND).width;
    const caps = [...BRAND].map((ch, i) => (/[A-Z]/.test(ch) ? i : -1)).filter((i) => i >= 0);
    const bi = caps.length ? caps[caps.length - 1] : 0;
    const pre = ctx.measureText(BRAND.slice(0, bi)).width;
    const bw = ctx.measureText(BRAND[bi]).width;
    ox = w / 2 - full / 2 + pre + bw * 0.2;
    oy = h / 2;
    lastKey = '';
  };
  const draw = (scale, veil) => {
    const key = `${scale.toFixed(3)}|${veil.toFixed(3)}`;
    if (key === lastKey) return;
    lastKey = key;
    ctx.setTransform(dpr, 0, 0, dpr, 0, 0);
    ctx.globalCompositeOperation = 'source-over';
    ctx.globalAlpha = 1;
    ctx.clearRect(0, 0, w, h);
    if (veil <= 0.001) return;
    ctx.globalAlpha = veil;
    ctx.fillStyle = '#F9F6F0';
    ctx.fillRect(0, 0, w, h);
    ctx.globalAlpha = 1;
    ctx.globalCompositeOperation = 'destination-out';
    ctx.translate(ox, oy); ctx.scale(scale, scale); ctx.translate(-ox, -oy);
    font();
    ctx.fillText(BRAND, w / 2, h / 2);
  };
  resize();
  return { resize, draw };
}
