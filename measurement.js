/* Pitkovice: consent-gated GA4, with Google Ads conversions imported from GA4. */
(() => {
  'use strict';
  const id = 'G-2M2QBYV6DL';
  const key = 'pitkovice-consent-v1';
  const lifetime = 180 * 864e5;
  const live = /^(www\.)?pozemekpitkovice\.cz$/.test(location.hostname);
  const debug = new URLSearchParams(location.search).get('measurement_debug') === '1';
  const banner = document.querySelector('#measurement-banner');
  const dialog = document.querySelector('#privacy-dialog');
  if (!banner || !dialog) return;
  const analytics = dialog.querySelector('#consent-analytics');
  const marketing = dialog.querySelector('#consent-marketing');
  let consent = { analytics: false, marketing: false };
  let saved = false, loaded = false, configured = false, previousFocus;
  const lastEvents = new Map();
  try {
    const value = JSON.parse(localStorage.getItem(key));
    if (value?.version === 1 && typeof value.analytics === 'boolean' && typeof value.marketing === 'boolean'
        && Number.isFinite(value.at) && value.at <= Date.now() && Date.now() - value.at < lifetime) {
      consent = value; saved = true;
    }
  } catch (_) { /* Refusing storage must not prevent use of the website. */ }
  window.dataLayer = window.dataLayer || [];
  window.gtag = window.gtag || function () { window.dataLayer.push(arguments); };
  const denied = { analytics_storage: 'denied', ad_storage: 'denied', ad_user_data: 'denied', ad_personalization: 'denied' };
  window.gtag('consent', 'default', denied);
  window.gtag('set', 'ads_data_redaction', true);
  window.gtag('set', 'url_passthrough', false);

  function pageLocation() {
    const url = new URL(location.href);
    const clean = new URL(url.origin + url.pathname);
    const campaignKeys = ['utm_source', 'utm_medium', 'utm_campaign', 'utm_content', 'utm_term'];
    if (consent.marketing) campaignKeys.push('gclid', 'gbraid', 'wbraid');
    for (const name of campaignKeys) {
      const value = url.searchParams.get(name);
      if (value && value.length <= 200) clean.searchParams.set(name, value);
    }
    return clean.href;
  }
  function referrer() {
    try { return new URL(document.referrer).origin + '/'; } catch (_) { return ''; }
  }
  function clearCookies() {
    for (const item of document.cookie.split(';')) {
      const name = item.split('=')[0].trim();
      if (!(/^_ga(?:_|$)/.test(name) && !consent.analytics) && !(/^_gcl_/.test(name) && !consent.marketing)) continue;
      for (const domain of ['', location.hostname, '.pozemekpitkovice.cz']) {
        document.cookie = name + '=; Max-Age=0; path=/; SameSite=Lax' + (domain ? '; domain=' + domain : '');
      }
    }
  }
  function apply() {
    window['ga-disable-' + id] = !consent.analytics;
    window.gtag('consent', 'update', {
      analytics_storage: consent.analytics ? 'granted' : 'denied',
      ad_storage: consent.analytics && consent.marketing ? 'granted' : 'denied',
      ad_user_data: consent.analytics && consent.marketing ? 'granted' : 'denied',
      ad_personalization: 'denied'
    });
    clearCookies();
    analytics.checked = consent.analytics;
    marketing.checked = consent.marketing;
    banner.hidden = saved;
    if (!live || !consent.analytics || !/^G-[A-Z0-9]+$/.test(id)) return;
    if (!loaded) {
      loaded = true;
      window.gtag('js', new Date());
      const script = document.createElement('script');
      script.async = true;
      script.src = 'https://www.googletagmanager.com/gtag/js?id=' + id;
      script.onerror = () => { loaded = false; script.remove(); };
      document.head.appendChild(script);
    }
    const firstView = !configured;
    configured = true;
    window.gtag('config', id, {
      send_page_view: firstView,
      page_location: pageLocation(), page_referrer: referrer(),
      cookie_expires: 15552000,
      allow_google_signals: false,
      allow_ad_personalization_signals: false,
      ...(debug ? { debug_mode: true } : {})
    });
  }
  function save(allowAnalytics, allowMarketing) {
    consent = { version: 1, analytics: allowAnalytics, marketing: allowMarketing, at: Date.now() };
    saved = true;
    try { localStorage.setItem(key, JSON.stringify(consent)); } catch (_) {}
    apply();
    if (dialog.open) dialog.close();
  }
  function openPrivacy() {
    previousFocus = document.activeElement;
    analytics.checked = consent.analytics;
    marketing.checked = consent.marketing;
    dialog.showModal();
  }
  function event(name, method) {
    if (!live || !consent.analytics || !configured) return;
    const eventKey = name + ':' + (method || '');
    if (Date.now() - (lastEvents.get(eventKey) || 0) < 1500) return;
    lastEvents.set(eventKey, Date.now());
    window.gtag('event', name, {
      send_to: id, page_location: pageLocation(), page_referrer: referrer(),
      ...(method ? { contact_method: method } : {}),
      ...(debug ? { debug_mode: true } : {})
    });
  }
  document.addEventListener('click', e => {
    if (!(e.target instanceof Element)) return;
    const button = e.target.closest('[data-consent], [data-privacy], [data-privacy-close]');
    if (button) {
      if (button.hasAttribute('data-privacy')) openPrivacy();
      else if (button.hasAttribute('data-privacy-close')) dialog.close();
      else if (button.dataset.consent === 'all') save(true, true);
      else if (button.dataset.consent === 'reject') save(false, false);
      else if (button.dataset.consent === 'save') save(analytics.checked, marketing.checked);
      return;
    }
    if (e.target.closest('#privacy-dialog')) return;
    const link = e.target.closest('a[href]');
    const href = link?.getAttribute('href') || '';
    if (href.startsWith('tel:')) event('pitkovice_contact', 'phone');
    else if (href.startsWith('mailto:')) event('pitkovice_contact', 'email');
    else if (e.target.closest('#prepare-email')) event('pitkovice_contact', 'prepared_email');
    else if (e.target.closest('[data-inquiry]')) event('pitkovice_inquiry_open');
    else if (e.target.closest('.fd-film [data-play]')) event('pitkovice_film_open');
  }, true);
  dialog.addEventListener('close', () => previousFocus?.focus());
  window.addEventListener('storage', e => {
    if (e.key !== key) return;
    try {
      const next = JSON.parse(e.newValue);
      if (next?.version !== 1 || typeof next.analytics !== 'boolean' || typeof next.marketing !== 'boolean') return;
      consent = next; saved = true; apply();
    } catch (_) {}
  });
  apply();
})();
