/* Privacy-protective website analytics. Public website IDs are configuration, not secrets. */
(() => {
  'use strict';
  if (window.top !== window.self) return;
  const script = document.currentScript;
  const id = script && script.dataset.websiteId;
  const domain = location.hostname;
  const allowed = ['caloza.app', 'blog.caloza.app', 'jtcapps.com', 'www.jtcapps.com'];
  const safePage = !/^\/(privacy|terms|data-request|support|ios|unfeast\/(privacy|consumer-health|support|terms))(\/|$)/.test(location.pathname);
  if (!id || !allowed.includes(domain) || !safePage || navigator.doNotTrack === '1' || navigator.globalPrivacyControl === true) return;
  const endpoint = 'https://analytics.jtcapps.com';
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
  const tracker = add('/script.js', { 'data-website-id': id, 'data-domains': allowed.join(','), 'data-do-not-track': 'true', 'data-performance': 'true', 'data-exclude-hash': 'true', 'data-before-send': 'jtcAnalyticsSanitize' });
  if (!location.search && !location.hash) {
    tracker.addEventListener('load', () => add('/recorder.js', { 'data-website-id': id }));
  }
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
})();
