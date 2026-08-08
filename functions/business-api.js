const crypto = require('node:crypto');

const API_PREFIX = '/api/v1';
const DEFAULT_ORGANIZATION_ID = 'agrisolar';
const DEFAULT_ENVIRONMENT = 'DEV';
const OPPORTUNITY_STATUSES = new Set([
    'NEW',
    'RESEARCHING',
    'QUALIFIED',
    'CONTACTED',
    'RESPONDED',
    'BID',
    'PROPOSAL_DRAFTED',
    'PROPOSAL_SUBMITTED',
    'NEGOTIATING',
    'WON',
    'LOST'
]);
const PRIORITIES = new Set(['low', 'normal', 'high', 'urgent']);
const REVIEW_STATUSES = new Set(['pending_review', 'approved', 'rejected']);
const REVIEW_ENTITY_TYPES = new Set(['opportunity', 'task']);
const INITIAL_AGENT_CAPABILITIES = new Set([
    'opportunity.read',
    'opportunity.create',
    'task.read',
    'task.create',
    'analytics.read'
]);

class ApiError extends Error {
    constructor(code, message, status = 400, details = undefined) {
        super(message);
        this.name = 'ApiError';
        this.code = code;
        this.status = status;
        this.details = details;
    }
}

function cleanString(value, maximum, required = false) {
    const cleaned = typeof value === 'string' ? value.trim() : '';
    if (required && !cleaned) {
        throw new ApiError('VALIDATION_ERROR', 'A required field is missing.', 400);
    }
    if (cleaned.length > maximum) {
        throw new ApiError(
            'VALIDATION_ERROR',
            `A field exceeds its ${maximum}-character limit.`,
            400
        );
    }
    return cleaned;
}

function cleanRecordId(value, name, required = false) {
    const cleaned = cleanString(value, 128, required);
    if (cleaned && !/^[A-Za-z0-9_-]+$/.test(cleaned)) {
        throw new ApiError(
            'VALIDATION_ERROR',
            `${name} contains unsupported characters.`,
            400,
            [{ field: name, issue: 'Use letters, numbers, hyphens, or underscores.' }]
        );
    }
    return cleaned;
}

function optionalNumber(value, name, maximum) {
    if (value === undefined || value === null || value === '') return null;
    const number = Number(value);
    if (!Number.isFinite(number) || number < 0 || number > maximum) {
        throw new ApiError(
            'VALIDATION_ERROR',
            `${name} must be a number from 0 to ${maximum}.`,
            400,
            [{ field: name, issue: 'Value is outside the allowed range.' }]
        );
    }
    return number;
}

function optionalDate(value, name) {
    if (value === undefined || value === null || value === '') return '';
    const cleaned = cleanString(value, 10);
    if (!/^\d{4}-\d{2}-\d{2}$/.test(cleaned)) {
        throw new ApiError(
            'VALIDATION_ERROR',
            `${name} must use YYYY-MM-DD.`,
            400,
            [{ field: name, issue: 'Use YYYY-MM-DD.' }]
        );
    }
    const date = new Date(`${cleaned}T12:00:00Z`);
    if (Number.isNaN(date.getTime()) || date.toISOString().slice(0, 10) !== cleaned) {
        throw new ApiError(
            'VALIDATION_ERROR',
            `${name} is not a valid calendar date.`,
            400
        );
    }
    return cleaned;
}

function optionalTimestamp(value, name, currentTime) {
    if (value === undefined || value === null || value === '') return currentTime;
    const timestamp = Number(value);
    if (!Number.isInteger(timestamp)
        || timestamp < Date.parse('2000-01-01T00:00:00Z')
        || timestamp > currentTime + 300000) {
        throw new ApiError(
            'VALIDATION_ERROR',
            `${name} must be a valid past timestamp in milliseconds.`,
            400
        );
    }
    return timestamp;
}

function cleanUrl(value, required = false) {
    const cleaned = cleanString(value, 500, required);
    if (!cleaned) return '';
    let url;
    try {
        url = new URL(cleaned);
    } catch {
        throw new ApiError('VALIDATION_ERROR', 'Source URL is invalid.', 400);
    }
    if (!['http:', 'https:'].includes(url.protocol)) {
        throw new ApiError('VALIDATION_ERROR', 'Source URL must use HTTP or HTTPS.', 400);
    }
    url.hash = '';
    return url.href;
}

function normalizeText(value) {
    return String(value || '')
        .trim()
        .toLocaleLowerCase()
        .replace(/[^a-z0-9]+/g, ' ')
        .trim();
}

function canonicalize(value) {
    if (Array.isArray(value)) return value.map(canonicalize);
    if (!value || typeof value !== 'object') return value;
    return Object.keys(value).sort().reduce((result, key) => {
        result[key] = canonicalize(value[key]);
        return result;
    }, {});
}

function digest(value) {
    return crypto
        .createHash('sha256')
        .update(JSON.stringify(canonicalize(value)))
        .digest('hex');
}

function requestHeader(req, name) {
    if (typeof req.get === 'function') return req.get(name) || '';
    return req.headers?.[name.toLowerCase()] || '';
}

function requestPath(req) {
    const raw = req.originalUrl || req.url || '/';
    const pathname = new URL(raw, 'https://agrisolar.invalid').pathname;
    const prefixIndex = pathname.indexOf(API_PREFIX);
    return prefixIndex >= 0 ? pathname.slice(prefixIndex) : pathname;
}

function queryValues(req) {
    if (req.query && typeof req.query === 'object') return req.query;
    const raw = req.originalUrl || req.url || '/';
    return Object.fromEntries(new URL(raw, 'https://agrisolar.invalid').searchParams);
}

function parseBoolean(value, name) {
    if (value === undefined || value === '') return null;
    if (value === true || value === 'true') return true;
    if (value === false || value === 'false') return false;
    throw new ApiError('VALIDATION_ERROR', `${name} must be true or false.`, 400);
}

function parseCursor(value) {
    if (!value) return '';
    try {
        const decoded = Buffer.from(String(value), 'base64url').toString('utf8');
        if (!/^[A-Za-z0-9_-]{1,128}$/.test(decoded)) throw new Error('invalid');
        return decoded;
    } catch {
        throw new ApiError('VALIDATION_ERROR', 'Cursor is invalid.', 400);
    }
}

function opportunitySummary(id, opportunity) {
    return {
        opportunityId: id,
        siteName: opportunity.siteNameSnapshot || '',
        company: opportunity.companyNameSnapshot || '',
        location: [opportunity.city, opportunity.state].filter(Boolean).join(', '),
        acreage: opportunity.estimatedAcreage ?? null,
        status: opportunity.status,
        estimatedValue: opportunity.estimatedContractValue ?? null,
        score: opportunity.score ?? null,
        bidDeadline: opportunity.bidDeadlineOn || null,
        priority: opportunity.priority,
        nextAction: opportunity.nextAction || ''
    };
}

function validateCreateOpportunity(body, currentTime = Date.now()) {
    if (!body || typeof body !== 'object' || Array.isArray(body)) {
        throw new ApiError('VALIDATION_ERROR', 'A JSON object is required.', 400);
    }
    const companyInput = body?.company || {};
    const siteInput = body?.site || {};
    const sourceInput = body?.source || {};
    const contactInput = body?.contact || {};
    const companyId = cleanRecordId(companyInput.companyId, 'company.companyId');
    const companyName = cleanString(companyInput.name, 120, !companyId);
    const siteId = cleanRecordId(siteInput.siteId, 'site.siteId');
    const siteName = cleanString(siteInput.name, 160, !siteId);
    const state = cleanString(siteInput.state, 2).toUpperCase();
    if (state && !/^[A-Z]{2}$/.test(state)) {
        throw new ApiError('VALIDATION_ERROR', 'State must use a two-letter code.', 400);
    }
    const contactEmail = cleanString(contactInput.email, 254).toLocaleLowerCase();
    if (contactEmail && !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(contactEmail)) {
        throw new ApiError('VALIDATION_ERROR', 'Contact email is invalid.', 400);
    }
    const priority = body.priority || 'normal';
    if (!PRIORITIES.has(priority)) {
        throw new ApiError('VALIDATION_ERROR', 'Opportunity priority is invalid.', 400);
    }

    return {
        companyId,
        companyName,
        companyDomain: cleanString(companyInput.domain, 253).toLocaleLowerCase(),
        siteId,
        siteName,
        address: cleanString(siteInput.address, 240),
        city: cleanString(siteInput.city, 100),
        state,
        estimatedAcreage: optionalNumber(
            body?.estimatedAcreage,
            'estimatedAcreage',
            100000
        ),
        projectDetails: cleanString(body?.projectDetails, 4000),
        opportunityType: cleanString(body?.opportunityType, 80, true),
        estimatedContractValue: optionalNumber(
            body?.estimatedContractValue,
            'estimatedContractValue',
            1000000000
        ),
        bidDeadlineOn: optionalDate(body?.deadlineOn, 'deadlineOn'),
        contact: {
            contactId: cleanRecordId(contactInput.contactId, 'contact.contactId'),
            name: cleanString(contactInput.name, 120),
            email: contactEmail
        },
        source: {
            type: cleanString(sourceInput.type, 60, true),
            title: cleanString(sourceInput.title, 200, true),
            url: cleanUrl(sourceInput.url, true),
            retrievedAt: optionalTimestamp(
                sourceInput.retrievedAt,
                'source.retrievedAt',
                currentTime
            )
        },
        notes: cleanString(body?.notes, 4000),
        aiResearch: {
            summary: cleanString(body?.aiResearch?.summary, 4000),
            confidence: optionalNumber(body?.aiResearch?.confidence, 'confidence', 1),
            model: cleanString(body?.aiResearch?.model, 120)
        },
        priority,
        nextAction: cleanString(body?.nextAction, 500)
    };
}

function validateCreateTask(body) {
    if (!body || typeof body !== 'object' || Array.isArray(body)) {
        throw new ApiError('VALIDATION_ERROR', 'A JSON object is required.', 400);
    }
    const priority = body?.priority || 'normal';
    if (!PRIORITIES.has(priority)) {
        throw new ApiError('VALIDATION_ERROR', 'Task priority is invalid.', 400);
    }
    const relatedEntityType = cleanString(body?.relatedEntityType, 60, true);
    const allowedTypes = new Set(['opportunity', 'company', 'site']);
    if (!allowedTypes.has(relatedEntityType)) {
        throw new ApiError('VALIDATION_ERROR', 'Related entity type is invalid.', 400);
    }
    return {
        title: cleanString(body?.title, 180, true),
        description: cleanString(body?.description, 4000),
        priority,
        dueOn: optionalDate(body?.dueOn, 'dueOn'),
        ownerUserId: cleanRecordId(body?.ownerUserId, 'ownerUserId'),
        relatedEntityType,
        relatedEntityId: cleanRecordId(body?.relatedEntityId, 'relatedEntityId', true),
        source: cleanString(body?.source, 60, true),
        aiReasoning: cleanString(body?.aiReasoning, 2000)
    };
}

function validateReviewDecision(body) {
    if (!body || typeof body !== 'object' || Array.isArray(body)) {
        throw new ApiError('VALIDATION_ERROR', 'A JSON object is required.', 400);
    }
    const entityType = cleanString(body.entityType, 32, true);
    if (!REVIEW_ENTITY_TYPES.has(entityType)) {
        throw new ApiError(
            'VALIDATION_ERROR',
            'entityType must be opportunity or task.',
            400
        );
    }
    const decision = cleanString(body.decision, 16, true);
    if (!['approve', 'reject'].includes(decision)) {
        throw new ApiError(
            'VALIDATION_ERROR',
            'decision must be approve or reject.',
            400
        );
    }
    const reason = cleanString(body.reason, 1000, decision === 'reject');
    return {
        entityType,
        entityId: cleanRecordId(body.entityId, 'entityId', true),
        decision,
        reason
    };
}

function auditRecord(context, action, entityType, entityId, requestId, result, extra = {}) {
    return {
        organizationId: context.organizationId,
        occurredAt: extra.now || Date.now(),
        actorType: context.actorType,
        actorId: context.actorId,
        action,
        entityType,
        entityId: entityId || '',
        source: context.source,
        requestId,
        approvalId: extra.approvalId || '',
        modelOrAgent: context.actorType === 'AI_AGENT' ? context.actorId : '',
        result,
        errorCode: extra.errorCode || '',
        changeSummary: extra.changeSummary || ''
    };
}

function capabilitiesFrom(value) {
    if (Array.isArray(value)) return new Set(value.filter(item => typeof item === 'string'));
    return new Set(Object.entries(value || {})
        .filter(([, enabled]) => enabled === true)
        .map(([capability]) => capability));
}

function createBusinessApi(options) {
    const admin = options.admin;
    const organizationId = options.organizationId || DEFAULT_ORGANIZATION_ID;
    const environment = options.environment || DEFAULT_ENVIRONMENT;
    const administratorUids = new Set([
        ...(Array.isArray(options.administratorUids) ? options.administratorUids : []),
        ...(options.administratorUid ? [options.administratorUid] : [])
    ].filter(value => typeof value === 'string' && value.length > 0));
    const now = options.now || Date.now;
    const database = admin.database();

    async function once(path) {
        return database.ref(path).once('value');
    }

    async function resolveAgentContext(
        subject,
        claimedAgentId = '',
        source = 'API',
        verifiedIssuer = ''
    ) {
        const exactSubject = cleanString(subject, 500, true);
        const exactIssuer = cleanString(verifiedIssuer, 500);
        let agentId = '';
        let agent = null;
        if (claimedAgentId) {
            agentId = cleanRecordId(claimedAgentId, 'agentId', true);
            const snapshot = await once(`/agent_identities/${agentId}`);
            if (snapshot.exists()) agent = snapshot.val();
        } else {
            const snapshot = await once('/agent_identities');
            const match = Object.entries(snapshot.val() || {}).find(([, candidate]) => (
                candidate.externalSubject === exactSubject
                && candidate.organizationId === organizationId
                && candidate.environment === environment
            ));
            if (match) [agentId, agent] = match;
        }
        if (!agent
            || agent.status !== 'active'
            || agent.organizationId !== organizationId
            || agent.environment !== environment
            || !agent.externalSubject
            || agent.externalSubject !== exactSubject
            || (agent.issuer && agent.issuer !== exactIssuer)
            || (Number(agent.expiresAt) > 0 && Number(agent.expiresAt) <= now())) {
            throw new ApiError('FORBIDDEN', 'This identity is not authorized.', 403);
        }
        return {
            actorType: 'AI_AGENT',
            actorId: agentId,
            organizationId: agent.organizationId,
            environment: agent.environment,
            authorityLevel: Number(agent.authorityLevel) || 1,
            capabilities: capabilitiesFrom(agent.capabilities),
            source
        };
    }

    async function authenticate(req) {
        const authorization = requestHeader(req, 'authorization');
        if (!authorization.startsWith('Bearer ')) {
            throw new ApiError('UNAUTHORIZED', 'Authentication is required.', 401);
        }
        let token;
        try {
            token = await admin.auth().verifyIdToken(authorization.slice(7));
        } catch {
            throw new ApiError('UNAUTHORIZED', 'Authentication is invalid or expired.', 401);
        }

        const tokenOrganization = typeof token.organizationId === 'string'
            ? token.organizationId
            : (typeof token.organization_id === 'string' ? token.organization_id : '');
        const approvedAdministrator = administratorUids.has(token.uid)
            || (token.admin === true
                && (!tokenOrganization || tokenOrganization === organizationId));
        if (approvedAdministrator) {
            return {
                actorType: 'USER',
                actorId: token.uid,
                organizationId,
                environment,
                authorityLevel: 4,
                capabilities: new Set([
                    ...INITIAL_AGENT_CAPABILITIES,
                    'opportunity.update',
                    'communication.draft'
                ]),
                source: 'API'
            };
        }

        return resolveAgentContext(
            token.uid,
            token.agentId || token.agent_id || '',
            'API',
            typeof token.iss === 'string' ? token.iss : ''
        );
    }

    function authorize(context, capability, authorityLevel) {
        if (!context.capabilities.has(capability)
            || context.authorityLevel < authorityLevel) {
            throw new ApiError('FORBIDDEN', 'The requested action is not permitted.', 403);
        }
    }

    async function defaultRateLimiter(context, mutation) {
        const window = Math.floor(now() / 60000);
        const actorHash = digest(`${context.actorType}:${context.actorId}`).slice(0, 32);
        const ref = database.ref(
            `/rate_limit_counters/${context.organizationId}/${actorHash}/${window}/${mutation ? 'write' : 'read'}`
        );
        const limit = mutation ? 30 : 120;
        const transaction = await ref.transaction(current => {
            const count = Number(current?.count) || 0;
            if (count >= limit) return;
            return { count: count + 1, expiresAt: now() + 120000 };
        }, undefined, false);
        if (!transaction.committed) {
            throw new ApiError('RATE_LIMITED', 'The request limit has been reached.', 429);
        }
    }

    const rateLimiter = options.rateLimiter || defaultRateLimiter;

    async function appendReadAudit(context, action, entityType, entityId, requestId) {
        const ref = database.ref('/audit_events').push();
        await ref.set(auditRecord(
            context,
            action,
            entityType,
            entityId,
            requestId,
            'success',
            { now: now() }
        ));
    }

    function authorizeAdministratorReview(context) {
        authorize(context, 'opportunity.update', 4);
        if (context.actorType !== 'USER') {
            throw new ApiError(
                'FORBIDDEN',
                'Administrator review requires an authorized user account.',
                403
            );
        }
    }

    function idempotencyKey(req) {
        const key = cleanString(
            requestHeader(req, 'idempotency-key') || req.body?.idempotencyKey,
            128,
            true
        );
        if (key.length < 8 || !/^[A-Za-z0-9._:-]+$/.test(key)) {
            throw new ApiError(
                'VALIDATION_ERROR',
                'Idempotency key must be 8-128 safe characters.',
                400
            );
        }
        return key;
    }

    async function existingIdempotentResult(context, key, body) {
        const keyHash = digest(`${context.actorId}:${key}`);
        const requestDigest = digest(body);
        const snapshot = await once(
            `/idempotency_records/${context.organizationId}/${keyHash}`
        );
        if (!snapshot.exists()) return { keyHash, requestDigest, response: null };
        const record = snapshot.val();
        if (record.requestDigest !== requestDigest) {
            throw new ApiError(
                'CONFLICT',
                'The idempotency key was already used for another request.',
                409
            );
        }
        return { keyHash, requestDigest, response: record.response };
    }

    async function organizationOpportunities(context) {
        const snapshot = await once('/opportunities');
        return Object.entries(snapshot.val() || {})
            .filter(([, record]) => record.organizationId === context.organizationId)
            .map(([id, record]) => ({ id, ...record }));
    }

    async function searchOpportunities(context, query, requestId) {
        authorize(context, 'opportunity.read', 1);
        const statusList = cleanString(query.status, 300)
            .split(',').map(value => value.trim()).filter(Boolean);
        if (statusList.some(status => !OPPORTUNITY_STATUSES.has(status))) {
            throw new ApiError('VALIDATION_ERROR', 'Opportunity status filter is invalid.', 400);
        }
        const state = cleanString(query.state, 2).toUpperCase();
        if (state && !/^[A-Z]{2}$/.test(state)) {
            throw new ApiError('VALIDATION_ERROR', 'State must use a two-letter code.', 400);
        }
        const city = normalizeText(cleanString(query.city, 100));
        const company = normalizeText(cleanString(query.company, 120));
        const site = normalizeText(cleanString(query.site, 160));
        const keyword = normalizeText(cleanString(query.keyword, 200));
        const priority = cleanString(query.priority, 100).split(',').filter(Boolean);
        if (priority.some(item => !PRIORITIES.has(item))) {
            throw new ApiError('VALIDATION_ERROR', 'Priority filter is invalid.', 400);
        }
        const minimumAcreage = optionalNumber(query.minimumAcreage, 'minimumAcreage', 100000);
        const maximumAcreage = optionalNumber(query.maximumAcreage, 'maximumAcreage', 100000);
        const minimumValue = optionalNumber(
            query.minimumEstimatedValue,
            'minimumEstimatedValue',
            1000000000
        );
        const maximumValue = optionalNumber(
            query.maximumEstimatedValue,
            'maximumEstimatedValue',
            1000000000
        );
        const contacted = parseBoolean(query.contacted, 'contacted');
        const qualified = parseBoolean(query.qualified, 'qualified');
        const deadlineFrom = optionalDate(query.deadlineFrom, 'deadlineFrom');
        const deadlineTo = optionalDate(query.deadlineTo, 'deadlineTo');
        const requestedLimit = query.limit === undefined || query.limit === ''
            ? 25
            : Number(query.limit);
        if (!Number.isInteger(requestedLimit) || requestedLimit < 1 || requestedLimit > 50) {
            throw new ApiError('VALIDATION_ERROR', 'Limit must be an integer from 1 to 50.', 400);
        }
        if (minimumAcreage !== null && maximumAcreage !== null
            && minimumAcreage > maximumAcreage) {
            throw new ApiError(
                'VALIDATION_ERROR',
                'minimumAcreage cannot exceed maximumAcreage.',
                400
            );
        }
        if (minimumValue !== null && maximumValue !== null && minimumValue > maximumValue) {
            throw new ApiError(
                'VALIDATION_ERROR',
                'minimumEstimatedValue cannot exceed maximumEstimatedValue.',
                400
            );
        }
        if (deadlineFrom && deadlineTo && deadlineFrom > deadlineTo) {
            throw new ApiError(
                'VALIDATION_ERROR',
                'deadlineFrom cannot be after deadlineTo.',
                400
            );
        }
        const limit = requestedLimit;
        const cursor = parseCursor(query.cursor);

        let records = await organizationOpportunities(context);
        records = records.filter(record => {
            const haystack = normalizeText([
                record.companyNameSnapshot,
                record.siteNameSnapshot,
                record.city,
                record.state,
                record.projectDetails,
                record.nextAction
            ].join(' '));
            return (!statusList.length || statusList.includes(record.status))
                && (!state || record.state === state)
                && (!city || normalizeText(record.city).includes(city))
                && (!company || normalizeText(record.companyNameSnapshot).includes(company))
                && (!site || normalizeText(record.siteNameSnapshot).includes(site))
                && (!keyword || haystack.includes(keyword))
                && (!priority.length || priority.includes(record.priority))
                && (minimumAcreage === null || Number(record.estimatedAcreage) >= minimumAcreage)
                && (maximumAcreage === null || Number(record.estimatedAcreage) <= maximumAcreage)
                && (minimumValue === null || Number(record.estimatedContractValue) >= minimumValue)
                && (maximumValue === null || Number(record.estimatedContractValue) <= maximumValue)
                && (contacted === null || record.contacted === contacted)
                && (qualified === null || record.qualified === qualified)
                && (!deadlineFrom || record.bidDeadlineOn >= deadlineFrom)
                && (!deadlineTo || record.bidDeadlineOn <= deadlineTo)
                && (!cursor || record.id > cursor);
        }).sort((left, right) => left.id.localeCompare(right.id));

        const page = records.slice(0, limit);
        const nextCursor = records.length > limit
            ? Buffer.from(page.at(-1).id).toString('base64url')
            : null;
        await appendReadAudit(
            context,
            'opportunity.search',
            'opportunity',
            '',
            requestId
        );
        return {
            data: { opportunities: page.map(record => opportunitySummary(record.id, record)) },
            page: { nextCursor }
        };
    }

    async function getOpportunity(context, opportunityId, requestId) {
        authorize(context, 'opportunity.read', 1);
        const id = cleanRecordId(opportunityId, 'opportunityId', true);
        const opportunitySnapshot = await once(`/opportunities/${id}`);
        const opportunity = opportunitySnapshot.val();
        if (!opportunitySnapshot.exists()
            || opportunity.organizationId !== context.organizationId) {
            throw new ApiError('NOT_FOUND', 'Opportunity was not found.', 404);
        }
        const [companySnapshot, siteSnapshot, tasksSnapshot] = await Promise.all([
            opportunity.companyId ? once(`/companies/${opportunity.companyId}`) : null,
            opportunity.siteId ? once(`/solar_sites/${opportunity.siteId}`) : null,
            once('/tasks')
        ]);
        const tasks = Object.entries(tasksSnapshot.val() || {})
            .filter(([, task]) => task.organizationId === context.organizationId
                && task.relatedEntityType === 'opportunity'
                && task.relatedEntityId === id)
            .map(([taskId, task]) => ({ taskId, ...task }));

        await appendReadAudit(context, 'opportunity.read', 'opportunity', id, requestId);
        const scopedLinkedRecord = snapshot => {
            if (!snapshot?.exists()) return null;
            const value = snapshot.val();
            return value.organizationId === context.organizationId ? value : null;
        };
        return {
            data: {
                opportunity: { opportunityId: id, ...opportunity },
                company: scopedLinkedRecord(companySnapshot),
                contacts: [],
                site: scopedLinkedRecord(siteSnapshot),
                qualificationAnalysis: opportunity.aiProvenance || null,
                communicationsSummary: { total: 0, latestAt: null },
                tasks,
                proposalSummary: null,
                importantDeadlines: opportunity.bidDeadlineOn
                    ? [{ type: 'bid', dueOn: opportunity.bidDeadlineOn }]
                    : [],
                recommendedNextAction: opportunity.nextAction || ''
            },
            page: null
        };
    }

    async function findOpportunityDuplicates(context, input) {
        const records = await organizationOpportunities(context);
        const normalizedCompany = normalizeText(input.companyName);
        const normalizedSite = normalizeText(input.siteName);
        const normalizedAddress = normalizeText(input.address);
        return records.filter(record => {
            const sameSource = record.source?.url === input.source.url;
            const sameCompany = normalizedCompany
                && normalizeText(record.companyNameSnapshot) === normalizedCompany;
            const sameSite = normalizedSite
                && normalizeText(record.siteNameSnapshot) === normalizedSite;
            const sameAddress = normalizedAddress
                && normalizeText(record.address) === normalizedAddress;
            return sameSource || (sameCompany && sameSite) || (sameSite && sameAddress);
        }).slice(0, 5).map(record => opportunitySummary(record.id, record));
    }

    async function createOpportunity(context, body, req, requestId) {
        authorize(context, 'opportunity.create', 3);
        const key = idempotencyKey(req);
        const idempotency = await existingIdempotentResult(context, key, body);
        if (idempotency.response) {
            return { data: idempotency.response, page: null, replayed: true };
        }
        const input = validateCreateOpportunity(body, now());
        for (const [type, id, path] of [
            ['company', input.companyId, 'companies'],
            ['site', input.siteId, 'solar_sites']
        ]) {
            if (!id) continue;
            const linkedSnapshot = await once(`/${path}/${id}`);
            const linked = linkedSnapshot.val();
            if (!linkedSnapshot.exists()
                || linked.organizationId !== context.organizationId) {
                throw new ApiError(
                    'NOT_FOUND',
                    `The linked ${type} record was not found.`,
                    404
                );
            }
        }
        const duplicates = await findOpportunityDuplicates(context, input);
        if (duplicates.length) {
            throw new ApiError(
                'DUPLICATE_FOUND',
                'A likely matching opportunity already exists.',
                409,
                { candidates: duplicates }
            );
        }

        const opportunityId = database.ref('/opportunities').push().key;
        const auditId = database.ref('/audit_events').push().key;
        const timestamp = now();
        const record = {
            organizationId: context.organizationId,
            companyId: input.companyId,
            siteId: input.siteId,
            primaryContactId: input.contact.contactId,
            companyNameSnapshot: input.companyName,
            companyDomainSnapshot: input.companyDomain,
            siteNameSnapshot: input.siteName,
            address: input.address,
            city: input.city,
            state: input.state,
            estimatedAcreage: input.estimatedAcreage ?? 0,
            projectDetails: input.projectDetails,
            opportunityType: input.opportunityType,
            status: 'NEW',
            priority: input.priority,
            qualified: false,
            contacted: false,
            estimatedContractValue: input.estimatedContractValue ?? 0,
            bidDeadlineOn: input.bidDeadlineOn,
            nextAction: input.nextAction,
            notes: input.notes,
            source: input.source,
            contactSnapshot: input.contact,
            aiProvenance: {
                aiGenerated: context.actorType === 'AI_AGENT',
                agentId: context.actorType === 'AI_AGENT' ? context.actorId : '',
                model: input.aiResearch.model,
                schemaVersion: 'opportunity-create-v1',
                confidence: input.aiResearch.confidence ?? 0,
                researchSummary: input.aiResearch.summary
            },
            reviewStatus: context.actorType === 'AI_AGENT' ? 'pending_review' : 'reviewed',
            createdAt: timestamp,
            createdByActorType: context.actorType,
            createdByActorId: context.actorId,
            updatedAt: timestamp,
            updatedByActorId: context.actorId
        };
        const response = opportunitySummary(opportunityId, record);
        await database.ref().update({
            [`opportunities/${opportunityId}`]: record,
            [`audit_events/${auditId}`]: auditRecord(
                context,
                'opportunity.create',
                'opportunity',
                opportunityId,
                requestId,
                'success',
                { now: timestamp, changeSummary: 'Created unreviewed opportunity.' }
            ),
            [`idempotency_records/${context.organizationId}/${idempotency.keyHash}`]: {
                actorId: context.actorId,
                requestDigest: idempotency.requestDigest,
                response,
                createdAt: timestamp,
                expiresAt: timestamp + 86400000
            }
        });
        return { data: response, page: null, replayed: false };
    }

    async function relatedEntity(context, type, id) {
        const pathByType = {
            opportunity: 'opportunities',
            company: 'companies',
            site: 'solar_sites',
            task: 'tasks'
        };
        const path = pathByType[type];
        if (!path) return null;
        const snapshot = await once(`/${path}/${id}`);
        if (!snapshot.exists()) return null;
        const value = snapshot.val();
        if (value.organizationId !== context.organizationId) {
            return null;
        }
        return value;
    }

    async function createTask(context, body, req, requestId) {
        authorize(context, 'task.create', 3);
        const key = idempotencyKey(req);
        const idempotency = await existingIdempotentResult(context, key, body);
        if (idempotency.response) {
            return { data: idempotency.response, page: null, replayed: true };
        }
        const input = validateCreateTask(body);
        const related = await relatedEntity(
            context,
            input.relatedEntityType,
            input.relatedEntityId
        );
        if (!related) {
            throw new ApiError('NOT_FOUND', 'Related business record was not found.', 404);
        }
        const taskId = database.ref('/tasks').push().key;
        const auditId = database.ref('/audit_events').push().key;
        const timestamp = now();
        const record = {
            organizationId: context.organizationId,
            title: input.title,
            description: input.description,
            priority: input.priority,
            status: 'open',
            dueOn: input.dueOn,
            ownerUserId: input.ownerUserId,
            relatedEntityType: input.relatedEntityType,
            relatedEntityId: input.relatedEntityId,
            source: input.source,
            aiReasoning: input.aiReasoning,
            reviewStatus: context.actorType === 'AI_AGENT' ? 'pending_review' : 'reviewed',
            createdAt: timestamp,
            createdByActorType: context.actorType,
            createdByActorId: context.actorId,
            updatedAt: timestamp
        };
        const response = { taskId, ...record };
        await database.ref().update({
            [`tasks/${taskId}`]: record,
            [`audit_events/${auditId}`]: auditRecord(
                context,
                'task.create',
                'task',
                taskId,
                requestId,
                'success',
                { now: timestamp, changeSummary: 'Created internal task.' }
            ),
            [`idempotency_records/${context.organizationId}/${idempotency.keyHash}`]: {
                actorId: context.actorId,
                requestDigest: idempotency.requestDigest,
                response,
                createdAt: timestamp,
                expiresAt: timestamp + 86400000
            }
        });
        return { data: response, page: null, replayed: false };
    }

    function reviewCollection(records, context, status, limit, idName) {
        return Object.entries(records || {})
            .filter(([, record]) => (
                record.organizationId === context.organizationId
                && (status === 'all' || record.reviewStatus === status)
            ))
            .map(([id, record]) => ({ ...record, [idName]: id }))
            .sort((left, right) => (
                (Number(right.updatedAt) || Number(right.createdAt) || 0)
                - (Number(left.updatedAt) || Number(left.createdAt) || 0)
                || left[idName].localeCompare(right[idName])
            ))
            .slice(0, limit);
    }

    async function getReviewCenter(context, query, requestId) {
        authorizeAdministratorReview(context);
        const status = cleanString(query.status, 32) || 'pending_review';
        if (status !== 'all' && !REVIEW_STATUSES.has(status)) {
            throw new ApiError(
                'VALIDATION_ERROR',
                'Review status must be pending_review, approved, rejected, or all.',
                400
            );
        }
        const requestedLimit = query.limit === undefined || query.limit === ''
            ? 50
            : Number(query.limit);
        if (!Number.isInteger(requestedLimit)
            || requestedLimit < 1
            || requestedLimit > 100) {
            throw new ApiError(
                'VALIDATION_ERROR',
                'Limit must be an integer from 1 to 100.',
                400
            );
        }

        const [opportunities, tasks, agents, approvals, audits] = await Promise.all([
            once('/opportunities'),
            once('/tasks'),
            once('/agent_identities'),
            once('/approval_requests'),
            once('/audit_events')
        ]);
        const scopedAgents = Object.entries(agents.val() || {})
            .filter(([, agent]) => (
                agent.organizationId === context.organizationId
                && agent.environment === context.environment
            ))
            .map(([agentId, agent]) => ({
                agentId,
                organizationId: agent.organizationId,
                environment: agent.environment,
                status: agent.status,
                authorityLevel: Number(agent.authorityLevel) || 0,
                capabilities: [...capabilitiesFrom(agent.capabilities)].sort(),
                expiresAt: Number(agent.expiresAt) || 0
            }))
            .sort((left, right) => left.agentId.localeCompare(right.agentId));
        const scopedApprovals = Object.entries(approvals.val() || {})
            .filter(([, record]) => record.organizationId === context.organizationId)
            .map(([approvalId, record]) => ({ ...record, approvalId }))
            .sort((left, right) => (
                (Number(right.decidedAt) || Number(right.requestedAt) || 0)
                - (Number(left.decidedAt) || Number(left.requestedAt) || 0)
            ))
            .slice(0, requestedLimit);
        const scopedAudits = Object.entries(audits.val() || {})
            .filter(([, record]) => record.organizationId === context.organizationId)
            .map(([auditEventId, record]) => ({ ...record, auditEventId }))
            .sort((left, right) => Number(right.occurredAt) - Number(left.occurredAt))
            .slice(0, requestedLimit);
        const reviewOpportunities = reviewCollection(
            opportunities.val(),
            context,
            status,
            requestedLimit,
            'opportunityId'
        );
        const reviewTasks = reviewCollection(
            tasks.val(),
            context,
            status,
            requestedLimit,
            'taskId'
        );

        await appendReadAudit(
            context,
            'admin.review_center.read',
            'review_center',
            '',
            requestId
        );
        return {
            data: {
                opportunities: reviewOpportunities,
                tasks: reviewTasks,
                agents: scopedAgents,
                approvals: scopedApprovals,
                auditEvents: scopedAudits,
                filters: { status, limit: requestedLimit },
                totals: {
                    opportunities: reviewOpportunities.length,
                    tasks: reviewTasks.length
                }
            },
            page: null
        };
    }

    async function reviewEntity(context, body, req, requestId) {
        authorizeAdministratorReview(context);
        const key = idempotencyKey(req);
        const idempotency = await existingIdempotentResult(context, key, body);
        if (idempotency.response) {
            return {
                data: idempotency.response,
                page: null,
                replayed: true,
                statusCode: 200
            };
        }
        const input = validateReviewDecision(body);
        const collection = input.entityType === 'opportunity' ? 'opportunities' : 'tasks';
        const snapshot = await once(`/${collection}/${input.entityId}`);
        const record = snapshot.val();
        if (!snapshot.exists()
            || record.organizationId !== context.organizationId) {
            throw new ApiError('NOT_FOUND', 'Review record was not found.', 404);
        }
        if (record.reviewStatus !== 'pending_review') {
            throw new ApiError(
                'CONFLICT',
                'Only a pending_review record can be approved or rejected.',
                409,
                { currentReviewStatus: record.reviewStatus || '' }
            );
        }

        const timestamp = now();
        const reviewStatus = input.decision === 'approve' ? 'approved' : 'rejected';
        const approvalId = database.ref('/approval_requests').push().key;
        const auditId = database.ref('/audit_events').push().key;
        const response = {
            entityType: input.entityType,
            entityId: input.entityId,
            decision: input.decision,
            reviewStatus,
            reason: input.reason,
            reviewedAt: timestamp,
            reviewedByAdministratorUid: context.actorId,
            approvalId
        };
        const reviewedRecord = {
            ...record,
            reviewStatus,
            reviewDecision: input.decision,
            reviewReason: input.reason,
            reviewedAt: timestamp,
            reviewedByActorId: context.actorId,
            reviewedByAdministratorUid: context.actorId,
            updatedAt: timestamp,
            updatedByActorId: context.actorId
        };
        const approvalRecord = {
            organizationId: context.organizationId,
            actionType: `${input.entityType}.review`,
            status: reviewStatus,
            riskLevel: 4,
            requestedByActorType: record.createdByActorType || 'UNKNOWN',
            requestedByActorId: record.createdByActorId || '',
            requestedAt: Number(record.createdAt) || timestamp,
            payloadDigest: `sha256:${digest({
                entityType: input.entityType,
                entityId: input.entityId,
                createdAt: record.createdAt || 0
            })}`,
            relatedEntityType: input.entityType,
            relatedEntityId: input.entityId,
            approverActorId: context.actorId,
            decision: input.decision,
            reason: input.reason,
            decidedAt: timestamp,
            executionStatus: 'not_required',
            resultCode: reviewStatus
        };
        await database.ref().update({
            [`${collection}/${input.entityId}`]: reviewedRecord,
            [`approval_requests/${approvalId}`]: approvalRecord,
            [`audit_events/${auditId}`]: auditRecord(
                context,
                `${input.entityType}.review.${input.decision}`,
                input.entityType,
                input.entityId,
                requestId,
                'success',
                {
                    now: timestamp,
                    approvalId,
                    changeSummary: `${input.entityType} review changed from pending_review to ${reviewStatus}.`
                }
            ),
            [`idempotency_records/${context.organizationId}/${idempotency.keyHash}`]: {
                actorId: context.actorId,
                requestDigest: idempotency.requestDigest,
                response,
                createdAt: timestamp,
                expiresAt: timestamp + 86400000
            }
        });
        return { data: response, page: null, replayed: false, statusCode: 200 };
    }

    async function getSalesPipeline(context, query, requestId) {
        authorize(context, 'analytics.read', 1);
        const state = cleanString(query.state, 2).toUpperCase();
        const opportunities = (await organizationOpportunities(context))
            .filter(record => !state || record.state === state);
        const tasksSnapshot = await once('/tasks');
        const today = new Date(now()).toISOString().slice(0, 10);
        const in7 = new Date(now() + 7 * 86400000).toISOString().slice(0, 10);
        const in30 = new Date(now() + 30 * 86400000).toISOString().slice(0, 10);
        const tasks = Object.values(tasksSnapshot.val() || {})
            .filter(task => task.organizationId === context.organizationId);
        const countStatus = status => opportunities.filter(item => item.status === status).length;
        const deadlineCount = maximum => opportunities.filter(item => (
            item.bidDeadlineOn && item.bidDeadlineOn >= today && item.bidDeadlineOn <= maximum
        )).length;
        const metrics = {
            totalOpportunities: opportunities.length,
            pipelineValue: opportunities
                .filter(item => !['LOST'].includes(item.status))
                .reduce((total, item) => total + (Number(item.estimatedContractValue) || 0), 0),
            newOpportunities: countStatus('NEW'),
            qualifiedOpportunities: opportunities.filter(item => (
                item.qualified === true || item.status === 'QUALIFIED'
            )).length,
            contacted: opportunities.filter(item => (
                item.contacted === true || ['CONTACTED', 'RESPONDED'].includes(item.status)
            )).length,
            responses: countStatus('RESPONDED'),
            activeBidOpportunities: countStatus('BID'),
            proposalsDrafted: countStatus('PROPOSAL_DRAFTED'),
            proposalsSubmitted: countStatus('PROPOSAL_SUBMITTED'),
            negotiating: countStatus('NEGOTIATING'),
            won: countStatus('WON'),
            lost: countStatus('LOST'),
            deadlinesWithin7Days: deadlineCount(in7),
            deadlinesWithin30Days: deadlineCount(in30),
            overdueFollowUps: tasks.filter(task => (
                task.status !== 'completed' && task.dueOn && task.dueOn < today
            )).length
        };
        const highPriority = opportunities
            .filter(item => ['high', 'urgent'].includes(item.priority))
            .sort((left, right) => (
                (left.bidDeadlineOn || '9999-99-99').localeCompare(
                    right.bidDeadlineOn || '9999-99-99'
                )
            )).slice(0, 5).map(item => opportunitySummary(item.id, item));
        await appendReadAudit(context, 'analytics.sales_pipeline.read', 'analytics', '', requestId);
        return { data: { metrics, highPriorityOpportunities: highPriority }, page: null };
    }

    async function executeTool(context, toolName, input = {}) {
        const requestId = crypto.randomUUID();
        const mutation = toolName === 'create_opportunity' || toolName === 'create_task';
        const actionByTool = {
            search_opportunities: ['opportunity.search', 'opportunity'],
            get_opportunity: ['opportunity.read', 'opportunity'],
            create_opportunity: ['opportunity.create', 'opportunity'],
            create_task: ['task.create', 'task'],
            get_sales_pipeline: ['analytics.sales_pipeline.read', 'analytics']
        };
        const actionInfo = actionByTool[toolName];
        if (!actionInfo) {
            throw new ApiError('NOT_FOUND', 'MCP tool was not found.', 404);
        }
        await rateLimiter(context, mutation);
        try {
            let result;
            if (toolName === 'search_opportunities') {
                result = await searchOpportunities(context, {
                    ...input,
                    status: Array.isArray(input.status) ? input.status.join(',') : input.status,
                    priority: Array.isArray(input.priority)
                        ? input.priority.join(',')
                        : input.priority
                }, requestId);
            } else if (toolName === 'get_opportunity') {
                result = await getOpportunity(context, input.opportunityId, requestId);
            } else if (toolName === 'create_opportunity') {
                const req = {
                    body: input,
                    headers: { 'idempotency-key': input.idempotencyKey || '' },
                    get(name) { return this.headers[String(name).toLowerCase()] || ''; }
                };
                result = await createOpportunity(context, input, req, requestId);
            } else if (toolName === 'create_task') {
                const req = {
                    body: input,
                    headers: { 'idempotency-key': input.idempotencyKey || '' },
                    get(name) { return this.headers[String(name).toLowerCase()] || ''; }
                };
                result = await createTask(context, input, req, requestId);
            } else {
                result = await getSalesPipeline(context, input, requestId);
            }
            return {
                requestId,
                data: result.data,
                ...(result.page ? { page: result.page } : {}),
                ...(result.replayed ? { replayed: true } : {})
            };
        } catch (error) {
            const apiError = error instanceof ApiError
                ? error
                : new ApiError('INTERNAL_ERROR', 'The request could not be completed.', 500);
            try {
                const ref = database.ref('/audit_events').push();
                await ref.set(auditRecord(
                    context,
                    actionInfo[0],
                    actionInfo[1],
                    '',
                    requestId,
                    'failed',
                    { now: now(), errorCode: apiError.code }
                ));
            } catch {
                console.error('AgriSolar MCP failure audit could not be written.');
            }
            throw apiError;
        }
    }

    async function handler(req, res) {
        const requestId = crypto.randomUUID();
        let context;
        let action = '';
        let entityType = '';
        try {
            const path = requestPath(req);
            const method = String(req.method || 'GET').toUpperCase();
            context = await authenticate(req);
            const mutation = method === 'POST' || method === 'PUT' || method === 'PATCH';
            await rateLimiter(context, mutation);
            if (mutation) {
                const contentType = requestHeader(req, 'content-type').toLowerCase();
                if (!contentType.startsWith('application/json')) {
                    throw new ApiError(
                        'UNSUPPORTED_MEDIA_TYPE',
                        'Mutation requests must use application/json.',
                        415
                    );
                }
                const payloadBytes = Buffer.byteLength(JSON.stringify(req.body || {}), 'utf8');
                if (payloadBytes > 65536) {
                    throw new ApiError(
                        'PAYLOAD_TOO_LARGE',
                        'The request body exceeds the 64 KiB limit.',
                        413
                    );
                }
            }
            let result;

            if (method === 'GET' && path === `${API_PREFIX}/opportunities`) {
                action = 'opportunity.search';
                entityType = 'opportunity';
                result = await searchOpportunities(context, queryValues(req), requestId);
            } else if (method === 'GET'
                && new RegExp(`^${API_PREFIX}/opportunities/[^/]+$`).test(path)) {
                action = 'opportunity.read';
                entityType = 'opportunity';
                result = await getOpportunity(context, path.split('/').at(-1), requestId);
            } else if (method === 'POST' && path === `${API_PREFIX}/opportunities`) {
                action = 'opportunity.create';
                entityType = 'opportunity';
                result = await createOpportunity(context, req.body || {}, req, requestId);
            } else if (method === 'POST' && path === `${API_PREFIX}/tasks`) {
                action = 'task.create';
                entityType = 'task';
                result = await createTask(context, req.body || {}, req, requestId);
            } else if (method === 'GET'
                && path === `${API_PREFIX}/analytics/sales-pipeline`) {
                action = 'analytics.sales_pipeline.read';
                entityType = 'analytics';
                result = await getSalesPipeline(context, queryValues(req), requestId);
            } else if (method === 'GET'
                && path === `${API_PREFIX}/admin/review-center`) {
                action = 'admin.review_center.read';
                entityType = 'review_center';
                result = await getReviewCenter(context, queryValues(req), requestId);
            } else if (method === 'POST'
                && path === `${API_PREFIX}/admin/reviews`) {
                action = 'admin.review';
                entityType = 'review';
                result = await reviewEntity(context, req.body || {}, req, requestId);
            } else {
                throw new ApiError('NOT_FOUND', 'API route was not found.', 404);
            }

            res.status(result.statusCode
                ?? (result.replayed ? 200 : (method === 'POST' ? 201 : 200))).json({
                requestId,
                data: result.data,
                ...(result.page ? { page: result.page } : {}),
                ...(result.replayed ? { replayed: true } : {})
            });
        } catch (error) {
            const apiError = error instanceof ApiError
                ? error
                : new ApiError('INTERNAL_ERROR', 'The request could not be completed.', 500);
            if (!(error instanceof ApiError)) {
                console.error('AgriSolar API request failed.', error?.message || error);
            }
            if (context && action) {
                try {
                    const ref = database.ref('/audit_events').push();
                    await ref.set(auditRecord(
                        context,
                        action,
                        entityType,
                        '',
                        requestId,
                        'failed',
                        { now: now(), errorCode: apiError.code }
                    ));
                } catch (auditError) {
                    console.error('AgriSolar API failure audit could not be written.');
                }
            }
            res.status(apiError.status).json({
                requestId,
                error: {
                    code: apiError.code,
                    message: apiError.message,
                    ...(apiError.details !== undefined ? { details: apiError.details } : {})
                }
            });
        }
    }

    return { handler, executeTool, resolveAgentContext };
}

function createBusinessApiHandler(options) {
    return createBusinessApi(options).handler;
}

module.exports = {
    ApiError,
    OPPORTUNITY_STATUSES,
    createBusinessApi,
    createBusinessApiHandler,
    validateCreateOpportunity,
    validateCreateTask,
    validateReviewDecision
};
