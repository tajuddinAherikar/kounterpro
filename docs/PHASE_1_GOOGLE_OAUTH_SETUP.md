# Phase 1: Google OAuth Setup Guide
## KounterPro - Implementation Steps

**Objective**: Enable "Sign Up with Google" for KounterPro  
**Estimated Time**: 30-45 minutes  
**Prerequisites**: Supabase account, Google account

---

## Step 1: Create Google Cloud Project

### 1.1 Go to Google Cloud Console
```
URL: https://console.cloud.google.com/
```

### 1.2 Create a New Project
1. Click the **Project Selector** dropdown (top left, next to "Google Cloud")
2. Click **New Project**
3. Enter Project Details:
   - **Project Name**: `KounterPro Auth`
   - **Organization**: Leave empty (or select if you have one)
   - **Location**: Select your organization
4. Click **Create**
5. Wait for project to be created (1-2 minutes)

### 1.3 Switch to New Project
1. Click the **Project Selector** again
2. Select **KounterPro Auth** from the list

---

## Step 2: Enable Required APIs

### 2.1 Go to APIs & Services
1. In Google Cloud Console, go to **APIs & Services** → **Enabled APIs & services**
   ```
   URL: https://console.cloud.google.com/apis/dashboard
   ```

### 2.2 Enable Google+ API
1. Click **+ ENABLE APIS AND SERVICES** (top of page)
2. Search for **"Google+ API"**
3. Click on it
4. Click **Enable**
5. Wait for enabling to complete

### 2.3 Enable Identity and Access Management (IAM) API
1. Go back to API dashboard
2. Click **+ ENABLE APIS AND SERVICES** again
3. Search for **"Identity and Access Management (IAM) API"**
4. Click on it
5. Click **Enable**

**Status Check**: You should see these in your "Enabled APIs & services" list:
- ✅ Google+ API
- ✅ Identity and Access Management (IAM) API

---

## Step 3: Create OAuth 2.0 Credentials

### 3.1 Go to Credentials Page
1. In Google Cloud Console, go to **APIs & Services** → **Credentials**
   ```
   URL: https://console.cloud.google.com/apis/credentials
   ```

### 3.2 Create OAuth 2.0 Client ID
1. Click **+ CREATE CREDENTIALS** (top of page)
2. Select **OAuth client ID**
3. If prompted: "You'll need to create a consent screen first"
   - Click **Create Consent Screen**
   - Continue to Step 4 below

### 3.3 If Already Have Consent Screen, Skip to 3.4

---

## Step 4: Create OAuth Consent Screen

### 4.1 Access Consent Screen Configuration
```
URL: https://console.cloud.google.com/apis/credentials/consent
```

### 4.2 Select User Type
1. Choose **External** (for users outside your organization)
2. Click **Create**

### 4.3 Fill OAuth Consent Screen

**Section: App information**
- **App name**: `KounterPro`
- **User support email**: Enter your email
- **App logo**: (Optional) Skip for now

**Section: Developer contact information**
- **Email address**: Enter your email

**Section: Scopes**
- Click **ADD OR REMOVE SCOPES**
- Search for and select:
  - ✅ `https://www.googleapis.com/auth/userinfo.email`
  - ✅ `https://www.googleapis.com/auth/userinfo.profile`
  - ✅ `openid`
- Click **Update**

**Section: Test users** (Optional)
- You can add yourself as a test user for development
- Click **ADD USERS**
- Enter your email

### 4.4 Save and Continue
1. Click **Save and Continue**
2. Review the summary
3. Click **Back to Dashboard** (or **Publish App** if ready for production)

---

## Step 5: Get OAuth 2.0 Credentials

### 5.1 Return to Credentials Page
```
URL: https://console.cloud.google.com/apis/credentials
```

### 5.2 Create OAuth Client ID
1. Click **+ CREATE CREDENTIALS**
2. Select **OAuth client ID**
3. Choose **Application type**: **Web application**

### 5.3 Configure Web Application

**Name**: `KounterPro Web`

**Authorized JavaScript origins** (where your app is hosted):
```
Development:
http://localhost:3000
http://localhost

Production:
https://kounterpro.app (replace with your actual domain)
https://www.kounterpro.app
```

**Authorized redirect URIs** (OAuth callback URLs):
```
Development:
http://localhost:3000/auth/v1/callback?provider=google
http://localhost/auth/v1/callback?provider=google

Production:
https://kounterpro.app/auth/v1/callback?provider=google
https://www.kounterpro.app/auth/v1/callback?provider=google

Plus your Supabase redirect:
https://[your-supabase-url].supabase.co/auth/v1/callback?provider=google
```

**Example Supabase URL**:
If your Supabase URL is `https://xyzabc123.supabase.co`, add:
```
https://xyzabc123.supabase.co/auth/v1/callback?provider=google
```

### 5.4 Create and Copy Credentials
1. Click **Create**
2. A popup shows your credentials:
   - **Client ID**: `XXXXX.apps.googleusercontent.com`
   - **Client Secret**: `XXXXX`
3. **Copy both values** (you'll need them in next steps)
4. Save them securely (password manager, .env file)
5. Click **Close**

⚠️ **Keep Client Secret secure!** Never commit to Git.

---

## Step 6: Enable Google OAuth in Supabase

### 6.1 Go to Supabase Dashboard
```
URL: https://app.supabase.com/
```

### 6.2 Select Your Project
1. Click on your KounterPro project
2. Go to **Authentication** (left sidebar)

### 6.3 Access OAuth Providers
1. Click **Providers**
2. Look for **Google** in the list
3. Click on **Google** to expand

### 6.4 Configure Google Provider

**Toggle**: Enable **Enable Sign in with Google**
- Status should change to **Enabled** (green)

**Client ID**:
- Paste the Google Client ID from Step 5

**Client Secret**:
- Paste the Google Client Secret from Step 5

**Authorized redirect URL** (shown for reference):
```
https://[your-supabase-url].supabase.co/auth/v1/callback?provider=google
```

### 6.5 Save Changes
1. Click **Save**
2. Verify the provider shows **Enabled** next to Google

---

## Step 7: Configure Local Development Environment

### 7.1 Create .env.local File
**File**: `/Users/a2251/Development/KounterPro/main/kounterpro/.env.local`

```bash
# Supabase Configuration
VITE_SUPABASE_URL=https://your-supabase-url.supabase.co
VITE_SUPABASE_ANON_KEY=your-anon-key-here

# Google OAuth
VITE_GOOGLE_CLIENT_ID=your-google-client-id.apps.googleusercontent.com

# App Configuration
VITE_APP_URL=http://localhost:3000
VITE_API_URL=http://localhost:3000/api
```

### 7.2 Find Your Supabase Keys
1. Go to Supabase Dashboard
2. Click your project
3. Go to **Settings** → **API**
4. Copy:
   - **Project URL** → `VITE_SUPABASE_URL`
   - **anon/public key** → `VITE_SUPABASE_ANON_KEY`

### 7.3 Update .env.local
Replace placeholders with actual values

---

## Step 8: Local Testing Redirect

### 8.1 Update Google Console for Local Testing
1. Go back to Google Cloud Console
2. **APIs & Services** → **Credentials**
3. Click on your **OAuth 2.0 Client ID** (Web application)
4. Under **Authorized redirect URIs**, add:
   ```
   http://localhost:8080/auth/v1/callback?provider=google
   http://localhost:5000/auth/v1/callback?provider=google
   http://127.0.0.1:3000/auth/v1/callback?provider=google
   ```
5. Click **Save**

### 8.2 Where to Access Local App
During development, use the port your app runs on:
- **Port 3000**: `http://localhost:3000`
- **Port 5000**: `http://localhost:5000`
- **Port 8080**: `http://localhost:8080`

⚠️ Each port needs to be whitelisted in Google Cloud Console

---

## Step 9: Verification Checklist

Before implementing code, verify all setup:

### Google Cloud Console
- [ ] Project created: `KounterPro Auth`
- [ ] Google+ API enabled
- [ ] IAM API enabled
- [ ] OAuth Consent Screen created
- [ ] OAuth 2.0 Credentials created (Web application)
- [ ] Client ID obtained
- [ ] Client Secret obtained
- [ ] Redirect URIs configured
  - [ ] `https://[supabase-url].supabase.co/auth/v1/callback?provider=google`
  - [ ] `http://localhost:3000/auth/v1/callback?provider=google`
  - [ ] `http://localhost:5000/auth/v1/callback?provider=google`

### Supabase Console
- [ ] Google OAuth provider **Enabled**
- [ ] Client ID entered
- [ ] Client Secret entered
- [ ] Status shows ✅ **Enabled**

### Local Environment
- [ ] `.env.local` file created
- [ ] `VITE_SUPABASE_URL` set
- [ ] `VITE_SUPABASE_ANON_KEY` set
- [ ] `VITE_GOOGLE_CLIENT_ID` set

---

## Troubleshooting

### Error: "Redirect URI mismatch"
**Problem**: Google redirects but gets OAuth error  
**Solution**: 
1. Check Google Console redirect URIs exactly match your app's URL
2. Include `?provider=google` in the URI
3. Check protocol (http vs https)

### Error: "Client not configured"
**Problem**: OAuth button click does nothing  
**Solution**:
1. Verify Client ID is correct in Supabase config
2. Verify Google provider is **Enabled** in Supabase (green toggle)
3. Check `.env.local` has correct `VITE_GOOGLE_CLIENT_ID`

### Testing Redirect URIs
**Development**: Use `http://localhost:3000` (or your dev port)  
**Staging**: Use `http://localhost:8080`  
**Production**: Use `https://kounterpro.app`

Add ALL ports/domains to Google Console **Authorized redirect URIs**

### Getting "Invalid Client" Error
**Solution**:
1. Verify Client ID format: `XXXXX.apps.googleusercontent.com`
2. Check Client Secret is set in Supabase (black dot shows it's set)
3. Verify OAuth Consent Screen is published/created

---

## Next Steps After Setup

Once verification checklist is complete:

1. ✅ Setup complete
2. 👉 Next: "Code Implementation" (add OAuth button to signup page)
3. 🧪 Test: Sign up with Google
4. 🔗 Implement: Account linking for existing users

---

## Reference: OAuth 2.0 Flow (What's Happening Behind Scenes)

```
1. User clicks "Sign Up with Google" button
   ↓
2. App redirects to Google OAuth consent screen
   └─ URL: https://accounts.google.com/o/oauth2/v2/auth?...
   ↓
3. User authenticates with Google
   └─ Google asks: "Allow KounterPro to access your email & profile?"
   ↓
4. User clicks "Allow"
   ↓
5. Google redirects to Supabase callback URL
   └─ URL: https://[supabase-url].supabase.co/auth/v1/callback?code=...&state=...
   ↓
6. Supabase exchanges code for access token
   └─ Backend communication (you don't see this)
   ↓
7. Supabase creates session & redirects to your app
   └─ URL: http://localhost:3000 (or your app URL)
   ↓
8. Session established - user logged in!
```

---

**Document Created**: March 4, 2026  
**Last Updated**: March 4, 2026  
**Status**: Ready for Configuration
