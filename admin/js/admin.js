// Firebase configuration and initialization
let auth;
let database;
let functions;
let storage;

function escapeHtml(value) {
    return String(value ?? '')
        .replaceAll('&', '&amp;')
        .replaceAll('<', '&lt;')
        .replaceAll('>', '&gt;')
        .replaceAll('"', '&quot;')
        .replaceAll("'", '&#039;');
}

function formatFileSize(bytes) {
    if (!Number.isFinite(Number(bytes))) {
        return 'Unknown size';
    }

    const size = Number(bytes);
    return size >= 1024 * 1024
        ? `${(size / (1024 * 1024)).toFixed(1)} MB`
        : `${Math.max(1, Math.ceil(size / 1024))} KB`;
}

function renderAttachments(submissionId, attachments) {
    if (!Array.isArray(attachments) || !attachments.length) {
        return '';
    }

    return `
        <div class="submission-attachments">
            <strong>Attachments:</strong>
            <div class="attachment-list">
                ${attachments.map((attachment, index) => `
                    <button
                        type="button"
                        class="attachment-button"
                        data-action="view-attachment"
                        data-submission-id="${escapeHtml(submissionId)}"
                        data-attachment-index="${index}"
                    >
                        <i class="fas fa-paperclip" aria-hidden="true"></i>
                        <span>${escapeHtml(attachment.name)}</span>
                        <small>${escapeHtml(formatFileSize(attachment.size))}</small>
                    </button>
                `).join('')}
            </div>
        </div>
    `;
}

// Helper function to send replies
async function sendReply(data) {
    try {
        const user = auth.currentUser;
        if (!user) {
            throw new Error('User must be authenticated to send replies');
        }

        // Get a fresh token
        const idToken = await user.getIdToken();
        console.log('Got fresh token for user:', user.email);

        const response = await fetch('https://us-central1-agrisolar-website.cloudfunctions.net/sendReply', {
            method: 'POST',
            headers: {
                'Content-Type': 'application/json',
                'Authorization': `Bearer ${idToken}`
            },
            body: JSON.stringify(data)
        });

        const responseData = await response.json();
        if (!response.ok) {
            console.error('Server error:', responseData);
            throw new Error(responseData.error || `Server error: ${response.status}`);
        }

        return responseData;
    } catch (error) {
        console.error('Error sending reply:', error);
        throw error;
    }
}

// Email templates
const emailTemplates = {
    general: {
        subject: "Thank you for contacting AgriSolar LLC",
        message: `Dear [Name],

Thank you for reaching out to AgriSolar LLC. We have received your message and appreciate your interest in our services.

We will review your inquiry and get back to you with more detailed information shortly.

Best regards,
AgriSolar LLC Team`
    },
    quote: {
        subject: "Your Quote Request - AgriSolar LLC",
        message: `Dear [Name],

Thank you for requesting a quote from AgriSolar LLC. We're ready to learn more about your solar-site vegetation management needs.

To provide you with an accurate quote, we would like to schedule a brief consultation to discuss your specific requirements in detail. Please let us know what time works best for you in the next few days.

Best regards,
AgriSolar LLC Team`
    },
    followup: {
        subject: "Follow-up Meeting - AgriSolar LLC",
        message: `Dear [Name],

Thank you for your interest in AgriSolar LLC's services. We would like to schedule a follow-up meeting to discuss your project in more detail.

Please let us know your availability for a meeting in the coming days. We can conduct this either virtually or in person, based on your preference.

Looking forward to speaking with you.

Best regards,
AgriSolar LLC Team`
    }
};

document.addEventListener('DOMContentLoaded', function() {
    // Initialize Firebase services
    auth = firebase.auth();
    database = firebase.database();
    functions = firebase.functions();
    storage = firebase.storage();

    // DOM Elements
    const loginContainer = document.getElementById('loginContainer');
    const dashboardContainer = document.getElementById('dashboardContainer');
    const loginForm = document.getElementById('loginForm');
    const emailInput = document.getElementById('email');
    const passwordInput = document.getElementById('password');
    const forgotPasswordBtn = document.getElementById('forgotPasswordBtn');
    const submissionsList = document.getElementById('submissionsList');
    const recipientsList = document.getElementById('recipientsList');
    const addRecipientForm = document.getElementById('addRecipientForm');
    const replyModal = document.getElementById('replyModal');
    const replyForm = document.getElementById('replyForm');
    const replyToSubmissionId = document.getElementById('replyToSubmissionId');
    const replyToEmail = document.getElementById('replyToEmail');
    const replySubject = document.getElementById('replySubject');
    const replyMessage = document.getElementById('replyMessage');
    const closeModal = document.querySelector('.close');
    const cancelReply = document.getElementById('cancelReply');
    const signOutBtn = document.getElementById('signOutBtn');
    const userEmail = document.getElementById('userEmail');
    const navButtons = document.querySelectorAll('.nav-btn');
    const tabContents = document.querySelectorAll('.tab-content');
    const statusFilter = document.getElementById('statusFilter');
    const searchInput = document.getElementById('searchInput');
    const emailTemplateSelect = document.getElementById('emailTemplate');
    const replyAttachmentsGroup = document.getElementById('replyAttachmentsGroup');
    const replyAttachments = document.getElementById('replyAttachments');
    let submissionsCache = {};

    // Auth state observer
    auth.onAuthStateChanged(async (user) => {
        if (user) {
            console.log('User authenticated:', user.email);
            try {
                // Get a fresh token on login
                const idToken = await user.getIdToken();
                console.log('Got fresh token on login');
                
                loginContainer.style.display = 'none';
                dashboardContainer.style.display = 'block';
                loadSubmissions();
                loadRecipients();
            } catch (error) {
                console.error('Error getting token:', error);
                showMessage('Authentication error. Please try logging in again.', 'error');
                await auth.signOut();
            }
        } else {
            console.log('User signed out');
            loginContainer.style.display = 'block';
            dashboardContainer.style.display = 'none';
        }
    });

    // Tab Navigation
    navButtons.forEach(button => {
        button.addEventListener('click', () => {
            const tabId = button.dataset.tab;
            
            // Update button states
            navButtons.forEach(btn => btn.classList.remove('active'));
            button.classList.add('active');
            
            // Update tab content
            tabContents.forEach(tab => {
                if (tab.id === tabId + 'Tab') {
                    tab.classList.add('active');
                } else {
                    tab.classList.remove('active');
                }
            });

            // Load content if needed
            if (tabId === 'distribution') {
                loadRecipients();
            } else if (tabId === 'submissions') {
                loadSubmissions();
            }
        });
    });

    // Login form handler
    loginForm.onsubmit = async (e) => {
        e.preventDefault();
        const email = emailInput.value.trim();
        const password = passwordInput.value;

        try {
            await auth.signInWithEmailAndPassword(email, password);
            showMessage('Logged in successfully!', 'success');
        } catch (error) {
            console.error('Login error:', error);
            showMessage(error.message, 'error');
        }
    };

    // Password reset handler
    forgotPasswordBtn.addEventListener('click', async () => {
        const email = emailInput.value.trim();

        if (!email) {
            showMessage('Enter your admin email address first.', 'error');
            emailInput.focus();
            return;
        }

        const originalText = forgotPasswordBtn.textContent;
        forgotPasswordBtn.textContent = 'Sending reset email...';
        forgotPasswordBtn.disabled = true;

        try {
            await auth.sendPasswordResetEmail(email);
            showMessage('Password reset email sent. Check your inbox and spam folder.', 'success');
        } catch (error) {
            console.error('Password reset error:', error);
            showMessage(error.message, 'error');
        } finally {
            forgotPasswordBtn.textContent = originalText;
            forgotPasswordBtn.disabled = false;
        }
    });

    // Sign out handler
    if (signOutBtn) {
        signOutBtn.onclick = () => {
            auth.signOut().then(() => {
                showMessage('Signed out successfully', 'success');
            }).catch(error => {
                console.error('Sign out error:', error);
                showMessage(error.message, 'error');
            });
        };
    }

    // Load submissions from database
    async function loadSubmissions() {
        try {
            const snapshot = await database.ref('contact_submissions').once('value');
            const submissions = snapshot.val() || {};
            displaySubmissions(submissions);
        } catch (error) {
            console.error('Error loading submissions:', error);
            showMessage('Error loading submissions. Please try again.', 'error');
        }
    }

    // Load recipients from database
    async function loadRecipients() {
        try {
            const snapshot = await database.ref('email_recipients').once('value');
            const recipients = snapshot.val() || {};
            displayRecipients(recipients);
        } catch (error) {
            console.error('Error loading recipients:', error);
            showMessage('Error loading recipients. Please try again.', 'error');
        }
    }

    // Display submissions
    function displaySubmissions(submissions) {
        submissionsCache = submissions;
        if (!Object.keys(submissions).length) {
            submissionsList.innerHTML = '<p>No quote requests found.</p>';
            return;
        }

        submissionsList.innerHTML = Object.entries(submissions).reverse().map(([id, submission]) => `
            <div class="submission-item ${submission.status === 'new' ? 'new' : ''} ${submission.replied ? 'replied' : ''}">
                <div class="submission-header">
                    <span class="timestamp">${new Date(submission.timestamp).toLocaleString()}</span>
                    <span class="status">${submission.status === 'new' ? 'New' : submission.status === 'replied' ? 'Replied' : 'Viewed'}</span>
                    ${submission.replied ? '<span class="replied-badge">Replied</span>' : ''}
                </div>
                <div class="submission-content">
                    <p><strong>Name:</strong> ${escapeHtml(submission.name)}</p>
                    <p><strong>Company:</strong> ${escapeHtml(submission.company || 'Not provided')}</p>
                    <p><strong>Email:</strong> ${escapeHtml(submission.email)}</p>
                    <p><strong>Phone:</strong> ${escapeHtml(submission.phone || 'Not provided')}</p>
                    <p><strong>Solar-site location:</strong> ${escapeHtml(submission.siteLocation || 'Not provided')}</p>
                    <p><strong>Approximate acreage:</strong> ${escapeHtml(submission.acreage || 'Not provided')}</p>
                    <p><strong>Service:</strong> ${escapeHtml(submission.service)}</p>
                    <p><strong>Desired schedule:</strong> ${escapeHtml(submission.schedule || 'Not provided')}</p>
                    <p class="submission-message"><strong>Message:</strong> ${escapeHtml(submission.message)}</p>
                    ${renderAttachments(id, submission.attachments)}
                    ${submission.replied ? `
                        <div class="reply-details">
                            ${submission.replyTimestamp ? `<p><strong>Reply Sent:</strong> ${new Date(submission.replyTimestamp).toLocaleString()}</p>` : ''}
                            ${submission.replySubject ? `<p><strong>Subject:</strong> ${escapeHtml(submission.replySubject)}</p>` : ''}
                            ${submission.replyMessage ? `<p><strong>Message:</strong> ${escapeHtml(submission.replyMessage)}</p>` : ''}
                        </div>
                    ` : ''}
                </div>
                <div class="submission-actions">
                    ${submission.status === 'new' ?
                        `<button type="button" data-action="mark-viewed" data-submission-id="${escapeHtml(id)}">Mark as Viewed</button>` :
                        ''}
                    ${!submission.replied ?
                        `<button type="button" data-action="reply" data-submission-id="${escapeHtml(id)}">Reply</button>` : ''}
                </div>
            </div>
        `).join('');
    }

    // Display recipients
    function displayRecipients(recipients) {
        if (!recipients) {
            recipientsList.innerHTML = '<p>No recipients found</p>';
            return;
        }

        recipientsList.innerHTML = Object.entries(recipients).map(([id, recipient]) => `
            <div class="recipient-item">
                <span>${escapeHtml(recipient.email)}</span>
                <button type="button" data-action="delete-recipient" data-recipient-id="${escapeHtml(id)}">Delete</button>
            </div>
        `).join('');
    }

    // Make functions globally available
    window.markAsViewed = async function(submissionId) {
        try {
            await database.ref(`contact_submissions/${submissionId}`).update({
                status: 'viewed'
            });
            loadSubmissions();
        } catch (error) {
            console.error('Error marking submission as viewed:', error);
            showMessage('Error updating submission status. Please try again.', 'error');
        }
    };

    window.deleteRecipient = async function(recipientId) {
        if (!confirm('Are you sure you want to delete this recipient?')) {
            return;
        }

        try {
            await database.ref(`email_recipients/${recipientId}`).remove();
            showMessage('Recipient deleted successfully!', 'success');
            loadRecipients();
        } catch (error) {
            console.error('Error deleting recipient:', error);
            showMessage('Error deleting recipient. Please try again.', 'error');
        }
    };

    let currentSubmission = null;

    function closeReplyModal() {
        replyModal.style.display = 'none';
        replyForm.reset();
        replyToSubmissionId.value = '';
        replyToEmail.textContent = '';
        replyAttachments.innerHTML = '';
        replyAttachmentsGroup.hidden = true;
        currentSubmission = null;
    }

    closeModal.addEventListener('click', closeReplyModal);
    cancelReply.addEventListener('click', closeReplyModal);

    window.addEventListener('click', function(event) {
        if (event.target === replyModal) {
            closeReplyModal();
        }
    });

    // Function to show reply modal
    window.showReplyModal = async function(submissionId) {
        try {
            const snapshot = await database.ref(`contact_submissions/${submissionId}`).once('value');
            const submission = snapshot.val();

            if (submission) {
                currentSubmission = submission;
                replyModal.style.display = 'block';
                replyToSubmissionId.value = submissionId;
                document.getElementById('replyToEmail').textContent = submission.email;
                replyAttachments.innerHTML = renderAttachments(
                    submissionId,
                    submission.attachments
                );
                replyAttachmentsGroup.hidden = !Array.isArray(submission.attachments)
                    || !submission.attachments.length;

                // Reset form and template selection
                replyForm.reset();
                emailTemplateSelect.value = '';
                replySubject.value = '';
                replyMessage.value = '';
            }
        } catch (error) {
            console.error('Error loading submission:', error);
            showMessage('Error loading submission details', 'error');
        }
    };

    async function openAttachment(submissionId, attachmentIndex, button) {
        const submission = submissionsCache[submissionId] || currentSubmission;
        const attachment = submission?.attachments?.[attachmentIndex];
        const expectedPrefix = `quote-attachments/${submissionId}/`;

        if (!attachment?.path?.startsWith(expectedPrefix)) {
            showMessage('This attachment reference is invalid.', 'error');
            return;
        }

        const previewWindow = window.open('about:blank', '_blank');
        if (previewWindow) {
            previewWindow.opener = null;
            previewWindow.document.title = 'Loading attachment…';
            previewWindow.document.body.textContent = 'Loading attachment…';
        }

        const originalText = button.innerHTML;
        button.disabled = true;
        button.textContent = 'Opening…';

        try {
            const url = await storage.ref(attachment.path).getDownloadURL();
            if (previewWindow) {
                previewWindow.location.replace(url);
            } else {
                showMessage('Allow pop-ups to view this attachment.', 'error');
            }
        } catch (error) {
            previewWindow?.close();
            console.error('Error opening attachment.');
            showMessage('Unable to open this attachment. Please try again.', 'error');
        } finally {
            button.innerHTML = originalText;
            button.disabled = false;
        }
    }

    document.addEventListener('click', (event) => {
        const button = event.target.closest('button[data-action]');
        if (!button) {
            return;
        }

        const submissionId = button.dataset.submissionId;
        if (button.dataset.action === 'mark-viewed') {
            window.markAsViewed(submissionId);
        } else if (button.dataset.action === 'reply') {
            window.showReplyModal(submissionId);
        } else if (button.dataset.action === 'view-attachment') {
            openAttachment(
                submissionId,
                Number(button.dataset.attachmentIndex),
                button
            );
        } else if (button.dataset.action === 'delete-recipient') {
            window.deleteRecipient(button.dataset.recipientId);
        }
    });

    // Add template selection handler
    if (emailTemplateSelect) {
        emailTemplateSelect.addEventListener('change', function() {
            const selectedTemplate = this.value;
            if (selectedTemplate && selectedTemplate !== 'custom') {
                const template = emailTemplates[selectedTemplate];
                const submission = currentSubmission;

                if (template) {
                    replySubject.value = template.subject;
                    let message = template.message;

                    // Replace placeholders with actual values
                    if (submission) {
                        message = message.replace('[Name]', submission.name);
                    }

                    replyMessage.value = message;
                }
            } else if (selectedTemplate === 'custom') {
                replySubject.value = '';
                replyMessage.value = '';
            }
        });
    }

    // Update reply form handler
    replyForm.onsubmit = async function(e) {
        e.preventDefault();

        const recipientEmail = replyToEmail.textContent.trim();
        const confirmed = window.confirm(
            `Send this email now to ${recipientEmail}? This will use the live AgriSolar mailbox.`
        );
        if (!confirmed) {
            return;
        }

        const submitBtn = this.querySelector('button[type="submit"]');
        submitBtn.textContent = 'Sending...';
        submitBtn.disabled = true;

        try {
            const result = await sendReply({
                submissionId: replyToSubmissionId.value,
                subject: replySubject.value,
                message: replyMessage.value
            });

            if (result.success) {
                showMessage('Reply sent successfully!', 'success');
                closeReplyModal();
                loadSubmissions(); // Refresh the submissions list
            } else {
                throw new Error('Failed to send reply');
            }
        } catch (error) {
            console.error('Error sending reply:', error);
            showMessage(error.message || 'Failed to send reply. Please try again.', 'error');
        } finally {
            submitBtn.textContent = 'Send Reply';
            submitBtn.disabled = false;
        }
    };
});

// Helper function to show messages
function showMessage(message, type = 'info') {
    const messageDiv = document.createElement('div');
    messageDiv.className = `message ${type}`;
    messageDiv.textContent = message;
    document.body.appendChild(messageDiv);
    setTimeout(() => messageDiv.remove(), 5000);
}
