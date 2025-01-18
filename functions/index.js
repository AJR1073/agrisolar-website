const functions = require('firebase-functions');
const admin = require('firebase-admin');
const nodemailer = require('nodemailer');

admin.initializeApp();

// Create a transporter using Outlook SMTP
const transporter = nodemailer.createTransport({
    host: 'smtp-mail.outlook.com',
    port: 587,
    secure: false,
    auth: {
        user: functions.config().email.user,
        pass: functions.config().email.pass
    },
    tls: {
        ciphers: 'SSLv3'
    }
});

// Function to format the email content
function formatEmailContent(data) {
    return `
        New Contact Form Submission

        Name: ${data.name}
        Email: ${data.email}
        Phone: ${data.phone || 'Not provided'}
        Service: ${data.service}
        Message: ${data.message}

        Submitted at: ${new Date(data.timestamp).toLocaleString()}
    `;
}

// Cloud function to handle new submissions
exports.handleSubmission = functions.database
    .ref('/contact_submissions/{submissionId}')
    .onCreate(async (snapshot, context) => {
        const data = snapshot.val();
        const submissionId = context.params.submissionId;
        
        try {
            // Add metadata to the submission
            await admin.database().ref(`contact_submissions/${submissionId}`).update({
                status: 'new',
                submissionTime: admin.database.ServerValue.TIMESTAMP,
                viewed: false
            });

            // Send email to business owner
            const ownerMailOptions = {
                from: `AgriSolar LLC Website <${functions.config().email.user}>`,
                to: functions.config().email.user,
                subject: `New Contact Form Submission from ${data.name}`,
                text: formatEmailContent({ ...data, timestamp: Date.now() })
            };

            // Send confirmation email to customer
            const customerMailOptions = {
                from: `AgriSolar LLC <${functions.config().email.user}>`,
                to: data.email,
                subject: 'Thank you for contacting AgriSolar LLC',
                text: `
Dear ${data.name},

Thank you for contacting AgriSolar LLC. We have received your message and will get back to you shortly.

Here's a copy of your submission:

Service Requested: ${data.service}
Message: ${data.message}

If you need immediate assistance, please call us at (618) 539-2098.

Best regards,
AgriSolar LLC Team
                `
            };

            // Send both emails
            await Promise.all([
                transporter.sendMail(ownerMailOptions),
                transporter.sendMail(customerMailOptions)
            ]);

            // Update submission status
            await admin.database().ref(`contact_submissions/${submissionId}`).update({
                emailSent: true,
                emailSentTime: admin.database.ServerValue.TIMESTAMP
            });

            return { success: true };
        } catch (error) {
            console.error('Error processing submission:', error);
            
            // Update submission with error status
            await admin.database().ref(`contact_submissions/${submissionId}`).update({
                emailError: error.message,
                emailSent: false
            });

            throw new functions.https.HttpsError('internal', 'Error processing submission');
        }
    });

// HTTP endpoint for sending emails (for testing)
exports.sendEmail = functions.https.onRequest(async (req, res) => {
    if (req.method !== 'POST') {
        res.status(405).send('Method Not Allowed');
        return;
    }

    try {
        const { to, subject, text } = req.body;

        if (!to || !subject || !text) {
            res.status(400).send('Missing required fields');
            return;
        }

        const mailOptions = {
            from: `AgriSolar LLC <${functions.config().email.user}>`,
            to,
            subject,
            text
        };

        await transporter.sendMail(mailOptions);
        res.status(200).send('Email sent successfully');
    } catch (error) {
        console.error('Error sending email:', error);
        res.status(500).send('Error sending email: ' + error.message);
    }
});
