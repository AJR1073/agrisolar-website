#!/usr/bin/env node

const fs = require('node:fs');
const path = require('node:path');

const EXPECTED_ENDPOINT = 'https://agrisolar-website.web.app/mcp';
const FORBIDDEN_KEY = /(access.?token|refresh.?token|authorization|client.?secret|password|api.?key|cookie)/i;

function isTimestamp(value) {
    return typeof value === 'string' && !Number.isNaN(Date.parse(value));
}

function isId(value) {
    return typeof value === 'string' && /^[A-Za-z0-9_-]{6,160}$/.test(value);
}

function inspectForSecrets(value, location = 'evidence') {
    if (Array.isArray(value)) {
        value.forEach((item, index) => inspectForSecrets(item, `${location}[${index}]`));
        return;
    }
    if (!value || typeof value !== 'object') return;
    for (const [key, item] of Object.entries(value)) {
        if (FORBIDDEN_KEY.test(key)) {
            throw new Error(`${location}.${key} must not contain a credential or secret.`);
        }
        if (typeof item === 'string' && /^Bearer\s+/i.test(item)) {
            throw new Error(`${location}.${key} must not contain a bearer token.`);
        }
        inspectForSecrets(item, `${location}.${key}`);
    }
}

function requireCondition(condition, message) {
    if (!condition) throw new Error(message);
}

function validateEvidence(evidence) {
    requireCondition(evidence && typeof evidence === 'object', 'Evidence must be a JSON object.');
    inspectForSecrets(evidence);

    requireCondition(evidence.environment === 'DEV', 'environment must be DEV.');
    requireCondition(evidence.endpoint === EXPECTED_ENDPOINT, `endpoint must be ${EXPECTED_ENDPOINT}.`);
    requireCondition(
        typeof evidence.deployedCommit === 'string' && /^[0-9a-f]{40}$/.test(evidence.deployedCommit),
        'deployedCommit must be a full 40-character Git SHA.'
    );
    requireCondition(isTimestamp(evidence.deploymentTimestamp), 'deploymentTimestamp is required.');
    requireCondition(evidence.oauthProvider === 'Auth0', 'oauthProvider must be Auth0 for this milestone.');

    const read = evidence.authenticatedRead || {};
    requireCondition(read.status === 'passed', 'Authenticated read test has not passed.');
    requireCondition(read.toolName === 'get_sales_pipeline', 'Authenticated read must use get_sales_pipeline.');
    requireCondition(/^plugin_asdk_app[A-Za-z0-9_-]+$/.test(read.connectionId || ''), 'A ChatGPT plugin connection ID is required.');
    requireCondition(isTimestamp(read.completedAt), 'Authenticated read completion timestamp is required.');
    requireCondition(isId(read.requestId), 'Authenticated read request ID is required.');
    requireCondition(isId(read.agentId), 'Authenticated read agent ID is required.');
    requireCondition(isId(read.auditEventId), 'Authenticated read audit-event ID is required.');
    requireCondition(read.organizationId === 'agrisolar', 'Authenticated read must be organization-scoped to agrisolar.');

    const write = evidence.confirmedCandidateWrite || {};
    requireCondition(write.status === 'passed', 'Confirmed candidate write test has not passed.');
    requireCondition(write.toolName === 'submit_opportunity_candidate', 'Candidate write must use submit_opportunity_candidate.');
    requireCondition(write.connectionId === read.connectionId, 'Both tests must use the same installed ChatGPT plugin connection.');
    requireCondition(isTimestamp(write.completedAt), 'Candidate write completion timestamp is required.');
    requireCondition(write.chatgptWriteConfirmed === true, 'ChatGPT write confirmation evidence is required.');
    requireCondition(write.syntheticRecord === true, 'The candidate must be clearly identified as synthetic DEV data.');
    requireCondition(isId(write.requestId), 'Candidate write request ID is required.');
    requireCondition(isId(write.opportunityId), 'Candidate opportunity ID is required.');
    requireCondition(isId(write.approvalId), 'Administrator approval ID is required.');
    requireCondition(isId(write.administratorUid), 'Approving administrator UID is required.');
    requireCondition(
        Array.isArray(write.auditEventIds)
            && write.auditEventIds.length >= 2
            && write.auditEventIds.every(isId),
        'At least two valid candidate/approval audit-event IDs are required.'
    );
    requireCondition(write.candidateSubmissionSource === 'chatgpt_work', 'Candidate source must be chatgpt_work.');
    requireCondition(write.initialReviewStatus === 'pending_review', 'Candidate must initially be pending_review.');
    requireCondition(write.finalReviewStatus === 'approved', 'Administrator approval must leave the candidate approved.');
    requireCondition(write.emailSent === false, 'The test must confirm that no email was sent.');
    requireCondition(
        typeof write.sourceUrl === 'string' && /^https:\/\//.test(write.sourceUrl),
        'A public HTTPS source URL is required for the synthetic candidate.'
    );

    const safety = evidence.safety || {};
    requireCondition(safety.noBusinessFeaturesAdded === true, 'Safety attestation for no business features is required.');
    requireCondition(safety.noUnapprovedRecordsAdded === true, 'Safety attestation for no unapproved records is required.');
    requireCondition(safety.noEmailSent === true, 'Safety attestation for no email is required.');

    return {
        connectionId: read.connectionId,
        deployedCommit: evidence.deployedCommit,
        readRequestId: read.requestId,
        writeRequestId: write.requestId,
        opportunityId: write.opportunityId,
        approvalId: write.approvalId
    };
}

function main() {
    const evidenceFile = process.env.MCP_RELEASE_EVIDENCE_FILE
        || path.resolve(process.cwd(), '.mcp-e2e-evidence.json');
    if (!fs.existsSync(evidenceFile)) {
        console.error(`MCP RELEASE GATE: BLOCKED\nEvidence file not found: ${evidenceFile}`);
        process.exitCode = 2;
        return;
    }
    try {
        const evidence = JSON.parse(fs.readFileSync(evidenceFile, 'utf8'));
        const result = validateEvidence(evidence);
        console.log('MCP RELEASE GATE: PASSED');
        console.log(JSON.stringify(result, null, 2));
    } catch (error) {
        console.error(`MCP RELEASE GATE: BLOCKED\n${error.message}`);
        process.exitCode = 2;
    }
}

if (require.main === module) main();

module.exports = { EXPECTED_ENDPOINT, validateEvidence };
