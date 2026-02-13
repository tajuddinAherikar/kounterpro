// Supabase Configuration and Helper Functions
// Replace these with your actual Supabase credentials from: Settings → API

const SUPABASE_URL = 'https://clmozxqbttzdzrqdtrgs.supabase.co'; // e.g., https://xxxxx.supabase.co
const SUPABASE_ANON_KEY = 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6ImNsbW96eHFidHR6ZHpycWR0cmdzIiwicm9sZSI6ImFub24iLCJpYXQiOjE3NzA4MTgxODAsImV4cCI6MjA4NjM5NDE4MH0.Jw9jZ7yAa0Ed8HegAqjBmCSFhtguN9imC6XDtpl0R3I'; // Your anon/public key

// Initialize Supabase client immediately
let supabaseClient = null;

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
            const { error: profileError } = await supabaseClient
                .from('user_profiles')
                .insert([
                    {
                        id: data.user.id,
                        business_name: businessName,
                        mobile: mobile
                    }
                ]);
            
            if (profileError) console.warn('Profile creation warning:', profileError);
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
        return { success: true };
    } catch (error) {
        console.error('Sign out error:', error);
        return { success: false, error: error.message };
    }
}

async function supabaseGetCurrentUser() {
    try {
        if (!supabaseClient) initSupabase();
        if (!supabaseClient) return null;
        
        const { data: { user }, error } = await supabaseClient.auth.getUser();
        if (error) throw error;
        return user;
    } catch (error) {
        console.error('Get user error:', error);
        return null;
    }
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
// INVENTORY FUNCTIONS
// ============================================

async function supabaseGetInventory() {
    try {
        const { data, error } = await supabaseClient
            .from('inventory')
            .select('*')
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
                    stock: item.stock || 0,
                    rate: item.rate,
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
                stock: updates.stock,
                rate: updates.rate,
                low_stock_threshold: updates.lowStockThreshold,
                updated_at: new Date().toISOString()
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
        
        const { data, error } = await supabaseClient
            .from('invoices')
            .insert([
                {
                    user_id: user.id,
                    invoice_number: invoice.invoiceNumber,
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
                    payment_method: invoice.paymentMethod || null
                }
            ])
            .select();
        
        if (error) throw error;
        return { success: true, data: data[0] };
    } catch (error) {
        console.error('Add invoice error:', error);
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
        
        const inventoryResult = await supabaseGetInventory();
        const invoicesResult = await supabaseGetInvoices();
        
        const backup = {
            version: '1.0',
            timestamp: new Date().toISOString(),
            source: 'supabase',
            inventory: inventoryResult.data || [],
            invoices: invoicesResult.data || []
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

