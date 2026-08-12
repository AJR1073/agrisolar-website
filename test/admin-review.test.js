const assert = require('node:assert/strict');
const puppeteer = require('puppeteer');

const hostingBase = process.env.HOSTING_BASE || 'http://127.0.0.1:5100';

async function run() {
    const browser = await puppeteer.launch({
        executablePath: '/usr/bin/google-chrome',
        headless: true,
        args: ['--no-sandbox', '--disable-gpu']
    });

    let reviewStatus = 'pending_review';
    let reviewRequest = null;
    const externalActionRequests = [];

    try {
        const page = await browser.newPage();
        page.setDefaultTimeout(6000);
        await page.setViewport({ width: 1440, height: 1000 });
        page.on('pageerror', error => console.error('Browser page error:', error.message));
        await page.setRequestInterception(true);
        page.on('request', request => {
            const url = request.url();
            if (/sendReply|sendEmail|communication\.send/i.test(url)) {
                externalActionRequests.push(url);
            }
            if (url.includes('/api/v1/admin/review-center?')) {
                request.respond({
                    status: 200,
                    contentType: 'application/json',
                    body: JSON.stringify({
                        requestId: 'review-center-request',
                        data: {
                            opportunities: [{
                                opportunityId: 'opportunity-1',
                                organizationId: 'agrisolar',
                                companyNameSnapshot: 'Synthetic <img src=x onerror=alert(1)> Solar',
                                siteNameSnapshot: 'Prairie Test Site',
                                city: 'Example City',
                                state: 'IL',
                                estimatedAcreage: 75,
                                opportunityType: 'vegetation_management',
                                status: 'NEW',
                                priority: 'high',
                                bidDeadlineOn: '2026-09-01',
                                projectDetails: 'Public source describes a synthetic solar project.',
                                nextAction: 'Verify the operator.',
                                source: {
                                    title: 'Official synthetic project',
                                    url: 'https://synthetic.example/project'
                                },
                                aiProvenance: {
                                    aiGenerated: true,
                                    agentId: 'research-agent',
                                    model: 'test-model',
                                    confidence: 0.82,
                                    researchSummary: 'AI inference that the site may need vegetation management.'
                                },
                                reviewStatus,
                                createdByActorType: 'AI_AGENT',
                                createdByActorId: 'research-agent'
                            }],
                            tasks: [{
                                taskId: 'task-1',
                                organizationId: 'agrisolar',
                                title: 'Verify synthetic operator',
                                description: 'Check the official ownership record.',
                                dueOn: '2026-08-20',
                                status: 'open',
                                priority: 'normal',
                                relatedEntityType: 'opportunity',
                                relatedEntityId: 'opportunity-1',
                                aiReasoning: 'Verification is needed before outreach.',
                                reviewStatus: 'pending_review',
                                createdByActorId: 'research-agent'
                            }],
                            agents: [{
                                agentId: 'research-agent',
                                displayName: 'DEV Research Agent',
                                environment: 'DEV',
                                status: 'active',
                                authorityLevel: 3,
                                capabilities: ['opportunity.read', 'opportunity.create'],
                                expiresAt: 1798761600000
                            }],
                            approvals: [],
                            auditEvents: [{
                                auditEventId: 'audit-1',
                                occurredAt: 1786158000000,
                                actorType: 'AI_AGENT',
                                actorId: 'research-agent',
                                action: 'opportunity.create',
                                entityType: 'opportunity',
                                entityId: 'opportunity-1',
                                source: 'MCP',
                                requestId: 'request-1',
                                result: 'success',
                                changeSummary: 'Created unreviewed opportunity.'
                            }]
                        }
                    })
                });
            } else if (url.endsWith('/api/v1/admin/reviews')) {
                reviewRequest = {
                    headers: request.headers(),
                    body: JSON.parse(request.postData() || '{}')
                };
                reviewStatus = reviewRequest.body.decision === 'approve'
                    ? 'approved'
                    : 'rejected';
                request.respond({
                    status: 201,
                    contentType: 'application/json',
                    body: JSON.stringify({
                        requestId: 'review-decision-request',
                        data: {
                            entityType: reviewRequest.body.entityType,
                            entityId: reviewRequest.body.entityId,
                            reviewStatus
                        }
                    })
                });
            } else if (url.includes('firebase-app.js')) {
                request.respond({
                    contentType: 'application/javascript',
                    body: `
                        (() => {
                            const user = {
                                uid: 'fWscNuWSoGdWmDIhyjneNqFU0r92',
                                email: 'aaronreifschneider@outlook.com',
                                async getIdToken() { return 'approved-owner-token'; }
                            };
                            function snapshot(value = {}) {
                                return {
                                    val() { return value; },
                                    forEach() {},
                                    exists() { return Boolean(value); }
                                };
                            }
                            function database() {
                                return {
                                    ref() {
                                        return {
                                            async once() { return snapshot({}); },
                                            push() { return { key: 'generated-key' }; },
                                            async update() {},
                                            async set() {},
                                            async remove() {}
                                        };
                                    }
                                };
                            }
                            database.ServerValue = { TIMESTAMP: 1786158000000 };
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
            } else if (url.includes('gstatic.com/firebasejs/')) {
                request.respond({ contentType: 'application/javascript', body: '' });
            } else {
                request.continue();
            }
        });

        await page.goto(`${hostingBase}/admin/`, { waitUntil: 'domcontentloaded' });
        await page.waitForFunction(() => (
            getComputedStyle(document.querySelector('#dashboardContainer')).display !== 'none'
        ));
        await page.click('[data-tab="reviewCenter"]');
        await page.waitForSelector('.review-card');

        assert.equal((await page.$$('.review-total')).length, 5);
        assert.match(await page.$eval('#reviewCenterTab', element => element.textContent), /cannot send email/i);
        assert.match(await page.$eval('.review-card', element => element.textContent), /AI inference/);
        assert.equal(await page.$$eval('.review-card img, .review-card script', elements => elements.length), 0);
        assert.equal(
            await page.$eval('.review-card a', anchor => anchor.href),
            'https://synthetic.example/project'
        );

        await page.click('[data-review-decision="approve"]');
        assert.equal(await page.$eval('#reviewDecisionModal', modal => modal.style.display), 'flex');
        await page.click('[data-close-review-decision]');
        assert.equal(await page.$eval('#reviewDecisionModal', modal => modal.style.display), 'none');

        await page.click('[data-review-decision="approve"]');
        await page.type('#reviewDecisionReason', 'Reviewed the cited public source.');
        await page.$eval('#reviewDecisionForm', form => form.requestSubmit());
        await page.waitForFunction(() => (
            document.querySelector('.review-badge.approved')?.textContent.includes('approved')
        ));

        assert.deepEqual(reviewRequest.body, {
            entityType: 'opportunity',
            entityId: 'opportunity-1',
            decision: 'approve',
            reason: 'Reviewed the cited public source.'
        });
        assert.match(reviewRequest.headers['idempotency-key'], /^admin-review:opportunity:opportunity-1:approve:/);

        await page.click('[data-review-view="agents"]');
        assert.match(await page.$eval('#reviewList', element => element.textContent), /DEV Research Agent/);
        assert.match(await page.$eval('#reviewList', element => element.textContent), /opportunity\.create/);

        await page.click('[data-review-view="audit"]');
        assert.match(await page.$eval('#reviewList', element => element.textContent), /opportunity\.create/);
        assert.equal(externalActionRequests.length, 0);

        console.log('PASS: Admin safely reviews AI records, preserves evidence, and exposes no send action');
    } finally {
        await browser.close();
    }
}

run().catch(error => {
    console.error(error);
    process.exitCode = 1;
});
