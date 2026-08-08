const { randomUUID } = require('node:crypto');
const { McpServer } = require('@modelcontextprotocol/sdk/server/mcp.js');
const {
    StreamableHTTPServerTransport
} = require('@modelcontextprotocol/sdk/server/streamableHttp.js');
const z = require('zod/v4');
const { ApiError, OPPORTUNITY_STATUSES } = require('./business-api');
const {
    REQUIRED_SCOPE,
    createOidcTokenVerifier,
    oidcConfigurationFromEnvironment
} = require('./oidc-auth');

const OPPORTUNITY_STATUS_VALUES = [...OPPORTUNITY_STATUSES];
const PRIORITY_VALUES = ['low', 'normal', 'high', 'urgent'];
const DEFAULT_RESOURCE_URL = 'https://agrisolar-website.web.app/mcp';
const DEFAULT_METADATA_URL =
    'https://agrisolar-website.web.app/.well-known/oauth-protected-resource';

const optionalDate = z.string().regex(/^\d{4}-\d{2}-\d{2}$/).optional();
const opportunityOutput = z.object({
    requestId: z.string(),
    data: z.record(z.string(), z.unknown()),
    page: z.record(z.string(), z.unknown()).optional(),
    replayed: z.boolean().optional()
});

function toolError(error) {
    const safe = error instanceof ApiError
        ? error
        : new ApiError('INTERNAL_ERROR', 'The request could not be completed.', 500);
    return {
        content: [{ type: 'text', text: `${safe.code}: ${safe.message}` }],
        isError: true
    };
}

function toolSuccess(result, message) {
    return {
        structuredContent: result,
        content: [{ type: 'text', text: message }]
    };
}

function createAgriSolarMcpServer({ businessApi, context }) {
    const server = new McpServer(
        { name: 'agrisolar-business-development', version: '0.1.0' },
        {
            instructions: 'Use search_opportunities before creating an opportunity to check existing records. All records are private AgriSolar DEV data. Creation tools add internal records for administrator review only; no tool sends email or changes contracts, invoices, payments, schedules, or production systems.'
        }
    );
    const oauth = [{ type: 'oauth2', scopes: [REQUIRED_SCOPE] }];
    const oauthMeta = { securitySchemes: oauth };

    server.registerTool('search_opportunities', {
        title: 'Search AgriSolar opportunities',
        description: 'Find known AgriSolar business opportunities and check whether a researched company or solar site is already recorded. Returns bounded summaries only.',
        inputSchema: {
            status: z.array(z.enum(OPPORTUNITY_STATUS_VALUES)).max(11).optional(),
            state: z.string().length(2).optional(),
            city: z.string().max(100).optional(),
            company: z.string().max(120).optional(),
            site: z.string().max(160).optional(),
            keyword: z.string().max(200).optional(),
            priority: z.array(z.enum(PRIORITY_VALUES)).max(4).optional(),
            minimumAcreage: z.number().min(0).max(100000).optional(),
            maximumAcreage: z.number().min(0).max(100000).optional(),
            minimumEstimatedValue: z.number().min(0).max(1000000000).optional(),
            maximumEstimatedValue: z.number().min(0).max(1000000000).optional(),
            deadlineFrom: optionalDate,
            deadlineTo: optionalDate,
            contacted: z.boolean().optional(),
            qualified: z.boolean().optional(),
            limit: z.number().int().min(1).max(50).optional(),
            cursor: z.string().max(256).optional()
        },
        outputSchema: opportunityOutput,
        securitySchemes: oauth,
        _meta: oauthMeta,
        annotations: {
            readOnlyHint: true,
            destructiveHint: false,
            openWorldHint: false
        }
    }, async input => {
        try {
            const result = await businessApi.executeTool(context, 'search_opportunities', input);
            return toolSuccess(
                result,
                `Found ${result.data.opportunities.length} matching opportunities.`
            );
        } catch (error) {
            return toolError(error);
        }
    });

    server.registerTool('get_opportunity', {
        title: 'Open an AgriSolar opportunity',
        description: 'Open one authorized AgriSolar opportunity after finding its stable ID with search_opportunities.',
        inputSchema: {
            opportunityId: z.string().regex(/^[A-Za-z0-9_-]+$/).max(128)
        },
        outputSchema: opportunityOutput,
        securitySchemes: oauth,
        _meta: oauthMeta,
        annotations: {
            readOnlyHint: true,
            destructiveHint: false,
            openWorldHint: false
        }
    }, async input => {
        try {
            const result = await businessApi.executeTool(context, 'get_opportunity', input);
            return toolSuccess(result, 'Opened the authorized opportunity record.');
        } catch (error) {
            return toolError(error);
        }
    });

    server.registerTool('create_opportunity', {
        title: 'Create an unreviewed AgriSolar opportunity',
        description: 'Create one source-backed internal opportunity for administrator review after search_opportunities confirms it is not already recorded. This does not contact anyone.',
        inputSchema: {
            company: z.object({
                companyId: z.string().regex(/^[A-Za-z0-9_-]+$/).max(128).optional(),
                name: z.string().max(120).optional(),
                domain: z.string().max(253).optional()
            }),
            site: z.object({
                siteId: z.string().regex(/^[A-Za-z0-9_-]+$/).max(128).optional(),
                name: z.string().max(160).optional(),
                address: z.string().max(240).optional(),
                city: z.string().max(100).optional(),
                state: z.string().length(2).optional()
            }),
            estimatedAcreage: z.number().min(0).max(100000).optional(),
            projectDetails: z.string().max(4000).optional(),
            opportunityType: z.string().min(1).max(80),
            estimatedContractValue: z.number().min(0).max(1000000000).optional(),
            deadlineOn: optionalDate,
            contact: z.object({
                contactId: z.string().regex(/^[A-Za-z0-9_-]+$/).max(128).optional(),
                name: z.string().max(120).optional(),
                email: z.string().email().max(254).optional()
            }).optional(),
            source: z.object({
                type: z.string().min(1).max(60),
                title: z.string().min(1).max(200),
                url: z.string().url().max(500),
                retrievedAt: z.number().int().optional()
            }),
            notes: z.string().max(4000).optional(),
            aiResearch: z.object({
                summary: z.string().max(4000).optional(),
                confidence: z.number().min(0).max(1).optional(),
                model: z.string().max(120).optional()
            }).optional(),
            priority: z.enum(PRIORITY_VALUES).optional(),
            nextAction: z.string().max(500).optional(),
            idempotencyKey: z.string().regex(/^[A-Za-z0-9._:-]+$/).min(8).max(128)
        },
        outputSchema: opportunityOutput,
        securitySchemes: oauth,
        _meta: oauthMeta,
        annotations: {
            readOnlyHint: false,
            destructiveHint: false,
            openWorldHint: false
        }
    }, async input => {
        try {
            const result = await businessApi.executeTool(context, 'create_opportunity', input);
            return toolSuccess(
                result,
                result.replayed
                    ? 'Returned the prior idempotent opportunity result.'
                    : 'Created one internal opportunity pending administrator review.'
            );
        } catch (error) {
            return toolError(error);
        }
    });

    server.registerTool('create_task', {
        title: 'Create an internal AgriSolar follow-up task',
        description: 'Create one internal follow-up task linked to an authorized opportunity, company, or site. This does not contact a customer or change an external system.',
        inputSchema: {
            title: z.string().min(1).max(180),
            description: z.string().max(4000).optional(),
            priority: z.enum(PRIORITY_VALUES).optional(),
            dueOn: optionalDate,
            ownerUserId: z.string().regex(/^[A-Za-z0-9_-]+$/).max(128).optional(),
            relatedEntityType: z.enum(['opportunity', 'company', 'site']),
            relatedEntityId: z.string().regex(/^[A-Za-z0-9_-]+$/).max(128),
            source: z.string().min(1).max(60),
            aiReasoning: z.string().max(2000).optional(),
            idempotencyKey: z.string().regex(/^[A-Za-z0-9._:-]+$/).min(8).max(128)
        },
        outputSchema: opportunityOutput,
        securitySchemes: oauth,
        _meta: oauthMeta,
        annotations: {
            readOnlyHint: false,
            destructiveHint: false,
            openWorldHint: false
        }
    }, async input => {
        try {
            const result = await businessApi.executeTool(context, 'create_task', input);
            return toolSuccess(
                result,
                result.replayed
                    ? 'Returned the prior idempotent task result.'
                    : 'Created one internal task pending administrator review.'
            );
        } catch (error) {
            return toolError(error);
        }
    });

    server.registerTool('get_sales_pipeline', {
        title: 'Summarize the AgriSolar sales pipeline',
        description: 'Calculate an organization-scoped summary of the current AgriSolar opportunity pipeline and overdue follow-ups.',
        inputSchema: {
            state: z.string().length(2).optional()
        },
        outputSchema: opportunityOutput,
        securitySchemes: oauth,
        _meta: oauthMeta,
        annotations: {
            readOnlyHint: true,
            destructiveHint: false,
            openWorldHint: false
        }
    }, async input => {
        try {
            const result = await businessApi.executeTool(context, 'get_sales_pipeline', input);
            return toolSuccess(result, 'Calculated the authorized sales-pipeline summary.');
        } catch (error) {
            return toolError(error);
        }
    });

    return server;
}

function bearerToken(req) {
    const header = String(req.headers?.authorization || '');
    const match = header.match(/^Bearer\s+(.+)$/i);
    return match ? match[1] : '';
}

function challenge(metadataUrl, scope, error = 'invalid_token') {
    return `Bearer resource_metadata="${metadataUrl}", scope="${scope}", error="${error}", error_description="Authentication is required to access private AgriSolar DEV data"`;
}

function createMcpHandler(options) {
    const businessApi = options.businessApi;
    const resourceUrl = options.resourceUrl
        || process.env.MCP_RESOURCE_URL
        || DEFAULT_RESOURCE_URL;
    const metadataUrl = options.metadataUrl
        || new URL('/.well-known/oauth-protected-resource', resourceUrl).href;
    let authConfig;
    try {
        authConfig = options.authConfig || oidcConfigurationFromEnvironment();
    } catch (error) {
        console.error('AgriSolar MCP OAuth configuration is invalid.', error.message);
        authConfig = { enabled: false, configurationError: true };
    }
    const tokenVerifier = options.tokenVerifier || (authConfig.enabled
        ? createOidcTokenVerifier({
            issuer: authConfig.issuer,
            audience: authConfig.audience,
            jwksUrl: authConfig.jwksUrl,
            requiredScope: authConfig.requiredScope
        })
        : null);
    const requiredScope = authConfig.requiredScope || REQUIRED_SCOPE;
    if (authConfig.enabled && authConfig.audience !== resourceUrl) {
        throw new Error('MCP_AUTH_AUDIENCE must exactly match MCP_RESOURCE_URL.');
    }

    return async function mcpHandler(req, res) {
        const path = new URL(req.originalUrl || req.url || '/', resourceUrl).pathname;
        if (req.method === 'GET' && path.includes('.well-known/oauth-protected-resource')) {
            if (!authConfig.enabled) {
                return res.status(503).json({
                    error: 'MCP_AUTH_NOT_CONFIGURED',
                    message: 'The DEV MCP authorization provider is not configured.'
                });
            }
            return res.status(200).json({
                resource: resourceUrl,
                authorization_servers: [authConfig.issuer],
                scopes_supported: [requiredScope]
            });
        }
        if (req.method === 'OPTIONS') return res.status(204).send('');
        if (path !== '/mcp') {
            return res.status(404).json({ error: 'MCP endpoint was not found.' });
        }
        if (!authConfig.enabled || !tokenVerifier) {
            return res.status(503).json({
                error: 'MCP_AUTH_NOT_CONFIGURED',
                message: 'The DEV MCP endpoint is disabled until OAuth is configured.'
            });
        }
        if (req.method !== 'POST') {
            res.set('Allow', 'POST, OPTIONS');
            return res.status(405).json({
                jsonrpc: '2.0',
                error: { code: -32000, message: 'Method not allowed.' },
                id: null
            });
        }
        const contentType = String(req.headers?.['content-type'] || '').toLowerCase();
        if (!contentType.startsWith('application/json')) {
            return res.status(415).json({
                error: 'unsupported_media_type',
                error_description: 'MCP requests must use application/json.'
            });
        }
        let payloadBytes;
        try {
            payloadBytes = Buffer.byteLength(JSON.stringify(req.body || {}), 'utf8');
        } catch {
            return res.status(400).json({
                error: 'invalid_request',
                error_description: 'The MCP request body is invalid.'
            });
        }
        if (payloadBytes > 65536) {
            return res.status(413).json({
                error: 'payload_too_large',
                error_description: 'The MCP request exceeds the 64 KiB limit.'
            });
        }

        let verified;
        try {
            verified = await tokenVerifier.verify(bearerToken(req));
            req.auth = verified.authInfo;
        } catch (error) {
            const code = error?.code === 'INSUFFICIENT_SCOPE'
                ? 'insufficient_scope'
                : 'invalid_token';
            res.set('WWW-Authenticate', challenge(metadataUrl, requiredScope, code));
            return res.status(code === 'insufficient_scope' ? 403 : 401).json({
                error: code,
                error_description: code === 'insufficient_scope'
                    ? 'The access token does not grant the required MCP scope.'
                    : 'A valid OAuth access token is required.'
            });
        }

        let context;
        try {
            context = await businessApi.resolveAgentContext(
                verified.subject,
                verified.agentId,
                'MCP',
                verified.issuer
            );
        } catch {
            return res.status(403).json({
                error: 'forbidden',
                error_description: 'This OAuth identity is not an active AgriSolar DEV agent.'
            });
        }

        const server = createAgriSolarMcpServer({ businessApi, context });
        const transport = new StreamableHTTPServerTransport({
            sessionIdGenerator: undefined,
            enableJsonResponse: true
        });
        try {
            await server.connect(transport);
            await transport.handleRequest(req, res, req.body);
        } catch (error) {
            console.error('AgriSolar MCP request failed.', {
                requestId: randomUUID(),
                actorId: context.actorId,
                message: error?.message || 'Unknown MCP transport error.'
            });
            if (!res.headersSent) {
                return res.status(500).json({
                    jsonrpc: '2.0',
                    error: { code: -32603, message: 'Internal MCP error.' },
                    id: null
                });
            }
        } finally {
            await transport.close().catch(() => {});
            await server.close().catch(() => {});
        }
        return undefined;
    };
}

module.exports = {
    DEFAULT_METADATA_URL,
    DEFAULT_RESOURCE_URL,
    createAgriSolarMcpServer,
    createMcpHandler
};
