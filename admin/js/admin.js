document.addEventListener('DOMContentLoaded', function() {
    // DOM Elements
    const loginContainer = document.getElementById('loginContainer');
    const dashboardContainer = document.getElementById('dashboardContainer');
    const loginForm = document.getElementById('loginForm');
    const loginError = document.getElementById('loginError');
    const userEmail = document.getElementById('userEmail');
    const signOutBtn = document.getElementById('signOutBtn');
    const googleSignInBtn = document.getElementById('googleSignIn');
    const statusFilter = document.getElementById('statusFilter');
    const searchInput = document.getElementById('searchInput');
    const submissionsList = document.getElementById('submissionsList');

    // Initialize Firebase Auth
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
            button.textContent = 'Login with Email';
        }
    });

    // Sign out handler
    signOutBtn.addEventListener('click', function() {
        auth.signOut();
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

    // Make markAsViewed function globally available
    window.markAsViewed = async function(submissionId) {
        try {
            await database.ref(`contact_submissions/${submissionId}`).update({
                status: 'viewed'
            });
            loadSubmissions(); // Reload the list
        } catch (error) {
            console.error('Error marking submission as viewed:', error);
            alert('Error updating submission status. Please try again.');
        }
    };
});
