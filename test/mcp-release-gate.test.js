const assert = require('node:assert/strict');
const { validateEvidence } = require('../scripts/verify-mcp-release-gate');

function completeEvidence() {
    return {
        environment: 'DEV',
        endpoint: 'https://agrisolar-website.web.app/mcp',
        deployedCommit: '0123456789abcdef0123456789abcdef01234567',
        deploymentTimestamp: '2026-08-12T03:26:26Z',
        oauthProvider: 'Auth0',
        authenticatedRead: {
            status: 'passed',
            toolName: 'get_sales_pipeline',
            connectionId: 'plugin_asdk_app_example123',
            completedAt: '2026-08-12T04:00:00Z',
            requestId: 'request_read_123',
            agentId: 'agent_dev_123',
            auditEventId: 'audit_read_123',
            organizationId: 'agrisolar'
        },
        confirmedCandidateWrite: {
            status: 'passed',
            toolName: 'submit_opportunity_candidate',
            connectionId: 'plugin_asdk_app_example123',
            completedAt: '2026-08-12T04:05:00Z',
            chatgptWriteConfirmed: true,
            syntheticRecord: true,
            requestId: 'request_write_123',
            opportunityId: 'opportunity_123',
            approvalId: 'approval_123',
            administratorUid: 'administrator_123',
            auditEventIds: ['audit_write_123', 'audit_approval_123'],
            candidateSubmissionSource: 'chatgpt_work',
            initialReviewStatus: 'pending_review',
            finalReviewStatus: 'approved',
            emailSent: false,
            sourceUrl: 'https://example.com/synthetic-dev-source'
        },
        safety: {
            noBusinessFeaturesAdded: true,
            noUnapprovedRecordsAdded: true,
            noEmailSent: true
        }
    };
}

function expectBlocked(update, pattern) {
    const evidence = completeEvidence();
    update(evidence);
    assert.throws(() => validateEvidence(evidence), pattern);
}

const passed = validateEvidence(completeEvidence());
assert.equal(passed.connectionId, 'plugin_asdk_app_example123');

expectBlocked(
    evidence => { evidence.authenticatedRead.status = 'pending'; },
    /read test has not passed/
);
expectBlocked(
    evidence => { evidence.confirmedCandidateWrite.chatgptWriteConfirmed = false; },
    /write confirmation evidence/
);
expectBlocked(
    evidence => { evidence.confirmedCandidateWrite.finalReviewStatus = 'pending_review'; },
    /leave the candidate approved/
);
expectBlocked(
    evidence => { evidence.confirmedCandidateWrite.clientSecret = 'do-not-store-this'; },
    /must not contain a credential or secret/
);

console.log('MCP release-gate evidence validator tests passed.');
