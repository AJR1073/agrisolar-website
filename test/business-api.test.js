const assert = require('node:assert/strict');
const { createBusinessApiHandler } = require('../functions/business-api');

function createFakeAdmin(seed = {}) {
    const data = structuredClone(seed);
    let keyNumber = 0;
    const tokens = new Map();

    function parts(path = '') {
        return String(path).split('/').filter(Boolean);
    }

    function getValue(path) {
        return parts(path).reduce((value, key) => value?.[key], data);
    }

    function setValue(path, value) {
        const keys = parts(path);
        let current = data;
        for (const key of keys.slice(0, -1)) {
            if (!current[key] || typeof current[key] !== 'object') current[key] = {};
            current = current[key];
        }
        if (!keys.length) throw new Error('Root set is not supported in this fake.');
        current[keys.at(-1)] = structuredClone(value);
    }

    function snapshot(path) {
        const value = getValue(path);
        return {
            exists() { return value !== undefined && value !== null; },
            val() { return value === undefined ? null : structuredClone(value); }
        };
    }

    function createRef(path = '') {
        return {
            get key() { return parts(path).at(-1) || null; },
            async once() { return snapshot(path); },
            push() {
                keyNumber += 1;
                return createRef(`${path}/generated-${String(keyNumber).padStart(4, '0')}`);
            },
            async set(value) { setValue(path, value); },
            async update(updates) {
                if (parts(path).length) throw new Error('Only root update is expected.');
                for (const [childPath, value] of Object.entries(updates)) {
                    setValue(childPath, value);
                }
            },
            async transaction(updater) {
                const next = updater(getValue(path));
                if (next === undefined) return { committed: false };
                setValue(path, next);
                return { committed: true, snapshot: snapshot(path) };
            }
        };
    }

    return {
        data,
        tokens,
        auth() {
            return {
                async verifyIdToken(token) {
                    if (!tokens.has(token)) throw new Error('invalid token');
                    return structuredClone(tokens.get(token));
                }
            };
        },
        database() {
            return { ref: createRef };
        }
    };
}

async function invoke(handler, {
    method = 'GET',
    path = '/api/v1/opportunities',
    token = '',
    body = {},
    query = {},
    idempotencyKey = '',
    contentType = undefined
} = {}) {
    const headers = {};
    if (token) headers.authorization = `Bearer ${token}`;
    if (idempotencyKey) headers['idempotency-key'] = idempotencyKey;
    if (method !== 'GET' && contentType !== null) {
        headers['content-type'] = contentType || 'application/json';
    }
    const request = {
        method,
        url: path,
        originalUrl: path,
        headers,
        body,
        query,
        get(name) { return headers[String(name).toLowerCase()] || ''; }
    };
    const response = {
        statusCode: 200,
        payload: null,
        status(code) { this.statusCode = code; return this; },
        json(value) { this.payload = value; return this; }
    };
    await handler(request, response);
    return response;
}

function opportunityInput(overrides = {}) {
    return {
        company: {
            name: 'Synthetic Solar Operations',
            domain: 'synthetic.example'
        },
        site: {
            name: 'Synthetic Prairie Solar',
            address: '100 Test Road',
            city: 'Example City',
            state: 'IL'
        },
        estimatedAcreage: 75,
        projectDetails: 'Synthetic test opportunity for vegetation management.',
        opportunityType: 'vegetation_management',
        estimatedContractValue: 125000,
        deadlineOn: '2026-08-20',
        source: {
            type: 'public_web',
            title: 'Synthetic public project page',
            url: 'https://synthetic.example/project',
            retrievedAt: 1786078800000
        },
        contact: {
            name: 'Test Operations Contact',
            email: 'operations@synthetic.example'
        },
        aiResearch: {
            summary: 'Synthetic source indicates a potential vegetation-management need.',
            confidence: 0.8,
            model: 'test-model'
        },
        priority: 'high',
        nextAction: 'Verify the bid contact.',
        ...overrides
    };
}

async function run() {
    const fixedNow = Date.parse('2026-08-07T12:00:00Z');
    const admin = createFakeAdmin({
        companies: {
            'other-company': {
                organizationId: 'other-business',
                name: 'Other Organization Company'
            }
        },
        agent_identities: {
            'read-agent': {
                organizationId: 'agrisolar',
                externalSubject: 'read-subject',
                environment: 'DEV',
                status: 'active',
                authorityLevel: 1,
                capabilities: ['opportunity.read', 'analytics.read']
            },
            'sales-agent': {
                organizationId: 'agrisolar',
                externalSubject: 'sales-subject',
                environment: 'DEV',
                status: 'active',
                authorityLevel: 3,
                capabilities: [
                    'opportunity.read',
                    'opportunity.create',
                    'task.create',
                    'analytics.read'
                ]
            },
            'other-agent': {
                organizationId: 'other-business',
                externalSubject: 'other-subject',
                environment: 'DEV',
                status: 'active',
                authorityLevel: 3,
                capabilities: ['opportunity.read']
            }
        }
    });
    admin.tokens.set('owner-token', {
        uid: 'approved-admin',
        email: 'aaronreifschneider@outlook.com'
    });
    admin.tokens.set('read-token', { uid: 'read-subject', agentId: 'read-agent' });
    admin.tokens.set('sales-token', { uid: 'sales-subject', agentId: 'sales-agent' });
    admin.tokens.set('other-token', { uid: 'other-subject', agentId: 'other-agent' });

    const handler = createBusinessApiHandler({
        admin,
        administratorEmail: 'aaronreifschneider@outlook.com',
        organizationId: 'agrisolar',
        environment: 'DEV',
        now: () => fixedNow,
        rateLimiter: async () => {}
    });

    const unauthenticated = await invoke(handler);
    assert.equal(unauthenticated.statusCode, 401);
    assert.equal(unauthenticated.payload.error.code, 'UNAUTHORIZED');

    const otherOrganization = await invoke(handler, { token: 'other-token' });
    assert.equal(otherOrganization.statusCode, 403);
    assert.equal(otherOrganization.payload.error.code, 'FORBIDDEN');

    const forbiddenCreate = await invoke(handler, {
        method: 'POST',
        token: 'read-token',
        idempotencyKey: 'read-agent-create-1',
        body: opportunityInput()
    });
    assert.equal(forbiddenCreate.statusCode, 403);
    assert.equal(forbiddenCreate.payload.error.code, 'FORBIDDEN');

    const unsupportedMediaType = await invoke(handler, {
        method: 'POST',
        token: 'sales-token',
        idempotencyKey: 'missing-json-type-1',
        contentType: null,
        body: opportunityInput()
    });
    assert.equal(unsupportedMediaType.statusCode, 415);
    assert.equal(unsupportedMediaType.payload.error.code, 'UNSUPPORTED_MEDIA_TYPE');

    const invalidPriority = await invoke(handler, {
        method: 'POST',
        token: 'sales-token',
        idempotencyKey: 'invalid-priority-1',
        body: opportunityInput({ priority: 'immediate' })
    });
    assert.equal(invalidPriority.statusCode, 400);
    assert.equal(invalidPriority.payload.error.code, 'VALIDATION_ERROR');

    const crossOrganizationLink = await invoke(handler, {
        method: 'POST',
        token: 'sales-token',
        idempotencyKey: 'cross-org-company-1',
        body: opportunityInput({
            company: { companyId: 'other-company' },
            source: {
                type: 'public_web',
                title: 'Other synthetic source',
                url: 'https://other.synthetic.example/project',
                retrievedAt: 1786078800000
            }
        })
    });
    assert.equal(crossOrganizationLink.statusCode, 404);
    assert.equal(crossOrganizationLink.payload.error.code, 'NOT_FOUND');

    const created = await invoke(handler, {
        method: 'POST',
        token: 'sales-token',
        idempotencyKey: 'sales-opportunity-1',
        body: opportunityInput()
    });
    assert.equal(created.statusCode, 201);
    assert.equal(created.payload.data.status, 'NEW');
    const opportunityId = created.payload.data.opportunityId;
    assert.equal(admin.data.opportunities[opportunityId].organizationId, 'agrisolar');
    assert.equal(admin.data.opportunities[opportunityId].reviewStatus, 'pending_review');
    assert.equal(admin.data.opportunities[opportunityId].aiProvenance.aiGenerated, true);

    const replayed = await invoke(handler, {
        method: 'POST',
        token: 'sales-token',
        idempotencyKey: 'sales-opportunity-1',
        body: opportunityInput()
    });
    assert.equal(replayed.statusCode, 200);
    assert.equal(replayed.payload.replayed, true);
    assert.equal(replayed.payload.data.opportunityId, opportunityId);
    assert.equal(Object.keys(admin.data.opportunities).length, 1);

    const conflictingKey = await invoke(handler, {
        method: 'POST',
        token: 'sales-token',
        idempotencyKey: 'sales-opportunity-1',
        body: opportunityInput({ estimatedAcreage: 80 })
    });
    assert.equal(conflictingKey.statusCode, 409);
    assert.equal(conflictingKey.payload.error.code, 'CONFLICT');

    const duplicate = await invoke(handler, {
        method: 'POST',
        token: 'sales-token',
        idempotencyKey: 'sales-opportunity-2',
        body: opportunityInput()
    });
    assert.equal(duplicate.statusCode, 409);
    assert.equal(duplicate.payload.error.code, 'DUPLICATE_FOUND');
    assert.equal(duplicate.payload.error.details.candidates[0].opportunityId, opportunityId);

    const search = await invoke(handler, {
        token: 'read-token',
        query: { state: 'IL', minimumAcreage: '50', qualified: 'false' }
    });
    assert.equal(search.statusCode, 200);
    assert.equal(search.payload.data.opportunities.length, 1);
    assert.equal(search.payload.data.opportunities[0].opportunityId, opportunityId);

    const invalidLimit = await invoke(handler, {
        token: 'read-token',
        query: { limit: 'all' }
    });
    assert.equal(invalidLimit.statusCode, 400);
    assert.equal(invalidLimit.payload.error.code, 'VALIDATION_ERROR');

    const opened = await invoke(handler, {
        token: 'read-token',
        path: `/api/v1/opportunities/${opportunityId}`
    });
    assert.equal(opened.statusCode, 200);
    assert.equal(opened.payload.data.opportunity.organizationId, 'agrisolar');

    const task = await invoke(handler, {
        method: 'POST',
        path: '/api/v1/tasks',
        token: 'sales-token',
        idempotencyKey: 'sales-task-0001',
        body: {
            title: 'Verify the synthetic bid contact',
            description: 'Review the public source and confirm the correct contact.',
            priority: 'high',
            dueOn: '2026-08-06',
            relatedEntityType: 'opportunity',
            relatedEntityId: opportunityId,
            source: 'AI_AGENT',
            aiReasoning: 'The bid deadline is approaching.'
        }
    });
    assert.equal(task.statusCode, 201);
    assert.equal(task.payload.data.reviewStatus, 'pending_review');

    const pipeline = await invoke(handler, {
        token: 'read-token',
        path: '/api/v1/analytics/sales-pipeline'
    });
    assert.equal(pipeline.statusCode, 200);
    assert.equal(pipeline.payload.data.metrics.totalOpportunities, 1);
    assert.equal(pipeline.payload.data.metrics.pipelineValue, 125000);
    assert.equal(pipeline.payload.data.metrics.overdueFollowUps, 1);
    assert.equal(pipeline.payload.data.highPriorityOpportunities.length, 1);

    const noSendRoute = await invoke(handler, {
        method: 'POST',
        path: '/api/v1/send-email',
        token: 'sales-token',
        idempotencyKey: 'send-email-0001',
        body: { to: 'contact@example.com' }
    });
    assert.equal(noSendRoute.statusCode, 404);
    assert.equal(noSendRoute.payload.error.code, 'NOT_FOUND');

    const audits = Object.values(admin.data.audit_events || {});
    assert.ok(audits.some(event => event.action === 'opportunity.create'
        && event.result === 'success'));
    assert.ok(audits.some(event => event.action === 'opportunity.create'
        && event.result === 'failed'
        && event.errorCode === 'FORBIDDEN'));
    assert.ok(audits.some(event => event.action === 'analytics.sales_pipeline.read'));

    console.log(
        'PASS: Business API enforces identity, capability, organization, idempotency, duplicates, audit, and no-send boundaries'
    );
}

run().catch(error => {
    console.error(error);
    process.exitCode = 1;
});
