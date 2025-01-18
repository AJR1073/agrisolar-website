document.addEventListener('DOMContentLoaded', function() {
    const form = document.getElementById('contactForm');
    
    if (form) {
        form.addEventListener('submit', function(event) {
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
                viewed: false,
                notifyEmail: 'aaronreifschneider@outlook.com'
            };
            
            // Save to Firebase
            const submitButton = form.querySelector('button[type="submit"]');
            const originalButtonText = submitButton.textContent;
            submitButton.textContent = 'Sending...';
            submitButton.disabled = true;
            
            const db = firebase.database();
            db.ref('contact_submissions').push().set(data)
                .then(() => {
                    showMessage('Thank you for your message! We will get back to you soon.', 'success');
                    form.reset();
                })
                .catch((error) => {
                    console.error('Error saving to Firebase:', error);
                    showMessage('Error saving your message. Please try again.', 'error');
                })
                .finally(() => {
                    submitButton.textContent = originalButtonText;
                    submitButton.disabled = false;
                });
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
