/**
 * KounterPro Offline Sync Handler
 * Manages automatic sync of offline changes to Supabase
 * 
 * Features:
 * - Auto-sync when coming online
 * - Retry logic with exponential backoff
 * - Conflict resolution (last-write-wins)
 * - Sync progress tracking
 * - Error handling and recovery
 */

// ============================================
// SYNC STATUS TRACKING
// ============================================

const SyncState = {
    isSyncing: false,
    lastSyncTime: null,
    syncInProgress: [],
    failedItems: [],
    successCount: 0,
    errorCount: 0
};

// ============================================
// LISTEN FOR ONLINE EVENT
// ============================================

/** Start sync when device comes online */
window.addEventListener('online', async () => {
    console.log('🔗 Device is online - waiting for Supabase auth...');
    // Wait for Supabase to initialize and restore the session from storage
    if (typeof ensureSupabaseReady === 'function') {
        await ensureSupabaseReady();
    }
    // Give the auth session a moment to restore from localStorage
    await new Promise(r => setTimeout(r, 1500));
    console.log('🔗 Auth ready - starting sync...');
    await syncOfflineChanges();
    // Also sync inventory if inventory-sync module is loaded
    if (typeof syncInventoryChanges !== 'undefined') {
        await syncInventoryChanges();
    }
});

/** Handle going offline */
window.addEventListener('offline', () => {
    console.log('📵 Device went offline');
    if (typeof window.PWA !== 'undefined') {
        window.PWA.handleOffline();
    }
});

// ============================================
// MAIN SYNC FUNCTION
// ============================================

/** Sync all pending offline changes to Supabase */
async function syncOfflineChanges() {
    // Prevent concurrent syncs
    if (SyncState.isSyncing) {
        console.warn('⚠️ Sync already in progress');
        return;
    }

    if (!navigator.onLine) {
        console.warn('⚠️ Still offline, cannot sync');
        return;
    }

    SyncState.isSyncing = true;
    console.log('🔄 Starting offline sync...');

    try {
        // Get pending items first
        const pendingItems = await getPendingSyncItems();

        if (pendingItems.length === 0) {
            console.log('✅ No pending items to sync');
            SyncState.isSyncing = false;
            return;
        }

        // Only show sync UI if there are actually items to sync
        console.log(`📋 Syncing ${pendingItems.length} items...`);
        showSyncUI('syncing');

        // Process each pending item
        for (const item of pendingItems) {
            await syncItem(item);
        }

        // Update last sync time
        SyncState.lastSyncTime = new Date();
        await saveMetadata('last_sync_time', SyncState.lastSyncTime.toISOString());

        // Show results
        const syncMessage = `✅ Sync Complete: ${SyncState.successCount} synced, ${SyncState.errorCount} errors`;
        console.log(syncMessage);
        showToast(syncMessage, 'success');
        showSyncUI('done');

        // Reset counters
        SyncState.successCount = 0;
        SyncState.errorCount = 0;

    } catch (error) {
        console.error('❌ Error during sync:', error);
        showToast('Sync failed - will retry when online', 'error');
        showSyncUI('error');
    } finally {
        SyncState.isSyncing = false;
    }
}

// ============================================
// SYNC INDIVIDUAL ITEMS
// ============================================

/** Sync a single pending item to Supabase */
async function syncItem(queueItem) {
    const { id, type, action, resource_id, data, retries } = queueItem;

    // Max 3 retries
    if (retries >= 3) {
        console.error(`❌ Max retries reached for queue item ${id}`);
        await updateSyncQueueStatus(id, 'error', null, 'Max retries exceeded');
        SyncState.errorCount++;
        return;
    }

    try {
        // Mark as syncing
        await updateSyncQueueStatus(id, 'syncing');

        console.log(`🔄 Syncing ${type} ${action}...`);

        // Route to appropriate sync handler
        let result;
        switch (type) {
            case 'invoice':
                result = await syncInvoice(resource_id, data, action);
                break;
            case 'customer':
                result = await syncCustomer(resource_id, data, action);
                break;
            case 'inventory':
                result = await syncInventory(resource_id, data, action);
                break;
            default:
                throw new Error(`Unknown sync type: ${type}`);
        }

        // Mark as synced
        await updateSyncQueueStatus(id, 'synced', result.id);
        await updateInvoiceSyncStatus(resource_id, 'synced', result.id);

        console.log(`✅ Synced ${type} ${resource_id}`);
        SyncState.successCount++;

    } catch (error) {
        console.error(`❌ Error syncing item ${id}:`, error.message);

        // Increment retries
        const newRetries = (queueItem.retries || 0) + 1;

        // Calculate backoff delay (exponential increase: 5s, 15s, 30s)
        const backoffDelay = Math.min(5000 * Math.pow(1.5, newRetries), 30000);

        // Update with retry info
        await updateSyncQueueStatus(id, 'pending', null, error.message);

        // Log retry attempt
        console.log(`⏳ Retry ${newRetries}/3 in ${Math.round(backoffDelay / 1000)}s...`);

        // Update item with retry count
        if (db) {
            const transaction = db.transaction([STORES.SYNC_QUEUE], 'readwrite');
            const store = transaction.objectStore(STORES.SYNC_QUEUE);
            const item = await new Promise((resolve, reject) => {
                const request = store.get(id);
                request.onsuccess = () => resolve(request.result);
                request.onerror = () => reject(request.error);
            });

            if (item) {
                item.retries = newRetries;
                await new Promise((resolve, reject) => {
                    const request = store.put(item);
                    request.onsuccess = () => resolve();
                    request.onerror = () => reject(request.error);
                });
            }
        }

        SyncState.errorCount++;
        SyncState.failedItems.push({ id, error: error.message, retryAt: Date.now() + backoffDelay });
    }
}

// ============================================
// SYNC HANDLERS BY TYPE
// ============================================

/** Sync invoice to Supabase */
async function syncInvoice(localInvoiceId, invoiceData, action) {
    // Ensure Supabase is initialized before proceeding
    if (typeof ensureSupabaseReady === 'function') {
        await ensureSupabaseReady();
    }
    if (!window.supabaseClient) {
        throw new Error('Supabase not initialized');
    }

    const user = await getCurrentUser();
    if (!user) {
        throw new Error('User not authenticated');
    }

    // Prepare invoice for upload — only include real Supabase column names.
    // invoiceData comes from collectFormData() which has camelCase aliases that
    // don't exist as DB columns (e.g. `address`, `mobile`, `gstNumber`).
    // Mirror the exact mapping used in supabaseAddInvoice().
    let paymentStatus = 'paid';
    let amountPaid = invoiceData.totalAmount ?? invoiceData.grandTotal ?? 0;
    let amountDue = 0;
    if (invoiceData.paymentType === 'credit') {
        if (invoiceData.amountPaid && invoiceData.amountPaid > 0) {
            amountPaid = invoiceData.amountPaid;
            amountDue = (invoiceData.totalAmount ?? invoiceData.grandTotal ?? 0) - amountPaid;
            paymentStatus = amountDue > 0 ? 'partial' : 'paid';
        } else {
            amountPaid = 0;
            amountDue = invoiceData.totalAmount ?? invoiceData.grandTotal ?? 0;
            paymentStatus = 'unpaid';
        }
    }

    const invoiceToUpload = {
        user_id:          user.id,
        shop_id:          invoiceData.shop_id          || null,
        invoice_number:   invoiceData.invoiceNumber    || invoiceData.invoiceNo,
        date:             invoiceData.date,
        customer_id:      invoiceData.customerId       || null,
        customer_name:    invoiceData.customerName,
        customer_mobile:  invoiceData.mobile           || invoiceData.customerMobile || null,
        customer_gst:     invoiceData.gstNumber        || invoiceData.customerGST   || null,
        customer_address: invoiceData.address          || invoiceData.customerAddress || null,
        items:            invoiceData.items            || [],
        subtotal:         invoiceData.subtotal         ?? 0,
        gst_amount:       invoiceData.gstAmount        ?? 0,
        gst_rate:         invoiceData.gstRate          ?? 0,
        total_amount:     invoiceData.totalAmount      ?? invoiceData.grandTotal ?? 0,
        total_units:      invoiceData.totalUnits       ?? 0,
        payment_type:     invoiceData.paymentType      || 'cash',
        payment_status:   paymentStatus,
        amount_paid:      amountPaid,
        amount_due:       amountDue,
        tax_mode:         invoiceData.taxMode          || 'with-tax',
        discount_amount:  invoiceData.discountAmount   ?? 0,
    };

    try {
        // Check if it was already synced (has server_id)
        if (invoiceData.server_id) {
            // UPDATE existing invoice
            const { data, error } = await window.supabaseClient
                .from('invoices')
                .update(invoiceToUpload)
                .eq('id', invoiceData.server_id)
                .select();

            if (error) throw error;
            return data[0];

        } else {
            // CREATE new invoice
            const { data, error } = await window.supabaseClient
                .from('invoices')
                .insert([invoiceToUpload])
                .select();

            if (error) throw error;

            // items are stored as a JSON column on invoices — no separate insert needed
            // Update customer balance if credit
            if (invoiceToUpload.customer_id && amountDue > 0 && typeof supabaseUpdateCustomerBalance === 'function') {
                supabaseUpdateCustomerBalance(invoiceToUpload.customer_id).catch(() => {});
            }

            return data[0];
        }

    } catch (error) {
        console.error('Error syncing invoice:', error);
        throw new Error(`Failed to sync invoice: ${error.message}`);
    }
}

/** Sync customer to Supabase */
async function syncCustomer(localCustomerId, customerData, action) {
    const user = await getCurrentUser();
    if (!user) {
        throw new Error('User not authenticated');
    }

    const customerToUpload = {
        ...customerData,
        user_id: user.id
    };

    try {
        if (customerData.server_id) {
            // UPDATE
            const { data, error } = await window.supabaseClient
                .from('customers')
                .update(customerToUpload)
                .eq('id', customerData.server_id)
                .select();

            if (error) throw error;
            return data[0];

        } else {
            // INSERT
            const { data, error } = await window.supabaseClient
                .from('customers')
                .insert([customerToUpload])
                .select();

            if (error) throw error;
            return data[0];
        }

    } catch (error) {
        throw new Error(`Failed to sync customer: ${error.message}`);
    }
}

/** Sync inventory to Supabase */
async function syncInventory(localItemId, itemData, action) {
    const user = await getCurrentUser();
    if (!user) {
        throw new Error('User not authenticated');
    }

    const itemToUpload = {
        ...itemData,
        user_id: user.id
    };

    try {
        if (itemData.server_id) {
            // UPDATE
            const { data, error } = await window.supabaseClient
                .from('inventory')
                .update(itemToUpload)
                .eq('id', itemData.server_id)
                .select();

            if (error) throw error;
            return data[0];

        } else {
            // INSERT
            const { data, error } = await window.supabaseClient
                .from('inventory')
                .insert([itemToUpload])
                .select();

            if (error) throw error;
            return data[0];
        }

    } catch (error) {
        throw new Error(`Failed to sync inventory: ${error.message}`);
    }
}

// ============================================
// UI HELPERS
// ============================================

/** Show sync progress UI */
function showSyncUI(status) {
    let syncIndicator = document.getElementById('syncIndicator');

    if (!syncIndicator) {
        // Create sync indicator if it doesn't exist
        syncIndicator = document.createElement('div');
        syncIndicator.id = 'syncIndicator';
        syncIndicator.className = 'sync-indicator';
        document.body.appendChild(syncIndicator);
    }

    switch (status) {
        case 'syncing':
            syncIndicator.textContent = '🔄 Syncing...';
            syncIndicator.className = 'sync-indicator syncing';
            break;
        case 'done':
            syncIndicator.textContent = '✅ Synced';
            syncIndicator.className = 'sync-indicator done';
            // Hide after 3 seconds
            setTimeout(() => {
                syncIndicator.classList.remove('show');
            }, 3000);
            break;
        case 'error':
            syncIndicator.textContent = '❌ Sync Error';
            syncIndicator.className = 'sync-indicator error';
            break;
    }

    syncIndicator.classList.add('show');
}

// ============================================
// HELPER FUNCTIONS
// ============================================

/** Get current authenticated user */
async function getCurrentUser() {
    try {
        // Use supabase.js helper if available (handles caching + lock-stolen retry)
        if (typeof supabaseGetCurrentUser === 'function') {
            return await supabaseGetCurrentUser();
        }
        // Fallback: ensure client is ready then call getUser directly
        if (typeof ensureSupabaseReady === 'function') {
            await ensureSupabaseReady();
        }
        if (!window.supabaseClient) return null;
        const { data } = await window.supabaseClient.auth.getUser();
        return data?.user || null;
    } catch (error) {
        console.error('Error getting user:', error);
        return null;
    }
}

/** Get last sync time from metadata */
async function getLastSyncTime() {
    const timestamp = await getMetadata('last_sync_time');
    if (timestamp) {
        return new Date(timestamp);
    }
    return null;
}

/** Get sync status summary */
function getSyncStatus() {
    return {
        isSyncing: SyncState.isSyncing,
        lastSyncTime: SyncState.lastSyncTime,
        failedCount: SyncState.failedItems.length,
        successCount: SyncState.successCount,
        errorCount: SyncState.errorCount
    };
}

/** Retry failed sync item */
async function retryFailedSync(queueItemId) {
    console.log(`🔄 Retrying sync for queue item ${queueItemId}...`);
    await syncOfflineChanges();
}

/** Manual trigger for sync */
async function manualSync() {
    if (!navigator.onLine) {
        showToast('⚠️ Still offline - cannot sync now', 'warning');
        return;
    }

    showToast('🔄 Starting manual sync...', 'info');
    await syncOfflineChanges();
}

// ============================================
// EXPORT FOR MODULE LOADING
// ============================================

// Reset sync state on page load to handle page refreshes during sync
function initOfflineSync() {
    // Reset sync state in case page was refreshed during sync
    SyncState.isSyncing = false;
    
    // Hide sync indicator if it's showing
    const syncIndicator = document.getElementById('syncIndicator');
    if (syncIndicator) {
        syncIndicator.classList.remove('show');
    }
    
    console.log('✅ Offline Sync initialized');
}

// Initialize when DOM is ready
if (document.readyState === 'loading') {
    document.addEventListener('DOMContentLoaded', initOfflineSync);
} else {
    initOfflineSync();
}

console.log('✅ Offline Sync module loaded');
