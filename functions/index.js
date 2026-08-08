const { onRequest } = require('firebase-functions/v2/https');
const { onValueCreated } = require('firebase-functions/v2/database');
const crypto = require('node:crypto');
const admin = require('firebase-admin');
const nodemailer = require('nodemailer');
const {
    AiOutreachError,
    discoverProspectsWithOpenAI,
    draftOutreachWithOpenAI
} = require('./ai-outreach');
const { createBusinessApi } = require('./business-api');
const { createMcpHandler } = require('./mcp-server');

admin.initializeApp();

const SMTP_SENDER = 'aaron@agrisolarllc.com';
const ADMIN_EMAIL = 'aaronreifschneider@outlook.com';
const NOTIFICATION_EMAIL = process.env.NOTIFICATION_EMAIL || SMTP_SENDER;
const MAX_ATTACHMENT_COUNT = 10;
const MAX_ATTACHMENT_SIZE = 5 * 1024 * 1024;
const MAX_EMAIL_ATTACHMENT_SIZE = 15 * 1024 * 1024;
const ALLOWED_ATTACHMENT_TYPES = new Set([
    'application/pdf',
    'image/jpeg',
    'image/png',
    'image/webp'
]);
const allowedOrigins = [
    /^https:\/\/agrisolarllc\.com$/,
    /^https:\/\/www\.agrisolarllc\.com$/,
    /^https:\/\/agrisolar-website\.web\.app$/,
    /^https:\/\/agrisolar-website\.firebaseapp\.com$/,
    /^https:\/\/agrisolar-website--[a-z0-9-]+\.web\.app$/,
    /^http:\/\/localhost:\d+$/,
    /^http:\/\/127\.0\.0\.1:\d+$/
];

function emulatorExternalCallsAllowed(flagName) {
    return process.env.FUNCTIONS_EMULATOR !== 'true'
        || process.env[flagName] === 'true';
}

function createTransporter() {
    if (!process.env.NAMECHEAP_PASSWORD) {
        throw new Error('SMTP credentials are unavailable.');
    }

    return nodemailer.createTransport({
        host: 'agrisolarllc.com',
        port: 465,
        secure: true,
        auth: {
            type: 'LOGIN',
            user: SMTP_SENDER,
            pass: process.env.NAMECHEAP_PASSWORD
        }
    });
}

function cleanString(value, maxLength) {
    return typeof value === 'string' ? value.trim().slice(0, maxLength) : '';
}

function normalizeAttachments(value, submissionId) {
    const attachments = Array.isArray(value?.attachments)
        ? value.attachments
        : Object.values(value?.attachments || {});
    const expectedPrefix = `quote-attachments/${submissionId}/`;

    return attachments
        .slice(0, MAX_ATTACHMENT_COUNT)
        .map((attachment) => ({
            name: cleanString(attachment?.name, 140),
            contentType: cleanString(attachment?.contentType, 80),
            size: Number(attachment?.size),
            path: cleanString(attachment?.path, 300)
        }))
        .filter((attachment) => (
            attachment.name &&
            ALLOWED_ATTACHMENT_TYPES.has(attachment.contentType) &&
            Number.isInteger(attachment.size) &&
            attachment.size > 0 &&
            attachment.size <= MAX_ATTACHMENT_SIZE &&
            attachment.path.startsWith(expectedPrefix) &&
            /^quote-attachments\/[A-Za-z0-9_-]{10,64}\/[A-Za-z0-9_-]{10,80}$/.test(
                attachment.path
            )
        ));
}

function normalizeSubmission(value, submissionId = '') {
    return {
        name: cleanString(value?.name, 100),
        company: cleanString(value?.company, 120),
        email: cleanString(value?.email, 254).toLowerCase(),
        phone: cleanString(value?.phone, 30),
        siteLocation: cleanString(value?.siteLocation, 160),
        acreage: cleanString(value?.acreage, 50),
        service: cleanString(value?.service, 80),
        schedule: cleanString(value?.schedule, 100),
        message: cleanString(value?.message, 2000),
        attachments: normalizeAttachments(value, submissionId)
    };
}

function safeAttachmentFilename(name) {
    return name
        .replace(/[\u0000-\u001f\u007f/\\]/g, '_')
        .slice(0, 140);
}

async function loadEmailAttachments(attachments) {
    const bucket = admin.storage().bucket();
    const emailAttachments = [];
    const unavailable = [];
    let includedSize = 0;

    for (const attachment of attachments) {
        try {
            const file = bucket.file(attachment.path);
            const [metadata] = await file.getMetadata();
            const storedSize = Number(metadata.size);
            const storedType = metadata.contentType || '';

            if (
                storedSize !== attachment.size ||
                storedSize > MAX_ATTACHMENT_SIZE ||
                storedType !== attachment.contentType ||
                !ALLOWED_ATTACHMENT_TYPES.has(storedType)
            ) {
                throw new Error('Stored attachment metadata did not match.');
            }

            if (includedSize + storedSize > MAX_EMAIL_ATTACHMENT_SIZE) {
                unavailable.push(attachment.name);
                continue;
            }

            const [content] = await file.download();
            emailAttachments.push({
                filename: safeAttachmentFilename(attachment.name),
                content,
                contentType: storedType
            });
            includedSize += storedSize;
        } catch (error) {
            unavailable.push(attachment.name);
        }
    }

    return { emailAttachments, unavailable };
}

function isValidSubmission(submission) {
    return Boolean(
        submission.name &&
        /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(submission.email) &&
        submission.siteLocation &&
        submission.service &&
        submission.message
    );
}

function setCorsHeaders(req, res) {
    const origin = req.get('origin');
    if (origin && allowedOrigins.some((pattern) => pattern.test(origin))) {
        res.set('Access-Control-Allow-Origin', origin);
        res.set('Vary', 'Origin');
        res.set('Access-Control-Allow-Headers', 'Authorization, Content-Type');
        res.set('Access-Control-Allow-Methods', 'POST, OPTIONS');
        return true;
    }

    return !origin;
}

function prepareAuthenticatedPost(req, res) {
    if (!setCorsHeaders(req, res)) {
        res.status(403).json({ error: 'Origin not allowed.' });
        return false;
    }
    if (req.method === 'OPTIONS') {
        res.status(204).send('');
        return false;
    }
    if (req.method !== 'POST') {
        res.status(405).json({ error: 'Method not allowed.' });
        return false;
    }
    return true;
}

async function requireAdministrator(req) {
    const authHeader = req.get('authorization') || '';
    if (!authHeader.startsWith('Bearer ')) {
        throw new AiOutreachError('Authentication required.', 401, 'authentication_required');
    }
    let decodedToken;
    try {
        decodedToken = await admin.auth().verifyIdToken(authHeader.slice(7));
    } catch {
        throw new AiOutreachError('Authentication required.', 401, 'authentication_required');
    }
    if (decodedToken.email !== ADMIN_EMAIL) {
        throw new AiOutreachError('Administrator access required.', 403, 'administrator_required');
    }
    return decodedToken;
}

async function requireAiOutreachEnabled() {
    const snapshot = await admin.database().ref('/ai_settings/outreachEnabled').once('value');
    if (snapshot.exists() && snapshot.val() === false) {
        throw new AiOutreachError(
            'AI outreach is paused by the administrator.',
            503,
            'ai_paused'
        );
    }
}

async function reserveAiUsage(uid, kind, dailyLimit) {
    const day = new Date().toISOString().slice(0, 10);
    const ref = admin.database().ref(`/ai_usage/${uid}/${day}/${kind}`);
    const transaction = await ref.transaction((current) => {
        const count = Number(current?.count) || 0;
        if (count >= dailyLimit) return;
        return {
            count: count + 1,
            updatedAt: Date.now(),
            administratorUid: uid
        };
    }, undefined, false);
    if (!transaction.committed) {
        throw new AiOutreachError(
            'The daily AI usage limit has been reached.',
            429,
            'daily_limit_reached'
        );
    }
}

function sendAiError(res, error) {
    if (error instanceof AiOutreachError) {
        res.status(error.status).json({ error: error.message, code: error.code });
        return;
    }
    console.error('AI outreach request failed.', error?.message || error);
    res.status(500).json({
        error: 'The AI outreach request could not be completed.',
        code: 'ai_outreach_failed'
    });
}

function aiSafetyIdentifier(uid) {
    return crypto.createHash('sha256').update(`agrisolar:${uid}`).digest('hex');
}

async function recordAiCostEvent(kind, cost, administratorUid, relatedRecordId = '') {
    const eventRef = admin.database().ref('/ai_cost_events').push();
    const createdAt = Date.now();
    const event = {
        kind,
        costType: 'estimate',
        estimatedMicroUsd: Number(cost?.estimatedMicroUsd) || 0,
        estimateAvailable: cost?.available === true,
        model: cleanString(cost?.actualModel, 100),
        pricingModel: cleanString(cost?.pricingModel, 100),
        pricingVersion: cleanString(cost?.pricingVersion, 100),
        inputTokens: Number(cost?.inputTokens) || 0,
        cachedInputTokens: Number(cost?.cachedInputTokens) || 0,
        cacheWriteTokens: Number(cost?.cacheWriteTokens) || 0,
        outputTokens: Number(cost?.outputTokens) || 0,
        webSearchCalls: Number(cost?.webSearchCalls) || 0,
        relatedRecordId: cleanString(relatedRecordId, 100),
        createdAt,
        administratorUid
    };
    await eventRef.set(event);
    return { id: eventRef.key, ...event };
}

exports.sendEmailOnNewContactSubmission = onValueCreated(
    {
        ref: '/contact_submissions/{submissionId}',
        region: 'us-central1',
        memory: '256MiB',
        secrets: ['NAMECHEAP_PASSWORD']
    },
    async (event) => {
        if (!emulatorExternalCallsAllowed('ALLOW_EMULATOR_EMAIL')) {
            console.info('Contact notification skipped in the Firebase emulator.');
            return;
        }
        const submission = normalizeSubmission(
            event.data.val(),
            event.params.submissionId
        );
        if (!isValidSubmission(submission)) {
            console.warn('Contact notification skipped because required fields were invalid.');
            return;
        }

        const { emailAttachments, unavailable } = await loadEmailAttachments(
            submission.attachments
        );
        const attachmentSummary = submission.attachments.length
            ? submission.attachments.map((attachment) => (
                `- ${attachment.name} (${Math.ceil(attachment.size / 1024)} KB)`
            ))
            : ['None'];
        const text = [
            'A new quote request was submitted through agrisolarllc.com.',
            '',
            `Name: ${submission.name}`,
            `Company: ${submission.company || 'Not provided'}`,
            `Email: ${submission.email}`,
            `Phone: ${submission.phone || 'Not provided'}`,
            `Solar-site location: ${submission.siteLocation}`,
            `Approximate acreage: ${submission.acreage || 'Not provided'}`,
            `Service: ${submission.service}`,
            `Desired schedule: ${submission.schedule || 'Not provided'}`,
            '',
            'Project description:',
            submission.message,
            '',
            'Attachments:',
            ...attachmentSummary,
            ...(unavailable.length
                ? ['', `${unavailable.length} attachment(s) could not be included in this email. View the request in the admin dashboard.`]
                : []),
            '',
            'Admin dashboard: https://agrisolar-website.web.app/admin/'
        ].join('\n');

        const transporter = createTransporter();
        await transporter.sendMail({
            from: `AgriSolar LLC <${SMTP_SENDER}>`,
            to: NOTIFICATION_EMAIL,
            replyTo: submission.email,
            subject: `New quote request: ${submission.service}`,
            text,
            attachments: emailAttachments
        });

        console.info('Contact notification email sent.');
    }
);

exports.sendReply = onRequest(
    {
        region: 'us-central1',
        memory: '256MiB',
        secrets: ['NAMECHEAP_PASSWORD']
    },
    async (req, res) => {
        if (!setCorsHeaders(req, res)) {
            res.status(403).json({ error: 'Origin not allowed.' });
            return;
        }

        if (req.method === 'OPTIONS') {
            res.status(204).send('');
            return;
        }

        if (req.method !== 'POST') {
            res.status(405).json({ error: 'Method not allowed.' });
            return;
        }

        const authHeader = req.get('authorization') || '';
        if (!authHeader.startsWith('Bearer ')) {
            res.status(401).json({ error: 'Authentication required.' });
            return;
        }

        try {
            const decodedToken = await admin.auth().verifyIdToken(authHeader.slice(7));
            if (decodedToken.email !== ADMIN_EMAIL) {
                res.status(403).json({ error: 'Not authorized to send replies.' });
                return;
            }
            if (!emulatorExternalCallsAllowed('ALLOW_EMULATOR_EMAIL')) {
                res.status(503).json({
                    error: 'Email sending is disabled in the Firebase emulator.'
                });
                return;
            }

            const submissionId = cleanString(req.body?.submissionId, 128);
            const subject = cleanString(req.body?.subject, 160);
            const message = cleanString(req.body?.message, 5000);
            if (!submissionId || !subject || !message) {
                res.status(400).json({ error: 'Submission, subject, and message are required.' });
                return;
            }

            const snapshot = await admin
                .database()
                .ref(`/contact_submissions/${submissionId}`)
                .once('value');
            const submission = normalizeSubmission(snapshot.val(), submissionId);
            if (!snapshot.exists() || !isValidSubmission(submission)) {
                res.status(404).json({ error: 'Submission not found.' });
                return;
            }

            const transporter = createTransporter();
            await transporter.sendMail({
                from: `AgriSolar LLC <${SMTP_SENDER}>`,
                to: submission.email,
                replyTo: SMTP_SENDER,
                subject,
                text: message
            });

            await snapshot.ref.update({
                replied: true,
                status: 'replied',
                viewed: true
            });

            console.info('Authenticated contact reply sent.');
            res.json({ success: true });
        } catch (error) {
            console.error('Unable to send authenticated contact reply.');
            res.status(500).json({ error: 'Unable to send the reply. Please try again.' });
        }
    }
);

exports.discoverProspects = onRequest(
    {
        region: 'us-central1',
        memory: '512MiB',
        timeoutSeconds: 120,
        secrets: ['OPENAI_API_KEY']
    },
    async (req, res) => {
        if (!prepareAuthenticatedPost(req, res)) return;
        try {
            const administrator = await requireAdministrator(req);
            if (!emulatorExternalCallsAllowed('ALLOW_EMULATOR_OPENAI')) {
                throw new AiOutreachError(
                    'OpenAI calls are disabled in the Firebase emulator.',
                    503,
                    'emulator_external_calls_disabled'
                );
            }
            await requireAiOutreachEnabled();
            await reserveAiUsage(administrator.uid, 'discovery', 20);
            const result = await discoverProspectsWithOpenAI(
                process.env.OPENAI_API_KEY,
                req.body,
                { safetyIdentifier: aiSafetyIdentifier(administrator.uid) }
            );
            let costEvent = null;
            try {
                costEvent = await recordAiCostEvent(
                    'discovery',
                    result.cost,
                    administrator.uid
                );
            } catch (error) {
                console.error('AI discovery cost event could not be saved.', error?.message || error);
            }
            res.json({ ...result, costEvent });
        } catch (error) {
            sendAiError(res, error);
        }
    }
);

exports.draftOutreachEmail = onRequest(
    {
        region: 'us-central1',
        memory: '256MiB',
        timeoutSeconds: 90,
        secrets: ['OPENAI_API_KEY']
    },
    async (req, res) => {
        if (!prepareAuthenticatedPost(req, res)) return;
        try {
            const administrator = await requireAdministrator(req);
            if (!emulatorExternalCallsAllowed('ALLOW_EMULATOR_OPENAI')) {
                throw new AiOutreachError(
                    'OpenAI calls are disabled in the Firebase emulator.',
                    503,
                    'emulator_external_calls_disabled'
                );
            }
            await requireAiOutreachEnabled();
            const prospectId = cleanString(req.body?.prospectId, 80);
            const goal = cleanString(req.body?.goal, 500);
            if (!prospectId) {
                throw new AiOutreachError('A prospect is required.', 400, 'prospect_required');
            }

            const prospectSnapshot = await admin
                .database()
                .ref(`/prospect_candidates/${prospectId}`)
                .once('value');
            const prospect = prospectSnapshot.val();
            if (!prospectSnapshot.exists()) {
                throw new AiOutreachError('Prospect not found.', 404, 'prospect_not_found');
            }
            if (prospect.verificationStatus !== 'Verified') {
                throw new AiOutreachError(
                    'Verify this prospect before drafting outreach.',
                    409,
                    'prospect_not_verified'
                );
            }
            if (prospect.suppressed === true || prospect.outreachStatus === 'Do not contact') {
                throw new AiOutreachError(
                    'Drafting is blocked by the do-not-contact record.',
                    409,
                    'prospect_suppressed'
                );
            }

            const [sourceSnapshot, suppressionSnapshot] = await Promise.all([
                admin.database().ref(`/prospect_sources/${prospect.sourceId}`).once('value'),
                admin.database().ref('/suppression_entries')
                    .orderByChild('prospectId')
                    .equalTo(prospectId)
                    .once('value')
            ]);
            const activeSuppression = Object.values(suppressionSnapshot.val() || {})
                .some((entry) => entry?.active === true);
            if (activeSuppression) {
                throw new AiOutreachError(
                    'Drafting is blocked by the do-not-contact record.',
                    409,
                    'prospect_suppressed'
                );
            }
            if (!sourceSnapshot.exists()) {
                throw new AiOutreachError(
                    'Verified public-source evidence is required.',
                    409,
                    'source_required'
                );
            }

            await reserveAiUsage(administrator.uid, 'drafting', 50);
            const draft = await draftOutreachWithOpenAI(
                process.env.OPENAI_API_KEY,
                prospect,
                sourceSnapshot.val(),
                goal,
                { safetyIdentifier: aiSafetyIdentifier(administrator.uid) }
            );
            let costEvent = null;
            try {
                costEvent = await recordAiCostEvent(
                    'drafting',
                    draft.cost,
                    administrator.uid,
                    prospectId
                );
            } catch (error) {
                console.error('AI drafting cost event could not be saved.', error?.message || error);
            }
            const draftRef = admin.database().ref('/outreach_drafts').push();
            await draftRef.set({
                prospectId,
                sourceId: prospect.sourceId,
                subject: draft.subject,
                body: draft.body,
                personalizationBasis: draft.personalizationBasis,
                claimsToVerify: draft.claimsToVerify,
                status: 'Draft',
                model: draft.model,
                promptVersion: draft.promptVersion,
                costEventId: costEvent?.id || '',
                estimatedMicroUsd: Number(draft.cost?.estimatedMicroUsd) || 0,
                sendingAllowed: false,
                createdAt: admin.database.ServerValue.TIMESTAMP,
                updatedAt: admin.database.ServerValue.TIMESTAMP,
                administratorUid: administrator.uid
            });
            res.json({
                draftId: draftRef.key,
                ...draft,
                costEvent,
                sendingAllowed: false
            });
        } catch (error) {
            sendAiError(res, error);
        }
    }
);

const businessApi = createBusinessApi({
    admin,
    administratorEmail: ADMIN_EMAIL,
    organizationId: 'agrisolar',
    environment: 'DEV'
});

exports.apiV1 = onRequest(
    {
        region: 'us-central1',
        memory: '256MiB',
        timeoutSeconds: 60,
        cors: false
    },
    businessApi.handler
);

exports.mcp = onRequest(
    {
        region: 'us-central1',
        memory: '256MiB',
        timeoutSeconds: 60,
        cors: false
    },
    createMcpHandler({ businessApi })
);
