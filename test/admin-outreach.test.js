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
        await page.setViewport({ width: 1440, height: 1000 });
        page.on('pageerror', error => console.error('Browser page error:', error.message));
        await page.setRequestInterception(true);
        page.on('request', request => {
            if (request.url().includes('firebase-app.js')) {
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
                                    }
                                },
                                suppression_entries: {}
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
        assert.match(
            await page.$eval('#outreachTab', element => element.textContent),
            /AI discovery and drafting are not connected yet/
        );
        assert.match(
            await page.$eval('.outreach-card', element => element.textContent),
            /Synthetic <img src=x onerror=alert\(1\)> Solar/
        );
        assert.equal(
            await page.$$eval('.outreach-card img, .outreach-card script', elements => elements.length),
            0
        );

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
        assert.equal(await page.evaluate(() => window.__outreachUpdates.length), 0);
        assert.equal(
            await page.$eval('#prospectModal', modal => modal.style.display),
            'block'
        );

        await page.$eval('#prospectCompany', input => { input.value = 'Second Synthetic Solar'; });
        await page.$eval('#prospectWebsite', input => { input.value = 'https://second.example.org'; });
        await page.$eval('#prospectForm', form => form.requestSubmit());
        await page.waitForFunction(() => window.__outreachUpdates.length === 1);

        const createUpdate = await page.evaluate(() => window.__outreachUpdates[0]);
        const prospectPath = Object.keys(createUpdate).find(path => path.startsWith('prospect_candidates/'));
        const sourcePath = Object.keys(createUpdate).find(path => path.startsWith('prospect_sources/'));
        assert.ok(prospectPath);
        assert.ok(sourcePath);
        assert.equal(createUpdate[prospectPath].verificationStatus, 'Needs review');
        assert.equal(createUpdate[prospectPath].suppressed, false);
        assert.equal(createUpdate[sourcePath].url, 'https://example.com/duplicate');

        await page.click('[data-outreach-action="verify"][data-prospect-id="prospect1"]');
        await page.waitForFunction(() => window.__outreachUpdates.length === 2);
        const verifyUpdate = await page.evaluate(() => window.__outreachUpdates[1]);
        assert.equal(
            verifyUpdate['prospect_candidates/prospect1/verificationStatus'],
            'Verified'
        );

        page.once('dialog', dialog => dialog.accept());
        await page.click('[data-outreach-action="suppress"][data-prospect-id="prospect1"]');
        await page.waitForFunction(() => window.__outreachUpdates.length === 3);
        const suppressionUpdate = await page.evaluate(() => window.__outreachUpdates[2]);
        assert.equal(suppressionUpdate['prospect_candidates/prospect1/suppressed'], true);
        assert.ok(
            Object.keys(suppressionUpdate).some(path => path.startsWith('suppression_entries/'))
        );

        console.log('PASS: Outreach safely renders, blocks duplicates, saves evidence, reviews, and suppresses candidates');
    } finally {
        await browser.close();
    }
}

run().catch(error => {
    console.error(error);
    process.exitCode = 1;
});
