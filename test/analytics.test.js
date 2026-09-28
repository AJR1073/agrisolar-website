const assert = require('node:assert/strict');
const fs = require('node:fs');
const vm = require('node:vm');
const source = fs.readFileSync(require('node:path').join(__dirname, '../js/analytics.js'), 'utf8');

function load({ url = 'https://agrisolarllc.com/contact/?email=private@example.com#secret', robots = '', navigator = {} } = {}) {
    const appended = [];
    const listeners = {};
    const context = {
        location: new URL(url), navigator, URL,
        document: {
            referrer: 'https://example.com/customer/private?email=private@example.com',
            querySelector: () => ({ content: robots }),
            createElement: () => ({}),
            head: { appendChild: script => appended.push(script) },
            addEventListener: (name, callback) => { listeners[name] = callback; }
        }
    };
    context.window = context;
    vm.createContext(context);
    vm.runInContext(source, context);
    const events = () => Array.from(context.dataLayer).filter(args => args[0] === 'event').map(args => Array.from(args));
    const click = href => listeners.click?.({ target: { closest: () => ({ getAttribute: () => href }) } });
    return { context, appended, events, click };
}

const live = load();
assert.equal(live.context.AgriSolarAnalytics.mode, 'production');
assert.equal(live.appended.length, 1);
assert.equal(live.appended[0].src, 'https://www.googletagmanager.com/gtag/js?id=G-8CSJZ4PL5H');
const config = live.context.dataLayer.find(args => args[0] === 'config');
assert.equal(config[2].page_location, 'https://agrisolarllc.com/contact/');
assert.equal(config[2].page_referrer, 'https://example.com/');
assert.equal(config[2].allow_google_signals, false);
assert.equal(config[2].allow_ad_personalization_signals, false);
live.click('tel:+16185392098');
live.click('mailto:info@agrisolarllc.com');
live.click('/contact/?email=private@example.com');
live.click('https://other.example/contact/');
live.context.AgriSolarAnalytics.track('generate_lead', { email: 'private@example.com', name: 'Private Person' });
live.context.AgriSolarAnalytics.track('unapproved_event', { secret: 'secret' });
assert.deepEqual(live.events().map(args => args[1]), ['contact_click', 'contact_click', 'quote_click', 'generate_lead']);
assert.ok(!JSON.stringify(live.context.dataLayer).includes('private@example.com'));
assert.ok(!JSON.stringify(live.context.dataLayer).includes('Private Person'));
vm.runInContext(source, live.context);
assert.equal(live.appended.length, 1, 'Do not install the Google tag twice');

for (const options of [
    { url: 'https://agrisolar-website.web.app/' },
    { url: 'https://agrisolar-website.firebaseapp.com/' },
    { url: 'https://agrisolar-website--preview.example.com/' },
    { url: 'http://localhost:5100/' },
    { url: 'https://agrisolarllc.com/', robots: 'noindex, nofollow, noarchive' }
]) {
    const preview = load(options);
    assert.equal(preview.context.AgriSolarAnalytics.mode, 'preview');
    assert.equal(preview.appended.length, 0, 'Dev must not load GA or send testing data to production');
    preview.context.AgriSolarAnalytics.track('generate_lead');
    assert.equal(preview.events().length, 1, 'Preview events remain inspectable locally');
}
for (const options of [
    { url: 'https://agrisolarllc.com/admin/' },
    { navigator: { globalPrivacyControl: true } },
    { navigator: { doNotTrack: '1' } }
]) {
    const disabled = load(options);
    assert.equal(disabled.context.AgriSolarAnalytics.mode, 'disabled');
    disabled.context.AgriSolarAnalytics.track('generate_lead');
    assert.equal(disabled.context.dataLayer.length, 0);
    assert.equal(disabled.appended.length, 0);
}
console.log('PASS: GA uses the existing ID only on production, keeps dev local, respects opt-out, and excludes personal fields and URL queries.');
