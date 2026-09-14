// Mail compatibility entry point for the AgriSolar Firebase functions.
//
// The legacy index.js still contains the old SMTP sender/host constants.
// This wrapper keeps the rest of that file unchanged while forcing all
// Firebase-originated mail through the current info@agrisolarllc.com mailbox.
// Ryan already receives forwarded copies of info@ mail, so new website
// inquiries are addressed to Aaron + Info to avoid sending Ryan duplicates.

const nodemailer = require('nodemailer');

const SMTP_HOST = 'mail.agrisolarllc.com';
const SMTP_SENDER = 'info@agrisolarllc.com';
const WEBSITE_INQUIRY_RECIPIENTS = [
    'aaron@agrisolarllc.com',
    'info@agrisolarllc.com'
];

const originalCreateTransport = nodemailer.createTransport.bind(nodemailer);

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
