document.addEventListener('DOMContentLoaded', function() {
    const form = document.getElementById('contactForm');
    
    if (form) {
        form.addEventListener('submit', async function(e) {
            e.preventDefault();
            
            const submitButton = form.querySelector('button[type="submit"]');
            const originalButtonText = submitButton.textContent;
            submitButton.textContent = 'Sending...';
            submitButton.disabled = true;

            try {
                // Get form data
                const formData = new FormData(form);
                
                // Validate required fields
                const name = formData.get('name');
                const email = formData.get('email');
                const service = formData.get('service');
                const message = formData.get('message');
                
                if (!name || !email || !service || !message) {
                    throw new Error('Please fill in all required fields');
                }

                const data = {
                    name: name,
                    email: email,
                    phone: formData.get('phone') || 'Not provided',
                    service: service,
                    message: message,
                    timestamp: firebase.database.ServerValue.TIMESTAMP,
                    status: 'new',
                    viewed: false,
                    notifyEmail: 'aaronreifschneider@outlook.com'
                };

                // Save to Firebase Realtime Database
                const db = firebase.database();
                const newSubmissionRef = db.ref('contact_submissions').push();
                await newSubmissionRef.set(data);
                
                // Show success message
                showMessage('Thank you for your message! We will get back to you soon.', 'success');
                form.reset();
            } catch (error) {
                console.error('Error submitting form:', error);
                showMessage(error.message || 'Oops! Something went wrong. Please try again or contact us directly at (618) 539-2098.', 'error');
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
        form.parentNode.insertBefore(formStatus, form.nextSibling);
    }
    
    formStatus.textContent = message;
    formStatus.className = `form-status ${type}`;
    
    // Scroll to message
    formStatus.scrollIntoView({ behavior: 'smooth', block: 'center' });
    
    // Clear message after 5 seconds
    setTimeout(() => {
        formStatus.textContent = '';
        formStatus.className = 'form-status';
    }, 5000);
}
