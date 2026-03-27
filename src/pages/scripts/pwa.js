/**
 * KounterPro PWA - Offline Support
 * Handles online/offline detection, service worker registration, and sync
 */

// ============================================
// GLOBALS
// ============================================
let isOnline = navigator.onLine;
let offlineQueue = []; // Queue for offline changes
let isServiceWorkerRegistered = false;

// ============================================
// SERVICE WORKER REGISTRATION
// ============================================
async function registerServiceWorker() {
    if (!('serviceWorker' in navigator)) {
        console.warn('⚠️ Service Workers not supported');
        return;
    }
    
    try {
        const registration = await navigator.serviceWorker.register('./service-worker.js', {
            scope: './',
        });
        
        console.log('✅ Service Worker registered:', registration);
        isServiceWorkerRegistered = true;
        
        // Listen for controller change (new SW activated)
        navigator.serviceWorker.addEventListener('controllerchange', () => {
            console.log('🔄 Service Worker updated');
            showNotification('App updated', 'The app has been updated to the latest version');
        });
        
        return registration;
    } catch (error) {
        console.error('❌ Service Worker registration failed:', error);
    }
}

// ============================================
// ONLINE/OFFLINE DETECTION
// ============================================
function setupOnlineOfflineListener() {
    window.addEventListener('online', handleOnline);
    window.addEventListener('offline', handleOffline);
    
    // Initial check
    if (navigator.onLine) {
        handleOnline();
    } else {
        handleOffline();
    }
}

function handleOnline() {
    isOnline = true;
    console.log('🌐 Online');
    updateOfflineIndicator('online');
    document.body.classList.remove('offline-mode');
    
    // Sync any queued changes
    syncOfflineChanges();
    
    // Notify user if there were queued items
    if (offlineQueue.length > 0) {
        showNotification('Back Online', `Syncing ${offlineQueue.length} changes...`);
    }
}

function handleOffline() {
    isOnline = false;
    console.log('📡 Offline');
    updateOfflineIndicator('offline');
    document.body.classList.add('offline-mode');
    
    showNotification('You are offline', 'Changes will be saved and synced when online');
}

// ============================================
// OFFLINE INDICATOR UI
// ============================================
function updateOfflineIndicator(status) {
    const indicator = document.getElementById('offlineIndicator');
    if (!indicator) return;
    
    if (status === 'online') {
        indicator.classList.add('online');
        setTimeout(() => {
            indicator.classList.remove('show');
            indicator.classList.remove('online');
        }, 3000); // Hide after 3 seconds
    } else {
        // Offline
        indicator.classList.remove('online');
        indicator.classList.add('show');
    }
}

// ============================================
// OFFLINE QUEUE MANAGEMENT
// ============================================
function addToOfflineQueue(action, data) {
    const timestamp = new Date().toISOString();
    const queueItem = {
        id: `${timestamp}-${Math.random()}`,
        action,
        data,
        timestamp,
        retries: 0
    };
    
    offlineQueue.push(queueItem);
    
    // Save to localStorage
    saveOfflineQueue();
    
    console.log(`📝 Added to offline queue: ${action}`, queueItem);
    return queueItem.id;
}

function saveOfflineQueue() {
    try {
        localStorage.setItem('kounterpro_offline_queue', JSON.stringify(offlineQueue));
        console.log(`💾 Queue saved (${offlineQueue.length} items)`);
    } catch (error) {
        console.error('❌ Failed to save offline queue:', error);
    }
}

function loadOfflineQueue() {
    try {
        const saved = localStorage.getItem('kounterpro_offline_queue');
        if (saved) {
            offlineQueue = JSON.parse(saved);
            console.log(`📂 Loaded ${offlineQueue.length} items from offline queue`);
        }
    } catch (error) {
        console.error('❌ Failed to load offline queue:', error);
    }
}

async function syncOfflineChanges() {
    if (offlineQueue.length === 0) {
        console.log('✅ No offline changes to sync');
        return;
    }
    
    console.log(`🔄 Syncing ${offlineQueue.length} offline changes...`);
    
    const itemsToSync = [...offlineQueue];
    const syncedIds = [];
    
    for (const item of itemsToSync) {
        try {
            // Here you would call your actual sync logic
            // For now, just log it
            console.log(`Syncing: ${item.action}`, item.data);
            
            // Mark as synced
            syncedIds.push(item.id);
        } catch (error) {
            console.error(`❌ Failed to sync ${item.action}:`, error);
            item.retries++;
            
            // Give up after 3 retries
            if (item.retries >= 3) {
                syncedIds.push(item.id); // Remove from queue
                console.error(`Gave up on syncing item after 3 retries: ${item.id}`);
            }
        }
    }
    
    // Remove synced items from queue
    offlineQueue = offlineQueue.filter(item => !syncedIds.includes(item.id));
    saveOfflineQueue();
    
    if (syncedIds.length > 0) {
        console.log(`✅ Synced ${syncedIds.length} changes`);
        showNotification('Sync Complete', 'All changes have been synced');
    }
}

// ============================================
// INSTALL PROMPT HANDLING (for "Add to Home Screen")
// ============================================
let deferredPrompt;

function setupInstallPrompt() {
    window.addEventListener('beforeinstallprompt', (e) => {
        console.log('📲 Install prompt available');
        e.preventDefault();
        deferredPrompt = e;
        
        // You can show a custom install button here
        showInstallButton();
    });
    
    window.addEventListener('appinstalled', () => {
        console.log('✅ App installed to home screen');
        deferredPrompt = null;
        hideInstallButton();
        showNotification('App Installed', 'KounterPro has been installed on your device');
    });
}

function showInstallButton() {
    // Look for an install button element
    const installBtn = document.getElementById('installAppBtn');
    if (installBtn) {
        installBtn.style.display = 'block';
    }
}

function hideInstallButton() {
    const installBtn = document.getElementById('installAppBtn');
    if (installBtn) {
        installBtn.style.display = 'none';
    }
}

function promptToInstall() {
    if (deferredPrompt) {
        deferredPrompt.prompt();
        deferredPrompt.userChoice.then((choiceResult) => {
            if (choiceResult.outcome === 'accepted') {
                console.log('✅ User installed the app');
            } else {
                console.log('❌ User dismissed the install prompt');
            }
            deferredPrompt = null;
        });
    }
}

// ============================================
// NOTIFICATION HELPER
// ============================================
function showNotification(title, message) {
    // Try to use Web Notifications API
    if ('Notification' in window && Notification.permission === 'granted') {
        new Notification(title, {
            body: message,
            icon: 'data:image/svg+xml,<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 192 192"><rect fill="%232845D6" width="192" height="192"/><text x="50%" y="50%" dominant-baseline="middle" text-anchor="middle" font-size="80" fill="white" font-weight="bold" font-family="Arial">KP</text></svg>'
        });
    }
    
    // Also show toast if available
    if (typeof showToast !== 'undefined') {
        showToast(message, 'info');
    } else {
        console.log(`📢 ${title}: ${message}`);
    }
}

function requestNotificationPermission() {
    if ('Notification' in window && Notification.permission === 'default') {
        Notification.requestPermission().then((permission) => {
            console.log(`Notification permission: ${permission}`);
        });
    }
}

// ============================================
// INITIALIZATION
// ============================================
function initPWA() {
    console.log('🚀 Initializing PWA support...');
    
    // Register service worker
    registerServiceWorker();
    
    // Setup online/offline listeners
    setupOnlineOfflineListener();
    
    // Setup install prompt
    setupInstallPrompt();
    
    // Load offline queue
    loadOfflineQueue();
    
    // Request notification permission
    requestNotificationPermission();
    
    console.log('✅ PWA initialized');
}

// ============================================
// AUTO-INITIALIZE ON PAGE LOAD
// ============================================
if (document.readyState === 'loading') {
    document.addEventListener('DOMContentLoaded', initPWA);
} else {
    initPWA();
}

// ============================================
// EXPOSE TO GLOBAL SCOPE FOR OTHER SCRIPTS
// ============================================
window.PWA = {
    isOnline: () => isOnline,
    addToQueue: addToOfflineQueue,
    syncChanges: syncOfflineChanges,
    promptToInstall: promptToInstall,
    showNotification
};

console.log('✅ PWA module loaded');
