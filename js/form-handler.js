document.addEventListener('DOMContentLoaded', function() {
    const form = document.querySelector('.contact-form form');
    
    if (form) {
        form.addEventListener('submit', async function(e) {
            e.preventDefault();
            
            const formData = new FormData(form);
            const data = {};
            formData.forEach((value, key) => data[key] = value);
            
            try {
                // Here you would typically send the data to your server
                // For now, we'll simulate a successful submission
                console.log('Form data:', data);
                
                // Redirect to success page
                window.location.href = 'form-submitted.html?status=success';
            } catch (error) {
                console.error('Error submitting form:', error);
                // Redirect to error page
                window.location.href = 'form-submitted.html?status=error';
            }
        });
    }
});
