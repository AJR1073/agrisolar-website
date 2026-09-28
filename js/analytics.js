(() => {
    'use strict';
    if (window.AgriSolarAnalytics) return;

    const measurementId = 'G-8CSJZ4PL5H';
    const productionHost = ['agrisolarllc.com', 'www.agrisolarllc.com'].includes(location.hostname);
    const robots = document.querySelector('meta[name="robots"]')?.content || '';
    const privatePage = /^\/admin(?:\/|$)/.test(location.pathname);
    const optedOut = navigator.globalPrivacyControl === true || navigator.doNotTrack === '1';
    // Preview events stay in memory. Never send staging, admin, or opted-out traffic to GA.
    const enabled = productionHost && location.protocol === 'https:' &&
        !/\bnoindex\b/i.test(robots) && !privatePage && !optedOut;
    const mode = optedOut || privatePage ? 'disabled' : enabled ? 'production' : 'preview';
    const pageLocation = location.origin + location.pathname;
    let referrer = '';
    try { referrer = document.referrer ? new URL(document.referrer).origin + '/' : ''; } catch (_) { /* Ignore malformed referrers. */ }

    window.dataLayer = window.dataLayer || [];
    function gtag() { window.dataLayer.push(arguments); }
    // Only fixed event names and non-personal parameters are accepted.
    function track(event, parameters = {}) {
        if (mode === 'disabled') return;
        const safe = { page_location: pageLocation, page_referrer: referrer };
        if (event === 'generate_lead') {
            safe.form_name = 'quote_request';
        } else if (event === 'contact_click' && ['phone', 'email'].includes(parameters.contact_method)) {
            safe.contact_method = parameters.contact_method;
        } else if (event !== 'quote_click') {
            return;
        }
        try { gtag('event', event, safe); } catch (_) { /* Analytics must never interrupt an inquiry. */ }
    }

    window.AgriSolarAnalytics = Object.freeze({ mode, measurementId, track });
    if (mode === 'disabled') return;
    gtag('js', new Date());
    gtag('config', measurementId, {
        page_location: pageLocation,
        page_referrer: referrer,
        allow_google_signals: false,
        allow_ad_personalization_signals: false,
        cookie_flags: 'SameSite=Lax;Secure'
    });
    if (enabled) {
        const script = document.createElement('script');
        script.async = true;
        script.src = `https://www.googletagmanager.com/gtag/js?id=${measurementId}`;
        document.head.appendChild(script);
    }

    document.addEventListener('click', (event) => {
        const link = event.target.closest?.('a[href]');
        if (!link) return;
        const href = link.getAttribute('href') || '';
        if (/^tel:/i.test(href)) track('contact_click', { contact_method: 'phone' });
        else if (/^mailto:/i.test(href)) track('contact_click', { contact_method: 'email' });
        else {
            try {
                const url = new URL(href, location.href);
                if (url.origin === location.origin && /^\/contact\/?$/.test(url.pathname)) track('quote_click');
            } catch (_) { /* Ignore invalid links. */ }
        }
    });
})();
