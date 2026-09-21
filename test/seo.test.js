// Run after npm run build:hosting. Covers source metadata and development safeguards.
const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');
const root = path.resolve(__dirname, '..');
const origin = 'https://agrisolarllc.com';
const routes = ['/', '/about/', '/contact/', '/faq/', '/privacy/', '/projects/',
    '/safety-equipment/', '/service-area/', '/services/',
    ...['commercial-mowing', 'solar-grazing', 'vegetation-herbicide-management',
        'native-planting', 'erosion-control', 'site-maintenance-reporting'].map(slug => `/services/${slug}/`)];
const expectedUrls = routes.map(route => origin + route).sort();
const businessId = `${origin}/#business`;
const websiteId = `${origin}/#website`;
const read = filename => fs.readFileSync(filename, 'utf8');
const entities = { amp: '&', quot: '"', apos: "'", lt: '<', gt: '>', nbsp: ' ' };
function decode(value) {
    return String(value ?? '').replace(/&(#x[\da-f]+|#\d+|amp|quot|apos|lt|gt|nbsp);/gi, (match, code) => {
        if (code[0] !== '#') return entities[code.toLowerCase()];
        return String.fromCodePoint(parseInt(code.slice(/^#x/i.test(code) ? 2 : 1), /^#x/i.test(code) ? 16 : 10));
    });
}
function text(value) {
    return decode(String(value ?? '').replace(/<\/?(?:p|div|li|br)\b[^>]*>/gi, ' ')
        .replace(/<[^>]*>/g, '')).replace(/\s+/g, ' ').trim();
}
function attributes(tag) {
    return Object.fromEntries([...tag.matchAll(/([\w:-]+)\s*=\s*(?:"([^"]*)"|'([^']*)')/g)]
        .map(match => [match[1].toLowerCase(), decode(match[2] ?? match[3])]));
}
function tags(html, name) {
    return [...html.matchAll(new RegExp(`<${name}\\b[^>]*>`, 'gi'))].map(match => attributes(match[0]));
}
function metadata(html) {
    const result = new Map();
    for (const tag of tags(html, 'meta')) {
        const key = (tag.property || tag.name || '').toLowerCase();
        if (!key) continue;
        assert.ok(!result.has(key), `Duplicate meta tag: ${key}`);
        result.set(key, tag.content || '');
    }
    return result;
}
function schemas(html) {
    const result = [];
    function visit(value) {
        if (!value || typeof value !== 'object') return;
        if (value['@type']) result.push(value);
        Object.values(value).forEach(child => Array.isArray(child) ? child.forEach(visit) : visit(child));
    }
    for (const match of html.matchAll(/<script\b([^>]*)>([\s\S]*?)<\/script>/gi)) {
        if (attributes(match[1]).type === 'application/ld+json') visit(JSON.parse(match[2]));
    }
    return result;
}
const hasType = (node, type) => [node['@type']].flat().includes(type);
function one(nodes, type, label) {
    const matching = nodes.filter(node => hasType(node, type));
    assert.equal(matching.length, 1, `${label}: expected one ${type}`);
    return matching[0];
}
function asset(directory, raw, label, absolute = false) {
    if (absolute) assert.match(raw || '', /^https:\/\//, `${label}: absolute HTTPS URL required`);
    const url = new URL(raw, origin);
    assert.equal(url.origin, origin, `${label}: wrong asset domain`);
    const filename = path.join(directory, decodeURIComponent(url.pathname));
    assert.ok(fs.existsSync(filename) && fs.statSync(filename).isFile(), `${label}: missing ${url.pathname}`);
}
function noindex(html, label) {
    assert.ok((metadata(html).get('robots') || '').toLowerCase().split(/[\s,]+/).includes('noindex'),
        `${label}: development/admin HTML must contain noindex`);
}
function htmlFiles(directory) {
    return fs.readdirSync(directory, { withFileTypes: true }).flatMap(entry => {
        const filename = path.join(directory, entry.name);
        return entry.isDirectory() ? htmlFiles(filename) : entry.name.endsWith('.html') ? [filename] : [];
    });
}

for (const directory of [root, path.join(root, 'dist')]) {
    const label = directory === root ? 'source' : 'dist';
    const sitemap = read(path.join(directory, 'sitemap.xml')).replace(/<\?xml[^?]*\?>|<!--[\s\S]*?-->/g, '').trim();
    assert.match(sitemap, /^<urlset\s+xmlns="http:\/\/www\.sitemaps\.org\/schemas\/sitemap\/0\.9">[\s\S]*<\/urlset>$/,
        `${label}: sitemap namespace/root missing`);
    const entries = [...sitemap.matchAll(/<url>\s*<loc>([^<]+)<\/loc>\s*<\/url>/g)];
    assert.equal(sitemap.replace(/^<urlset[^>]*>|<\/urlset>$/g, '')
        .replace(/<url>\s*<loc>[^<]+<\/loc>\s*<\/url>/g, '').trim(), '', `${label}: invalid sitemap entry`);
    assert.deepEqual(entries.map(match => decode(match[1])).sort(), expectedUrls,
        `${label}: sitemap must contain exactly the 15 canonical public routes`);
    const robots = read(path.join(directory, 'robots.txt')).replace(/#.*$/gm, '');
    assert.match(robots, /^User-agent:\s*\*\s*$/im, `${label}: robots wildcard group missing`);
    assert.ok(!/^Disallow:\s*\/(?:\*\$?)?\s*$/im.test(robots), `${label}: robots must allow crawlers to read noindex`);
    assert.match(robots, /^Sitemap:\s*https:\/\/agrisolarllc\.com\/sitemap\.xml\s*$/im, `${label}: wrong sitemap URL`);
    for (const icon of ['favicon.svg', 'favicon.png', 'favicon.ico', 'apple-touch-icon.png']) {
        asset(directory, `/${icon}`, `${label}: favicon`);
    }

    for (const route of routes) {
        const page = `${label} ${route}`;
        const html = read(path.join(directory, route.slice(1), 'index.html')).replace(/<!--[\s\S]*?-->/g, '');
        const meta = metadata(html);
        const title = text(html.match(/<title>([\s\S]*?)<\/title>/i)?.[1]);
        const description = meta.get('description');
        assert.ok(title && description, `${page}: title/description missing`);
        const links = tags(html, 'link');
        const canonicals = links.filter(link => link.rel === 'canonical');
        assert.equal(canonicals.length, 1, `${page}: one canonical required`);
        assert.equal(canonicals[0].href, origin + route, `${page}: canonical differs from sitemap`);
        for (const family of ['og', 'twitter']) {
            assert.equal(meta.get(`${family}:title`), title, `${page}: ${family} title mismatch`);
            assert.equal(meta.get(`${family}:description`), description, `${page}: ${family} description mismatch`);
            asset(directory, meta.get(`${family}:image`), `${page}: ${family} image`, true);
            assert.ok(meta.get(`${family}:image:alt`)?.trim(), `${page}: ${family} image alt missing`);
        }
        assert.equal(meta.get('og:url'), origin + route, `${page}: OG canonical mismatch`);
        if (meta.has('twitter:url')) assert.equal(meta.get('twitter:url'), origin + route, `${page}: Twitter URL mismatch`);
        assert.equal(meta.get('twitter:card'), 'summary_large_image', `${page}: Twitter card missing`);
        for (const dimension of ['width', 'height']) {
            assert.match(meta.get(`og:image:${dimension}`) || '', /^[1-9]\d*$/, `${page}: OG image ${dimension} missing`);
        }
        const icons = links.filter(link => /(?:^|\s)(?:icon|apple-touch-icon)(?:\s|$)/.test(link.rel || ''));
        assert.ok(icons.some(link => /(?:^|\s)icon(?:\s|$)/.test(link.rel)), `${page}: favicon link missing`);
        assert.ok(icons.some(link => link.rel === 'apple-touch-icon'), `${page}: touch icon link missing`);
        icons.forEach(icon => asset(directory, icon.href, `${page}: icon`));
        const nodes = schemas(html);
        assert.ok(nodes.length, `${page}: structured data missing`);
        const breadcrumbNodes = nodes.filter(node => hasType(node, 'BreadcrumbList'));
        if (route !== '/') assert.equal(breadcrumbNodes.length, 1, `${page}: breadcrumb required`);
        for (const breadcrumb of breadcrumbNodes) {
            const expected = [origin + '/'];
            let current = '/';
            for (const segment of route.split('/').filter(Boolean)) {
                current += `${segment}/`;
                expected.push(origin + current);
            }
            assert.ok(Array.isArray(breadcrumb.itemListElement), `${page}: breadcrumb items missing`);
            assert.deepEqual(breadcrumb.itemListElement.map((item, index) => {
                assert.equal(item['@type'], 'ListItem', `${page}: invalid breadcrumb type`);
                assert.equal(item.position, index + 1, `${page}: invalid breadcrumb position`);
                assert.ok(item.name?.trim(), `${page}: breadcrumb name missing`);
                const url = typeof item.item === 'string' ? item.item : item.item?.['@id'] || item.item?.url;
                assert.ok(expectedUrls.includes(url), `${page}: breadcrumb must use a real canonical route`);
                return url;
            }), expected, `${page}: breadcrumb hierarchy/current route mismatch`);
        }
        if (/^\/services\/[^/]+\/$/.test(route)) {
            const service = one(nodes, 'Service', page);
            assert.equal(service.provider?.['@id'], businessId, `${page}: Service provider must reference business`);
            assert.equal(service.url, origin + route, `${page}: Service URL mismatch`);
            assert.ok(service.name?.trim(), `${page}: Service name missing`);
        }
        if (route === '/') {
            const businesses = nodes.filter(node => node['@id'] === businessId &&
                (hasType(node, 'LocalBusiness') || hasType(node, 'ProfessionalService')));
            assert.equal(businesses.length, 1, `${page}: business identity required`);
            const business = businesses[0];
            assert.equal(business['@id'], businessId, `${page}: business identity mismatch`);
            assert.equal(business.url, origin + '/', `${page}: business URL mismatch`);
            const website = one(nodes, 'WebSite', page);
            assert.equal(website['@id'], websiteId, `${page}: website identity mismatch`);
            assert.equal(website.url, origin + '/', `${page}: website URL mismatch`);
            assert.equal(website.publisher?.['@id'], businessId, `${page}: website publisher mismatch`);
        }
        const faqs = nodes.filter(node => hasType(node, 'FAQPage'));
        assert.equal(faqs.length, route === '/faq/' ? 1 : 0, `${page}: FAQ schema belongs only on the FAQ page`);
        if (route === '/faq/') {
            const visible = [...html.matchAll(/<details\b[^>]*>\s*<summary\b[^>]*>([\s\S]*?)<\/summary>([\s\S]*?)<\/details>/gi)]
                .map(match => ({ question: text(match[1]), answer: text(match[2]) }));
            assert.ok(visible.length, `${page}: visible FAQ answers missing`);
            assert.ok(Array.isArray(faqs[0].mainEntity), `${page}: FAQ mainEntity must be an array`);
            const structured = faqs[0].mainEntity.map(question => {
                assert.equal(question['@type'], 'Question', `${page}: FAQ Question type missing`);
                assert.equal(question.acceptedAnswer?.['@type'], 'Answer', `${page}: FAQ Answer type missing`);
                return { question: text(question.name), answer: text(question.acceptedAnswer.text) };
            });
            assert.deepEqual(structured, visible, `${page}: FAQ schema differs from visible questions/answers`);
        }
    }
}
const config = JSON.parse(read(path.join(root, 'firebase.json'))).hosting;
assert.ok(config.headers.some(rule => rule.source === '**' && rule.headers.some(header =>
    header.key.toLowerCase() === 'x-robots-tag' && /\bnoindex\b/i.test(header.value))), 'Global Hosting noindex header required');
for (const [source, destination] of [['/about.html', '/about/'], ['/index.html', '/']]) {
    assert.ok(config.redirects?.some(rule => rule.source === source && rule.destination === destination && rule.type === 301),
        `Permanent redirect required: ${source} -> ${destination}`);
}
noindex(read(path.join(root, 'admin/index.html')), 'source admin');
const builtHtml = htmlFiles(path.join(root, 'dist'));
const builtVisitorRoutes = builtHtml.map(filename => path.relative(path.join(root, 'dist'), filename).split(path.sep).join('/'))
    .filter(filename => !filename.startsWith('admin/') && !['404.html', 'about.html'].includes(filename))
    .map(filename => '/' + filename.replace(/index\.html$/, '')).sort();
assert.deepEqual(builtVisitorRoutes, [...routes].sort(), 'Every built visitor page must be covered by the sitemap and SEO checks');
builtHtml.forEach(filename => noindex(read(filename), path.relative(root, filename)));
console.log(`PASS: ${routes.length} source/built pages have consistent SEO; ${builtHtml.length} development pages remain noindex.`);
