const fs = require('node:fs');
const path = require('node:path');
const {
    assertFails,
    assertSucceeds,
    initializeTestEnvironment
} = require('@firebase/rules-unit-testing');
const {
    get,
    ref,
    remove,
    set,
    update
} = require('firebase/database');

const projectId = 'agrisolar-website';
const adminEmail = 'aaronreifschneider@outlook.com';
let testEnv;

function validSubmission(overrides = {}) {
    return {
        name: 'Test Contact',
        company: 'Test Company',
        email: 'contact@example.com',
        phone: '618-555-0100',
        siteLocation: 'Belleville, Illinois',
        acreage: '100',
        service: 'Commercial Mowing',
        schedule: 'Spring',
        message: 'Please provide information about a mowing scope.',
        timestamp: Date.now(),
        status: 'new',
        viewed: false,
        ...overrides
    };
}

function validAttachments(overrides = {}) {
    return [
        {
            name: 'site-condition.jpg',
            contentType: 'image/jpeg',
            size: 2048,
            path: 'quote-attachments/new-request/attachment1234567890',
            ...overrides
        }
    ];
}

function attachmentSet(submissionId, count) {
    return Array.from({ length: count }, (_, index) => ({
        name: `site-condition-${index + 1}.jpg`,
        contentType: 'image/jpeg',
        size: 1024,
        path: `quote-attachments/${submissionId}/attachment-${index}-1234567890`
    }));
}

function validCompany(overrides = {}) {
    return {
        name: 'Example Solar Company',
        createdAt: Date.now(),
        updatedAt: Date.now(),
        administratorUid: 'approved-admin',
        ...overrides
    };
}

function validSolarSite(overrides = {}) {
    return {
        companyId: 'company-1',
        name: 'Example Solar Site',
        location: 'Example County, Illinois',
        acreage: 40,
        targetVegetationHeight: '',
        active: true,
        createdAt: Date.now(),
        updatedAt: Date.now(),
        administratorUid: 'approved-admin',
        ...overrides
    };
}

function validServiceSeason(overrides = {}) {
    return {
        serviceYear: 2026,
        companyId: 'company-1',
        solarSiteId: 'site-1',
        plannedMowingCycles: 4,
        plannedOtherServices: '',
        contractAcreage: 40,
        targetVegetationHeight: '',
        contractStatus: 'Active',
        renewalStatus: 'Not reviewed',
        renewalNotes: '',
        createdAt: Date.now(),
        updatedAt: Date.now(),
        administratorUid: 'approved-admin',
        ...overrides
    };
}

function validScheduledService(overrides = {}) {
    return {
        serviceSeasonId: 'season-1',
        serviceYear: 2026,
        companyId: 'company-1',
        solarSiteId: 'site-1',
        mowingCycleNumber: 1,
        serviceType: 'Commercial mowing',
        status: 'Scheduling needed',
        siteAcreage: 40,
        estimatedAcresToService: 40,
        actualAcresCompleted: 0,
        targetVegetationHeight: '',
        completionDatePrecision: 'unknown',
        assignedCrew: '',
        assignedEquipment: '',
        reschedulingReason: '',
        completionNotes: '',
        problemsOrHazards: '',
        weatherDelay: false,
        followUpRequired: false,
        readyForInvoicing: false,
        createdAt: Date.now(),
        updatedAt: Date.now(),
        administratorUid: 'approved-admin',
        ...overrides
    };
}

describe('Realtime Database contact submission rules', () => {
    before(async () => {
        testEnv = await initializeTestEnvironment({
            projectId,
            database: {
                rules: fs.readFileSync(
                    path.resolve(__dirname, '../database.rules.json'),
                    'utf8'
                )
            }
        });
    });

    beforeEach(async () => {
        await testEnv.clearDatabase();
    });

    after(async () => {
        await testEnv.cleanup();
    });

    it('allows the public to create a valid new submission', async () => {
        const db = testEnv.unauthenticatedContext().database();
        await assertSucceeds(
            set(ref(db, 'contact_submissions/new-request'), validSubmission())
        );
    });

    it('allows validated attachment metadata on a new submission', async () => {
        const db = testEnv.unauthenticatedContext().database();
        await assertSucceeds(
            set(
                ref(db, 'contact_submissions/new-request'),
                validSubmission({ attachments: validAttachments() })
            )
        );
    });

    it('allows up to ten attachments and rejects an eleventh', async () => {
        const db = testEnv.unauthenticatedContext().database();
        await assertSucceeds(
            set(
                ref(db, 'contact_submissions/new-request'),
                validSubmission({
                    attachments: attachmentSet('new-request', 10)
                })
            )
        );

        await assertFails(
            set(
                ref(db, 'contact_submissions/too-many-attachments'),
                validSubmission({
                    attachments: attachmentSet('too-many-attachments', 11)
                })
            )
        );
    });

    it('rejects invalid or unexpected public fields', async () => {
        const db = testEnv.unauthenticatedContext().database();
        await assertFails(
            set(
                ref(db, 'contact_submissions/invalid-request'),
                validSubmission({ message: 'x'.repeat(2001) })
            )
        );
        await assertFails(
            set(
                ref(db, 'contact_submissions/unexpected-field'),
                validSubmission({ internalNote: 'not allowed' })
            )
        );
        await assertFails(
            set(
                ref(db, 'contact_submissions/new-request'),
                validSubmission({
                    attachments: validAttachments({
                        path: 'quote-attachments/different-request/attachment1234567890'
                    })
                })
            )
        );
    });

    it('prevents public reads, overwrites, and deletes', async () => {
        await testEnv.withSecurityRulesDisabled(async (context) => {
            await set(
                ref(context.database(), 'contact_submissions/existing'),
                validSubmission()
            );
        });

        const db = testEnv.unauthenticatedContext().database();
        const submissionRef = ref(db, 'contact_submissions/existing');
        await assertFails(get(submissionRef));
        await assertFails(set(submissionRef, validSubmission({ name: 'Overwrite' })));
        await assertFails(remove(submissionRef));
    });

    it('allows only the approved administrator to read and update', async () => {
        await testEnv.withSecurityRulesDisabled(async (context) => {
            await set(
                ref(context.database(), 'contact_submissions/existing'),
                validSubmission()
            );
        });

        const approvedDb = testEnv
            .authenticatedContext('approved-admin', { email: adminEmail })
            .database();
        const otherDb = testEnv
            .authenticatedContext('other-user', { email: 'other@example.com' })
            .database();

        await assertSucceeds(
            get(ref(approvedDb, 'contact_submissions/existing'))
        );
        await assertSucceeds(
            update(ref(approvedDb, 'contact_submissions/existing'), {
                status: 'viewed',
                viewed: true
            })
        );
        await assertFails(get(ref(otherDb, 'contact_submissions/existing')));
        await assertFails(
            update(ref(otherDb, 'contact_submissions/existing'), {
                status: 'viewed',
                viewed: true
            })
        );
    });

    it('allows the approved administrator to create normalized schedule records', async () => {
        const approvedDb = testEnv
            .authenticatedContext('approved-admin', { email: adminEmail })
            .database();

        await assertSucceeds(
            update(ref(approvedDb), {
                'companies/company-1': validCompany(),
                'solar_sites/site-1': validSolarSite(),
                'service_seasons/season-1': validServiceSeason(),
                'scheduled_services/service-1': validScheduledService()
            })
        );
        await assertSucceeds(get(ref(approvedDb, 'scheduled_services/service-1')));
    });

    it('keeps operational schedule data private from public and unapproved users', async () => {
        await testEnv.withSecurityRulesDisabled(async (context) => {
            await set(
                ref(context.database(), 'scheduled_services/private-service'),
                validScheduledService()
            );
        });

        const publicDb = testEnv.unauthenticatedContext().database();
        const otherDb = testEnv
            .authenticatedContext('other-user', { email: 'other@example.com' })
            .database();

        await assertFails(
            get(ref(publicDb, 'scheduled_services/private-service'))
        );
        await assertFails(
            set(
                ref(publicDb, 'scheduled_services/public-service'),
                validScheduledService({ administratorUid: 'public-user' })
            )
        );
        await assertFails(
            get(ref(otherDb, 'scheduled_services/private-service'))
        );
        await assertFails(
            set(
                ref(otherDb, 'solar_sites/unapproved-site'),
                validSolarSite({ administratorUid: 'other-user' })
            )
        );
    });

    it('preserves exact and month-only completion values separately', async () => {
        const approvedDb = testEnv
            .authenticatedContext('approved-admin', { email: adminEmail })
            .database();

        await assertSucceeds(
            set(
                ref(approvedDb, 'scheduled_services/month-only'),
                validScheduledService({
                    status: 'Completed',
                    completionDatePrecision: 'month_only',
                    completionMonth: '2026-06',
                    actualAcresCompleted: 40
                })
            )
        );
        await assertSucceeds(
            set(
                ref(approvedDb, 'scheduled_services/exact-date'),
                validScheduledService({
                    status: 'Completed',
                    completionDatePrecision: 'exact_date',
                    completionMonth: '2026-07',
                    completedOn: '2026-07-01',
                    actualAcresCompleted: 40,
                    readyForInvoicing: true
                })
            )
        );
        await assertFails(
            set(
                ref(approvedDb, 'scheduled_services/invented-day-shape'),
                validScheduledService({
                    status: 'Completed',
                    completionDatePrecision: 'month_only',
                    completionMonth: '2026-06',
                    completedOn: '2026-06-01'
                })
            )
        );
    });

    it('rejects invalid schedule statuses, fixed mow columns, and premature invoicing', async () => {
        const approvedDb = testEnv
            .authenticatedContext('approved-admin', { email: adminEmail })
            .database();

        await assertFails(
            set(
                ref(approvedDb, 'scheduled_services/invalid-status'),
                validScheduledService({ status: 'Done' })
            )
        );
        await assertFails(
            set(
                ref(approvedDb, 'scheduled_services/fixed-columns'),
                validScheduledService({ mow1: '2026-06-24' })
            )
        );
        await assertFails(
            set(
                ref(approvedDb, 'scheduled_services/not-completed'),
                validScheduledService({ readyForInvoicing: true })
            )
        );
    });

    it('prevents deletion of permanent sites and schedule history', async () => {
        const approvedDb = testEnv
            .authenticatedContext('approved-admin', { email: adminEmail })
            .database();

        await assertSucceeds(
            set(ref(approvedDb, 'solar_sites/permanent-site'), validSolarSite())
        );
        await assertSucceeds(
            set(
                ref(approvedDb, 'scheduled_services/preserved-service'),
                validScheduledService()
            )
        );
        await assertFails(remove(ref(approvedDb, 'solar_sites/permanent-site')));
        await assertFails(
            remove(ref(approvedDb, 'scheduled_services/preserved-service'))
        );
    });
});
