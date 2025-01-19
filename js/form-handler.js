document.addEventListener('DOMContentLoaded', function() {
    const form = document.getElementById('contactForm');
    console.log('Form handler initialized');
    
    if (form) {
        form.addEventListener('submit', async function(event) {
            event.preventDefault();
            console.log('Form submitted');
            
            // Get form values
            const name = document.getElementById('name').value.trim();
            const email = document.getElementById('email').value.trim();
            const phone = document.getElementById('phone').value.trim();
            const service = document.getElementById('service').value.trim();
            const message = document.getElementById('message').value.trim();
            
            console.log('Form values:', { name, email, phone, service, message });
            
            // Validate required fields
            if (!name || !email || !service || !message) {
                console.error('Missing required fields');
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
            
            console.log('Data to save:', data);
            
            // Save to Firebase and send email
            const submitButton = form.querySelector('button[type="submit"]');
            const originalButtonText = submitButton.textContent;
            submitButton.textContent = 'Sending...';
            submitButton.disabled = true;
            
            try {
                // Save to Firebase
                const db = firebase.database();
                console.log('Saving to Firebase...');
                const newSubmissionRef = await db.ref('contact_submissions').push();
                await newSubmissionRef.set(data);
                console.log('Saved to Firebase with ID:', newSubmissionRef.key);

                // For now, let's skip EmailJS and use a simpler approach
                const emailBody = `
                    New Contact Form Submission

                    Name: ${name}
                    Email: ${email}
                    Phone: ${phone || 'Not provided'}
                    Service: ${service}
                    Message: ${message}

                    View submission at: https://agrisolar-website.web.app/admin/
                `;

                // Open default email client
                const mailtoLink = `mailto:aaronreifschneider@outlook.com?subject=New Contact Form Submission&body=${encodeURIComponent(emailBody)}`;
                window.open(mailtoLink);
                
                showMessage('Thank you for your message! We will get back to you soon.', 'success');
                form.reset();
            } catch (error) {
                console.error('Error saving submission:', error);
                showMessage('Error sending your message. Please try again.', 'error');
            } finally {
                submitButton.textContent = originalButtonText;
                submitButton.disabled = false;
            }
        });
    } else {
        console.error('Contact form not found');
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
