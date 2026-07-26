const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');

const root = path.resolve(__dirname, '..');
const publicPages = [
    'index.html',
    'about/index.html',
    'contact/index.html',
    'faq/index.html',
    'privacy/index.html',
    'projects/index.html',
    'service-area/index.html',
    'services/index.html',
    'services/commercial-mowing/index.html',
    'services/vegetation-herbicide-management/index.html',
    'services/native-planting/index.html',
    'services/erosion-control/index.html',
    'services/site-maintenance-reporting/index.html'
];
const titles = new Set();
const descriptions = new Set();
const forbiddenContent = [
    'AgriSolar Solutions',
    'info@agrisolarsolutions.com',
    '(555)',
    'Client Testimonials',
    'Professional panel monitoring',
    'Our Equipment Fleet',
    '33% annual'
];

function countMatches(value, expression) {
    return Array.from(value.matchAll(expression)).length;
}

function routeTarget(href) {
    const clean = href.split('#')[0].split('?')[0];
    if (!clean || clean === '/') {
        return 'index.html';
    }
    if (clean.endsWith('/')) {
        return path.join(clean.slice(1), 'index.html');
    }
    return clean.slice(1);
}

for (const page of publicPages) {
    const html = fs.readFileSync(path.join(root, page), 'utf8');
    assert.equal(countMatches(html, /<h1\b/gi), 1, `${page} must contain one H1`);

    const title = html.match(/<title>([^<]+)<\/title>/i)?.[1]?.trim();
    const description = html.match(
        /<meta\s+name="description"\s+content="([^"]+)"/i
    )?.[1]?.trim();
    assert.ok(title, `${page} needs a title`);
    assert.ok(description, `${page} needs a meta description`);
    assert.ok(!titles.has(title), `${page} title must be unique`);
    assert.ok(!descriptions.has(description), `${page} description must be unique`);
    titles.add(title);
    descriptions.add(description);

    assert.match(html, /Request a Quote/i, `${page} needs a quote CTA`);

    for (const content of forbiddenContent) {
        assert.ok(!html.includes(content), `${page} contains unsupported content: ${content}`);
    }

    for (const match of html.matchAll(/href="([^"]+)"/gi)) {
        const href = match[1];
        if (
            !href.startsWith('/') ||
            href.startsWith('//') ||
            href.startsWith('/__/')
        ) {
            continue;
        }
        const target = routeTarget(href);
        assert.ok(
            fs.existsSync(path.join(root, target)),
            `${page} links to missing local target ${href}`
        );
    }

    for (const match of html.matchAll(/<img\b([^>]+)>/gi)) {
        assert.match(match[1], /\balt="[^"]*"/i, `${page} image needs alt text`);
    }
}

console.log(`PASS: ${publicPages.length} public pages have unique metadata, one H1, CTAs, and valid local links.`);
