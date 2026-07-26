const { onRequest } = require('firebase-functions/v2/https');
const { onValueCreated } = require('firebase-functions/v2/database');
const admin = require('firebase-admin');
const nodemailer = require('nodemailer');
const cors = require('cors')({ origin: true });

// Initialize Firebase Admin
admin.initializeApp();

const SMTP_HOST = 'agrisolarllc.com';
const OUTBOUND_EMAIL = 'aaron@agrisolarllc.com';
const CONTACT_RECIPIENT = 'aaron@agrisolarllc.com';
const ADMIN_EMAIL = 'aaronreifschneider@outlook.com';

// Create email transporter
const createTransporter = async () => {
    const smtpConfig = {
        host: SMTP_HOST,
        port: 465,
        secure: true,
        auth: {
            type: 'LOGIN',
            user: OUTBOUND_EMAIL,
            pass: process.env.NAMECHEAP_PASSWORD
        }
    };

    try {
        const transporter = nodemailer.createTransport(smtpConfig);
        await transporter.verify();
        return transporter;
    } catch (error) {
        console.error('Failed to create transporter:', error);
        throw error;
    }
};

// Function to send email on new contact form submission
exports.sendEmailOnNewContactSubmission = onValueCreated({
    ref: '/contact_submissions/{submissionId}',
    region: 'us-central1',
    memory: '256MiB',
    secrets: ["NAMECHEAP_PASSWORD"]
}, async (event) => {
    console.log('Received new contact submission event:', event);
    const submission = event.data.val();
    const submissionId = event.params.submissionId;

    const mailOptions = {
        from: `"AgriSolar website" <${OUTBOUND_EMAIL}>`,
        to: CONTACT_RECIPIENT,
        replyTo: submission.email,
        subject: `New Contact Form Submission: ${submission.service}`,
        text: `
Name: ${submission.name}
Company: ${submission.company || 'Not provided'}
Email: ${submission.email}
Phone: ${submission.phone || 'Not provided'}
Site location: ${submission.siteLocation || 'Not provided'}
Approximate acreage: ${submission.acreage ?? 'Not provided'}
Service: ${submission.service}
Message: ${submission.message}

View in admin panel: https://agrisolar-website.web.app/admin/
`,
    };

    try {
        console.log('Creating transporter for new submission notification...');
        const transporter = await createTransporter();
        
        console.log('Sending notification email with options:', {
            from: mailOptions.from,
            to: mailOptions.to,
            subject: mailOptions.subject
        });
        
        await transporter.sendMail(mailOptions);
        console.log('New submission notification email sent successfully');
        return { success: true };
    } catch (error) {
        console.error('Error sending notification email:', error);
        if (error.code === 'EAUTH') {
            console.error('Authentication failed. Please check email credentials.');
        }
        throw new Error(error.message);
    }
});

// Function to send reply to contact form submission
exports.sendReply = onRequest({
    region: 'us-central1',
    memory: '256MiB',
    secrets: ["NAMECHEAP_PASSWORD"]
}, async (req, res) => {
    return cors(req, res, async () => {
        try {
            console.log('Received request to send reply');
            
            // Get the authorization header
            const authHeader = req.headers.authorization;
            if (!authHeader) {
                console.error('No authorization header');
                res.status(401).json({ error: 'Missing authorization header' });
                return;
            }
            
            if (!authHeader.startsWith('Bearer ')) {
                console.error('Invalid authorization header format');
                res.status(401).json({ error: 'Invalid authorization header format' });
                return;
            }

            // Get the ID token
            const idToken = authHeader.split('Bearer ')[1];
            console.log('Got ID token');

            try {
                // Verify the ID token
                const decodedToken = await admin.auth().verifyIdToken(idToken);
                console.log('Successfully verified token for user:', decodedToken.uid, decodedToken.email);

                // Check if the user has admin access
                if (!decodedToken.email || decodedToken.email !== ADMIN_EMAIL) {
                    console.error('User not authorized:', decodedToken.email);
                    res.status(403).json({ error: 'Not authorized to send replies' });
                    return;
                }

                const { submissionId, subject, message } = req.body;
                if (!submissionId || !subject || !message) {
                    console.error('Missing required fields:', { submissionId, subject, message });
                    res.status(400).json({ error: 'Missing required fields' });
                    return;
                }

                // Get the submission details
                const submissionSnapshot = await admin.database()
                    .ref(`/contact_submissions/${submissionId}`)
                    .once('value');
                
                const submission = submissionSnapshot.val();
                if (!submission) {
                    console.error('Submission not found:', submissionId);
                    res.status(404).json({ error: 'Submission not found' });
                    return;
                }

                console.log('Found submission:', submission);

                try {
                    // Create and verify transporter
                    console.log('Creating transporter for reply...');
                    const transporter = await createTransporter();
                    console.log('Transporter created successfully');

                    // Send the reply email
                    const mailOptions = {
                        from: `"AgriSolar LLC" <${OUTBOUND_EMAIL}>`,
                        to: submission.email,
                        replyTo: OUTBOUND_EMAIL,
                        subject: subject,
                        text: message
                    };

                    console.log('Sending reply email with options:', {
                        from: mailOptions.from,
                        to: mailOptions.to,
                        subject: mailOptions.subject
                    });

                    await transporter.sendMail(mailOptions);
                    console.log('Reply email sent successfully');

                    // Update submission status
                    await admin.database()
                        .ref(`/contact_submissions/${submissionId}/replied`)
                        .set(true);

                    res.json({ success: true });
                } catch (emailError) {
                    console.error('Error sending reply email:', emailError);
                    if (emailError.code === 'EAUTH') {
                        console.error('Authentication failed. Please check email credentials.');
                        console.error('SMTP Response:', emailError.response);
                        res.status(500).json({ 
                            error: 'Email authentication failed. Please verify the email password is correct.',
                            details: emailError.message
                        });
                    } else {
                        res.status(500).json({ 
                            error: 'Failed to send email',
                            details: emailError.message
                        });
                    }
                }
            } catch (authError) {
                console.error('Error verifying token:', authError);
                res.status(401).json({ error: 'Invalid authentication token' });
            }
        } catch (error) {
            console.error('Error in sendReply:', error);
            res.status(500).json({ error: error.message });
        }
    });
});
