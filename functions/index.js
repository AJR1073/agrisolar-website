const functions = require('firebase-functions');
const admin = require('firebase-admin');
const nodemailer = require('nodemailer');

admin.initializeApp();

// Create a transporter using Gmail SMTP
const transporter = nodemailer.createTransport({
    service: 'gmail',
    auth: {
        user: 'aaronreifschneider@gmail.com',
        pass: functions.config().gmail.app_password
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

            // Prepare email options
            const mailOptions = {
                from: 'AgriSolar LLC Website <aaronreifschneider@gmail.com>',
                to: 'aaronreifschneider@outlook.com',
                subject: `New Contact Form Submission from ${data.name}`,
                text: formatEmailContent({ ...data, timestamp: Date.now() })
            };

            // Send the email
            await transporter.sendMail(mailOptions);

            // Update the submission status
            await snapshot.ref.update({
                emailSent: true,
                emailSentAt: Date.now()
            });

            return { success: true };
        } catch (error) {
            console.error('Error processing submission:', error);
            
            // Update the submission to indicate email failure
            await snapshot.ref.update({
                emailError: error.message,
                emailSent: false
            });

            throw new functions.https.HttpsError('internal', 'Failed to process submission');
        }
    });
