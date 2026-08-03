'use strict';

const { estimateResponseCost } = require('./ai-cost');

const OPENAI_RESPONSES_URL = 'https://api.openai.com/v1/responses';
const DEFAULT_MODEL = 'gpt-5.6';

class AiOutreachError extends Error {
    constructor(message, status = 500, code = 'ai_error') {
        super(message);
        this.name = 'AiOutreachError';
        this.status = status;
        this.code = code;
    }
}

function cleanString(value, maxLength) {
    return typeof value === 'string' ? value.trim().slice(0, maxLength) : '';
}

function cleanHttpUrl(value) {
    const text = cleanString(value, 500);
    if (!text) return '';
    try {
        const url = new URL(text);
        if (!['http:', 'https:'].includes(url.protocol)) return '';
        url.hash = '';
        return url.href;
    } catch {
        return '';
    }
}

function comparableUrl(value) {
    const cleanUrl = cleanHttpUrl(value);
    if (!cleanUrl) return '';
    const url = new URL(cleanUrl);
    for (const parameter of [...url.searchParams.keys()]) {
        if (parameter.toLowerCase().startsWith('utm_')) {
            url.searchParams.delete(parameter);
        }
    }
    url.pathname = url.pathname.replace(/\/$/, '') || '/';
    return `${url.hostname.toLowerCase()}${url.pathname}${url.search}`;
}

function normalizeDiscoveryCriteria(value) {
    const criteria = {
        region: cleanString(value?.region, 120),
        organizationTypes: cleanString(value?.organizationTypes, 240),
        serviceNeed: cleanString(value?.serviceNeed, 240),
        notes: cleanString(value?.notes, 500),
        maxResults: Math.min(5, Math.max(1, Number.parseInt(value?.maxResults, 10) || 3))
    };
    if (!criteria.region || !criteria.organizationTypes || !criteria.serviceNeed) {
        throw new AiOutreachError(
            'Region, organization types, and service need are required.',
            400,
            'invalid_criteria'
        );
    }
    return criteria;
}

function discoverySchema(maxResults) {
    const text = { type: 'string' };
    return {
        type: 'object',
        additionalProperties: false,
        properties: {
            candidates: {
                type: 'array',
                maxItems: maxResults,
                items: {
                    type: 'object',
                    additionalProperties: false,
                    properties: {
                        companyName: text,
                        website: text,
                        location: text,
                        publicContactName: text,
                        publicContactEmail: text,
                        publicContactPhone: text,
                        fitReason: text,
                        sourceTitle: text,
                        sourceUrl: text,
                        evidenceSummary: text,
                        confidence: { type: 'string', enum: ['low', 'medium', 'high'] },
                        missingFacts: { type: 'array', items: text, maxItems: 8 }
                    },
                    required: [
                        'companyName',
                        'website',
                        'location',
                        'publicContactName',
                        'publicContactEmail',
                        'publicContactPhone',
                        'fitReason',
                        'sourceTitle',
                        'sourceUrl',
                        'evidenceSummary',
                        'confidence',
                        'missingFacts'
                    ]
                }
            }
        },
        required: ['candidates']
    };
}

function draftSchema() {
    return {
        type: 'object',
        additionalProperties: false,
        properties: {
            subject: { type: 'string' },
            body: { type: 'string' },
            personalizationBasis: {
                type: 'array',
                items: { type: 'string' },
                maxItems: 8
            },
            claimsToVerify: {
                type: 'array',
                items: { type: 'string' },
                maxItems: 8
            }
        },
        required: ['subject', 'body', 'personalizationBasis', 'claimsToVerify']
    };
}

function buildDiscoveryRequest(criteria, model = DEFAULT_MODEL) {
    return {
        model,
        store: false,
        service_tier: 'default',
        reasoning: { effort: 'low' },
        max_output_tokens: 3000,
        max_tool_calls: 6,
        tools: [{
            type: 'web_search',
            search_context_size: 'medium',
            external_web_access: true,
            user_location: {
                type: 'approximate',
                country: 'US',
                region: criteria.region,
                timezone: 'America/Chicago'
            }
        }],
        tool_choice: 'required',
        include: ['web_search_call.action.sources'],
        text: {
            format: {
                type: 'json_schema',
                name: 'agrisolar_prospect_discovery',
                strict: true,
                schema: discoverySchema(criteria.maxResults)
            }
        },
        instructions: [
            'You research potential business-to-business customers for AgriSolar LLC.',
            'Use only public business information and public sources.',
            'Do not infer private contact information, scrape gated pages, or guess an email address.',
            'Every candidate must have one primary source URL that you actually consulted.',
            'Separate source-supported facts from your fit assessment.',
            'If a fact is uncertain, leave its field empty and list it under missingFacts.',
            'Do not draft or send email in this task.'
        ].join(' '),
        input: [
            `Find no more than ${criteria.maxResults} potential customers.`,
            `Geographic focus: ${criteria.region}.`,
            `Organization types: ${criteria.organizationTypes}.`,
            `Likely service need: ${criteria.serviceNeed}.`,
            criteria.notes ? `Additional administrator notes: ${criteria.notes}.` : '',
            'Prioritize official company, project, government, trade, or utility sources.',
            'Return only candidates with a concrete public source supporting the business or solar-project connection.'
        ].filter(Boolean).join('\n')
    };
}

function buildDraftRequest(prospect, source, goal, model = DEFAULT_MODEL) {
    return {
        model,
        store: false,
        service_tier: 'default',
        reasoning: { effort: 'low' },
        max_output_tokens: 1800,
        text: {
            format: {
                type: 'json_schema',
                name: 'agrisolar_outreach_draft',
                strict: true,
                schema: draftSchema()
            }
        },
        instructions: [
            'Draft a concise, respectful business-development email for AgriSolar LLC.',
            'This is a human-review draft only. Never claim that it was sent.',
            'Use only the supplied verified prospect record and public-source evidence.',
            'Do not invent names, projects, prices, relationships, performance claims, or commitments.',
            'Avoid pressure, hype, tracking language, and deceptive subject lines.',
            'Include a simple opt-out sentence.',
            'Sign the draft as Aaron, AgriSolar LLC.'
        ].join(' '),
        input: JSON.stringify({
            administratorGoal: cleanString(goal, 500) || 'Introduce AgriSolar vegetation-management services and invite a conversation.',
            prospect: {
                companyName: cleanString(prospect.companyName, 120),
                location: cleanString(prospect.location, 180),
                contactName: cleanString(prospect.contactName, 120),
                contactEmail: cleanString(prospect.contactEmail, 254),
                fitReason: cleanString(prospect.fitReason, 1000)
            },
            verifiedPublicSource: {
                title: cleanString(source.title, 200),
                url: cleanHttpUrl(source.url),
                evidenceSummary: cleanString(source.evidenceSummary, 2000)
            }
        })
    };
}

function outputText(response) {
    for (const item of Array.isArray(response?.output) ? response.output : []) {
        if (item?.type !== 'message') continue;
        for (const content of Array.isArray(item.content) ? item.content : []) {
            if (content?.type === 'output_text' && typeof content.text === 'string') {
                return content.text;
            }
        }
    }
    return '';
}

function collectTrustedSources(response) {
    const sources = new Map();
    for (const item of Array.isArray(response?.output) ? response.output : []) {
        if (item?.type === 'web_search_call') {
            for (const source of Array.isArray(item?.action?.sources) ? item.action.sources : []) {
                const url = cleanHttpUrl(source?.url);
                if (url) sources.set(comparableUrl(url), {
                    url,
                    title: cleanString(source?.title, 200)
                });
            }
        }
        if (item?.type === 'message') {
            for (const content of Array.isArray(item.content) ? item.content : []) {
                for (const annotation of Array.isArray(content?.annotations) ? content.annotations : []) {
                    if (annotation?.type !== 'url_citation') continue;
                    const url = cleanHttpUrl(annotation.url);
                    if (url) sources.set(comparableUrl(url), {
                        url,
                        title: cleanString(annotation.title, 200)
                    });
                }
            }
        }
    }
    return sources;
}

function parseStructuredOutput(response) {
    const text = outputText(response);
    if (!text) {
        throw new AiOutreachError('The AI service returned no usable text.', 502, 'empty_ai_response');
    }
    try {
        return JSON.parse(text);
    } catch {
        throw new AiOutreachError('The AI service returned invalid structured data.', 502, 'invalid_ai_response');
    }
}

function cleanEmail(value) {
    const email = cleanString(value, 254).toLowerCase();
    return /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email) ? email : '';
}

function sanitizeDiscoveryResponse(response, maxResults) {
    const parsed = parseStructuredOutput(response);
    const trustedSources = collectTrustedSources(response);
    const candidates = [];

    for (const candidate of Array.isArray(parsed?.candidates) ? parsed.candidates : []) {
        if (candidates.length >= maxResults) break;
        const companyName = cleanString(candidate?.companyName, 120);
        const sourceKey = comparableUrl(candidate?.sourceUrl);
        const trustedSource = trustedSources.get(sourceKey);
        if (!companyName || !trustedSource) continue;

        candidates.push({
            companyName,
            website: cleanHttpUrl(candidate.website),
            location: cleanString(candidate.location, 180),
            contactName: cleanString(candidate.publicContactName, 120),
            contactEmail: cleanEmail(candidate.publicContactEmail),
            contactPhone: cleanString(candidate.publicContactPhone, 30),
            fitReason: cleanString(candidate.fitReason, 1000),
            sourceTitle: cleanString(candidate.sourceTitle, 200)
                || trustedSource.title
                || trustedSource.url,
            sourceUrl: trustedSource.url,
            evidenceSummary: cleanString(candidate.evidenceSummary, 2000),
            confidence: ['low', 'medium', 'high'].includes(candidate.confidence)
                ? candidate.confidence
                : 'low',
            missingFacts: (Array.isArray(candidate.missingFacts) ? candidate.missingFacts : [])
                .map((item) => cleanString(item, 200))
                .filter(Boolean)
                .slice(0, 8)
        });
    }

    return {
        candidates,
        sources: [...trustedSources.values()].slice(0, 30)
    };
}

function sanitizeDraftResponse(response) {
    const parsed = parseStructuredOutput(response);
    const subject = cleanString(parsed?.subject, 160);
    const body = cleanString(parsed?.body, 5000);
    if (!subject || !body) {
        throw new AiOutreachError('The AI service returned an incomplete draft.', 502, 'incomplete_draft');
    }
    return {
        subject,
        body,
        personalizationBasis: (Array.isArray(parsed.personalizationBasis)
            ? parsed.personalizationBasis : [])
            .map((item) => cleanString(item, 300))
            .filter(Boolean)
            .slice(0, 8),
        claimsToVerify: (Array.isArray(parsed.claimsToVerify) ? parsed.claimsToVerify : [])
            .map((item) => cleanString(item, 300))
            .filter(Boolean)
            .slice(0, 8)
    };
}

async function requestOpenAI(apiKey, request, fetchImpl = globalThis.fetch) {
    if (!apiKey) {
        throw new AiOutreachError('AI outreach is not configured.', 503, 'ai_not_configured');
    }
    const response = await fetchImpl(OPENAI_RESPONSES_URL, {
        method: 'POST',
        headers: {
            Authorization: `Bearer ${apiKey}`,
            'Content-Type': 'application/json'
        },
        body: JSON.stringify(request)
    });
    const data = await response.json().catch(() => ({}));
    if (!response.ok) {
        console.error('OpenAI Responses API request failed.', {
            status: response.status,
            requestId: response.headers?.get?.('x-request-id') || ''
        });
        throw new AiOutreachError(
            'The AI service could not complete this request.',
            response.status === 429 ? 429 : 502,
            response.status === 429 ? 'ai_rate_limited' : 'ai_request_failed'
        );
    }
    return data;
}

async function discoverProspectsWithOpenAI(apiKey, rawCriteria, options = {}) {
    const criteria = normalizeDiscoveryCriteria(rawCriteria);
    const model = options.model || process.env.OPENAI_OUTREACH_MODEL || DEFAULT_MODEL;
    const request = buildDiscoveryRequest(criteria, model);
    if (options.safetyIdentifier) request.safety_identifier = options.safetyIdentifier;
    const response = await requestOpenAI(
        apiKey,
        request,
        options.fetchImpl
    );
    return {
        ...sanitizeDiscoveryResponse(response, criteria.maxResults),
        model: response.model || model,
        cost: estimateResponseCost(response),
        promptVersion: 'discovery-v1'
    };
}

async function draftOutreachWithOpenAI(apiKey, prospect, source, goal, options = {}) {
    const model = options.model || process.env.OPENAI_OUTREACH_MODEL || DEFAULT_MODEL;
    const request = buildDraftRequest(prospect, source, goal, model);
    if (options.safetyIdentifier) request.safety_identifier = options.safetyIdentifier;
    const response = await requestOpenAI(
        apiKey,
        request,
        options.fetchImpl
    );
    return {
        ...sanitizeDraftResponse(response),
        model: response.model || model,
        cost: estimateResponseCost(response),
        promptVersion: 'draft-v1'
    };
}

module.exports = {
    AiOutreachError,
    buildDiscoveryRequest,
    buildDraftRequest,
    collectTrustedSources,
    discoverProspectsWithOpenAI,
    draftOutreachWithOpenAI,
    normalizeDiscoveryCriteria,
    sanitizeDiscoveryResponse,
    sanitizeDraftResponse
};
