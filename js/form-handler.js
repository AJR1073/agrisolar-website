// Get form element
const form = document.getElementById('contactForm');

if (form) {
    console.log('Form found, attaching handler');
    
    form.onsubmit = function(e) {
        e.preventDefault();
        console.log('Form submitted');
        
        // Get values directly from form fields
        const nameField = document.getElementById('name');
        const emailField = document.getElementById('email');
        const phoneField = document.getElementById('phone');
        const serviceField = document.getElementById('service');
        const messageField = document.getElementById('message');
        
        console.log('Form fields found:', {
            name: nameField,
            email: emailField,
            phone: phoneField,
            service: serviceField,
            message: messageField
        });
        
        // Get values
        const name = nameField ? nameField.value.trim() : '';
        const email = emailField ? emailField.value.trim() : '';
        const phone = phoneField ? phoneField.value.trim() : '';
        const service = serviceField ? serviceField.value.trim() : '';
        const message = messageField ? messageField.value.trim() : '';
        
        console.log('Form values:', {
            name,
            email,
            phone,
            service,
            message
        });
        
        // Validate required fields
        if (!name || !email || !service || !message) {
            const missing = [];
            if (!name) missing.push('Name');
            if (!email) missing.push('Email');
            if (!service) missing.push('Service');
            if (!message) missing.push('Message');
            
            alert('Please fill in all required fields: ' + missing.join(', '));
            return false;
        }
        
        // Create submission data
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
        
        // Save to Firebase
        const submitButton = form.querySelector('button[type="submit"]');
        const originalButtonText = submitButton.textContent;
        submitButton.textContent = 'Sending...';
        submitButton.disabled = true;
        
        try {
            const db = firebase.database();
            const newSubmissionRef = db.ref('contact_submissions').push();
            
            newSubmissionRef.set(data)
                .then(() => {
                    console.log('Saved successfully');
                    alert('Thank you for your message! We will get back to you soon.');
                    form.reset();
                })
                .catch((error) => {
                    console.error('Save error:', error);
                    alert('There was an error sending your message. Please try again.');
                })
                .finally(() => {
                    submitButton.textContent = originalButtonText;
                    submitButton.disabled = false;
                });
        } catch (error) {
            console.error('Firebase error:', error);
            alert('There was an error sending your message. Please try again.');
            submitButton.textContent = originalButtonText;
            submitButton.disabled = false;
        }
        
        return false;
    };
} else {
    console.error('Contact form not found!');
}
