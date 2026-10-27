/* Privacy choices and website analytics. Public website IDs are configuration, not secrets. */
(() => {
  'use strict';
  if (window.top !== window.self) return;
  const script = document.currentScript;
  const id = script && script.dataset.websiteId;
  const domain = location.hostname;
  const allowed = ['caloza.app', 'blog.caloza.app', 'jtcapps.com', 'www.jtcapps.com'];
  if (!id || !allowed.includes(domain)) return;
  const key = 'jtc.analytics.choice.v1';
  const endpoint = 'https://analytics.jtcapps.com';
  const safePage = !/^\/(privacy|terms|data-request|support|ios|unfeast\/(privacy|consumer-health|support|terms))(\/|$)/.test(location.pathname);
  let choice;
  try { choice = localStorage.getItem(key); } catch (_) { choice = null; }
  const add = (src, attrs) => {
    const s = document.createElement('script');
    s.src = endpoint + src;
    s.defer = true;
    Object.entries(attrs).forEach(([k, v]) => s.setAttribute(k, v));
    document.head.appendChild(s);
    return s;
  };
  window.jtcAnalyticsSanitize = (_type, payload) => {
    if (!payload) return null;
    try {
      for (const field of ['url', 'referrer']) {
        if (!payload[field]) continue;
        const u = new URL(payload[field], location.origin);
        const clean = new URLSearchParams();
        if (field === 'url') for (const name of ['utm_source', 'utm_medium', 'utm_campaign', 'utm_content', 'utm_term']) {
          const value = u.searchParams.get(name);
          if (value && /^[a-zA-Z0-9._-]{1,64}$/.test(value)) clean.set(name, value);
        }
        u.search = clean.toString(); u.hash = '';
        payload[field] = u.origin === location.origin ? u.pathname + u.search : u.origin + u.pathname + u.search;
      }
    } catch (_) { return null; }
    return payload;
  };
  const attrs = { 'data-website-id': id, 'data-domains': allowed.join(','), 'data-do-not-track': 'true', 'data-performance': 'true', 'data-exclude-hash': 'true', 'data-before-send': 'jtcAnalyticsSanitize' };
  if (safePage && navigator.doNotTrack !== '1' && navigator.globalPrivacyControl !== true && (choice === 'analytics' || choice === 'recording')) {
    const tracker = add('/script.js', attrs);
    if (choice === 'recording' && !location.search && !location.hash) {
      tracker.addEventListener('load', () => add('/recorder.js', { 'data-website-id': id }));
    }
  }
  const el = (tag, text, cls) => { const x = document.createElement(tag); x.textContent = text; if (cls) x.className = cls; return x; };
  function show() {
    if (document.getElementById('jtc-privacy-choice')) return;
    const panel = el('section', '', 'jtc-privacy-panel');
    panel.id = 'jtc-privacy-choice'; panel.setAttribute('role', 'region'); panel.setAttribute('aria-label', 'Website privacy choices');
    panel.append(el('strong', 'Website privacy'), el('p', 'With your permission, we measure visits and interactions. Optional session recordings and heatmaps help us improve the site; form fields and page text are masked. You can change your choice at any time.'));
    const policy = el('a', 'Read the privacy notice');
    policy.href = domain.endsWith('caloza.app') ? 'https://caloza.app/privacy/' : '/privacy/';
    panel.append(policy);
    const actions = el('div', '', 'jtc-privacy-actions');
    [['Reject', 'none'], ['Analytics only', 'analytics'], ['Analytics and recordings', 'recording']].forEach(([label, value]) => {
      const button = el('button', label); button.type = 'button'; button.addEventListener('click', () => { try { localStorage.setItem(key, value); } catch (_) { return; } location.reload(); }); actions.append(button);
    });
    panel.append(actions); document.body.append(panel);
  }
  function ready() {
    if (safePage && (choice === 'analytics' || choice === 'recording')) {
      document.addEventListener('click', event => {
        const link = event.target && event.target.closest && event.target.closest('a[href]');
        if (!link || !window.umami || typeof window.umami.track !== 'function') return;
        let name;
        try {
          const u = new URL(link.href, location.href);
          if (u.hostname === 'apps.apple.com') name = 'app-store-click';
          else if (u.protocol === 'mailto:') name = 'email-click';
          else if (u.protocol === 'https:' && u.hostname !== domain) name = 'outbound-link-click';
          else return;
          window.umami.track(name);
        } catch (_) { /* Ignore invalid or unsupported links. */ }
      });
    }
    const settings = el('button', 'Privacy choices', 'jtc-privacy-settings');
    settings.type = 'button'; settings.addEventListener('click', show); document.body.append(settings);
    if (!choice) show();
  }
  if (document.readyState === 'loading') document.addEventListener('DOMContentLoaded', ready, { once: true }); else ready();
})();
