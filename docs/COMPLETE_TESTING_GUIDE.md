# Complete Testing Guide: Phases 1-3

## Overview

Test offline-first functionality for KounterPro with:
- ✅ Phase 1: PWA Infrastructure (service worker, detection)
- ✅ Phase 2: Offline Invoice Storage (create & sync)
- ✅ Phase 3: Offline Inventory (stock management)

---

## Prerequisites

**Browser**: Chrome/Firefox with DevTools  
**Local Server**:
```bash
cd ~/Development/Working-KPro/kounterpro/src/pages
python3 -m http.server 8000
```

**APK**: Built and ready at  
`android/app/build/outputs/apk/debug/app-debug.apk`

---

## Test Suite 1: Offline Detection & PWA (Phase 1)

### Test 1.1: Service Worker Registration
**Goal**: Verify service worker loads and caches assets

**Steps**:
1. Open `http://localhost:8000/index.html`
2. DevTools → Application → Service Workers
3. Should show one running service worker

**Expected**:
✅ Service Worker registered  
✅ Status: "Running"

---

### Test 1.2: Offline Detection Banner
**Goal**: Verify offline indicator appears when offline

**Steps**:
1. DevTools → Network → Toggle to Offline (red circle)
2. Watch top of page

**Expected**:
✅ Red banner appears: "You are offline"  
✅ Banner shows immediately  
✅ No errors in console

**Fix if needed**:
- Check console: `CMD+Option+J`
- Look for errors in pwa.js loading
- Hard refresh: `CMD+Shift+R`

---

### Test 1.3: Online Detection
**Goal**: Verify banner clears when coming online

**Steps**:
1. Still offline from Test 1.2
2. DevTools → Click offline circle again (toggle online)
3. Watch banner

**Expected**:
✅ Red banner changes to green  
✅ Shows: "You are back online"  
✅ Auto-hides after 3 seconds

---

### Test 1.4: Install Button Visibility
**Goal**: Verify "Install App" button visible

**Steps**:
1. Go back online
2. Look at left sidebar (may need to expand)
3. Scroll down in nav items

**Expected**:
✅ "Install App" button visible  
✅ On click → Browser install prompt appears (on supported browsers)

---

## Test Suite 2: Invoice Offline Storage (Phase 2)

### Test 2.1: Create Invoice Offline
**Goal**: Create and save invoice to IndexedDB while offline

**Steps**:
1. Go offline: DevTools → Network → Offline
2. Navigate to: `http://localhost:8000/create-bill.html`
3. Fill invoice:
   - Customer: "Test Customer 1"
   - Item: "Widget", Qty: 5, Price: 100
4. Click "Save Invoice"

**Expected**:
✅ Toast: "💾 Invoice saved locally - will sync when online"  
✅ No errors in console  
✅ Invoice appears on page

---

### Test 2.2: Verify IndexedDB Storage
**Goal**: Confirm invoice stored in IndexedDB

**Steps**:
1. Still on create-bill.html (offline)
2. DevTools → Application → IndexedDB → KounterProDB → invoices
3. Look at stored invoice

**Expected**:
✅ Invoice visible in table  
✅ Fields: id, customer_name, invoice_number (DRAFT-...)  
✅ sync_status = "pending"  
✅ offline_created = true

---

### Test 2.3: Auto-Sync on Reconnect
**Goal**: Invoice automatically syncs when coming online

**Steps**:
1. Still offline with invoice created
2. DevTools → Click offline circle (toggle online)
3. Watch screen for sync indicator

**Expected**:
✅ Blue spinner appears: "🔄 Syncing..."  
✅ Processes for 1-2 seconds  
✅ Green checkmark: "✅ Sync Complete"  
✅ Toast: "✅ Sync Complete: 1 synced, 0 errors"

---

### Test 2.4: Verify in Supabase
**Goal**: Confirm invoice synced to cloud

**Steps**:
1. Open Supabase dashboard
2. Click your project → invoices table
3. Look for your test invoice

**Expected**:
✅ Invoice appears in table  
✅ Customer name matches: "Test Customer 1"  
✅ Total/amount correct  
✅ Created timestamp shows recent time

---

### Test 2.5: Multiple Invoices Batch Sync
**Goal**: Create several invoices offline and sync all at once

**Steps**:
1. Go offline again
2. Create 3 more invoices:
   - Invoice 2: "Customer 2", "Product B", Qty: 3, Price: 250
   - Invoice 3: "Customer 3", "Service C", Qty: 1, Price: 500
   - Invoice 4: "Customer 4", "Item D", Qty: 2, Price: 75
3. Check IndexedDB → should see 4 invoices total with sync_status="pending"
4. Go online

**Expected**:
✅ Sync shows: "🔄 Syncing..."  
✅ Processes 3 new invoices (slightly longer)  
✅ Toast: "✅ Sync Complete: 3 synced, 0 errors"  
✅ All 4 invoices in Supabase

---

### Test 2.6: Sync Queue Verification
**Goal**: Verify sync queue tracks operations

**Steps**:
1. DevTools → Application → IndexedDB → KounterProDB → sync_queue
2. Look at queue items

**Expected**:
✅ Items visible with status "synced"  
✅ Type: "invoice"  
✅ All items from recent sync

---

## Test Suite 3: Inventory Offline Management (Phase 3)

### Test 3.1: Download Inventory (Online)
**Goal**: Cache products for offline use

**Steps**:
1. Make sure you're online
2. Open: `http://localhost:8000/create-bill.html`
3. Check console (DevTools → Console)

**Expected**:
✅ Console shows: "📥 Downloading inventory for offline use..."  
✅ Message: "Downloaded X inventory items"  
✅ Toast: "✅ Cached X products for offline use"

---

### Test 3.2: Verify Inventory in IndexedDB
**Goal**: Confirm products stored locally

**Steps**:
1. DevTools → Application → IndexedDB → KounterProDB → inventory
2. Look at stored products

**Expected**:
✅ Products visible (id, name, sku, quantity)  
✅ Each has: quantity, local_quantity, sync_status  
✅ sync_status = "synced" (fresh download)

---

### Test 3.3: Create Invoice with Stock Deduction
**Goal**: Deduct inventory when creating offline invoice

**Steps**:
1. Go offline
2. Open create-bill.html
3. In console, note inventory item ID (from IndexedDB)
4. Create invoice:
   - Add item with known quantity (e.g., Widget: Qty 5)
5. Click Save

**Expected**:
✅ App checks stock first  
✅ Toast: "Invoice saved locally - will sync when online"  
✅ ✅ In IndexedDB → inventory: quantity reduced  
   - Before: 100
   - After: 95 (deducted 5)

---

### Test 3.4: Prevent Overselling
**Goal**: Block invoice if not enough stock

**Steps**:
1. Go offline
2. Check inventory quantities in IndexedDB
3. Create invoice requesting MORE than available:
   - Item: "Product X" which has quantity: 3
   - Request: Qty 10
4. Try to save

**Expected**:
❌ Toast: "⚠️ Insufficient stock: Product X (Need: 10, Have: 3)"  
❌ Invoice NOT saved  
❌ No changes to inventory

---

### Test 3.5: Progressive Stock Deduction
**Goal**: Stock reduces correctly with multiple invoices

**Steps**:
1. Go offline
2. Check initial inventory: "Widget" = 100
3. Create Invoice 1: Widget Qty 20 → After: 80
4. Create Invoice 2: Widget Qty 15 → After: 65
5. Create Invoice 3: Widget Qty 30 → After: 35
6. Check IndexedDB after each

**Expected**:
✅ Invoice 1: 100 → 80 ✓
✅ Invoice 2: 80 → 65 ✓
✅ Invoice 3: 65 → 35 ✓
✅ Final quantity: 35

---

### Test 3.6: Sync Inventory Changes
**Goal**: Upload inventory changes when online

**Steps**:
1. Have created invoices offline (from 3.5)
2. Note inventory state (Widget = 35 locally)
3. Go online

**Expected**:
✅ Blue spinner: "🔄 Syncing..."  
✅ Toast: "Inventory Sync: 1 synced, 0 errors"  
✅ Sync takes slightly longer (invoices + inventory)

---

### Test 3.7: Verify Inventory Updated in Supabase
**Goal**: Confirm server inventory matches local changes

**Steps**:
1. Open Supabase dashboard
2. Click inventory table
3. Find "Widget" product
4. Check quantity field

**Expected**:
✅ Widget quantity = 35 (matches local)  
✅ Previously was 100  
✅ Reduced by 65 (sum of all invoices)

---

### Test 3.8: Fresh Inventory Download
**Goal**: Re-download inventory when reconnecting

**Steps**:
1. Stay online for 2+ hours (or test by skipping the 1-hour check)
2. Go offline, create invoice
3. Come back online

**Expected**:
✅ App notices inventory cache expired  
✅ Auto-downloads fresh inventory  
✅ Updates IndexedDB with latest quantities  
✅ Toast: "✅ Cached X products for offline use"

---

## Integration Tests

### Test 4.1: Complete Workflow (All 3 Phases)
**Goal**: Full end-to-end offline scenario

**Steps**:

**Part 1: Prepare (Online)**
```
1. Open app - auto-downloads inventory
2. Wait for: "✅ Cached 50 products for offline use"
3. Note: Widget stock = 100, Service = 50
```

**Part 2: Work Offline**
```
4. Go offline (DevTools)
5. Create Invoice 1: Widget (Qty: 10) + Service (Qty: 5)
   ✅ Saves: "💾 Invoice saved locally"
   ✅ Inventory: Widget 90, Service 45
6. Create Invoice 2: Widget (Qty: 20)
   ✅ Saves
   ✅ Inventory: Widget 70
7. Try Invoice 3: Service (Qty: 100)
   ❌ Fails: "Insufficient stock"
   ✅ Inventory unchanged
```

**Part 3: Reconnect & Sync**
```
8. Go online
9. Watch progress:
   - Blue: "🔄 Syncing..." (2 invoices + inventory)
   - Green: "✅ Sync Complete"
10. Verify in Supabase:
    - 2 invoices created
    - Widget = 70
    - Service = 45
```

**Expected**: ✅ All steps succeed

---

### Test 4.2: Network Drop During Sync
**Goal**: Handle interruption gracefully

**Steps**:
1. Create 2 invoices offline
2. Go online (sync starts)
3. Immediately go offline while "🔄 Syncing..."
4. Wait 5 seconds
5. Go online again

**Expected**:
✅ No crashes  
✅ Eventually shows "✅ Sync Complete"  
✅ All data synced correctly  
✅ No duplicates

---

### Test 4.3: Mobile APK Testing
**Goal**: Test all features on actual Android device

**Setup**:
```bash
adb install -r android/app/build/outputs/apk/debug/app-debug.apk
```

**Test Steps**:
1. Set device to Airplane Mode (offline)
2. Open KounterPro app
3. Create invoice (should see "Saved locally")
4. Turn off Airplane Mode (online)
5. Watch for sync (blue → green)
6. Open Supabase on phone → verify invoice there

**Expected**:
✅ App works same as browser  
✅ All offline features work  
✅ Sync completes successfully

---

## Performance Tests

### Test 5.1: Offline Response Time
**Goal**: Measure invoice save speed offline

**Steps**:
1. Go offline
2. Create invoice
3. Time from click to toast

**Expected**: ✅ < 500ms (sub-second)

---

### Test 5.2: Sync Speed
**Goal**: Measure how long sync takes

**Steps**:
1. Create 10 invoices offline
2. Go online
3. Time sync from start to "Complete" toast

**Expected**: ✅ < 10 seconds for 10 invoices

---

### Test 5.3: Storage Usage
**Goal**: Check IndexedDB storage size

**Steps**:
1. Open DevTools → Application → IndexedDB → KounterProDB
2. Right-click → inspect
3. Note approximate size

**Expected**:
✅ < 500KB for typical business (100 invoices, 50 products)  
✅ < 50MB platform limit

---

## Troubleshooting Tests

### Test 6.1: Console Error Checking
**Goal**: Ensure no console errors

**Steps**:
1. Open DevTools → Console
2. Go through all tests
3. Look for red error messages

**Expected**: ✅ No red errors (warnings OK)

---

### Test 6.2: Service Worker Status
**Goal**: Verify service worker stays active

**Steps**:
1. DevTools → Application → Service Workers
2. Go through tests (online/offline/online)
3. Check status each time

**Expected**: ✅ Always shows "Running"

---

### Test 6.3: Data Persistence
**Goal**: Verify data survives refresh

**Steps**:
1. Create invoice offline
2. Don't sync yet
3. Hard refresh: `CMD+Shift+R`
4. Invoice still there?

**Expected**:
✅ Invoice still visible after refresh  
✅ Still marked "pending" sync  
✅ Data not lost

---

## Test Checklist

### Phase 1: PWA Infrastructure
- [ ] Service worker registered
- [ ] Offline banner shows red
- [ ] Online banner shows green (or hides)
- [ ] No console errors
- [ ] Install button visible

### Phase 2: Offline Invoices
- [ ] Create invoice offline → "Saved locally" toast
- [ ] Invoice in IndexedDB with sync_status=pending
- [ ] Come online → Blue sync spinner
- [ ] Green complete → Toast "Sync Complete"
- [ ] Invoice in Supabase
- [ ] Multiple invoices sync together

### Phase 3: Offline Inventory
- [ ] Inventory downloads when online
- [ ] Products cached in IndexedDB
- [ ] Stock deducted when invoice created
- [ ] Prevents overselling
- [ ] Inventory changes sync with invoices
- [ ] Supabase inventory matches local

### Integration
- [ ] Full workflow works (prepare → offline work → sync)
- [ ] Network drops handled gracefully
- [ ] Mobile APK works same as browser
- [ ] No data loss in any scenario

---

## Success Criteria

**All Tests Pass When**:
- ✅ No console errors (red messages)
- ✅ All offline operations work
- ✅ All sync operations complete
- ✅ Data matches in Supabase
- ✅ Performance acceptable (< 1s per operation)
- ✅ Works on web and mobile

**Issues to Fix Before Release**:
- ❌ Red console errors
- ❌ Sync failures
- ❌ Data inconsistencies
- ❌ Missing UI indicators

---

## Documentation Links

- Phase 1: `docs/PWA_OFFLINE_SUPPORT.md`
- Phase 2: `docs/PWA_PHASE2_OFFLINE_STORAGE.md` + `PHASE2_TESTING_GUIDE.md`
- Phase 3: `docs/PHASE3_OFFLINE_INVENTORY.md`
- Status: `docs/STATUS.md`

---

## Quick Reference

### Go Offline
```
DevTools → Network tab → Click red circle
```

### Check IndexedDB
```
DevTools → Application → IndexedDB → KounterProDB
```

### View Sync Progress
```
Bottom-right corner (or bottom-center on mobile)
Blue spinner → Green checkmark → Auto-hide
```

### Clear Everything (Nuclear Option)
```
DevTools → Application → Storage → Clear site data → Confirm
(But this also clears all indexedDB data - don't do unless testing recovery)
```

---

## Time Estimates

- Phase 1 tests: 10 minutes
- Phase 2 tests: 15 minutes  
- Phase 3 tests: 20 minutes
- Integration tests: 15 minutes
- Performance tests: 10 minutes
- **Total**: ~70 minutes for complete suite

---

## Reporting Issues

When something fails, note:
1. Which test number
2. Expected vs actual behavior
3. Console errors (copy-paste)
4. IndexedDB state (screenshot)
5. Supabase data (screenshot)
6. Network state (online/offline)
7. Browser/device type

Example:
```
Test 3.4 - Prevent Overselling
Expected: ⚠️ "Insufficient stock" toast, invoice NOT saved
Actual: 💾 "Invoice saved" - WRONG!
Console Error: TypeError in inventory-sync.js line 145
IndexedDB: Widget quantity went from 3 → -7 (should have failed)
```

---

**Complete Testing Guide Ready** ✅  
**Estimated Total Time**: 70-90 minutes  
**Expected Result**: All tests pass, all three phases fully functional
