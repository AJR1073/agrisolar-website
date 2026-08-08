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
const adminUid = 'fWscNuWSoGdWmDIhyjneNqFU0r92';
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
        administratorUid: 'fWscNuWSoGdWmDIhyjneNqFU0r92',
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
        administratorUid: 'fWscNuWSoGdWmDIhyjneNqFU0r92',
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
        administratorUid: 'fWscNuWSoGdWmDIhyjneNqFU0r92',
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
        administratorUid: 'fWscNuWSoGdWmDIhyjneNqFU0r92',
        ...overrides
    };
}

function validProspectCandidate(overrides = {}) {
    return {
        companyName: 'Synthetic Solar Operations',
        normalizedCompany: 'synthetic solar operations',
        website: 'https://example.com/',
        normalizedDomain: 'example.com',
        location: 'Example County, Illinois',
        contactName: 'Test Contact',
        contactEmail: 'contact@example.com',
        contactPhone: '618-555-0100',
        fitReason: 'Public information indicates utility-scale solar operations.',
        sourceId: 'source-1',
        verificationStatus: 'Needs review',
        outreachStatus: 'Not contacted',
        suppressed: false,
        createdAt: Date.now(),
        updatedAt: Date.now(),
        administratorUid: 'fWscNuWSoGdWmDIhyjneNqFU0r92',
        ...overrides
    };
}

function validProspectSource(overrides = {}) {
    return {
        prospectId: 'prospect-1',
        url: 'https://example.com/solar-project',
        title: 'Synthetic solar project information',
        evidenceSummary: 'The public page describes a synthetic utility-scale solar project.',
        accessedAt: Date.now(),
        createdAt: Date.now(),
        administratorUid: 'fWscNuWSoGdWmDIhyjneNqFU0r92',
        ...overrides
    };
}

function validSuppressionEntry(overrides = {}) {
    return {
        prospectId: 'prospect-1',
        type: 'email',
        value: 'contact@example.com',
        reason: 'Administrator do-not-contact decision',
        active: true,
        createdAt: Date.now(),
        administratorUid: 'fWscNuWSoGdWmDIhyjneNqFU0r92',
        ...overrides
    };
}

function validAiSettings(overrides = {}) {
    return {
        outreachEnabled: true,
        updatedAt: Date.now(),
        administratorUid: 'fWscNuWSoGdWmDIhyjneNqFU0r92',
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
            .authenticatedContext(adminUid, { email: 'aaronreifschneider@outlook.com' })
            .database();
        const otherDb = testEnv
            .authenticatedContext('other-user', { email: 'other@example.com' })
            .database();
        const sameEmailWrongUidDb = testEnv
            .authenticatedContext('email-impostor', {
                email: 'aaronreifschneider@outlook.com'
            })
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
        await assertFails(get(ref(sameEmailWrongUidDb, 'contact_submissions/existing')));
        await assertFails(
            update(ref(otherDb, 'contact_submissions/existing'), {
                status: 'viewed',
                viewed: true
            })
        );
    });

    it('allows the approved administrator to create normalized schedule records', async () => {
        const approvedDb = testEnv
            .authenticatedContext(adminUid, { email: 'aaronreifschneider@outlook.com' })
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
            .authenticatedContext(adminUid, { email: 'aaronreifschneider@outlook.com' })
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
            .authenticatedContext(adminUid, { email: 'aaronreifschneider@outlook.com' })
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
            .authenticatedContext(adminUid, { email: 'aaronreifschneider@outlook.com' })
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

    it('allows the approved administrator to create reviewed prospect evidence atomically', async () => {
        const approvedDb = testEnv
            .authenticatedContext(adminUid, { email: 'aaronreifschneider@outlook.com' })
            .database();

        await assertSucceeds(
            update(ref(approvedDb), {
                'prospect_candidates/prospect-1': validProspectCandidate(),
                'prospect_sources/source-1': validProspectSource()
            })
        );
        await assertSucceeds(get(ref(approvedDb, 'prospect_candidates/prospect-1')));
        await assertSucceeds(get(ref(approvedDb, 'prospect_sources/source-1')));
    });

    it('keeps prospecting data private from public and unapproved users', async () => {
        await testEnv.withSecurityRulesDisabled(async context => {
            await set(
                ref(context.database(), 'prospect_candidates/private-prospect'),
                validProspectCandidate()
            );
        });

        const publicDb = testEnv.unauthenticatedContext().database();
        const otherDb = testEnv
            .authenticatedContext('other-user', { email: 'other@example.com' })
            .database();

        await assertFails(get(ref(publicDb, 'prospect_candidates/private-prospect')));
        await assertFails(
            set(
                ref(publicDb, 'prospect_candidates/public-prospect'),
                validProspectCandidate({ administratorUid: 'public-user' })
            )
        );
        await assertFails(get(ref(otherDb, 'prospect_candidates/private-prospect')));
        await assertFails(
            set(
                ref(otherDb, 'prospect_sources/unapproved-source'),
                validProspectSource({ administratorUid: 'other-user' })
            )
        );
    });

    it('rejects invalid prospect evidence and inconsistent suppression state', async () => {
        const approvedDb = testEnv
            .authenticatedContext(adminUid, { email: 'aaronreifschneider@outlook.com' })
            .database();

        await assertFails(
            set(
                ref(approvedDb, 'prospect_sources/unsafe-source'),
                validProspectSource({ url: 'javascript:alert(1)' })
            )
        );
        await assertFails(
            set(
                ref(approvedDb, 'prospect_sources/empty-evidence'),
                validProspectSource({ evidenceSummary: '' })
            )
        );
        await assertFails(
            set(
                ref(approvedDb, 'prospect_candidates/inconsistent-suppression'),
                validProspectCandidate({ suppressed: true })
            )
        );
        await assertFails(
            set(
                ref(approvedDb, 'suppression_entries/invalid-type'),
                validSuppressionEntry({ type: 'telephone-list' })
            )
        );
    });

    it('preserves prospect evidence and do-not-contact history', async () => {
        const approvedDb = testEnv
            .authenticatedContext(adminUid, { email: 'aaronreifschneider@outlook.com' })
            .database();

        await assertSucceeds(
            update(ref(approvedDb), {
                'prospect_candidates/prospect-1': validProspectCandidate({
                    suppressed: true,
                    outreachStatus: 'Do not contact'
                }),
                'prospect_sources/source-1': validProspectSource(),
                'suppression_entries/suppression-1': validSuppressionEntry()
            })
        );
        await assertFails(remove(ref(approvedDb, 'prospect_candidates/prospect-1')));
        await assertFails(remove(ref(approvedDb, 'prospect_sources/source-1')));
        await assertFails(remove(ref(approvedDb, 'suppression_entries/suppression-1')));
    });

    it('allows only the approved administrator to pause AI outreach', async () => {
        const approvedDb = testEnv
            .authenticatedContext(adminUid, { email: 'aaronreifschneider@outlook.com' })
            .database();
        const otherDb = testEnv
            .authenticatedContext('other-user', { email: 'other@example.com' })
            .database();

        await assertSucceeds(set(ref(approvedDb, 'ai_settings'), validAiSettings()));
        await assertSucceeds(get(ref(approvedDb, 'ai_settings')));
        await assertFails(set(
            ref(otherDb, 'ai_settings'),
            validAiSettings({ administratorUid: 'other-user' })
        ));
        await assertFails(get(ref(otherDb, 'ai_settings')));
    });

    it('keeps generated drafts and AI usage private and server-written', async () => {
        await testEnv.withSecurityRulesDisabled(async context => {
            await set(ref(context.database(), 'outreach_drafts/draft-1'), {
                prospectId: 'prospect-1',
                subject: 'Synthetic draft',
                body: 'Draft body',
                status: 'Draft'
            });
            await set(ref(context.database(), 'ai_usage/fWscNuWSoGdWmDIhyjneNqFU0r92/2026-08-02/discovery'), {
                count: 1
            });
            await set(ref(context.database(), 'ai_cost_events/cost-1'), {
                kind: 'discovery',
                costType: 'actual',
                actualMicroUsd: 470000,
                createdAt: Date.now()
            });
        });

        const approvedDb = testEnv
            .authenticatedContext(adminUid, { email: 'aaronreifschneider@outlook.com' })
            .database();
        const publicDb = testEnv.unauthenticatedContext().database();

        await assertSucceeds(get(ref(approvedDb, 'outreach_drafts/draft-1')));
        await assertSucceeds(get(ref(approvedDb, 'ai_usage')));
        await assertSucceeds(get(ref(approvedDb, 'ai_cost_events/cost-1')));
        await assertFails(get(ref(publicDb, 'outreach_drafts/draft-1')));
        await assertFails(get(ref(publicDb, 'ai_cost_events/cost-1')));
        await assertFails(set(ref(approvedDb, 'outreach_drafts/client-draft'), {
            subject: 'Client write should fail'
        }));
        await assertFails(set(ref(approvedDb, 'ai_usage/fWscNuWSoGdWmDIhyjneNqFU0r92/test'), {
            count: 999
        }));
        await assertFails(set(ref(approvedDb, 'ai_cost_events/client-cost'), {
            actualMicroUsd: 999999999
        }));
    });

    it('keeps API business records server-written and organization data private', async () => {
        await testEnv.withSecurityRulesDisabled(async context => {
            await update(ref(context.database()), {
                'organizations/agrisolar': { name: 'AgriSolar LLC' },
                'agent_identities/dev-agent': {
                    organizationId: 'agrisolar',
                    environment: 'DEV',
                    status: 'active',
                    capabilities: ['opportunity.read']
                },
                'opportunities/opportunity-1': {
                    organizationId: 'agrisolar',
                    status: 'NEW'
                },
                'tasks/task-1': {
                    organizationId: 'agrisolar',
                    status: 'open'
                },
                'audit_events/audit-1': {
                    organizationId: 'agrisolar',
                    action: 'opportunity.create'
                },
                'idempotency_records/agrisolar/key-1': { requestDigest: 'abc' },
                'rate_limit_counters/agrisolar/agent/1/read': { count: 1 }
            });
        });

        const approvedDb = testEnv
            .authenticatedContext(adminUid, { email: 'aaronreifschneider@outlook.com' })
            .database();
        const otherDb = testEnv
            .authenticatedContext('other-user', { email: 'other@example.com' })
            .database();
        const publicDb = testEnv.unauthenticatedContext().database();

        for (const path of [
            'organizations/agrisolar',
            'agent_identities/dev-agent',
            'opportunities/opportunity-1',
            'tasks/task-1',
            'audit_events/audit-1'
        ]) {
            await assertSucceeds(get(ref(approvedDb, path)));
            await assertFails(get(ref(otherDb, path)));
            await assertFails(get(ref(publicDb, path)));
            await assertFails(set(ref(approvedDb, path), { clientWrite: true }));
        }

        await assertFails(get(ref(approvedDb, 'idempotency_records/agrisolar/key-1')));
        await assertFails(get(ref(approvedDb, 'rate_limit_counters/agrisolar')));
        await assertFails(set(
            ref(approvedDb, 'idempotency_records/agrisolar/client-write'),
            { requestDigest: 'not-allowed' }
        ));
    });
});
