const assert = require('node:assert/strict');
const path = require('node:path');
const puppeteer = require('puppeteer');
const fs = require('node:fs');
const http = require('node:http');

// By default this test owns a local static server and mocks every Firebase SDK request.
// No test form reaches a real database, upload bucket, or email function.
async function localHosting() {
    const root = path.resolve(__dirname, '../dist');
    const types = { '.html': 'text/html', '.js': 'application/javascript', '.css': 'text/css', '.webp': 'image/webp', '.jpg': 'image/jpeg', '.png': 'image/png', '.svg': 'image/svg+xml' };
    const server = http.createServer((req, res) => {
        let file = path.resolve(root, '.' + new URL(req.url, 'http://localhost').pathname);
        if (!file.startsWith(root + path.sep) && file !== root) { res.writeHead(403).end(); return; }
        if (fs.existsSync(file) && fs.statSync(file).isDirectory()) file = path.join(file, 'index.html');
        if (!fs.existsSync(file)) { res.writeHead(404).end(); return; }
        res.writeHead(200, { 'Content-Type': types[path.extname(file)] || 'application/octet-stream' });
        fs.createReadStream(file).pipe(res);
    });
    await new Promise(resolve => server.listen(0, '127.0.0.1', resolve));
    return server;
}

async function run() {
    const server = process.env.HOSTING_BASE ? null : await localHosting();
    const hostingBase = process.env.HOSTING_BASE || `http://127.0.0.1:${server.address().port}`;
    let browser;

    try {
        browser = await puppeteer.launch({
            executablePath: process.env.CHROME_BIN || puppeteer.executablePath(),
            headless: true,
            args: ['--no-sandbox', '--disable-gpu']
        });
        const page = await browser.newPage();
        await page.setRequestInterception(true);
        page.on('request', (request) => {
            if (request.url().includes('/__/firebase/init.js')) {
                request.respond({
                    contentType: 'application/javascript',
                    body: `
                        window.__attachmentTest = { uploaded: [], payload: null, saves: 0, failSave: false };
                        window.firebase = {
                            database() {
                                return {
                                    ref() {
                                        return {
                                            push() {
                                                return {
                                                    key: 'submission1234567890',
                                                    async set(payload) {
                                                        if (window.__attachmentTest.failSave) throw new Error('Simulated write failure');
                                                        window.__attachmentTest.payload = payload;
                                                        window.__attachmentTest.saves += 1;
                                                    }
                                                };
                                            }
                                        };
                                    }
                                };
                            },
                            storage() {
                                return {
                                    ref(path) {
                                        return {
                                            async put(file, metadata) {
                                                window.__attachmentTest.uploaded.push({
                                                    path,
                                                    name: file.name,
                                                    size: file.size,
                                                    type: file.type,
                                                    metadata
                                                });
                                            }
                                        };
                                    }
                                };
                            }
                        };
                        window.firebase.database.ServerValue = {
                            TIMESTAMP: 1700000000000
                        };
                    `
                });
            } else if (request.url().includes('/__/firebase/')) {
                request.respond({
                    contentType: 'application/javascript',
                    body: ''
                });
            } else if (new URL(request.url()).origin !== new URL(hostingBase).origin) {
                // Avoid third-party fonts, CDN assets, and analytics network traffic in CI.
                request.respond({ contentType: 'text/plain', body: '' });
            } else {
                request.continue();
            }
        });

        await page.goto(`${hostingBase}/contact/`, {
            waitUntil: 'domcontentloaded'
        });
        const customerNotes = 'Please review the attached site-condition photograph.'
            .padEnd(2000, 'x');
        await page.type('#contact-name', 'Attachment Test');
        await page.type('#contact-company', 'Example Solar');
        await page.type('#contact-email', 'attachment@example.com');
        await page.type('#contact-phone', '618-555-0100');
        await page.type('#contact-location', 'Belleville, Illinois');
        await page.type('#contact-acreage', '85');
        await page.select('#contact-facility-type', 'Community solar');
        await page.select('#contact-frequency', 'Recurring seasonal service');
        await page.select('#contact-service', 'Commercial Mowing');
        await page.type('#contact-schedule', 'Spring 2027');
        await page.type('#contact-message', customerNotes);

        const fileInput = await page.$('#contact-attachments');
        const attachmentPath = path.resolve(
            __dirname,
            '../images/about-hero.webp'
        );
        await fileInput.uploadFile(...Array(10).fill(attachmentPath));
        await page.$eval('.quote-form', (form) => form.requestSubmit());
        await page.waitForFunction(() => (
            window.__attachmentTest.payload !== null &&
            document.querySelector('.form-status')?.textContent.includes('sent successfully')
        ));

        const result = await page.evaluate(() => window.__attachmentTest);
        const leadCount = () => page.evaluate(() => (window.dataLayer || []).filter(args => args[0] === 'event' && args[1] === 'generate_lead').length);
        assert.equal(await leadCount(), 1, 'Confirmed save emits exactly one lead');
        assert.equal(await page.evaluate(() => window.AgriSolarAnalytics.mode), 'preview');
        assert.equal(result.uploaded.length, 10);
        assert.match(
            result.uploaded[0].path,
            /^quote-attachments\/submission1234567890\/[A-Za-z0-9-]{10,80}$/
        );
        assert.equal(result.uploaded[0].type, 'image/webp');
        assert.equal(result.payload.attachments.length, 10);
        assert.equal(
            result.payload.attachments[0].path,
            result.uploaded[0].path
        );
        assert.equal(result.payload.attachments[0].name, 'about-hero.webp');
        assert.equal(result.payload.qualificationStatus, 'ready');
        assert.deepEqual(result.payload.missingQualificationFields, []);
        assert.equal(result.payload.customerNotes, customerNotes);
        assert.ok(result.payload.message.length > 2000);
        assert.ok(result.payload.message.length <= 3000);
        assert.match(result.payload.message, /^Facility type: Community solar\n/);
        assert.ok(result.payload.message.endsWith(`Customer notes:\n${customerNotes}`));

        console.log(
            'PASS: Complete quote lead stores ready status, ten attachments, and full customer notes'
        );

        await page.goto(`${hostingBase}/contact/`, {
            waitUntil: 'domcontentloaded'
        });
        await page.type('#contact-name', 'Qualification Test');
        await page.type('#contact-email', 'qualification@example.com');
        await page.type('#contact-location', 'Belleville, Illinois');
        await page.select('#contact-facility-type', 'Community solar');
        await page.select('#contact-frequency', 'Unsure');
        await page.select('#contact-service', 'Commercial Mowing');
        await page.type('#contact-message', 'Please help us qualify this site.');
        await page.$eval('.quote-form', (form) => form.requestSubmit());
        await page.waitForFunction(() => (
            window.__attachmentTest.payload?.email === 'qualification@example.com' &&
            document.querySelector('.form-status')?.textContent.includes('sent successfully')
        ));

        const incomplete = await page.evaluate(() => window.__attachmentTest);
        assert.equal(incomplete.payload.qualificationStatus, 'needs_qualification');
        assert.deepEqual(incomplete.payload.missingQualificationFields, [
            'company',
            'phone',
            'acreage',
            'desired schedule'
        ]);
        assert.equal(incomplete.uploaded.length, 0);
        console.log(
            'PASS: Incomplete quote lead stores needs_qualification status and missing fields'
        );
        assert.equal(await leadCount(), 1);

        async function fillQuote() {
            await page.evaluate(() => {
                const values = { name: 'Qualification Test', email: 'qualification@example.com', siteLocation: 'Belleville, Illinois', facilityType: 'Community solar', serviceFrequency: 'Unsure', service: 'Commercial Mowing', message: 'Please help us qualify this site.' };
                for (const [name, value] of Object.entries(values)) document.querySelector(`.quote-form [name="${name}"]`).value = value;
            });
        }
        async function submit() { await page.$eval('.quote-form', form => form.requestSubmit()); }
        await fillQuote();
        await submit();
        await page.waitForFunction(() => document.querySelector('.form-status').textContent.includes('already submitted'));
        assert.equal(await leadCount(), 1, 'Duplicate prevention must not emit another lead');

        await page.goto(`${hostingBase}/contact/`, { waitUntil: 'domcontentloaded' });
        await page.evaluate(() => sessionStorage.clear());
        await fillQuote();
        await page.evaluate(() => { window.__attachmentTest.failSave = true; });
        await submit();
        await page.waitForFunction(() => document.querySelector('.form-recovery').hidden === false);
        assert.equal(await leadCount(), 0, 'Failed saves must not count as leads');

        await page.goto(`${hostingBase}/contact/`, { waitUntil: 'domcontentloaded' });
        await submit();
        assert.equal(await leadCount(), 0, 'Invalid forms must not count as leads');
        await fillQuote();
        await page.$eval('.website-field', field => { field.value = 'spam'; });
        await submit();
        assert.equal(await leadCount(), 0, 'Honeypot responses must not count as leads');
        assert.equal(await page.evaluate(() => window.__attachmentTest.saves), 0);

        await fillQuote();
        await page.evaluate(() => {
            Storage.prototype.getItem = () => { throw new Error('Storage blocked'); };
            Storage.prototype.setItem = () => { throw new Error('Storage blocked'); };
        });
        await submit();
        await page.waitForFunction(() => document.querySelector('.form-status').textContent.includes('sent successfully'));
        assert.equal(await leadCount(), 1, 'Blocked storage must not prevent a saved quote or conversion');
        assert.equal(await page.evaluate(() => window.__attachmentTest.saves), 1);
        console.log('PASS: Leads count only confirmed saves; duplicate, failed, invalid and honeypot submissions do not inflate conversions. Blocked storage does not break quotes.');

        await page.setViewport({ width: 375, height: 812 });
        for (const route of ['/', '/services/', '/contact/']) {
            await page.goto(hostingBase + route, { waitUntil: 'domcontentloaded' });
            assert.ok(await page.evaluate(() => document.documentElement.scrollWidth <= window.innerWidth), `${route}: mobile horizontal overflow`);
        }
        await page.click('.menu-toggle');
        assert.equal(await page.$eval('.menu-toggle', el => el.getAttribute('aria-expanded')), 'true');
        await page.click('.menu-toggle');
        await page.click('a[href="tel:+16185392098"]');
        assert.equal(await page.evaluate(() => window.dataLayer.filter(args => args[0] === 'event' && args[1] === 'contact_click').length), 1);
        console.log('PASS: Public pages fit a mobile viewport, navigation opens, and phone clicks are tracked locally.');
    } finally {
        if (browser) await browser.close();
        if (server) await new Promise(resolve => server.close(resolve));
    }
}

run().catch((error) => {
    console.error(error);
    process.exitCode = 1;
});
