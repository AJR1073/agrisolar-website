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
                await db.ref('contact_submissions').push().set(data);
                
                // Send email notification
                await fetch('https://api.emailjs.com/api/v1.0/email/send', {
                    method: 'POST',
                    headers: {
                        'Content-Type': 'application/json'
                    },
                    body: JSON.stringify({
                        service_id: 'YOUR_SERVICE_ID',
                        template_id: 'YOUR_TEMPLATE_ID',
                        user_id: 'YOUR_PUBLIC_KEY',
                        template_params: {
                            to_email: 'aaronreifschneider@outlook.com',
                            from_name: name,
                            from_email: email,
                            phone: phone || 'Not provided',
                            service: service,
                            message: message,
                            admin_url: 'https://agrisolar-website.web.app/admin/'
                        }
                    })
                });
                
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
