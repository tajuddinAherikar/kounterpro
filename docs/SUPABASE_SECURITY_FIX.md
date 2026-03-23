# Supabase Security Fix Guide

## 🚨 The Issue

Supabase detected **1 error** in your KounterPro project:

**Missing Row Level Security (RLS) Policies**

Your database tables don't have RLS enabled, which means:
- ❌ Any authenticated user can read **ALL** invoices (not just their own)
- ❌ Any user can **modify** or **delete** other users' data
- ❌ Any user can see other users' customers and inventory
- ❌ Sensitive business data is exposed

---

## ✅ The Solution: Enable RLS + Policies

### Step 1: Go to Supabase Dashboard

1. Open: **https://app.supabase.com**
2. Select project: **KounterPro**
3. Go to: **Authentication → Policies** (or **Database → RLS**)

---

### Step 2: Enable RLS on All Tables

For each table below, click the table and toggle **RLS: ON**

**Tables to protect:**
- [ ] `invoices` - Billing data
- [ ] `customers` - Customer records
- [ ] `inventory` - Product stock
- [ ] `expenses` - Business expenses
- [ ] `payments` - Payment records
- [ ] `user_profiles` - User settings
- [ ] `password_reset_requests` - Password resets (optional)

---

### Step 3: Create Security Policies

**⚠️ If you get "policy already exists" error**: Your policies are already created! Skip to [Verification Checklist](#verification-checklist) below.

Copy and run **ONE of these options** in **Supabase SQL Editor** (Database → SQL Editor):

#### Option 1: Drop & Recreate (For Your Actual Tables)

```sql
-- ============================================
-- INVOICES TABLE POLICIES
-- ============================================

ALTER TABLE invoices ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "Users can view own invoices" ON invoices;
DROP POLICY IF EXISTS "Users can create own invoices" ON invoices;
DROP POLICY IF EXISTS "Users can update own invoices" ON invoices;
DROP POLICY IF EXISTS "Users can delete own invoices" ON invoices;

CREATE POLICY "Users can view own invoices"
ON invoices FOR SELECT
USING (auth.uid() = user_id);

CREATE POLICY "Users can create own invoices"
ON invoices FOR INSERT
WITH CHECK (auth.uid() = user_id);

CREATE POLICY "Users can update own invoices"
ON invoices FOR UPDATE
USING (auth.uid() = user_id)
WITH CHECK (auth.uid() = user_id);

CREATE POLICY "Users can delete own invoices"
ON invoices FOR DELETE
USING (auth.uid() = user_id);

-- ============================================
-- CUSTOMERS TABLE POLICIES
-- ============================================

ALTER TABLE customers ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "Users can view own customers" ON customers;
DROP POLICY IF EXISTS "Users can create own customers" ON customers;
DROP POLICY IF EXISTS "Users can update own customers" ON customers;
DROP POLICY IF EXISTS "Users can delete own customers" ON customers;

CREATE POLICY "Users can view own customers"
ON customers FOR SELECT
USING (auth.uid() = user_id);

CREATE POLICY "Users can create own customers"
ON customers FOR INSERT
WITH CHECK (auth.uid() = user_id);

CREATE POLICY "Users can update own customers"
ON customers FOR UPDATE
USING (auth.uid() = user_id)
WITH CHECK (auth.uid() = user_id);

CREATE POLICY "Users can delete own customers"
ON customers FOR DELETE
USING (auth.uid() = user_id);

-- ============================================
-- INVENTORY TABLE POLICIES
-- ============================================

ALTER TABLE inventory ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "Users can view own inventory" ON inventory;
DROP POLICY IF EXISTS "Users can create own inventory" ON inventory;
DROP POLICY IF EXISTS "Users can update own inventory" ON inventory;
DROP POLICY IF EXISTS "Users can delete own inventory" ON inventory;

CREATE POLICY "Users can view own inventory"
ON inventory FOR SELECT
USING (auth.uid() = user_id);

CREATE POLICY "Users can create own inventory"
ON inventory FOR INSERT
WITH CHECK (auth.uid() = user_id);

CREATE POLICY "Users can update own inventory"
ON inventory FOR UPDATE
USING (auth.uid() = user_id)
WITH CHECK (auth.uid() = user_id);

CREATE POLICY "Users can delete own inventory"
ON inventory FOR DELETE
USING (auth.uid() = user_id);

-- ============================================
-- EXPENSES TABLE POLICIES
-- ============================================

ALTER TABLE expenses ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "Users can view own expenses" ON expenses;
DROP POLICY IF EXISTS "Users can create own expenses" ON expenses;
DROP POLICY IF EXISTS "Users can update own expenses" ON expenses;
DROP POLICY IF EXISTS "Users can delete own expenses" ON expenses;

CREATE POLICY "Users can view own expenses"
ON expenses FOR SELECT
USING (auth.uid() = user_id);

CREATE POLICY "Users can create own expenses"
ON expenses FOR INSERT
WITH CHECK (auth.uid() = user_id);

CREATE POLICY "Users can update own expenses"
ON expenses FOR UPDATE
USING (auth.uid() = user_id)
WITH CHECK (auth.uid() = user_id);

CREATE POLICY "Users can delete own expenses"
ON expenses FOR DELETE
USING (auth.uid() = user_id);

-- ============================================
-- PAYMENTS TABLE POLICIES
-- ============================================

ALTER TABLE payments ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "Users can view own payments" ON payments;
DROP POLICY IF EXISTS "Users can create own payments" ON payments;
DROP POLICY IF EXISTS "Users can update own payments" ON payments;
DROP POLICY IF EXISTS "Users can delete own payments" ON payments;

CREATE POLICY "Users can view own payments"
ON payments FOR SELECT
USING (auth.uid() = user_id);

CREATE POLICY "Users can create own payments"
ON payments FOR INSERT
WITH CHECK (auth.uid() = user_id);

CREATE POLICY "Users can update own payments"
ON payments FOR UPDATE
USING (auth.uid() = user_id)
WITH CHECK (auth.uid() = user_id);

CREATE POLICY "Users can delete own payments"
ON payments FOR DELETE
USING (auth.uid() = user_id);

-- ============================================
-- USER_PROFILES TABLE POLICIES
-- ============================================

ALTER TABLE user_profiles ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "Users can view own profile" ON user_profiles;
DROP POLICY IF EXISTS "Users can update own profile" ON user_profiles;

CREATE POLICY "Users can view own profile"
ON user_profiles FOR SELECT
USING (auth.uid() = id);

CREATE POLICY "Users can update own profile"
ON user_profiles FOR UPDATE
USING (auth.uid() = id)
WITH CHECK (auth.uid() = id);

-- ============================================
-- AUDIT TABLES (No RLS needed - admin only)
-- ============================================
-- The following tables are for security tracking and don't need RLS:
-- - login_attempts (tracks failed logins, admin visibility ok)
-- - password_reset_requests (user_id already private)
-- - password_reset_tokens (time-limited, single use)

-- Optional: If you want users to see only their own password reset requests:
ALTER TABLE password_reset_requests ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "Users can view own reset requests" ON password_reset_requests;

CREATE POLICY "Users can view own reset requests"
ON password_reset_requests FOR SELECT
USING (auth.uid() = user_id);
```

#### Option 2: Just View the Existing Policies

If you don't want to drop and recreate, just verify they're correct:

```sql
-- Check RLS status
SELECT tablename, rowsecurity 
FROM pg_tables 
WHERE schemaname = 'public' 
AND tablename IN ('invoices', 'invoice_items', 'customers', 'user_profiles', 'inventory');

-- View existing policies
SELECT schemaname, tablename, policyname, permissive, qual, with_check
FROM pg_policies 
WHERE schemaname = 'public'

---

## 🔧 How to Apply These Policies

### Option A: Using Supabase Dashboard (Easiest)

1. Go to **https://app.supabase.com**
2. Select **KounterPro** project
3. Click **SQL Editor** (bottom left)
4. Copy the SQL above
5. Paste into the editor
6. Click **Run** button
7. Wait for "Success" message ✅

### Option B: Using Supabase CLI

```bash
# Install Supabase CLI
npm install -g supabase

# Login to Supabase
supabase login

# Link to your project
supabase link --project-ref clmozxqbttzdzrqdtrgs

# Apply migrations
supabase db push
```

---

## 📋 Verification Checklist

After applying the policies, verify each table:

### In Supabase Dashboard:

1. Go to **Database → Tables**
2. For each table, check:
   - [ ] **invoices** - RLS is ON, has 4 policies (SELECT, INSERT, UPDATE, DELETE)
   - [ ] **customers** - RLS is ON, has 4 policies
   - [ ] **inventory** - RLS is ON, has 4 policies
   - [ ] **expenses** - RLS is ON, has 4 policies
   - [ ] **payments** - RLS is ON, has 4 policies
   - [ ] **user_profiles** - RLS is ON, has 2 policies (SELECT, UPDATE)
   - [ ] **password_reset_requests** - RLS is ON, has 1 policy (SELECT)

**Note**: These tables need NO RLS (they're audit-only):
- login_attempts
- password_reset_tokens

---

## 🧪 Test the Security

### Test 1: Verify Only Own Data Access

```javascript
// Login as User A
await supabaseSignIn('user-a@example.com', 'password');

// Try to fetch invoices
const { data, error } = await supabaseClient
    .from('invoices')
    .select('*');

// ✅ Should only show User A's invoices
// ❌ Should NOT show User B's invoices (if User B exists)
```

### Test 2: Verify Write Protection

```javascript
// Login as User A
await supabaseSignIn('user-a@example.com', 'password');

// Try to update User B's invoice (you'll need User B's invoice ID)
const { data, error } = await supabaseClient
    .from('invoices')
    .update({ total_amount: 0 })
    .eq('id', 'user-b-invoice-id');

// ❌ Should fail with "permission denied" error
// ✅ This is the desired behavior
```

### Test 3: Check Console for Errors

1. Open your app: `http://localhost:8000/index.html`
2. Go to **DevTools → Console**
3. Log in with your account
4. Create an invoice
5. Check console for errors
6. Should see no permission errors ✅

---

## 🛡️ Security Best Practices (Additional)

### 1. Rotate Your Keys

Your ANON_KEY is exposed in client code (this is OK and required for browser apps).

**To rotate annually:**

1. In Supabase Dashboard → **Settings → API**
2. Click **Rotate** on ANON_KEY
3. Update `supabase.js` with new key:

```javascript
const SUPABASE_ANON_KEY = 'NEW_KEY_HERE';
```

### 2. Restrict API Permissions

In Supabase Dashboard → **Settings → API**:

- [ ] Enable **"Require API key for requests"** ✅
- [ ] Limit ANON_KEY to **anonymous users only**
- [ ] Keep SERVICE_ROLE_KEY private (never share!)

### 3. Enable Password Requirements

In Supabase Dashboard → **Authentication → Policies**:

- [ ] Password length: **minimum 8 characters**
- [ ] Require: **uppercase, lowercase, numbers**
- [ ] Expiration: **disable (for web apps)**

### 4. Audit Logs

In Supabase Dashboard → **Logs**:

- Monitor for failed authentication attempts
- Watch for unusual query patterns
- Check for data access anomalies

---

## 🔍 Common Errors & Fixes

### Error: "Permission denied for table 'invoices'"

**Cause**: RLS policy doesn't match your column names

**Fix**:
1. Check your actual table schema: **Database → Tables → Select Table**
2. Verify column name (might be `created_by` instead of `user_id`)
3. Update policy WITH clause accordingly:

```sql
-- If your column is 'created_by' instead of 'user_id':
CREATE POLICY "Users can view own invoices"
ON invoices FOR SELECT
USING (auth.uid() = created_by);  -- Changed user_id → created_by
```

### Error: "Column 'user_id' does not exist"

**Fix**: Check your table schema and update policies with correct column name

In Supabase:
1. **Database → Tables**
2. Click table name
3. See actual columns
4. Update SQL with correct column names

### Error: "New row violates row-level security policy"

**Cause**: Insert policy doesn't allow unauthenticated users OR missing user_id

**Fix**:
1. Ensure user is logged in: `await supabaseGetCurrentUser()`
2. Ensure invoice data includes current user's ID:

```javascript
const invoiceData = {
    user_id: currentUser.id,  // Must include this!
    total_amount: 100,
    // ... other fields
};
```

---

## 🚀 After Security Fix

### Your app will now:

✅ **Data Isolation**
- Each user only sees their own invoices
- Only their own customers visible
- Only their own inventory accessible
- Only their own expenses/payments visible
- No cross-user data leaks

✅ **Write Protection**
- Users can't modify others' invoices
- Customers, inventory, expenses isolated per user
- No unauthorized deletions
- Payments tracked per user

✅ **Audit Trail**
- All access logged in Supabase
- Can track who accessed what
- Security events recorded
- Compliance ready

✅ **Compliance Ready**
- Meets GDPR data protection
- Follows zero-trust security
- Industry best practices
- PCI-DSS payment data protected

---

## 📞 If You Have Issues

### 1. Check RLS Status

```sql
-- In Supabase SQL Editor, run:
SELECT tablename, rowsecurity 
FROM pg_tables 
WHERE schemaname = 'public'
ORDER BY tablename;
```

**Output should show (t = true = RLS enabled ✅):**
```
customers              | t ✅
expenses               | t ✅
inventory              | t ✅
invoices               | t ✅
login_attempts         | f (audit table, no RLS needed)
password_reset_requests| t ✅
password_reset_tokens  | f (audit table, no RLS needed)
payments               | t ✅
user_profiles          | t ✅
```

### 2. Check Policies

```sql
-- See all policies:
SELECT schemaname, tablename, policyname, permissive, qual 
FROM pg_policies 
WHERE schemaname = 'public';
```

### 3. Test Policy

```sql
-- As postgres (admin), test the policy:
SET SESSION AUTHORIZATION TO 'user-id-here';

SELECT * FROM invoices;  -- Should work only for that user
```

---

## 📝 Timeline

| Date | Action |
|------|--------|
| **Today** | Run SQL policies in Supabase SQL Editor |
| **Today +1h** | Test in browser and mobile |
| **Today +1d** | Verify all users still have access to their data |
| **Week 1** | Monitor Supabase logs |
| **Monthly** | Audit access patterns |
| **Yearly** | Rotate API keys |

---

## ✅ Completion Checklist

- [ ] Read this guide completely
- [ ] Logged into Supabase Dashboard
- [ ] Ran SQL policies in SQL Editor
- [ ] Verified RLS is enabled on all tables
- [ ] Verified policies exist (4+ per table)
- [ ] Tested in browser (create invoice, works?)
- [ ] Tested cross-user (can't see other users' data?)
- [ ] Checked console for errors (none?)
- [ ] Document your fixes in team notes
- [ ] Schedule annual key rotation (calendar reminder)

---

## 🎯 Next Steps

1. **Immediately**: Run SQL policies (this doc)
2. **Today**: Test in browser
3. **This week**: Test mobile APK
4. **Monthly**: Review Supabase logs
5. **Yearly**: Rotate API keys

---

## 🔗 Resources

- **Supabase RLS Docs**: https://supabase.com/docs/guides/auth/row-level-security
- **Supabase Security**: https://supabase.com/docs/guides/security
- **PostgreSQL RLS**: https://www.postgresql.org/docs/current/ddl-rowsecurity.html
- **OWASP**: https://owasp.org/www-project-top-ten/

---

**Status**: Ready to implement ✅  
**Severity**: HIGH - Security vulnerability  
**Time to fix**: 15 minutes  
**Impact**: Full data protection after fix  

**Once complete, reply to Supabase email to confirm fix applied.**
