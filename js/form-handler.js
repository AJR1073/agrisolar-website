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
                
                // Get all form values
                const name = formData.get('name')?.trim();
                const email = formData.get('email')?.trim();
                const phone = formData.get('phone')?.trim();
                const service = formData.get('service')?.trim();
                const message = formData.get('message')?.trim();

                // Validate required fields
                const errors = [];
                if (!name) errors.push('Name is required');
                if (!email) errors.push('Email is required');
                if (!service) errors.push('Please select a service');
                if (!message) errors.push('Message is required');

                if (errors.length > 0) {
                    throw new Error(errors.join('\n'));
                }

                // Create data object
                const data = {
                    name: name,
                    email: email,
                    phone: phone || 'Not provided',
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
    
    // Handle multi-line error messages
    if (message.includes('\n')) {
        formStatus.innerHTML = message.split('\n').join('<br>');
    } else {
        formStatus.textContent = message;
    }
    
    formStatus.className = `form-status ${type}`;
    
    // Scroll to message
    formStatus.scrollIntoView({ behavior: 'smooth', block: 'center' });
    
    // Clear message after 5 seconds
    setTimeout(() => {
        formStatus.textContent = '';
        formStatus.className = 'form-status';
    }, 5000);
}
