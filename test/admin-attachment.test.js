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
        await page.setRequestInterception(true);
        page.on('request', (request) => {
            if (request.url().includes('firebase-app.js')) {
                request.respond({
                    contentType: 'application/javascript',
                    body: `
                        window.__sampleSubmission = {
                            name: '<script>unsafe</script>',
                            company: 'Test Solar',
                            email: 'contact@example.com',
                            phone: '618-555-0100',
                            siteLocation: 'Belleville, Illinois',
                            acreage: '50',
                            service: 'Commercial Mowing',
                            schedule: 'Spring',
                            message: '<img src=x onerror=alert(1)>',
                            timestamp: 1700000000000,
                            status: 'new',
                            viewed: false,
                            attachments: [{
                                name: 'site-condition.jpg',
                                contentType: 'image/jpeg',
                                size: 2048,
                                path: 'quote-attachments/submission1234567890/attachment1234567890'
                            }]
                        };
                        const user = {
                            email: 'aaronreifschneider@outlook.com',
                            async getIdToken() { return 'test-token'; }
                        };
                        window.firebase = {
                            apps: [],
                            initializeApp(config) { this.apps.push(config); },
                            auth() {
                                return {
                                    currentUser: user,
                                    onAuthStateChanged(callback) {
                                        setTimeout(() => callback(user), 0);
                                    },
                                    async signInWithEmailAndPassword() {},
                                    async sendPasswordResetEmail() {},
                                    async signOut() {}
                                };
                            },
                            database() {
                                return {
                                    ref(path) {
                                        return {
                                            async once() {
                                                let value = {};
                                                if (path === 'contact_submissions') {
                                                    value = {
                                                        submission1234567890:
                                                            window.__sampleSubmission
                                                    };
                                                } else if (
                                                    path ===
                                                    'contact_submissions/submission1234567890'
                                                ) {
                                                    value = window.__sampleSubmission;
                                                }
                                                return {
                                                    val() { return value; },
                                                    exists() { return Boolean(value); },
                                                    ref: { async update() {} }
                                                };
                                            },
                                            async update() {},
                                            async remove() {},
                                            async push() {}
                                        };
                                    }
                                };
                            },
                            functions() { return {}; },
                            storage() {
                                return {
                                    ref() {
                                        return {
                                            async getDownloadURL() {
                                                return 'about:blank';
                                            }
                                        };
                                    }
                                };
                            }
                        };
                    `
                });
            } else if (request.url().includes('gstatic.com/firebasejs/')) {
                request.respond({
                    contentType: 'application/javascript',
                    body: ''
                });
            } else {
                request.continue();
            }
        });

        await page.goto(`${hostingBase}/admin/`, {
            waitUntil: 'domcontentloaded'
        });
        await page.waitForSelector('.attachment-button');

        const dashboard = await page.$eval(
            '#dashboardContainer',
            (element) => getComputedStyle(element).display
        );
        const attachmentText = await page.$eval(
            '.attachment-button',
            (element) => element.textContent
        );
        const injectedElements = await page.$$eval(
            '.submission-content script, .submission-content img',
            (elements) => elements.length
        );
        assert.notEqual(dashboard, 'none');
        assert.match(attachmentText, /site-condition\.jpg/);
        assert.equal(injectedElements, 0);

        await page.click('button[data-action="reply"]');
        await page.waitForFunction(() => (
            document.querySelector('#replyModal')?.style.display === 'block'
        ));
        const replyAttachment = await page.$eval(
            '#replyAttachments',
            (element) => element.textContent
        );
        assert.match(replyAttachment, /site-condition\.jpg/);

        console.log(
            'PASS: Admin safely renders attachments in requests and the reply view'
        );
    } finally {
        await browser.close();
    }
}

run().catch((error) => {
    console.error(error);
    process.exitCode = 1;
});
