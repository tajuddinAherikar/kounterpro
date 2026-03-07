# GitHub Pages OAuth Configuration Fix

## Status: TEMPORARILY DISABLED ⏸️

Google OAuth sign-up has been **temporarily disabled** on GitHub Pages deployment due to session handling limitations with static hosting and subdirectory structures.

**Why?**
- OAuth works perfectly on local development (`http://localhost:5173`)
- On GitHub Pages, the Supabase client has difficulty persisting and retrieving sessions after redirect
- The issue is specific to GitHub Pages' static hosting environment with nested directory structure (`/kounterpro/src/pages/`)
- This is a known limitation with static hosting of SPAs

**Solution:**
Redeploy the app to a **dedicated domain** (not a GitHub Pages subdirectory) where:
- Session management works reliably
- Redirect URLs are simpler (e.g., `https://yourdomain.com/` vs `https://github.com/user/repo/`)
- OAuth providers can properly manage authentication flow

User can still sign up using **Email/Password authentication** on GitHub Pages.

### Step 1: Update Supabase Redirect URLs (CRITICAL)

1. **Go to Supabase Dashboard**: https://app.supabase.com/
2. **Select your KounterPro project**
3. **Navigate to**: Authentication → Providers → Google → Settings
4. **Update "Authorized redirect URIs"** to include **all** these URLs (carefully **add** new ones and **remove** any old, generic `http://localhost/auth/v1/callback`, `http://localhost:3000/auth/v1/callback`, `http://localhost:8000/auth/v1/callback` entries):
   ```
   https://clmozxqbttzdzrqdtrgs.supabase.co/auth/v1/callback
   http://localhost:5173/src/pages/index.html
   http://127.0.0.1:5173/src/pages/index.html
   https://tajuddinaherikar.github.io/kounterpro/
   ```
   ⚠️ **Important**: Ensure the Supabase callback URL (`https://clmozxqbttzdzrqdtrgs.supabase.co/auth/v1/callback`) is **kept** as it's essential for Google to communicate with Supabase. Do NOT include `/src/pages/` in the GitHub Pages URLs, use `/kounterpro/` as the root for your app.

5. **Then navigate to**: Authentication → URL Configuration
6. **Update "Site URL"** (not needed if already set):
   - For GitHub Pages: `https://tajuddinaherikar.github.io`
   
7. **Update "Redirect URLs"** section to include **only** these URLs:
   ```
   http://localhost:5173/src/pages/index.html
   http://127.0.0.1:5173/src/pages/index.html
   https://tajuddinaherikar.github.io/kounterpro/
   ```

### Step 2: Code Changes (DONE ✅)
The following code updates have been implemented:

#### File: `src/scripts/supabase.js`
Updated `supabaseSignInWithGoogle()` function to:
- Detect local dev vs GitHub Pages environment
- Use `/src/pages/index.html` redirect for local dev
- Use `/` (root) redirect for GitHub Pages

```javascript
// Detects environment and sets appropriate redirect
if (isDev) {
    redirectUrl = window.location.origin + '/src/pages/index.html';
} else {
    redirectUrl = window.location.origin + '/';
}
```

#### File: `src/scripts/auth.js`
Updated `handleOAuthCallback()` function to:
- Support both local dev and GitHub Pages paths
- Properly build redirect URL based on environment
- Handle URL fragments correctly for GitHub Pages

## Testing Steps

### Test 1: Local Development
```bash
npm run dev
# Visit http://localhost:5173/src/pages/login.html
# Click "Sign up with Google"
# Should redirect to Google consent → return to app → see dashboard
```

### Test 2: GitHub Pages
1. Push code to GitHub
2. Wait for GitHub Pages to deploy
3. Visit: `https://tajuddinaherikar.github.io/src/pages/login.html`
4. Click "Sign up with Google"
5. Should redirect to Google consent → return to app → see dashboard

## How OAuth Flow Works Now

```
1. User clicks "Sign up with Google" button
   ↓
2. supabaseSignInWithGoogle() called
   ├─ Detects environment (dev vs production)
   ├─ Sets appropriate redirect URL
   └─ Calls Supabase OAuth
   ↓
3. User is redirected to Google consent screen
   ↓
4. User approves permissions
   ↓
5. Google redirects back to our app with token
   ├─ Dev: http://localhost:5173/src/pages/index.html#access_token=...
   └─ GitHub Pages: https://tajuddinaherikar.github.io/#access_token=...
   ↓
6. handleOAuthCallback() runs on page load
   ├─ Checks for valid session (token in URL fragment)
   ├─ Creates user_profile if new user
   ├─ Updates last_login info
   └─ Redirects to dashboard
   ↓
7. User sees dashboard ✅
```

## Troubleshooting

### Still getting 404 after OAuth redirect?
1. **Check Supabase configuration**: Verify redirect URLs are set correctly in Supabase dashboard
2. **Check browser console**: Look for error messages in DevTools console
3. **Check Supabase Logs**: Go to Authentication → Users to see if session was created
4. **Clear browser cache**: Supabase tokens may be cached, do a hard refresh (Cmd+Shift+R on Mac)

### OAuth redirect URL mismatch error?
1. Go back to Supabase dashboard
2. Remove any old redirect URLs
3. Add exactly these three URLs (no /src/pages/ for GitHub Pages):
   ```
   http://localhost:5173/src/pages/index.html
   http://127.0.0.1:5173/src/pages/index.html
   https://tajuddinaherikar.github.io/
   ```
4. Save and refresh browser

### User not seeing dashboard after OAuth?
1. Check if session was created in Supabase (Authentication → Users)
2. Check if user_profile was created in database
3. Check browser console for error messages
4. May need to run this SQL to ensure profile exists:
   ```sql
   SELECT id, email, created_at FROM auth.users WHERE email = 'user@example.com';
   ```

## Database Schema Addition (Optional - Already Done)
If needed later, add password reset tracking to user_profiles:
```sql
ALTER TABLE user_profiles 
ADD COLUMN last_password_reset_at timestamp,
ADD COLUMN password_reset_count integer DEFAULT 0;
```

## Files Modified
- ✅ `src/scripts/supabase.js` - OAuth redirect URL logic
- ✅ `src/scripts/auth.js` - OAuth callback handling
- ⏳ Supabase dashboard - Redirect URLs (manual step)

## Next Steps
1. ✅ Apply code changes (done)
2. ⏳ Update Supabase dashboard redirect URLs (MANUAL - see Step 1 above)
3. ⏳ Test on GitHub Pages
4. ⏳ Verify password reset works on GitHub Pages
5. ⏳ Document any additional GitHub Pages issues

## Additional Notes
- The hardcoded `/src/pages/` path in the app structure makes GitHub Pages deployment tricky
- Future improvement: Restructure app to serve from root directory
- For now, this fix handles both local dev and GitHub Pages deployment
