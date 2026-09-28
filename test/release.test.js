const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');
const root = path.join(__dirname, '..');
const read = file => fs.readFileSync(path.join(root, file), 'utf8');
const dev = JSON.parse(read('firebase.json')).hosting;
const prod = JSON.parse(read('firebase.production.json')).hosting;
assert.equal(dev.public, 'dist');
assert.equal(prod.public, 'dist-production');
assert.equal(prod.target, 'production', 'Production requires an explicitly configured target');
assert.deepEqual(prod.redirects, dev.redirects);
assert.deepEqual(prod.rewrites, dev.rewrites);
assert.ok(prod.headers.some(rule => rule.source === '/admin{,/**}' &&
    rule.headers.some(header => header.key === 'X-Robots-Tag' && header.value.includes('noindex'))));

for (const [from, to] of [
    ['/About-us/', '/about/'], ['/Contact-Us/', '/contact/'],
    ['/Solar-Vegetation-Management/', '/services/'],
    ['/services/native-planting/', '/services/'], ['/services/erosion-control/', '/services/']
]) {
    assert.ok(prod.redirects.some(rule => rule.source === from && rule.destination === to && rule.type === 301), from);
    assert.ok(fs.existsSync(path.join(root, 'dist-production', to, 'index.html')));
}

const sitemap = read('dist-production/sitemap.xml');
for (const match of sitemap.matchAll(/<loc>https:\/\/agrisolarllc\.com([^<]+)<\/loc>/g)) {
    const file = path.join('dist-production', match[1], 'index.html');
    const html = read(file);
    assert.equal([...html.matchAll(/<script\b[^>]*src="\/js\/analytics\.js\?v=[a-f0-9]{12}"[^>]*defer/g)].length, 1, file);
    assert.ok(!/native planting|erosion.control/i.test(html), `Removed offerings still advertised: ${file}`);
}
assert.ok(!read('dist-production/admin/index.html').includes('/js/analytics.js'));
for (const file of ['AGENTS.md', 'firebase.production.json', 'functions', 'test', 'doc', 'node_modules', 'y']) {
    assert.ok(!fs.existsSync(path.join(root, 'dist-production', file)), `Private source leaked into Hosting: ${file}`);
}
for (const slug of ['native-planting', 'erosion-control']) {
    assert.ok(!fs.existsSync(path.join(root, 'dist-production/services', slug)));
}
console.log('PASS: Production target is explicit, legacy redirects resolve, analytics is on public pages only, and removed offerings/private source are excluded.');
