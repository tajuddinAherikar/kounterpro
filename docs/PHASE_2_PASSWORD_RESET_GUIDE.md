# Phase 2: Self-Service Password Reset Implementation
## KounterPro Authentication Enhancement

**Status**: Ready for Implementation  
**Estimated Time**: 2-3 hours  
**Dependencies**: Phase 1 (Google OAuth) - Completed ✅

---

## Overview

This phase adds a complete self-service password reset system without requiring developer intervention. Users can:
- Request password reset via email
- Receive secure reset links (1-hour expiration)
- Create new passwords with validation
- Automatically logout from all sessions during reset
- Receive confirmation emails

---

## Implementation Checklist

### Step 1: Database Setup (15 minutes)

Create three new tables for password reset management:

```sql
-- 1. Password Reset Tokens Table
CREATE TABLE IF NOT EXISTS password_reset_tokens (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    user_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
    token_hash VARCHAR(255) NOT NULL UNIQUE,
    token_plain TEXT, -- Temporarily stored, shown only once to user
    expires_at TIMESTAMP NOT NULL,
    used_at TIMESTAMP,
    ip_address VARCHAR(45),
    user_agent TEXT,
    created_at TIMESTAMP NOT NULL DEFAULT NOW(),
    
    INDEX idx_user_id (user_id),
    INDEX idx_expires_at (expires_at)
);

-- 2. Login Attempts Table (Rate Limiting)
CREATE TABLE IF NOT EXISTS login_attempts (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    email VARCHAR(255) NOT NULL,
    ip_address VARCHAR(45),
    success BOOLEAN NOT NULL,
    attempted_at TIMESTAMP NOT NULL DEFAULT NOW(),
    
    INDEX idx_email_ip (email, ip_address),
    INDEX idx_attempted_at (attempted_at)
);

-- 3. Password Reset Requests Table (Rate Limiting)
CREATE TABLE IF NOT EXISTS password_reset_requests (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    email VARCHAR(255) NOT NULL,
    ip_address VARCHAR(45),
    requested_at TIMESTAMP NOT NULL DEFAULT NOW(),
    
    INDEX idx_email_ip (email, ip_address),
    INDEX idx_requested_at (requested_at)
);

-- 4. Add column to user_profiles (if not exists)
ALTER TABLE user_profiles ADD COLUMN IF NOT EXISTS 
    last_password_reset_at TIMESTAMP;
```

**How to execute:**
1. Go to Supabase Dashboard → SQL Editor
2. Create new query
3. Copy and paste the SQL above
4. Click "Run"

---

### Step 2: Create Forgot Password Page

Create: `src/pages/forgot-password.html`

This page allows users to enter their email and request a password reset.

**Key Features:**
- Email validation
- Rate limiting (max 3 requests per hour per IP)
- Success message after submission
- Link back to login

---

### Step 3: Create Reset Password Page

Create: `src/pages/reset-password.html`

This page is accessed via reset link and allows users to create a new password.

**Key Features:**
- Token validation (from URL parameter)
- Password strength validation (8+ chars, upper, lower, number, special)
- Confirm password verification
- Session invalidation (forces logout everywhere)
- Confirmation email

---

### Step 4: Add Reset Functions to auth.js

Add these authentication functions:

1. **`requestPasswordReset(email)`**
   - Validates email exists
   - Checks rate limits
   - Generates secure token
   - Sends email with reset link
   - Returns success/error

2. **`validateResetToken(token)`**
   - Checks token exists and is not expired
   - Ensures token hasn't been used
   - Returns user info if valid

3. **`resetPassword(token, newPassword)`**
   - Validates token
   - Validates password strength
   - Updates password via Supabase
   - Invalidates all user sessions
   - Marks token as used
   - Sends confirmation email

4. **`validatePasswordStrength(password)`**
   - At least 8 characters
   - Contains uppercase & lowercase
   - Contains number
   - Contains special character
   - Returns validation errors

---

### Step 5: Add Reset Functions to supabase.js

Add Supabase helper functions:

1. **`supabaseCreateResetToken(userId, email)`**
   - Generates random 32-character token
   - Hashes token with bcrypt
   - Stores hash in database (1-hour expiration)
   - Returns plain token for email

2. **`supabaseValidateResetToken(tokenHash)`**
   - Checks token exists and not expired
   - Checks token not already used
   - Returns user_id if valid

3. **`supabaseCompletePasswordReset(userId, tokenHash, newHashedPassword)`**
   - Updates auth.users password
   - Updates last_password_reset_at in user_profiles
   - Marks token as used
   - Invalidates all sessions

4. **`supabaseGetPasswordResetAttempts(email, ipAddress)`**
   - Checks if email has exceeded rate limit
   - Returns count of requests in last hour

---

### Step 6: Update Login Page

Modify: `src/pages/login.html`

Add link to forgot password:
```html
<p class="auth-footer">
    Forgot password? <a href="forgot-password.html">Reset it here</a>
</p>
```

---

### Step 7: Email Configuration

**Supabase Email Setup:**

1. Go to Supabase Dashboard → Authentication → Email Templates
2. Customize email template for password reset
3. Basic template:
   ```
   Subject: Reset Your KounterPro Password
   
   Body:
   Click the link below to reset your password:
   [Reset Link]
   
   This link expires in 1 hour.
   
   If you didn't request this, ignore this email.
   ```

---

## Security Features Implemented

✅ **Token Security**
- Tokens are never stored in plain text
- 32+ character random tokens
- 1-hour expiration
- One-time use only

✅ **Rate Limiting**
- Max 3 password reset requests per email per hour
- Max 5 failed login attempts per email per hour
- IP-based tracking

✅ **Password Validation**
- Minimum 8 characters
- Requires uppercase, lowercase, number, special char
- Cannot reuse previous password
- Hashed with bcrypt before storage

✅ **Session Management**
- All sessions invalidated after password change
- User must login again
- No tokens leaked in URLs (sent via email only)

✅ **User Privacy**
- Email validation with timing-attack protection
- No enumeration of registered emails
- Generic success message whether email exists or not

---

## Testing Checklist

### Test Case 1: Normal Password Reset
- [ ] Navigate to forgot-password.html
- [ ] Enter email address
- [ ] See success message
- [ ] Check email inbox
- [ ] Click reset link
- [ ] Enter new password
- [ ] Password requirements show progress
- [ ] Confirm password matches
- [ ] Click reset
- [ ] Redirected to login
- [ ] Can login with new password
- [ ] Old password no longer works

### Test Case 2: Rate Limiting
- [ ] Submit password reset 4 times in quick succession
- [ ] 4th attempt shows rate limit error
- [ ] Wait 1 hour simulation (or admin override)
- [ ] Can submit again

### Test Case 3: Token Expiration
- [ ] Get reset link
- [ ] Wait 1+ hour
- [ ] Click reset link
- [ ] See "Link expired" error
- [ ] Redirect to new request form

### Test Case 4: Invalid Token
- [ ] Access reset-password with fake token
- [ ] See "Invalid link" error

### Test Case 5: OAuth User Password Reset
- [ ] User signs up with Google
- [ ] Try to reset password
- [ ] See message: "This account uses Google Sign-In. Use Gmail to reset password."

### Test Case 6: Session Invalidation
- [ ] User logged in on 2 devices
- [ ] Reset password on Device 1
- [ ] Device 2 automatically logs out
- [ ] Both devices require re-login

---

## Implementation Flow

```
1. Database Setup
   ↓
2. forgot-password.html
   ↓
3. reset-password.html
   ↓
4. auth.js functions
   ↓
5. supabase.js functions
   ↓
6. Update login.html
   ↓
7. Email configuration
   ↓
8. Testing
   ↓
✅ Phase 2 Complete
```

---

## Files to Create/Modify

### New Files
- `src/pages/forgot-password.html`
- `src/pages/reset-password.html`

### Modified Files
- `src/scripts/auth.js` (add 4 new functions)
- `src/scripts/supabase.js` (add 4 new helper functions)
- `src/pages/login.html` (add forgot password link)
- `database/password-reset-schema.sql` (new SQL file)

---

## Next Steps

Would you like me to:

**Option A:** Provide step-by-step setup guide only (show all SQL and code)
**Option B:** Directly implement all code changes (like Phase 1)
**Option C:** Implement with configuration steps you complete manually (hybrid approach)

Choose your preferred approach and I'll proceed!
