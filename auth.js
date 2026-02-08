// Authentication Logic

// Hardcoded credentials (for now)
const VALID_USERNAME = 'keen';
const VALID_PASSWORD = '12345';

// Check if user is already logged in
function checkAuth() {
    const isLoggedIn = sessionStorage.getItem('isLoggedIn');
    const currentPage = window.location.pathname.split('/').pop();
    
    if (!isLoggedIn && currentPage !== 'login.html') {
        window.location.href = 'login.html';
    } else if (isLoggedIn && currentPage === 'login.html') {
        window.location.href = 'index.html';
    }
}

// Login form handler
document.addEventListener('DOMContentLoaded', function() {
    // Check authentication on page load
    checkAuth();
    
    const loginForm = document.getElementById('loginForm');
    if (loginForm) {
        loginForm.addEventListener('submit', handleLogin);
    }
});

// Handle login
function handleLogin(e) {
    e.preventDefault();
    
    const username = document.getElementById('username').value.trim();
    const password = document.getElementById('password').value;
    const errorMessage = document.getElementById('errorMessage');
    
    // Validate credentials
    if (username === VALID_USERNAME && password === VALID_PASSWORD) {
        // Set session
        sessionStorage.setItem('isLoggedIn', 'true');
        sessionStorage.setItem('username', username);
        sessionStorage.setItem('loginTime', new Date().toISOString());
        
        // Redirect to dashboard
        window.location.href = 'index.html';
    } else {
        // Show error
        errorMessage.textContent = 'Invalid username or password';
        errorMessage.style.display = 'block';
        
        // Shake animation
        const loginBox = document.querySelector('.login-box');
        loginBox.style.animation = 'shake 0.5s';
        setTimeout(() => {
            loginBox.style.animation = '';
        }, 500);
        
        // Clear password field
        document.getElementById('password').value = '';
        document.getElementById('password').focus();
    }
}

// Logout function
function logout() {
    if (confirm('Are you sure you want to logout?')) {
        sessionStorage.removeItem('isLoggedIn');
        sessionStorage.removeItem('username');
        sessionStorage.removeItem('loginTime');
        window.location.href = 'login.html';
    }
}

// Add logout button to pages
function addLogoutButton() {
    const currentPage = window.location.pathname.split('/').pop();
    if (currentPage !== 'login.html') {
        const username = sessionStorage.getItem('username');
        if (username) {
            // Find header and add user info
            const header = document.querySelector('header h1');
            if (header) {
                const userInfo = document.createElement('div');
                userInfo.style.cssText = 'display: flex; align-items: center; gap: 15px; font-size: 14px;';
                userInfo.innerHTML = `
                    <span style="color: #555;">Welcome, <strong>${username}</strong></span>
                    <button class="btn-secondary" onclick="logout()" style="padding: 8px 15px;">Logout</button>
                `;
                header.parentElement.appendChild(userInfo);
            }
        }
    }
}

// Initialize logout button on page load
if (document.readyState === 'loading') {
    document.addEventListener('DOMContentLoaded', addLogoutButton);
} else {
    addLogoutButton();
}
