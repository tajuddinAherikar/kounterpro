// Inventory management functionality with Supabase
let inventory = [];
let editingItemId = null;

// Format number in Indian numbering system (e.g., 8,21,000)
function formatIndianCurrency(amount) {
    const num = parseFloat(amount).toFixed(2);
    const [integerPart, decimalPart] = num.split('.');
    
    // Handle negative numbers
    const isNegative = integerPart.startsWith('-');
    const absInteger = isNegative ? integerPart.slice(1) : integerPart;
    
    // Indian format: last 3 digits, then groups of 2
    let result = '';
    if (absInteger.length <= 3) {
        result = absInteger;
    } else {
        const lastThree = absInteger.slice(-3);
        const remaining = absInteger.slice(0, -3);
        result = remaining.replace(/\B(?=(\d{2})+(?!\d))/g, ',') + ',' + lastThree;
    }
    
    return (isNegative ? '-' : '') + result + '.' + decimalPart;
}

// Show skeleton loaders
function showSkeletonLoaders() {
    // Skeleton for stats
    const totalItems = document.getElementById('totalItems');
    const totalStock = document.getElementById('totalStock');
    const lowStockCount = document.getElementById('lowStockCount');
    
    if (totalItems) totalItems.classList.add('skeleton');
    if (totalStock) totalStock.classList.add('skeleton');
    if (lowStockCount) lowStockCount.classList.add('skeleton');
    
    // Skeleton for table
    const tbody = document.getElementById('inventoryTableBody');
    if (tbody) {
        tbody.innerHTML = Array(5).fill(0).map(() => `
            <tr>
                <td><div class="skeleton skeleton-text"></div></td>
                <td><div class="skeleton skeleton-text"></div></td>
                <td><div class="skeleton skeleton-text"></div></td>
                <td><div class="skeleton skeleton-text"></div></td>
                <td><div class="skeleton skeleton-text"></div></td>
                <td><div class="skeleton skeleton-text"></div></td>
            </tr>
        `).join('');
    }
}

// Hide skeleton loaders
function hideSkeletonLoaders() {
    const totalItems = document.getElementById('totalItems');
    const totalStock = document.getElementById('totalStock');
    const lowStockCount = document.getElementById('lowStockCount');
    
    if (totalItems) totalItems.classList.remove('skeleton');
    if (totalStock) totalStock.classList.remove('skeleton');
    if (lowStockCount) lowStockCount.classList.remove('skeleton');
}

// Load inventory from Supabase
async function loadInventory() {
    try {
        showSkeletonLoaders();
        const result = await supabaseGetInventory();
        hideSkeletonLoaders();
        
        if (result.success) {
            // Convert Supabase format to local format
            inventory = result.data.map(item => ({
                id: item.id,
                name: item.name,
                description: item.description,
                stock: item.stock,
                rate: parseFloat(item.rate),
                lowStockThreshold: item.low_stock_threshold
            }));
            displayInventory();
            updateStats();
        } else {
            console.error('Error loading inventory:', result.error);
            alert('❌ Error loading inventory: ' + result.error);
            inventory = [];
        }
    } catch (error) {
        hideSkeletonLoaders();
        console.error('Error loading inventory:', error);
        alert('❌ Error loading inventory. Please try again.');
        inventory = [];
    }
}

// Save inventory item to Supabase
async function saveInventoryItem(item, isEdit = false) {
    try {
        showLoading(isEdit ? 'Updating item...' : 'Adding item...');
        
        const itemData = {
            name: item.name,
            description: item.description,
            stock: item.stock,
            rate: item.rate,
            lowStockThreshold: item.lowStockThreshold
        };
        
        let result;
        if (isEdit) {
            result = await supabaseUpdateInventoryItem(item.id, itemData);
        } else {
            result = await supabaseAddInventoryItem(itemData);
        }
        
        hideLoading();
        
        if (result.success) {
            await loadInventory(); // Reload to get fresh data
            return true;
        } else {
            console.error('Error saving inventory:', result.error);
            alert('❌ Error saving item: ' + result.error);
            return false;
        }
    } catch (error) {
        hideLoading();
        console.error('Error saving inventory:', error);
        alert('❌ Error saving item. Please try again.');
        return false;
    }
}

// Default low stock threshold
const DEFAULT_LOW_STOCK_THRESHOLD = 10;

// Get stock status for an item
function getStockStatus(item) {
    const threshold = item.lowStockThreshold || DEFAULT_LOW_STOCK_THRESHOLD;
    
    if (item.stock === 0) {
        return { status: 'out', label: 'Out of Stock', color: '#c62828', icon: '<span class="material-icons" style="font-size: 16px; vertical-align: middle;">cancel</span>' };
    } else if (item.stock <= threshold) {
        return { status: 'low', label: 'Low Stock', color: '#f68048', icon: '<span class="material-icons" style="font-size: 16px; vertical-align: middle;">warning</span>' };
    } else {
        return { status: 'ok', label: 'In Stock', color: '#28a745', icon: '<span class="material-icons" style="font-size: 16px; vertical-align: middle;">check_circle</span>' };
    }
}

// Calculate statistics
function calculateInventoryStats() {
    const totalItems = inventory.length;
    const totalStock = inventory.reduce((sum, item) => sum + item.stock, 0);
    const outOfStock = inventory.filter(item => item.stock === 0).length;
    const lowStockCount = inventory.filter(item => {
        const threshold = item.lowStockThreshold || DEFAULT_LOW_STOCK_THRESHOLD;
        return item.stock > 0 && item.stock <= threshold;
    }).length;
    
    return { totalItems, totalStock, lowStockCount, outOfStock };
}

// Update statistics display
function updateStats() {
    const stats = calculateInventoryStats();
    
    document.getElementById('totalItems').textContent = stats.totalItems;
    document.getElementById('totalStock').textContent = stats.totalStock;
    document.getElementById('lowStockCount').textContent = stats.lowStockCount;
}

// Display inventory items in table
function displayInventory(items = inventory) {
    const tbody = document.getElementById('inventoryTableBody');
    
    if (items.length === 0) {
        tbody.innerHTML = '<tr><td colspan="6" style="text-align: center; padding: 40px;">No items found.</td></tr>';
        return;
    }
    
    tbody.innerHTML = items
        .sort((a, b) => {
            // Sort by stock status (out of stock first, then low stock, then in stock)
            const aStatus = getStockStatus(a);
            const bStatus = getStockStatus(b);
            const statusOrder = { out: 0, low: 1, ok: 2 };
            if (statusOrder[aStatus.status] !== statusOrder[bStatus.status]) {
                return statusOrder[aStatus.status] - statusOrder[bStatus.status];
            }
            return a.name.localeCompare(b.name);
        })
        .map(item => {
            const stockInfo = getStockStatus(item);
            const threshold = item.lowStockThreshold || DEFAULT_LOW_STOCK_THRESHOLD;
            const stockDisplay = item.stock === 0 ? 
                `<strong style="color: #c62828;">${item.stock} units</strong>` :
                item.stock <= threshold ?
                `<strong style="color: #f68048;">${item.stock} units</strong> <small style="color: #666;">(Alert: ≤${threshold})</small>` :
                `${item.stock} units`;
            
            return `
                <tr style="${item.stock === 0 ? 'background-color: #ffebee;' : item.stock <= threshold ? 'background-color: #fff8f0;' : ''}">
                    <td><strong>${item.name}</strong></td>
                    <td>${item.description || '-'}</td>
                    <td>${stockDisplay}</td>
                    <td>₹${formatIndianCurrency(item.rate)}</td>
                    <td><span class="status-badge status-${stockInfo.status}" style="background-color: ${stockInfo.color}20; color: ${stockInfo.color}; border: 1px solid ${stockInfo.color};">${stockInfo.icon} ${stockInfo.label}</span></td>
                    <td>
                        <a href="#" class="action-link" onclick="editItem('${item.id}'); return false;">
                            <span class="material-icons">edit</span> Edit
                        </a>
                        <a href="#" class="action-link" onclick="deleteItem('${item.id}'); return false;">
                            <span class="material-icons">delete</span> Delete
                        </a>
                    </td>
                </tr>
            `;
        }).join('');
}

// Show add/edit item modal
function showAddItemModal() {
    editingItemId = null;
    document.getElementById('modalTitle').textContent = 'Add New Item';
    document.getElementById('itemForm').reset();
    document.getElementById('editItemId').value = '';
    document.getElementById('itemModal').style.display = 'flex';
}

// Edit item
function editItem(itemId) {
    const item = inventory.find(i => i.id === itemId);
    if (!item) return;
    
    editingItemId = itemId;
    document.getElementById('modalTitle').textContent = 'Edit Item';
    document.getElementById('editItemId').value = itemId;
    document.getElementById('itemName').value = item.name;
    document.getElementById('itemDescription').value = item.description || '';
    document.getElementById('itemStock').value = item.stock;
    document.getElementById('itemRate').value = item.rate;
    document.getElementById('itemLowStockThreshold').value = item.lowStockThreshold || DEFAULT_LOW_STOCK_THRESHOLD;
    document.getElementById('itemModal').style.display = 'flex';
}

// Close modal
function closeModal() {
    document.getElementById('itemModal').style.display = 'none';
    editingItemId = null;
}

// Delete item
async function deleteItem(itemId) {
    const item = inventory.find(i => i.id === itemId);
    if (!item) {
        alert('❌ Item not found');
        return;
    }
    
    const confirmMessage = `⚠️ Delete Product Confirmation\n\n` +
        `Product: ${item.name}\n` +
        `Current Stock: ${item.stock} units\n` +
        `Rate: ₹${item.rate}\n\n` +
        `This action cannot be undone!\n\n` +
        `Are you sure you want to delete this product?`;
    
    if (confirm(confirmMessage)) {
        showLoading('Deleting item...');
        const result = await supabaseDeleteInventoryItem(itemId);
        hideLoading();
        
        if (result.success) {
            await loadInventory(); // Reload to refresh list
            alert('✅ Product deleted successfully');
        } else {
            alert('❌ Error deleting product: ' + result.error);
        }
    }
}

// Generate unique ID
function generateId() {
    return 'item_' + Date.now() + '_' + Math.random().toString(36).substr(2, 9);
}

// Handle form submission
async function handleFormSubmit(e) {
    e.preventDefault();
    
    const name = document.getElementById('itemName').value.trim();
    const description = document.getElementById('itemDescription').value.trim();
    const stockInput = document.getElementById('itemStock').value;
    const rateInput = document.getElementById('itemRate').value;
    const lowStockThresholdInput = document.getElementById('itemLowStockThreshold').value;
    
    // Validation
    if (!name || name.length < 2) {
        alert('❌ Product name must be at least 2 characters');
        document.getElementById('itemName').focus();
        return;
    }
    
    if (name.length > 100) {
        alert('❌ Product name must not exceed 100 characters');
        document.getElementById('itemName').focus();
        return;
    }
    
    // Check for duplicate names (except when editing)
    const duplicate = inventory.find(i => 
        i.name.toLowerCase() === name.toLowerCase() && 
        i.id !== editingItemId
    );
    if (duplicate) {
        alert('❌ A product with this name already exists');
        document.getElementById('itemName').focus();
        return;
    }
    
    if (description.length > 255) {
        alert('❌ Description must not exceed 255 characters');
        document.getElementById('itemDescription').focus();
        return;
    }
    
    const stock = parseInt(stockInput);
    if (isNaN(stock) || stock < 0) {
        alert('❌ Stock must be a positive number or zero');
        document.getElementById('itemStock').focus();
        return;
    }
    
    if (stock > 999999) {
        alert('❌ Stock value is too large (maximum: 999,999)');
        document.getElementById('itemStock').focus();
        return;
    }
    
    const rate = parseFloat(rateInput);
    if (isNaN(rate) || rate <= 0) {
        alert('❌ Rate must be a positive number greater than 0');
        document.getElementById('itemRate').focus();
        return;
    }
    
    if (rate > 9999999) {
        alert('❌ Rate value is too large (maximum: 9,999,999)');
        document.getElementById('itemRate').focus();
        return;
    }
    
    // Validate low stock threshold
    let lowStockThreshold = parseInt(lowStockThresholdInput);
    if (lowStockThresholdInput && (isNaN(lowStockThreshold) || lowStockThreshold < 0)) {
        alert('❌ Low stock threshold must be a positive number');
        document.getElementById('itemLowStockThreshold').focus();
        return;
    }
    if (lowStockThreshold > 1000) {
        alert('❌ Low stock threshold too large (maximum: 1000)');
        document.getElementById('itemLowStockThreshold').focus();
        return;
    }
    // Default to 10 if not set
    if (!lowStockThreshold || lowStockThreshold === 0) {
        lowStockThreshold = DEFAULT_LOW_STOCK_THRESHOLD;
    }
    
    // All validations passed, proceed with save
    const itemData = {
        name,
        description,
        stock,
        rate,
        lowStockThreshold
    };
    
    if (editingItemId) {
        // Update existing item
        itemData.id = editingItemId;
        const success = await saveInventoryItem(itemData, true);
        if (success) {
            closeModal();
            alert('✅ Product updated successfully');
        }
    } else {
        // Add new item
        const success = await saveInventoryItem(itemData, false);
        if (success) {
            closeModal();
            alert('✅ Product added successfully');
        }
    }
}

// Search inventory
function searchInventory() {
    const searchTerm = document.getElementById('searchInput').value.toLowerCase().trim();
    const clearIcon = document.getElementById('clearSearchIcon');
    
    // Show/hide clear icon
    if (searchTerm) {
        clearIcon.style.display = 'block';
    } else {
        clearIcon.style.display = 'none';
    }
    
    if (!searchTerm) {
        displayInventory();
        return;
    }
    
    const filtered = inventory.filter(item => 
        item.name.toLowerCase().includes(searchTerm) ||
        (item.description && item.description.toLowerCase().includes(searchTerm))
    );
    
    displayInventory(filtered);
}

// Clear search
function clearSearch() {
    document.getElementById('searchInput').value = '';
    document.getElementById('clearSearchIcon').style.display = 'none';
    displayInventory();
}

// Close modal when clicking outside
window.onclick = function(event) {
    const modal = document.getElementById('itemModal');
    if (event.target === modal) {
        closeModal();
    }
};

// Initialize inventory page
function initInventory() {
    // Reset low stock banner flag when user visits inventory
    sessionStorage.removeItem('lowStockBannerShown');
    
    loadInventory();
    updateStats();
    displayInventory();
    
    // Add form submit listener
    document.getElementById('itemForm').addEventListener('submit', handleFormSubmit);
    
    // Add search on enter key
    document.getElementById('searchInput').addEventListener('keypress', function(e) {
        if (e.key === 'Enter') {
            searchInventory();
        }
    });
}

// Initialize when page loads
document.addEventListener('DOMContentLoaded', initInventory);

// ===== BACKUP & RESTORE FUNCTIONALITY =====

// Export all data as JSON backup from Supabase
async function exportBackup() {
    await downloadSupabaseBackup();
}

// Import and restore data from JSON backup
async function importBackup(event) {
    const file = event.target.files[0];
    
    if (!file) {
        return;
    }
    
    // Validate file type
    if (!file.name.endsWith('.json')) {
        alert('❌ Invalid file type. Please select a JSON backup file.');
        event.target.value = '';
        return;
    }
    
    // Note: Restore from file not implemented for Supabase
    alert('ℹ️ Backup restore from file is not yet available with Supabase.\n\nPlease use the Supabase Dashboard to manage your data.\n\nTo migrate localStorage data to Supabase, open console and run:\nmigrateLocalStorageToSupabase()');
    event.target.value = '';
}
