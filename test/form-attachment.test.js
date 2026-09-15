const assert = require('node:assert/strict');
const path = require('node:path');
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
        await page.setRequestInterception(true);
        page.on('request', (request) => {
            if (request.url().includes('/__/firebase/init.js')) {
                request.respond({
                    contentType: 'application/javascript',
                    body: `
                        window.__attachmentTest = { uploaded: [], payload: null };
                        window.firebase = {
                            database() {
                                return {
                                    ref() {
                                        return {
                                            push() {
                                                return {
                                                    key: 'submission1234567890',
                                                    async set(payload) {
                                                        window.__attachmentTest.payload = payload;
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
    } finally {
        await browser.close();
    }
}

run().catch((error) => {
    console.error(error);
    process.exitCode = 1;
});
