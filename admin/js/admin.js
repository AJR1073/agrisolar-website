// Firebase configuration and initialization
let auth;
let database;
let functions;

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

document.addEventListener('DOMContentLoaded', function() {
    // Initialize Firebase services
    auth = firebase.auth();
    database = firebase.database();
    functions = firebase.functions();

    // DOM Elements
    const loginContainer = document.getElementById('loginContainer');
    const dashboardContainer = document.getElementById('dashboardContainer');
    const loginForm = document.getElementById('loginForm');
    const emailInput = document.getElementById('email');
    const passwordInput = document.getElementById('password');
    const submissionsList = document.getElementById('submissionsList');
    const recipientsList = document.getElementById('recipientsList');
    const addRecipientForm = document.getElementById('addRecipientForm');
    const replyModal = document.getElementById('replyModal');
    const replyForm = document.getElementById('replyForm');
    const replyToSubmissionId = document.getElementById('replyToSubmissionId');
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
        const email = emailInput.value;
        const password = passwordInput.value;

        try {
            await auth.signInWithEmailAndPassword(email, password);
            showMessage('Logged in successfully!', 'success');
        } catch (error) {
            console.error('Login error:', error);
            showMessage(error.message, 'error');
        }
    };

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
        submissionsList.innerHTML = Object.entries(submissions).reverse().map(([id, submission]) => `
            <div class="submission-item ${submission.status === 'new' ? 'new' : ''} ${submission.replied ? 'replied' : ''}">
                <div class="submission-header">
                    <span class="timestamp">${new Date(submission.timestamp).toLocaleString()}</span>
                    <span class="status">${submission.status === 'new' ? 'New' : 'Viewed'}</span>
                    ${submission.replied ? '<span class="replied-badge">Replied</span>' : ''}
                </div>
                <div class="submission-content">
                    <p><strong>Name:</strong> ${submission.name}</p>
                    <p><strong>Email:</strong> ${submission.email}</p>
                    <p><strong>Phone:</strong> ${submission.phone || 'Not provided'}</p>
                    <p><strong>Service:</strong> ${submission.service}</p>
                    <p><strong>Message:</strong> ${submission.message}</p>
                    ${submission.replied ? `
                        <div class="reply-details">
                            <p><strong>Reply Sent:</strong> ${new Date(submission.replyTimestamp).toLocaleString()}</p>
                            <p><strong>Subject:</strong> ${submission.replySubject}</p>
                            <p><strong>Message:</strong> ${submission.replyMessage}</p>
                        </div>
                    ` : ''}
                </div>
                <div class="submission-actions">
                    ${submission.status === 'new' ? 
                        `<button onclick="markAsViewed('${id}')">Mark as Viewed</button>` : 
                        ''}
                    ${!submission.replied ? 
                        `<button onclick="showReplyModal('${id}', '${submission.email}')">Reply</button>` : ''}
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
                <span>${recipient.email}</span>
                <button onclick="deleteRecipient('${id}')">Delete</button>
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

    // Function to show reply modal
    window.showReplyModal = function(submissionId, email) {
        const modal = document.createElement('div');
        modal.className = 'modal';
        modal.innerHTML = `
            <div class="modal-content">
                <span class="close">&times;</span>
                <h2>Reply to ${email}</h2>
                <form id="replyForm">
                    <input type="hidden" id="replyToSubmissionId" value="${submissionId}">
                    <div class="form-group">
                        <label for="replySubject">Subject:</label>
                        <input type="text" id="replySubject" required>
                    </div>
                    <div class="form-group">
                        <label for="replyMessage">Message:</label>
                        <textarea id="replyMessage" required></textarea>
                    </div>
                    <button type="submit">Send Reply</button>
                </form>
            </div>
        `;

        document.body.appendChild(modal);
        modal.style.display = 'block';

        const form = modal.querySelector('#replyForm');
        const submitBtn = form.querySelector('button[type="submit"]');
        const closeBtn = modal.querySelector('.close');

        closeBtn.onclick = function() {
            modal.style.display = 'none';
            modal.remove();
        };

        window.onclick = function(event) {
            if (event.target == modal) {
                modal.style.display = 'none';
                modal.remove();
            }
        };

        form.onsubmit = async function(e) {
            e.preventDefault();
            submitBtn.textContent = 'Sending...';
            submitBtn.disabled = true;
            
            try {
                const replyText = replyMessage.value;
                const emailSubject = `Re: Your Inquiry - AgriSolar LLC`;
                const emailBody = `Dear ${email},

Thank you for contacting AgriSolar LLC. We greatly appreciate your interest in our solar energy solutions for agricultural applications.

${replyText}

If you have any additional questions or would like to schedule a consultation, please don't hesitate to reach out. We're here to help you explore sustainable energy solutions for your agricultural needs.

Best regards,

Aaron Reifler
Chief Executive Officer
AgriSolar LLC

Phone: (715) 255-9300
Email: aaron@agrisolarllc.com
Website: www.agrisolarllc.com

This email and any files transmitted with it are confidential and intended solely for the use of the individual or entity to whom they are addressed. If you have received this email in error, please notify the sender immediately and delete this email from your system.`;

                const result = await sendReply({
                    submissionId: submissionId,
                    subject: emailSubject,
                    message: emailBody
                });

                if (result.success) {
                    showMessage('Reply sent successfully!', 'success');
                    modal.remove();
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
