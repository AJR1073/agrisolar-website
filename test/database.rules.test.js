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
});
