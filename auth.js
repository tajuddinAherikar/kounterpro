// Authentication Logic with Supabase

// Check if user is already logged in
async function checkAuth() {
    const currentPage = window.location.pathname.split('/').pop();
    
    // Skip auth check on login and signup pages
    if (currentPage === 'login.html' || currentPage === 'signup.html') {
        const session = await supabaseGetSession();
        if (session) {
            window.location.href = 'index.html';
        }
        return;
    }
    
    // Check authentication for other pages
    const session = await supabaseGetSession();
    if (!session) {
        window.location.href = 'login.html';
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
async function handleLogin(e) {
    e.preventDefault();
    
    const username = document.getElementById('username').value.trim();
    const password = document.getElementById('password').value;
    const errorMessage = document.getElementById('errorMessage');
    
    // Show loading
    const submitBtn = e.target.querySelector('button[type="submit"]');
    const originalText = submitBtn.textContent;
    submitBtn.textContent = 'Signing in...';
    submitBtn.disabled = true;
    
    // Sign in with Supabase
    const result = await supabaseSignIn(username, password);
    
    if (result.success) {
        // Redirect to dashboard
        window.location.href = 'index.html';
    } else {
        // Show error
        errorMessage.textContent = result.error || 'Invalid email or password';
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
        
        // Reset button
        submitBtn.textContent = originalText;
        submitBtn.disabled = false;
    }
}

// Logout function
async function logout() {
    if (confirm('Are you sure you want to logout?')) {
        await supabaseSignOut();
        window.location.href = 'login.html';
    }
}

// Add logout button to pages
async function addLogoutButton() {
    const currentPage = window.location.pathname.split('/').pop();
    if (currentPage !== 'login.html') {
        const user = await supabaseGetCurrentUser();
        if (user) {
            // Find header and add user info
            const header = document.querySelector('header h1');
            if (header && !header.parentElement.querySelector('.user-info')) {
                const userInfo = document.createElement('div');
                userInfo.className = 'user-info';
                userInfo.style.cssText = 'display: flex; align-items: center; gap: 15px; font-size: 14px;';
                userInfo.innerHTML = `
                    <span style="color: #555;">Welcome, <strong>${user.email}</strong></span>
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
