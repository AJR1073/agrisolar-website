const assert = require('node:assert/strict');

const hostingBase = 'http://127.0.0.1:5100';
const functionsBase = 'http://127.0.0.1:5101/agrisolar-website/us-central1';

async function request(path) {
    return fetch(`${hostingBase}${path}`, { redirect: 'manual' });
}

async function run() {
    for (const path of [
        '/',
        '/services/',
        '/services/commercial-mowing/',
        '/about/',
        '/service-area/',
        '/projects/',
        '/faq/',
        '/contact/',
        '/privacy/'
    ]) {
        const response = await request(path);
        assert.equal(response.status, 200, `${path} should load`);
        assert.match(
            response.headers.get('x-robots-tag') || '',
            /noindex/,
            `${path} should be noindex on Firebase`
        );
    }

    const missing = await request('/this-page-does-not-exist/');
    assert.equal(missing.status, 404, 'Unknown routes should return 404');
    assert.match(await missing.text(), /Page Not Found/);

    for (const path of [
        '/functions/index.js',
        '/database.rules.json',
        '/storage.rules',
        '/package.json',
        '/doc/prd.txt',
        '/doc/prd.md',
        '/doc/annual-schedule-implementation-plan.md',
        '/.github/workflows/firebase-hosting-merge.yml'
    ]) {
        const response = await request(path);
        assert.equal(response.status, 404, `${path} must not be hosted`);
    }

    const sendReply = await fetch(`${functionsBase}/sendReply`);
    assert.equal(sendReply.status, 405, 'sendReply should reject GET');

    const removedTestEndpoint = await fetch(`${functionsBase}/testEmailSending`);
    assert.equal(
        removedTestEndpoint.status,
        404,
        'Unauthenticated testEmailSending endpoint must not exist'
    );

    console.log('PASS: Hosting pages, 404, security exclusions, headers, and Functions surface');
}

run().catch((error) => {
    console.error(error);
    process.exitCode = 1;
});
