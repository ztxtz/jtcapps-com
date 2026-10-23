(() => {
  'use strict';
  const root = document.documentElement;
  const media = window.matchMedia('(prefers-reduced-motion: reduce)');
  const toggle = document.getElementById('motion-toggle');
  const scene = document.getElementById('hero-scene');
  let stage = null;
  let stageLoading = false;
  let stageGeneration = 0;
  let pageInactive = false;
  const running = new Set();
  let userPaused = false;
  let paused = media.matches;
  let inView = scene ? scene.getBoundingClientRect().bottom > 0 && scene.getBoundingClientRect().top < innerHeight : false;
  let frame = 0;
  let pointer = { x: 0, y: 0 };

  function animate(element, keyframes, options) {
    if (paused || !element || typeof element.animate !== 'function') return;
    const animation = element.animate(keyframes, options);
    running.add(animation);
    animation.onfinish = () => running.delete(animation);
    animation.oncancel = () => running.delete(animation);
  }

  function applyMotion() {
    paused = userPaused || media.matches;
    root.dataset.motion = paused ? 'off' : 'on';
    if (toggle) {
      toggle.hidden = false;
      toggle.disabled = media.matches;
      toggle.setAttribute('aria-pressed', String(paused));
      toggle.setAttribute('aria-label', media.matches ? 'Animations reduced by your system setting' : paused ? 'Resume animations' : 'Pause animations');
      toggle.querySelector('.motion-label').textContent = media.matches ? 'Motion reduced' : paused ? 'Motion off' : 'Motion on';
      toggle.querySelector('.motion-symbol').textContent = paused ? '▷' : 'Ⅱ';
    }
    if (media.matches && stage) { stage.dispose(); stage = null; }
    stage?.setPaused(paused);
    if (!paused) { requestSceneFrame(); startSignature(); }
    if (paused) {
      for (const animation of running) animation.finish();
      pointer = { x: 0, y: 0 };
      if (scene) scene.style.transform = '';
    }
  }
  applyMotion();
  toggle?.addEventListener('click', () => { userPaused = !userPaused; applyMotion(); });
  media.addEventListener('change', applyMotion);

  document.querySelectorAll('.reveal-line > span').forEach((element, index) => {
    animate(element, [{ transform: 'translateY(110%)', opacity: 0 }, { transform: 'translateY(0)', opacity: 1 }], { duration: 720, delay: index * 90, easing: 'cubic-bezier(.16,1,.3,1)', fill: 'backwards' });
  });
  animate(scene, [{ opacity: 0, transform: 'translateY(24px)' }, { opacity: 1, transform: 'translateY(0)' }], { duration: 1000, easing: 'cubic-bezier(.16,1,.3,1)', fill: 'backwards' });

  function requestSceneFrame() {
    if (!scene || paused || !inView || document.hidden || frame) return;
    frame = requestAnimationFrame(() => {
      frame = 0;
      if (paused || !inView || document.hidden) return;
      const rect = scene.getBoundingClientRect();
      const hero = scene.closest('.hero').getBoundingClientRect();
      const hold = scene.closest('.hero').querySelector('.hero-sticky').getBoundingClientRect().height;
      stage?.setProgress(Math.max(0, -hero.top / Math.max(180, hero.height - hold)));
      const drift = Math.max(-14, Math.min(14, -rect.top * .018));
      scene.style.transform = `perspective(1000px) rotateX(${-pointer.y * 3}deg) rotateY(${pointer.x * 4}deg) translateY(${drift}px)`;
    });
  }
  scene?.addEventListener('pointermove', event => {
    if (event.pointerType !== 'mouse' || paused) return;
    const rect = scene.getBoundingClientRect();
    pointer = { x: ((event.clientX - rect.left) / rect.width - .5) * 2, y: ((event.clientY - rect.top) / rect.height - .5) * 2 };
    requestSceneFrame();
  });
  scene?.addEventListener('pointerleave', () => { pointer = { x: 0, y: 0 }; requestSceneFrame(); });
  window.addEventListener('scroll', requestSceneFrame, { passive: true });
  document.addEventListener('visibilitychange', () => { root.dataset.pageVisible = document.hidden ? 'false' : 'true'; if (!document.hidden) requestSceneFrame(); });
  root.dataset.pageVisible = document.hidden ? 'false' : 'true';

  if ('IntersectionObserver' in window) {
    const sceneObserver = new IntersectionObserver(entries => {
      for (const entry of entries) { inView = entry.isIntersecting; root.dataset.artActive = String(inView); }
      if (inView) startSignature();
      requestSceneFrame();
    });
    if (scene) sceneObserver.observe(scene);
    const revealObserver = new IntersectionObserver(entries => {
      for (const entry of entries) {
        if (!entry.isIntersecting) continue;
        animate(entry.target, [{ transform: 'translateY(22px)', opacity: .35 }, { transform: 'translateY(0)', opacity: 1 }], { duration: 760, easing: 'cubic-bezier(.16,1,.3,1)' });
        revealObserver.unobserve(entry.target);
      }
    }, { threshold: .12 });
    document.querySelectorAll('[data-reveal]').forEach(element => revealObserver.observe(element));
  }

  function startSignature() {
    if (!scene || media.matches || paused || !inView || stage || stageLoading || pageInactive || !('ResizeObserver' in window) || !('IntersectionObserver' in window)) return;
    stageLoading = true;
    const generation = ++stageGeneration;
    import('./jtc-scene.js?v=b69474644a40').then(module => {
      if (generation !== stageGeneration || pageInactive || media.matches || paused) return;
      stage = module.mountSignature(scene);
      stage.setPaused(paused);
      requestSceneFrame();
    }).catch(() => {
      scene.dataset.renderer = 'poster';
      scene.closest('.hero').dataset.signature = 'poster';
    }).finally(() => { if (generation === stageGeneration) stageLoading = false; });
  }
  window.addEventListener('pagehide', () => {
    pageInactive = true; stageGeneration++; stageLoading = false;
    stage?.dispose(); stage = null;
    cancelAnimationFrame(frame); frame = 0;
  });
  window.addEventListener('pageshow', () => {
    pageInactive = false; startSignature(); requestSceneFrame();
  });
  if (!('IntersectionObserver' in window)) startSignature();

  const gallery = document.getElementById('app-gallery');
  const list = gallery?.querySelector('[role="tablist"]');
  const tabs = list ? [...list.querySelectorAll('[role="tab"]')] : [];
  function selectTab(index, focus = false) {
    tabs.forEach((tab, tabIndex) => {
      const active = tabIndex === index;
      tab.setAttribute('aria-selected', String(active));
      tab.tabIndex = active ? 0 : -1;
      const panel = document.getElementById(tab.getAttribute('aria-controls'));
      panel.hidden = !active;
      if (active) animate(panel.querySelector('.phone'), [{ opacity: .2, transform: 'translateY(13px) rotate(-5deg)' }, { opacity: 1, transform: 'translateY(0) rotate(-5deg)' }], { duration: 380, easing: 'cubic-bezier(.16,1,.3,1)' });
    });
    gallery.querySelector('.gallery-position').textContent = `${String(index + 1).padStart(2, '0')} / 03`;
    gallery.querySelector('.gallery-number').textContent = String(index + 1).padStart(2, '0');
    if (focus) tabs[index].focus();
  }
  tabs.forEach((tab, index) => {
    tab.addEventListener('click', () => selectTab(index));
    tab.addEventListener('keydown', event => {
      let next;
      if (event.key === 'ArrowRight') next = (index + 1) % tabs.length;
      else if (event.key === 'ArrowLeft') next = (index - 1 + tabs.length) % tabs.length;
      else if (event.key === 'Home') next = 0;
      else if (event.key === 'End') next = tabs.length - 1;
      else return;
      event.preventDefault(); selectTab(next, true);
    });
  });
  if (list) list.hidden = false;
})();
