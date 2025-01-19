document.addEventListener('DOMContentLoaded', function() {
    // DOM Elements
    const loginContainer = document.getElementById('loginContainer');
    const dashboardContainer = document.getElementById('dashboardContainer');
    const loginForm = document.getElementById('loginForm');
    const loginError = document.getElementById('loginError');
    const userEmail = document.getElementById('userEmail');
    const signOutBtn = document.getElementById('signOutBtn');
    const statusFilter = document.getElementById('statusFilter');
    const searchInput = document.getElementById('searchInput');
    const submissionsList = document.getElementById('submissionsList');
    const addRecipientBtn = document.getElementById('addRecipientBtn');
    const addRecipientForm = document.getElementById('addRecipientForm');
    const recipientForm = document.getElementById('recipientForm');
    const cancelAddRecipient = document.getElementById('cancelAddRecipient');
    const recipientsList = document.getElementById('recipientsList');
    const navButtons = document.querySelectorAll('.nav-btn');
    const tabContents = document.querySelectorAll('.tab-content');

    // Initialize Firebase
    const auth = firebase.auth();
    const database = firebase.database();
    let currentUser = null;

    // Auth state observer
    auth.onAuthStateChanged(function(user) {
        if (user) {
            currentUser = user;
            showDashboard(user);
        } else {
            showLogin();
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
    loginForm.addEventListener('submit', async function(e) {
        e.preventDefault();
        const email = document.getElementById('email').value;
        const password = document.getElementById('password').value;

        try {
            const button = loginForm.querySelector('button[type="submit"]');
            button.disabled = true;
            button.textContent = 'Signing in...';
            
            await auth.signInWithEmailAndPassword(email, password);
            loginError.textContent = '';
        } catch (error) {
            loginError.textContent = error.message;
        } finally {
            const button = loginForm.querySelector('button[type="submit"]');
            button.disabled = false;
            button.textContent = 'Login';
        }
    });

    // Sign out handler
    signOutBtn.addEventListener('click', function() {
        auth.signOut();
    });

    // Add Recipient Form
    addRecipientBtn.addEventListener('click', () => {
        addRecipientForm.style.display = 'block';
        addRecipientBtn.style.display = 'none';
    });

    cancelAddRecipient.addEventListener('click', () => {
        addRecipientForm.style.display = 'none';
        addRecipientBtn.style.display = 'block';
        recipientForm.reset();
    });

    recipientForm.addEventListener('submit', async function(e) {
        e.preventDefault();
        const name = document.getElementById('recipientName').value.trim();
        const email = document.getElementById('recipientEmail').value.trim();

        try {
            const newRecipient = {
                name,
                email,
                addedBy: currentUser.email,
                addedAt: firebase.database.ServerValue.TIMESTAMP
            };

            await database.ref('email_recipients').push().set(newRecipient);
            showMessage('Recipient added successfully!', 'success');
            recipientForm.reset();
            addRecipientForm.style.display = 'none';
            addRecipientBtn.style.display = 'block';
            loadRecipients();
        } catch (error) {
            console.error('Error adding recipient:', error);
            showMessage('Error adding recipient. Please try again.', 'error');
        }
    });

    // Filter and search handlers
    statusFilter.addEventListener('change', loadSubmissions);
    searchInput.addEventListener('input', loadSubmissions);

    function showLogin() {
        loginContainer.style.display = 'flex';
        dashboardContainer.style.display = 'none';
        signOutBtn.style.display = 'none';
        userEmail.textContent = '';
    }

    function showDashboard(user) {
        loginContainer.style.display = 'none';
        dashboardContainer.style.display = 'block';
        signOutBtn.style.display = 'block';
        userEmail.textContent = user.email;
        loadSubmissions();
    }

    async function loadSubmissions() {
        const statusValue = statusFilter.value;
        const searchValue = searchInput.value.toLowerCase();

        try {
            const snapshot = await database.ref('contact_submissions').once('value');
            const submissions = snapshot.val() || {};
            
            // Convert to array and sort by timestamp
            let submissionsArray = Object.entries(submissions)
                .map(([id, data]) => ({ id, ...data }))
                .sort((a, b) => b.timestamp - a.timestamp);

            // Filter by status
            if (statusValue !== 'all') {
                submissionsArray = submissionsArray.filter(s => s.status === statusValue);
            }

            // Filter by search
            if (searchValue) {
                submissionsArray = submissionsArray.filter(s => 
                    s.name?.toLowerCase().includes(searchValue) ||
                    s.email?.toLowerCase().includes(searchValue) ||
                    s.phone?.toLowerCase().includes(searchValue) ||
                    s.service?.toLowerCase().includes(searchValue) ||
                    s.message?.toLowerCase().includes(searchValue)
                );
            }

            displaySubmissions(submissionsArray);
        } catch (error) {
            console.error('Error loading submissions:', error);
            submissionsList.innerHTML = '<p class="error">Error loading submissions. Please try again.</p>';
        }
    }

    async function loadRecipients() {
        try {
            const snapshot = await database.ref('email_recipients').once('value');
            const recipients = snapshot.val() || {};
            
            // Convert to array and sort by name
            const recipientsArray = Object.entries(recipients)
                .map(([id, data]) => ({ id, ...data }))
                .sort((a, b) => a.name.localeCompare(b.name));

            displayRecipients(recipientsArray);
        } catch (error) {
            console.error('Error loading recipients:', error);
            recipientsList.innerHTML = '<p class="error">Error loading recipients. Please try again.</p>';
        }
    }

    function displaySubmissions(submissions) {
        if (!submissions.length) {
            submissionsList.innerHTML = '<p class="no-data">No submissions found.</p>';
            return;
        }

        const html = submissions.map(submission => `
            <div class="submission-card ${submission.status}" data-id="${submission.id}">
                <div class="submission-header">
                    <h3>${submission.name}</h3>
                    <span class="timestamp">${new Date(submission.timestamp).toLocaleString()}</span>
                </div>
                <div class="submission-content">
                    <p><strong>Email:</strong> ${submission.email}</p>
                    <p><strong>Phone:</strong> ${submission.phone || 'Not provided'}</p>
                    <p><strong>Service:</strong> ${submission.service}</p>
                    <p><strong>Message:</strong> ${submission.message}</p>
                </div>
                <div class="submission-footer">
                    <span class="status">${submission.status}</span>
                    ${submission.status === 'new' ? 
                        `<button onclick="markAsViewed('${submission.id}')">Mark as Viewed</button>` : 
                        ''}
                </div>
            </div>
        `).join('');

        submissionsList.innerHTML = html;
    }

    function displayRecipients(recipients) {
        if (!recipients.length) {
            recipientsList.innerHTML = '<p class="no-data">No recipients found.</p>';
            return;
        }

        const html = recipients.map(recipient => `
            <div class="recipient-card" data-id="${recipient.id}">
                <div class="recipient-info">
                    <h4>${recipient.name}</h4>
                    <p>${recipient.email}</p>
                </div>
                <div class="recipient-actions">
                    <button onclick="deleteRecipient('${recipient.id}')" class="delete" title="Delete Recipient">
                        <i class="fas fa-trash"></i>
                    </button>
                </div>
            </div>
        `).join('');

        recipientsList.innerHTML = html;
    }

    function showMessage(message, type) {
        let messageContainer = document.getElementById('messageContainer');
        
        if (!messageContainer) {
            messageContainer = document.createElement('div');
            messageContainer.id = 'messageContainer';
            messageContainer.className = 'message-container';
            document.body.appendChild(messageContainer);
        }
        
        const messageElement = document.createElement('div');
        messageElement.className = `message ${type}`;
        messageElement.textContent = message;
        
        messageContainer.appendChild(messageElement);
        
        setTimeout(() => {
            messageElement.remove();
            if (!messageContainer.hasChildNodes()) {
                messageContainer.remove();
            }
        }, 5000);
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
});
