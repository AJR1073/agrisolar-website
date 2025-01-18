document.addEventListener('DOMContentLoaded', function() {
    const form = document.querySelector('.contact-form form');
    
    if (form) {
        form.addEventListener('submit', async function(e) {
            e.preventDefault();
            
            // Show loading state
            const submitButton = form.querySelector('button[type="submit"]');
            const originalButtonText = submitButton.textContent;
            submitButton.textContent = 'Sending...';
            submitButton.disabled = true;

            try {
                // Send form data to Formspree
                const response = await fetch(form.action, {
                    method: 'POST',
                    body: new FormData(form),
                    headers: {
                        'Accept': 'application/json'
                    }
                });

                const data = await response.json();
                
                if (data.ok) {
                    // Success - redirect to thank you page
                    window.location.href = 'form-submitted.html?status=success';
                } else {
                    // Error from Formspree
                    throw new Error('Form submission failed');
                }
            } catch (error) {
                console.error('Error submitting form:', error);
                // Redirect to error page
                window.location.href = 'form-submitted.html?status=error';
            } finally {
                // Reset button state
                submitButton.textContent = originalButtonText;
                submitButton.disabled = false;
            }
        });
    }
});
