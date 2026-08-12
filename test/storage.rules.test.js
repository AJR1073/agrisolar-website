const fs = require('node:fs');
const path = require('node:path');
const {
    assertFails,
    assertSucceeds,
    initializeTestEnvironment
} = require('@firebase/rules-unit-testing');

const projectId = 'agrisolar-website';
const adminUid = 'fWscNuWSoGdWmDIhyjneNqFU0r92';
const validPath =
    'quote-attachments/submission1234567890/attachment1234567890';
let testEnv;

describe('Cloud Storage quote attachment rules', () => {
    before(async () => {
        testEnv = await initializeTestEnvironment({
            projectId,
            storage: {
                rules: fs.readFileSync(
                    path.resolve(__dirname, '../storage.rules'),
                    'utf8'
                )
            }
        });
    });

    beforeEach(async () => {
        await testEnv.clearStorage();
    });

    after(async () => {
        await testEnv.cleanup();
    });

    it('allows a public create for an approved file type and size', async () => {
        const storage = testEnv.unauthenticatedContext().storage();
        await assertSucceeds(
            storage.ref(validPath).put(
                new Uint8Array([255, 216, 255, 217]),
                { contentType: 'image/jpeg' }
            )
        );
    });

    it('rejects unsupported types and invalid attachment paths', async () => {
        const storage = testEnv.unauthenticatedContext().storage();
        await assertFails(
            storage.ref(
                'quote-attachments/submission1234567890/unsupported1234567890'
            ).put(
                new TextEncoder().encode('executable content'),
                { contentType: 'application/octet-stream' }
            )
        );
        await assertFails(
            storage.ref('public/attachment1234567890').put(
                new Uint8Array([1, 2, 3]),
                { contentType: 'image/png' }
            )
        );
    });

    it('prevents public reads, overwrites, and deletes', async () => {
        await testEnv.withSecurityRulesDisabled(async (context) => {
            await context.storage().ref(validPath).put(
                new Uint8Array([1, 2, 3]),
                { contentType: 'image/png' }
            );
        });

        const storageRef = testEnv.unauthenticatedContext().storage().ref(validPath);
        await assertFails(storageRef.getMetadata());
        await assertFails(
            storageRef.put(
                new Uint8Array([4, 5, 6]),
                { contentType: 'image/png' }
            )
        );
        await assertFails(storageRef.delete());
    });

    it('allows only the approved administrator to read files', async () => {
        await testEnv.withSecurityRulesDisabled(async (context) => {
            await context.storage().ref(validPath).put(
                new Uint8Array([1, 2, 3]),
                { contentType: 'application/pdf' }
            );
        });

        const approvedRef = testEnv
            .authenticatedContext(adminUid, { email: 'aaronreifschneider@outlook.com' })
            .storage()
            .ref(validPath);
        const otherRef = testEnv
            .authenticatedContext('other-user', { email: 'other@example.com' })
            .storage()
            .ref(validPath);
        const sameEmailWrongUidRef = testEnv
            .authenticatedContext('email-impostor', {
                email: 'aaronreifschneider@outlook.com'
            })
            .storage()
            .ref(validPath);

        await assertSucceeds(approvedRef.getMetadata());
        await assertFails(otherRef.getMetadata());
        await assertFails(sameEmailWrongUidRef.getMetadata());
    });
});
