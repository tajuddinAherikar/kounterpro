// Authentication Logic with Supabase

// Global auth state to prevent multiple checks
let authCheckComplete = false;
let isUserAuthenticated = false;

// Fallback showToast function if toast.js is not loaded
if (typeof showToast === 'undefined') {
    window.showToast = function(message, type = 'info') {
        console.log(`[${type.toUpperCase()}] ${message}`);
        // You can enhance this to show actual toast notifications
    };
}

// Check if user is already logged in - SINGLE auth check to prevent race conditions
async function checkAuth() {
    // Prevent multiple auth checks
    if (authCheckComplete) {
        return isUserAuthenticated;
    }
    
    try {
        const currentPage = window.location.pathname.split('/').pop();
        
        // Skip auth check on login and signup pages
        if (currentPage === 'login.html' || currentPage === 'signup.html') {
            const user = await supabaseGetCurrentUser();
            isUserAuthenticated = !!user;
            authCheckComplete = true;
            
            if (user) {
                window.location.href = 'index.html';
            }
            return isUserAuthenticated;
        }
        
        // Check authentication for other pages (dashboard, etc.)
        const user = await supabaseGetCurrentUser();
        isUserAuthenticated = !!user;
        authCheckComplete = true;
        
        if (!user) {
            window.location.href = 'login.html';
            return false;
        }
        
        return true;
    } catch (error) {
        console.error('Auth check error:', error);
        isUserAuthenticated = false;
        authCheckComplete = true;
        
        // If there's an error, redirect to login
        const currentPage = window.location.pathname.split('/').pop();
        if (currentPage !== 'login.html' && currentPage !== 'signup.html') {
            window.location.href = 'login.html';
        }
        return false;
    }
}

// Login form handler
document.addEventListener('DOMContentLoaded', function() {
    // Check authentication on page load (once)
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
        // Reset auth check state for fresh dashboard load
        authCheckComplete = false;
        isUserAuthenticated = false;
        clearUserCache(); // Clear cache to force fresh auth check
        
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
    const confirmed = await showLogoutConfirm();
    if (confirmed) {
        await supabaseSignOut();
        
        // Reset auth check state for fresh login
        authCheckComplete = false;
        isUserAuthenticated = false;
        clearUserCache(); // Clear user cache from supabase.js
        
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
            
            // Find header-right and add user profile button
            const headerRight = document.querySelector('.header-right');
            if (headerRight && !document.getElementById('userProfileButton')) {
                const userProfileContainer = document.createElement('div');
                userProfileContainer.className = 'user-profile-dropdown';
                userProfileContainer.innerHTML = `
                    <button class="user-profile-button" id="userProfileButton" onclick="window.location.href='profile.html'">
                        <span class="user-profile-text">Welcome, ${businessName}</span>
                        <div class="user-avatar">
                            <span class="material-icons">account_circle</span>
                        </div>
                    </button>
                `;
                headerRight.appendChild(userProfileContainer);
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

// ============================================
// GOOGLE OAUTH FUNCTIONS (Phase 1 - New)
// ============================================

/**
 * Sign up / Login with Google
 */
async function signUpWithGoogle() {
    try {
        console.log('🔵 Starting Google OAuth sign-up...');
        
        const result = await supabaseSignInWithGoogle();
        
        if (!result.success) {
            console.error('❌ Google OAuth error:', result.error);
            showToast('Google sign-up failed: ' + result.error, 'error');
            return;
        }

        console.log('✅ Redirecting to Google Auth...');
        // Supabase automatically redirects to Google consent screen
    } catch (error) {
        console.error('❌ Error in signUpWithGoogle:', error);
        showToast('An error occurred. Please try again.', 'error');
    }
}

/**
 * Handle OAuth callback (runs on all pages after OAuth redirect)
 */
async function handleOAuthCallback() {
    try {
        // Get current session
        const sessionResult = await supabaseGetSessionData();

        if (!sessionResult.success || !sessionResult.data) {
            // No active session, user not logged in via OAuth
            return;
        }

        const session = sessionResult.data;
        const user = session.user;
        console.log('✅ OAuth session found for user:', user.email);

        // Check if user_profile exists
        const profileResult = await supabaseGetUserProfile(user.id);

        if (!profileResult.success || !profileResult.data) {
            // New user from OAuth - create profile
            console.log('👤 Creating user_profile for new OAuth user...');
            
            const createResult = await supabaseCreateOAuthUserProfile(user);

            if (!createResult.success) {
                console.error('❌ Error creating user profile:', createResult.error);
                showToast('Welcome! Please complete your profile.', 'info');
            } else {
                console.log('✅ User profile created successfully');
            }
        } else {
            console.log('✅ User profile already exists');
        }

        // Update last login
        const updateResult = await supabaseUpdateUserProfile(user.id, {
            last_login_at: new Date().toISOString(),
            last_login_ip: await getClientIp()
        });

        if (!updateResult.success) {
            console.warn('⚠️ Could not update last login:', updateResult.error);
        }

        // Only redirect if we're on a non-dashboard page
        const currentPage = window.location.pathname;
        if (currentPage.includes('signup') || currentPage.includes('login') || currentPage.includes('forgot-password')) {
            console.log('📍 Redirecting to dashboard...');
            // Build the correct redirect URL for both local dev and GitHub Pages
            const isDev = window.location.hostname === 'localhost' || window.location.hostname === '127.0.0.1';
            const dashboardUrl = isDev 
                ? '/src/pages/index.html'
                : '/kounterpro/src/pages/index.html';
            console.log('📍 Dashboard URL:', dashboardUrl);
            window.location.href = dashboardUrl;
        }

    } catch (error) {
        console.error('❌ OAuth callback error:', error);
        // Don't show error - callback runs on every page load
    }
}

/**
 * Get client IP for logging
 */
async function getClientIp() {
    try {
        const response = await fetch('https://api.ipify.org?format=json', {
            method: 'GET',
            headers: { 'Accept': 'application/json' }
        });
        const data = await response.json();
        return data.ip;
    } catch (error) {
        console.warn('⚠️ Could not get IP:', error);
        return 'unknown';
    }
}

/**
 * Link Google OAuth to existing account (for later use)
 */
async function linkGoogleOAuthAccount() {
    try {
        console.log('🔗 Linking Google account to existing user...');
        
        const result = await supabaseLinkIdentity('google');

        if (!result.success) {
            console.error('❌ Linking error:', result.error);
            showToast('Failed to link Google account: ' + result.error, 'error');
            return;
        }

        console.log('✅ Google account linked successfully');
        showToast('Google account linked successfully!', 'success');

    } catch (error) {
        console.error('❌ Error linking Google account:', error);
        showToast('An error occurred', 'error');
    }
}

// ============================================
// PASSWORD RESET FUNCTIONS (Phase 2)
// ============================================

/**
 * Request a password reset link via email
 * Uses Supabase's built-in password reset which is more secure
 * @param {string} email - User's email address
 * @returns {Promise<{success: boolean, error?: string}>}
 */
async function requestPasswordReset(email) {
    try {
        const client = await ensureSupabaseReady();
        if (!client) throw new Error('Supabase client not initialized');

        // Use Supabase's built-in password reset
        // This sends an email with a magic link
        const { error } = await client.auth.resetPasswordForEmail(email, {
            redirectTo: `${window.location.origin}/src/pages/reset-password.html`
        });

        if (error) {
            console.error('Password reset error:', error);
            // Return success anyway to not reveal if email exists (privacy)
            return { success: true };
        }

        console.log('✅ Password reset email sent to:', email);
        return { success: true };
    } catch (error) {
        console.error('❌ Error requesting password reset:', error);
        // For security, always return success to not reveal if email exists
        return { success: true };
    }
}

/**
 * Validate password strength
 * @param {string} password - Password to validate
 * @returns {{valid: boolean, errors: string[]}}
 */
function validatePasswordStrength(password) {
    const errors = [];

    if (password.length < 8) {
        errors.push('Password must be at least 8 characters');
    }

    if (!/[A-Z]/.test(password)) {
        errors.push('Password must contain uppercase letter');
    }

    if (!/[a-z]/.test(password)) {
        errors.push('Password must contain lowercase letter');
    }

    if (!/\d/.test(password)) {
        errors.push('Password must contain number');
    }

    if (!/[!@#$%^&*(),.?":{}|<>]/.test(password)) {
        errors.push('Password must contain special character');
    }

    return {
        valid: errors.length === 0,
        errors
    };
}

/**
 * Complete password reset with new password
 * Uses the recovery session from the email reset link
 * @param {string} newPassword - New password
 * @returns {Promise<{success: boolean, error?: string}>}
 */
async function completePasswordReset(newPassword) {
    try {
        // Validate password strength first
        const validation = validatePasswordStrength(newPassword);
        if (!validation.valid) {
            return { 
                success: false, 
                error: validation.errors[0]
            };
        }

        const client = await ensureSupabaseReady();
        if (!client) throw new Error('Supabase client not initialized');

        // User should have a recovery session from the email reset link
        // Update password using that session
        const { error: updateError } = await client.auth.updateUser({
            password: newPassword
        });

        if (updateError) {
            throw new Error(updateError.message || 'Failed to update password');
        }

        console.log('✅ Password reset completed successfully');

        // Logout user to force re-login with new password
        await client.auth.signOut().catch(err => {
            console.warn('Could not sign out:', err);
        });

        return { success: true };
    } catch (error) {
        console.error('❌ Error completing password reset:', error);
        return { 
            success: false, 
            error: error.message || 'Failed to reset password'
        };
    }
}

// Initialize OAuth handlers when page loads
document.addEventListener('DOMContentLoaded', () => {
    // Attach Google signup button listener
    const googleSignUpBtn = document.getElementById('googleSignUpBtn');
    if (googleSignUpBtn) {
        googleSignUpBtn.addEventListener('click', (e) => {
            e.preventDefault();
            signUpWithGoogle();
        });
        console.log('✅ Google sign-up button initialized');
    }

    // Handle OAuth callback - but NOT on auth pages
    const currentPage = window.location.pathname;
    const isAuthPage = currentPage.includes('login') || 
                       currentPage.includes('signup') || 
                       currentPage.includes('forgot-password') ||
                       currentPage.includes('reset-password');
    
    if (!isAuthPage) {
        // Only check OAuth callback on non-auth pages
        // Ensure Supabase is ready before handling the OAuth callback
        ensureSupabaseReady().then(() => {
            handleOAuthCallback();
        }).catch(error => {
            console.error('❌ Error ensuring Supabase ready for OAuth callback:', error);
        });
    }
});
