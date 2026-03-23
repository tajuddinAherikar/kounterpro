/**
 * KounterPro Service Worker
 * Handles offline support, asset caching, and background sync
 * 
 * Version: 1.0.0
 * Features:
 * - Cache HTML/CSS/JS for offline access
 * - Network-first strategy with cache fallback
 * - Automatic cache updates
 * - Offline page fallback
 */

const CACHE_NAME = 'kounterpro-v1';
const OFFLINE_URL = './index.html';

// Files to cache on install
const CRITICAL_ASSETS = [
  './',
  './index.html',
  './login.html',
  './signup.html',
  './create-bill.html',
  './inventory.html',
  './customers.html',
  './expenses.html',
  './reports.html',
  './profile.html',
  './scripts/auth.js',
  './scripts/billing.js',
  './scripts/inventory.js',
  './scripts/customers.js',
  './scripts/expenses.js',
  './scripts/supabase.js',
  './scripts/config.js',
  './scripts/validation.js',
  './scripts/notifications.js',
  './scripts/dark-mode.js',
  './scripts/dialog.js',
  './scripts/fab.js',
  './scripts/toast.js',
  './styles/styles.css',
  './styles/styles-new.css',
  './styles/dark-mode.css',
  'https://fonts.googleapis.com/css2?family=DM+Sans:wght@300;400;600;700&display=swap',
  'https://fonts.googleapis.com/icon?family=Material+Icons',
  'https://cdn.jsdelivr.net/npm/chart.js@4.4.1/dist/chart.umd.min.js',
  'https://cdn.jsdelivr.net/npm/@supabase/supabase-js@2'
];

// ============================================
// INSTALL EVENT - Cache critical assets
// ============================================
self.addEventListener('install', (event) => {
  console.log('🔧 Service Worker: Installing...');
  
  event.waitUntil(
    caches.open(CACHE_NAME)
      .then((cache) => {
        console.log('📦 Caching critical assets...');
        return cache.addAll(CRITICAL_ASSETS);
      })
      .then(() => {
        console.log('✅ Service Worker: Install complete');
        return self.skipWaiting(); // Activate immediately
      })
      .catch((error) => {
        console.error('❌ Service Worker: Install failed', error);
      })
  );
});

// ============================================
// ACTIVATE EVENT - Clean up old caches
// ============================================
self.addEventListener('activate', (event) => {
  console.log('🚀 Service Worker: Activating...');
  
  event.waitUntil(
    caches.keys()
      .then((cacheNames) => {
        return Promise.all(
          cacheNames
            .filter((cacheName) => cacheName !== CACHE_NAME)
            .map((cacheName) => {
              console.log(`🗑️  Deleting old cache: ${cacheName}`);
              return caches.delete(cacheName);
            })
        );
      })
      .then(() => {
        console.log('✅ Service Worker: Activation complete');
        return self.clients.claim(); // Take control immediately
      })
  );
});

// ============================================
// FETCH EVENT - Network-first strategy
// ============================================
self.addEventListener('fetch', (event) => {
  const { request } = event;
  const url = new URL(request.url);
  
  // Skip non-GET requests
  if (request.method !== 'GET') {
    return;
  }
  
  // Skip chrome extensions and external protocols
  if (url.protocol !== 'http:' && url.protocol !== 'https:') {
    return;
  }
  
  // Network-first strategy for API calls to Supabase
  if (url.origin !== location.origin) {
    event.respondWith(networkFirst(request));
    return;
  }
  
  // Cache-first strategy for same-origin assets (HTML, CSS, JS, images)
  event.respondWith(cacheFirst(request));
});

// ============================================
// CACHE-FIRST STRATEGY
// Use cache first, fallback to network
// ============================================
async function cacheFirst(request) {
  try {
    // Try cache first
    const cachedResponse = await caches.match(request);
    
    if (cachedResponse) {
      // Update cache in background (stale-while-revalidate)
      updateCacheInBackground(request);
      return cachedResponse;
    }
    
    // If not in cache, fetch from network
    const networkResponse = await fetch(request);
    
    // Cache successful responses
    if (networkResponse && networkResponse.status === 200) {
      const cache = await caches.open(CACHE_NAME);
      cache.put(request, networkResponse.clone());
    }
    
    return networkResponse;
  } catch (error) {
    console.warn('❌ Fetch failed:', request.url, error);
    
    // Return offline page for HTML documents
    if (request.headers.get('accept')?.includes('text/html')) {
      const cache = await caches.open(CACHE_NAME);
      return cache.match(OFFLINE_URL) || new Response('Offline');
    }
    
    // Return error response for other asset types
    return new Response('Resource unavailable offline', { status: 503 });
  }
}

// ============================================
// NETWORK-FIRST STRATEGY
// Try network first, fallback to cache
// ============================================
async function networkFirst(request) {
  try {
    // Try network first
    const networkResponse = await fetch(request);
    
    // Cache successful responses
    if (networkResponse && networkResponse.status === 200) {
      const cache = await caches.open(CACHE_NAME);
      cache.put(request, networkResponse.clone());
    }
    
    return networkResponse;
  } catch (error) {
    console.warn('⚠️  Network failed, using cache:', request.url);
    
    // Fall back to cache
    const cachedResponse = await caches.match(request);
    if (cachedResponse) {
      return cachedResponse;
    }
    
    // If not in cache either, return error
    return new Response('Network error and resource not in cache', { status: 503 });
  }
}

// ============================================
// UPDATE CACHE IN BACKGROUND
// Revalidate assets but don't break the page
// ============================================
async function updateCacheInBackground(request) {
  try {
    const networkResponse = await fetch(request);
    
    if (networkResponse && networkResponse.status === 200) {
      const cache = await caches.open(CACHE_NAME);
      cache.put(request, networkResponse.clone());
    }
  } catch (error) {
    // Silently fail - user is already getting cached version
  }
}

// ============================================
// MESSAGE HANDLING
// Receive messages from the main thread
// ============================================
self.addEventListener('message', (event) => {
  if (event.data && event.data.type === 'SKIP_WAITING') {
    self.skipWaiting();
  }
  
  if (event.data && event.data.type === 'CLEAR_CACHE') {
    caches.delete(CACHE_NAME).then(() => {
      console.log('✅ Cache cleared');
    });
  }
});

// ============================================
// LOG SERVICE WORKER STATUS
// ============================================
console.log('✅ Service Worker: Loaded successfully');
console.log(`📦 Cache: ${CACHE_NAME}`);
console.log('🔄 Strategy: Cache-first for assets, Network-first for API');
