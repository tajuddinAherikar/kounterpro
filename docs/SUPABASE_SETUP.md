# Supabase Setup Guide for KounterPro

## 🚀 Quick Setup (5 minutes)

### Step 1: Configure Your Credentials

1. Open `supabase.js` in your code editor
2. Replace the placeholder values on lines 4-5:

```javascript
const SUPABASE_URL = 'https://your-project.supabase.co'; // Your actual Supabase URL
const SUPABASE_ANON_KEY = 'eyJhbGciOiJ...'; // Your actual anon/public key
```

**Where to find these:**
- Go to [supabase.com](https://supabase.com/dashboard)
- Select your project
- Go to **Settings** → **API**
- Copy "Project URL" and "anon/public" key

### Step 2: Create Database Tables

1. In Supabase Dashboard, go to **SQL Editor**
2. Copy and paste the SQL from the previous message (users, inventory, invoices tables)
3. Click **Run** to create all tables and security policies

### Step 3: Test Connection

1. Open your app in browser
2. Open browser console (F12)
3. Look for: `✅ Supabase initialized successfully`
4. If you see `⚠️ Supabase credentials not configured`, check Step 1

## 📦 What's Included

### Authentication Functions
- `supabaseSignUp(email, password, businessName, mobile)` - Create new account
- `supabaseSignIn(email, password)` - Login user
- `supabaseSignOut()` - Logout user
- `supabaseGetCurrentUser()` - Get logged-in user
- `supabaseGetSession()` - Check session status

### Inventory Functions
- `supabaseGetInventory()` - Fetch all items
- `supabaseAddInventoryItem(item)` - Add new item
- `supabaseUpdateInventoryItem(id, updates)` - Update item
- `supabaseDeleteInventoryItem(id)` - Delete item
- `supabaseUpdateStock(itemName, quantitySold)` - Reduce stock after sale

### Invoice Functions
- `supabaseGetInvoices()` - Fetch all invoices
- `supabaseAddInvoice(invoice)` - Save new invoice
- `supabaseDeleteInvoice(id)` - Delete invoice
- `supabaseSearchInvoices(searchTerm)` - Search by number or customer

### Migration Functions
- `migrateLocalStorageToSupabase()` - Move existing data to cloud
- `downloadSupabaseBackup()` - Download cloud backup as JSON

### Utility Functions
- `isSupabaseConfigured()` - Check if credentials are set
- `getSupabaseStatus()` - Get current connection status

## 🔄 Next Steps

### Option 1: Test in Console (Recommended First)
Open browser console and try:
```javascript
// Check status
getSupabaseStatus();

// Test fetching inventory (after configuring)
supabaseGetInventory().then(result => console.log(result));
```

### Option 2: Migrate Existing Data
If you have data in localStorage, run:
```javascript
migrateLocalStorageToSupabase().then(result => {
    console.log(result.message);
});
```

### Option 3: Update App to Use Supabase
I can help update your existing files (auth.js, inventory.js, billing.js, dashboard.js) to use Supabase functions instead of localStorage. This will:
- Enable multi-device sync
- Add real authentication
- Provide cloud backup
- Enable data recovery

Would you like me to proceed with Option 3?

## 🔐 Security Features

✅ **Row Level Security (RLS)** - Users can only see their own data  
✅ **Secure Authentication** - Email/password with session management  
✅ **API Key Protection** - anon key is safe for client-side use  
✅ **Data Isolation** - Each user's data is completely separate  

## ⚠️ Important Notes

1. **Free Tier Limits:**
   - 500 MB database storage
   - 1 GB file storage
   - 2 GB bandwidth/month
   - Unlimited API requests

2. **Data Privacy:**
   - Your data stays in Supabase's secure servers
   - RLS policies prevent cross-user data access
   - You can export/backup anytime

3. **LocalStorage Backup:**
   - Keep your localStorage data until migration is confirmed
   - Test Supabase thoroughly before full switch

## 🆘 Troubleshooting

**Problem:** Console shows "Supabase library not loaded"
- **Solution:** Refresh page, check internet connection

**Problem:** "User not authenticated" errors
- **Solution:** Implement authentication flow first (Option 3)

**Problem:** "Row Level Security policy violation"
- **Solution:** Make sure you ran the SQL policies from Step 2

**Problem:** Data not showing after migration
- **Solution:** Check browser console for errors, verify user is logged in

## 📞 Ready to Go Live?

Once configured, your app will:
- ✅ Work across multiple devices
- ✅ Sync data in real-time
- ✅ Support multiple users
- ✅ Have automatic cloud backup
- ✅ Enable password recovery
- ✅ Scale to thousands of invoices

Let me know when you're ready to update the app files to use Supabase!
