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
    const submissionsList = document.getElementById('submissions-container');
    const recipientsList = document.getElementById('recipientsList');
    const addRecipientForm = document.getElementById('addRecipientForm');
    const replyModal = document.getElementById('replyModal');
    const replyForm = document.getElementById('replyForm');
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
        const submissionsContainer = document.getElementById('submissions-container');
        submissionsContainer.innerHTML = '';

        Object.entries(submissions).forEach(([id, submission]) => {
            const messageDiv = document.createElement('div');
            messageDiv.id = `message-${id}`;
            messageDiv.className = 'message-card';
            
            const date = new Date(submission.timestamp);
            const formattedDate = date.toLocaleDateString() + ' ' + date.toLocaleTimeString();

            messageDiv.innerHTML = `
                <div class="message-header">
                    <span class="timestamp">${formattedDate}</span>
                    <span class="reply-status">${submission.replied ? 'Replied' : 'New'}</span>
                </div>
                <div class="message-content">
                    <p><strong>Name:</strong> ${submission.name}</p>
                    <p><strong>Email:</strong> ${submission.email}</p>
                    <p><strong>Phone:</strong> ${submission.phone}</p>
                    <p><strong>Message:</strong> ${submission.message}</p>
                </div>
                <div class="message-actions">
                    <button onclick="openReplyModal('${id}', ${JSON.stringify(submission).replace(/"/g, '&quot;')})">Reply</button>
                </div>
            `;

            submissionsContainer.appendChild(messageDiv);
        });
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
    window.openReplyModal = function(submissionId, submission) {
        const modal = document.getElementById('replyModal');
        const form = document.getElementById('replyForm');
        const replyMessage = document.getElementById('replyMessage');
        
        // Set submission ID for reference
        document.getElementById('submissionId').value = submissionId;
        
        // Pre-fill the reply message with a template
        replyMessage.value = `Thank you for your interest in our solar energy solutions. I understand you'd like to learn more about ${getTopicFromMessage(submission.message)}.

I'd be happy to discuss this with you in detail. Based on your message, I believe we can help you ${getValuePropositionFromMessage(submission.message)}.

Would you be available for a brief phone call to discuss your specific needs and how we can best assist you? I can explain our solutions in more detail and answer any questions you may have.`;

        modal.style.display = 'block';
    };

    // Helper function to identify the main topic from the message
    function getTopicFromMessage(message) {
        message = message.toLowerCase();
        if (message.includes('cost') || message.includes('price') || message.includes('expensive')) {
            return 'solar energy investment and cost savings';
        } else if (message.includes('install') || message.includes('setup')) {
            return 'our solar installation process';
        } else if (message.includes('farm') || message.includes('agriculture') || message.includes('crop')) {
            return 'agricultural solar solutions';
        } else {
            return 'solar energy solutions for your property';
        }
    }

    // Helper function to generate a relevant value proposition
    function getValuePropositionFromMessage(message) {
        message = message.toLowerCase();
        if (message.includes('cost') || message.includes('price') || message.includes('expensive')) {
            return 'maximize your energy savings while minimizing upfront costs';
        } else if (message.includes('install') || message.includes('setup')) {
            return 'ensure a smooth and efficient installation process';
        } else if (message.includes('farm') || message.includes('agriculture') || message.includes('crop')) {
            return 'optimize your agricultural operations with solar energy';
        } else {
            return 'create a customized solar solution that meets your specific needs';
        }
    }

    // Function to submit reply
    async function submitReply(event) {
        event.preventDefault();
        
        const submissionId = document.getElementById('submissionId').value;
        const replyMessage = document.getElementById('replyMessage');
        const submitBtn = event.submitter;
        
        if (!submissionId || !replyMessage.value.trim()) {
            showNotification('Please fill in all required fields', 'error');
            return;
        }
        
        submitBtn.disabled = true;
        
        try {
            const submission = await getSubmissionById(submissionId);
            if (!submission) {
                throw new Error('Submission not found');
            }

            const emailSubject = `Re: Your Inquiry - AgriSolar LLC`;
            const emailBody = `Dear ${submission.name},

Thank you for contacting AgriSolar LLC. We greatly appreciate your interest in our solar energy solutions for agricultural applications.

${replyMessage.value}

If you have any additional questions or would like to schedule a consultation, please don't hesitate to reach out. We're here to help you explore sustainable energy solutions for your agricultural needs.

Best regards,

Aaron Reifler
Chief Executive Officer
AgriSolar LLC

Phone: (715) 255-9300
Email: aaron@agrisolarllc.com
Website: www.agrisolarllc.com

This email and any files transmitted with it are confidential and intended solely for the use of the individual or entity to whom they are addressed. If you have received this email in error, please notify the sender immediately and delete this email from your system.`;

            const sendReplyFunction = httpsCallable(functions, 'sendReply');
            const result = await sendReplyFunction({
                to: submission.email,
                subject: emailSubject,
                message: emailBody
            });

            if (result.data.success) {
                // Update submission status in database
                await updateSubmissionStatus(submissionId, true);
                
                // Update UI
                const messageElement = document.getElementById(`message-${submissionId}`);
                if (messageElement) {
                    const replyStatus = messageElement.querySelector('.reply-status');
                    if (replyStatus) {
                        replyStatus.textContent = 'Replied';
                        replyStatus.style.color = 'green';
                    }
                }
                
                // Close modal
                const modal = document.getElementById('replyModal');
                modal.style.display = 'none';
                
                showNotification('Reply sent successfully!', 'success');
            } else {
                throw new Error('Failed to send reply');
            }
        } catch (error) {
            console.error('Error:', error);
            showNotification('Error sending reply: ' + error.message, 'error');
        } finally {
            submitBtn.disabled = false;
        }
    }

    // Function to get submission by ID
    async function getSubmissionById(submissionId) {
        try {
            const snapshot = await database.ref(`contact_submissions/${submissionId}`).once('value');
            return snapshot.val();
        } catch (error) {
            console.error('Error getting submission:', error);
            return null;
        }
    }

    // Function to update submission status
    async function updateSubmissionStatus(submissionId, replied) {
        try {
            await database.ref(`contact_submissions/${submissionId}`).update({
                replied: replied
            });
        } catch (error) {
            console.error('Error updating submission status:', error);
        }
    }

    // Helper function to show messages
    function showMessage(message, type = 'info') {
        const messageDiv = document.createElement('div');
        messageDiv.className = `message ${type}`;
        messageDiv.textContent = message;
        document.body.appendChild(messageDiv);
        setTimeout(() => messageDiv.remove(), 5000);
    }

    // Helper function to show notifications
    function showNotification(message, type = 'info') {
        const notificationDiv = document.createElement('div');
        notificationDiv.className = `notification ${type}`;
        notificationDiv.textContent = message;
        document.body.appendChild(notificationDiv);
        setTimeout(() => notificationDiv.remove(), 5000);
    }
});
