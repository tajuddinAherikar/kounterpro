// Inventory management functionality
let inventory = [];
let editingItemId = null;

// Load inventory from localStorage
function loadInventory() {
    try {
        const stored = localStorage.getItem('inventory');
        inventory = stored ? JSON.parse(stored) : [];
    } catch (error) {
        console.error('Error loading inventory:', error);
        alert('❌ Error loading inventory. Your data may be corrupted. Please restore from backup.');
        inventory = [];
    }
}

// Save inventory to localStorage
function saveInventory() {
    try {
        localStorage.setItem('inventory', JSON.stringify(inventory));
        return true;
    } catch (error) {
        console.error('Error saving inventory:', error);
        if (error.name === 'QuotaExceededError') {
            alert('❌ Storage limit exceeded! Please backup and clear old data.');
        } else {
            alert('❌ Error saving inventory. Please try again.');
        }
        return false;
    }
}

// Default low stock threshold
const DEFAULT_LOW_STOCK_THRESHOLD = 10;

// Get stock status for an item
function getStockStatus(item) {
    const threshold = item.lowStockThreshold || DEFAULT_LOW_STOCK_THRESHOLD;
    
    if (item.stock === 0) {
        return { status: 'out', label: 'Out of Stock', color: '#c62828', icon: '🔴' };
    } else if (item.stock <= threshold) {
        return { status: 'low', label: 'Low Stock', color: '#f68048', icon: '🟡' };
    } else {
        return { status: 'ok', label: 'In Stock', color: '#28a745', icon: '🟢' };
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
                    <td>₹${item.rate.toFixed(2)}</td>
                    <td><span class="status-badge status-${stockInfo.status}" style="background-color: ${stockInfo.color}20; color: ${stockInfo.color}; border: 1px solid ${stockInfo.color};">${stockInfo.icon} ${stockInfo.label}</span></td>
                    <td>
                        <a href="#" class="action-link" onclick="editItem('${item.id}')">Edit</a>
                        <a href="#" class="action-link" onclick="deleteItem('${item.id}')">Delete</a>
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
function deleteItem(itemId) {
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
        inventory = inventory.filter(i => i.id !== itemId);
        if (saveInventory()) {
            updateStats();
            displayInventory();
            alert('✅ Product deleted successfully');
        }
    }
}

// Generate unique ID
function generateId() {
    return 'item_' + Date.now() + '_' + Math.random().toString(36).substr(2, 9);
}

// Handle form submission
function handleFormSubmit(e) {
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
    if (editingItemId) {
        // Update existing item
        const item = inventory.find(i => i.id === editingItemId);
        if (item) {
            item.name = name;
            item.description = description;
            item.stock = stock;
            item.rate = rate;
            item.lowStockThreshold = lowStockThreshold;
            item.updatedAt = new Date().toISOString();
        }
    } else {
        // Add new item
        const newItem = {
            id: generateId(),
            name,
            description,
            stock,
            rate,
            lowStockThreshold,
            createdAt: new Date().toISOString(),
            updatedAt: new Date().toISOString()
        };
        inventory.push(newItem);
    }
    
    if (saveInventory()) {
        updateStats();
        displayInventory();
        closeModal();
        alert(editingItemId ? '✅ Product updated successfully' : '✅ Product added successfully');
    }
}

// Search inventory
function searchInventory() {
    const searchTerm = document.getElementById('searchInput').value.toLowerCase().trim();
    
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

// Export all data as JSON backup
function exportBackup() {
    try {
        // Gather all data from localStorage
        const backupData = {
            version: '1.0',
            timestamp: new Date().toISOString(),
            exportDate: new Date().toLocaleString('en-IN', { 
                year: 'numeric', 
                month: 'long', 
                day: 'numeric', 
                hour: '2-digit', 
                minute: '2-digit' 
            }),
            data: {
                invoices: JSON.parse(localStorage.getItem('invoices') || '[]'),
                inventory: JSON.parse(localStorage.getItem('inventory') || '[]')
            },
            stats: {
                totalInvoices: JSON.parse(localStorage.getItem('invoices') || '[]').length,
                totalProducts: JSON.parse(localStorage.getItem('inventory') || '[]').length
            }
        };

        // Convert to JSON string
        const jsonString = JSON.stringify(backupData, null, 2);
        
        // Create blob and download
        const blob = new Blob([jsonString], { type: 'application/json' });
        const url = URL.createObjectURL(blob);
        const link = document.createElement('a');
        
        // Generate filename with timestamp
        const timestamp = new Date().toISOString().slice(0, 10);
        link.download = `KounterPro_Backup_${timestamp}.json`;
        link.href = url;
        link.click();
        
        // Cleanup
        URL.revokeObjectURL(url);
        
        // Show success message
        alert(`✅ Backup created successfully!\n\n📦 ${backupData.stats.totalInvoices} invoices\n📦 ${backupData.stats.totalProducts} products\n\nFile: ${link.download}`);
        
    } catch (error) {
        console.error('Backup export failed:', error);
        alert('❌ Error creating backup. Please try again.');
    }
}

// Import and restore data from JSON backup
function importBackup(event) {
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
    
    // Confirm before overwriting data
    const confirmRestore = confirm(
        '⚠️ WARNING: Restore Data\n\n' +
        'This will REPLACE all current data with the backup data.\n' +
        'Current invoices and inventory will be overwritten.\n\n' +
        'Are you sure you want to continue?'
    );
    
    if (!confirmRestore) {
        event.target.value = '';
        return;
    }
    
    const reader = new FileReader();
    
    reader.onload = function(e) {
        try {
            const backupData = JSON.parse(e.target.result);
            
            // Validate backup structure
            if (!backupData.version || !backupData.data) {
                throw new Error('Invalid backup file format');
            }
            
            if (!backupData.data.invoices || !backupData.data.inventory) {
                throw new Error('Backup file is missing required data');
            }
            
            // Restore data to localStorage
            localStorage.setItem('invoices', JSON.stringify(backupData.data.invoices));
            localStorage.setItem('inventory', JSON.stringify(backupData.data.inventory));
            
            // Show success message
            alert(
                `✅ Data restored successfully!\n\n` +
                `📦 ${backupData.data.invoices.length} invoices restored\n` +
                `📦 ${backupData.data.inventory.length} products restored\n` +
                `📅 Backup created: ${backupData.exportDate || 'Unknown'}\n\n` +
                `Page will reload to show restored data.`
            );
            
            // Reload the page to reflect changes
            window.location.reload();
            
        } catch (error) {
            console.error('Backup import failed:', error);
            alert('❌ Error restoring backup: ' + error.message + '\n\nPlease ensure you selected a valid KounterPro backup file.');
        }
        
        // Reset file input
        event.target.value = '';
    };
    
    reader.onerror = function() {
        alert('❌ Error reading backup file. Please try again.');
        event.target.value = '';
    };
    
    reader.readAsText(file);
}
