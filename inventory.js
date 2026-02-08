// Inventory management functionality
let inventory = [];
let editingItemId = null;

// Load inventory from localStorage
function loadInventory() {
    const stored = localStorage.getItem('inventory');
    inventory = stored ? JSON.parse(stored) : [];
}

// Save inventory to localStorage
function saveInventory() {
    localStorage.setItem('inventory', JSON.stringify(inventory));
}

// Calculate statistics
function calculateInventoryStats() {
    const totalItems = inventory.length;
    const totalStock = inventory.reduce((sum, item) => sum + item.stock, 0);
    const lowStockCount = inventory.filter(item => item.stock < 10).length;
    
    return { totalItems, totalStock, lowStockCount };
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
        .sort((a, b) => a.name.localeCompare(b.name))
        .map(item => {
            const stockStatus = item.stock === 0 ? 'Out of Stock' : 
                               item.stock < 10 ? 'Low Stock' : 
                               'In Stock';
            const statusClass = item.stock === 0 ? 'status-out' : 
                               item.stock < 10 ? 'status-low' : 
                               'status-ok';
            
            return `
                <tr>
                    <td><strong>${item.name}</strong></td>
                    <td>${item.description || '-'}</td>
                    <td>${item.stock} units</td>
                    <td>₹${item.rate.toFixed(2)}</td>
                    <td><span class="status-badge ${statusClass}">${stockStatus}</span></td>
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
    if (!item) return;
    
    if (confirm(`Are you sure you want to delete "${item.name}"?`)) {
        inventory = inventory.filter(i => i.id !== itemId);
        saveInventory();
        updateStats();
        displayInventory();
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
    const stock = parseInt(document.getElementById('itemStock').value);
    const rate = parseFloat(document.getElementById('itemRate').value);
    
    if (editingItemId) {
        // Update existing item
        const item = inventory.find(i => i.id === editingItemId);
        if (item) {
            item.name = name;
            item.description = description;
            item.stock = stock;
            item.rate = rate;
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
            createdAt: new Date().toISOString(),
            updatedAt: new Date().toISOString()
        };
        inventory.push(newItem);
    }
    
    saveInventory();
    updateStats();
    displayInventory();
    closeModal();
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
