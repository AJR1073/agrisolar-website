document.addEventListener('DOMContentLoaded', function() {
    const form = document.getElementById('contactForm');
    console.log('Form found:', form);
    
    if (form) {
        // Debug log all form elements
        console.log('Name field:', form.querySelector('#name'));
        console.log('Email field:', form.querySelector('#email'));
        console.log('Phone field:', form.querySelector('#phone'));
        console.log('Service field:', form.querySelector('#service'));
        console.log('Message field:', form.querySelector('#message'));

        form.addEventListener('submit', async function(e) {
            e.preventDefault();
            
            const submitButton = form.querySelector('button[type="submit"]');
            const originalButtonText = submitButton.textContent;
            submitButton.textContent = 'Sending...';
            submitButton.disabled = true;

            try {
                // Get form data
                const formData = new FormData(this);
                
                // Get all form values directly from FormData
                const name = formData.get('name');
                const email = formData.get('email');
                const phone = formData.get('phone');
                const service = formData.get('service');
                const message = formData.get('message');

                // Debug log values
                console.log('Form Values:', {
                    name,
                    email,
                    phone,
                    service,
                    message
                });

                // Validate required fields
                const errors = [];
                if (!name || name.trim() === '') errors.push('Name is required');
                if (!email || email.trim() === '') errors.push('Email is required');
                if (!service || service.trim() === '') errors.push('Please select a service');
                if (!message || message.trim() === '') errors.push('Message is required');

                if (errors.length > 0) {
                    throw new Error(errors.join('\n'));
                }

                // Create data object
                const data = {
                    name: name.trim(),
                    email: email.trim(),
                    phone: phone ? phone.trim() : 'Not provided',
                    service: service.trim(),
                    message: message.trim(),
                    timestamp: firebase.database.ServerValue.TIMESTAMP,
                    status: 'new',
                    viewed: false,
                    notifyEmail: 'aaronreifschneider@outlook.com'
                };

                // Debug log
                console.log('Saving data:', data);

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
    } else {
        console.error('Contact form not found!');
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
        } else {
            console.error('Form not found for message display');
            return;
        }
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
