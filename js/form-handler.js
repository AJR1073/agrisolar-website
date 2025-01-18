function handleFormSubmit(event) {
    event.preventDefault();
    console.log('Form submitted');
    
    const form = event.target;
    console.log('Form:', form);
    console.log('Form elements:', form.elements);
    
    const submitButton = form.querySelector('button[type="submit"]');
    const originalButtonText = submitButton.textContent;
    submitButton.textContent = 'Sending...';
    submitButton.disabled = true;

    try {
        // Get form elements
        const nameInput = document.getElementById('name');
        const emailInput = document.getElementById('email');
        const phoneInput = document.getElementById('phone');
        const serviceInput = document.getElementById('service');
        const messageInput = document.getElementById('message');

        console.log('Form elements found:', {
            nameInput,
            emailInput,
            phoneInput,
            serviceInput,
            messageInput
        });

        // Get form values
        const name = nameInput ? nameInput.value : '';
        const email = emailInput ? emailInput.value : '';
        const phone = phoneInput ? phoneInput.value : '';
        const service = serviceInput ? serviceInput.value : '';
        const message = messageInput ? messageInput.value : '';

        console.log('Raw form values:', {
            name,
            email,
            phone,
            service,
            message
        });

        // Validate required fields
        const errors = [];
        if (!nameInput) errors.push('Name field not found');
        else if (!name || name.trim() === '') errors.push('Name is required');
        
        if (!emailInput) errors.push('Email field not found');
        else if (!email || email.trim() === '') errors.push('Email is required');
        
        if (!serviceInput) errors.push('Service field not found');
        else if (!service || service.trim() === '') errors.push('Please select a service');
        
        if (!messageInput) errors.push('Message field not found');
        else if (!message || message.trim() === '') errors.push('Message is required');

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

        console.log('Saving data:', data);

        // Save to Firebase
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
    } catch (error) {
        console.error('Form validation error:', error);
        showMessage(error.message || 'Please fill in all required fields.', 'error');
        submitButton.textContent = originalButtonText;
        submitButton.disabled = false;
    }
}

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
    
    if (message.includes('\n')) {
        formStatus.innerHTML = message.split('\n').join('<br>');
    } else {
        formStatus.textContent = message;
    }
    
    formStatus.className = `form-status ${type}`;
    formStatus.scrollIntoView({ behavior: 'smooth', block: 'center' });
    
    setTimeout(() => {
        formStatus.textContent = '';
        formStatus.className = 'form-status';
    }, 5000);
}

// Add event listener when the DOM is ready
if (document.readyState === 'loading') {
    document.addEventListener('DOMContentLoaded', function() {
        const form = document.getElementById('contactForm');
        if (form) {
            console.log('Form found on DOMContentLoaded');
            form.addEventListener('submit', handleFormSubmit);
        } else {
            console.error('Form not found on DOMContentLoaded');
        }
    });
} else {
    const form = document.getElementById('contactForm');
    if (form) {
        console.log('Form found immediately');
        form.addEventListener('submit', handleFormSubmit);
    } else {
        console.error('Form not found immediately');
    }
}
