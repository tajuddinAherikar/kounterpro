# Phase 2 Testing Guide

## Quick Start Testing (5 minutes)

### Prerequisites
- [ ] Browser with DevTools (Chrome recommended)
- [ ] Local server running: `python3 -m http.server 8000 --directory src/pages`
- [ ] Current APK built and installed (optional)

---

## Test 1: Create Invoice Offline (Browser)

**Goal**: Verify invoices save locally when offline

**Steps**:
1. Open DevTools: `CMD+Option+I` (Mac) or `F12` (Windows/Linux)
2. Go to **Network** tab
3. Click the circle icon (Offline toggle) → it turns **RED** ⚫
4. Navigate to: `http://localhost:8000/create-bill.html`
5. Fill in invoice details:
   - Customer: "Test Customer"
   - Item: "Product", Qty: 1, Price: 100
   - Click "Save Invoice"

**Expected Results**:
- ✅ Toast appears: "💾 Invoice saved locally - will sync when online"
- ✅ No error in console
- ✅ Invoice shows on page

**If it fails**:
- Check console for errors: `CMD+Option+J`
- Look for red error messages
- Check if `indexed-db.js` and `offline-sync.js` are loaded in Network tab

---

## Test 2: Check IndexedDB Storage

**Goal**: Verify invoice actually stored in IndexedDB

**Steps**:
1. Keep offline mode active
2. In DevTools, click **Application** tab
3. Left sidebar → **IndexedDB**
4. Expand → **KounterProDB**
5. Click **invoices** store
6. Look for your invoice in the table

**Expected Results**:
- ✅ Your invoice appears in the list
- ✅ Fields visible: id, invoice_number, customer_name, total
- ✅ `sync_status` = "pending"
- ✅ `offline_created` = true

**What you should see**:
```
id: 1
customer_name: "Test Customer"
invoice_number: "DRAFT-1710698400000"
total: 100
sync_status: "pending"
offline_created: true
```

---

## Test 3: Come Online & Auto-Sync

**Goal**: Watch invoice auto-sync to Supabase when reconnecting

**Steps**:
1. Still in create-bill.html with offline invoice
2. In DevTools Network tab, click the RED circle to go **ONLINE** ✅
3. Watch bottom-right corner of screen

**Expected Results**:
- ✅ Blue sync indicator appears: "🔄 Syncing..."
- ✅ Processes for 1-2 seconds
- ✅ Changes to green: "✅ Sync Complete"
- ✅ Auto-hides after 3 seconds
- ✅ Toast: "✅ Sync Complete: 1 synced, 0 errors"

**If you don't see the indicator**:
- Scroll down - might be hidden
- Check mobile mode (bottom center instead of bottom-right)
- Look in console for sync process logs

---

## Test 4: Verify Sync in Supabase

**Goal**: Confirm invoice actually synced to cloud

**Steps**:
1. Go to Supabase Dashboard: https://app.supabase.com
2. Click your project
3. Left sidebar → **invoices** table
4. Look for your just-synced invoice

**Expected Results**:
- ✅ Invoice appears in table with new server ID
- ✅ Customer name matches
- ✅ Total matches (100)
- ✅ Data is complete and correct

**If invoice not there**:
- Check different user (if multiple accounts)
- Check if sync completed (see console logs)
- Refresh Supabase page

---

## Test 5: Multiple Invoices Offline

**Goal**: Create several invoices offline and sync them all at once

**Steps**:
1. Go offline again (DevTools → Network → Offline)
2. Create 3 more invoices:
   - Invoice 2: "Customer B", Item: "Service", Price: 250
   - Invoice 3: "Customer C", Item: "Product", Price: 500
   - Invoice 4: "Customer D", Item: "Repair", Price: 75
3. Each one should show "saved locally" toast
4. Go to IndexedDB → invoices
5. You should see 4 invoices with `sync_status: "pending"`
6. Now go ONLINE (click circle again)

**Expected Results During Sync**:
- ✅ Sync indicator: "🔄 Syncing..."
- ✅ Processes for 3-4 seconds (multiple invoices)
- ✅ Shows: "✅ Sync Complete: 3 synced, 0 errors" (for new ones)
- ✅ All 4 invoices in IndexedDB now show `sync_status: "synced"`

**In Supabase**:
- ✅ 3 new invoices appear
- ✅ Total of 4 invoices (including first test)

---

## Test 6: Network Error Handling

**Goal**: Verify app handles sync errors gracefully

**Steps**:
1. Go offline
2. Create an invoice ("Error Test", Item: "Bug", Price: 10)
3. Go online BUT immediately go offline again (fast toggle)
4. Try to trigger sync by refreshing page

**Expected Results**:
- ✅ Shows error: "❌ Sync Error"
- ✅ No crash or console errors
- ✅ Invoice remains in IndexedDB with `sync_status: "pending"`
- ✅ Can retry by going back online

---

## Test 7: Mobile/Responsive

**Goal**: Test sync indicator position on mobile

**Steps**:
1. DevTools → Toggle device toolbar (CMD+Shift+M)
2. Select iPhone 12 or similar
3. Create an invoice while offline
4. Go online to trigger sync

**Expected Results**:
- ✅ Sync indicator appears at bottom-center
- ✅ Positioned above floating action button
- ✅ Text is readable on small screen
- ✅ Doesn't interfere with buttons

---

## Test 8: APK Device Test (Optional)

**Goal**: Test offline creation on actual Android device

**Prerequisites**:
- APK built: `android/app/build/outputs/apk/debug/app-debug.apk`
- Android device with USB debugging enabled

**Steps**:
1. Connect device via USB
2. Install APK:
   ```bash
   cd /Users/a2251/Development/Working-KPro/kounterpro
   adb install -r android/app/build/outputs/apk/debug/app-debug.apk
   ```
3. Enable Airplane Mode on device (Settings)
4. Open KounterPro app
5. Create an invoice (all in Airplane Mode)
6. Should see "Saved locally" toast

**Disable Airplane Mode**:
7. Turn off Airplane Mode
8. Watch for sync spinner
9. Should see green checkmark

**Verification**:
- Open Supabase → invoices table
- ✅ Invoice should appear there

---

## Debugging Checklist

If something doesn't work, check these in order:

### ❌ Invoice won't save offline
- [ ] Check console for errors: `CMD+Option+J`
- [ ] Verify offline mode is active (circle should be RED)
- [ ] Verify `indexed-db.js` loaded (Network tab, search "indexed-db")
- [ ] Try hard refresh: `CMD+Shift+R`

### ❌ Sync indicator doesn't appear
- [ ] Try scrolling (might be outside viewport)
- [ ] Try on mobile mode (position different)
- [ ] Check console for: "Starting offline sync..."
- [ ] Look for blue spinner in bottom-right or bottom-center

### ❌ Invoice doesn't sync to Supabase
- [ ] Check `online` event fired (console should log)
- [ ] Verify user logged in
- [ ] Check IndexedDB - sync_status still "pending"?
- [ ] Look at Supabase tables - is it there but NOT showing?

### ❌ IndexedDB empty
- [ ] Data might have been cleared by browser
- [ ] Try creating new invoice
- [ ] Check Application → Clear site data (do NOT click unless testing)

### ❌ Getting errors in console
- [ ] Screenshot the error
- [ ] Check if it's from `offline-sync.js` or `indexed-db.js`
- [ ] Search for error message in file (should have descriptive messages)

---

## Console Commands (Advanced)

Open Console tab (CMD+Option+J) and try these:

```javascript
// Check sync state
getSyncStatus()
// Returns: { isSyncing, lastSyncTime, failedCount, etc }

// Get all pending items
await getPendingSyncItems()
// Shows queue of items waiting to sync

// Force manual sync
await manualSync()
// Triggers sync immediately

// Get last sync time
await getLastSyncTime()
// Returns: Date object of last successful sync

// See all databases
indexedDB.databases()
// Should include "KounterProDB"
```

---

## Common Issues & Solutions

### Issue: "Cannot save invoice locally"
**Cause**: IndexedDB not initialized or quota exceeded  
**Fix**: Try refreshing page, or clear IndexedDB

### Issue: Sync shows "0 synced"
**Cause**: No pending items found (maybe already synced)  
**Fix**: Create new invoice offline, then go online

### Issue: APK shows "Offline Mode" forever
**Cause**: PWA module might not have internet connection  
**Fix**: Check device internet connection, try toggling Airplane Mode

### Issue: Invoice appears twice (locally + in Supabase)
**Cause**: Normal - there's a local copy and server copy  
**Fix**: Both will stay, local marked as "synced"

---

## Performance Notes

- **IndexedDB writes**: ~100ms per invoice
- **Sync upload**: ~500ms per 10 invoices (depends on network)
- **Storage**: Each invoice ~2-5KB in IndexedDB
- **Max invoices**: ~10,000 per 50MB limit

---

## What to Test Next (Phase 3)

- [ ] Inventory sync (offline stock deduction)
- [ ] Customer creation offline
- [ ] Batch operations (multiple edits)
- [ ] Data conflicts (edit same invoice offline and online)

---

## Questions or Issues?

Check these files:
- **Implementation**: `docs/PWA_PHASE2_OFFLINE_STORAGE.md`
- **Summary**: `docs/PHASE2_IMPLEMENTATION_SUMMARY.md`
- **Code**: `src/pages/scripts/indexed-db.js` and `offline-sync.js`

**Console Logs Location**: DevTools → Console tab
**Database Location**: DevTools → Application → IndexedDB → KounterProDB
**Network Activity**: DevTools → Network tab

---

## Checklist for Full Test Pass ✅

- [ ] Test 1: Create invoice offline → see "saved locally" toast
- [ ] Test 2: Check IndexedDB → invoice visible with pending status
- [ ] Test 3: Go online → see blue sync spinner
- [ ] Test 4: Green checkmark appears and hides
- [ ] Test 5: Supabase shows the synced invoice
- [ ] Test 6: Multiple invoices sync correctly
- [ ] Test 7: Error handling works (network drop)
- [ ] Test 8: Mobile view responsive
- [ ] Test 9: APK works on device (optional)

**When all checks pass**: ✅ Phase 2 verified!

---

**Estimated Time**: 10-15 minutes for full test suite  
**Difficulty**: Easy (mostly UI observation)  
**Success Rate**: Should be 100% if files installed correctly
