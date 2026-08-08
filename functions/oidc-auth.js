const REQUIRED_SCOPE = 'agrisolar:mcp';

class OidcConfigurationError extends Error {
    constructor(message) {
        super(message);
        this.name = 'OidcConfigurationError';
    }
}

function httpsUrl(value, name) {
    let url;
    try {
        url = new URL(value);
    } catch {
        throw new OidcConfigurationError(`${name} must be a valid HTTPS URL.`);
    }
    if (url.protocol !== 'https:' || url.username || url.password || url.search || url.hash) {
        throw new OidcConfigurationError(`${name} must be a clean HTTPS URL.`);
    }
    return url;
}

function normalizeIssuer(value) {
    const url = httpsUrl(value, 'MCP_AUTH_ISSUER');
    return url.href.replace(/\/$/, '');
}

function scopeValues(payload) {
    const raw = payload.scope || payload.scp || '';
    if (Array.isArray(raw)) return raw.filter(item => typeof item === 'string');
    return String(raw).split(/\s+/).filter(Boolean);
}

function createOidcTokenVerifier(options) {
    const issuer = normalizeIssuer(options.issuer);
    const audience = httpsUrl(options.audience, 'MCP_AUTH_AUDIENCE').href;
    const jwksUrl = options.keySet
        ? null
        : httpsUrl(options.jwksUrl, 'MCP_AUTH_JWKS_URL');
    const requiredScope = options.requiredScope || REQUIRED_SCOPE;
    let remoteKeySetPromise;

    async function remoteKeySet() {
        if (options.keySet) return options.keySet;
        if (!remoteKeySetPromise) {
            remoteKeySetPromise = import('jose').then(({ createRemoteJWKSet }) => (
                createRemoteJWKSet(jwksUrl, {
                    timeoutDuration: 5000,
                    cooldownDuration: 30000,
                    cacheMaxAge: 600000
                })
            ));
        }
        return remoteKeySetPromise;
    }

    return {
        async verify(token) {
            if (typeof token !== 'string' || token.length < 20 || token.length > 8192) {
                throw new Error('Access token is invalid.');
            }
            const { jwtVerify } = await import('jose');
            const { payload } = await jwtVerify(token, await remoteKeySet(), {
                issuer,
                audience,
                algorithms: ['RS256', 'ES256'],
                clockTolerance: 5,
                maxTokenAge: '1h'
            });
            if (!payload.sub || typeof payload.sub !== 'string') {
                throw new Error('Access token subject is missing.');
            }
            const scopes = scopeValues(payload);
            if (!scopes.includes(requiredScope)) {
                const error = new Error('Access token scope is insufficient.');
                error.code = 'INSUFFICIENT_SCOPE';
                throw error;
            }
            return {
                subject: payload.sub,
                issuer: typeof payload.iss === 'string' ? payload.iss : issuer,
                agentId: typeof payload.agent_id === 'string'
                    ? payload.agent_id
                    : (typeof payload['https://agrisolarllc.com/agent_id'] === 'string'
                        ? payload['https://agrisolarllc.com/agent_id']
                        : ''),
                authInfo: {
                    token,
                    clientId: String(payload.client_id || payload.azp || 'chatgpt'),
                    scopes,
                    expiresAt: Number(payload.exp),
                    resource: new URL(audience),
                    extra: { subject: payload.sub }
                }
            };
        }
    };
}

function oidcConfigurationFromEnvironment(environment = process.env) {
    const issuer = String(environment.MCP_AUTH_ISSUER || '').trim();
    const audience = String(environment.MCP_AUTH_AUDIENCE || '').trim();
    const jwksUrl = String(environment.MCP_AUTH_JWKS_URL || '').trim();
    if (!issuer || !audience || !jwksUrl) {
        return {
            enabled: false,
            missing: [
                ['MCP_AUTH_ISSUER', issuer],
                ['MCP_AUTH_AUDIENCE', audience],
                ['MCP_AUTH_JWKS_URL', jwksUrl]
            ].filter(([, value]) => !value).map(([name]) => name)
        };
    }
    return {
        enabled: true,
        issuer: normalizeIssuer(issuer),
        audience: httpsUrl(audience, 'MCP_AUTH_AUDIENCE').href,
        jwksUrl: httpsUrl(jwksUrl, 'MCP_AUTH_JWKS_URL').href,
        requiredScope: String(environment.MCP_AUTH_SCOPE || REQUIRED_SCOPE).trim()
            || REQUIRED_SCOPE
    };
}

module.exports = {
    OidcConfigurationError,
    REQUIRED_SCOPE,
    createOidcTokenVerifier,
    oidcConfigurationFromEnvironment,
    scopeValues
};
