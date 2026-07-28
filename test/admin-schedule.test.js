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
        page.on('pageerror', error => {
            console.error('Browser page error:', error.message);
        });
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
                            companies: {
                                company1: {
                                    name: 'Example Solar Company'
                                }
                            },
                            solar_sites: {
                                site1: {
                                    companyId: 'company1',
                                    name: 'Example <Site>',
                                    location: 'Example County, Illinois',
                                    acreage: 40
                                }
                            },
                            service_seasons: {
                                season1: {
                                    serviceYear: 2026,
                                    companyId: 'company1',
                                    solarSiteId: 'site1',
                                    contractAcreage: 40,
                                    plannedMowingCycles: 4
                                }
                            },
                            scheduled_services: {
                                service1: {
                                    serviceSeasonId: 'season1',
                                    serviceYear: 2026,
                                    companyId: 'company1',
                                    solarSiteId: 'site1',
                                    mowingCycleNumber: 1,
                                    serviceType: 'Commercial mowing',
                                    status: 'Completed',
                                    siteAcreage: 40,
                                    estimatedAcresToService: 40,
                                    actualAcresCompleted: 40,
                                    completedOn: '2026-06-24',
                                    completionMonth: '2026-06',
                                    completionDatePrecision: 'exact_date',
                                    targetVegetationHeight: '',
                                    assignedCrew: '',
                                    assignedEquipment: '',
                                    reschedulingReason: '',
                                    completionNotes: '',
                                    problemsOrHazards: '',
                                    weatherDelay: false,
                                    followUpRequired: false,
                                    readyForInvoicing: true
                                },
                                service2: {
                                    serviceSeasonId: 'season1',
                                    serviceYear: 2026,
                                    companyId: 'company1',
                                    solarSiteId: 'site1',
                                    mowingCycleNumber: 2,
                                    serviceType: 'Commercial mowing',
                                    status: 'Scheduling needed',
                                    tentativeScheduledOn: '2026-07-15',
                                    siteAcreage: 40,
                                    estimatedAcresToService: 40,
                                    actualAcresCompleted: 0,
                                    completionDatePrecision: 'unknown',
                                    targetVegetationHeight: '',
                                    assignedCrew: '',
                                    assignedEquipment: '',
                                    reschedulingReason: '',
                                    completionNotes: '',
                                    problemsOrHazards: '',
                                    weatherDelay: false,
                                    followUpRequired: false,
                                    readyForInvoicing: false
                                },
                                service3: {
                                    serviceSeasonId: 'season0',
                                    serviceYear: 2025,
                                    companyId: 'company1',
                                    solarSiteId: 'site1',
                                    mowingCycleNumber: 4,
                                    serviceType: 'Commercial mowing',
                                    status: 'Completed',
                                    siteAcreage: 40,
                                    estimatedAcresToService: 40,
                                    actualAcresCompleted: 38,
                                    completionMonth: '2025-09',
                                    completionDatePrecision: 'month_only',
                                    targetVegetationHeight: '',
                                    assignedCrew: '',
                                    assignedEquipment: '',
                                    reschedulingReason: '',
                                    completionNotes: '',
                                    problemsOrHazards: '',
                                    weatherDelay: false,
                                    followUpRequired: false,
                                    readyForInvoicing: false
                                }
                            }
                        };
                        function database() {
                            return {
                                ref(path = '') {
                                    return {
                                        async once() {
                                            const value = data[path] || {};
                                            return { val() { return value; } };
                                        },
                                        push() { return { key: 'generated-key' }; },
                                        async update() {},
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
                                    onAuthStateChanged(callback) {
                                        setTimeout(() => callback(user), 0);
                                    },
                                    async signInWithEmailAndPassword() {},
                                    async sendPasswordResetEmail() {},
                                    async signOut() {}
                                };
                            },
                            database,
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
                        })();
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
        await page.waitForFunction(() => (
            getComputedStyle(document.querySelector('#dashboardContainer')).display !== 'none'
            && Array.from(document.querySelector('#scheduleYear').options)
                .some(option => option.value === '2026')
        ));
        await page.click('[data-tab="schedule"]');
        await page.select('#scheduleYear', '2026');
        await page.waitForSelector('.mowing-cycle-button');

        const totalCards = await page.$$('.schedule-total-card');
        const cycleButtons = await page.$$('.mowing-cycle-button');
        const gridText = await page.$eval(
            '#scheduleGridView',
            element => element.textContent
        );
        const injectedTags = await page.$$eval(
            '#scheduleGridView site, #scheduleGridView script',
            elements => elements.length
        );

        assert.equal(totalCards.length, 7);
        assert.equal(cycleButtons.length, 2);
        assert.match(gridText, /Example <Site>/);
        assert.match(gridText, /Completed Jun 24, 2026/);
        assert.equal(injectedTags, 0);

        await page.click(
            '[data-schedule-action="edit-service"][data-service-id="service1"]'
        );
        await page.waitForFunction(() => (
            document.querySelector('#serviceEditorModal')?.style.display === 'block'
        ));
        assert.equal(
            await page.$eval('#serviceCompletedDate', input => input.value),
            '2026-06-24'
        );
        assert.equal(
            await page.$eval('#serviceCompletionMonth', input => input.value),
            ''
        );

        await page.click(
            '[data-close-schedule-modal="serviceEditorModal"]'
        );
        await page.click('[data-schedule-view="invoicing"]');
        await page.waitForSelector('#scheduleListView .schedule-list-table');
        const invoicingRows = await page.$$eval(
            '#scheduleListView tbody tr',
            rows => rows.length
        );
        assert.equal(invoicingRows, 1);

        await page.click('[data-schedule-view="calendar"]');
        await page.waitForSelector('#scheduleCalendarView .schedule-calendar-event');
        const calendarText = await page.$eval(
            '#scheduleCalendarView',
            element => element.textContent
        );
        assert.match(calendarText, /July/);
        assert.match(calendarText, /Example <Site>/);
        assert.match(calendarText, /Tentative/);

        await page.click('[data-schedule-view="history"]');
        await page.waitForSelector('#scheduleHistoryView .schedule-history-card');
        const historyText = await page.$eval(
            '#scheduleHistoryView',
            element => element.textContent
        );
        const historyEntries = await page.$$eval(
            '#scheduleHistoryView .schedule-history-list li',
            rows => rows.length
        );
        assert.match(historyText, /Jun 24, 2026/);
        assert.match(historyText, /Sep 2025/);
        assert.match(historyText, /Completion month recorded/);
        assert.equal(historyEntries, 2);

        console.log(
            'PASS: Admin schedule renders totals, calendar, all-years history, safe text, and focused views'
        );
    } finally {
        await browser.close();
    }
}

run().catch(error => {
    console.error(error);
    process.exitCode = 1;
});
