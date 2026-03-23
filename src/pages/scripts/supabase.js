// Supabase Configuration and Helper Functions
// Replace these with your actual Supabase credentials from: Settings → API

const SUPABASE_URL = 'https://clmozxqbttzdzrqdtrgs.supabase.co'; // e.g., https://xxxxx.supabase.co
const SUPABASE_ANON_KEY = 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6ImNsbW96eHFidHR6ZHpycWR0cmdzIiwicm9sZSI6ImFub24iLCJpYXQiOjE3NzA4MTgxODAsImV4cCI6MjA4NjM5NDE4MH0.Jw9jZ7yAa0Ed8HegAqjBmCSFhtguN9imC6XDtpl0R3I'; // Your anon/public key

// Initialize Supabase client immediately
let supabaseClient = null;
let cachedUser = null; // Cache for current user to avoid multiple auth calls
let userCachePromise = null; // Promise for concurrent requests
let supabaseInitPromise = null; // Promise for initialization

// Initialize as soon as the library is available
if (typeof window !== 'undefined' && typeof window.supabase !== 'undefined') {
    try {
        supabaseClient = window.supabase.createClient(SUPABASE_URL, SUPABASE_ANON_KEY);
        console.log('✅ Supabase initialized successfully');
    } catch (error) {
        console.error('❌ Error initializing Supabase:', error);
    }
}

function initSupabase() {
    if (supabaseClient) {
        return supabaseClient;
    }
    
    if (typeof window.supabase === 'undefined') {
        console.error('❌ Supabase library not loaded. Add script tag to HTML.');
        return null;
    }
    
    try {
        supabaseClient = window.supabase.createClient(SUPABASE_URL, SUPABASE_ANON_KEY);
        console.log('✅ Supabase initialized successfully');
        return supabaseClient;
    } catch (error) {
        console.error('❌ Error initializing Supabase:', error);
        return null;
    }
}

// Wait for Supabase to be ready
async function ensureSupabaseReady() {
    if (supabaseClient) {
        return supabaseClient;
    }

    // Return existing promise if already waiting
    if (supabaseInitPromise) {
        return supabaseInitPromise;
    }

    // Create new initialization promise
    supabaseInitPromise = new Promise((resolve, reject) => {
        const maxAttempts = 50; // 5 seconds with 100ms intervals
        let attempts = 0;

        const checkSupabase = () => {
            if (typeof window.supabase !== 'undefined') {
                supabaseClient = initSupabase();
                if (supabaseClient) {
                    resolve(supabaseClient);
                    return;
                }
            }

            attempts++;
            if (attempts < maxAttempts) {
                setTimeout(checkSupabase, 100);
            } else {
                reject(new Error('Supabase failed to initialize'));
            }
        };

        checkSupabase();
    });

    return supabaseInitPromise;
}

// ============================================
// AUTHENTICATION FUNCTIONS
// ============================================

async function supabaseSignUp(email, password, businessName, mobile) {
    try {
        if (!supabaseClient) initSupabase();
        if (!supabaseClient) throw new Error('Supabase client not initialized');
        
        const { data, error } = await supabaseClient.auth.signUp({
            email: email,
            password: password,
            options: {
                data: {
                    business_name: businessName,
                    mobile: mobile
                },
                emailRedirectTo: window.location.origin
            }
        });
        
        if (error) throw error;
        
        // Create user profile
        if (data.user) {
            try {
                const { error: profileError } = await supabaseClient
                    .from('user_profiles')
                    .insert([
                        {
                            id: data.user.id,
                            business_name: businessName,
                            mobile: mobile
                        }
                    ]);
                
                if (profileError) {
                    console.error('Profile creation failed:', profileError);
                    // Don't fail the signup, as profile will be created on first login
                    // if it doesn't exist (handled in supabaseGetUserProfile)
                }
            } catch (profileErr) {
                console.error('Profile creation exception:', profileErr);
                // Continue with signup even if profile creation fails
            }
        }
        
        return { success: true, user: data.user };
    } catch (error) {
        console.error('Sign up error:', error);
        return { success: false, error: error.message };
    }
}

async function supabaseSignIn(email, password) {
    try {
        if (!supabaseClient) initSupabase();
        if (!supabaseClient) throw new Error('Supabase client not initialized');
        
        const { data, error } = await supabaseClient.auth.signInWithPassword({
            email: email,
            password: password
        });
        
        if (error) throw error;
        
        return { success: true, user: data.user, session: data.session };
    } catch (error) {
        console.error('Sign in error:', error);
        return { success: false, error: error.message };
    }
}

async function supabaseSignOut() {
    try {
        if (!supabaseClient) initSupabase();
        if (!supabaseClient) throw new Error('Supabase client not initialized');
        
        const { error } = await supabaseClient.auth.signOut();
        if (error) throw error;
        
        // Clear the user cache
        cachedUser = null;
        userCachePromise = null;
        
        return { success: true };
    } catch (error) {
        console.error('Sign out error:', error);
        return { success: false, error: error.message };
    }
}

async function supabaseGetCurrentUser() {
    try {
        // Return cached user if available
        if (cachedUser) {
            return cachedUser;
        }
        
        // If a request is already in progress, wait for it
        if (userCachePromise) {
            return await userCachePromise;
        }
        
        // Create new promise for this request
        userCachePromise = (async () => {
            try {
                if (!supabaseClient) initSupabase();
                if (!supabaseClient) return null;
                
                const { data: { user }, error } = await supabaseClient.auth.getUser();
                
                if (error) {
                    // If lock was stolen, retry once
                    if (error.message && error.message.includes('Lock was stolen')) {
                        console.warn('⚠️ Auth lock was stolen, retrying...');
                        // Wait a bit and retry
                        await new Promise(resolve => setTimeout(resolve, 100));
                        const { data: { user: retryUser }, error: retryError } = await supabaseClient.auth.getUser();
                        if (retryError) throw retryError;
                        cachedUser = retryUser;
                        return retryUser;
                    }
                    throw error;
                }
                
                // Cache the user
                cachedUser = user;
                return user;
            } catch (error) {
                console.error('Get user error:', error);
                return null;
            } finally {
                // Clear the promise once it's done
                userCachePromise = null;
            }
        })();
        
        return await userCachePromise;
    } catch (error) {
        console.error('Get user error:', error);
        return null;
    }
}

/**
 * Clear user cache (useful for testing or when session changes)
 */
function clearUserCache() {
    cachedUser = null;
    userCachePromise = null;
    console.log('✅ User cache cleared');
}

async function supabaseGetSession() {
    try {
        if (!supabaseClient) initSupabase();
        if (!supabaseClient) return null;
        
        const { data: { session }, error } = await supabaseClient.auth.getSession();
        if (error) throw error;
        return session;
    } catch (error) {
        console.error('Get session error:', error);
        return null;
    }
}

// ============================================
// USER PROFILE FUNCTIONS
// ============================================

async function supabaseGetUserProfile(userId) {
    try {
        if (!supabaseClient) initSupabase();
        if (!supabaseClient) throw new Error('Supabase client not initialized');
        
        // Use maybeSingle() instead of single() to handle missing profiles gracefully
        const { data, error } = await supabaseClient
            .from('user_profiles')
            .select('*')
            .eq('id', userId)
            .maybeSingle();
        
        if (error) throw error;
        
        // If profile doesn't exist, create one with default values
        if (!data) {
            console.log('Profile not found, creating default profile for user:', userId);
            
            // Get user info from auth
            const { data: { user } } = await supabaseClient.auth.getUser();
            
            const defaultProfile = {
                id: userId,
                business_name: user?.user_metadata?.business_name || 'My Business',
                mobile: user?.user_metadata?.mobile || ''
            };
            
            // Create the profile
            const { data: newProfile, error: insertError } = await supabaseClient
                .from('user_profiles')
                .insert([defaultProfile])
                .select()
                .single();
            
            if (insertError) {
                console.error('Failed to create profile:', insertError);
                // Return a default profile object even if insert fails
                return { success: true, data: defaultProfile };
            }
            
            return { success: true, data: newProfile };
        }
        
        return { success: true, data: data };
    } catch (error) {
        console.error('Get user profile error:', error);
        
        // Return a default profile object to allow dashboard to continue
        return { 
            success: true, 
            data: { 
                id: userId, 
                business_name: 'My Business', 
                mobile: '' 
            } 
        };
    }
}

async function supabaseCreateOAuthUserProfile(user) {
    try {
        const client = await ensureSupabaseReady();
        if (!client) throw new Error('Supabase client not initialized');
        
        const { error } = await client
            .from('user_profiles')
            .insert([{
                user_id: user.id,
                email: user.email,
                business_name: 'My Business',
                phone: '',
                city: '',
                state: '',
                country: '',
                timezone: Intl.DateTimeFormat().resolvedOptions().timeZone,
                profile_image_url: user.user_metadata?.avatar_url || null,
                created_at: new Date().toISOString(),
                updated_at: new Date().toISOString()
            }]);

        if (error) throw error;
        return { success: true };
    } catch (error) {
        console.error('Create OAuth profile error:', error);
        return { success: false, error: error.message };
    }
}

async function supabaseUpdateUserProfile(userId, profileData) {
    try {
        if (!supabaseClient) initSupabase();
        if (!supabaseClient) throw new Error('Supabase client not initialized');
        
        const updateData = {
            business_name: profileData.business_name,
            business_address: profileData.business_address,
            contact_number_1: profileData.contact_number_1,
            contact_number_2: profileData.contact_number_2,
            business_email: profileData.business_email,
            gst_number: profileData.gst_number,
            upi_id: profileData.upi_id,
            updated_at: new Date().toISOString()
        };
        
        // Add template settings if provided
        if (profileData.invoice_template !== undefined) {
            updateData.invoice_template = profileData.invoice_template;
        }
        if (profileData.brand_color !== undefined) {
            updateData.brand_color = profileData.brand_color;
        }
        if (profileData.logo_url !== undefined) {
            updateData.logo_url = profileData.logo_url;
            updateData.business_logo = profileData.logo_url; // keep both columns in sync
        }
        if (profileData.business_logo !== undefined && profileData.logo_url === undefined) {
            updateData.business_logo = profileData.business_logo;
        }
        if (profileData.show_logo !== undefined) {
            updateData.show_logo = profileData.show_logo;
        }
        if (profileData.logo_position !== undefined) {
            updateData.logo_position = profileData.logo_position;
        }
        if (profileData.terms_conditions !== undefined) {
            updateData.terms_conditions = profileData.terms_conditions;
        }
        
        // Add invoice numbering settings if provided
        if (profileData.invoice_prefix !== undefined) {
            updateData.invoice_prefix = profileData.invoice_prefix;
        }
        if (profileData.starting_invoice_number !== undefined) {
            updateData.starting_invoice_number = profileData.starting_invoice_number;
        }
        if (profileData.current_invoice_counter !== undefined) {
            updateData.current_invoice_counter = profileData.current_invoice_counter;
        }
        
        const { data, error } = await supabaseClient
            .from('user_profiles')
            .update(updateData)
            .eq('id', userId)
            .select();
        
        if (error) throw error;
        return { success: true, data: data[0] };
    } catch (error) {
        console.error('Update user profile error:', error);
        return { success: false, error: error.message };
    }
}

// ============================================
// LOGO UPLOAD FUNCTIONS
// ============================================

/**
 * Upload business logo to Supabase Storage
 * @param {File} file - Logo image file
 * @param {string} userId - User ID
 * @returns {Promise<Object>} - Result with logo URL
 */
async function supabaseUploadLogo(file, userId) {
    try {
        if (!supabaseClient) initSupabase();
        if (!supabaseClient) throw new Error('Supabase client not initialized');
        
        // Validate file type
        const allowedTypes = ['image/png', 'image/jpeg', 'image/jpg', 'image/svg+xml'];
        if (!allowedTypes.includes(file.type)) {
            throw new Error('Invalid file type. Please upload PNG, JPEG, or SVG.');
        }
        
        // Validate file size (max 2MB)
        const maxSize = 2 * 1024 * 1024; // 2MB
        if (file.size > maxSize) {
            throw new Error('File size too large. Maximum size is 2MB.');
        }
        
        // Create unique filename
        const fileExt = file.name.split('.').pop();
        const fileName = `${userId}/logo-${Date.now()}.${fileExt}`;
        
        // Upload file
        const { data, error } = await supabaseClient.storage
            .from('business-logos')
            .upload(fileName, file, {
                cacheControl: '3600',
                upsert: false
            });
        
        if (error) throw error;
        
        // Get public URL
        const { data: urlData } = supabaseClient.storage
            .from('business-logos')
            .getPublicUrl(fileName);
        
        return { success: true, url: urlData.publicUrl, path: fileName };
    } catch (error) {
        console.error('Logo upload error:', error);
        return { success: false, error: error.message };
    }
}

/**
 * Delete business logo from Supabase Storage
 * @param {string} filePath - Path to logo file in storage
 * @returns {Promise<Object>} - Result of deletion
 */
async function supabaseDeleteLogo(filePath) {
    try {
        if (!supabaseClient) initSupabase();
        if (!supabaseClient) throw new Error('Supabase client not initialized');
        
        if (!filePath) {
            throw new Error('File path is required');
        }
        
        const { data, error } = await supabaseClient.storage
            .from('business-logos')
            .remove([filePath]);
        
        if (error) throw error;
        
        return { success: true };
    } catch (error) {
        console.error('Logo deletion error:', error);
        return { success: false, error: error.message };
    }
}

// ============================================
// GOOGLE OAUTH FUNCTIONS (Phase 1)
// ============================================

async function supabaseSignInWithGoogle() {
    try {
        const client = await ensureSupabaseReady();
        if (!client) throw new Error('Supabase client not initialized');
        
        // Build the correct redirect URL for both local dev and GitHub Pages
        let redirectUrl = window.location.origin;
        
        // Detect if running on GitHub Pages or local dev
        const isDev = window.location.hostname === 'localhost' || window.location.hostname === '127.0.0.1';
        
        if (isDev) {
            // Local dev: redirect to /src/pages/index.html
            redirectUrl = window.location.origin + '/src/pages/index.html';
        } else {
            // GitHub Pages production: redirect to /kounterpro/ (app root on GitHub Pages)
            redirectUrl = window.location.origin + '/kounterpro/';
        }
        
        console.log('🔐 OAuth redirect URL:', redirectUrl);
        
        const { data, error } = await client.auth.signInWithOAuth({
            provider: 'google',
            options: {
                redirectTo: redirectUrl,
                queryParams: {
                    access_type: 'offline',
                    prompt: 'consent'
                }
            }
        });

        if (error) throw error;
        return { success: true, data };
    } catch (error) {
        console.error('Google OAuth error:', error);
        return { success: false, error: error.message };
    }
}

async function supabaseGetSessionData() {
    try {
        const client = await ensureSupabaseReady();
        if (!client) throw new Error('Supabase client not initialized');
        
        const { data, error } = await client.auth.getSession();
        
        if (error) throw error;
        return { success: true, data: data?.session };
    } catch (error) {
        console.error('Get session error:', error);
        return { success: false, error: error.message };
    }
}

async function supabaseLinkIdentity(provider) {
    try {
        const client = await ensureSupabaseReady();
        if (!client) throw new Error('Supabase client not initialized');
        
        const { error } = await client.auth.linkIdentity({
            provider: provider,
            options: {
                redirectTo: window.location.origin + '/src/pages/profile.html'
            }
        });

        if (error) throw error;
        return { success: true };
    } catch (error) {
        console.error('Link identity error:', error);
        return { success: false, error: error.message };
    }
}

// ============================================
// INVENTORY FUNCTIONS
// ============================================

async function supabaseGetInventory() {
    try {
        const user = await supabaseGetCurrentUser();
        if (!user) throw new Error('User not authenticated');
        
        const { data, error } = await supabaseClient
            .from('inventory')
            .select('*')
            .eq('user_id', user.id)
            .order('name', { ascending: true });
        
        if (error) throw error;
        return { success: true, data: data || [] };
    } catch (error) {
        console.error('Get inventory error:', error);
        return { success: false, error: error.message, data: [] };
    }
}

async function supabaseAddInventoryItem(item) {
    try {
        const user = await supabaseGetCurrentUser();
        if (!user) throw new Error('User not authenticated');
        
        const { data, error } = await supabaseClient
            .from('inventory')
            .insert([
                {
                    user_id: user.id,
                    name: item.name,
                    description: item.description || '',
                    barcode: item.barcode || null,
                    opening_stock: item.openingStock || 0,
                    stock: item.stock || 0,
                    rate: item.salePrice || item.purchasePrice || 0, // For backwards compatibility
                    purchase_price: item.purchasePrice || 0,
                    sale_price: item.salePrice || 0,
                    low_stock_threshold: item.lowStockThreshold || 10
                }
            ])
            .select();
        
        if (error) throw error;
        return { success: true, data: data[0] };
    } catch (error) {
        console.error('Add inventory error:', error);
        return { success: false, error: error.message };
    }
}

async function supabaseUpdateInventoryItem(id, updates) {
    try {
        const { data, error } = await supabaseClient
            .from('inventory')
            .update({
                name: updates.name,
                description: updates.description,
                barcode: updates.barcode || null,
                opening_stock: updates.openingStock,
                stock: updates.stock,
                purchase_price: updates.purchasePrice,
                sale_price: updates.salePrice,
                low_stock_threshold: updates.lowStockThreshold
            })
            .eq('id', id)
            .select();
        
        if (error) throw error;
        return { success: true, data: data[0] };
    } catch (error) {
        console.error('Update inventory error:', error);
        return { success: false, error: error.message };
    }
}

async function supabaseDeleteInventoryItem(id) {
    try {
        const { error } = await supabaseClient
            .from('inventory')
            .delete()
            .eq('id', id);
        
        if (error) throw error;
        return { success: true };
    } catch (error) {
        console.error('Delete inventory error:', error);
        return { success: false, error: error.message };
    }
}

async function supabaseUpdateStock(itemName, quantitySold) {
    try {
        // Get current item
        const { data: items, error: fetchError } = await supabaseClient
            .from('inventory')
            .select('*')
            .eq('name', itemName)
            .single();
        
        if (fetchError) throw fetchError;
        if (!items) throw new Error('Item not found');
        
        const newStock = items.stock - quantitySold;
        
        const { error: updateError } = await supabaseClient
            .from('inventory')
            .update({ 
                stock: newStock,
                updated_at: new Date().toISOString()
            })
            .eq('id', items.id);
        
        if (updateError) throw updateError;
        return { success: true, newStock };
    } catch (error) {
        console.error('Update stock error:', error);
        return { success: false, error: error.message };
    }
}

// ============================================
// INVOICE FUNCTIONS
// ============================================

async function supabaseGetInvoices() {
    try {
        const { data, error } = await supabaseClient
            .from('invoices')
            .select('*')
            .order('created_at', { ascending: false });
        
        if (error) throw error;
        return { success: true, data: data || [] };
    } catch (error) {
        console.error('Get invoices error:', error);
        return { success: false, error: error.message, data: [] };
    }
}

async function supabaseAddInvoice(invoice) {
    try {
        const user = await supabaseGetCurrentUser();
        if (!user) throw new Error('User not authenticated');
        
        // Determine payment status based on payment type and amount paid
        let paymentStatus = 'paid';
        let amountPaid = invoice.totalAmount;
        let amountDue = 0;
        
        if (invoice.paymentType === 'credit') {
            if (invoice.amountPaid && invoice.amountPaid > 0) {
                amountPaid = invoice.amountPaid;
                amountDue = invoice.totalAmount - amountPaid;
                paymentStatus = amountDue > 0 ? 'partial' : 'paid';
            } else {
                amountPaid = 0;
                amountDue = invoice.totalAmount;
                paymentStatus = 'unpaid';
            }
        }
        
        const { data, error } = await supabaseClient
            .from('invoices')
            .insert([
                {
                    user_id: user.id,
                    invoice_number: invoice.invoiceNumber,
                    date: invoice.date,
                    customer_id: invoice.customerId || null,
                    customer_name: invoice.customerName,
                    customer_mobile: invoice.mobile || null,
                    customer_gst: invoice.gstNumber || null,
                    customer_address: invoice.address || null,
                    items: invoice.items,
                    subtotal: invoice.subtotal,
                    gst_amount: invoice.gstAmount,
                    gst_rate: invoice.gstRate,
                    total_amount: invoice.totalAmount,
                    total_units: invoice.totalUnits,
                    payment_method: invoice.paymentMethod || null,
                    payment_type: invoice.paymentType || 'cash',
                    payment_status: paymentStatus,
                    amount_paid: amountPaid,
                    amount_due: amountDue,
                    tax_mode: invoice.taxMode || 'with-tax'
                }
            ])
            .select();
        
        if (error) throw error;
        
        // If credit invoice with outstanding balance, update customer balance
        if (invoice.customerId && amountDue > 0) {
            await supabaseUpdateCustomerBalance(invoice.customerId);
        }
        
        return { success: true, data: data[0] };
    } catch (error) {
        console.error('Add invoice error:', error);
        return { success: false, error: error.message };
    }
}

async function supabaseUpdateInvoice(id, invoice) {
    try {
        // Determine payment status
        let paymentStatus = 'paid';
        let amountPaid = invoice.totalAmount;
        let amountDue = 0;
        
        if (invoice.paymentType === 'credit') {
            if (invoice.amountPaid && invoice.amountPaid > 0) {
                amountPaid = invoice.amountPaid;
                amountDue = invoice.totalAmount - amountPaid;
                paymentStatus = amountDue > 0 ? 'partial' : 'paid';
            } else {
                amountPaid = 0;
                amountDue = invoice.totalAmount;
                paymentStatus = 'unpaid';
            }
        }
        
        const { data, error } = await supabaseClient
            .from('invoices')
            .update({
                date: invoice.date,
                customer_id: invoice.customerId || null,
                customer_name: invoice.customerName,
                customer_mobile: invoice.mobile || null,
                customer_gst: invoice.gstNumber || null,
                customer_address: invoice.address || null,
                items: invoice.items,
                subtotal: invoice.subtotal,
                gst_amount: invoice.gstAmount,
                gst_rate: invoice.gstRate,
                total_amount: invoice.totalAmount,
                total_units: invoice.totalUnits,
                payment_method: invoice.paymentMethod || null,
                payment_type: invoice.paymentType || 'cash',
                payment_status: paymentStatus,
                amount_paid: amountPaid,
                amount_due: amountDue,
                tax_mode: invoice.taxMode || 'with-tax'
            })
            .eq('id', id)
            .select();
        
        if (error) throw error;
        
        // Update customer balance if customer is linked
        if (invoice.customerId) {
            await supabaseUpdateCustomerBalance(invoice.customerId);
        }
        
        return { success: true, data: data[0] };
    } catch (error) {
        console.error('Update invoice error:', error);
        return { success: false, error: error.message };
    }
}

async function supabaseDeleteInvoice(id) {
    try {
        const { error } = await supabaseClient
            .from('invoices')
            .delete()
            .eq('id', id);
        
        if (error) throw error;
        return { success: true };
    } catch (error) {
        console.error('Delete invoice error:', error);
        return { success: false, error: error.message };
    }
}

async function supabaseSearchInvoices(searchTerm) {
    try {
        const { data, error } = await supabaseClient
            .from('invoices')
            .select('*')
            .or(`invoice_number.ilike.%${searchTerm}%,customer_name.ilike.%${searchTerm}%`)
            .order('created_at', { ascending: false });
        
        if (error) throw error;
        return { success: true, data: data || [] };
    } catch (error) {
        console.error('Search invoices error:', error);
        return { success: false, error: error.message, data: [] };
    }
}

// ============================================
// DATA MIGRATION FUNCTIONS
// ============================================

async function migrateLocalStorageToSupabase() {
    try {
        showLoading('Migrating data to cloud...');
        
        const user = await supabaseGetCurrentUser();
        if (!user) {
            throw new Error('Please sign in first');
        }
        
        let migratedItems = 0;
        let migratedInvoices = 0;
        
        // Migrate Inventory
        const localInventory = JSON.parse(localStorage.getItem('inventory') || '[]');
        if (localInventory.length > 0) {
            for (const item of localInventory) {
                const result = await supabaseAddInventoryItem(item);
                if (result.success) migratedItems++;
            }
        }
        
        // Migrate Invoices
        const localInvoices = JSON.parse(localStorage.getItem('invoices') || '[]');
        if (localInvoices.length > 0) {
            for (const invoice of localInvoices) {
                const result = await supabaseAddInvoice(invoice);
                if (result.success) migratedInvoices++;
            }
        }
        
        hideLoading();
        
        return {
            success: true,
            message: `✅ Migration complete!\n${migratedItems} inventory items\n${migratedInvoices} invoices`,
            migratedItems,
            migratedInvoices
        };
    } catch (error) {
        hideLoading();
        console.error('Migration error:', error);
        return {
            success: false,
            error: error.message
        };
    }
}

async function downloadSupabaseBackup() {
    try {
        showLoading('Downloading backup from cloud...');
        
        // Fetch all user data
        const inventoryResult = await supabaseGetInventory();
        const invoicesResult = await supabaseGetInvoices();
        const customersResult = await supabaseGetCustomers();
        const expensesResult = await supabaseGetExpenses();
        const profileResult = await supabaseGetUserProfile();
        
        const backup = {
            version: '2.0',
            timestamp: new Date().toISOString(),
            source: 'supabase',
            data: {
                inventory: inventoryResult.data || [],
                invoices: invoicesResult.data || [],
                customers: customersResult.data || [],
                expenses: expensesResult.data || [],
                profile: profileResult.data || null
            },
            stats: {
                totalInventoryItems: (inventoryResult.data || []).length,
                totalInvoices: (invoicesResult.data || []).length,
                totalCustomers: (customersResult.data || []).length,
                totalExpenses: (expensesResult.data || []).length
            }
        };
        
        const blob = new Blob([JSON.stringify(backup, null, 2)], { type: 'application/json' });
        const url = URL.createObjectURL(blob);
        const a = document.createElement('a');
        a.href = url;
        a.download = `kounterpro-backup-${new Date().toISOString().split('T')[0]}.json`;
        document.body.appendChild(a);
        a.click();
        document.body.removeChild(a);
        URL.revokeObjectURL(url);
        
        hideLoading();
        
        return { success: true };
    } catch (error) {
        hideLoading();
        console.error('Backup download error:', error);
        return { success: false, error: error.message };
    }
}

// ============================================
// UTILITY FUNCTIONS
// ============================================

function isSupabaseConfigured() {
    return SUPABASE_URL !== 'YOUR_SUPABASE_URL' && 
           SUPABASE_ANON_KEY !== 'YOUR_SUPABASE_ANON_KEY' &&
           SUPABASE_URL.includes('supabase.co');
}

function getSupabaseStatus() {
    if (!isSupabaseConfigured()) {
        return { configured: false, message: '⚙️ Supabase not configured' };
    }
    if (typeof supabase === 'undefined') {
        return { configured: true, initialized: false, message: '⏳ Supabase not initialized' };
    }
    return { configured: true, initialized: true, message: '✅ Supabase ready' };
}

// ===== CUSTOMER MANAGEMENT FUNCTIONS =====

// Get all customers
async function supabaseGetCustomers() {
    try {
        const user = await supabaseGetCurrentUser();
        if (!user) throw new Error('User not authenticated');
        
        const { data, error } = await supabaseClient
            .from('customers')
            .select('*')
            .eq('user_id', user.id)
            .order('name', { ascending: true });
        
        if (error) throw error;
        return { success: true, data: data || [] };
    } catch (error) {
        console.error('Get customers error:', error);
        return { success: false, error: error.message, data: [] };
    }
}

// Add new customer
async function supabaseAddCustomer(customer) {
    try {
        const user = await supabaseGetCurrentUser();
        if (!user) throw new Error('User not authenticated');
        
        const { data, error } = await supabaseClient
            .from('customers')
            .insert([
                {
                    user_id: user.id,
                    name: customer.name,
                    mobile: customer.mobile,
                    email: customer.email || null,
                    address: customer.address,
                    gst_number: customer.gst || null
                }
            ])
            .select();
        
        if (error) throw error;
        return { success: true, data: data[0] };
    } catch (error) {
        console.error('Add customer error:', error);
        return { success: false, error: error.message };
    }
}

// Update customer
async function supabaseUpdateCustomer(id, updates) {
    try {
        const { data, error } = await supabaseClient
            .from('customers')
            .update({
                name: updates.name,
                mobile: updates.mobile,
                email: updates.email || null,
                address: updates.address,
                gst_number: updates.gst || null,
                updated_at: new Date().toISOString()
            })
            .eq('id', id)
            .select();
        
        if (error) throw error;
        return { success: true, data: data[0] };
    } catch (error) {
        console.error('Update customer error:', error);
        return { success: false, error: error.message };
    }
}

// Delete customer
async function supabaseDeleteCustomer(id) {
    try {
        const { error } = await supabaseClient
            .from('customers')
            .delete()
            .eq('id', id);
        
        if (error) throw error;
        return { success: true };
    } catch (error) {
        console.error('Delete customer error:', error);
        return { success: false, error: error.message };
    }
}

// ============ EXPENSE MANAGEMENT ============

async function supabaseGetExpenses() {
    try {
        const { data, error } = await supabaseClient
            .from('expenses')
            .select('*')
            .order('date', { ascending: false });
        
        if (error) throw error;
        return { success: true, data: data || [] };
    } catch (error) {
        console.error('Get expenses error:', error);
        return { success: false, error: error.message, data: [] };
    }
}

async function supabaseAddExpense(expense) {
    try {
        const user = await supabaseGetCurrentUser();
        if (!user) throw new Error('User not authenticated');
        
        const { data, error } = await supabaseClient
            .from('expenses')
            .insert([
                {
                    user_id: user.id,
                    amount: expense.amount,
                    description: expense.description,
                    category: expense.category,
                    date: expense.date
                }
            ])
            .select();
        
        if (error) throw error;
        return { success: true, data: data[0] };
    } catch (error) {
        console.error('Add expense error:', error);
        return { success: false, error: error.message };
    }
}

async function supabaseUpdateExpense(id, expense) {
    try {
        const { data, error } = await supabaseClient
            .from('expenses')
            .update({
                amount: expense.amount,
                description: expense.description,
                category: expense.category,
                date: expense.date,
                updated_at: new Date().toISOString()
            })
            .eq('id', id)
            .select();
        
        if (error) throw error;
        return { success: true, data: data[0] };
    } catch (error) {
        console.error('Update expense error:', error);
        return { success: false, error: error.message };
    }
}

async function supabaseDeleteExpense(id) {
    try {
        const { error } = await supabaseClient
            .from('expenses')
            .delete()
            .eq('id', id);
        
        if (error) throw error;
        return { success: true };
    } catch (error) {
        console.error('Delete expense error:', error);
        return { success: false, error: error.message };
    }
}

// ============================================
// CREDIT & PAYMENT MANAGEMENT FUNCTIONS
// ============================================

/**
 * Get customer's outstanding balance
 * @param {string} customerId - Customer UUID
 * @returns {object} { success, balance, data }
 */
async function supabaseGetCustomerBalance(customerId) {
    try {
        const { data, error } = await supabaseClient
            .from('customers')
            .select('outstanding_balance')
            .eq('id', customerId)
            .single();
        
        if (error) throw error;
        return { 
            success: true, 
            balance: data?.outstanding_balance || 0,
            data: data 
        };
    } catch (error) {
        console.error('Get customer balance error:', error);
        return { success: false, error: error.message, balance: 0 };
    }
}

/**
 * Update customer's outstanding balance by recalculating from invoices
 * @param {string} customerId - Customer UUID
 * @returns {object} { success, balance }
 */
async function supabaseUpdateCustomerBalance(customerId) {
    try {
        const user = await supabaseGetCurrentUser();
        if (!user) throw new Error('User not authenticated');
        
        // Get all unpaid and partially paid invoices for this customer
        const { data: invoices, error: invoicesError } = await supabaseClient
            .from('invoices')
            .select('amount_due')
            .eq('customer_id', customerId)
            .eq('user_id', user.id)
            .in('payment_status', ['unpaid', 'partial']);
        
        if (invoicesError) throw invoicesError;
        
        // Calculate total outstanding balance
        const totalOutstanding = invoices.reduce((sum, inv) => sum + (inv.amount_due || 0), 0);
        
        // Update customer's outstanding balance
        const { data, error } = await supabaseClient
            .from('customers')
            .update({ 
                outstanding_balance: totalOutstanding,
                updated_at: new Date().toISOString()
            })
            .eq('id', customerId)
            .select();
        
        if (error) throw error;
        
        return { success: true, balance: totalOutstanding, data: data[0] };
    } catch (error) {
        console.error('Update customer balance error:', error);
        return { success: false, error: error.message, balance: 0 };
    }
}

/**
 * Get all unpaid or partially paid invoices
 * @param {string} customerId - Optional customer ID to filter
 * @returns {object} { success, data }
 */
async function supabaseGetPendingInvoices(customerId = null) {
    try {
        const user = await supabaseGetCurrentUser();
        if (!user) throw new Error('User not authenticated');
        
        let query = supabaseClient
            .from('invoices')
            .select('*')
            .eq('user_id', user.id)
            .in('payment_status', ['unpaid', 'partial'])
            .order('date', { ascending: false });
        
        if (customerId) {
            query = query.eq('customer_id', customerId);
        }
        
        const { data, error } = await query;
        
        if (error) throw error;
        return { success: true, data: data || [] };
    } catch (error) {
        console.error('Get pending invoices error:', error);
        return { success: false, error: error.message, data: [] };
    }
}

/**
 * Record a payment against an invoice
 * @param {object} payment - Payment details { invoiceId, customerId, amount, paymentDate, paymentMethod, notes }
 * @returns {object} { success, data }
 */
async function supabaseRecordPayment(payment) {
    try {
        const user = await supabaseGetCurrentUser();
        if (!user) throw new Error('User not authenticated');
        
        // Validate payment amount
        if (!payment.amount || payment.amount <= 0) {
            throw new Error('Payment amount must be greater than 0');
        }
        
        // Get the invoice to validate payment amount
        const { data: invoice, error: invoiceError } = await supabaseClient
            .from('invoices')
            .select('total_amount, amount_paid, amount_due, payment_status')
            .eq('id', payment.invoiceId)
            .single();
        
        if (invoiceError) throw invoiceError;
        
        if (payment.amount > invoice.amount_due) {
            throw new Error(`Payment amount (₹${payment.amount}) exceeds outstanding amount (₹${invoice.amount_due})`);
        }
        
        // Insert payment record
        const { data: paymentData, error: paymentError } = await supabaseClient
            .from('payments')
            .insert([
                {
                    user_id: user.id,
                    invoice_id: payment.invoiceId,
                    customer_id: payment.customerId,
                    amount: payment.amount,
                    payment_date: payment.paymentDate || new Date().toISOString().split('T')[0],
                    payment_method: payment.paymentMethod || null,
                    notes: payment.notes || null
                }
            ])
            .select();
        
        if (paymentError) throw paymentError;
        
        // Update invoice payment status
        const newAmountPaid = invoice.amount_paid + payment.amount;
        const newAmountDue = invoice.total_amount - newAmountPaid;
        const newPaymentStatus = newAmountDue <= 0 ? 'paid' : 'partial';
        
        const { error: updateError } = await supabaseClient
            .from('invoices')
            .update({
                amount_paid: newAmountPaid,
                amount_due: newAmountDue,
                payment_status: newPaymentStatus,
                updated_at: new Date().toISOString()
            })
            .eq('id', payment.invoiceId);
        
        if (updateError) throw updateError;
        
        // Update customer's outstanding balance
        await supabaseUpdateCustomerBalance(payment.customerId);
        
        return { success: true, data: paymentData[0] };
    } catch (error) {
        console.error('Record payment error:', error);
        return { success: false, error: error.message };
    }
}

/**
 * Get payment history for an invoice or customer
 * @param {object} filters - { invoiceId, customerId }
 * @returns {object} { success, data }
 */
async function supabaseGetPayments(filters = {}) {
    try {
        const user = await supabaseGetCurrentUser();
        if (!user) throw new Error('User not authenticated');
        
        let query = supabaseClient
            .from('payments')
            .select('*')
            .eq('user_id', user.id)
            .order('payment_date', { ascending: false });
        
        if (filters.invoiceId) {
            query = query.eq('invoice_id', filters.invoiceId);
        }
        
        if (filters.customerId) {
            query = query.eq('customer_id', filters.customerId);
        }
        
        const { data, error } = await query;
        
        if (error) throw error;
        return { success: true, data: data || [] };
    } catch (error) {
        console.error('Get payments error:', error);
        return { success: false, error: error.message, data: [] };
    }
}

/**
 * Get customers with outstanding balances
 * @returns {object} { success, data }
 */
async function supabaseGetCustomersWithOutstanding() {
    try {
        const user = await supabaseGetCurrentUser();
        if (!user) throw new Error('User not authenticated');
        
        const { data, error } = await supabaseClient
            .from('customers')
            .select('*')
            .eq('user_id', user.id)
            .gt('outstanding_balance', 0)
            .order('outstanding_balance', { ascending: false });
        
        if (error) throw error;
        return { success: true, data: data || [] };
    } catch (error) {
        console.error('Get customers with outstanding error:', error);
        return { success: false, error: error.message, data: [] };
    }
}

// ============================================
// PASSWORD RESET FUNCTIONS (Phase 2)
// Uses Supabase's built-in password reset
// ============================================

// Password reset is now handled by Supabase's native functions:
// - auth.resetPasswordForEmail(email) - Sends reset email
// - User gets recovery session when clicking email link
// - auth.updateUser({ password: newPassword }) - Updates password

// No custom token management needed!
// More secure and battle-tested approach.

// Initialize on page load
if (typeof window !== 'undefined') {
    window.addEventListener('DOMContentLoaded', () => {
        if (isSupabaseConfigured()) {
            initSupabase();
        } else {
            console.warn('⚠️ Supabase credentials not configured. Update SUPABASE_URL and SUPABASE_ANON_KEY in supabase.js');
        }
    });
}
