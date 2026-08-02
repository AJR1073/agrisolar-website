const assert = require('node:assert/strict');
const {
    buildDiscoveryRequest,
    discoverProspectsWithOpenAI,
    draftOutreachWithOpenAI,
    normalizeDiscoveryCriteria,
    sanitizeDiscoveryResponse
} = require('../functions/ai-outreach');

function responseWithJson(value, sources = []) {
    return {
        output: [
            {
                type: 'web_search_call',
                action: { type: 'search', sources }
            },
            {
                type: 'message',
                content: [{
                    type: 'output_text',
                    text: JSON.stringify(value),
                    annotations: []
                }]
            }
        ]
    };
}

async function run() {
    const criteria = normalizeDiscoveryCriteria({
        region: 'Illinois',
        organizationTypes: 'Solar operators',
        serviceNeed: 'Vegetation management',
        maxResults: 99
    });
    assert.equal(criteria.maxResults, 5);

    const request = buildDiscoveryRequest(criteria, 'test-model');
    assert.equal(request.store, false);
    assert.equal(request.model, 'test-model');
    assert.deepEqual(request.tools.map(tool => tool.type), ['web_search']);
    assert.deepEqual(request.include, ['web_search_call.action.sources']);
    assert.equal(request.text.format.type, 'json_schema');

    const candidates = [
        {
            companyName: 'Supported Solar',
            website: 'https://supported.example/',
            location: 'Illinois',
            publicContactName: '',
            publicContactEmail: 'info@supported.example',
            publicContactPhone: '',
            fitReason: 'Operates a public solar project.',
            sourceTitle: 'Supported project',
            sourceUrl: 'https://supported.example/project?utm_source=openai',
            evidenceSummary: 'The source describes a utility-scale solar project.',
            confidence: 'high',
            missingFacts: ['Decision maker']
        },
        {
            companyName: 'Unsupported Solar',
            website: 'https://unsupported.example/',
            location: 'Illinois',
            publicContactName: '',
            publicContactEmail: '',
            publicContactPhone: '',
            fitReason: 'Not grounded.',
            sourceTitle: 'Invented source',
            sourceUrl: 'https://unsupported.example/invented',
            evidenceSummary: 'Not actually consulted.',
            confidence: 'high',
            missingFacts: []
        }
    ];
    const rawDiscovery = responseWithJson(
        { candidates },
        [{ url: 'https://supported.example/project', title: 'Official supported project' }]
    );
    const sanitized = sanitizeDiscoveryResponse(rawDiscovery, 5);
    assert.equal(sanitized.candidates.length, 1);
    assert.equal(sanitized.candidates[0].companyName, 'Supported Solar');
    assert.equal(sanitized.candidates[0].sourceUrl, 'https://supported.example/project');

    let capturedDiscoveryRequest;
    const discoveryResult = await discoverProspectsWithOpenAI('test-key', criteria, {
        model: 'test-model',
        fetchImpl: async (url, options) => {
            assert.equal(url, 'https://api.openai.com/v1/responses');
            assert.equal(options.headers.Authorization, 'Bearer test-key');
            capturedDiscoveryRequest = JSON.parse(options.body);
            return {
                ok: true,
                async json() { return rawDiscovery; }
            };
        }
    });
    assert.equal(capturedDiscoveryRequest.store, false);
    assert.equal(discoveryResult.candidates.length, 1);
    assert.equal(discoveryResult.promptVersion, 'discovery-v1');

    let capturedDraftRequest;
    const draftResult = await draftOutreachWithOpenAI(
        'test-key',
        {
            companyName: 'Supported Solar',
            location: 'Illinois',
            contactName: 'Operations Team',
            contactEmail: 'info@supported.example',
            fitReason: 'Operates a public solar project.'
        },
        {
            title: 'Official supported project',
            url: 'https://supported.example/project',
            evidenceSummary: 'The source describes a utility-scale solar project.'
        },
        'Offer mowing services.',
        {
            model: 'test-model',
            fetchImpl: async (url, options) => {
                capturedDraftRequest = JSON.parse(options.body);
                return {
                    ok: true,
                    async json() {
                        return responseWithJson({
                            subject: 'Vegetation management for Supported Solar',
                            body: 'Hello Operations Team,\n\nAgriSolar can help with vegetation management.\n\nIf you prefer not to receive outreach, please let me know.\n\nAaron\nAgriSolar LLC',
                            personalizationBasis: ['Public project source'],
                            claimsToVerify: ['Current service need']
                        });
                    }
                };
            }
        }
    );
    assert.equal(capturedDraftRequest.store, false);
    assert.equal(capturedDraftRequest.tools, undefined);
    assert.equal(draftResult.subject, 'Vegetation management for Supported Solar');
    assert.equal(draftResult.promptVersion, 'draft-v1');

    console.log('PASS: AI discovery stays source-grounded and drafting remains structured and non-sending');
}

run().catch(error => {
    console.error(error);
    process.exitCode = 1;
});
