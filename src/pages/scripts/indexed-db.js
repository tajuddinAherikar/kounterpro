/**
 * KounterPro IndexedDB Handler
 * Manages offline storage of invoices, customers, and inventory
 * 
 * Database: KounterProDB
 * Version: 1
 * 
 * Stores:
 * - invoices (offline created/edited)
 * - invoice_items (line items for invoices)
 * - customers (if created offline)
 * - sync_queue (items pending sync)
 */

const DB_NAME = 'KounterProDB';
const DB_VERSION = 1;

// Store names
const STORES = {
    INVOICES: 'invoices',
    INVOICE_ITEMS: 'invoice_items',
    CUSTOMERS: 'customers',
    INVENTORY: 'inventory',
    SYNC_QUEUE: 'sync_queue',
    METADATA: 'metadata'
};

let db = null;

// ============================================
// DATABASE INITIALIZATION
// ============================================
async function initializeIndexedDB() {
    return new Promise((resolve, reject) => {
        if (!('indexedDB' in window)) {
            console.warn('⚠️ IndexedDB not supported');
            resolve(null);
            return;
        }

        const request = indexedDB.open(DB_NAME, DB_VERSION);

        // Create/upgrade database schema
        request.onupgradeneeded = (event) => {
            const database = event.target.result;
            console.log('🔧 Upgrading IndexedDB schema...');

            // Create Invoices store
            if (!database.objectStoreNames.contains(STORES.INVOICES)) {
                const invoiceStore = database.createObjectStore(STORES.INVOICES, {
                    keyPath: 'id',
                    autoIncrement: true
                });
                invoiceStore.createIndex('invoice_number', 'invoice_number', { unique: false });
                invoiceStore.createIndex('user_id', 'user_id', { unique: false });
                invoiceStore.createIndex('created_at', 'created_at', { unique: false });
                invoiceStore.createIndex('sync_status', 'sync_status', { unique: false });
                console.log('✅ Invoices store created');
            }

            // Create Invoice Items store
            if (!database.objectStoreNames.contains(STORES.INVOICE_ITEMS)) {
                const itemsStore = database.createObjectStore(STORES.INVOICE_ITEMS, {
                    keyPath: 'id',
                    autoIncrement: true
                });
                itemsStore.createIndex('invoice_id', 'invoice_id', { unique: false });
                console.log('✅ Invoice Items store created');
            }

            // Create Customers store
            if (!database.objectStoreNames.contains(STORES.CUSTOMERS)) {
                const customerStore = database.createObjectStore(STORES.CUSTOMERS, {
                    keyPath: 'id',
                    autoIncrement: true
                });
                customerStore.createIndex('user_id', 'user_id', { unique: false });
                customerStore.createIndex('mobile', 'mobile', { unique: false });
                console.log('✅ Customers store created');
            }

            // Create Inventory store
            if (!database.objectStoreNames.contains(STORES.INVENTORY)) {
                const inventoryStore = database.createObjectStore(STORES.INVENTORY, {
                    keyPath: 'id',
                    autoIncrement: true
                });
                inventoryStore.createIndex('user_id', 'user_id', { unique: false });
                inventoryStore.createIndex('sku', 'sku', { unique: false });
                inventoryStore.createIndex('sync_status', 'sync_status', { unique: false });
                console.log('✅ Inventory store created');
            }

            // Create Sync Queue store
            if (!database.objectStoreNames.contains(STORES.SYNC_QUEUE)) {
                const syncStore = database.createObjectStore(STORES.SYNC_QUEUE, {
                    keyPath: 'id',
                    autoIncrement: true
                });
                syncStore.createIndex('type', 'type', { unique: false });
                syncStore.createIndex('status', 'status', { unique: false });
                syncStore.createIndex('created_at', 'created_at', { unique: false });
                console.log('✅ Sync Queue store created');
            }

            // Create Metadata store
            if (!database.objectStoreNames.contains(STORES.METADATA)) {
                database.createObjectStore(STORES.METADATA, { keyPath: 'key' });
                console.log('✅ Metadata store created');
            }
        };

        request.onsuccess = (event) => {
            db = event.target.result;
            console.log('✅ IndexedDB initialized');
            resolve(db);
        };

        request.onerror = (event) => {
            console.error('❌ IndexedDB initialization failed:', event.target.error);
            reject(event.target.error);
        };
    });
}

// ============================================
// INVOICE OPERATIONS
// ============================================

/** Save invoice to IndexedDB (for offline use) */
async function saveInvoiceToIndexedDB(invoice, items = []) {
    if (!db) {
        console.warn('⚠️ IndexedDB not initialized');
        return null;
    }

    try {
        const transaction = db.transaction(
            [STORES.INVOICES, STORES.INVOICE_ITEMS],
            'readwrite'
        );

        // Add sync metadata
        const invoiceToSave = {
            ...invoice,
            sync_status: 'pending', // 'pending', 'synced', 'error'
            synced_at: null,
            local_modified_at: new Date().toISOString(),
            offline_created: !invoice.id || invoice.id.startsWith('DRAFT'),
            synced_to_server: false
        };

        // Save invoice
        const invoiceStore = transaction.objectStore(STORES.INVOICES);
        const invoiceResult = await new Promise((resolve, reject) => {
            const request = invoiceStore.put(invoiceToSave);
            request.onsuccess = () => resolve(request.result);
            request.onerror = () => reject(request.error);
        });

        console.log('💾 Invoice saved to IndexedDB:', invoiceResult);

        // Save items
        if (items.length > 0) {
            const itemsStore = transaction.objectStore(STORES.INVOICE_ITEMS);
            for (const item of items) {
                const itemToSave = {
                    ...item,
                    invoice_id: invoiceResult,
                    offline_created: true
                };
                await new Promise((resolve, reject) => {
                    const request = itemsStore.put(itemToSave);
                    request.onsuccess = () => resolve(request.result);
                    request.onerror = () => reject(request.error);
                });
            }
            console.log(`💾 ${items.length} items saved to IndexedDB`);
        }

        // Add to sync queue
        await addToSyncQueue('invoice', 'save', invoiceResult, invoiceToSave);

        return invoiceResult;
    } catch (error) {
        console.error('❌ Error saving invoice to IndexedDB:', error);
        throw error;
    }
}

/** Load invoice from IndexedDB */
async function loadInvoiceFromIndexedDB(invoiceId) {
    if (!db) return null;

    try {
        const transaction = db.transaction([STORES.INVOICES, STORES.INVOICE_ITEMS], 'readonly');
        const invoiceStore = transaction.objectStore(STORES.INVOICES);

        const invoice = await new Promise((resolve, reject) => {
            const request = invoiceStore.get(invoiceId);
            request.onsuccess = () => resolve(request.result);
            request.onerror = () => reject(request.error);
        });

        if (!invoice) return null;

        // Load items
        const itemsStore = transaction.objectStore(STORES.INVOICE_ITEMS);
        const itemsIndex = itemsStore.index('invoice_id');

        const items = await new Promise((resolve, reject) => {
            const request = itemsIndex.getAll(invoiceId);
            request.onsuccess = () => resolve(request.result);
            request.onerror = () => reject(request.error);
        });

        return { ...invoice, items };
    } catch (error) {
        console.error('❌ Error loading invoice from IndexedDB:', error);
        return null;
    }
}

/** Get all offline invoices */
async function getAllOfflineInvoices(userId) {
    if (!db) return [];

    try {
        const transaction = db.transaction([STORES.INVOICES], 'readonly');
        const store = transaction.objectStore(STORES.INVOICES);
        const index = store.index('user_id');

        const invoices = await new Promise((resolve, reject) => {
            const request = index.getAll(userId);
            request.onsuccess = () => resolve(request.result);
            request.onerror = () => reject(request.error);
        });

        console.log(`📂 Loaded ${invoices.length} offline invoices for user ${userId}`);
        return invoices;
    } catch (error) {
        console.error('❌ Error getting offline invoices:', error);
        return [];
    }
}

/** Update invoice sync status */
async function updateInvoiceSyncStatus(invoiceId, syncStatus, serverInvoiceId = null) {
    if (!db) return;

    try {
        const transaction = db.transaction([STORES.INVOICES], 'readwrite');
        const store = transaction.objectStore(STORES.INVOICES);

        const invoice = await new Promise((resolve, reject) => {
            const request = store.get(invoiceId);
            request.onsuccess = () => resolve(request.result);
            request.onerror = () => reject(request.error);
        });

        if (invoice) {
            invoice.sync_status = syncStatus; // 'pending', 'synced', 'error'
            invoice.synced_at = new Date().toISOString();
            if (serverInvoiceId) {
                invoice.server_id = serverInvoiceId;
            }

            await new Promise((resolve, reject) => {
                const request = store.put(invoice);
                request.onsuccess = () => resolve(request.result);
                request.onerror = () => reject(request.error);
            });

            console.log(`✅ Invoice ${invoiceId} sync status: ${syncStatus}`);
        }
    } catch (error) {
        console.error('❌ Error updating invoice sync status:', error);
    }
}

/** Delete invoice from IndexedDB */
async function deleteInvoiceFromIndexedDB(invoiceId) {
    if (!db) return;

    try {
        const transaction = db.transaction(
            [STORES.INVOICES, STORES.INVOICE_ITEMS],
            'readwrite'
        );

        // Delete invoice
        const invoiceStore = transaction.objectStore(STORES.INVOICES);
        await new Promise((resolve, reject) => {
            const request = invoiceStore.delete(invoiceId);
            request.onsuccess = () => resolve();
            request.onerror = () => reject(request.error);
        });

        // Delete items
        const itemsStore = transaction.objectStore(STORES.INVOICE_ITEMS);
        const itemsIndex = itemsStore.index('invoice_id');
        const items = await new Promise((resolve, reject) => {
            const request = itemsIndex.getAll(invoiceId);
            request.onsuccess = () => resolve(request.result);
            request.onerror = () => reject(request.error);
        });

        for (const item of items) {
            await new Promise((resolve, reject) => {
                const request = itemsStore.delete(item.id);
                request.onsuccess = () => resolve();
                request.onerror = () => reject(request.error);
            });
        }

        console.log(`🗑️ Invoice ${invoiceId} deleted from IndexedDB`);
    } catch (error) {
        console.error('❌ Error deleting invoice from IndexedDB:', error);
    }
}

// ============================================
// SYNC QUEUE OPERATIONS
// ============================================

/** Add item to sync queue */
async function addToSyncQueue(type, action, resourceId, data) {
    if (!db) return;

    try {
        const transaction = db.transaction([STORES.SYNC_QUEUE], 'readwrite');
        const store = transaction.objectStore(STORES.SYNC_QUEUE);

        const queueItem = {
            type, // 'invoice', 'customer', 'inventory'
            action, // 'save', 'update', 'delete'
            resource_id: resourceId,
            data,
            status: 'pending', // 'pending', 'syncing', 'synced', 'error'
            created_at: new Date().toISOString(),
            synced_at: null,
            retries: 0,
            error_message: null
        };

        await new Promise((resolve, reject) => {
            const request = store.add(queueItem);
            request.onsuccess = () => resolve(request.result);
            request.onerror = () => reject(request.error);
        });

        console.log(`📝 Added to sync queue: ${type} ${action}`);
    } catch (error) {
        console.error('❌ Error adding to sync queue:', error);
    }
}

/** Get pending sync items */
async function getPendingSyncItems() {
    if (!db) return [];

    try {
        const transaction = db.transaction([STORES.SYNC_QUEUE], 'readonly');
        const store = transaction.objectStore(STORES.SYNC_QUEUE);
        const index = store.index('status');

        const items = await new Promise((resolve, reject) => {
            const request = index.getAll('pending');
            request.onsuccess = () => resolve(request.result);
            request.onerror = () => reject(request.error);
        });

        console.log(`📋 Found ${items.length} pending sync items`);
        return items;
    } catch (error) {
        console.error('❌ Error getting pending sync items:', error);
        return [];
    }
}

/** Update sync queue item status */
async function updateSyncQueueStatus(queueId, status, serverResourceId = null, errorMsg = null) {
    if (!db) return;

    try {
        const transaction = db.transaction([STORES.SYNC_QUEUE], 'readwrite');
        const store = transaction.objectStore(STORES.SYNC_QUEUE);

        const item = await new Promise((resolve, reject) => {
            const request = store.get(queueId);
            request.onsuccess = () => resolve(request.result);
            request.onerror = () => reject(request.error);
        });

        if (item) {
            item.status = status;
            item.synced_at = status === 'synced' ? new Date().toISOString() : null;
            if (serverResourceId) item.server_resource_id = serverResourceId;
            if (errorMsg) item.error_message = errorMsg;

            await new Promise((resolve, reject) => {
                const request = store.put(item);
                request.onsuccess = () => resolve();
                request.onerror = () => reject(request.error);
            });

            console.log(`✅ Sync queue item ${queueId} status: ${status}`);
        }
    } catch (error) {
        console.error('❌ Error updating sync queue status:', error);
    }
}

// ============================================
// INVENTORY OPERATIONS
// ============================================

/** Save inventory items locally (for offline use) */
async function saveInventoryItems(items) {
    if (!db) return 0;

    try {
        const transaction = db.transaction([STORES.INVENTORY], 'readwrite');
        const store = transaction.objectStore(STORES.INVENTORY);

        let savedCount = 0;
        for (const item of items) {
            const inventoryItem = {
                ...item,
                sync_status: 'synced',  // Downloaded from server
                local_modified: false,
                local_quantity: item.quantity,  // Track local changes
                server_quantity: item.quantity
            };

            await new Promise((resolve, reject) => {
                const request = store.put(inventoryItem);
                request.onsuccess = () => {
                    savedCount++;
                    resolve(request.result);
                };
                request.onerror = () => reject(request.error);
            });
        }

        console.log(`💾 Saved ${savedCount} inventory items to IndexedDB`);
        return savedCount;
    } catch (error) {
        console.error('❌ Error saving inventory items:', error);
        return 0;
    }
}

/** Get inventory item by ID */
async function getInventoryItem(itemId) {
    if (!db) return null;

    try {
        const transaction = db.transaction([STORES.INVENTORY], 'readonly');
        const store = transaction.objectStore(STORES.INVENTORY);

        const item = await new Promise((resolve, reject) => {
            const request = store.get(itemId);
            request.onsuccess = () => resolve(request.result);
            request.onerror = () => reject(request.error);
        });

        return item;
    } catch (error) {
        console.error('❌ Error getting inventory item:', error);
        return null;
    }
}

/** Get all inventory items for user */
async function getAllInventoryItems(userId) {
    if (!db) return [];

    try {
        const transaction = db.transaction([STORES.INVENTORY], 'readonly');
        const store = transaction.objectStore(STORES.INVENTORY);
        const index = store.index('user_id');

        const items = await new Promise((resolve, reject) => {
            const request = index.getAll(userId);
            request.onsuccess = () => resolve(request.result);
            request.onerror = () => reject(request.error);
        });

        console.log(`📦 Loaded ${items.length} inventory items for user ${userId}`);
        return items;
    } catch (error) {
        console.error('❌ Error getting inventory items:', error);
        return [];
    }
}

/** Deduct inventory when creating invoice offline */
async function deductInventory(invoiceItems) {
    if (!db) return false;

    try {
        const transaction = db.transaction([STORES.INVENTORY], 'readwrite');
        const store = transaction.objectStore(STORES.INVENTORY);

        for (const item of invoiceItems) {
            const inventoryItem = await new Promise((resolve, reject) => {
                const request = store.get(item.inventory_id);
                request.onsuccess = () => resolve(request.result);
                request.onerror = () => reject(request.error);
            });

            if (inventoryItem) {
                // Reduce local quantity
                inventoryItem.local_quantity = (inventoryItem.local_quantity || inventoryItem.quantity) - item.qty;
                inventoryItem.local_modified = true;
                inventoryItem.sync_status = 'pending';
                inventoryItem.last_modified = new Date().toISOString();

                await new Promise((resolve, reject) => {
                    const request = store.put(inventoryItem);
                    request.onsuccess = () => resolve();
                    request.onerror = () => reject(request.error);
                });

                console.log(`📉 Deducted ${item.qty} from inventory item ${item.inventory_id}`);
            }
        }

        return true;
    } catch (error) {
        console.error('❌ Error deducting inventory:', error);
        return false;
    }
}

/** Update inventory sync status */
async function updateInventorySyncStatus(itemId, syncStatus) {
    if (!db) return;

    try {
        const transaction = db.transaction([STORES.INVENTORY], 'readwrite');
        const store = transaction.objectStore(STORES.INVENTORY);

        const item = await new Promise((resolve, reject) => {
            const request = store.get(itemId);
            request.onsuccess = () => resolve(request.result);
            request.onerror = () => reject(request.error);
        });

        if (item) {
            item.sync_status = syncStatus;
            item.synced_at = new Date().toISOString();

            await new Promise((resolve, reject) => {
                const request = store.put(item);
                request.onsuccess = () => resolve();
                request.onerror = () => reject(request.error);
            });

            console.log(`✅ Inventory item ${itemId} sync status: ${syncStatus}`);
        }
    } catch (error) {
        console.error('❌ Error updating inventory sync status:', error);
    }
}

/** Get inventory items that need syncing */
async function getPendingInventoryUpdates() {
    if (!db) return [];

    try {
        const transaction = db.transaction([STORES.INVENTORY], 'readonly');
        const store = transaction.objectStore(STORES.INVENTORY);
        const index = store.index('sync_status');

        const items = await new Promise((resolve, reject) => {
            const request = index.getAll('pending');
            request.onsuccess = () => resolve(request.result);
            request.onerror = () => reject(request.error);
        });

        console.log(`📋 Found ${items.length} inventory items pending sync`);
        return items;
    } catch (error) {
        console.error('❌ Error getting pending inventory updates:', error);
        return [];
    }
}

// ============================================
// METADATA OPERATIONS
// ============================================

/** Save metadata */
async function saveMetadata(key, value) {
    if (!db) return;

    try {
        const transaction = db.transaction([STORES.METADATA], 'readwrite');
        const store = transaction.objectStore(STORES.METADATA);

        const metadata = { key, value, updated_at: new Date().toISOString() };

        await new Promise((resolve, reject) => {
            const request = store.put(metadata);
            request.onsuccess = () => resolve();
            request.onerror = () => reject(request.error);
        });
    } catch (error) {
        console.error('❌ Error saving metadata:', error);
    }
}

/** Get metadata */
async function getMetadata(key) {
    if (!db) return null;

    try {
        const transaction = db.transaction([STORES.METADATA], 'readonly');
        const store = transaction.objectStore(STORES.METADATA);

        const metadata = await new Promise((resolve, reject) => {
            const request = store.get(key);
            request.onsuccess = () => resolve(request.result);
            request.onerror = () => reject(request.error);
        });

        return metadata ? metadata.value : null;
    } catch (error) {
        console.error('❌ Error getting metadata:', error);
        return null;
    }
}

// ============================================
// CLEAR DATABASE
// ============================================

async function clearAllData() {
    if (!db) return;

    try {
        const transaction = db.transaction(
            [STORES.INVOICES, STORES.INVOICE_ITEMS, STORES.CUSTOMERS, STORES.INVENTORY, STORES.SYNC_QUEUE, STORES.METADATA],
            'readwrite'
        );

        for (const storeName of Object.values(STORES)) {
            const store = transaction.objectStore(storeName);
            await new Promise((resolve, reject) => {
                const request = store.clear();
                request.onsuccess = () => resolve();
                request.onerror = () => reject(request.error);
            });
        }

        console.log('🗑️ All IndexedDB data cleared');
    } catch (error) {
        console.error('❌ Error clearing IndexedDB:', error);
    }
}

// ============================================
// AUTO-INITIALIZE
// ============================================

// Initialize when module loads
if (typeof window !== 'undefined') {
    initializeIndexedDB().catch(error => {
        console.error('Failed to initialize IndexedDB:', error);
    });
}

console.log('✅ IndexedDB module loaded');
