c# Authentication Enhancement Guide
## KounterPro - OAuth + Password Reset Implementation

**Date**: March 2026  
**Status**: Planning & Implementation Guide  
**Current Stack**: Supabase (PostgreSQL), Vanilla JS, HTML/CSS

---

## Table of Contents
1. [Architecture Overview](#architecture-overview)
2. [Feature 1: Google OAuth Sign-Up](#feature-1-google-oauth-sign-up)
3. [Feature 2: Self-Service Password Reset](#feature-2-self-service-password-reset)
4. [Database Schema](#database-schema)
5. [Security Considerations](#security-considerations)
6. [Implementation Approach](#implementation-approach)
7. [Testing Strategy](#testing-strategy)

---

## Architecture Overview

### Current State
```
┌─────────────────┐
│   Supabase      │
│   ├─ Auth       │  (Email/Password only)
│   └─ Database   │
└─────────────────┘
         ↓
┌─────────────────┐
│   Frontend      │
│   (Vanilla JS)  │
└─────────────────┘
```

### Proposed Enhanced Architecture
```
┌──────────────────────────────────────────────────────────┐
│                   Authentication Layer                    │
├──────────────────────────────────────────────────────────┤
│                                                            │
│  ┌─────────────────┐  ┌──────────────────┐               │
│  │ Supabase Auth   │  │ Custom Auth Mgmt │               │
│  ├─ Email/Pass     │  ├─ OAuth Tokens    │               │
│  ├─ Google OAuth   │  ├─ Reset Tokens    │               │
│  └─ Sessions       │  ├─ Rate Limiting   │               │
│                    │  └─ Account Linking │               │
│  └─────────────────┘  └──────────────────┘               │
│                                                            │
└──────────────────────────────────────────────────────────┘
         ↓
┌──────────────────────────────────────────────────────────┐
│              PostgreSQL (Supabase)                        │
├──────────────────────────────────────────────────────────┤
│ • users (Supabase managed)                               │
│ • user_profiles (custom)                                 │
│ • oauth_accounts (new)                                   │
│ • password_reset_tokens (new)                            │
│ • login_attempts (new - rate limiting)                   │
└──────────────────────────────────────────────────────────┘
         ↓
┌──────────────────────────────────────────────────────────┐
│              Email Service (Supabase)                     │
│  • Reset links                                           │
│  • OAuth verification emails                             │
└──────────────────────────────────────────────────────────┘
```

---

## Feature 1: Google OAuth Sign-Up

### Recommended Approach: **Supabase Built-in OAuth**

**Why Supabase OAuth over custom:**
- ✅ Handles secure token validation
- ✅ Manages OAuth state & PKCE flow automatically
- ✅ Built-in session management
- ✅ Account linking support
- ✅ Less security risk than custom implementation
- ⚠️ Less control over flow details

### OAuth 2.0 / OIDC Flow (Using Supabase)

```
┌─────────────┐                        ┌──────────────┐
│   Browser   │                        │   Supabase   │
└──────┬──────┘                        └──────┬───────┘
       │                                       │
       │ 1. Click "Sign Up with Google"       │
       ├──────────────────────────────────────>│
       │                                       │
       │ 2. Redirect to Google OAuth           │
       │<──────────────────────────────────────┤
       │                                       │
       │ 3. User authenticates with Google     │
       │ 4. Google redirects to callback URL   │
       │<──────────────────────────────────────┤
       │                                       │
       │ 5. Exchange auth code for token       │
       ├──────────────────────────────────────>│
       │                                       │
       │ 6. Session created / Logged in        │
       │<──────────────────────────────────────┤
       │                                       │
       │ 7. Check if email exists              │
       │    ├─ New: Create user_profile        │
       │    └─ Existing: Link OAuth account    │
       │<──────────────────────────────────────┤
       │                                       │
       │ 8. Redirect to dashboard              │
       └───────────────────────────────────────┘
```

### Step-by-Step Implementation

#### 1. **Google Cloud Setup**
```
1. Go to Google Cloud Console
2. Create new project: "KounterPro Auth"
3. Enable APIs:
   - Google+ API
   - Identity and Access Management (IAM)
4. Create OAuth 2.0 Credentials:
   - Application type: Web application
   - Authorized redirect URIs:
     - https://YOUR_SUPABASE_URL/auth/v1/callback?provider=google
     - http://localhost:3000/auth/v1/callback?provider=google (dev)
5. Copy Client ID & Secret
```

#### 2. **Supabase Configuration**

Go to Supabase Dashboard → Authentication → Providers → Google:
```
Enable: ON
Client ID: [from Google Cloud]
Client Secret: [from Google Cloud]
```

#### 3. **Frontend: Google Sign-Up Button**

```html
<!-- File: src/pages/signup.html -->
<button class="btn-oauth" id="googleSignUpBtn">
    <span class="oauth-icon">
        <svg viewBox="0 0 24 24">
            <!-- Google icon SVG -->
        </svg>
    </span>
    Sign Up with Google
</button>
```

```javascript
// File: src/scripts/auth.js - Add to existing file

async function signUpWithGoogle() {
    try {
        const { data, error } = await supabase.auth.signInWithOAuth({
            provider: 'google',
            options: {
                redirectTo: window.location.origin + '/src/pages/index.html'
            }
        });

        if (error) {
            showToast('Google sign-up failed: ' + error.message, 'error');
            console.error('Google OAuth error:', error);
            return;
        }

        console.log('Redirecting to Google OAuth...');
    } catch (error) {
        console.error('Error:', error);
        showToast('An error occurred', 'error');
    }
}

// Initialize Google button
document.addEventListener('DOMContentLoaded', () => {
    const googleBtn = document.getElementById('googleSignUpBtn');
    if (googleBtn) {
        googleBtn.addEventListener('click', signUpWithGoogle);
    }
});
```

#### 4. **Handle OAuth Callback**

```javascript
// File: src/scripts/auth.js - Add to existing file

async function handleOAuthCallback() {
    try {
        // Supabase automatically handles OAuth callback
        // Check if user session exists
        const { data: { session }, error } = await supabase.auth.getSession();

        if (error) throw error;

        if (session) {
            const user = session.user;

            // Check if user_profile exists
            const { data: profile, error: profileError } = await supabase
                .from('user_profiles')
                .select('*')
                .eq('user_id', user.id)
                .single();

            if (profileError || !profile) {
                // New user - create profile
                const { error: insertError } = await supabase
                    .from('user_profiles')
                    .insert([{
                        user_id: user.id,
                        business_name: user.user_metadata?.name || 'My Business',
                        email: user.email,
                        created_at: new Date(),
                        updated_at: new Date()
                    }]);

                if (insertError) {
                    console.error('Error creating user profile:', insertError);
                    showToast('Welcome! Please complete your profile.', 'info');
                }
            }

            // Update login timestamp
            await updateLastLogin(user.id);

            // Redirect to dashboard
            window.location.href = 'index.html';
        }
    } catch (error) {
        console.error('OAuth callback error:', error);
        showToast('Authentication failed', 'error');
        window.location.href = 'login.html';
    }
}

// Call on page load
document.addEventListener('DOMContentLoaded', handleOAuthCallback);
```

#### 5. **Account Linking (Existing Email → Google)**

```javascript
// File: src/scripts/auth.js - Add to existing file

async function linkGoogleAccount(userId) {
    try {
        const { data, error } = await supabase.auth.linkIdentity({
            provider: 'google',
            options: {
                redirectTo: window.location.origin + '/src/pages/profile.html'
            }
        });

        if (error) throw error;
        showToast('Google account linked successfully!', 'success');
    } catch (error) {
        console.error('Error linking Google account:', error);
        showToast('Failed to link Google account', 'error');
    }
}
```

---

## Feature 2: Self-Service Password Reset

### Recommended Flow

```
┌──────────────────────────────────────────────┐
│          PASSWORD RESET FLOW                  │
└──────────────────────────────────────────────┘

Step 1: User requests reset
┌─────────────┐
│ "Forgot Password" page
│ Enter email address
└────────────┬────────────┘
             │
             ▼
        ┌─────────────────────────┐
        │ Validate email exists    │
        │ (prevent enumeration)    │
        │ Rate limit check         │
        └────────────┬────────────┘
                     │
                     ▼
       ┌──────────────────────────────┐
       │ Generate secure token:       │
       │ • Random 32+ char string     │
       │ • Hash before storing (bcrypt)
       │ • 1-hour expiration          │
       │ • Store in DB               │
       └──────────────┬───────────────┘
                      │
                      ▼
        ┌────────────────────────────┐
        │ Send reset email with link:│
        │ /reset-password?token=xxx  │
        └────────────┬───────────────┘
                     │
                     ▼
        ┌──────────────────────────────┐
Step 2: User clicks reset link
│ Frontend redirects to reset page
│ User enters new password
└────────────┬─────────────────────────┘
             │
             ▼
   ┌──────────────────────────────┐
   │ Validate:                    │
   │ • Token exists & not expired │
   │ • Password strength          │
   │ • Password != old password   │
   └──────────────┬───────────────┘
                  │
                  ▼
    ┌───────────────────────────────┐
Step 3: Update password
│ Hash new password (bcrypt)
│ Update users table
│ Delete used reset token
│ Invalidate all sessions
│ Send confirmation email
└───────────────┬──────────────────┘
                │
                ▼
     ┌──────────────────────────┐
     │ Redirect to login page   │
     │ Show success message     │
     └──────────────────────────┘
```

### Implementation

#### 1. **Database Schema Changes**

```sql
-- Create password reset tokens table
CREATE TABLE IF NOT EXISTS password_reset_tokens (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    user_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
    token_hash VARCHAR(255) NOT NULL UNIQUE,
    expires_at TIMESTAMP NOT NULL,
    used_at TIMESTAMP,
    ip_address VARCHAR(45),
    user_agent TEXT,
    created_at TIMESTAMP NOT NULL DEFAULT NOW(),
    
    INDEX idx_user_id (user_id),
    INDEX idx_expires_at (expires_at)
);

-- Create login attempts table (rate limiting)
CREATE TABLE IF NOT EXISTS login_attempts (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    email VARCHAR(255) NOT NULL,
    ip_address VARCHAR(45),
    success BOOLEAN NOT NULL,
    attempted_at TIMESTAMP NOT NULL DEFAULT NOW(),
    
    INDEX idx_email_ip (email, ip_address),
    INDEX idx_attempted_at (attempted_at)
);

-- Create password reset requests table (rate limiting)
CREATE TABLE IF NOT EXISTS password_reset_requests (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    email VARCHAR(255) NOT NULL,
    ip_address VARCHAR(45),
    requested_at TIMESTAMP NOT NULL DEFAULT NOW(),
    
    INDEX idx_email_ip (email, ip_address),
    INDEX idx_requested_at (requested_at)
);

-- Add to user_profiles if not exists
ALTER TABLE user_profiles ADD COLUMN IF NOT EXISTS 
    last_password_reset_at TIMESTAMP;
```

#### 2. **Frontend: Forgot Password Form**

```html
<!-- File: src/pages/forgot-password.html -->

<!DOCTYPE html>
<html lang="en">
<head>
    <meta charset="UTF-8">
    <meta name="viewport" content="width=device-width, initial-scale=1.0">
    <title>Forgot Password - KounterPro</title>
    <link rel="stylesheet" href="../styles/styles.css">
    <link rel="stylesheet" href="../styles/styles-new.css">
    <link rel="stylesheet" href="../styles/dark-mode.css">
    <script src="../scripts/dark-mode.js"></script>
</head>
<body>
    <div class="auth-container">
        <div class="auth-card">
            <div class="auth-header">
                <h1>Reset Password</h1>
                <p>Enter your email to receive a password reset link</p>
            </div>

            <form id="forgotPasswordForm">
                <div class="form-group">
                    <label for="email">Email Address</label>
                    <input 
                        type="email" 
                        id="email" 
                        name="email"
                        required
                        placeholder="your@email.com"
                    >
                    <small id="emailError" style="color: #ef4444; display: none;"></small>
                </div>

                <button type="submit" class="btn-primary" style="width: 100%;">
                    Send Reset Link
                </button>
            </form>

            <p class="auth-footer">
                Remember your password? 
                <a href="login.html">Back to Login</a>
            </p>

            <div id="successMessage" style="display: none; margin-top: 16px;">
                <div class="alert alert-success">
                    <strong>Email sent!</strong>
                    <p>Check your email for password reset instructions.</p>
                </div>
            </div>
        </div>
    </div>

    <script src="../scripts/auth.js"></script>
    <script src="../scripts/toast.js"></script>
</body>
</html>
```

#### 3. **Frontend: Reset Password Form**

```html
<!-- File: src/pages/reset-password.html -->

<!DOCTYPE html>
<html lang="en">
<head>
    <meta charset="UTF-8">
    <meta name="viewport" content="width=device-width, initial-scale=1.0">
    <title>Reset Password - KounterPro</title>
    <link rel="stylesheet" href="../styles/styles.css">
    <link rel="stylesheet" href="../styles/styles-new.css">
    <link rel="stylesheet" href="../styles/dark-mode.css">
    <script src="../scripts/dark-mode.js"></script>
</head>
<body>
    <div class="auth-container">
        <div class="auth-card">
            <div class="auth-header">
                <h1>Create New Password</h1>
                <p>Enter your new password below</p>
            </div>

            <form id="resetPasswordForm">
                <div class="form-group">
                    <label for="password">New Password</label>
                    <input 
                        type="password" 
                        id="password" 
                        name="password"
                        required
                        placeholder="Min 8 characters"
                    >
                    <small id="passwordRequirements" style="margin-top: 8px; display: block;">
                        ✓ 8+ characters
                        ✓ Uppercase & lowercase
                        ✓ Number
                        ✓ Special character
                    </small>
                    <small id="passwordError" style="color: #ef4444; display: none;"></small>
                </div>

                <div class="form-group">
                    <label for="confirmPassword">Confirm Password</label>
                    <input 
                        type="password" 
                        id="confirmPassword" 
                        name="confirmPassword"
                        required
                        placeholder="Re-enter password"
                    >
                    <small id="confirmError" style="color: #ef4444; display: none;"></small>
                </div>

                <button type="submit" class="btn-primary" style="width: 100%;">
                    Reset Password
                </button>
            </form>

            <div id="errorMessage" style="display: none; margin-top: 16px;">
                <div class="alert alert-danger">
                    <p id="errorText"></p>
                </div>
            </div>
        </div>
    </div>

    <script src="../scripts/validation.js"></script>
    <script src="../scripts/auth.js"></script>
    <script src="../scripts/supabase.js"></script>
    <script src="../scripts/toast.js"></script>
</body>
</html>
```

#### 4. **Backend: Password Reset Functions**

```javascript
// File: src/scripts/auth.js - Add these functions

const RESET_TOKEN_LENGTH = 32;
const RESET_TOKEN_EXPIRY_HOURS = 1;
const PASSWORD_RESET_RATE_LIMIT = 3; // Max 3 requests per hour
const PASSWORD_RESET_WAIT_MINUTES = 20; // Min 20 min between attempts

/**
 * Generate a secure random token for password reset
 */
function generateResetToken() {
    const chars = 'ABCDEFGHIJKLMNOPQRSTUVWXYZabcdefghijklmnopqrstuvwxyz0123456789-_';
    let token = '';
    const array = new Uint8Array(RESET_TOKEN_LENGTH);
    crypto.getRandomValues(array);
    for (let i = 0; i < RESET_TOKEN_LENGTH; i++) {
        token += chars[array[i] % chars.length];
    }
    return token;
}

/**
 * Hash token using SHA-256 (for storage)
 */
async function hashToken(token) {
    const encoder = new TextEncoder();
    const data = encoder.encode(token);
    const hashBuffer = await crypto.subtle.digest('SHA-256', data);
    const hashArray = Array.from(new Uint8Array(hashBuffer));
    return hashArray.map(b => b.toString(16).padStart(2, '0')).join('');
}

/**
 * Check password reset rate limit
 */
async function checkPasswordResetRateLimit(email) {
    try {
        const oneHourAgo = new Date(Date.now() - 60 * 60 * 1000);
        
        const { count, error } = await supabase
            .from('password_reset_requests')
            .select('*', { count: 'exact', head: true })
            .eq('email', email)
            .gte('requested_at', oneHourAgo.toISOString());

        if (error) throw error;

        if (count >= PASSWORD_RESET_RATE_LIMIT) {
            const lastAttempt = await supabase
                .from('password_reset_requests')
                .select('requested_at')
                .eq('email', email)
                .order('requested_at', { ascending: false })
                .limit(1)
                .single();

            const nextAvailableTime = new Date(lastAttempt.data.requested_at);
            nextAvailableTime.setMinutes(nextAvailableTime.getMinutes() + PASSWORD_RESET_WAIT_MINUTES);

            return {
                allowed: false,
                nextAvailable: nextAvailableTime
            };
        }

        return { allowed: true };
    } catch (error) {
        console.error('Rate limit check error:', error);
        throw error;
    }
}

/**
 * Request password reset
 */
async function requestPasswordReset(email) {
    try {
        // Validate email format
        if (!isValidEmail(email)) {
            throw new Error('Invalid email format');
        }

        // Check rate limit
        const rateCheck = await checkPasswordResetRateLimit(email);
        if (!rateCheck.allowed) {
            throw new Error(
                `Too many reset requests. Try again after ${rateCheck.nextAvailable.toLocaleTimeString()}`
            );
        }

        // Check if email exists (to prevent enumeration, don't reveal if user exists)
        const { data: users, error: userError } = await supabase
            .from('user_profiles')
            .select('user_id')
            .eq('email', email)
            .single();

        // Always log the request (for analysis)
        const clientIp = await getClientIp();
        await supabase.from('password_reset_requests').insert({
            email: email,
            ip_address: clientIp,
            requested_at: new Date()
        });

        // If user doesn't exist, still show success (prevent enumeration)
        if (userError || !users) {
            showToast('If an account exists, reset instructions have been sent.', 'info');
            return;
        }

        // Generate reset token
        const token = generateResetToken();
        const tokenHash = await hashToken(token);
        const expiresAt = new Date(Date.now() + RESET_TOKEN_EXPIRY_HOURS * 60 * 60 * 1000);

        // Store token hash in database
        const { error: insertError } = await supabase
            .from('password_reset_tokens')
            .insert({
                user_id: users.user_id,
                token_hash: tokenHash,
                expires_at: expiresAt,
                ip_address: clientIp,
                user_agent: navigator.userAgent
            });

        if (insertError) throw insertError;

        // Send reset email
        const resetLink = `${window.location.origin}/src/pages/reset-password.html?token=${token}`;
        await sendPasswordResetEmail(email, resetLink);

        showToast('Password reset instructions sent to your email!', 'success');
        
        // Clear form
        document.getElementById('forgotPasswordForm').reset();
        document.getElementById('successMessage').style.display = 'block';

    } catch (error) {
        console.error('Password reset request error:', error);
        showToast(error.message || 'Failed to process password reset', 'error');
    }
}

/**
 * Get client IP (backend implementation needed)
 */
async function getClientIp() {
    try {
        const response = await fetch('https://api.ipify.org?format=json');
        const data = await response.json();
        return data.ip;
    } catch (error) {
        console.warn('Could not get IP:', error);
        return 'unknown';
    }
}

/**
 * Send password reset email via Supabase
 */
async function sendPasswordResetEmail(email, resetLink) {
    try {
        // Use Supabase to send email (requires Email service configuration)
        // Option 1: Use Supabase auth's built-in reset
        const { error } = await supabase.auth.resetPasswordForEmail(email, {
            redirectTo: resetLink
        });

        if (error) throw error;

        // Option 2: Send custom email (requires backend service)
        // You might want to create a Supabase Edge Function for this
        // POST /custom-reset-email
    } catch (error) {
        console.error('Email sending error:', error);
        throw new Error('Failed to send reset email');
    }
}

/**
 * Verify reset token
 */
async function verifyResetToken(token) {
    try {
        const tokenHash = await hashToken(token);
        
        const { data: resetRecord, error } = await supabase
            .from('password_reset_tokens')
            .select('*')
            .eq('token_hash', tokenHash)
            .single();

        if (error || !resetRecord) {
            throw new Error('Invalid or expired reset token');
        }

        // Check expiration
        if (new Date(resetRecord.expires_at) < new Date()) {
            throw new Error('Reset token has expired');
        }

        // Check if already used
        if (resetRecord.used_at) {
            throw new Error('This reset link has already been used');
        }

        return resetRecord;
    } catch (error) {
        console.error('Token verification error:', error);
        throw error;
    }
}

/**
 * Reset password with token
 */
async function resetPasswordWithToken(token, newPassword) {
    try {
        // Validate password strength
        const validation = validatePasswordStrength(newPassword);
        if (!validation.isValid) {
            throw new Error(validation.errors.join(', '));
        }

        // Verify token
        const resetRecord = await verifyResetToken(token);

        // Update password using Supabase Admin API
        // (This requires a backend service since frontend can't modify auth.users)
        // Call backend function instead
        const { error } = await supabase.functions.invoke('reset-password', {
            body: {
                userId: resetRecord.user_id,
                newPassword: newPassword,
                tokenId: resetRecord.id
            }
        });

        if (error) throw error;

        showToast('Password reset successfully! Redirecting to login...', 'success');
        setTimeout(() => {
            window.location.href = 'login.html';
        }, 2000);

    } catch (error) {
        console.error('Password reset error:', error);
        showToast(error.message || 'Failed to reset password', 'error');
    }
}

/**
 * Form submission handlers
 */
document.addEventListener('DOMContentLoaded', () => {
    // Forgot password form
    const forgotForm = document.getElementById('forgotPasswordForm');
    if (forgotForm) {
        forgotForm.addEventListener('submit', async (e) => {
            e.preventDefault();
            const email = document.getElementById('email').value;
            await requestPasswordReset(email);
        });
    }

    // Reset password form
    const resetForm = document.getElementById('resetPasswordForm');
    if (resetForm) {
        resetForm.addEventListener('submit', async (e) => {
            e.preventDefault();
            const password = document.getElementById('password').value;
            const confirmPassword = document.getElementById('confirmPassword').value;

            if (password !== confirmPassword) {
                document.getElementById('confirmError').textContent = 'Passwords do not match';
                document.getElementById('confirmError').style.display = 'block';
                return;
            }

            const urlParams = new URLSearchParams(window.location.search);
            const token = urlParams.get('token');

            if (!token) {
                showToast('Invalid reset link', 'error');
                return;
            }

            await resetPasswordWithToken(token, password);
        });

        // Password validation on input
        const passwordInput = document.getElementById('password');
        if (passwordInput) {
            passwordInput.addEventListener('input', (e) => {
                const validation = validatePasswordStrength(e.target.value);
                const requirements = document.getElementById('passwordRequirements');
                if (requirements) {
                    requirements.innerHTML = validation.requirements
                        .map(r => `${r.met ? '✓' : '✗'} ${r.label}`)
                        .join('<br>');
                }
            });
        }
    }
});
```

#### 5. **Backend: Supabase Edge Function**

```typescript
// File: supabase/functions/reset-password/index.ts
// Deploy with: supabase functions deploy reset-password

import { createClient } from "https://esm.sh/@supabase/supabase-js@2";

const supabaseUrl = Deno.env.get("SUPABASE_URL");
const supabaseServiceKey = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY");

const supabase = createClient(supabaseUrl, supabaseServiceKey);

async function resetPassword(req: Request) {
    try {
        const { userId, newPassword, tokenId } = await req.json();

        if (!userId || !newPassword || !tokenId) {
            return new Response(
                JSON.stringify({ error: "Missing required fields" }),
                { status: 400 }
            );
        }

        // Verify token one more time
        const { data: token, error: tokenError } = await supabase
            .from("password_reset_tokens")
            .select("*")
            .eq("id", tokenId)
            .single();

        if (tokenError || !token || token.used_at || new Date(token.expires_at) < new Date()) {
            return new Response(
                JSON.stringify({ error: "Invalid or expired token" }),
                { status: 400 }
            );
        }

        // Update user password
        const { error: updateError } = await supabase.auth.admin.updateUserById(
            userId,
            { password: newPassword }
        );

        if (updateError) {
            console.error("Password update error:", updateError);
            return new Response(
                JSON.stringify({ error: "Failed to update password" }),
                { status: 500 }
            );
        }

        // Mark token as used
        const { error: markError } = await supabase
            .from("password_reset_tokens")
            .update({ used_at: new Date().toISOString() })
            .eq("id", tokenId);

        if (markError) {
            console.warn("Failed to mark token as used:", markError);
            // Don't fail the entire operation
        }

        // Invalidate all sessions for this user
        await supabase.auth.admin.signOut(userId);

        // Log successful password reset
        await supabase.from("user_profiles").update({
            last_password_reset_at: new Date().toISOString()
        }).eq("user_id", userId);

        return new Response(
            JSON.stringify({ success: true, message: "Password reset successfully" }),
            { status: 200 }
        );
    } catch (error) {
        console.error("Reset password error:", error);
        return new Response(
            JSON.stringify({ error: "Internal server error" }),
            { status: 500 }
        );
    }
}

Deno.serve(async (req: Request) => {
    if (req.method === "POST") {
        return await resetPassword(req);
    }
    return new Response("Method not allowed", { status: 405 });
});
```

---

## Database Schema

### Migration SQL

```sql
-- 1. Password Reset Tokens Table
CREATE TABLE IF NOT EXISTS password_reset_tokens (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    user_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
    token_hash VARCHAR(255) NOT NULL UNIQUE,
    expires_at TIMESTAMP NOT NULL,
    used_at TIMESTAMP,
    ip_address VARCHAR(45),
    user_agent TEXT,
    created_at TIMESTAMP NOT NULL DEFAULT NOW(),
    
    INDEX idx_user_id (user_id),
    INDEX idx_expires_at (expires_at),
    INDEX idx_token_hash (token_hash)
);

-- 2. OAuth Accounts Table (for account linking)
CREATE TABLE IF NOT EXISTS oauth_accounts (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    user_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
    provider VARCHAR(50) NOT NULL,
    provider_user_id VARCHAR(255) NOT NULL,
    provider_email VARCHAR(255),
    provider_metadata JSONB,
    linked_at TIMESTAMP NOT NULL DEFAULT NOW(),
    
    UNIQUE(provider, provider_user_id),
    INDEX idx_user_id (user_id),
    INDEX idx_provider (provider)
);

-- 3. Login Attempts Table (for rate limiting)
CREATE TABLE IF NOT EXISTS login_attempts (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    email VARCHAR(255) NOT NULL,
    ip_address VARCHAR(45),
    success BOOLEAN NOT NULL,
    attempted_at TIMESTAMP NOT NULL DEFAULT NOW(),
    
    INDEX idx_email_ip (email, ip_address),
    INDEX idx_attempted_at (attempted_at)
);

-- 4. Password Reset Requests Table (for rate limiting)
CREATE TABLE IF NOT EXISTS password_reset_requests (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    email VARCHAR(255) NOT NULL,
    ip_address VARCHAR(45),
    requested_at TIMESTAMP NOT NULL DEFAULT NOW(),
    
    INDEX idx_email_ip (email, ip_address),
    INDEX idx_requested_at (requested_at)
);

-- 5. Extend user_profiles table
ALTER TABLE user_profiles
ADD COLUMN IF NOT EXISTS last_password_reset_at TIMESTAMP,
ADD COLUMN IF NOT EXISTS password_reset_count INT DEFAULT 0,
ADD COLUMN IF NOT EXISTS last_login_ip VARCHAR(45),
ADD COLUMN IF NOT EXISTS last_login_at TIMESTAMP;

-- 6. Create cleanup function (remove expired tokens)
CREATE OR REPLACE FUNCTION cleanup_expired_reset_tokens()
RETURNS void AS $$
BEGIN
    DELETE FROM password_reset_tokens
    WHERE expires_at < NOW() AND used_at IS NULL;
    
    DELETE FROM password_reset_requests
    WHERE requested_at < NOW() - INTERVAL '24 hours';
    
    DELETE FROM login_attempts
    WHERE attempted_at < NOW() - INTERVAL '24 hours';
END;
$$ LANGUAGE plpgsql;

-- 7. Schedule cleanup (via pg_cron if available)
-- SELECT cron.schedule('cleanup-auth-tokens', '0 * * * *', 'SELECT cleanup_expired_reset_tokens()');
```

---

## Security Considerations

### ✅ DO

1. **Hash Reset Tokens**
   - Store SHA-256 hash in database, never plain text
   - Token sent to user via email, hash stored in DB
   ```javascript
   const hash = await hashToken(token);
   // Store hash, not token
   ```

2. **Rate Limiting**
   - Max 3 password reset requests per hour per email
   - 20-minute minimum between consecutive requests
   - Prevent brute force attacks

3. **Token Expiration**
   - Reset tokens expire after 1 hour
   - Used tokens cannot be reused
   - Implement server-side cleanup of expired tokens

4. **Prevent User Enumeration**
   - Always show "Check your email" message
   - Don't reveal if email exists in system
   - Log all attempts for analysis

5. **Email Verification**
   - Include token in URL, not in email body preview
   - Use short token window
   - Send confirmation email after reset

6. **Password Requirements**
   - Minimum 8 characters
   - Mix of uppercase, lowercase, numbers, symbols
   - Not in common password list
   - Not same as old password

7. **Session Invalidation**
   - Invalidate all sessions after password reset
   - Require fresh login with new password
   - Force logout from all devices

8. **HTTPS Only**
   - All auth endpoints must use HTTPS
   - Secure cookies (httpOnly, secure flags)
   - No token in URL logs

### ❌ DON'T

1. **Don't use shortlived JWT for reset links**
   - Use stateful tokens (database stored)
   - JWTs can't be revoked

2. **Don't email passwords**
   - Only send reset links
   - Never store plain passwords

3. **Don't use sequential token IDs**
   - Use cryptographically random tokens
   - 32+ character tokens minimum

4. **Don't implement password reset in frontend only**
   - Use backend API to update auth.users
   - Frontend can't modify Supabase auth table

5. **Don't trust client-side validation only**
   - Always validate on backend
   - Server-side is source of truth

6. **Don't log sensitive data**
   - Never log passwords, tokens, or sensitive info
   - Log user IDs instead

7. **Don't expose error details**
   - Generic error messages for users
   - Detailed errors only in backend logs

---

## Implementation Approach

### Recommended: **Leverage Supabase Auth**

| Feature | Supabase Built-in | Custom | Recommendation |
|---------|-------------------|--------|-----------------|
| **Google OAuth** | ✅ Full support | ⚠️ Requires OIDC | **Use Supabase** |
| **Token Validation** | ✅ Automatic | ⚠️ Complex | **Use Supabase** |
| **Session Management** | ✅ Automatic | ⚠️ Manual | **Use Supabase** |
| **Password Reset** | ✅ Built-in | ✅ Custom control | **Hybrid** |
| **Rate Limiting** | ⚠️ Limited | ✅ Full control | **Custom table** |
| **Account Linking** | ✅ Via identities | ⚠️ Manual | **Use Supabase** |

### Migration Steps (Phased Approach)

**Phase 1: Google OAuth (Week 1)**
- [ ] Set up Google Cloud OAuth credentials
- [ ] Enable Google OAuth in Supabase
- [ ] Add "Sign Up with Google" button to signup page
- [ ] Handle OAuth callback and new user profile creation
- [ ] Test OAuth flow (sign up, existing user)

**Phase 2: Password Reset (Week 2)**
- [ ] Create password reset token table
- [ ] Create forgot-password.html page
- [ ] Create reset-password.html page
- [ ] Implement token generation & hashing
- [ ] Deploy Supabase Edge Function
- [ ] Update auth.js with reset functions

**Phase 3: Rate Limiting & Cleanup (Week 3)**
- [ ] Add login_attempts table
- [ ] Add password_reset_requests table
- [ ] Implement rate limit checks
- [ ] Set up token cleanup function
- [ ] Add security monitoring

**Phase 4: Testing & Hardening (Week 4)**
- [ ] Unit tests for all auth functions
- [ ] E2E tests for OAuth flow
- [ ] Security audit
- [ ] Load testing
- [ ] Documentation

---

## API Endpoints

### Authentication Endpoints

#### 1. Google OAuth Sign-Up
```
Method: GET
URL: /auth/v1/authorize?provider=google&redirect_to={url}
Response: Redirects to Google OAuth consent screen
```

#### 2. Forgot Password Request
```
Method: POST
URL: /api/auth/forgot-password
Body: {
    "email": "user@example.com"
}
Response: {
    "success": true,
    "message": "Reset instructions sent to email"
}
Status: 200 (always, to prevent enumeration)
```

#### 3. Verify Reset Token
```
Method: POST
URL: /api/auth/verify-reset-token
Body: {
    "token": "abc123..."
}
Response: {
    "valid": true,
    "userId": "uuid"
}
Status: 200 or 400
```

#### 4. Reset Password
```
Method: POST
URL: /api/auth/reset-password
Body: {
    "token": "abc123...",
    "newPassword": "SecurePass123!"
}
Response: {
    "success": true,
    "message": "Password reset successfully"
}
Status: 200 or 400
```

#### 5. Link OAuth Account
```
Method: POST
URL: /auth/v1/link/google
Body: null
Response: Redirects to Google OAuth
```

---

## Security Checklist

### Authentication Security
- [ ] Google OAuth configured with correct redirect URIs
- [ ] Client secrets stored in environment variables (not in code)
- [ ] HTTPS enforced on all auth endpoints
- [ ] CORS properly configured
- [ ] Session timeout implemented (30 min inactivity)

### Password Reset Security
- [ ] Reset tokens use cryptographic randomness (crypto.getRandomValues)
- [ ] Tokens are hashed before storage (SHA-256)
- [ ] Tokens expire after 1 hour
- [ ] Used tokens cannot be reused
- [ ] Plain text tokens never logged
- [ ] Rate limiting prevents abuse (3 req/hour)
- [ ] User enumeration prevented (same response for all emails)

### Database Security
- [ ] OAuth tokens stored encrypted (if at all)
- [ ] Password resets hashed (not plain text)
- [ ] RLS (Row Level Security) enabled on new tables
- [ ] Sensitive columns marked as private
- [ ] Regular backups configured
- [ ] Cleanup jobs remove expired tokens

### Frontend Security
- [ ] No tokens stored in localStorage (use secure session)
- [ ] CSRF tokens included in state parameter
- [ ] Password inputs have autocomplete="current-password"
- [ ] XSS protections enabled
- [ ] Content Security Policy headers set
- [ ] No sensitive info in error messages shown to users

### Operational Security
- [ ] Access logs monitored
- [ ] Failed attempts tracked and alerted
- [ ] Rate limit monitoring enabled
- [ ] Regular security audits scheduled
- [ ] Breach notification plan documented
- [ ] Incident response procedures defined

---

## Testing Strategy

### Unit Tests

```javascript
// tests/auth.test.js

describe('Password Reset', () => {
    test('generates valid reset token', () => {
        const token = generateResetToken();
        expect(token).toHaveLength(RESET_TOKEN_LENGTH);
        expect(/^[A-Za-z0-9\-_]+$/.test(token)).toBe(true);
    });

    test('hashes token consistently', async () => {
        const token = 'test-token-123';
        const hash1 = await hashToken(token);
        const hash2 = await hashToken(token);
        expect(hash1).toBe(hash2);
    });

    test('validates password strength', () => {
        const weak = validatePasswordStrength('123');
        expect(weak.isValid).toBe(false);

        const strong = validatePasswordStrength('SecurePass123!');
        expect(strong.isValid).toBe(true);
    });

    test('prevents rate limiting bypass', async () => {
        const rateCheck = await checkPasswordResetRateLimit('test@example.com');
        expect(rateCheck.allowed).toBe(true);
        // After 3 attempts...
        const rateLimited = await checkPasswordResetRateLimit('test@example.com');
        expect(rateLimited.allowed).toBe(false);
    });
});

describe('OAuth', () => {
    test('handles OAuth callback correctly', async () => {
        // Mock OAuth session
        const session = { user: { id: 'uuid', email: 'user@example.com' } };
        await handleOAuthCallback();
        // Verify user_profile was created
    });

    test('links existing account to OAuth', async () => {
        // Create user with email
        // Link OAuth account
        // Verify oauth_accounts record created
    });
});
```

### Integration Tests

```javascript
// tests/auth.integration.test.js

describe('End-to-End Password Reset', () => {
    test('complete password reset flow', async () => {
        // 1. Request password reset
        await requestPasswordReset('user@example.com');
        
        // 2. Get token from DB
        const token = await getResetToken('user@example.com');
        
        // 3. Reset password with token
        await resetPasswordWithToken(token, 'NewPass123!');
        
        // 4. Verify old password no longer works
        // 5. Verify new password works
        // 6. Verify token marked as used
        // 7. Verify token cannot be reused
    });
});

describe('End-to-End Google OAuth', () => {
    test('sign up with Google', async () => {
        // 1. Redirect to Google OAuth
        // 2. Authenticate with test credentials
        // 3. Verify callback received
        // 4. Verify user_profile created
        // 5. Verify session active
    });

    test('link existing account to Google', async () => {
        // 1. Sign up with email/password
        // 2. Link Google OAuth
        // 3. Verify both auth methods work
    });
});
```

### Security Tests

```javascript
// tests/auth.security.test.js

describe('Security - User Enumeration', () => {
    test('does not reveal if email exists', async () => {
        const existingResponse = await requestPasswordReset('registered@example.com');
        const nonExistingResponse = await requestPasswordReset('unknown@example.com');
        
        expect(existingResponse.statusCode).toBe(existingResponse.statusCode);
        expect(existingResponse.message).toBe(nonExistingResponse.message);
    });
});

describe('Security - Token Validation', () => {
    test('rejects expired tokens', async () => {
        const expiredToken = await generateExpiredToken();
        const result = await verifyResetToken(expiredToken);
        expect(result.valid).toBe(false);
    });

    test('rejects used tokens', async () => {
        const token = await generateResetToken();
        await resetPasswordWithToken(token, 'Pass123!');
        const result = await verifyResetToken(token);
        expect(result.valid).toBe(false);
    });

    test('rejects modified tokens', async () => {
        const token = await generateResetToken();
        const modified = token.slice(0, -1) + 'X';
        const result = await verifyResetToken(modified);
        expect(result.valid).toBe(false);
    });
});

describe('Security - Rate Limiting', () => {
    test('blocks excessive reset requests', async () => {
        // Make 3 requests
        for (let i = 0; i < 3; i++) {
            await requestPasswordReset('user@example.com');
        }
        
        // 4th should fail
        const result = await requestPasswordReset('user@example.com');
        expect(result.allowed).toBe(false);
    });
});
```

---

## Configuration Checklist

### Environment Variables

```bash
# .env.local
VITE_SUPABASE_URL=https://xxxxx.supabase.co
VITE_SUPABASE_ANON_KEY=xxxxx
VITE_GOOGLE_CLIENT_ID=xxxxx.apps.googleusercontent.com
VITE_APP_URL=https://kounterpro.app

# Backend (Supabase Edge Functions)
SUPABASE_SERVICE_ROLE_KEY=xxxxx
SUPABASE_URL=https://xxxxx.supabase.co
```

### Supabase Configuration

```yaml
# supabase/config.toml

[auth]
enable_signup = true
enable_email_password_reset = true
enable_google_oauth = true
email_rate_limit_tokens_per_minute = 15
email_max_frequency_per_second = 1

[auth.external.google]
enabled = true
client_id = "env(GOOGLE_CLIENT_ID)"
client_secret = "env(GOOGLE_CLIENT_SECRET)"

[database]
timezone = "UTC"
```

---

## Future Enhancements

1. **Additional OAuth Providers**
   - Facebook OAuth
   - Apple Sign-In
   - GitHub OAuth
   - Microsoft OAuth

2. **Advanced Features**
   - WebAuthn/FIDO2 passwordless authentication
   - Multi-factor authentication (MFA/2FA)
   - Session management (device trust, location)
   - Biometric login (fingerprint, face)
   - Magic links (passwordless email)

3. **Security Improvements**
   - Impossible Travel Detection (unusual login locations)
   - Anomaly Detection (unusual login patterns)
   - Account Recovery Codes
   - Trusted Device Management
   - Login Notifications

4. **Compliance**
   - GDPR compliance for reset tokens
   - SOC 2 audit requirements
   - Password history (prevent reuse)
   - Login audit trail

---

## Resources

- [Supabase Auth Documentation](https://supabase.com/docs/guides/auth)
- [Google OAuth 2.0 Guide](https://developers.google.com/identity/protocols/oauth2)
- [OWASP Authentication Cheat Sheet](https://cheatsheetseries.owasp.org/cheatsheets/Authentication_Cheat_Sheet.html)
- [OWASP Password Reset Cheat Sheet](https://cheatsheetseries.owasp.org/cheatsheets/Forgot_Password_Cheat_Sheet.html)
- [Web Crypto API](https://developer.mozilla.org/en-US/docs/Web/API/Web_Crypto_API)

---

**Document Created**: March 4, 2026  
**Last Updated**: March 4, 2026  
**Status**: Ready for Implementation
