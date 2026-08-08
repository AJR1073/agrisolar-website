const assert = require('node:assert/strict');
const puppeteer = require('puppeteer');

const hostingBase = process.env.HOSTING_BASE || 'http://127.0.0.1:5100';

async function run() {
    const browser = await puppeteer.launch({
        executablePath: '/usr/bin/google-chrome',
        headless: true,
        args: ['--no-sandbox', '--disable-gpu']
    });

    try {
        const page = await browser.newPage();
        const candidateSubmissions = [];
        page.setDefaultTimeout(5000);
        await page.setViewport({ width: 1440, height: 1000 });
        page.on('pageerror', error => console.error('Browser page error:', error.message));
        await page.setRequestInterception(true);
        page.on('request', request => {
            if (request.url().includes('/api/v1/opportunity-candidates')) {
                candidateSubmissions.push(JSON.parse(request.postData() || '{}'));
                request.respond({
                    status: 201,
                    contentType: 'application/json',
                    body: JSON.stringify({
                        requestId: 'candidate-request',
                        data: {
                            opportunityId: `candidate-${candidateSubmissions.length}`,
                            reviewStatus: 'pending_review'
                        }
                    })
                });
            } else if (request.url().endsWith('/discoverProspects')) {
                if (request.method() === 'OPTIONS') {
                    request.respond({
                        status: 204,
                        headers: {
                            'Access-Control-Allow-Origin': hostingBase,
                            'Access-Control-Allow-Headers': 'Authorization, Content-Type',
                            'Access-Control-Allow-Methods': 'POST, OPTIONS'
                        }
                    });
                    return;
                }
                request.respond({
                    status: 200,
                    contentType: 'application/json',
                    headers: { 'Access-Control-Allow-Origin': hostingBase },
                    body: JSON.stringify({
                        candidates: [{
                            companyName: 'AI Discovered Solar',
                            website: 'https://discovered.example/',
                            location: 'Southern Illinois',
                            contactName: 'Public Operations Team',
                            contactEmail: 'operations@discovered.example',
                            contactPhone: '',
                            fitReason: 'AI assessment based on the cited public project page.',
                            sourceTitle: 'Official discovered project',
                            sourceUrl: 'https://discovered.example/project',
                            evidenceSummary: 'The official page describes a utility-scale solar project.',
                            confidence: 'high',
                            missingFacts: ['Current vegetation-management vendor']
                        }],
                        model: 'test-model',
                        promptVersion: 'discovery-v1',
                        costEvent: {
                            id: 'cost-discovery',
                            kind: 'discovery',
                            costType: 'estimate',
                            estimatedMicroUsd: 20000,
                            model: 'gpt-5.6-sol-test',
                            createdAt: 1700000000002
                        }
                    })
                });
            } else if (request.url().endsWith('/draftOutreachEmail')) {
                if (request.method() === 'OPTIONS') {
                    request.respond({
                        status: 204,
                        headers: {
                            'Access-Control-Allow-Origin': hostingBase,
                            'Access-Control-Allow-Headers': 'Authorization, Content-Type',
                            'Access-Control-Allow-Methods': 'POST, OPTIONS'
                        }
                    });
                    return;
                }
                request.respond({
                    status: 200,
                    contentType: 'application/json',
                    headers: { 'Access-Control-Allow-Origin': hostingBase },
                    body: JSON.stringify({
                        draftId: 'draft-1',
                        subject: 'Vegetation management for Verified Solar',
                        body: 'Hello,\n\nAgriSolar can help with solar-site vegetation management.\n\nIf you prefer not to receive outreach, please let me know.\n\nAaron\nAgriSolar LLC',
                        personalizationBasis: ['Official public project source'],
                        claimsToVerify: ['Current service need'],
                        costEvent: {
                            id: 'cost-draft',
                            kind: 'drafting',
                            costType: 'estimate',
                            estimatedMicroUsd: 10000,
                            model: 'gpt-5.6-sol-test',
                            createdAt: 1700000000003
                        },
                        sendingAllowed: false
                    })
                });
            } else if (request.url().includes('firebase-app.js')) {
                request.respond({
                    contentType: 'application/javascript',
                    body: `
                        (() => {
                            const user = {
                                uid: 'approved-admin',
                                email: 'aaronreifschneider@outlook.com',
                                async getIdToken() { return 'test-token'; }
                            };
                            const data = {
                                contact_submissions: {},
                                email_recipients: {},
                                companies: {},
                                solar_sites: {},
                                service_seasons: {},
                                scheduled_services: {},
                                prospect_candidates: {
                                    prospect1: {
                                        companyName: 'Synthetic <img src=x onerror=alert(1)> Solar',
                                        normalizedCompany: 'synthetic solar',
                                        website: 'https://example.com/',
                                        normalizedDomain: 'example.com',
                                        location: 'Example County, Illinois',
                                        contactName: 'Test Contact',
                                        contactEmail: 'contact@example.com',
                                        contactPhone: '618-555-0100',
                                        fitReason: 'Public information indicates a synthetic solar operation.',
                                        sourceId: 'source1',
                                        verificationStatus: 'Needs review',
                                        outreachStatus: 'Not contacted',
                                        suppressed: false,
                                        createdAt: 1700000000000,
                                        updatedAt: 1700000000000,
                                        administratorUid: 'approved-admin'
                                    },
                                    prospect2: {
                                        companyName: 'Verified Solar',
                                        normalizedCompany: 'verified solar',
                                        website: 'https://verified.example/',
                                        normalizedDomain: 'verified.example',
                                        location: 'Illinois',
                                        contactName: 'Operations Team',
                                        contactEmail: 'operations@verified.example',
                                        contactPhone: '',
                                        fitReason: 'Verified public solar operator.',
                                        sourceId: 'source2',
                                        verificationStatus: 'Verified',
                                        outreachStatus: 'Not contacted',
                                        suppressed: false,
                                        createdAt: 1700000000001,
                                        updatedAt: 1700000000001,
                                        administratorUid: 'approved-admin'
                                    }
                                },
                                prospect_sources: {
                                    source1: {
                                        prospectId: 'prospect1',
                                        url: 'https://example.com/project',
                                        title: 'Synthetic project source',
                                        evidenceSummary: 'The public page describes a synthetic solar project.',
                                        accessedAt: 1700000000000,
                                        createdAt: 1700000000000,
                                        administratorUid: 'approved-admin'
                                    },
                                    source2: {
                                        prospectId: 'prospect2',
                                        url: 'https://verified.example/project',
                                        title: 'Verified project source',
                                        evidenceSummary: 'The official page describes a verified solar project.',
                                        accessedAt: 1700000000001,
                                        createdAt: 1700000000001,
                                        administratorUid: 'approved-admin'
                                    }
                                },
                                suppression_entries: {},
                                ai_cost_events: {
                                    historicalCost: {
                                        kind: 'discovery',
                                        costType: 'actual',
                                        actualMicroUsd: 470000,
                                        model: 'gpt-5.6',
                                        createdAt: 1700000000001
                                    }
                                },
                                ai_settings: { outreachEnabled: true }
                            };
                            let generatedKey = 0;
                            window.__outreachUpdates = [];
                            function database() {
                                return {
                                    ref(path = '') {
                                        return {
                                            async once() {
                                                const value = data[path] || {};
                                                return { val() { return value; } };
                                            },
                                            push() {
                                                generatedKey += 1;
                                                return { key: 'generated-key-' + generatedKey };
                                            },
                                            async update(updates) {
                                                window.__outreachUpdates.push(updates);
                                            },
                                            async set() {},
                                            async remove() {}
                                        };
                                    }
                                };
                            }
                            database.ServerValue = { TIMESTAMP: 1700000000000 };
                            window.firebase = {
                                apps: [],
                                initializeApp(config) { this.apps.push(config); },
                                auth() {
                                    return {
                                        currentUser: user,
                                        onAuthStateChanged(callback) { setTimeout(() => callback(user), 0); },
                                        async signInWithEmailAndPassword() {},
                                        async sendPasswordResetEmail() {},
                                        async signOut() {}
                                    };
                                },
                                database,
                                functions() { return {}; },
                                storage() { return { ref() { return {}; } }; }
                            };
                        })();
                    `
                });
            } else if (request.url().includes('gstatic.com/firebasejs/')) {
                request.respond({ contentType: 'application/javascript', body: '' });
            } else {
                request.continue();
            }
        });

        await page.goto(`${hostingBase}/admin/`, { waitUntil: 'domcontentloaded' });
        await page.waitForFunction(() => (
            getComputedStyle(document.querySelector('#dashboardContainer')).display !== 'none'
        ));
        await page.click('[data-tab="outreach"]');
        await page.waitForSelector('.outreach-card');

        assert.equal((await page.$$('.outreach-total')).length, 4);
        assert.equal(await page.$eval('#aiLastCallCost', element => element.textContent), '$0.47');
        assert.equal(await page.$eval('#aiTrackedTotalCost', element => element.textContent), '$0.47');
        assert.equal(await page.$eval('#aiTrackedRequestCount', element => element.textContent), '1');
        assert.match(
            await page.$eval('#outreachTab', element => element.textContent),
            /AI can research public sources and prepare review-only drafts/
        );
        assert.match(
            await page.$eval('.outreach-card[data-prospect-id="prospect1"]', element => element.textContent),
            /Synthetic <img src=x onerror=alert\(1\)> Solar/
        );
        assert.equal(
            await page.$$eval('.outreach-card img, .outreach-card script', elements => elements.length),
            0
        );

        await page.click('#discoverProspectsBtn');
        await page.$eval('#aiDiscoveryForm', form => form.requestSubmit());
        await page.waitForSelector('.ai-result-card');
        assert.equal(await page.$eval('#aiLastCallCost', element => element.textContent), '$0.02');
        assert.equal(await page.$eval('#aiTrackedTotalCost', element => element.textContent), '$0.49');
        assert.equal(await page.$eval('#aiTrackedRequestCount', element => element.textContent), '2');
        assert.equal(
            await page.$eval('.ai-result-card a', anchor => anchor.href),
            'https://discovered.example/project'
        );
        assert.match(
            await page.$eval('.ai-result-card', element => element.textContent),
            /Current vegetation-management vendor/
        );
        await page.click('[data-outreach-action="save-discovery"]');
        await page.waitForFunction(() => (
            document.querySelector('[data-outreach-action="save-discovery"]')
                ?.textContent.includes('Submitted')
        ));
        assert.equal(candidateSubmissions.length, 1);
        assert.equal(candidateSubmissions[0].candidateSource, 'outreach_api');
        assert.equal(candidateSubmissions[0].company.name, 'AI Discovered Solar');
        assert.equal(candidateSubmissions[0].aiResearch.model, 'test-model');
        await page.click('[data-close-ai-discovery]');

        await page.click('#addProspectBtn');
        await page.type('#prospectCompany', 'Synthetic <img src=x onerror=alert(1)> Solar');
        await page.type('#prospectWebsite', 'https://example.com');
        await page.type('#prospectSourceTitle', 'Duplicate source');
        await page.type('#prospectSourceUrl', 'https://example.com/duplicate');
        await page.type('#prospectEvidence', 'Synthetic duplicate evidence.');
        await page.$eval('#prospectForm', form => form.requestSubmit());
        await page.waitForFunction(() => (
            document.querySelector('.message.error')?.textContent.includes('already exists')
        ));
        assert.equal(candidateSubmissions.length, 1);
        assert.equal(await page.evaluate(() => window.__outreachUpdates.length), 0);
        assert.equal(
            await page.$eval('#prospectModal', modal => modal.style.display),
            'block'
        );

        await page.$eval('#prospectCompany', input => { input.value = 'Second Synthetic Solar'; });
        await page.$eval('#prospectWebsite', input => { input.value = 'https://second.example.org'; });
        await page.$eval('#prospectForm', form => form.requestSubmit());
        await page.waitForFunction(() => (
            document.querySelector('#prospectModal').style.display === 'none'
        ));
        assert.equal(candidateSubmissions.length, 2);
        assert.equal(candidateSubmissions[1].candidateSource, 'manual');
        assert.equal(candidateSubmissions[1].company.name, 'Second Synthetic Solar');
        assert.equal(candidateSubmissions[1].source.url, 'https://example.com/duplicate');

        await page.click('[data-outreach-action="draft"][data-prospect-id="prospect2"]');
        await page.$eval('#aiDraftForm', form => form.requestSubmit());
        await page.waitForFunction(() => document.querySelector('#aiDraftResult').hidden === false);
        assert.equal(await page.$eval('#aiLastCallCost', element => element.textContent), '$0.01');
        assert.equal(await page.$eval('#aiTrackedTotalCost', element => element.textContent), '$0.50');
        assert.equal(await page.$eval('#aiTrackedRequestCount', element => element.textContent), '3');
        assert.equal(
            await page.$eval('#aiDraftSubject', input => input.value),
            'Vegetation management for Verified Solar'
        );
        assert.match(
            await page.$eval('#aiDraftModal', element => element.textContent),
            /No email was sent/
        );
        await page.click('[data-close-ai-draft]');

        await page.click('[data-outreach-action="verify"][data-prospect-id="prospect1"]');
        await page.waitForFunction(() => window.__outreachUpdates.length === 1);
        const verifyUpdate = await page.evaluate(() => window.__outreachUpdates[0]);
        assert.equal(
            verifyUpdate['prospect_candidates/prospect1/verificationStatus'],
            'Verified'
        );

        page.once('dialog', dialog => dialog.accept());
        await page.click('[data-outreach-action="suppress"][data-prospect-id="prospect1"]');
        await page.waitForFunction(() => window.__outreachUpdates.length === 2);
        const suppressionUpdate = await page.evaluate(() => window.__outreachUpdates[1]);
        assert.equal(suppressionUpdate['prospect_candidates/prospect1/suppressed'], true);
        assert.ok(
            Object.keys(suppressionUpdate).some(path => path.startsWith('suppression_entries/'))
        );

        console.log('PASS: Outreach safely discovers, cites, reviews, drafts without sending, and suppresses candidates');
    } finally {
        await browser.close();
    }
}

run().catch(error => {
    console.error(error);
    process.exitCode = 1;
});
