// Mail compatibility entry point for the AgriSolar Firebase functions.
//
// The legacy index.js still owns the Firebase triggers and reply endpoint.
// This wrapper forces Firebase-originated mail through info@agrisolarllc.com,
// routes website leads to the AgriSolar recipients + connected Outlook inbox,
// and turns raw form notifications into a concise lead summary.

const nodemailer = require('nodemailer');

const SMTP_HOST = 'server265.web-hosting.com';
const SMTP_SENDER = 'info@agrisolarllc.com';
const WEBSITE_INQUIRY_RECIPIENTS = [
    'aaron@agrisolarllc.com',
    'info@agrisolarllc.com',
    'aaronreifschneider@outlook.com'
];

const originalCreateTransport = nodemailer.createTransport.bind(nodemailer);

function clean(value) {
    return String(value || '').trim();
}

function isMissing(value) {
    return !clean(value) || /^(not provided|none|n\/a|na|unknown|don't know|dont know)$/i.test(clean(value));
}

function extractLine(text, label) {
    const escaped = label.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
    const match = String(text || '').match(new RegExp(`^${escaped}:\\s*(.*)$`, 'mi'));
    return clean(match?.[1]);
}

function projectDescription(text) {
    const source = String(text || '');
    const match = source.match(/Project description:\s*([\s\S]*?)(?:\n\nAttachments:|$)/i);
    return clean(match?.[1]);
}

function parseLead(text) {
    const description = projectDescription(text);
    const lines = description.split(/\r?\n/);
    const details = {};
    const noteLines = [];
    let inNotes = false;

    for (const rawLine of lines) {
        const line = clean(rawLine);
        if (!line) {
            if (inNotes && noteLines.length && noteLines[noteLines.length - 1] !== '') {
                noteLines.push('');
            }
            continue;
        }

        const detailMatch = line.match(/^(Facility type|Service frequency|Vegetation condition):\s*(.*)$/i);
        if (detailMatch) {
            const key = detailMatch[1].toLowerCase();
            details[key] = clean(detailMatch[2]);
            continue;
        }

        if (/^Qualification:/i.test(line)) {
            continue;
        }

        if (/^Customer notes:/i.test(line)) {
            inNotes = true;
            const afterLabel = clean(line.replace(/^Customer notes:\s*/i, ''));
            if (afterLabel) noteLines.push(afterLabel);
            continue;
        }

        // Old submissions did not have a Customer notes label. Any remaining
        // description text is treated as the customer's free-form note.
        inNotes = true;
        noteLines.push(line);
    }

    const lead = {
        name: extractLine(text, 'Name'),
        company: extractLine(text, 'Company'),
        email: extractLine(text, 'Email'),
        phone: extractLine(text, 'Phone'),
        siteLocation: extractLine(text, 'Solar-site location'),
        acreage: extractLine(text, 'Approximate acreage'),
        service: extractLine(text, 'Service'),
        schedule: extractLine(text, 'Desired schedule'),
        facilityType: details['facility type'] || '',
        serviceFrequency: details['service frequency'] || '',
        vegetationCondition: details['vegetation condition'] || '',
        notes: clean(noteLines.join('\n').replace(/\n{3,}/g, '\n\n'))
    };

    const missing = [];
    if (isMissing(lead.company)) missing.push('company');
    if (isMissing(lead.phone)) missing.push('phone');
    if (isMissing(lead.siteLocation) || /^test only$/i.test(lead.siteLocation)) missing.push('usable site location');
    if (isMissing(lead.acreage)) missing.push('acreage');
    if (isMissing(lead.schedule)) missing.push('desired schedule');

    return { ...lead, missing };
}

function shown(value) {
    return isMissing(value) ? 'Not provided' : clean(value);
}

function escapeHtml(value) {
    return clean(value)
        .replaceAll('&', '&amp;')
        .replaceAll('<', '&lt;')
        .replaceAll('>', '&gt;')
        .replaceAll('"', '&quot;')
        .replaceAll("'", '&#039;');
}

function buildLeadMessage(rawText) {
    const lead = parseLead(rawText);
    const needsQualification = lead.missing.length > 0;
    const qualification = needsQualification
        ? `NEEDS QUALIFICATION — missing: ${lead.missing.join(', ')}`
        : 'READY FOR REVIEW';

    const subjectParts = [lead.service || 'Website inquiry'];
    if (!isMissing(lead.acreage)) subjectParts.push(`${lead.acreage} acres`);
    if (!isMissing(lead.siteLocation)) subjectParts.push(lead.siteLocation);
    if (needsQualification) subjectParts.push('NEEDS QUALIFICATION');

    const text = [
        'NEW AGRISOLAR WEBSITE LEAD',
        qualification,
        '',
        'CONTACT',
        `Name: ${shown(lead.name)}`,
        `Company: ${shown(lead.company)}`,
        `Email: ${shown(lead.email)}`,
        `Phone: ${shown(lead.phone)}`,
        '',
        'PROJECT',
        `Location: ${shown(lead.siteLocation)}`,
        `Acreage: ${shown(lead.acreage)}`,
        `Facility: ${shown(lead.facilityType)}`,
        `Service: ${shown(lead.service)}`,
        `Frequency: ${shown(lead.serviceFrequency)}`,
        `Vegetation condition: ${shown(lead.vegetationCondition)}`,
        `Desired start / schedule: ${shown(lead.schedule)}`,
        '',
        'CUSTOMER NOTES',
        lead.notes || 'None provided',
        '',
        needsQualification ? `Missing information: ${lead.missing.join(', ')}` : 'No major qualification fields are missing.',
        '',
        'Open in AgriSolar Admin:',
        'https://agrisolar-website.web.app/admin/'
    ].join('\n');

    const row = (label, value) => `<tr><td style="padding:5px 12px 5px 0;color:#66736c;font-weight:600;vertical-align:top">${escapeHtml(label)}</td><td style="padding:5px 0;color:#1f3328">${escapeHtml(shown(value))}</td></tr>`;
    const statusBackground = needsQualification ? '#fff4df' : '#e9f6ee';
    const statusColor = needsQualification ? '#7a4d00' : '#17623b';
    const html = `
        <div style="font-family:Arial,sans-serif;max-width:680px;color:#1f3328;line-height:1.45">
            <h2 style="margin:0 0 10px;color:#174b34">New AgriSolar Website Lead</h2>
            <div style="display:inline-block;margin-bottom:18px;padding:7px 10px;border-radius:5px;background:${statusBackground};color:${statusColor};font-weight:700">${escapeHtml(qualification)}</div>
            <h3 style="margin:0 0 6px;color:#174b34">Contact</h3>
            <table style="border-collapse:collapse;margin-bottom:18px">${row('Name', lead.name)}${row('Company', lead.company)}${row('Email', lead.email)}${row('Phone', lead.phone)}</table>
            <h3 style="margin:0 0 6px;color:#174b34">Project</h3>
            <table style="border-collapse:collapse;margin-bottom:18px">${row('Location', lead.siteLocation)}${row('Acreage', lead.acreage)}${row('Facility', lead.facilityType)}${row('Service', lead.service)}${row('Frequency', lead.serviceFrequency)}${row('Vegetation condition', lead.vegetationCondition)}${row('Desired start / schedule', lead.schedule)}</table>
            <h3 style="margin:0 0 6px;color:#174b34">Customer notes</h3>
            <div style="padding:12px;border-left:4px solid #7bab8c;background:#f6faf7;white-space:pre-wrap">${escapeHtml(lead.notes || 'None provided')}</div>
            ${needsQualification ? `<p style="margin-top:16px"><strong>Missing information:</strong> ${escapeHtml(lead.missing.join(', '))}</p>` : ''}
            <p style="margin-top:20px"><a href="https://agrisolar-website.web.app/admin/" style="color:#087f3f;font-weight:700">Open in AgriSolar Admin →</a></p>
        </div>`;

    return {
        subject: `New quote request: ${subjectParts.join(' | ')}`,
        text,
        html
    };
}

nodemailer.createTransport = (options = {}) => {
    const transporter = originalCreateTransport({
        ...options,
        host: SMTP_HOST,
        port: 465,
        secure: true,
        auth: {
            ...(options.auth || {}),
            type: 'LOGIN',
            user: SMTP_SENDER
        }
    });

    const originalSendMail = transporter.sendMail.bind(transporter);

    transporter.sendMail = (message = {}, callback) => {
        const outgoing = {
            ...message,
            from: `AgriSolar LLC <${SMTP_SENDER}>`
        };

        if (String(outgoing.subject || '').startsWith('New quote request:')) {
            outgoing.to = WEBSITE_INQUIRY_RECIPIENTS;
            const formatted = buildLeadMessage(outgoing.text);
            outgoing.subject = formatted.subject;
            outgoing.text = formatted.text;
            outgoing.html = formatted.html;
            // Keep the customer's address as Reply-To for inquiry notifications.
        } else {
            // Admin replies to customers should come back to the shared Info inbox.
            outgoing.replyTo = SMTP_SENDER;
        }

        return originalSendMail(outgoing, callback);
    };

    return transporter;
};

module.exports = require('./index.js');
