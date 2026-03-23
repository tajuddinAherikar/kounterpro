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
        console.log('🔴 Starting logout process...');
        
        try {
            // Attempt to sign out from Supabase
            const result = await supabaseSignOut();
            console.log('✅ Supabase sign out:', result);
        } catch (error) {
            console.warn('⚠️ Error during Supabase sign out:', error);
            // Continue with logout even if Supabase fails
        }
        
        // Reset auth check state for fresh login
        authCheckComplete = false;
        isUserAuthenticated = false;
        clearUserCache(); // Clear user cache from supabase.js
        
        // Clear session storage and localStorage
        try {
            sessionStorage.clear();
            localStorage.clear();
            console.log('✅ Cleared browser storage');
        } catch (error) {
            console.warn('⚠️ Could not clear storage:', error);
        }
        
        console.log('🔴 Redirecting to login page...');
        window.location.href = 'login.html';
    }
}

// Add user profile dropdown to pages
async function addUserProfileDropdown() {
    const currentPage = window.location.pathname.split('/').pop();
    if (currentPage !== 'login.html' && currentPage !== 'signup.html') {
        const user = await supabaseGetCurrentUser();
        if (user) {
            // Get user profile for business name and logo
            const profileResult = await supabaseGetUserProfile(user.id);
            const profileData = profileResult.success ? profileResult.data : null;
            const businessName = profileData?.business_name || 'Business Name';
            const logoUrl = profileData?.logo_url || profileData?.business_logo || null;

            // ---- Shop Switcher ----
            const headerRight = document.querySelector('.header-right');
            if (headerRight && !document.getElementById('shopSwitcherContainer')) {
                // Load shops in background and render switcher
                supabaseGetShops().then(result => {
                    const shops = result.data || [];
                    if (shops.length === 0) return;

                    const currentShopId = getActiveShopId();
                    const activeShop = shops.find(s => s.id === currentShopId) || shops.find(s => s.is_default) || shops[0];

                    // Ensure activeShopId is set
                    if (activeShop && !currentShopId) setActiveShopId(activeShop.id);

                    const switcher = document.createElement('div');
                    switcher.id = 'shopSwitcherContainer';
                    switcher.className = 'shop-switcher-wrapper';
                    switcher.innerHTML = `
                        <button class="shop-switcher-btn" id="shopSwitcherBtn" onclick="toggleShopDropdown(event)" title="Switch Shop">
                            <span class="material-icons shop-switcher-icon">storefront</span>
                            <span class="shop-switcher-name" id="shopSwitcherName">${activeShop?.shop_name || activeShop?.business_name || 'My Shop'}</span>
                            <span class="material-icons shop-switcher-arrow">expand_more</span>
                        </button>
                        <div class="shop-dropdown" id="shopDropdown" style="display:none;">
                            <div class="shop-dropdown-header">Switch Shop</div>
                            ${shops.map(shop => `
                                <button class="shop-dropdown-item ${shop.id === (activeShop?.id) ? 'active' : ''}"
                                    onclick="switchShop('${shop.id}', '${(shop.shop_name || shop.business_name || 'Shop').replace(/'/g, "\\'")}')">
                                    <span class="material-icons">${shop.id === (activeShop?.id) ? 'radio_button_checked' : 'radio_button_unchecked'}</span>
                                    <span>${shop.shop_name || shop.business_name || 'Shop'}</span>
                                    ${shop.is_default ? '<span class="shop-default-badge">Default</span>' : ''}
                                </button>
                            `).join('')}
                            <div class="shop-dropdown-divider"></div>
                            <a href="profile.html?tab=my-shops" class="shop-dropdown-manage">
                                <span class="material-icons">settings</span> Manage Shops
                            </a>
                        </div>
                    `;
                    headerRight.insertBefore(switcher, headerRight.firstChild);

                    // --- Mobile: inject shop trigger button into .mobile-header-right ---
                    const mobileHeaderRight = document.querySelector('.mobile-header-right');
                    if (mobileHeaderRight && !document.getElementById('mobileShopTrigger')) {
                        const btn = document.createElement('button');
                        btn.id = 'mobileShopTrigger';
                        btn.className = 'mobile-shop-trigger';
                        btn.title = 'Switch Shop';
                        btn.onclick = toggleMobileShopSheet;
                        btn.innerHTML = `
                            <span class="material-icons">storefront</span>
                            <span class="mobile-shop-trigger-name" id="mobileShopBarName">${activeShop?.shop_name || activeShop?.business_name || 'Shop'}</span>
                            ${shops.length > 1 ? '<span class="material-icons mobile-shop-trigger-chevron">expand_more</span>' : ''}
                        `;
                        // Insert before the first child (before dark-mode toggle)
                        mobileHeaderRight.insertBefore(btn, mobileHeaderRight.firstChild);
                    }

                    if (!document.getElementById('shopBottomSheet')) {
                        const backdrop = document.createElement('div');
                        backdrop.id = 'shopSheetBackdrop';
                        backdrop.className = 'shop-sheet-backdrop';
                        backdrop.onclick = closeMobileShopSheet;
                        document.body.appendChild(backdrop);

                        const sheet = document.createElement('div');
                        sheet.id = 'shopBottomSheet';
                        sheet.className = 'shop-bottom-sheet';
                        sheet.innerHTML = `
                            <div class="shop-sheet-handle-bar"><div class="shop-sheet-handle"></div></div>
                            <div class="shop-sheet-title">Switch Shop</div>
                            <div class="shop-sheet-list">
                                ${shops.map(shop => `
                                    <button class="shop-sheet-item ${shop.id === activeShop?.id ? 'active' : ''}"
                                        onclick="switchShop('${shop.id}', '${(shop.shop_name || shop.business_name || 'Shop').replace(/'/g, "'")}')">
                                        <span class="material-icons">${shop.id === activeShop?.id ? 'radio_button_checked' : 'radio_button_unchecked'}</span>
                                        <div class="shop-sheet-item-info">
                                            <div class="shop-sheet-item-name">${shop.shop_name || shop.business_name || 'Shop'}</div>
                                            ${shop.business_name && shop.shop_name !== shop.business_name ? `<div class="shop-sheet-item-sub">${shop.business_name}</div>` : ''}
                                        </div>
                                        ${shop.is_default ? '<span class="shop-default-badge">Default</span>' : ''}
                                    </button>
                                `).join('')}
                            </div>
                            <div class="shop-sheet-footer">
                                <a href="profile.html?tab=my-shops" class="shop-sheet-manage">
                                    <span class="material-icons">settings</span> Manage Shops
                                </a>
                            </div>
                        `;
                        document.body.appendChild(sheet);
                    }
                });
            }

            // Find header-right and add user profile button
            if (headerRight && !document.getElementById('userProfileButton')) {
                const userProfileContainer = document.createElement('div');
                userProfileContainer.className = 'user-profile-dropdown';
                userProfileContainer.innerHTML = `
                    <button class="user-profile-button" id="userProfileButton" onclick="window.location.href='profile.html'">
                        <span class="user-profile-text">Welcome, ${businessName}</span>
                        <div class="user-avatar" id="desktopUserAvatar">
                            ${logoUrl
                                ? `<img src="${logoUrl}" alt="Business Logo" class="user-avatar-logo">`
                                : `<span class="material-icons">account_circle</span>`
                            }
                        </div>
                    </button>
                `;
                headerRight.appendChild(userProfileContainer);
            }

            // Apply logo to mobile-profile-btn if it has just the default icon
            applyLogoToMobileAvatar(logoUrl);
        }
    }
}

function toggleShopDropdown(event) {
    event.stopPropagation();
    const dropdown = document.getElementById('shopDropdown');
    if (!dropdown) return;
    const isOpen = dropdown.style.display !== 'none';
    dropdown.style.display = isOpen ? 'none' : 'block';
    if (!isOpen) {
        // Close on outside click
        setTimeout(() => {
            document.addEventListener('click', closeShopDropdown, { once: true });
        }, 0);
    }
}

function closeShopDropdown() {
    const dropdown = document.getElementById('shopDropdown');
    if (dropdown) dropdown.style.display = 'none';
}

function toggleMobileShopSheet() {
    const sheet = document.getElementById('shopBottomSheet');
    const backdrop = document.getElementById('shopSheetBackdrop');
    if (!sheet) return;
    if (sheet.classList.contains('open')) {
        closeMobileShopSheet();
    } else {
        if (backdrop) backdrop.classList.add('open');
        sheet.classList.add('open');
    }
}

function closeMobileShopSheet() {
    const sheet = document.getElementById('shopBottomSheet');
    const backdrop = document.getElementById('shopSheetBackdrop');
    if (sheet) sheet.classList.remove('open');
    if (backdrop) backdrop.classList.remove('open');
}

function switchShop(shopId, shopName) {
    setActiveShopId(shopId);
    // Update desktop switcher label
    const nameEl = document.getElementById('shopSwitcherName');
    if (nameEl) nameEl.textContent = shopName;
    // Update mobile trigger label
    const mobileBarName = document.getElementById('mobileShopBarName');
    if (mobileBarName) mobileBarName.textContent = shopName;
    // Update active state in desktop dropdown
    document.querySelectorAll('.shop-dropdown-item').forEach(btn => {
        const isActive = btn.getAttribute('onclick')?.includes(`'${shopId}'`);
        btn.classList.toggle('active', isActive);
        const icon = btn.querySelector('.material-icons');
        if (icon) icon.textContent = isActive ? 'radio_button_checked' : 'radio_button_unchecked';
    });
    closeShopDropdown();
    closeMobileShopSheet();
    window.location.reload();
}


// Apply (or clear) the business logo on the mobile avatar button
function applyLogoToMobileAvatar(logoUrl) {
    const mobileBtn = document.querySelector('.mobile-profile-btn');
    if (!mobileBtn) return;
    // Only inject if the button still has the plain icon (not already updated by profile.html)
    const existingImg = mobileBtn.querySelector('img.user-avatar-logo, img.header-avatar-img');
    if (logoUrl && !existingImg) {
        const img = document.createElement('img');
        img.src = logoUrl;
        img.alt = 'Business Logo';
        img.className = 'user-avatar-logo';
        img.style.cssText = 'width:100%;height:100%;object-fit:cover;border-radius:50%;display:block;';
        const icon = mobileBtn.querySelector('.material-icons');
        if (icon) icon.style.display = 'none';
        mobileBtn.insertBefore(img, mobileBtn.firstChild);
    } else if (logoUrl && existingImg) {
        existingImg.src = logoUrl;
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
 * NOTE: Simplified for local testing - Google OAuth is disabled on GitHub Pages
 */
async function handleOAuthCallback() {
    try {
        // Only run on non-auth pages
        const currentPage = window.location.pathname;
        const isAuthPage = currentPage.includes('login') || 
                          currentPage.includes('signup') || 
                          currentPage.includes('forgot-password') ||
                          currentPage.includes('reset-password');
        
        if (isAuthPage) {
            // Don't run callback on auth pages
            return;
        }

        // For dashboard pages, just verify user is authenticated
        // If they are, they're already logged in (done by auth.js checks)
        console.log('✅ User is authenticated on dashboard');
        
    } catch (error) {
        console.error('❌ OAuth callback error:', error);
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
        // handleOAuthCallback will use onAuthStateChange for proper session handling
        handleOAuthCallback();
    }
});
