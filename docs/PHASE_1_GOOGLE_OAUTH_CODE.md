# Phase 1: Google OAuth - Code Implementation
## KounterPro - Ready-to-Implement Code

**Status**: After Google Cloud & Supabase setup is complete  
**Time to Implement**: 30-45 minutes  
**Files to Modify**: 2 main files

---

## Overview: What We're Adding

```
BEFORE:
┌──────────────────────┐
│   Signup Page        │
├──────────────────────┤
│ Email input          │
│ Password input       │
│ [Sign Up] button     │
│ [Login] link         │
└──────────────────────┘

AFTER:
┌──────────────────────┐
│   Signup Page        │
├──────────────────────┤
│ [Sign Up with Google]  ← NEW
│ ─────────────────    │
│ Email input          │
│ Password input       │
│ [Sign Up] button     │
│ [Login] link         │
└──────────────────────┘
```

---

## File 1: Update signup.html

**Location**: `src/pages/signup.html`

### Find the Sign-Up Form Section

Look for this section in your signup.html (around line 40-100):

```html
<form id="signupForm" class="auth-form">
    <div class="form-group">
        <label for="email">Email</label>
        <input type="email" id="email" name="email" required placeholder="your@email.com">
    </div>
    <!-- rest of form ... -->
</form>
```

### Add Google OAuth Button (BEFORE the form)

Replace the form opening with:

```html
<!-- OAuth Section (NEW) -->
<div class="oauth-section">
    <button type="button" id="googleSignUpBtn" class="btn-oauth btn-google">
        <svg class="oauth-icon" width="20" height="20" viewBox="0 0 24 24">
            <path fill="currentColor" d="M22.56 12.25c0-.78-.07-1.53-.2-2.25H12v4.26h5.92c-.26 1.37-1.04 2.53-2.21 3.31v2.77h3.57c2.08-1.92 3.28-4.74 3.28-8.09z"/>
            <path fill="currentColor" d="M12 23c2.97 0 5.46-.98 7.28-2.66l-3.57-2.77c-.98.66-2.23 1.06-3.71 1.06-2.86 0-5.29-1.93-6.16-4.53H2.18v2.84C3.99 20.53 7.7 23 12 23z"/>
            <path fill="currentColor" d="M5.84 14.09c-.22-.66-.35-1.36-.35-2.09s.13-1.43.35-2.09V7.07H2.18C1.43 8.55 1 10.22 1 12s.43 3.45 1.18 4.93l2.85-2.22.81-.62z"/>
            <path fill="currentColor" d="M12 5.38c1.62 0 3.06.56 4.21 1.64l3.15-3.15C17.45 2.09 14.97 1 12 1 7.7 1 3.99 3.47 2.18 7.07l3.66 2.84c.87-2.6 3.3-4.53 6.16-4.53z"/>
        </svg>
        <span>Sign Up with Google</span>
    </button>
    <div class="oauth-divider">
        <span>Or continue with email</span>
    </div>
</div>

<!-- Existing Form -->
<form id="signupForm" class="auth-form">
    <!-- ... rest of form stays the same ... -->
</form>
```

---

## File 2: Add Google OAuth Functions to auth.js

**Location**: `src/scripts/auth.js`

Find the end of your existing `auth.js` file (after all existing functions). Add these new functions:

```javascript
// ============================================
// GOOGLE OAUTH FUNCTIONS (New - Phase 1)
// ============================================

/**
 * Sign up / Login with Google
 */
async function signUpWithGoogle() {
    try {
        console.log('🔵 Starting Google OAuth sign-up...');
        
        const { data, error } = await supabase.auth.signInWithOAuth({
            provider: 'google',
            options: {
                redirectTo: window.location.origin + '/src/pages/index.html',
                queryParams: {
                    access_type: 'offline',
                    prompt: 'consent'
                }
            }
        });

        if (error) {
            console.error('❌ Google OAuth error:', error);
            showToast('Google sign-up failed: ' + error.message, 'error');
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
        const { data: { session }, error: sessionError } = await supabase.auth.getSession();

        if (sessionError) {
            console.error('❌ Session error:', sessionError);
            return;
        }

        if (!session) {
            // No active session, user not logged in via OAuth
            return;
        }

        const user = session.user;
        console.log('✅ OAuth session found for user:', user.email);

        // Check if user_profile exists
        const { data: profile, error: profileError } = await supabase
            .from('user_profiles')
            .select('*')
            .eq('user_id', user.id)
            .single();

        if (profileError && profileError.code !== 'PGRST116') {
            // PGRST116 = "no rows returned" (normal for new users)
            console.error('❌ Profile lookup error:', profileError);
        }

        if (!profile) {
            // New user from OAuth - create profile
            console.log('👤 Creating user_profile for new OAuth user...');
            
            const { error: insertError } = await supabase
                .from('user_profiles')
                .insert([{
                    user_id: user.id,
                    email: user.email,
                    business_name: 'My Business', // Default - user can update
                    phone: '',
                    city: '',
                    state: '',
                    country: '',
                    timezone: Intl.DateTimeFormat().resolvedOptions().timeZone,
                    profile_image_url: user.user_metadata?.avatar_url || null,
                    created_at: new Date().toISOString(),
                    updated_at: new Date().toISOString()
                }]);

            if (insertError) {
                console.error('❌ Error creating user profile:', insertError);
                showToast('Welcome! Please complete your profile.', 'info');
            } else {
                console.log('✅ User profile created successfully');
            }
        } else {
            console.log('✅ User profile already exists');
        }

        // Update last login
        const { error: lastLoginError } = await supabase
            .from('user_profiles')
            .update({
                last_login_at: new Date().toISOString(),
                last_login_ip: await getClientIp()
            })
            .eq('user_id', user.id);

        if (lastLoginError) {
            console.warn('⚠️ Could not update last login:', lastLoginError);
        }

        // Only redirect if we're on a non-dashboard page
        const currentPage = window.location.pathname;
        if (currentPage.includes('signup') || currentPage.includes('login') || currentPage.includes('forgot-password')) {
            console.log('📍 Redirecting to dashboard...');
            window.location.href = '/src/pages/index.html';
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
        
        const { error } = await supabase.auth.linkIdentity({
            provider: 'google',
            options: {
                redirectTo: window.location.origin + '/src/pages/profile.html'
            }
        });

        if (error) {
            console.error('❌ Linking error:', error);
            showToast('Failed to link Google account: ' + error.message, 'error');
            return;
        }

        console.log('✅ Google account linked successfully');
        showToast('Google account linked successfully!', 'success');

    } catch (error) {
        console.error('❌ Error linking Google account:', error);
        showToast('An error occurred', 'error');
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

    // Handle OAuth callback on all pages
    handleOAuthCallback();
});
```

---

## File 3: Add OAuth Styling

**Location**: `src/styles/styles-new.css`

Add these styles at the end of the file (before the closing `}`):

```css
/* ============================================
   OAUTH BUTTON STYLES (Phase 1 - New)
   ============================================ */

.oauth-section {
    margin-bottom: 24px;
}

.btn-oauth {
    display: flex;
    align-items: center;
    justify-content: center;
    gap: 12px;
    width: 100%;
    padding: 12px 16px;
    font-size: 15px;
    font-weight: 600;
    border: 1px solid #ddd;
    border-radius: 8px;
    background: white;
    color: #2c3e50;
    cursor: pointer;
    transition: all 0.2s ease;
    text-decoration: none;
    margin-bottom: 16px;
}

.btn-oauth:hover {
    background: #f8f9fa;
    border-color: #999;
    transform: translateY(-1px);
    box-shadow: 0 2px 8px rgba(0, 0, 0, 0.08);
}

.btn-oauth:active {
    transform: translateY(0);
}

.btn-oauth .oauth-icon {
    width: 20px;
    height: 20px;
    display: flex;
    align-items: center;
    justify-content: center;
}

.btn-oauth svg {
    width: 20px;
    height: 20px;
    color: currentColor;
}

.oauth-divider {
    display: flex;
    align-items: center;
    margin: 24px 0;
    color: #999;
    font-size: 13px;
    text-transform: uppercase;
    letter-spacing: 0.5px;
}

.oauth-divider::before,
.oauth-divider::after {
    content: '';
    flex: 1;
    height: 1px;
    background: #e0e0e0;
}

.oauth-divider::before {
    margin-right: 12px;
}

.oauth-divider::after {
    margin-left: 12px;
}

/* Dark mode OAuth styles */
[data-theme="dark"] .btn-oauth {
    background: #1f2937;
    border-color: #374151;
    color: #e5e7eb;
}

[data-theme="dark"] .btn-oauth:hover {
    background: #374151;
    border-color: #4b5563;
    box-shadow: 0 2px 8px rgba(0, 0, 0, 0.3);
}

[data-theme="dark"] .oauth-divider {
    color: #6b7280;
}

[data-theme="dark"] .oauth-divider::before,
[data-theme="dark"] .oauth-divider::after {
    background: #374151;
}
```

---

## Step-by-Step Implementation Checklist

### ✅ Before You Start
- [ ] Google Cloud setup completed (see PHASE_1_GOOGLE_OAUTH_SETUP.md)
- [ ] Supabase Google OAuth enabled
- [ ] `.env.local` file created with credentials
- [ ] You have access to your app's code

### ✅ Implement Changes

#### Step 1: Update signup.html
1. Open `src/pages/signup.html`
2. Find the form opening (look for `<form id="signupForm"`)
3. Add the OAuth button section BEFORE the form
4. Save file

#### Step 2: Update auth.js
1. Open `src/scripts/auth.js`
2. Go to the very end of the file
3. Paste the Google OAuth functions
4. Save file

#### Step 3: Update styles
1. Open `src/styles/styles-new.css`
2. Go to the end of the file
3. Paste the OAuth CSS styles
4. Save file

#### Step 4: Verify Changes
1. In terminal, check for syntax errors:
   ```bash
   cd src/pages && grep -n "googleSignUpBtn" signup.html
   grep -n "signUpWithGoogle" ../scripts/auth.js
   ```

2. Should see output like:
   ```
   id="googleSignUpBtn"
   async function signUpWithGoogle() {
   ```

### ✅ Test the Implementation

#### Local Testing
1. Start your dev server:
   ```bash
   npm run dev
   # or
   python -m http.server 8000
   ```

2. Navigate to signup page:
   ```
   http://localhost:3000/src/pages/signup.html
   ```

3. You should see:
   - ✅ "Sign Up with Google" button at top
   - ✅ Divider line
   - ✅ Regular email/password form below

4. Click "Sign Up with Google":
   - ✅ Should redirect to Google OAuth consent screen
   - ✅ After approval, redirects back to dashboard
   - ✅ User profile automatically created

#### Expected Behavior

**New User Flow**:
```
1. Click "Sign Up with Google"
   ↓
2. Redirected to Google consent screen
   ↓
3. User authenticates with Google
   ↓
4. Supabase creates auth user
   ↓
5. We create user_profile record
   ↓
6. Redirected to dashboard
   ↓
7. User logged in! ✅
```

**Returning User Flow**:
```
1. Click "Sign Up with Google"
   ↓
2. Google recognizes user (no consent needed)
   ↓
3. Automatically authenticated
   ↓
4. We update last_login info
   ↓
5. Redirected to dashboard ✅
```

---

## Troubleshooting

### Issue: Button doesn't appear
**Solution**:
1. Check HTML wrapping is correct (unique `id="googleSignUpBtn"`)
2. Check browser console for JavaScript errors
3. Verify styles loaded (check Network tab)
4. Try hard refresh: `Cmd+Shift+R`

### Issue: Clicking button does nothing
**Solution**:
1. Check browser console for errors
2. Verify `.env.local` has `VITE_GOOGLE_CLIENT_ID`
3. Verify Supabase Google OAuth is **Enabled** (green toggle)
4. Check that Client ID is correct format: `XXXXX.apps.googleusercontent.com`

### Issue: "Redirect URI mismatch" error
**Solution**:
1. Check Google Cloud Console → Authorized redirect URIs
2. Must include: `https://[your-supabase-url].supabase.co/auth/v1/callback?provider=google`
3. For local dev, must match your actual dev URL
4. Save and wait 1-2 minutes for changes to propagate

### Issue: User profile not created
**Solution**:
1. Check Supabase `user_profiles` table exists
2. Check table schema matches code (all columns present)
3. Check RLS policies allow inserts
4. Check browser console for database errors

### Check Supabase Connection
In browser console:
```javascript
// Check if Supabase client is initialized
console.log(supabase);

// Check current session
const { data: { session } } = await supabase.auth.getSession();
console.log(session);
```

---

## File Reference: Where Each Change Goes

### signup.html - OAuth Section
```html
Location: BEFORE the <form id="signupForm"> opening tag
Insert:
  - <div class="oauth-section">
  - [Sign Up with Google button]
  - [Divider]
  - </div>
```

### auth.js - OAuth Functions
```javascript
Location: END of file (after all existing functions)
Add:
  - signUpWithGoogle()
  - handleOAuthCallback()
  - getClientIp()
  - linkGoogleOAuthAccount()
  - DOMContentLoaded event listener
```

### styles-new.css - OAuth Styles
```css
Location: END of file (before closing brace or EOF)
Add:
  - .oauth-section
  - .btn-oauth and :hover/:active states
  - .oauth-icon
  - .oauth-divider and ::before/::after
  - [data-theme="dark"] variants
```

---

## What's Happening Behind the Scenes

1. **User clicks button** → `signUpWithGoogle()` called
2. **Supabase redirects** → Google OAuth consent screen
3. **User authenticates** → Google verifies identity
4. **Google redirects** → Supabase callback URL with auth code
5. **Supabase exchanges code** → Gets access token
6. **Supabase creates session** → Sets auth cookie
7. **App detects session** → `handleOAuthCallback()` runs
8. **Check user_profile** → Create if new user
9. **Update last login** → Log timestamp & IP
10. **Redirect to dashboard** → User sees their data

---

## Next Phase Preparation

Once Phase 1 is complete and tested:

**Phase 2: Password Reset**
- Create forgot-password.html
- Create reset-password.html
- Add `password_reset_tokens` table
- Implement reset token functions
- Create Supabase Edge Function for backend

---

**Last Updated**: March 4, 2026  
**Status**: Ready to Implement  
**Estimated Implementation Time**: 30 minutes  
**Estimated Testing Time**: 15 minutes  
**Total**: 45 minutes
