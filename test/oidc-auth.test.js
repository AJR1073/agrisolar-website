const assert = require('node:assert/strict');
const {
    OidcConfigurationError,
    createOidcTokenVerifier,
    oidcConfigurationFromEnvironment
} = require('../functions/oidc-auth');

async function run() {
    const {
        SignJWT,
        createLocalJWKSet,
        exportJWK,
        generateKeyPair
    } = await import('../functions/node_modules/jose/dist/webapi/index.js');
    const issuer = 'https://identity.synthetic.example';
    const audience = 'https://agrisolar-website.web.app/mcp';
    const { privateKey, publicKey } = await generateKeyPair('RS256');
    const publicJwk = await exportJWK(publicKey);
    publicJwk.kid = 'synthetic-key';
    publicJwk.alg = 'RS256';
    publicJwk.use = 'sig';
    const keySet = createLocalJWKSet({ keys: [publicJwk] });
    const verifier = createOidcTokenVerifier({
        issuer,
        audience,
        keySet,
        requiredScope: 'agrisolar:mcp'
    });

    async function token(overrides = {}) {
        const now = Math.floor(Date.now() / 1000);
        const payload = {
            scope: 'openid agrisolar:mcp',
            agent_id: 'synthetic-agent',
            ...overrides.payload
        };
        return new SignJWT(payload)
            .setProtectedHeader({ alg: 'RS256', kid: 'synthetic-key' })
            .setSubject(overrides.subject || 'synthetic-subject')
            .setIssuer(overrides.issuer || issuer)
            .setAudience(overrides.audience || audience)
            .setIssuedAt(overrides.issuedAt || now)
            .setExpirationTime(overrides.expiresAt || now + 300)
            .sign(privateKey);
    }

    const verified = await verifier.verify(await token());
    assert.equal(verified.subject, 'synthetic-subject');
    assert.equal(verified.issuer, issuer);
    assert.equal(verified.agentId, 'synthetic-agent');
    assert.equal(verified.authInfo.resource.href, audience);
    assert.deepEqual(verified.authInfo.scopes, ['openid', 'agrisolar:mcp']);

    await assert.rejects(
        verifier.verify(await token({ audience: 'https://other.example/mcp' })),
        error => error.code === 'ERR_JWT_CLAIM_VALIDATION_FAILED'
            && error.claim === 'aud'
    );
    await assert.rejects(
        verifier.verify(await token({ issuer: 'https://other.example' })),
        error => error.code === 'ERR_JWT_CLAIM_VALIDATION_FAILED'
            && error.claim === 'iss'
    );
    await assert.rejects(
        verifier.verify(await token({ payload: { scope: 'openid' } })),
        error => error.code === 'INSUFFICIENT_SCOPE'
    );
    await assert.rejects(
        verifier.verify(await token({ expiresAt: Math.floor(Date.now() / 1000) - 60 })),
        error => error.code === 'ERR_JWT_EXPIRED'
    );

    assert.deepEqual(oidcConfigurationFromEnvironment({}), {
        enabled: false,
        missing: ['MCP_AUTH_ISSUER', 'MCP_AUTH_AUDIENCE', 'MCP_AUTH_JWKS_URL']
    });
    assert.throws(() => oidcConfigurationFromEnvironment({
        MCP_AUTH_ISSUER: 'http://identity.example',
        MCP_AUTH_AUDIENCE: audience,
        MCP_AUTH_JWKS_URL: 'https://identity.example/jwks.json'
    }), OidcConfigurationError);

    const auth0Issuer = 'https://agrisolar-dev.us.auth0.com/';
    const auth0Verifier = createOidcTokenVerifier({
        issuer: auth0Issuer,
        audience,
        keySet,
        requiredScope: 'agrisolar:mcp'
    });
    const auth0Token = await token({ issuer: auth0Issuer });
    const auth0Verified = await auth0Verifier.verify(auth0Token);
    assert.equal(auth0Verified.issuer, auth0Issuer);
    assert.equal(oidcConfigurationFromEnvironment({
        MCP_AUTH_ISSUER: auth0Issuer,
        MCP_AUTH_AUDIENCE: audience,
        MCP_AUTH_JWKS_URL: 'https://agrisolar-dev.us.auth0.com/.well-known/jwks.json'
    }).issuer, auth0Issuer);

    console.log(
        'PASS: OIDC verifies signature, issuer, audience, expiry, scope, and agent identity claim'
    );
}

run().catch(error => {
    console.error(error);
    process.exitCode = 1;
});
