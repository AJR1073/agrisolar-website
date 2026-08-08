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
        opportunities: {
            'other-opportunity': {
                organizationId: 'other-business',
                companyNameSnapshot: 'Other Organization Company',
                siteNameSnapshot: 'Other Site',
                status: 'NEW',
                priority: 'normal',
                reviewStatus: 'pending_review',
                createdAt: fixedNow - 1000,
                updatedAt: fixedNow - 1000
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
            },
            'missing-subject-agent': {
                organizationId: 'agrisolar',
                environment: 'DEV',
                status: 'active',
                authorityLevel: 1,
                capabilities: ['opportunity.read']
            },
            'issuer-agent': {
                organizationId: 'agrisolar',
                externalSubject: 'issuer-subject',
                issuer: 'https://identity.synthetic.example/',
                environment: 'DEV',
                status: 'active',
                authorityLevel: 1,
                capabilities: ['opportunity.read']
            }
        }
    });
    admin.tokens.set('owner-token', {
        uid: 'approved-admin',
        email: 'aaronreifschneider@outlook.com',
        admin: true,
        organizationId: 'agrisolar'
    });
    admin.tokens.set('email-only-token', {
        uid: 'email-only-admin',
        email: 'aaronreifschneider@outlook.com'
    });
    admin.tokens.set('uid-owner-token', {
        uid: 'uid-only-admin',
        email: 'owner-address-can-change@example.com'
    });
    admin.tokens.set('wrong-admin-organization-token', {
        uid: 'approved-admin',
        admin: true,
        organizationId: 'other-business'
    });
    admin.tokens.set('read-token', { uid: 'read-subject', agentId: 'read-agent' });
    admin.tokens.set('sales-token', { uid: 'sales-subject', agentId: 'sales-agent' });
    admin.tokens.set('other-token', { uid: 'other-subject', agentId: 'other-agent' });
    admin.tokens.set('missing-subject-token', {
        uid: 'missing-subject',
        agentId: 'missing-subject-agent'
    });
    admin.tokens.set('issuer-token', {
        uid: 'issuer-subject',
        agentId: 'issuer-agent',
        iss: 'https://identity.synthetic.example/'
    });
    admin.tokens.set('wrong-issuer-token', {
        uid: 'issuer-subject',
        agentId: 'issuer-agent',
        iss: 'https://wrong-identity.synthetic.example/'
    });

    const handler = createBusinessApiHandler({
        admin,
        organizationId: 'agrisolar',
        environment: 'DEV',
        now: () => fixedNow,
        rateLimiter: async () => {}
    });

    const unauthenticated = await invoke(handler);
    assert.equal(unauthenticated.statusCode, 401);
    assert.equal(unauthenticated.payload.error.code, 'UNAUTHORIZED');

    const emailOnlyAdministrator = await invoke(handler, {
        token: 'email-only-token',
        path: '/api/v1/admin/review-center'
    });
    assert.equal(emailOnlyAdministrator.statusCode, 403);
    assert.equal(emailOnlyAdministrator.payload.error.code, 'FORBIDDEN');

    const uidHandler = createBusinessApiHandler({
        admin,
        administratorUid: 'uid-only-admin',
        organizationId: 'agrisolar',
        environment: 'DEV',
        now: () => fixedNow,
        rateLimiter: async () => {}
    });
    const configuredUidAdministrator = await invoke(uidHandler, {
        token: 'uid-owner-token',
        path: '/api/v1/admin/review-center'
    });
    assert.equal(configuredUidAdministrator.statusCode, 200);

    const wrongAdminOrganization = await invoke(handler, {
        token: 'wrong-admin-organization-token',
        path: '/api/v1/admin/review-center'
    });
    assert.equal(wrongAdminOrganization.statusCode, 403);
    assert.equal(wrongAdminOrganization.payload.error.code, 'FORBIDDEN');

    const missingExternalSubject = await invoke(handler, {
        token: 'missing-subject-token'
    });
    assert.equal(missingExternalSubject.statusCode, 403);
    assert.equal(missingExternalSubject.payload.error.code, 'FORBIDDEN');

    const wrongIssuer = await invoke(handler, { token: 'wrong-issuer-token' });
    assert.equal(wrongIssuer.statusCode, 403);
    assert.equal(wrongIssuer.payload.error.code, 'FORBIDDEN');

    const exactIssuer = await invoke(handler, { token: 'issuer-token' });
    assert.equal(exactIssuer.statusCode, 200);

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

    const outreachCandidate = await invoke(handler, {
        method: 'POST',
        path: '/api/v1/opportunity-candidates',
        token: 'owner-token',
        idempotencyKey: 'outreach-candidate-0001',
        body: opportunityInput({
            candidateSource: 'outreach_api',
            company: {
                name: 'Outreach Candidate Solar',
                domain: 'outreach-candidate.example'
            },
            site: {
                name: 'Outreach Candidate Site',
                address: 'Southern Illinois'
            },
            source: {
                type: 'public_web',
                title: 'Outreach candidate source',
                url: 'https://outreach-candidate.example/project',
                retrievedAt: 1786078800000
            }
        })
    });
    assert.equal(outreachCandidate.statusCode, 201);
    const outreachOpportunityId = outreachCandidate.payload.data.opportunityId;
    assert.equal(
        admin.data.opportunities[outreachOpportunityId].reviewStatus,
        'pending_review'
    );
    assert.equal(
        admin.data.opportunities[outreachOpportunityId].candidateSubmission.source,
        'outreach_api'
    );
    assert.equal(
        admin.data.opportunities[outreachOpportunityId].createdByActorType,
        'USER'
    );
    assert.equal(
        admin.data.opportunities[outreachOpportunityId].aiProvenance.aiGenerated,
        true
    );

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
    assert.equal(
        admin.data.opportunities[opportunityId].candidateSubmission.source,
        'manual'
    );

    const replayed = await invoke(handler, {
        method: 'POST',
        token: 'sales-token',
        idempotencyKey: 'sales-opportunity-1',
        body: opportunityInput()
    });
    assert.equal(replayed.statusCode, 200);
    assert.equal(replayed.payload.replayed, true);
    assert.equal(replayed.payload.data.opportunityId, opportunityId);
    assert.equal(Object.values(admin.data.opportunities).filter(record => (
        record.organizationId === 'agrisolar'
    )).length, 2);

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

    const agentReviewForbidden = await invoke(handler, {
        token: 'sales-token',
        path: '/api/v1/admin/review-center'
    });
    assert.equal(agentReviewForbidden.statusCode, 403);
    assert.equal(agentReviewForbidden.payload.error.code, 'FORBIDDEN');

    const pendingReview = await invoke(handler, {
        token: 'owner-token',
        path: '/api/v1/admin/review-center'
    });
    assert.equal(pendingReview.statusCode, 200);
    assert.equal(pendingReview.payload.data.opportunities.length, 2);
    assert.ok(pendingReview.payload.data.opportunities.some(item => (
        item.opportunityId === opportunityId
    )));
    assert.ok(pendingReview.payload.data.opportunities.some(item => (
        item.opportunityId === outreachOpportunityId
        && item.candidateSubmission.source === 'outreach_api'
    )));
    assert.equal(pendingReview.payload.data.tasks.length, 1);
    assert.equal(pendingReview.payload.data.tasks[0].taskId, task.payload.data.taskId);
    assert.ok(pendingReview.payload.data.agents.length >= 2);
    assert.ok(pendingReview.payload.data.agents.every(agent => (
        !Object.hasOwn(agent, 'externalSubject')
    )));
    assert.equal(pendingReview.payload.data.approvals.length, 0);
    assert.ok(pendingReview.payload.data.auditEvents.every(event => (
        event.organizationId === 'agrisolar'
    )));

    const invalidReviewStatus = await invoke(handler, {
        token: 'owner-token',
        path: '/api/v1/admin/review-center',
        query: { status: 'deleted' }
    });
    assert.equal(invalidReviewStatus.statusCode, 400);
    assert.equal(invalidReviewStatus.payload.error.code, 'VALIDATION_ERROR');

    const rejectedWithoutReason = await invoke(handler, {
        method: 'POST',
        token: 'owner-token',
        path: '/api/v1/admin/reviews',
        idempotencyKey: 'review-task-no-reason',
        body: {
            entityType: 'task',
            entityId: task.payload.data.taskId,
            decision: 'reject'
        }
    });
    assert.equal(rejectedWithoutReason.statusCode, 400);
    assert.equal(rejectedWithoutReason.payload.error.code, 'VALIDATION_ERROR');

    const approvedOpportunity = await invoke(handler, {
        method: 'POST',
        token: 'owner-token',
        path: '/api/v1/admin/reviews',
        idempotencyKey: 'review-opportunity-approve-1',
        body: {
            entityType: 'opportunity',
            entityId: opportunityId,
            decision: 'approve',
            reason: 'The source and opportunity details were verified.'
        }
    });
    assert.equal(approvedOpportunity.statusCode, 200);
    assert.equal(approvedOpportunity.payload.data.reviewStatus, 'approved');
    assert.equal(
        approvedOpportunity.payload.data.reviewedByAdministratorUid,
        'approved-admin'
    );
    assert.equal(admin.data.opportunities[opportunityId].reviewStatus, 'approved');
    assert.equal(
        admin.data.opportunities[opportunityId].reviewedByAdministratorUid,
        'approved-admin'
    );

    const replayedApproval = await invoke(handler, {
        method: 'POST',
        token: 'owner-token',
        path: '/api/v1/admin/reviews',
        idempotencyKey: 'review-opportunity-approve-1',
        body: {
            entityType: 'opportunity',
            entityId: opportunityId,
            decision: 'approve',
            reason: 'The source and opportunity details were verified.'
        }
    });
    assert.equal(replayedApproval.statusCode, 200);
    assert.equal(replayedApproval.payload.replayed, true);
    assert.equal(
        replayedApproval.payload.data.approvalId,
        approvedOpportunity.payload.data.approvalId
    );

    const conflictingReviewKey = await invoke(handler, {
        method: 'POST',
        token: 'owner-token',
        path: '/api/v1/admin/reviews',
        idempotencyKey: 'review-opportunity-approve-1',
        body: {
            entityType: 'opportunity',
            entityId: opportunityId,
            decision: 'reject',
            reason: 'Different request with the same key.'
        }
    });
    assert.equal(conflictingReviewKey.statusCode, 409);
    assert.equal(conflictingReviewKey.payload.error.code, 'CONFLICT');

    const secondOpportunityDecision = await invoke(handler, {
        method: 'POST',
        token: 'owner-token',
        path: '/api/v1/admin/reviews',
        idempotencyKey: 'review-opportunity-reject-2',
        body: {
            entityType: 'opportunity',
            entityId: opportunityId,
            decision: 'reject',
            reason: 'Attempt to decide an already reviewed record.'
        }
    });
    assert.equal(secondOpportunityDecision.statusCode, 409);
    assert.equal(secondOpportunityDecision.payload.error.code, 'CONFLICT');

    const crossOrganizationReview = await invoke(handler, {
        method: 'POST',
        token: 'owner-token',
        path: '/api/v1/admin/reviews',
        idempotencyKey: 'review-cross-organization-1',
        body: {
            entityType: 'opportunity',
            entityId: 'other-opportunity',
            decision: 'approve',
            reason: 'This record must not be visible.'
        }
    });
    assert.equal(crossOrganizationReview.statusCode, 404);
    assert.equal(crossOrganizationReview.payload.error.code, 'NOT_FOUND');

    const rejectedTask = await invoke(handler, {
        method: 'POST',
        token: 'owner-token',
        path: '/api/v1/admin/reviews',
        idempotencyKey: 'review-task-reject-0001',
        body: {
            entityType: 'task',
            entityId: task.payload.data.taskId,
            decision: 'reject',
            reason: 'This follow-up is unnecessary.'
        }
    });
    assert.equal(rejectedTask.statusCode, 200);
    assert.equal(rejectedTask.payload.data.reviewStatus, 'rejected');
    assert.ok(admin.data.tasks[task.payload.data.taskId]);
    assert.equal(admin.data.tasks[task.payload.data.taskId].status, 'open');
    assert.equal(admin.data.tasks[task.payload.data.taskId].reviewStatus, 'rejected');

    const completedReview = await invoke(handler, {
        token: 'owner-token',
        path: '/api/v1/admin/review-center',
        query: { status: 'all', limit: '100' }
    });
    assert.equal(completedReview.statusCode, 200);
    assert.equal(completedReview.payload.data.opportunities.length, 2);
    assert.equal(completedReview.payload.data.tasks.length, 1);
    assert.equal(completedReview.payload.data.approvals.length, 2);
    assert.ok(completedReview.payload.data.approvals.every(record => (
        record.organizationId === 'agrisolar'
    )));

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
    assert.ok(audits.some(event => event.action === 'opportunity.review.approve'
        && event.approvalId === approvedOpportunity.payload.data.approvalId));
    assert.ok(audits.some(event => event.action === 'task.review.reject'
        && event.approvalId === rejectedTask.payload.data.approvalId));
    assert.ok(audits.some(event => event.action === 'admin.review'
        && event.result === 'failed'
        && event.errorCode === 'VALIDATION_ERROR'));

    console.log(
        'PASS: Business API enforces identity, admin review, organization, idempotency, retained rejection, audit, and no-send boundaries'
    );
}

run().catch(error => {
    console.error(error);
    process.exitCode = 1;
});
