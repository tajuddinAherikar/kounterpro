/**
 * KounterPro Inventory Sync Handler
 * Manages offline inventory deductions and syncing back to server
 * 
 * Features:
 * - Pre-download inventory for offline use
 * - Deduct stock locally during offline invoice creation
 * - Sync inventory changes back to Supabase
 * - Show stock status indicators
 */

// ============================================
// INVENTORY DOWNLOAD (When Online)
// ============================================

/** Download inventory items for offline use */
async function downloadInventoryForOffline() {
    console.log('📥 Downloading inventory for offline use...');

    if (!navigator.onLine) {
        console.warn('⚠️ Cannot download - currently offline');
        return false;
    }

    try {
        // Get current user
        const user = await getCurrentUser();
        if (!user) {
            console.warn('⚠️ User not authenticated');
            return false;
        }

        // Fetch inventory from Supabase
        if (!window.supabaseClient) {
            throw new Error('Supabase not initialized');
        }

        const { data, error } = await window.supabaseClient
            .from('inventory')
            .select('*')
            .eq('user_id', user.id);

        if (error) throw error;

        if (data && data.length > 0) {
            // Save to IndexedDB
            const savedCount = await saveInventoryItems(data);
            
            // Update metadata
            await saveMetadata('last_inventory_download', new Date().toISOString());
            await saveMetadata('total_inventory_items', data.length);

            console.log(`✅ Downloaded and cached ${savedCount} inventory items`);
            showToast(`✅ Cached ${savedCount} products for offline use`, 'success');
            return true;
        } else {
            console.log('ℹ️ No inventory items to download');
            return true;
        }

    } catch (error) {
        console.error('❌ Error downloading inventory:', error);
        showToast('⚠️ Could not cache inventory - will work with available data', 'warning');
        return false;
    }
}

// ============================================
// INVENTORY DURING OFFLINE INVOICE CREATION
// ============================================

/** Check stock availability (offline) */
async function checkStockAvailability(invoiceItems) {
    console.log('🔍 Checking stock availability...');

    const stockCheck = [];

    for (const item of invoiceItems) {
        try {
            const inventoryItem = await getInventoryItem(item.inventory_id);

            if (!inventoryItem) {
                console.warn(`⚠️ Inventory item ${item.inventory_id} not found`);
                stockCheck.push({
                    item_id: item.inventory_id,
                    requested: item.qty,
                    available: 0,
                    status: 'not_found'
                });
                continue;
            }

            const available = inventoryItem.local_quantity || inventoryItem.quantity;
            const hasStock = available >= item.qty;

            stockCheck.push({
                item_id: item.inventory_id,
                name: inventoryItem.name,
                requested: item.qty,
                available: available,
                status: hasStock ? 'available' : 'insufficient'
            });

            console.log(`${hasStock ? '✅' : '❌'} ${inventoryItem.name}: Need ${item.qty}, Have ${available}`);

        } catch (error) {
            console.error(`Error checking stock for item ${item.inventory_id}:`, error);
            stockCheck.push({
                item_id: item.inventory_id,
                requested: item.qty,
                available: 0,
                status: 'error'
            });
        }
    }

    return stockCheck;
}

/** Get inventory item with stock level indicator */
async function getInventoryWithStatus(itemId) {
    const item = await getInventoryItem(itemId);

    if (!item) return null;

    const available = item.local_quantity || item.quantity;
    const threshold = item.low_stock_threshold || 10;

    let status = 'available';
    if (available <= 0) {
        status = 'out_of_stock';
    } else if (available < threshold) {
        status = 'low_stock';
    }

    return {
        ...item,
        available_quantity: available,
        stock_status: status
    };
}

// ============================================
// SYNC INVENTORY CHANGES
// ============================================

/** Sync inventory changes to Supabase */
async function syncInventoryChanges() {
    console.log('🔄 Starting inventory sync...');

    if (!navigator.onLine) {
        console.warn('⚠️ Still offline, cannot sync inventory');
        return false;
    }

    try {
        // Get current user
        const user = await getCurrentUser();
        if (!user) {
            throw new Error('User not authenticated');
        }

        // Get pending inventory updates
        const pendingItems = await getPendingInventoryUpdates();

        if (pendingItems.length === 0) {
            console.log('✅ No inventory changes to sync');
            return true;
        }

        console.log(`📦 Syncing ${pendingItems.length} inventory items...`);

        let successCount = 0;
        let errorCount = 0;

        for (const item of pendingItems) {
            try {
                // Calculate change
                const quantityChange = item.server_quantity - item.local_quantity;

                if (quantityChange === 0) {
                    // No actual change
                    await updateInventorySyncStatus(item.id, 'synced');
                    successCount++;
                    continue;
                }

                // Update quantity in Supabase
                const { data, error } = await window.supabaseClient
                    .from('inventory')
                    .update({
                        quantity: item.local_quantity,
                        updated_at: new Date().toISOString()
                    })
                    .eq('id', item.id)
                    .eq('user_id', user.id)
                    .select();

                if (error) throw error;

                // Update local sync status
                await updateInventorySyncStatus(item.id, 'synced');

                // Update server_quantity to prevent re-syncing
                const transaction = db.transaction([STORES.INVENTORY], 'readwrite');
                const store = transaction.objectStore(STORES.INVENTORY);
                const localItem = await new Promise((resolve, reject) => {
                    const request = store.get(item.id);
                    request.onsuccess = () => resolve(request.result);
                    request.onerror = () => reject(request.error);
                });

                if (localItem) {
                    localItem.server_quantity = item.local_quantity;
                    localItem.local_modified = false;
                    await new Promise((resolve, reject) => {
                        const request = store.put(localItem);
                        request.onsuccess = () => resolve();
                        request.onerror = () => reject(request.error);
                    });
                }

                console.log(`✅ Synced inventory item ${item.id} (Change: ${quantityChange})`);
                successCount++;

            } catch (error) {
                console.error(`❌ Error syncing inventory item ${item.id}:`, error);
                errorCount++;
            }
        }

        const message = `✅ Inventory Sync: ${successCount} synced, ${errorCount} errors`;
        console.log(message);
        showToast(message, errorCount === 0 ? 'success' : 'warning');

        return errorCount === 0;

    } catch (error) {
        console.error('❌ Error during inventory sync:', error);
        showToast('❌ Inventory sync failed', 'error');
        return false;
    }
}

// ============================================
// INVENTORY INTEGRATION WITH INVOICE CREATION
// ============================================

/** Integrate with offline invoice creation - handles stock deduction */
async function handleInventoryDeductionOffline(invoiceItems) {
    console.log('📦 Handling inventory deduction for offline invoice...');

    // Check if offline
    if (navigator.onLine) {
        console.log('ℹ️ Online - server will handle inventory deduction');
        return { success: true, deducted: false };
    }

    try {
        // Check stock first
        const stockCheck = await checkStockAvailability(invoiceItems);

        // Check for any insufficient stock
        const hasIssues = stockCheck.some(check => check.status === 'insufficient' || check.status === 'error');

        if (hasIssues) {
            const insufficientItems = stockCheck.filter(c => c.status === 'insufficient');
            if (insufficientItems.length > 0) {
                const itemsList = insufficientItems
                    .map(i => `${i.name} (Need: ${i.requested}, Have: ${i.available})`)
                    .join(', ');
                showToast(`⚠️ Insufficient stock: ${itemsList}`, 'warning');
                return { success: false, reason: 'insufficient_stock', details: stockCheck };
            }
        }

        // Deduct inventory
        const deducted = await deductInventory(invoiceItems);

        if (deducted) {
            console.log('✅ Inventory deducted locally');
            showToast('📉 Local inventory updated', 'info');
            return { success: true, deducted: true };
        } else {
            console.warn('⚠️ Could not deduct inventory');
            return { success: false, reason: 'deduction_failed' };
        }

    } catch (error) {
        console.error('❌ Error handling inventory deduction:', error);
        showToast('⚠️ Could not update inventory - will be handled on sync', 'warning');
        return { success: false, reason: 'error', error: error.message };
    }
}

// ============================================
// AUTO-TRIGGER INVENTORY DOWNLOAD
// ============================================

/** Trigger inventory download when coming online */
window.addEventListener('online', async () => {
    console.log('🔗 Device online - checking for inventory sync...');

    // Auto-download inventory if not recently downloaded
    const lastDownload = await getMetadata('last_inventory_download');
    const now = new Date();
    const oneHourAgo = new Date(now - 3600000);

    if (!lastDownload || new Date(lastDownload) < oneHourAgo) {
        console.log('📥 Inventory cache expired, downloading fresh inventory...');
        await downloadInventoryForOffline();
    }

    // Sync any inventory changes
    await syncInventoryChanges();
});

// ============================================
// EXPORT FOR MODULE LOADING
// ============================================

console.log('✅ Inventory Sync module loaded');
