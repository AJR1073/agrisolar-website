const { onRequest } = require('firebase-functions/v2/https');
const { onValueCreated } = require('firebase-functions/v2/database');
const admin = require('firebase-admin');
const nodemailer = require('nodemailer');

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

exports.sendEmailOnNewContactSubmission = onValueCreated(
    {
        ref: '/contact_submissions/{submissionId}',
        region: 'us-central1',
        memory: '256MiB',
        secrets: ['NAMECHEAP_PASSWORD']
    },
    async (event) => {
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
