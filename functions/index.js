const { onRequest } = require('firebase-functions/v2/https');
const { onValueCreated } = require('firebase-functions/v2/database');
const admin = require('firebase-admin');
const nodemailer = require('nodemailer');
const cors = require('cors')({ origin: true });

// Initialize Firebase Admin
admin.initializeApp();

// Email configuration
const emailConfig = {
    host: 'mail.privateemail.com',
    port: 465,
    secure: true,
    auth: {
        user: 'aaron@agrisolarllc.com',
        pass: process.env.NAMECHEAP_PASSWORD
    },
    debug: true, // Enable debug output
    logger: true // Log information about the transport
};

// Create email transporter
const createTransporter = async () => {
    console.log('Creating email transporter...');
    console.log('Using email: aaron@agrisolarllc.com');
    console.log('Using host: mail.privateemail.com');
    
    // Create transporter with the working configuration
    const transporter = nodemailer.createTransport(emailConfig);
    
    // Verify connection configuration
    await transporter.verify();
    console.log('SMTP connection test successful!');
    
    return transporter;
};

// Function to send email on new contact form submission
exports.sendEmailOnNewContactSubmission = onValueCreated({
    ref: '/contact_submissions/{submissionId}',
    region: 'us-central1',
    memory: '256MiB',
    secrets: ["NAMECHEAP_PASSWORD"]
}, async (event) => {
    console.log('Received new contact submission event:', event);
    const submission = event.data;
    const submissionId = event.params.submissionId;

    const mailOptions = {
        from: 'aaron@agrisolarllc.com',
        to: 'aaron@agrisolarllc.com',
        subject: `New Contact Form Submission: ${submission.service}`,
        text: `
Name: ${submission.name}
Email: ${submission.email}
Phone: ${submission.phone || 'Not provided'}
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
                if (!decodedToken.email || decodedToken.email !== 'aaronreifschneider@outlook.com') {
                    console.error('User not authorized:', decodedToken.email);
                    res.status(403).json({ error: 'Not authorized to send replies' });
                    return;
                }

                const { submissionId, subject, message, to } = req.body;
                if (!submissionId || !subject || !message || !to) {
                    console.error('Missing required fields:', { submissionId, subject, message, to });
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
                    // Create transporter with the working configuration
                    console.log('Creating transporter for reply...');
                    const transporter = nodemailer.createTransport(emailConfig);
                    console.log('Transporter created successfully');

                    // Convert plain text to HTML with proper formatting
                    const htmlMessage = message.replace(/\n\n/g, '</p><p>').replace(/\n/g, '<br>');

                    const mailOptions = {
                        from: {
                            name: 'Aaron Reifler',
                            address: 'aaron@agrisolarllc.com'
                        },
                        to: to,
                        subject: subject,
                        text: message, // Plain text version
                        html: `
                            <div style="font-family: Arial, sans-serif; max-width: 600px; margin: 0 auto; line-height: 1.6;">
                                <p>${htmlMessage}</p>
                                <div style="color: #666; font-size: 12px; margin-top: 20px; padding-top: 20px; border-top: 1px solid #eee;">
                                    <p style="margin: 0;">This communication is intended only for the use of the individual or entity to which it is addressed and may contain information that is privileged, confidential or exempt from disclosure under applicable law. If you have received this communication in error, please notify us immediately.</p>
                                </div>
                            </div>
                        ` // HTML version with enhanced formatting
                    };

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

// Test function for email sending
exports.testEmailSending = onRequest({
    cors: true
}, async (req, res) => {
    try {
        console.log('Testing email sending...');
        // Create transporter with the working configuration
        const transporter = nodemailer.createTransport(emailConfig);
        
        const testMessage = `This is a test message to verify our email system.

We're testing the following features:
- Professional formatting
- Line breaks
- Signature block

Please let me know if you receive this test email.`;

        // Convert plain text to HTML with proper formatting
        const htmlMessage = testMessage.replace(/\n/g, '<br>');
        
        const mailOptions = {
            from: {
                name: 'Aaron Reifler',
                address: 'aaron@agrisolarllc.com'
            },
            to: 'aaron@agrisolarllc.com',
            subject: 'Test Email - AgriSolar LLC',
            text: `Dear Aaron,

Thank you for testing the AgriSolar LLC email system.

${testMessage}

Best regards,
Aaron Reifler
AgriSolar LLC
www.agrisolarllc.com
aaron@agrisolarllc.com`,
            html: `
                <div style="font-family: Arial, sans-serif; max-width: 600px; margin: 0 auto; line-height: 1.6;">
                    <p>Dear Aaron,</p>
                    
                    <p>Thank you for testing the AgriSolar LLC email system.</p>

                    <p>${htmlMessage}</p>

                    <p>Best regards,<br>
                    Aaron Reifler<br>
                    AgriSolar LLC<br>
                    <a href="http://www.agrisolarllc.com">www.agrisolarllc.com</a><br>
                    <a href="mailto:aaron@agrisolarllc.com">aaron@agrisolarllc.com</a></p>
                </div>
            `
        };

        console.log('Attempting to send test email...');
        await transporter.sendMail(mailOptions);
        console.log('Test email sent successfully');
        res.json({ success: true });
    } catch (error) {
        console.error('Error sending test email:', error);
        console.error('Error details:', {
            code: error.code,
            message: error.message,
            response: error.response
        });
        res.status(500).json({ error: error.message });
    }
});
