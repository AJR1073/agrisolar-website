document.addEventListener('DOMContentLoaded', () => {
    const forms = document.querySelectorAll('.quote-form');
    const duplicateWindowMs = 60_000;
    const maxAttachmentCount = 10;
    const maxAttachmentSize = 5 * 1024 * 1024;
    const maxTotalAttachmentSize = 15 * 1024 * 1024;
    const allowedAttachmentTypes = new Set([
        'application/pdf',
        'image/jpeg',
        'image/png',
        'image/webp'
    ]);

    function createAttachmentId() {
        if (globalThis.crypto?.randomUUID) {
            return globalThis.crypto.randomUUID();
        }

        return `${Date.now()}-${Math.random().toString(36).slice(2, 14)}`;
    }

    forms.forEach((form) => {
        const submitButton = form.querySelector('button[type="submit"]');
        const status = form.querySelector('.form-status');
        const fallback = form.querySelector('.form-recovery');
        let submitting = false;

        const fields = Array.from(
            form.querySelectorAll('input:not([type="hidden"]), select, textarea')
        ).filter((field) => !field.classList.contains('website-field'));

        function setStatus(message, type = '') {
            status.textContent = message;
            status.className = `form-status${type ? ` form-status--${type}` : ''}`;
            status.hidden = !message;
        }

        function setFieldError(field, message) {
            const error = form.querySelector(`#${field.id}-error`);
            field.setAttribute('aria-invalid', String(Boolean(message)));
            if (error) {
                error.textContent = message;
            }
        }

        function validateField(field) {
            const value = field.value.trim();
            let message = '';

            if (field.type === 'file') {
                const files = Array.from(field.files || []);
                if (files.length > maxAttachmentCount) {
                    message = `Choose no more than ${maxAttachmentCount} files.`;
                } else if (files.some((file) => file.size <= 0 || file.size > maxAttachmentSize)) {
                    message = 'Each attachment must be larger than 0 bytes and no more than 5 MB.';
                } else if (
                    files.reduce((total, file) => total + file.size, 0)
                    > maxTotalAttachmentSize
                ) {
                    message = 'Attachments must total no more than 15 MB.';
                } else if (files.some((file) => !allowedAttachmentTypes.has(file.type))) {
                    message = 'Attachments must be PDF, JPG, PNG, or WebP files.';
                } else if (files.some((file) => file.name.length > 140)) {
                    message = 'Attachment filenames must be 140 characters or fewer.';
                }
            } else if (field.required && !value) {
                message = 'This field is required.';
            } else if (value && field.type === 'email' && !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(value)) {
                message = 'Enter a valid email address.';
            } else if (value && field.maxLength > 0 && value.length > field.maxLength) {
                message = `Use ${field.maxLength} characters or fewer.`;
            }

            setFieldError(field, message);
            return !message;
        }

        async function uploadAttachments(submissionId, files) {
            const attachments = [];

            for (const [index, file] of files.entries()) {
                setStatus(`Uploading attachment ${index + 1} of ${files.length}…`);
                const attachmentId = createAttachmentId();
                const path = `quote-attachments/${submissionId}/${attachmentId}`;
                const storageRef = firebase.storage().ref(path);

                await storageRef.put(file, {
                    contentType: file.type,
                    customMetadata: {
                        originalName: file.name
                    }
                });

                attachments.push({
                    name: file.name,
                    contentType: file.type,
                    size: file.size,
                    path
                });
            }

            return attachments;
        }

        fields.forEach((field) => {
            field.addEventListener('blur', () => validateField(field));
            field.addEventListener('input', () => {
                if (field.getAttribute('aria-invalid') === 'true') {
                    validateField(field);
                }
            });
        });

        form.addEventListener('submit', async (event) => {
            event.preventDefault();

            if (submitting) {
                return;
            }

            setStatus('');
            fallback.hidden = true;

            const valid = fields.map(validateField).every(Boolean);
            if (!valid) {
                setStatus('Please correct the highlighted fields and try again.', 'error');
                form.querySelector('[aria-invalid="true"]')?.focus();
                return;
            }

            const honeypot = form.querySelector('.website-field');
            if (honeypot?.value) {
                form.reset();
                setStatus('Thank you. Your request has been received.', 'success');
                return;
            }

            const formData = new FormData(form);
            const attachmentInput = form.querySelector('.attachment-input');
            const attachmentFiles = Array.from(attachmentInput?.files || []);
            const payload = {
                name: formData.get('name').trim(),
                company: formData.get('company').trim(),
                email: formData.get('email').trim(),
                phone: formData.get('phone').trim(),
                siteLocation: formData.get('siteLocation').trim(),
                acreage: formData.get('acreage').trim(),
                service: formData.get('service').trim(),
                schedule: formData.get('schedule').trim(),
                message: formData.get('message').trim(),
                timestamp:
                    typeof firebase !== 'undefined' && firebase.database
                        ? firebase.database.ServerValue.TIMESTAMP
                        : Date.now(),
                status: 'new',
                viewed: false
            };

            const fingerprint = [
                payload.email.toLowerCase(),
                payload.siteLocation.toLowerCase(),
                payload.message.toLowerCase(),
                attachmentFiles.map((file) => `${file.name}:${file.size}`).join(',')
            ].join('|');
            const lastSubmission = JSON.parse(
                sessionStorage.getItem('agrisolarLastSubmission') || 'null'
            );

            if (
                lastSubmission &&
                lastSubmission.fingerprint === fingerprint &&
                Date.now() - lastSubmission.createdAt < duplicateWindowMs
            ) {
                setStatus('This request was already submitted. Please wait before trying again.', 'error');
                return;
            }

            submitting = true;
            submitButton.disabled = true;
            submitButton.dataset.originalText = submitButton.textContent;
            submitButton.textContent = 'Sending request…';
            setStatus('Sending your request…');

            try {
                if (typeof firebase === 'undefined' || !firebase.database) {
                    throw new Error('Firebase is unavailable');
                }

                if (attachmentFiles.length && !firebase.storage) {
                    throw new Error('Firebase Storage is unavailable');
                }

                const submissionRef = firebase
                    .database()
                    .ref('contact_submissions')
                    .push();

                if (attachmentFiles.length) {
                    payload.attachments = await uploadAttachments(
                        submissionRef.key,
                        attachmentFiles
                    );
                }

                setStatus('Saving your quote request…');
                await submissionRef.set(payload);
                sessionStorage.setItem(
                    'agrisolarLastSubmission',
                    JSON.stringify({ fingerprint, createdAt: Date.now() })
                );
                form.reset();
                fields.forEach((field) => setFieldError(field, ''));
                setStatus(
                    'Thank you. Your quote request was sent successfully. We will follow up using the contact information provided.',
                    'success'
                );
            } catch (error) {
                console.error('Quote request could not be submitted.');
                setStatus(
                    'We could not send your request right now. Please use the email or phone option below.',
                    'error'
                );
                fallback.hidden = false;
            } finally {
                submitting = false;
                submitButton.disabled = false;
                submitButton.textContent = submitButton.dataset.originalText;
            }
        });
    });
});
