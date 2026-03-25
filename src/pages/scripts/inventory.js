// Inventory management functionality with Supabase
let inventory = [];
let editingItemId = null;
let inventoryDateFrom = null;
let inventoryDateTo = null;

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
                openingStock: item.opening_stock || 0,
                stock: item.stock,
                purchasePrice: parseFloat(item.purchase_price || 0),
                salePrice: parseFloat(item.sale_price || 0),
                lowStockThreshold: item.low_stock_threshold,
                createdAt: item.created_at
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
            openingStock: item.openingStock || 0,
            stock: item.stock,
            purchasePrice: item.purchasePrice,
            salePrice: item.salePrice,
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
// Inventory pagination state
let allInventoryData = [];
let inventoryShownCount = 0;
const INVENTORY_INITIAL = 10;
const INVENTORY_PAGE = 10;

function buildInventoryRow(item) {
    const stockInfo = getStockStatus(item);
    const threshold = item.lowStockThreshold || DEFAULT_LOW_STOCK_THRESHOLD;
    const consumed = (item.openingStock || 0) - item.stock;
    const profitMargin = item.purchasePrice > 0 ? (((item.salePrice - item.purchasePrice) / item.purchasePrice) * 100).toFixed(2) : 0;
    const stockDisplay = item.stock === 0 ?
        `<strong style="color: #c62828;">${item.stock} units</strong>` :
        item.stock <= threshold ?
        `<strong style="color: #f68048;">${item.stock} units</strong> <small style="color: #666;">(Alert: ≤${threshold})</small>` :
        `${item.stock} units`;

    const tr = document.createElement('tr');
    tr.style.cssText = item.stock === 0 ? 'background-color: #ffebee;' : item.stock <= threshold ? 'background-color: #fff8f0;' : '';
    tr.innerHTML = `
        <td data-label="Item Name"><span class="mobile-field-label">Item Name</span><div class="field-value"><strong>${item.name}</strong></div></td>
        <td data-label="Description"><span class="mobile-field-label">Description</span><div class="field-value">${item.description || '-'}</div></td>
        <td data-label="Opening Stock"><span class="mobile-field-label">Opening Stock</span><div class="field-value">${item.openingStock || 0} units</div></td>
        <td data-label="Current Stock"><span class="mobile-field-label">Current Stock</span><div class="field-value">${stockDisplay}</div></td>
        <td data-label="Consumed"><span class="mobile-field-label">Consumed</span><div class="field-value">${consumed} units</div></td>
        <td data-label="Purchase Price (₹)"><span class="mobile-field-label">Purchase Price (₹)</span><div class="field-value">₹${formatIndianCurrency(item.purchasePrice)}</div></td>
        <td data-label="Sale Price (₹)"><span class="mobile-field-label">Sale Price (₹)</span><div class="field-value">₹${formatIndianCurrency(item.salePrice)}</div></td>
        <td data-label="Profit %"><span class="mobile-field-label">Profit %</span><div class="field-value"><span style="color: ${profitMargin >= 0 ? '#28a745' : '#c62828'}; font-weight: 600;">${profitMargin}%</span></div></td>
        <td data-label="Status"><span class="mobile-field-label">Status</span><div class="field-value"><span class="status-badge status-${stockInfo.status}" style="background-color: ${stockInfo.color}20; color: ${stockInfo.color}; border: 1px solid ${stockInfo.color};">${stockInfo.icon} ${stockInfo.label}</span></div></td>
        <td data-label="Actions">
            <span class="mobile-field-label">Actions</span>
            <div class="field-value card-actions">
            <a href="#" class="action-link view" onclick="editItem('${item.id}'); return false;">
                <span class="material-icons">edit</span> Edit
            </a>
            <a href="#" class="action-link delete" onclick="deleteItem('${item.id}'); return false;">
                <span class="material-icons">delete</span> Delete
            </a>
            </div>
        </td>
    `;
    return tr;
}

function updateInventoryLoadMoreButton() {
    const container = document.getElementById('loadMoreInventoryContainer');
    const label = document.getElementById('loadMoreInventoryLabel');
    if (!container) return;
    const remaining = allInventoryData.length - inventoryShownCount;
    if (remaining > 0) {
        container.style.display = 'block';
        label.textContent = `Load more (${remaining} remaining)`;
    } else {
        container.style.display = 'none';
    }
}

function loadMoreInventoryItems() {
    const tbody = document.getElementById('inventoryTableBody');
    if (!tbody) return;
    const nextBatch = allInventoryData.slice(inventoryShownCount, inventoryShownCount + INVENTORY_PAGE);
    nextBatch.forEach(item => tbody.appendChild(buildInventoryRow(item)));
    inventoryShownCount += nextBatch.length;
    updateInventoryLoadMoreButton();
}

// Display inventory items in table
function displayInventory(items = inventory, showAll = false) {
    const tbody = document.getElementById('inventoryTableBody');
    const isMobile = window.innerWidth <= 1024;

    // Sort: out of stock first, then low stock, then alphabetical
    const sorted = [...items].sort((a, b) => {
        const aStatus = getStockStatus(a);
        const bStatus = getStockStatus(b);
        const statusOrder = { out: 0, low: 1, ok: 2 };
        if (statusOrder[aStatus.status] !== statusOrder[bStatus.status]) {
            return statusOrder[aStatus.status] - statusOrder[bStatus.status];
        }
        return a.name.localeCompare(b.name);
    });

    tbody.innerHTML = '';

    if (sorted.length === 0) {
        tbody.innerHTML = '<tr><td colspan="10" style="text-align: center; padding: 40px;">No items found.</td></tr>';
        const container = document.getElementById('loadMoreInventoryContainer');
        if (container) container.style.display = 'none';
        return;
    }

    if (!isMobile || showAll) {
        // Desktop or search/filter: render all rows, hide Load More
        allInventoryData = sorted;
        inventoryShownCount = sorted.length;
        sorted.forEach(item => tbody.appendChild(buildInventoryRow(item)));
        const container = document.getElementById('loadMoreInventoryContainer');
        if (container) container.style.display = 'none';
    } else {
        // Mobile normal mode: paginate
        allInventoryData = sorted;
        inventoryShownCount = 0;
        const initial = sorted.slice(0, INVENTORY_INITIAL);
        initial.forEach(item => tbody.appendChild(buildInventoryRow(item)));
        inventoryShownCount = initial.length;
        updateInventoryLoadMoreButton();
    }
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
    document.getElementById('itemBarcode').value = item.barcode || '';
    document.getElementById('itemOpeningStock').value = item.openingStock || 0;
    document.getElementById('itemStock').value = item.stock;
    document.getElementById('itemPurchasePrice').value = parseFloat(item.purchasePrice || 0).toFixed(2);
    document.getElementById('itemSalePrice').value = parseFloat(item.salePrice || 0).toFixed(2);
    document.getElementById('itemLowStockThreshold').value = item.lowStockThreshold || DEFAULT_LOW_STOCK_THRESHOLD;
    updateStockConsumed();
    updateProfitMargin();
    document.getElementById('itemModal').style.display = 'flex';
}

// Close modal
function closeModal() {
    document.getElementById('itemModal').style.display = 'none';
    editingItemId = null;
}

// Update stock consumed calculation
function updateStockConsumed() {
    const openingStock = parseInt(document.getElementById('itemOpeningStock').value) || 0;
    const currentStock = parseInt(document.getElementById('itemStock').value) || 0;
    const consumed = openingStock - currentStock;
    document.getElementById('stockConsumed').value = consumed + ' units';
}

// Update profit margin calculation
function updateProfitMargin() {
    const purchasePrice = parseFloat(document.getElementById('itemPurchasePrice').value) || 0;
    const salePrice = parseFloat(document.getElementById('itemSalePrice').value) || 0;
    
    if (purchasePrice > 0) {
        const margin = ((salePrice - purchasePrice) / purchasePrice) * 100;
        document.getElementById('profitMargin').value = margin.toFixed(2) + '%';
    } else {
        document.getElementById('profitMargin').value = '0%';
    }
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
    
    const confirmed = await showDeleteConfirm(`${item.name}`);
    if (confirmed) {
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

// ==================== Inventory Filter ====================

function showInventoryFilterModal() {
    document.getElementById('inventoryFilterModal').classList.add('show');
}

function closeInventoryFilterModal() {
    document.getElementById('inventoryFilterModal').classList.remove('show');
}

function applyInventoryFilter() {
    const fromDate = document.getElementById('invFilterFromDate').value;
    const toDate = document.getElementById('invFilterToDate').value;

    if (!fromDate || !toDate) {
        alert('Please select both From and To dates');
        return;
    }

    inventoryDateFrom = fromDate;
    inventoryDateTo = toDate;

    const filtered = inventory.filter(item => {
        if (!item.createdAt) return true;
        const d = item.createdAt.split('T')[0];
        return d >= fromDate && d <= toDate;
    });

    displayInventory(filtered, true);
    closeInventoryFilterModal();

    const badge = document.getElementById('inventoryFilterBadge');
    if (badge) badge.style.display = 'inline';
}

function clearInventoryFilter() {
    document.getElementById('invFilterFromDate').value = '';
    document.getElementById('invFilterToDate').value = '';
    inventoryDateFrom = null;
    inventoryDateTo = null;
    displayInventory();
    closeInventoryFilterModal();
    const badge = document.getElementById('inventoryFilterBadge');
    if (badge) badge.style.display = 'none';
}

// ==================== Inventory PDF Export ====================

function downloadInventoryPDF() {
    if (!window.jspdf) {
        alert('PDF library not loaded. Please refresh the page.');
        return;
    }
    const { jsPDF } = window.jspdf;

    const items = inventoryDateFrom
        ? inventory.filter(item => {
            if (!item.createdAt) return true;
            const d = item.createdAt.split('T')[0];
            return d >= inventoryDateFrom && d <= inventoryDateTo;
        })
        : inventory;

    if (items.length === 0) {
        alert('No items to export');
        return;
    }

    const pdf = new jsPDF({ orientation: 'landscape' });

    // Title
    pdf.setFontSize(16);
    pdf.setFont(undefined, 'bold');
    pdf.text('Inventory Report', 148, 14, { align: 'center' });

    pdf.setFontSize(9);
    pdf.setFont(undefined, 'normal');
    const genDate = new Date().toLocaleDateString('en-IN');
    pdf.text(`Generated: ${genDate}`, 148, 21, { align: 'center' });
    if (inventoryDateFrom) {
        pdf.text(`Period: ${inventoryDateFrom} to ${inventoryDateTo}`, 148, 27, { align: 'center' });
    }

    let y = inventoryDateFrom ? 36 : 30;

    // Column definitions
    const cols = [
        { label: 'Item Name',       x: 10  },
        { label: 'Description',     x: 52  },
        { label: 'Open.Stock',      x: 94  },
        { label: 'Curr.Stock',      x: 116 },
        { label: 'Consumed',        x: 138 },
        { label: 'Pur.Price (Rs)',   x: 158 },
        { label: 'Sale Price (Rs)',  x: 185 },
        { label: 'Profit %',        x: 212 },
        { label: 'Status',          x: 233 },
    ];

    // Header bar
    pdf.setFillColor(40, 69, 214);
    pdf.rect(8, y - 5, 282, 8, 'F');
    pdf.setTextColor(255, 255, 255);
    pdf.setFont(undefined, 'bold');
    pdf.setFontSize(8);
    cols.forEach(col => pdf.text(col.label, col.x, y));
    y += 6;
    pdf.setTextColor(0, 0, 0);
    pdf.setFont(undefined, 'normal');

    items.forEach((item, i) => {
        if (y > 185) { pdf.addPage(); y = 20; }

        if (i % 2 === 0) {
            pdf.setFillColor(248, 250, 252);
            pdf.rect(8, y - 4, 282, 7, 'F');
        }

        const consumed = (item.openingStock || 0) - item.stock;
        const profitMargin = item.purchasePrice > 0
            ? (((item.salePrice - item.purchasePrice) / item.purchasePrice) * 100).toFixed(1)
            : '0';
        const stockInfo = getStockStatus(item);
        const truncate = (str, n) => str && str.length > n ? str.substring(0, n - 1) + '…' : (str || '-');

        pdf.setFontSize(7.5);
        pdf.text(truncate(item.name, 22), cols[0].x, y);
        pdf.text(truncate(item.description, 22), cols[1].x, y);
        pdf.text(`${item.openingStock || 0}`, cols[2].x, y);
        pdf.text(`${item.stock}`, cols[3].x, y);
        pdf.text(`${consumed}`, cols[4].x, y);
        pdf.text(`${formatIndianCurrency(item.purchasePrice)}`, cols[5].x, y);
        pdf.text(`${formatIndianCurrency(item.salePrice)}`, cols[6].x, y);
        pdf.text(`${profitMargin}%`, cols[7].x, y);
        pdf.text(stockInfo.label, cols[8].x, y);
        y += 7;
    });

    // Summary footer
    y += 4;
    pdf.setFont(undefined, 'bold');
    pdf.setFontSize(9);
    const totalStock = items.reduce((s, i) => s + i.stock, 0);
    const lowCount = items.filter(i => { const t = i.lowStockThreshold || 10; return i.stock > 0 && i.stock <= t; }).length;
    const outCount = items.filter(i => i.stock === 0).length;
    pdf.text(`Total Items: ${items.length}   Total Stock: ${totalStock} units   Low Stock: ${lowCount}   Out of Stock: ${outCount}`, 10, y);

    pdf.save(`Inventory_Report_${new Date().toISOString().split('T')[0]}.pdf`);
}

// ==================== Inventory Excel Export ====================

function downloadInventoryExcel() {
    if (!window.XLSX) {
        alert('Excel library not loaded. Please refresh the page.');
        return;
    }

    const items = inventoryDateFrom
        ? inventory.filter(item => {
            if (!item.createdAt) return true;
            const d = item.createdAt.split('T')[0];
            return d >= inventoryDateFrom && d <= inventoryDateTo;
        })
        : inventory;

    if (items.length === 0) {
        alert('No items to export');
        return;
    }

    const rows = items.map(item => {
        const consumed = (item.openingStock || 0) - item.stock;
        const profitMargin = item.purchasePrice > 0
            ? parseFloat((((item.salePrice - item.purchasePrice) / item.purchasePrice) * 100).toFixed(2))
            : 0;
        const stockInfo = getStockStatus(item);
        return {
            'Item Name':        item.name,
            'Description':      item.description || '',
            'Opening Stock':    item.openingStock || 0,
            'Current Stock':    item.stock,
            'Consumed':         consumed,
            'Purchase Price (₹)': item.purchasePrice,
            'Sale Price (₹)':   item.salePrice,
            'Profit %':         profitMargin,
            'Status':           stockInfo.label,
            'Added Date':       item.createdAt ? new Date(item.createdAt).toLocaleDateString('en-IN') : '-',
        };
    });

    const ws = XLSX.utils.json_to_sheet(rows);
    // Auto-fit column widths
    ws['!cols'] = Object.keys(rows[0]).map(key => ({
        wch: Math.max(key.length, ...rows.map(r => String(r[key] || '').length)) + 2
    }));

    const wb = XLSX.utils.book_new();
    XLSX.utils.book_append_sheet(wb, ws, 'Inventory');
    XLSX.writeFile(wb, `Inventory_Report_${new Date().toISOString().split('T')[0]}.xlsx`);
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
    const barcode = document.getElementById('itemBarcode').value.trim();
    const stockInput = document.getElementById('itemStock').value;
    const purchasePriceInput = document.getElementById('itemPurchasePrice').value;
    const salePriceInput = document.getElementById('itemSalePrice').value;
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
    
    const purchasePrice = parseFloat(purchasePriceInput);
    if (isNaN(purchasePrice) || purchasePrice <= 0) {
        alert('❌ Purchase price must be a positive number greater than 0');
        document.getElementById('itemPurchasePrice').focus();
        return;
    }
    
    if (purchasePrice > 9999999) {
        alert('❌ Purchase price value is too large (maximum: 9,999,999)');
        document.getElementById('itemPurchasePrice').focus();
        return;
    }
    
    const salePrice = parseFloat(salePriceInput);
    if (isNaN(salePrice) || salePrice <= 0) {
        alert('❌ Sale price must be a positive number greater than 0');
        document.getElementById('itemSalePrice').focus();
        return;
    }
    
    if (salePrice > 9999999) {
        alert('❌ Sale price value is too large (maximum: 9,999,999)');
        document.getElementById('itemSalePrice').focus();
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
    const openingStock = parseInt(document.getElementById('itemOpeningStock').value);
    
    const itemData = {
        name,
        description,
        barcode: barcode || null,
        openingStock,
        stock,
        purchasePrice,
        salePrice,
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
    
    displayInventory(filtered, true);
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
    
    // Add event listeners for stock consumed calculation
    document.getElementById('itemOpeningStock').addEventListener('input', updateStockConsumed);
    document.getElementById('itemStock').addEventListener('input', updateStockConsumed);
    
    // Add event listeners for profit margin calculation
    document.getElementById('itemPurchasePrice').addEventListener('input', updateProfitMargin);
    document.getElementById('itemSalePrice').addEventListener('input', updateProfitMargin);
    
    // Add search on enter key
    document.getElementById('searchInput').addEventListener('keypress', function(e) {
        if (e.key === 'Enter') {
            searchInventory();
        }
    });
}

// ============================================
// BARCODE SCANNER FUNCTIONALITY
// ============================================

let html5QrcodeScanner = null;
let barcodeScannerActive = false;

function openBarcodeScanner() {
    document.getElementById('barcodeScannerModal').style.display = 'flex';
    
    if (!barcodeScannerActive) {
        initializeBarcodeScanner();
    }
}

function closeBarcodeScanner() {
    document.getElementById('barcodeScannerModal').style.display = 'none';
    stopBarcodeScanner();
}

function initializeBarcodeScanner() {
    try {
        // Check if html5QrcodeScanner is available
        if (typeof Html5Qrcode === 'undefined') {
            alert('⚠️ QR code scanner library not loaded yet. Please try again.');
            return;
        }
        
        html5QrcodeScanner = new Html5Qrcode('qr-reader');
        
        const qrConfig = {
            fps: 10,
            qrbox: { width: 300, height: 300 },
            isShowTorchButtonIfSupported: true,
            disableFlip: false,
            rememberLastUsedCamera: true
        };
        
        html5QrcodeScanner.start(
            { facingMode: 'environment' },
            qrConfig,
            onBarcodeSuccess,
            onBarcodeScannerError
        ).catch(err => {
            console.error('Failed to start scanner:', err);
            alert('❌ Camera access denied or not available. Please check permissions.');
        });
        
        barcodeScannerActive = true;
    } catch (error) {
        console.error('Error initializing scanner:', error);
        alert('❌ Error initializing barcode scanner: ' + error.message);
    }
}

function stopBarcodeScanner() {
    if (html5QrcodeScanner && barcodeScannerActive) {
        html5QrcodeScanner.stop().then(() => {
            html5QrcodeScanner.clear();
            html5QrcodeScanner = null;
            barcodeScannerActive = false;
        }).catch(err => {
            console.error('Error stopping scanner:', err);
        });
    }
}

function onBarcodeSuccess(decodedText, decodedResult) {
    console.log('✅ Barcode scanned:', decodedText);
    
    // Stop scanner
    stopBarcodeScanner();
    
    // Populate barcode field
    document.getElementById('itemBarcode').value = decodedText;
    
    // Look up product by barcode in existing inventory
    const existingProduct = inventory.find(item => 
        item.barcode && item.barcode.toLowerCase() === decodedText.toLowerCase()
    );
    
    if (existingProduct) {
        // Product found - show option to update or create new
        const userChoice = confirm(
            `Product found: "${existingProduct.name}"\n\n` +
            `Current Stock: ${existingProduct.stock}\n` +
            `Sale Price: ₹${existingProduct.salePrice}\n\n` +
            `Click OK to update this product, or Cancel to add a new one.`
        );
        
        if (userChoice) {
            // Edit the existing product
            editItem(existingProduct.id);
            closeBarcodeScanner();
            return;
        }
    }
    
    // Auto-fill just the product name from barcode if available
    // For standard barcodes, we can try to extract a meaningful name
    if (!document.getElementById('itemName').value) {
        // Use barcode as a starting point
        document.getElementById('itemName').value = decodedText.substring(0, 50);
        document.getElementById('itemName').focus();
    }
    
    // Close scanner modal
    closeBarcodeScanner();
}

function onBarcodeScannerError(error) {
    // Ignore permission denied errors on repeated attempts
    if (error && error.name !== 'NotAllowedError') {
        console.warn('Barcode scanner error:', error);
    }
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
// ===== EXCEL IMPORT FUNCTIONALITY =====

let csvImportData = [];

// Download Excel template (headers only — no sample data to avoid re-importing existing items)
function downloadExcelTemplate() {
    if (!window.XLSX) {
        alert('Excel library not loaded. Please refresh the page.');
        return;
    }
    const headers = [['Item Name', 'Description', 'Opening Stock', 'Purchase Price', 'Sale Price', 'Low Stock Threshold']];
    const ws = XLSX.utils.aoa_to_sheet(headers);
    // Set column widths
    ws['!cols'] = [{ wch: 25 }, { wch: 35 }, { wch: 16 }, { wch: 18 }, { wch: 14 }, { wch: 22 }];
    const wb = XLSX.utils.book_new();
    XLSX.utils.book_append_sheet(wb, ws, 'Inventory');
    XLSX.writeFile(wb, 'inventory_template.xlsx');
    showToast('✅ Excel template downloaded successfully', 'success');
}

// Handle Excel file upload
function handleExcelUpload(event) {
    const file = event.target.files[0];
    if (!file) return;

    const ext = file.name.split('.').pop().toLowerCase();
    if (ext !== 'xlsx' && ext !== 'xls') {
        showToast('❌ Please select an Excel file (.xlsx or .xls)', 'error');
        event.target.value = '';
        return;
    }
    if (!window.XLSX) {
        showToast('❌ Excel library not loaded. Please refresh the page.', 'error');
        event.target.value = '';
        return;
    }

    const reader = new FileReader();
    reader.onload = function(e) {
        try {
            const wb = XLSX.read(e.target.result, { type: 'array' });
            const ws = wb.Sheets[wb.SheetNames[0]];
            // header:1 returns array-of-arrays; skip header row
            const rows = XLSX.utils.sheet_to_json(ws, { header: 1, defval: '' });
            if (rows.length < 2) {
                showToast('❌ Excel file is empty or has no data rows', 'error');
                return;
            }
            parseImportRows(rows.slice(1)); // skip header row
        } catch (err) {
            showToast('❌ Could not read Excel file. Please use the downloaded template.', 'error');
        }
    };
    reader.readAsArrayBuffer(file);

    // Reset file input
    event.target.value = '';
}

// Parse imported rows and validate data
function parseImportRows(dataRows) {
    csvImportData = [];
    
    let validCount = 0;
    let errorCount = 0;
    
    dataRows.forEach((row, index) => {
        // Each row is already an array from XLSX; stringify to trim strings
        const values = Array.isArray(row)
            ? row.map(v => String(v === null || v === undefined ? '' : v).trim())
            : String(row).split(',').map(v => v.trim().replace(/^"|"$/g, ''));

        // Skip completely empty rows
        if (values.every(v => v === '')) return;

        if (values.length < 6 || values.slice(0, 6).every(v => v === '')) {
            csvImportData.push({
                valid: false,
                error: 'Incomplete data (6 columns required)',
                name: values[0] || '',
                description: values[1] || '',
                openingStock: values[2] || '',
                purchasePrice: values[3] || '',
                salePrice: values[4] || '',
                lowStockThreshold: values[5] || ''
            });
            errorCount++;
            return;
        }
        
        const [name, description, openingStock, purchasePrice, salePrice, lowStockThreshold] = values;
        
        // Validation
        let error = '';
        
        if (!name || name.length < 2) {
            error = 'Item name must be at least 2 characters';
        } else if (name.length > 100) {
            error = 'Item name too long (max 100 characters)';
        } else if (!description || description.length < 2) {
            error = 'Description must be at least 2 characters';
        } else if (description.length > 200) {
            error = 'Description too long (max 200 characters)';
        } else if (isNaN(openingStock) || parseFloat(openingStock) < 0) {
            error = 'Invalid opening stock (must be >= 0)';
        } else if (isNaN(purchasePrice) || parseFloat(purchasePrice) <= 0) {
            error = 'Invalid purchase price (must be > 0)';
        } else if (isNaN(salePrice) || parseFloat(salePrice) <= 0) {
            error = 'Invalid sale price (must be > 0)';
        } else if (parseFloat(salePrice) < parseFloat(purchasePrice)) {
            error = 'Sale price must be >= purchase price';
        } else if (isNaN(lowStockThreshold) || parseFloat(lowStockThreshold) < 0) {
            error = 'Invalid low stock threshold (must be >= 0)';
        } else if (inventory.some(item => item.name.toLowerCase() === name.toLowerCase())) {
            error = 'Item already exists in inventory';
        } else if (csvImportData.some(item => item.name && item.name.toLowerCase() === name.toLowerCase())) {
            error = 'Duplicate item in CSV';
        }
        
        const isValid = error === '';
        
        csvImportData.push({
            valid: isValid,
            error: error,
            name: name,
            description: description,
            openingStock: parseFloat(openingStock),
            stock: parseFloat(openingStock), // Initial stock = opening stock
            purchasePrice: parseFloat(purchasePrice),
            salePrice: parseFloat(salePrice),
            lowStockThreshold: parseFloat(lowStockThreshold)
        });
        
        if (isValid) {
            validCount++;
        } else {
            errorCount++;
        }
    });
    
    showCSVPreview(validCount, errorCount);
}

// Show CSV preview modal
function showCSVPreview(validCount, errorCount) {
    const modal = document.getElementById('csvPreviewModal');
    const stats = document.getElementById('csvPreviewStats');
    const tbody = document.getElementById('csvPreviewTableBody');
    const importBtn = document.getElementById('csvImportBtn');
    
    document.getElementById('csvTotalRows').textContent = csvImportData.length;
    document.getElementById('csvValidRows').textContent = validCount;
    document.getElementById('csvErrorRows').textContent = errorCount;
    
    stats.style.display = 'block';
    
    tbody.innerHTML = csvImportData.map(item => {
        const statusIcon = item.valid 
            ? '<span class="material-icons" style="color: #10b981;">check_circle</span>'
            : '<span class="material-icons" style="color: #ef4444;">error</span>';
        
        const rowClass = item.valid ? '' : 'style="background-color: #fee2e2;"';
        
        return `
            <tr ${rowClass}>
                <td style="text-align: center;">${statusIcon}</td>
                <td>${escapeHtml(item.name)}</td>
                <td>${escapeHtml(item.description)}</td>
                <td>${item.openingStock}</td>
                <td>₹${formatIndianCurrency(item.purchasePrice)}</td>
                <td>₹${formatIndianCurrency(item.salePrice)}</td>
                <td>${item.lowStockThreshold}</td>
                <td style="color: #ef4444; font-size: 12px;">${item.error || '-'}</td>
            </tr>
        `;
    }).join('');
    
    importBtn.disabled = validCount === 0;
    importBtn.textContent = validCount > 0 
        ? `Import ${validCount} Valid Item${validCount !== 1 ? 's' : ''}`
        : 'No Valid Items';
    
    modal.style.display = 'flex';
}

// Close CSV preview modal
function closeCSVPreviewModal() {
    const modal = document.getElementById('csvPreviewModal');
    modal.style.display = 'none';
    csvImportData = [];
}

// Confirm and import valid items
async function confirmCSVImport() {
    const validItems = csvImportData.filter(item => item.valid);
    
    if (validItems.length === 0) {
        showToast('❌ No valid items to import', 'error');
        return;
    }
    
    const importBtn = document.getElementById('csvImportBtn');
    importBtn.disabled = true;
    importBtn.innerHTML = '<span class="material-icons">hourglass_empty</span> Importing...';
    
    let successCount = 0;
    let failCount = 0;
    
    for (const item of validItems) {
        try {
            console.log('Importing item:', item);
            const result = await supabaseAddInventoryItem(item);
            console.log('Import result:', result);
            if (result.success) {
                successCount++;
            } else {
                console.error('Failed to import:', result.error);
                failCount++;
            }
        } catch (error) {
            console.error('Error importing item:', error);
            failCount++;
        }
    }
    
    console.log(`Import complete: ${successCount} success, ${failCount} failed`);
    
    // Reload inventory first
    if (successCount > 0) {
        console.log('Reloading inventory...');
        await loadInventory();
        console.log('Inventory reloaded, current count:', inventory.length);
    }
    
    // Then close modal and show messages
    closeCSVPreviewModal();
    
    if (successCount > 0) {
        showToast(`✅ Successfully imported ${successCount} item${successCount !== 1 ? 's' : ''}`, 'success');
    }
    
    if (failCount > 0) {
        showToast(`⚠️ ${failCount} item${failCount !== 1 ? 's' : ''} failed to import`, 'error');
    }
}

// Escape HTML to prevent XSS
function escapeHtml(text) {
    const div = document.createElement('div');
    div.textContent = text;
    return div.innerHTML;
}