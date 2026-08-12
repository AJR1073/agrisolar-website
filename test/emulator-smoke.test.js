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
        '/doc/trd.md',
        '/doc/mcp-integration.md',
        '/doc/annual-schedule-implementation-plan.md',
        '/.github/workflows/firebase-hosting-merge.yml'
    ]) {
        const response = await request(path);
        assert.equal(response.status, 404, `${path} must not be hosted`);
    }

    const sendReply = await fetch(`${functionsBase}/sendReply`);
    assert.equal(sendReply.status, 405, 'sendReply should reject GET');

    const unauthenticatedBusinessApi = await request('/api/v1/opportunities');
    assert.equal(
        unauthenticatedBusinessApi.status,
        401,
        'Hosting should rewrite /api/v1 to the authenticated business API'
    );
    assert.equal(
        (await unauthenticatedBusinessApi.json()).error.code,
        'UNAUTHORIZED',
        'Business API should return its structured authentication error'
    );
    const unauthenticatedReviewCenter = await request(
        '/api/v1/admin/review-center?status=all&limit=100'
    );
    assert.equal(
        unauthenticatedReviewCenter.status,
        401,
        'The administrator review center API must require authentication'
    );

    const disabledMcpMetadata = await request('/.well-known/oauth-protected-resource');
    assert.equal(
        disabledMcpMetadata.status,
        503,
        'MCP OAuth discovery should stay disabled until an issuer is configured'
    );
    assert.equal(
        (await disabledMcpMetadata.json()).error,
        'MCP_AUTH_NOT_CONFIGURED'
    );

    const disabledMcp = await fetch(`${hostingBase}/mcp`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: '{}'
    });
    assert.equal(disabledMcp.status, 503, 'Unconfigured DEV MCP must fail closed');

    for (const name of ['discoverProspects', 'draftOutreachEmail']) {
        const getResponse = await fetch(`${functionsBase}/${name}`);
        assert.equal(getResponse.status, 405, `${name} should reject GET`);
        const unauthenticated = await fetch(`${functionsBase}/${name}`, {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: '{}'
        });
        assert.equal(unauthenticated.status, 401, `${name} should require authentication`);
    }

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
