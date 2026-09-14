// Mail compatibility entry point for the AgriSolar Firebase functions.
//
// The legacy index.js still contains the old SMTP sender/host constants.
// This wrapper keeps the rest of that file unchanged while forcing all
// Firebase-originated mail through the current info@agrisolarllc.com mailbox.
// Ryan already receives forwarded copies of info@ mail, so new website
// inquiries are addressed to Aaron + Info to avoid sending Ryan duplicates.
// A separate copy also goes to Aaron's connected Outlook inbox so GPT Work
// can monitor website-originated leads immediately.

const nodemailer = require('nodemailer');

// Namecheap recommends using the shared-hosting server hostname for SMTP,
// especially when the website DNS points somewhere other than the mail server.
const SMTP_HOST = 'server265.web-hosting.com';
const SMTP_SENDER = 'info@agrisolarllc.com';
const WEBSITE_INQUIRY_RECIPIENTS = [
    'aaron@agrisolarllc.com',
    'info@agrisolarllc.com',
    'aaronreifschneider@outlook.com'
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
