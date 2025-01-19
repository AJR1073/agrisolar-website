document.addEventListener('DOMContentLoaded', function() {
    const form = document.getElementById('contactForm');
    
    if (form) {
        form.addEventListener('submit', async function(event) {
            event.preventDefault();
            
            // Get form values
            const name = document.getElementById('name').value.trim();
            const email = document.getElementById('email').value.trim();
            const phone = document.getElementById('phone').value.trim();
            const service = document.getElementById('service').value.trim();
            const message = document.getElementById('message').value.trim();
            
            // Validate required fields
            if (!name || !email || !service || !message) {
                showMessage('Please fill in all required fields.', 'error');
                return;
            }
            
            // Create data object
            const data = {
                name,
                email,
                phone: phone || 'Not provided',
                service,
                message,
                timestamp: firebase.database.ServerValue.TIMESTAMP,
                status: 'new',
                viewed: false
            };
            
            // Save to Firebase and send email
            const submitButton = form.querySelector('button[type="submit"]');
            const originalButtonText = submitButton.textContent;
            submitButton.textContent = 'Sending...';
            submitButton.disabled = true;
            
            try {
                // Save to Firebase
                const db = firebase.database();
                const submissionRef = await db.ref('contact_submissions').push();
                await submissionRef.set(data);

                // Get email recipients
                const recipientsSnapshot = await db.ref('email_recipients').once('value');
                const recipients = recipientsSnapshot.val() || {};
                
                // Format email content
                const emailContent = `
New Contact Form Submission

Name: ${name}
Email: ${email}
Phone: ${phone || 'Not provided'}
Service: ${service}
Message: ${message}

Submitted at: ${new Date().toLocaleString()}

View all submissions at: https://agrisolar-website.web.app/admin/
`;
                
                // Send emails to all recipients
                const emailPromises = Object.values(recipients).map(recipient => {
                    return fetch('https://api.emailjs.com/api/v1.0/email/send', {
                        method: 'POST',
                        headers: {
                            'Content-Type': 'application/json'
                        },
                        body: JSON.stringify({
                            service_id: 'YOUR_SERVICE_ID',
                            template_id: 'YOUR_TEMPLATE_ID',
                            user_id: 'YOUR_PUBLIC_KEY',
                            template_params: {
                                to_name: recipient.name,
                                to_email: recipient.email,
                                from_name: name,
                                from_email: email,
                                phone: phone || 'Not provided',
                                service: service,
                                message: message,
                                content: emailContent
                            }
                        })
                    });
                });

                // Send confirmation email to customer
                emailPromises.push(
                    fetch('https://api.emailjs.com/api/v1.0/email/send', {
                        method: 'POST',
                        headers: {
                            'Content-Type': 'application/json'
                        },
                        body: JSON.stringify({
                            service_id: 'YOUR_SERVICE_ID',
                            template_id: 'YOUR_CONFIRMATION_TEMPLATE_ID',
                            user_id: 'YOUR_PUBLIC_KEY',
                            template_params: {
                                to_name: name,
                                to_email: email,
                                service: service,
                                message: message
                            }
                        })
                    })
                );

                // Wait for all emails to be sent
                await Promise.all(emailPromises);
                
                showMessage('Thank you for your message! We will get back to you soon.', 'success');
                form.reset();
            } catch (error) {
                console.error('Error:', error);
                showMessage('Error sending your message. Please try again.', 'error');
            } finally {
                submitButton.textContent = originalButtonText;
                submitButton.disabled = false;
            }
        });
    }
});

function showMessage(message, type) {
    let formStatus = document.getElementById('formStatus');
    
    if (!formStatus) {
        formStatus = document.createElement('div');
        formStatus.id = 'formStatus';
        formStatus.className = 'form-status';
        const form = document.getElementById('contactForm');
        if (form) {
            form.parentNode.insertBefore(formStatus, form.nextSibling);
        }
    }
    
    formStatus.textContent = message;
    formStatus.className = `form-status ${type}`;
    formStatus.scrollIntoView({ behavior: 'smooth', block: 'center' });
    
    setTimeout(() => {
        formStatus.textContent = '';
        formStatus.className = 'form-status';
    }, 5000);
}
