const assert = require('node:assert/strict');
const http = require('node:http');
const express = require('../functions/node_modules/express');
const {
    Client
} = require('../functions/node_modules/@modelcontextprotocol/sdk/dist/cjs/client/index.js');
const {
    StreamableHTTPClientTransport
} = require('../functions/node_modules/@modelcontextprotocol/sdk/dist/cjs/client/streamableHttp.js');
const { createMcpHandler } = require('../functions/mcp-server');

const authConfig = {
    enabled: true,
    issuer: 'https://identity.synthetic.example',
    audience: 'https://agrisolar-website.web.app/mcp',
    jwksUrl: 'https://identity.synthetic.example/.well-known/jwks.json',
    requiredScope: 'agrisolar:mcp'
};

function createFixture() {
    const calls = [];
    const contexts = [];
    const businessApi = {
        async resolveAgentContext(subject, agentId, source, issuer) {
            contexts.push({ subject, agentId, source, issuer });
            if (subject === 'inactive-subject') throw new Error('inactive');
            return {
                actorType: 'AI_AGENT',
                actorId: agentId || 'synthetic-agent',
                organizationId: 'agrisolar',
                environment: 'DEV',
                authorityLevel: 3,
                capabilities: new Set([
                    'opportunity.read',
                    'opportunity.create',
                    'task.create',
                    'analytics.read'
                ]),
                source
            };
        },
        async executeTool(context, name, input) {
            calls.push({ context, name, input });
            if (name === 'search_opportunities') {
                return {
                    requestId: 'request-search',
                    data: {
                        opportunities: [{
                            opportunityId: 'synthetic-opportunity',
                            siteName: 'Synthetic Prairie Solar',
                            company: 'Synthetic Solar Operations',
                            status: 'NEW',
                            priority: 'high'
                        }]
                    },
                    page: { nextCursor: null }
                };
            }
            if (name === 'get_opportunity') {
                return {
                    requestId: 'request-get',
                    data: { opportunity: { opportunityId: input.opportunityId } }
                };
            }
            if (name === 'create_opportunity'
                || name === 'submit_opportunity_candidate') {
                return {
                    requestId: 'request-create-opportunity',
                    data: {
                        opportunityId: 'created-opportunity',
                        status: 'NEW',
                        reviewStatus: 'pending_review'
                    }
                };
            }
            if (name === 'create_task') {
                return {
                    requestId: 'request-create-task',
                    data: {
                        taskId: 'created-task',
                        status: 'open',
                        reviewStatus: 'pending_review'
                    }
                };
            }
            return {
                requestId: 'request-pipeline',
                data: { metrics: { totalOpportunities: 1, pipelineValue: 125000 } }
            };
        }
    };
    const tokenVerifier = {
        async verify(token) {
            if (token === 'insufficient-token') {
                const error = new Error('scope');
                error.code = 'INSUFFICIENT_SCOPE';
                throw error;
            }
            if (token !== 'valid-token' && token !== 'inactive-token') {
                throw new Error('invalid');
            }
            const subject = token === 'inactive-token'
                ? 'inactive-subject'
                : 'synthetic-subject';
            return {
                subject,
                issuer: 'https://identity.synthetic.example/',
                agentId: 'synthetic-agent',
                authInfo: {
                    token,
                    clientId: 'synthetic-client',
                    scopes: ['agrisolar:mcp'],
                    expiresAt: 4102444800,
                    resource: new URL(authConfig.audience)
                }
            };
        }
    };
    return { businessApi, calls, contexts, tokenVerifier };
}

async function startServer(fixture) {
    const app = express();
    app.use(express.json({ limit: '64kb' }));
    app.use(createMcpHandler({
        businessApi: fixture.businessApi,
        tokenVerifier: fixture.tokenVerifier,
        authConfig
    }));
    const server = http.createServer(app);
    await new Promise(resolve => server.listen(0, '127.0.0.1', resolve));
    const address = server.address();
    return {
        url: `http://127.0.0.1:${address.port}`,
        close: () => new Promise((resolve, reject) => (
            server.close(error => error ? reject(error) : resolve())
        ))
    };
}

async function connectClient(url, token = 'valid-token') {
    const client = new Client({ name: 'agrisolar-mcp-test', version: '1.0.0' });
    const transport = new StreamableHTTPClientTransport(new URL(`${url}/mcp`), {
        requestInit: { headers: { Authorization: `Bearer ${token}` } }
    });
    await client.connect(transport);
    return { client, transport };
}

async function run() {
    const fixture = createFixture();
    const server = await startServer(fixture);
    try {
        const metadata = await fetch(`${server.url}/.well-known/oauth-protected-resource`);
        assert.equal(metadata.status, 200);
        assert.deepEqual(await metadata.json(), {
            resource: 'https://agrisolar-website.web.app/mcp',
            authorization_servers: ['https://identity.synthetic.example'],
            scopes_supported: ['agrisolar:mcp']
        });

        const unauthenticated = await fetch(`${server.url}/mcp`, {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({
                jsonrpc: '2.0',
                id: 1,
                method: 'initialize',
                params: {
                    protocolVersion: '2025-06-18',
                    capabilities: {},
                    clientInfo: { name: 'unauthenticated-test', version: '1.0.0' }
                }
            })
        });
        assert.equal(unauthenticated.status, 401);
        assert.match(
            unauthenticated.headers.get('www-authenticate') || '',
            /oauth-protected-resource/
        );

        const insufficient = await fetch(`${server.url}/mcp`, {
            method: 'POST',
            headers: {
                Authorization: 'Bearer insufficient-token',
                'Content-Type': 'application/json'
            },
            body: '{}'
        });
        assert.equal(insufficient.status, 403);

        const unsupportedMediaType = await fetch(`${server.url}/mcp`, {
            method: 'POST',
            headers: { Authorization: 'Bearer valid-token' },
            body: '{}'
        });
        assert.equal(unsupportedMediaType.status, 415);

        const inactive = await fetch(`${server.url}/mcp`, {
            method: 'POST',
            headers: {
                Authorization: 'Bearer inactive-token',
                'Content-Type': 'application/json'
            },
            body: '{}'
        });
        assert.equal(inactive.status, 403);

        const { client, transport } = await connectClient(server.url);
        try {
            const listed = await client.listTools();
            assert.deepEqual(
                listed.tools.map(tool => tool.name).sort(),
                [
                    'create_opportunity',
                    'create_task',
                    'get_opportunity',
                    'get_sales_pipeline',
                    'search_opportunities',
                    'submit_opportunity_candidate'
                ]
            );
            assert.ok(!listed.tools.some(tool => /email|send|contract|invoice/i.test(tool.name)));
            for (const tool of listed.tools) {
                assert.deepEqual(tool._meta.securitySchemes, [{
                    type: 'oauth2',
                    scopes: ['agrisolar:mcp']
                }]);
                assert.equal(tool.annotations.destructiveHint, false);
                assert.equal(tool.annotations.openWorldHint, false);
            }
            assert.equal(
                listed.tools.find(tool => tool.name === 'search_opportunities')
                    .annotations.readOnlyHint,
                true
            );
            assert.equal(
                listed.tools.find(tool => tool.name === 'create_opportunity')
                    .annotations.readOnlyHint,
                false
            );
            assert.equal(
                listed.tools.find(tool => tool.name === 'submit_opportunity_candidate')
                    .annotations.readOnlyHint,
                false
            );

            const searched = await client.callTool({
                name: 'search_opportunities',
                arguments: { state: 'IL', status: ['NEW'], limit: 10 }
            });
            assert.equal(searched.isError, undefined);
            assert.equal(searched.structuredContent.requestId, 'request-search');
            assert.equal(searched.structuredContent.data.opportunities.length, 1);

            const created = await client.callTool({
                name: 'create_opportunity',
                arguments: {
                    company: { name: 'Synthetic Solar Operations' },
                    site: { name: 'Synthetic Prairie Solar', state: 'IL' },
                    opportunityType: 'vegetation_management',
                    source: {
                        type: 'public_web',
                        title: 'Synthetic source',
                        url: 'https://synthetic.example/opportunity'
                    },
                    priority: 'high',
                    idempotencyKey: 'mcp-opportunity-0001'
                }
            });
            assert.equal(created.isError, undefined);
            assert.equal(
                created.structuredContent.data.reviewStatus,
                'pending_review'
            );

            const submitted = await client.callTool({
                name: 'submit_opportunity_candidate',
                arguments: {
                    company: { name: 'Second Synthetic Solar Operations' },
                    site: { name: 'Second Synthetic Prairie Solar', state: 'IL' },
                    opportunityType: 'vegetation_management',
                    source: {
                        type: 'public_web',
                        title: 'Second synthetic source',
                        url: 'https://second-synthetic.example/opportunity'
                    },
                    priority: 'normal',
                    idempotencyKey: 'mcp-candidate-0001'
                }
            });
            assert.equal(submitted.isError, undefined);
            assert.equal(
                submitted.structuredContent.data.reviewStatus,
                'pending_review'
            );

            const callsBeforeInvalid = fixture.calls.length;
            const invalid = await client.callTool({
                name: 'create_task',
                arguments: { title: '' }
            });
            assert.equal(invalid.isError, true);
            assert.equal(fixture.calls.length, callsBeforeInvalid);
        } finally {
            await transport.close();
            await client.close();
        }

        assert.ok(fixture.contexts.length >= 1);
        assert.ok(fixture.contexts.every(context => context.source === 'MCP'));
        assert.ok(fixture.calls.every(call => call.context.organizationId === 'agrisolar'));
        assert.ok(fixture.calls.some(call => call.name === 'search_opportunities'));
        assert.ok(fixture.calls.some(call => call.name === 'create_opportunity'));
        assert.ok(fixture.calls.some(call => call.name === 'submit_opportunity_candidate'));

        console.log(
            'PASS: MCP Streamable HTTP, OAuth boundary, tool contracts, annotations, validation, and no-send surface'
        );
    } finally {
        await server.close();
    }
}

run().catch(error => {
    console.error(error);
    process.exitCode = 1;
});
