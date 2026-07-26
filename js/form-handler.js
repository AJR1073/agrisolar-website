document.addEventListener('DOMContentLoaded', () => {
    const form = document.getElementById('contactForm');
    const status = document.getElementById('formStatus');

    if (!form || !status) return;

    const setStatus = (message, type = '') => {
        status.textContent = message;
        status.className = `form-status${type ? ` is-${type}` : ''}`;
    };

    const validate = () => {
        let firstInvalid = null;

        form.querySelectorAll('[required]').forEach((field) => {
            field.setAttribute('aria-invalid', String(!field.validity.valid));
            if (!field.validity.valid && !firstInvalid) firstInvalid = field;
        });

        if (firstInvalid) {
            firstInvalid.focus();
            setStatus('Please complete the required fields before sending.', 'error');
            return false;
        }

        return true;
    };

    form.addEventListener('input', (event) => {
        if (event.target.matches('[aria-invalid="true"]') && event.target.validity.valid) {
            event.target.setAttribute('aria-invalid', 'false');
        }
    });

    form.addEventListener('submit', async (event) => {
        event.preventDefault();
        setStatus('');

        if (!validate()) return;

        const honeypot = form.elements.website?.value.trim();
        if (honeypot) {
            form.reset();
            setStatus('Thank you. Your request has been received.', 'success');
            return;
        }

        if (typeof firebase === 'undefined' || !firebase.database) {
            setStatus('The quote form is temporarily unavailable. Please call (618) 539-2098 or email info@agrisolarllc.com.', 'error');
            return;
        }

        const submitButton = form.querySelector('button[type="submit"]');
        const formData = new FormData(form);
        const submission = {
            name: formData.get('name').trim(),
            company: formData.get('company').trim(),
            email: formData.get('email').trim(),
            phone: formData.get('phone').trim() || 'Not provided',
            siteLocation: formData.get('siteLocation').trim(),
            acreage: formData.get('acreage') ? Number(formData.get('acreage')) : null,
            service: formData.get('service').trim(),
            message: formData.get('message').trim(),
            timestamp: firebase.database.ServerValue.TIMESTAMP,
            status: 'new',
            viewed: false,
            source: 'website-quote-form'
        };

        submitButton.disabled = true;
        submitButton.textContent = 'Sending…';
        setStatus('Sending your request…');

        try {
            await firebase.database().ref('contact_submissions').push(submission);
            form.reset();
            setStatus('Thank you. Your quote request was sent successfully. We’ll follow up soon.', 'success');
        } catch (error) {
            console.error('Contact submission failed:', error);
            setStatus('We could not send the form. Please call (618) 539-2098 or email info@agrisolarllc.com.', 'error');
        } finally {
            submitButton.disabled = false;
            submitButton.textContent = 'Send quote request';
        }
    });
});
