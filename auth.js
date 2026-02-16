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
    
    const usernameInput = document.getElementById('username').value.trim();
    const password = document.getElementById('password').value;
    const errorMessage = document.getElementById('errorMessage');
    
    // Show loading
    const submitBtn = e.target.querySelector('button[type="submit"]');
    const originalText = submitBtn.textContent;
    submitBtn.textContent = 'Signing in...';
    submitBtn.disabled = true;
    
    // Determine if input is mobile number (10 digits) or email
    const isMobile = /^[0-9]{10}$/.test(usernameInput);
    
    // If mobile, we need to find the email from user_profiles table first
    let emailToLogin = usernameInput;
    
    if (isMobile) {
        // Query user_profiles to find email by mobile number
        const { data, error } = await supabaseClient
            .from('user_profiles')
            .select('email')
            .eq('mobile', usernameInput)
            .single();
        
        if (error || !data) {
            errorMessage.textContent = 'Mobile number not found. Please check and try again.';
            errorMessage.style.display = 'block';
            submitBtn.textContent = originalText;
            submitBtn.disabled = false;
            return;
        }
        
        emailToLogin = data.email;
    }
    
    // Sign in with Supabase using email
    const result = await supabaseSignIn(emailToLogin, password);
    
    if (result.success) {
        // Redirect to dashboard
        window.location.href = 'index.html';
    } else {
        // Show error
        errorMessage.textContent = 'Invalid mobile/email or password';
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

// Add user profile dropdown to pages
async function addUserProfileDropdown() {
    const currentPage = window.location.pathname.split('/').pop();
    if (currentPage !== 'login.html' && currentPage !== 'signup.html') {
        const user = await supabaseGetCurrentUser();
        if (user) {
            // Get user profile for business name
            const profileResult = await supabaseGetUserProfile(user.id);
            const businessName = profileResult.success && profileResult.data?.business_name 
                ? profileResult.data.business_name 
                : 'Business Name';
            
            // Find header-right and add user profile dropdown
            const headerRight = document.querySelector('.header-right');
            if (headerRight && !document.getElementById('userProfileButton')) {
                const userProfileContainer = document.createElement('div');
                userProfileContainer.className = 'user-profile-dropdown';
                userProfileContainer.innerHTML = `
                    <button class="user-profile-button" id="userProfileButton">
                        <span class="user-profile-text">Welcome, ${businessName}</span>
                        <div class="user-avatar">
                            <span class="material-icons">account_circle</span>
                        </div>
                    </button>
                    <div class="user-profile-menu" id="userProfileMenu">
                        <a href="profile.html" class="profile-menu-item">
                            <span class="material-icons">person</span>
                            <span>Profile</span>
                        </a>
                        <a href="#" onclick="logout(); return false;" class="profile-menu-item">
                            <span class="material-icons">logout</span>
                            <span>Logout</span>
                        </a>
                    </div>
                `;
                headerRight.appendChild(userProfileContainer);
                
                // Add click handler for dropdown
                const profileButton = document.getElementById('userProfileButton');
                const profileMenu = document.getElementById('userProfileMenu');
                
                profileButton.addEventListener('click', (e) => {
                    e.stopPropagation();
                    profileMenu.classList.toggle('show');
                });
                
                // Close dropdown when clicking outside
                document.addEventListener('click', () => {
                    profileMenu.classList.remove('show');
                });
            }
        }
    }
}

// Initialize user profile dropdown on page load
if (document.readyState === 'loading') {
    document.addEventListener('DOMContentLoaded', addUserProfileDropdown);
} else {
    addUserProfileDropdown();
}
