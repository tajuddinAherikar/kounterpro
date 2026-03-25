// Billing functionality with Supabase
let itemCounter = 1;
let inventory = [];
let customers = [];
let userProfile = null;
let editingInvoiceId = null;
let taxMode = 'with-tax'; // Track current tax mode

// Load customers from database
async function loadCustomers() {
    try {
        const result = await supabaseGetCustomers();
        if (result.success) {
            customers = result.data.map(customer => {
                // Handle both gst and gst_number field names
                const gstNumber = customer.gst_number || customer.gst || '';
                return {
                    id: customer.id,
                    name: customer.name || '',
                    mobile: customer.mobile || '',
                    email: customer.email || '',
                    address: customer.address || '',
                    gst: gstNumber
                };
            });
            console.log('✅ Customers loaded:', customers.length, 'customers', customers);
        } else {
            console.error('Failed to load customers:', result.error);
            customers = [];
        }
    } catch (error) {
        console.error('Error loading customers:', error);
        customers = [];
    }
}

// Load invoice data for editing
function loadInvoiceForEditing() {
    const editingInvoice = sessionStorage.getItem('editingInvoice');
    if (!editingInvoice) {
        return false;
    }
    
    try {
        const invoice = JSON.parse(editingInvoice);
        editingInvoiceId = invoice.id;
        
        // Store original date for later use
        sessionStorage.setItem('editingInvoiceDate', invoice.date);
        
        // Populate invoice number
        const invoiceNumberField = document.getElementById('invoiceNumber');
        if (invoiceNumberField) {
            invoiceNumberField.value = invoice.invoice_number || '';
        }
        
        // Populate invoice date
        const invoiceDateField = document.getElementById('invoiceDate');
        if (invoiceDateField && invoice.date) {
            invoiceDateField.value = invoice.date.split('T')[0]; // Extract YYYY-MM-DD part
        }
        
        // Populate customer details
        document.getElementById('customerName').value = invoice.customer_name || '';
        document.getElementById('customerSearch').value = invoice.customer_name || '';
        document.getElementById('customerMobile').value = invoice.customer_mobile || '';
        document.getElementById('customerAddress').value = invoice.customer_address || '';
        document.getElementById('customerGST').value = invoice.customer_gst || '';
        
        // Populate GST rates
        document.getElementById('sgstRate').value = (invoice.gst_rate || 18) / 2; // Assuming split
        document.getElementById('cgstRate').value = (invoice.gst_rate || 18) / 2; // Assuming split
        
        // Clear existing items and populate with invoice items
        const itemsTableBody = document.getElementById('itemsTableBody');
        itemsTableBody.innerHTML = '';
        itemCounter = 0;
        
        const items = typeof invoice.items === 'string' ? JSON.parse(invoice.items) : invoice.items;
        items.forEach((item, index) => {
            itemCounter++;
            const row = document.createElement('tr');
            row.className = 'item-row';
            row.setAttribute('data-row', itemCounter);
            
            row.innerHTML = `
                <td class="item-slno" data-label="Sl no">${itemCounter}</td>
                <td data-label="Description of Goods (start typing to search inventory)">
                    <span class="mobile-field-label">Description</span>
                    <input type="text" class="item-description" value="${escapeHtml(item.description || item.name || '')}" required>
                    <span class="error-message item-error"></span>
                </td>
                <td data-label="HSN Code">
                    <span class="mobile-field-label">HSN Code</span>
                    <input type="text" class="item-hsn" value="${escapeHtml(item.hsn_code || item.hsnCode || '')}" placeholder="Optional" maxlength="8">
                </td>
                <td data-label="Serial No(s) (Optional, one per line)">
                    <span class="mobile-field-label">Serial No(s)</span>
                    <textarea class="item-serial" rows="1" placeholder="Optional">${escapeHtml(item.serial_no || '')}</textarea>
                </td>
                <td data-label="Quantity">
                    <span class="mobile-field-label">Quantity</span>
                    <input type="number" class="item-quantity" min="1" value="${item.quantity || 1}" required>
                    <span class="error-message item-error"></span>
                </td>
                <td data-label="Rate (₹) (incl. GST)">
                    <span class="mobile-field-label">Rate (₹)</span>
                    <input type="number" class="item-rate" min="0" step="0.01" value="${parseFloat(item.rateInclGST || item.rate || 0).toFixed(2)}" required>
                    <span class="error-message item-error"></span>
                </td>
                <td class="item-amount" data-label="Amount (₹)">
                    <span class="mobile-field-label">Amount (₹)</span>
                    <span class="item-amount-value">0.00</span>
                </td>
                <td data-label="Action"><button type="button" class="btn-remove" onclick="removeItem(${itemCounter})">✕</button></td>
            `;
            
            itemsTableBody.appendChild(row);
            
            // Add event listeners to new inputs
            addItemEventListeners(row);
            addItemValidationListeners(row);
        });
        
        // Clear sessionStorage after loading (but keep the date)
        sessionStorage.removeItem('editingInvoice');
        
        // Recalculate amounts
        setTimeout(() => {
            calculateAmounts();
        }, 100);
        
        return true;
    } catch (error) {
        console.error('Error loading invoice for editing:', error);
        sessionStorage.removeItem('editingInvoice');
        sessionStorage.removeItem('editingInvoiceDate');
        return false;
    }
}

// Escape HTML special characters
function escapeHtml(unsafe) {
    return unsafe
        .replace(/&/g, "&amp;")
        .replace(/</g, "&lt;")
        .replace(/>/g, "&gt;")
        .replace(/"/g, "&quot;")
        .replace(/'/g, "&#039;");
}

// Customer autocomplete functionality
function initCustomerAutocomplete() {
    const searchInput = document.getElementById('customerSearch');
    const suggestionsDiv = document.getElementById('customerSuggestions');
    const customerNameInput = document.getElementById('customerName');
    const customerMobileInput = document.getElementById('customerMobile');
    const customerAddressInput = document.getElementById('customerAddress');
    const customerGSTInput = document.getElementById('customerGST');
    
    if (!searchInput || !suggestionsDiv) {
        console.error('❌ Autocomplete elements not found in DOM');
        return;
    }
    
    let selectedCustomer = null;
    
    searchInput.addEventListener('input', function() {
        const searchTerm = this.value.trim();
        
        if (!searchTerm || searchTerm.length === 0) {
            suggestionsDiv.style.display = 'none';
            return;
        }
        
        console.log('🔍 Search term:', searchTerm);
        console.log('📊 Total customers available:', customers.length);
        
        // Search in customers - case insensitive
        const searchLower = searchTerm.toLowerCase();
        const matches = customers.filter(customer => {
            if (!customer.name && !customer.mobile) {
                console.warn('⚠️ Customer missing name and mobile:', customer);
                return false;
            }
            
            const nameMatch = (customer.name || '').toLowerCase().includes(searchLower);
            const mobileMatch = (customer.mobile || '').includes(searchTerm); // Mobile: exact + partial match
            return nameMatch || mobileMatch;
        });
        
        console.log('📍 Matches found:', matches.length);
        if (matches.length > 0) {
            console.log('   Matched customers:', matches.map(m => `${m.name} (${m.mobile})`).join(', '));
        }
        
        if (matches.length === 0) {
            suggestionsDiv.style.display = 'none';
            return;
        }
        
        // Build suggestions HTML
        suggestionsDiv.innerHTML = matches.slice(0, 5).map(customer => {
            const address = (customer.address || '').substring(0, 40);
            const addressDisplay = address + (customer.address && customer.address.length > 40 ? '...' : '');
            return `
                <div class="autocomplete-item" data-customer-id="${customer.id}" style="cursor: pointer;">
                    <div style="font-weight: 600;">📦 ${customer.name}</div>
                    <div style="font-size: 12px; color: #666;">📱 ${customer.mobile} • ${addressDisplay}</div>
                </div>
            `;
        }).join('');
        
        suggestionsDiv.style.display = 'block';
        console.log('✅ Suggestions displayed');
        
        // Add click handlers to suggestions
        suggestionsDiv.querySelectorAll('.autocomplete-item').forEach(item => {
            item.addEventListener('click', function(e) {
                e.stopPropagation();
                const customerId = this.getAttribute('data-customer-id');
                const customer = customers.find(c => c.id === customerId);
                
                if (customer) {
                    console.log('✅ Customer selected:', customer.name, customer.mobile);
                    searchInput.value = customer.name;
                    customerNameInput.value = customer.name;
                    customerMobileInput.value = customer.mobile;
                    customerAddressInput.value = customer.address || '';
                    customerGSTInput.value = customer.gst || '';
                    selectedCustomer = customer;
                    
                    // Set selected customer ID for credit tracking
                    selectedCustomerId = customer.id;
                    
                    // Load customer balance if credit payment type is selected
                    const paymentType = document.querySelector('input[name="paymentType"]:checked')?.value;
                    if (paymentType === 'credit') {
                        loadCustomerBalance(customer.id);
                    }
                    
                    // Trigger validation on filled fields
                    setTimeout(() => {
                        validateMobileFieldRealTime();
                        validateAddressFieldRealTime();
                        if (customer.gst) validateGSTFieldRealTime();
                    }, 10);
                } else {
                    console.error('❌ Customer not found for ID:', customerId);
                }
                
                suggestionsDiv.style.display = 'none';
            });
        });
    });
    
    // Update hidden name field when search loses focus
    searchInput.addEventListener('blur', function() {
        if (!selectedCustomer || selectedCustomer.name !== this.value) {
            customerNameInput.value = this.value;
        }
    });
    
    // Close suggestions when clicking outside
    document.addEventListener('click', function(e) {
        if (searchInput && suggestionsDiv && !searchInput.contains(e.target) && !suggestionsDiv.contains(e.target)) {
            suggestionsDiv.style.display = 'none';
        }
    });
    
    console.log('✅ Autocomplete initialized');
    console.log('📊 Total customers available:', customers.length);
    if (customers.length > 0) {
        console.log('   Sample customers:', customers.slice(0, 3).map(c => `${c.name} (${c.mobile})`).join(' | '));
    }
}

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

// Load user profile for company details
async function loadUserProfile() {
    try {
        const user = await supabaseGetCurrentUser();
        if (!user) return null;
        
        const result = await supabaseGetUserProfile(user.id);
        if (result.success) {
            userProfile = result.data;
        }
        return userProfile;
    } catch (error) {
        console.error('Error loading user profile:', error);
        return null;
    }
}

// Show skeleton loaders for billing form
function showSkeletonLoaders() {
    // Add skeleton effect to first row item dropdown
    const firstSelect = document.querySelector('.item-row select');
    if (firstSelect) {
        firstSelect.disabled = true;
        firstSelect.style.opacity = '0.6';
    }
}

// Hide skeleton loaders
function hideSkeletonLoaders() {
    const firstSelect = document.querySelector('.item-row select');
    if (firstSelect) {
        firstSelect.disabled = false;
        firstSelect.style.opacity = '1';
    }
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
        } else {
            console.error('Error loading inventory:', result.error);
            alert('❌ Error loading inventory: ' + result.error);
            inventory = [];
        }
    } catch (error) {
        console.error('Error loading inventory:', error);
        alert('❌ Error loading inventory. Please refresh the page.');
        inventory = [];
    }
}

// Update stock in Supabase after sale
async function updateStockAfterSale(itemName, quantitySold) {
    try {
        const result = await supabaseUpdateStock(itemName, quantitySold);
        if (!result.success) {
            console.error('Error updating stock:', result.error);
        }
        return result.success;
    } catch (error) {
        console.error('Error updating stock:', error);
        return false;
    }
}

// Calculate item amounts and totals (Rate is GST-inclusive)
function calculateAmounts() {
    const rows = document.querySelectorAll('.item-row');
    const sgstRate = parseFloat(document.getElementById('sgstRate').value) || 0;
    const cgstRate = parseFloat(document.getElementById('cgstRate').value) || 0;
    const totalGstRate = sgstRate + cgstRate;
    
    if (taxMode === 'with-tax') {
        const gstMultiplier = 1 + (totalGstRate / 100);
        
        // Update total GST display
        document.getElementById('totalGstRate').textContent = totalGstRate.toFixed(2);
        
        let subtotalExclGST = 0;
        let grandTotal = 0;
        
        rows.forEach(row => {
            const quantity = parseFloat(row.querySelector('.item-quantity').value) || 0;
            const rateInclGST = parseFloat(row.querySelector('.item-rate').value) || 0;
            
            // Update serial number placeholder based on quantity
            const serialTextarea = row.querySelector('.item-serial');
            if (quantity > 1) {
                serialTextarea.placeholder = `Enter ${quantity} serial numbers (one per line)`;
                serialTextarea.rows = Math.min(quantity, 5); // Max 5 rows visible
            } else {
                serialTextarea.placeholder = 'Optional';
                serialTextarea.rows = 1;
            }
            
            // Calculate base rate (excluding GST from the entered rate)
            const rateExclGST = rateInclGST / gstMultiplier;
            const amountExclGST = quantity * rateExclGST;
            const amountInclGST = quantity * rateInclGST;
            
            const amountCell = row.querySelector('.item-amount');
            const amountValue = row.querySelector('.item-amount-value');
            if (amountValue) {
                amountValue.textContent = formatIndianCurrency(amountInclGST);
            } else {
                amountCell.textContent = formatIndianCurrency(amountInclGST);
            }
            subtotalExclGST += amountExclGST;
            grandTotal += amountInclGST;
        });
        
        const totalGstAmount = grandTotal - subtotalExclGST;
        const sgstAmount = subtotalExclGST * (sgstRate / 100);
        const cgstAmount = subtotalExclGST * (cgstRate / 100);
        
        document.getElementById('subtotal').textContent = `₹${formatIndianCurrency(subtotalExclGST)}`;
        document.getElementById('sgstAmount').textContent = `₹${formatIndianCurrency(sgstAmount)}`;
        document.getElementById('cgstAmount').textContent = `₹${formatIndianCurrency(cgstAmount)}`;
        document.getElementById('grandTotal').textContent = `₹${formatIndianCurrency(grandTotal)}`;
        document.getElementById('displaySgstRate').textContent = sgstRate.toFixed(2);
        document.getElementById('displayCgstRate').textContent = cgstRate.toFixed(2);
    } else {
        // Without tax mode
        let grandTotal = 0;
        
        rows.forEach(row => {
            const quantity = parseFloat(row.querySelector('.item-quantity').value) || 0;
            const rate = parseFloat(row.querySelector('.item-rate').value) || 0;
            
            // Update serial number placeholder based on quantity
            const serialTextarea = row.querySelector('.item-serial');
            if (quantity > 1) {
                serialTextarea.placeholder = `Enter ${quantity} serial numbers (one per line)`;
                serialTextarea.rows = Math.min(quantity, 5);
            } else {
                serialTextarea.placeholder = 'Optional';
                serialTextarea.rows = 1;
            }
            
            const amount = quantity * rate;
            const amountCell = row.querySelector('.item-amount');
            const amountValue = row.querySelector('.item-amount-value');
            if (amountValue) {
                amountValue.textContent = formatIndianCurrency(amount);
            } else {
                amountCell.textContent = formatIndianCurrency(amount);
            }
            grandTotal += amount;
        });
        
        document.getElementById('grandTotal').textContent = `₹${formatIndianCurrency(grandTotal)}`;
    }
    
    // Update credit calculation if partial payment is visible
    const partialSection = document.getElementById('partialPaymentSection');
    if (partialSection && partialSection.style.display !== 'none') {
        calculateCredit();
    }
}

// Update tax mode display - show/hide GST fields based on mode
function updateTaxModeDisplay() {
    const gstRatesSection = document.getElementById('gstRatesSection');
    const subtotalRow = document.getElementById('subtotalRow');
    const sgstRow = document.getElementById('sgstRow');
    const cgstRow = document.getElementById('cgstRow');
    const grandTotalLabel = document.querySelector('.grand-total span:first-child');
    
    if (taxMode === 'without-tax') {
        // Hide GST-related elements
        if (gstRatesSection) gstRatesSection.style.display = 'none';
        if (subtotalRow) subtotalRow.style.display = 'none';
        if (sgstRow) sgstRow.style.display = 'none';
        if (cgstRow) cgstRow.style.display = 'none';
        if (grandTotalLabel) grandTotalLabel.textContent = 'Total Amount:';
    } else {
        // Show GST-related elements
        if (gstRatesSection) gstRatesSection.style.display = 'flex';
        if (subtotalRow) subtotalRow.style.display = 'flex';
        if (sgstRow) sgstRow.style.display = 'flex';
        if (cgstRow) cgstRow.style.display = 'flex';
        if (grandTotalLabel) grandTotalLabel.textContent = 'Grand Total:';
    }
}

// Add new item row
function addItem() {
    itemCounter++;
    const tbody = document.getElementById('itemsTableBody');
    const newRow = document.createElement('tr');
    newRow.className = 'item-row';
    newRow.setAttribute('data-row', itemCounter);
    newRow.innerHTML = `
        <td class="item-slno" data-label="Sl no">${itemCounter}</td>
        <td data-label="Description of Goods (start typing to search inventory)">
            <span class="mobile-field-label">Description</span>
            <input type="text" class="item-description" required>
            <span class="error-message item-error"></span>
        </td>
        <td data-label="HSN Code">
            <span class="mobile-field-label">HSN Code</span>
            <input type="text" class="item-hsn" placeholder="Optional" maxlength="8">
        </td>
        <td data-label="Serial No(s) (Optional, one per line)">
            <span class="mobile-field-label">Serial No(s)</span>
            <textarea class="item-serial" rows="1" placeholder="Optional"></textarea>
        </td>
        <td data-label="Quantity">
            <span class="mobile-field-label">Quantity</span>
            <input type="number" class="item-quantity" min="1" value="1" required>
            <span class="error-message item-error"></span>
        </td>
        <td data-label="Rate (₹) (incl. GST)">
            <span class="mobile-field-label">Rate (₹)</span>
            <input type="number" class="item-rate" min="0" step="0.01" required>
            <span class="error-message item-error"></span>
        </td>
        <td class="item-amount" data-label="Amount (₹)">
            <span class="mobile-field-label">Amount (₹)</span>
            <span class="item-amount-value">0.00</span>
        </td>
        <td data-label="Action"><button type="button" class="btn-remove" onclick="removeItem(${itemCounter})">✕</button></td>
    `;
    tbody.appendChild(newRow);
    
    // Add event listeners to new inputs
    addItemEventListeners(newRow);
    addItemValidationListeners(newRow);
}

// Remove item row
function removeItem(rowNumber) {
    const rows = document.querySelectorAll('.item-row');
    if (rows.length === 1) {
        alert('❌ At least one item is required in the invoice');
        return;
    }
    
    const row = document.querySelector(`[data-row="${rowNumber}"]`);
    if (row) {
        row.remove();
        renumberRows();
        calculateAmounts();
    }
}

// Renumber rows after deletion
function renumberRows() {
    const rows = document.querySelectorAll('.item-row');
    rows.forEach((row, index) => {
        const slNoCell = row.querySelector('.item-slno') || row.querySelector('td:first-child');
        slNoCell.textContent = index + 1;
        row.setAttribute('data-row', index + 1);
        const removeBtn = row.querySelector('.btn-remove');
        removeBtn.setAttribute('onclick', `removeItem(${index + 1})`);
    });
    itemCounter = rows.length;
}

// Add event listeners to item inputs
function addItemEventListeners(row) {
    const quantityInput = row.querySelector('.item-quantity');
    const rateInput = row.querySelector('.item-rate');
    const descriptionInput = row.querySelector('.item-description');
    
    quantityInput.addEventListener('input', calculateAmounts);
    rateInput.addEventListener('input', calculateAmounts);
    
    // Setup autocomplete for description
    setupAutocomplete(descriptionInput, rateInput, quantityInput);
}

// Setup autocomplete for description field
function setupAutocomplete(input, rateInput, quantityInput) {
    let currentFocus = -1;
    
    // Create autocomplete container with fixed positioning
    const autocompleteContainer = document.createElement('div');
    autocompleteContainer.className = 'autocomplete-items';
    autocompleteContainer.style.position = 'fixed';
    document.body.appendChild(autocompleteContainer);
    
    // Function to position dropdown
    function positionDropdown() {
        const rect = input.getBoundingClientRect();
        autocompleteContainer.style.top = (rect.bottom) + 'px';
        autocompleteContainer.style.left = rect.left + 'px';
        autocompleteContainer.style.width = rect.width + 'px';
    }
    
    // Input event - show suggestions
    input.addEventListener('input', function() {
        const val = this.value.toLowerCase();
        closeAllLists();
        
        if (!val || val.length < 1) return;
        
        currentFocus = -1;
        positionDropdown();
        
        const matches = inventory.filter(item => 
            item.name.toLowerCase().includes(val) ||
            (item.description && item.description.toLowerCase().includes(val))
        );
        
        if (matches.length === 0) return;
        
        autocompleteContainer.style.display = 'block';
        
        matches.forEach(item => {
            const DEFAULT_THRESHOLD = 10;
            const threshold = item.lowStockThreshold || DEFAULT_THRESHOLD;
            let stockBadge = '';
            let stockClass = '';
            
            if (item.stock === 0) {
                stockBadge = '<span style="color: #c62828; font-weight: bold;">🔴 OUT OF STOCK</span>';
                stockClass = 'out-of-stock';
            } else if (item.stock <= threshold) {
                stockBadge = `<span style="color: #f68048; font-weight: bold;">🟡 LOW STOCK</span>`;
                stockClass = 'low-stock';
            } else {
                stockBadge = `<span style="color: #28a745;">🟢 In Stock</span>`;
                stockClass = 'in-stock';
            }
            
            const div = document.createElement('div');
            div.className = `autocomplete-item ${stockClass}`;
            div.innerHTML = `
                <strong>${item.name}</strong>
                ${item.description ? '<br><small>' + item.description + '</small>' : ''}
                <br><small>${stockBadge} | Stock: ${item.stock} units | Rate: ₹${formatIndianCurrency(item.rate)}</small>
            `;
            
            div.addEventListener('click', function() {
                if (item.stock === 0) {
                    alert(`❌ Cannot add "${item.name}" - Out of stock!\n\nPlease update inventory before creating invoice.`);
                    return;
                }
                
                input.value = item.name;
                rateInput.value = item.rate.toFixed(2);
                quantityInput.value = Math.min(1, item.stock); // Default to 1 or max stock
                
                // Show warning if low stock
                if (item.stock <= threshold) {
                    quantityInput.style.borderColor = '#f68048';
                    quantityInput.style.backgroundColor = '#fff8f0';
                } else {
                    quantityInput.style.borderColor = '';
                    quantityInput.style.backgroundColor = '';
                }
                
                calculateAmounts();
                closeAllLists();
            });
            
            autocompleteContainer.appendChild(div);
        });
    });
    
    // Keyboard navigation
    input.addEventListener('keydown', function(e) {
        const items = autocompleteContainer.getElementsByClassName('autocomplete-item');
        if (e.keyCode === 40) { // Down arrow
            currentFocus++;
            addActive(items);
            e.preventDefault();
        } else if (e.keyCode === 38) { // Up arrow
            currentFocus--;
            addActive(items);
            e.preventDefault();
        } else if (e.keyCode === 13) { // Enter
            e.preventDefault();
            if (currentFocus > -1 && items[currentFocus]) {
                items[currentFocus].click();
            }
        }
    });
    
    function addActive(items) {
        if (!items) return false;
        removeActive(items);
        if (currentFocus >= items.length) currentFocus = 0;
        if (currentFocus < 0) currentFocus = items.length - 1;
        items[currentFocus].classList.add('autocomplete-active');
    }
    
    function removeActive(items) {
        for (let i = 0; i < items.length; i++) {
            items[i].classList.remove('autocomplete-active');
        }
    }
    
    function closeAllLists() {
        autocompleteContainer.innerHTML = '';
        currentFocus = -1;
        autocompleteContainer.style.display = 'none';
    }
    
    // Reposition on scroll and resize
    window.addEventListener('scroll', () => {
        if (autocompleteContainer.innerHTML) {
            positionDropdown();
        }
    }, true);
    window.addEventListener('resize', positionDropdown);
    
    // Close on click outside
    document.addEventListener('click', function(e) {
        if (e.target !== input && !autocompleteContainer.contains(e.target)) {
            closeAllLists();
        }
    });
}

// Generate invoice number
// Generate unique invoice number from Supabase data with custom prefix support
async function generateInvoiceNumber() {
    try {
        // CHECK IF OFFLINE - if so, use temporary local number
        if (!navigator.onLine || (typeof window.PWA !== 'undefined' && !window.PWA.isOnline())) {
            console.log('⚠️ Offline - generating temporary invoice number');
            
            // Generate temporary offline invoice number
            const now = new Date();
            const timestamp = now.getTime();
            const tempNumber = `DRAFT-${timestamp}`;
            
            showToast('⚠️ Offline Mode: Using temporary invoice number. It will be updated when online.', 'warning');
            console.log('📝 Temporary invoice number:', tempNumber);
            
            return tempNumber;
        }
        
        // Get user profile to check for custom prefix
        const user = await supabaseGetCurrentUser();
        if (!user) {
            throw new Error('User not authenticated');
        }
        
        const profileResult = await supabaseGetUserProfile(user.id);
        let invoicePrefix = 'K'; // Default prefix
        let useCustomPrefix = false;
        let startingNumber = 1;
        let currentCounter = 0;
        
        if (profileResult.success && profileResult.data) {
            const profile = profileResult.data;
            if (profile.invoice_prefix) {
                invoicePrefix = profile.invoice_prefix;
                useCustomPrefix = true;
                startingNumber = profile.starting_invoice_number || 1;
                currentCounter = profile.current_invoice_counter || 0;
            }
        }
        
        // If using custom prefix, use the simple format: PREFIX-0001
        if (useCustomPrefix) {
            const nextNumber = startingNumber + currentCounter;
            const paddedNumber = String(nextNumber).padStart(4, '0');
            return `${invoicePrefix}-${paddedNumber}`;
        }
        
        // Otherwise, use the legacy format: K0001/MM/YY/YY
        const result = await supabaseGetInvoices();
        
        // Calculate financial year
        const now = new Date();
        const currentMonth = now.getMonth() + 1; // 1-12
        const currentYear = now.getFullYear();
        
        // Financial year logic: April (4) to March (3)
        let fyStartYear, fyEndYear;
        if (currentMonth >= 4) {
            // April to December: FY is current year to next year
            fyStartYear = currentYear.toString().slice(-2);
            fyEndYear = (currentYear + 1).toString().slice(-2);
        } else {
            // January to March: FY is previous year to current year
            fyStartYear = (currentYear - 1).toString().slice(-2);
            fyEndYear = currentYear.toString().slice(-2);
        }
        
        if (!result.success) {
            console.error('Error fetching invoices:', result.error);
            // Fallback to default if error
            return `K0001/${currentMonth}/${fyStartYear}/${fyEndYear}`;
        }
        
        const invoices = result.data || [];
        
        if (invoices.length === 0) {
            return `K0001/${currentMonth}/${fyStartYear}/${fyEndYear}`;
        }
        
        // Extract all invoice numbers and find the highest
        let maxNumber = 0;
        invoices.forEach(invoice => {
            const invoiceNum = invoice.invoice_number || '';
            const match = invoiceNum.match(/K(\d+)\//); // Extract number from K0001/... format
            if (match) {
                const num = parseInt(match[1]);
                if (num > maxNumber) {
                    maxNumber = num;
                }
            }
        });
        
        // Generate next number
        const nextNumber = maxNumber + 1;
        return `K${String(nextNumber).padStart(4, '0')}/${currentMonth}/${fyStartYear}/${fyEndYear}`;
        
    } catch (error) {
        console.error('Error generating invoice number:', error);
        const now = new Date();
        const currentMonth = now.getMonth() + 1;
        const currentYear = now.getFullYear();
        const fyStartYear = currentMonth >= 4 ? currentYear.toString().slice(-2) : (currentYear - 1).toString().slice(-2);
        const fyEndYear = currentMonth >= 4 ? (currentYear + 1).toString().slice(-2) : currentYear.toString().slice(-2);
        return `K0001/${currentMonth}/${fyStartYear}/${fyEndYear}`;
    }
}

// Collect form data (Rate is GST-inclusive or not based on tax mode)
async function collectFormData() {
    const customerName = document.getElementById('customerName').value.trim();
    const customerAddress = document.getElementById('customerAddress').value.trim();
    const customerMobile = document.getElementById('customerMobile').value.trim();
    const customerGST = document.getElementById('customerGST').value.trim();
    const sgstRate = parseFloat(document.getElementById('sgstRate').value) || 0;
    const cgstRate = parseFloat(document.getElementById('cgstRate').value) || 0;
    const gstRate = sgstRate + cgstRate;
    const termsConditions = document.getElementById('termsConditions').value.trim();
    
    // Validation
    if (!customerName || customerName.length < 2) {
        throw new Error('Customer name must be at least 2 characters');
    }
    
    if (customerName.length > 100) {
        throw new Error('Customer name must not exceed 100 characters');
    }
    
    if (!customerAddress || customerAddress.length < 5) {
        throw new Error('Customer address must be at least 5 characters');
    }
    
    if (customerAddress.length > 255) {
        throw new Error('Customer address must not exceed 255 characters');
    }
    
    // Validate mobile number
    if (!customerMobile) {
        throw new Error('Mobile number is required');
    }
    
    const cleanedMobile = customerMobile.replace(/[\s\-\+]/g, '');
    if (cleanedMobile.length === 10 && /^[6-9]\d{9}$/.test(cleanedMobile)) {
        // Valid 10-digit Indian mobile
    } else if (cleanedMobile.length === 12 && /^91[6-9]\d{9}$/.test(cleanedMobile)) {
        // Valid with country code
    } else {
        throw new Error('Please enter a valid 10-digit mobile number (starting with 6-9)');
    }
    
    // Validate GST if provided
    if (customerGST) {
        const gstRegex = /^[0-9]{2}[A-Z]{5}[0-9]{4}[A-Z]{1}[1-9A-Z]{1}Z[0-9A-Z]{1}$/;
        if (!gstRegex.test(customerGST.toUpperCase())) {
            throw new Error('Invalid GST format. Example: 22AAAAA0000A1Z5');
        }
    }
    
    if (taxMode === 'with-tax') {
        if (isNaN(gstRate) || gstRate < 0 || gstRate > 50) {
            throw new Error('GST rate must be between 0 and 50');
        }
    }
    
    if (!termsConditions || termsConditions.length < 10) {
        throw new Error('Terms and conditions must be at least 10 characters');
    }
    
    const items = [];
    const rows = document.querySelectorAll('.item-row');
    
    if (rows.length === 0) {
        throw new Error('At least one item is required');
    }
    
    let subtotal = 0;
    let grandTotal = 0;
    let totalUnits = 0;
    
    rows.forEach((row, index) => {
        const description = row.querySelector('.item-description').value.trim();
        const hsnCode = row.querySelector('.item-hsn').value.trim();
        const serialNo = row.querySelector('.item-serial').value.trim();
        const quantityInput = row.querySelector('.item-quantity').value;
        const rateInput = row.querySelector('.item-rate').value;
        
        // Validate item fields
        if (!description) {
            throw new Error(`Item ${index + 1}: Description is required`);
        }
        
        if (description.length > 100) {
            throw new Error(`Item ${index + 1}: Description too long (max 100 characters)`);
        }
        
        const quantity = parseFloat(quantityInput);
        if (isNaN(quantity) || quantity <= 0) {
            throw new Error(`Item ${index + 1}: Quantity must be greater than 0`);
        }
        
        if (quantity > 9999) {
            throw new Error(`Item ${index + 1}: Quantity too large (max 9999)`);
        }
        
        // Validate serial numbers if provided
        if (serialNo) {
            const serialNumbers = serialNo.split('\n').map(s => s.trim()).filter(s => s);
            if (quantity > 1 && serialNumbers.length > 0 && serialNumbers.length !== quantity) {
                throw new Error(`Item ${index + 1}: Quantity is ${quantity} but ${serialNumbers.length} serial number(s) provided. Please provide ${quantity} serial numbers (one per line) or leave empty.`);
            }
        }
        
        const rateInclGST = parseFloat(rateInput);
        if (isNaN(rateInclGST) || rateInclGST <= 0) {
            throw new Error(`Item ${index + 1}: Rate must be greater than 0`);
        }
        
        if (rateInclGST > 9999999) {
            throw new Error(`Item ${index + 1}: Rate too large`);
        }
        
        // Check stock availability
        const product = inventory.find(item => 
            item.name.toLowerCase() === description.toLowerCase()
        );
        
        if (product && product.stock < quantity) {
            throw new Error(`Insufficient stock for "${description}". Available: ${product.stock}, Required: ${quantity}`);
        }
        
        // Calculate based on tax mode
        let rateExclGST, amountExclGST, amountInclGST;
        
        if (taxMode === 'with-tax') {
            const gstMultiplier = 1 + (gstRate / 100);
            rateExclGST = rateInclGST / gstMultiplier;
            amountExclGST = quantity * rateExclGST;
            amountInclGST = quantity * rateInclGST;
        } else {
            // Without tax mode - rate is the final rate
            rateExclGST = rateInclGST;
            amountExclGST = quantity * rateInclGST;
            amountInclGST = quantity * rateInclGST;
        }
        
        items.push({
            slNo: index + 1,
            description,
            hsnCode: hsnCode || '',  // Store HSN code (empty string if not provided)
            serialNo: serialNo || '',  // Store serial number (empty string if not provided)
            quantity,
            rate: rateExclGST,  // Store the GST-exclusive rate for PDF
            rateInclGST: rateInclGST,  // Store the inclusive rate as well
            amount: amountExclGST
        });
        
        subtotal += amountExclGST;
        grandTotal += amountInclGST;
        totalUnits += quantity;
    });
    
    const gstAmount = taxMode === 'with-tax' ? (grandTotal - subtotal) : 0;
    const sgstAmount = taxMode === 'with-tax' ? (subtotal * (sgstRate / 100)) : 0;
    const cgstAmount = taxMode === 'with-tax' ? (subtotal * (cgstRate / 100)) : 0;
    
    // Get invoice number from field (may have been manually edited)
    const invoiceNumberField = document.getElementById('invoiceNumber');
    const invoiceNumber = invoiceNumberField ? invoiceNumberField.value.trim() : await generateInvoiceNumber();
    
    if (!invoiceNumber) {
        throw new Error('Invoice number is required');
    }
    
    // For editing, use the original invoice date. For creating, use date from form field
    let dateString;
    const invoiceDateField = document.getElementById('invoiceDate');
    
    if (invoiceDateField && invoiceDateField.value) {
        // Use date from the form field
        dateString = invoiceDateField.value;
    } else if (editingInvoiceId) {
        // Use the original invoice date for editing
        const editingDateFromSession = sessionStorage.getItem('editingInvoiceDate');
        if (editingDateFromSession) {
            dateString = editingDateFromSession.split('T')[0]; // Extract YYYY-MM-DD part
        } else {
            // Fallback to today
            const now = new Date();
            const year = now.getFullYear();
            const month = String(now.getMonth() + 1).padStart(2, '0');
            const day = String(now.getDate()).padStart(2, '0');
            dateString = `${year}-${month}-${day}`;
        }
    } else {
        // Default to today for new invoices if no date selected
        const now = new Date();
        const year = now.getFullYear();
        const month = String(now.getMonth() + 1).padStart(2, '0');
        const day = String(now.getDate()).padStart(2, '0');
        dateString = `${year}-${month}-${day}`;
    }
    
    // Clean up session storage
    if (editingInvoiceId) {
        sessionStorage.removeItem('editingInvoiceDate');
    }
    
    return {
        invoiceNo: invoiceNumber,
        invoiceNumber: invoiceNumber, // For Supabase compatibility
        date: dateString,
        customerName,
        customerAddress,
        customerMobile,
        mobile: customerMobile, // Add alias for Supabase
        address: customerAddress, // Add alias for Supabase
        customerGST,
        gstNumber: customerGST, // Add alias for Supabase
        items,
        taxMode: taxMode, // Store tax mode
        gstRate: taxMode === 'with-tax' ? gstRate : 0,
        sgstRate: taxMode === 'with-tax' ? sgstRate : 0,
        cgstRate: taxMode === 'with-tax' ? cgstRate : 0,
        subtotal: taxMode === 'with-tax' ? subtotal : 0,
        gstAmount: taxMode === 'with-tax' ? gstAmount : 0,
        sgstAmount: taxMode === 'with-tax' ? sgstAmount : 0,
        cgstAmount: taxMode === 'with-tax' ? cgstAmount : 0,
        grandTotal: taxMode === 'with-tax' ? grandTotal : subtotal,
        totalAmount: taxMode === 'with-tax' ? grandTotal : subtotal, // Add alias for Supabase
        totalUnits,
        termsConditions,
        // Credit payment fields
        paymentType: document.querySelector('input[name="paymentType"]:checked')?.value || 'cash',
        customerId: selectedCustomerId || findCustomerId(customerName, customerMobile),
        amountPaid: document.getElementById('partialPaymentCheckbox')?.checked 
            ? (parseFloat(document.getElementById('amountPaid')?.value) || 0)
            : undefined
    };
}

// Generate PDF using jsPDF with customizable templates
async function generatePDF(invoiceData) {
    try {
        // Get user's template settings from profile
        const templateType = userProfile?.invoice_template || 'classic';
        const settings = {
            brand_color: userProfile?.brand_color || '#2845D6',
            logo_url: userProfile?.logo_url || null,
            show_logo: userProfile?.show_logo !== false,
            logo_position: userProfile?.logo_position || 'left'
        };
        
        console.log('Generating PDF with settings:', settings);
        console.log('User profile:', userProfile);
        
        // Use the template renderer
        const pdf = await renderInvoiceTemplate(templateType, invoiceData, userProfile, settings);
        
        // Save PDF
        const fileName = `Invoice_${invoiceData.invoiceNo.replace(/\//g, '_')}.pdf`;
        pdf.save(fileName);
        
        console.log(`✅ PDF generated successfully with ${templateType} template`);
    } catch (error) {
        console.error('Error generating PDF:', error);
        // Fallback to classic template if there's an error
        try {
            console.log('Falling back to classic template...');
            const { jsPDF } = window.jspdf;
            const pdf = new jsPDF();
            await renderClassicTemplate(pdf, invoiceData, userProfile, { brand_color: '#2845D6' });
            pdf.save(`Invoice_${invoiceData.invoiceNo.replace(/\//g, '_')}.pdf`);
        } catch (fallbackError) {
            console.error('Fallback PDF generation also failed:', fallbackError);
            alert('Failed to generate PDF. Please try again.');
        }
    }
}

// Format invoice data for WhatsApp message
function formatWhatsAppMessage(invoiceData) {
    const companyName = userProfile?.business_name || 'KEEN BATTERIES';
    let message = `*${companyName.toUpperCase()}*\n`;
    message += `Tax Invoice\n\n`;
    message += `📄 *Invoice No:* ${invoiceData.invoiceNo}\n`;
    message += `📅 *Date:* ${formatDateForPDF(invoiceData.date)}\n\n`;
    
    message += `*Bill To:*\n`;
    message += `${invoiceData.customerName}\n`;
    message += `${invoiceData.customerAddress}\n`;
    if (invoiceData.customerGST) {
        message += `GST: ${invoiceData.customerGST}\n`;
    }
    message += `\n`;
    
    message += `*Items:*\n`;
    message += `━━━━━━━━━━━━━━━━━━\n`;
    
    invoiceData.items.forEach(item => {
        message += `${item.description}\n`;
        message += `  Qty: ${item.quantity} × ₹${formatIndianCurrency(item.rateInclGST)} = ₹${formatIndianCurrency(item.quantity * item.rateInclGST)}\n`;
    });
    
    message += `━━━━━━━━━━━━━━━━━━\n\n`;
    message += `*Subtotal:* ₹${formatIndianCurrency(invoiceData.subtotal)}\n`;
    message += `*GST (${invoiceData.gstRate}%):* ₹${formatIndianCurrency(invoiceData.gstAmount)}\n`;
    message += `*Grand Total:* ₹${formatIndianCurrency(invoiceData.grandTotal)}\n\n`;
    
    message += `📄 *PDF Invoice attached*\n`;
    message += `Please see the attached PDF document for the complete tax invoice.\n\n`;
    
    message += `Thank you for your business! 🙏\n\n`;
    message += `_This is a computer generated invoice._`;
    
    return encodeURIComponent(message);
}

// Send invoice via WhatsApp
function sendViaWhatsApp(invoiceData) {
    const mobileNumber = invoiceData.customerMobile.replace(/\D/g, '');
    const countryCode = '91'; // India country code, change if needed
    const message = formatWhatsAppMessage(invoiceData);
    
    // Show instructions for attaching PDF
    alert('📎 Important: After WhatsApp opens, manually attach the downloaded PDF invoice before sending the message.\n\nThe PDF file has been downloaded to your device.');
    
    const whatsappUrl = `https://wa.me/${countryCode}${mobileNumber}?text=${message}`;
    window.open(whatsappUrl, '_blank');
}

// Close WhatsApp modal
function closeWhatsappModal() {
    document.getElementById('whatsappModal').style.display = 'none';
    window.location.href = 'index.html';
}

// Format date for PDF
function formatDateForPDF(dateString) {
    // Check if it's a simple date string (YYYY-MM-DD)
    if (dateString && dateString.length === 10 && !dateString.includes('T')) {
        const [year, month, day] = dateString.split('-');
        return `${day}/${month}/${year}`;
    }
    // Otherwise treat as timestamp
    const date = new Date(dateString);
    const day = String(date.getDate()).padStart(2, '0');
    const month = String(date.getMonth() + 1).padStart(2, '0');
    const year = date.getFullYear();
    return `${day}/${month}/${year}`;
}

// Save customer if they don't already exist in the database
async function saveCustomerIfNew(invoiceData) {
    try {
        // Check if customer already exists by searching in the customers array
        const existingCustomer = customers.find(c => 
            c.mobile === invoiceData.customerMobile ||
            (c.name.toLowerCase() === invoiceData.customerName.toLowerCase() && c.mobile)
        );
        
        // If customer already exists, don't add duplicate
        if (existingCustomer) {
            console.log('Customer already exists:', existingCustomer.name);
            return { success: true, isNew: false };
        }
        
        // Customer is new, add to database
        const newCustomer = {
            name: invoiceData.customerName,
            mobile: invoiceData.customerMobile,
            address: invoiceData.customerAddress,
            gst: invoiceData.customerGST || '',
            email: '' // Email not captured in invoice form
        };
        
        const result = await supabaseAddCustomer(newCustomer);
        
        if (result.success) {
            // Add to local customers array to avoid duplicate adds
            customers.push({
                id: result.data.id,
                name: newCustomer.name,
                mobile: newCustomer.mobile,
                address: newCustomer.address,
                gst: newCustomer.gst,
                email: newCustomer.email
            });
            
            console.log('✅ New customer saved:', newCustomer.name);
            return { success: true, isNew: true, customer: result.data };
        } else {
            // Log error but don't fail the invoice creation
            console.error('Failed to save customer:', result.error);
            return { success: false, error: result.error, isNew: false };
        }
    } catch (error) {
        // Log error but don't fail the invoice creation
        console.error('Error saving customer:', error);
        return { success: false, error: error.message, isNew: false };
    }
}

// Save invoice to Supabase (or IndexedDB if offline) and update inventory
async function saveInvoice(invoiceData) {
    // Check offline status
    const isOffline = !navigator.onLine || (typeof window.PWA !== 'undefined' && !window.PWA.isOnline());

    if (isOffline) {
        // OFFLINE MODE: Save to IndexedDB
        console.log('📵 Offline mode - saving invoice locally...');
        return await saveInvoiceOffline(invoiceData);
    }

    // ONLINE MODE: Normal save to Supabase
    if (editingInvoiceId) {
        // Update existing invoice
        const result = await supabaseUpdateInvoice(editingInvoiceId, invoiceData);
        
        if (result.success) {
            return true;
        } else {
            console.error('Error updating invoice:', result.error);
            alert('❌ Error updating invoice: ' + result.error);
            return false;
        }
    } else {
        // Create new invoice - automatically save customer if they're new
        const customerResult = await saveCustomerIfNew(invoiceData);
        if (customerResult.isNew) {
            console.log('💾 New customer automatically saved to database');
        }
        
        const result = await supabaseAddInvoice(invoiceData);
        
        if (result.success) {
            // Deduct stock from inventory for new invoices
            await deductStock(invoiceData.items);
            
            // Increment invoice counter for custom prefix users
            await incrementInvoiceCounter();
            
            return true;
        } else {
            console.error('Error saving invoice:', result.error);
            alert('❌ Error saving invoice: ' + result.error);
            return false;
        }
    }
}

/** Save invoice to IndexedDB when offline */
async function saveInvoiceOffline(invoiceData) {
    try {
        // Get current user
        const user = await supabaseGetCurrentUser();
        if (!user) {
            showToast('❌ Error: Not authenticated', 'error');
            return false;
        }

        // Handle offline inventory deduction
        if (typeof handleInventoryDeductionOffline !== 'undefined') {
            const inventoryCheck = await handleInventoryDeductionOffline(invoiceData.items || []);
            if (!inventoryCheck.success && inventoryCheck.reason === 'insufficient_stock') {
                showToast('⚠️ Invoice not saved - insufficient stock', 'warning');
                return false;
            }
        }

        // Prepare invoice metadata
        const invoice = {
            ...invoiceData,
            user_id: user.id,
            created_at: new Date().toISOString(),
            sync_status: 'pending',
            local_created: true
        };

        // Save to IndexedDB
        if (typeof db !== 'undefined' && db) {
            const invoiceId = await saveInvoiceToIndexedDB(invoice, invoiceData.items || []);
            
            if (invoiceId) {
                showToast('💾 Invoice saved locally - will sync when online', 'success');
                console.log('✅ Invoice saved to IndexedDB with ID:', invoiceId);
                
                // Try to deduct stock (already attempted in handleInventoryDeductionOffline)
                // This is for non-inventory-enabled apps
                if (typeof handleInventoryDeductionOffline === 'undefined') {
                    await deductStock(invoiceData.items);
                }
                
                return true;
            }
        }

        showToast('⚠️ Could not save invoice locally', 'warning');
        return false;

    } catch (error) {
        console.error('❌ Error saving invoice offline:', error);
        showToast('❌ Error saving invoice locally', 'error');
        return false;
    }
}

// Increment invoice counter after successful invoice creation
async function incrementInvoiceCounter() {
    try {
        const user = await supabaseGetCurrentUser();
        if (!user) return;
        
        const profileResult = await supabaseGetUserProfile(user.id);
        if (profileResult.success && profileResult.data) {
            const profile = profileResult.data;
            // Only increment if user has a custom prefix
            if (profile.invoice_prefix) {
                const newCounter = (profile.current_invoice_counter || 0) + 1;
                await supabaseUpdateUserProfile(user.id, {
                    current_invoice_counter: newCounter
                });
                console.log('✅ Invoice counter incremented to:', newCounter);
            }
        }
    } catch (error) {
        console.error('Error incrementing invoice counter:', error);
        // Don't throw error - this shouldn't block invoice creation
    }
}

// Deduct stock from inventory in Supabase
async function deductStock(soldItems) {
    for (const soldItem of soldItems) {
        // Update stock in Supabase
        await updateStockAfterSale(soldItem.description, soldItem.quantity);
    }
}

// Store saved invoice data globally
let savedInvoiceData = null;

// Handle form submission - Save invoice first
async function handleFormSubmit(e) {
    e.preventDefault();
    
    // Check if already saved and now generating PDF
    if (savedInvoiceData) {
        await generateAndShowPDF(savedInvoiceData);
        return;
    }
    
    // Create loading overlay if it doesn't exist
    let loadingOverlay = document.getElementById('loadingOverlay');
    if (!loadingOverlay) {
        loadingOverlay = document.createElement('div');
        loadingOverlay.id = 'loadingOverlay';
        loadingOverlay.innerHTML = `
            <div class="loading-content">
                <div class="spinner"></div>
                <p id="loadingMessage">Saving invoice...</p>
            </div>
        `;
        document.body.appendChild(loadingOverlay);
    }
    
    // Update message based on mode
    const loadingMessage = document.getElementById('loadingMessage');
    const actionText = editingInvoiceId ? 'Updating invoice...' : 'Saving invoice...';
    if (loadingMessage) loadingMessage.textContent = actionText;
    
    // Show loading
    loadingOverlay.style.display = 'flex';
    
    try {
        const invoiceData = await collectFormData();
        
        // Validate items
        if (invoiceData.items.length === 0) {
            throw new Error('Please add at least one item');
        }
        
        // Save to Supabase FIRST
        const saved = await saveInvoice(invoiceData);
        
        // Hide loading
        loadingOverlay.style.display = 'none';
        
        if (saved) {
            // Store invoice data
            savedInvoiceData = invoiceData;
            
            // Disable form inputs
            disableFormInputs();
            
            // Change button to Generate PDF
            const submitBtn = document.getElementById('submitBtn');
            submitBtn.innerHTML = '<span class="material-icons">picture_as_pdf</span> Generate Invoice PDF';
            submitBtn.classList.add('btn-success');
            
            // Show success message
            const successMsg = editingInvoiceId ? '✅ Invoice updated successfully!' : '✅ Invoice saved successfully!';
            alert(successMsg + ' Click "Generate Invoice PDF" to create the PDF document.');
        }
    } catch (error) {
        // Hide loading
        loadingOverlay.style.display = 'none';
        
        console.error('Error saving invoice:', error);
        alert('❌ ' + error.message);
    }
}

// Disable form inputs after saving
function disableFormInputs() {
    const form = document.getElementById('invoiceForm');
    const inputs = form.querySelectorAll('input, textarea, button:not(#submitBtn)');
    inputs.forEach(input => {
        input.disabled = true;
        input.style.opacity = '0.6';
    });
    
    // Disable add/remove item buttons
    const addItemBtn = document.getElementById('addItemBtn');
    if (addItemBtn) addItemBtn.disabled = true;
    
    const removeButtons = document.querySelectorAll('.btn-remove');
    removeButtons.forEach(btn => btn.disabled = true);
}

// Generate PDF and show WhatsApp modal
async function generateAndShowPDF(invoiceData) {
    // Create loading overlay if it doesn't exist
    let loadingOverlay = document.getElementById('loadingOverlay');
    if (!loadingOverlay) {
        loadingOverlay = document.createElement('div');
        loadingOverlay.id = 'loadingOverlay';
        loadingOverlay.innerHTML = `
            <div class="loading-content">
                <div class="spinner"></div>
                <p id="loadingMessage">Generating PDF...</p>
            </div>
        `;
        document.body.appendChild(loadingOverlay);
    }
    
    // Update message
    const loadingMessage = document.getElementById('loadingMessage');
    if (loadingMessage) loadingMessage.textContent = 'Generating PDF...';
    
    // Show loading
    loadingOverlay.style.display = 'flex';
    
    try {
        // Generate PDF
        generatePDF(invoiceData);
        
        // Hide loading after a short delay (to let PDF generation complete)
        setTimeout(() => {
            loadingOverlay.style.display = 'none';
            
            // Show WhatsApp modal
            document.getElementById('modalInvoiceNo').textContent = invoiceData.invoiceNumber;
            document.getElementById('whatsappModal').style.display = 'flex';
            
            // Setup WhatsApp button
            document.getElementById('sendWhatsappBtn').onclick = () => {
                sendViaWhatsApp(invoiceData);
            };
        }, 500);
    } catch (error) {
        // Hide loading
        loadingOverlay.style.display = 'none';
        
        console.error('Error generating PDF:', error);
        alert('❌ Error generating PDF: ' + error.message);
    }
}

// ===== REAL-TIME FORM VALIDATION =====

/**
 * Validate customer mobile number and show inline error
 */
function validateMobileFieldRealTime() {
    const mobile = document.getElementById('customerMobile').value.trim();
    const errorEl = document.getElementById('mobileError');
    const inputEl = document.getElementById('customerMobile');
    
    if (!mobile) {
        errorEl.textContent = 'Mobile number is required';
        inputEl.classList.add('field-error');
        return false;
    }
    
    const cleaned = mobile.replace(/[\s\-\+]/g, '');
    
    if (!/^[6-9]\d{9}$/.test(cleaned) && cleaned.length > 0) {
        // Only show error if they've typed something that's not valid
        if (cleaned.length < 10) {
            errorEl.textContent = `Need ${10 - cleaned.length} more digit(s)`;
        } else {
            errorEl.textContent = 'Must start with 6-9 followed by 9 digits';
        }
        inputEl.classList.add('field-error');
        return false;
    }
    
    if (/^[6-9]\d{9}$/.test(cleaned)) {
        errorEl.textContent = '';
        inputEl.classList.remove('field-error');
        inputEl.classList.add('field-valid');
        return true;
    }
    
    errorEl.textContent = '';
    inputEl.classList.remove('field-error', 'field-valid');
    return false;
}

/**
 * Validate customer address and show inline error + char count
 */
function validateAddressFieldRealTime() {
    const address = document.getElementById('customerAddress').value;
    const errorEl = document.getElementById('addressError');
    const charCountEl = document.getElementById('addressCharCount');
    const inputEl = document.getElementById('customerAddress');
    
    charCountEl.textContent = `${address.length}/255`;
    
    if (!address.trim()) {
        errorEl.textContent = 'Address is required';
        inputEl.classList.add('field-error');
        return false;
    }
    
    if (address.length < 5) {
        errorEl.textContent = `Need ${5 - address.length} more character(s)`;
        inputEl.classList.add('field-error');
        return false;
    }
    
    if (address.length > 255) {
        errorEl.textContent = 'Address is too long (max 255 characters)';
        inputEl.classList.add('field-error');
        return false;
    }
    
    errorEl.textContent = '';
    inputEl.classList.remove('field-error');
    inputEl.classList.add('field-valid');
    return true;
}

/**
 * Validate GST number format and show inline error
 */
function validateGSTFieldRealTime() {
    const gst = document.getElementById('customerGST').value.trim().toUpperCase();
    const errorEl = document.getElementById('gstError');
    const inputEl = document.getElementById('customerGST');
    
    if (!gst) {
        // GST is optional
        errorEl.textContent = '';
        inputEl.classList.remove('field-error', 'field-valid');
        return true;
    }
    
    // GST format: 2 digits + 5 letters + 4 digits + 1 letter + 1 alphanumeric + Z + 1 alphanumeric
    const gstRegex = /^[0-9]{2}[A-Z]{5}[0-9]{4}[A-Z]{1}[1-9A-Z]{1}Z[0-9A-Z]{1}$/;
    
    if (!gstRegex.test(gst)) {
        if (gst.length < 15) {
            errorEl.textContent = `GST format: ${gst.length}/15 chars. Example: 22AAAAA0000A1Z5`;
        } else {
            errorEl.textContent = 'Invalid GST format. Example: 22AAAAA0000A1Z5';
        }
        inputEl.classList.add('field-error');
        return false;
    }
    
    errorEl.textContent = '';
    inputEl.classList.remove('field-error');
    inputEl.classList.add('field-valid');
    return true;
}

/**
 * Validate item quantity and show inline error
 */
function validateItemQuantity(quantityInput) {
    const quantity = parseFloat(quantityInput.value);
    const row = quantityInput.closest('.item-row');
    
    if (!row) return true;
    
    const errorEl = row.querySelector('.item-error') || document.createElement('span');
    
    if (!errorEl.parentElement || errorEl.parentElement !== quantityInput.parentElement) {
        errorEl.className = 'error-message item-error';
        quantityInput.parentElement.appendChild(errorEl);
    }
    
    if (isNaN(quantity) || quantity <= 0) {
        errorEl.textContent = 'Qty must be > 0';
        errorEl.classList.add('show');
        quantityInput.classList.add('field-error');
        return false;
    }
    
    if (quantity > 9999) {
        errorEl.textContent = 'Qty too large (max 9999)';
        errorEl.classList.add('show');
        quantityInput.classList.add('field-error');
        return false;
    }
    
    errorEl.textContent = '';
    errorEl.classList.remove('show');
    quantityInput.classList.remove('field-error');
    return true;
}

/**
 * Validate item rate and show inline error
 */
function validateItemRate(rateInput) {
    const rate = parseFloat(rateInput.value);
    const row = rateInput.closest('.item-row');
    
    if (!row) return true;
    
    const errorEl = row.querySelector('.item-error') || document.createElement('span');
    
    if (!errorEl.parentElement || errorEl.parentElement !== rateInput.parentElement) {
        errorEl.className = 'error-message item-error';
        rateInput.parentElement.appendChild(errorEl);
    }
    
    if (isNaN(rate) || rate < 0) {
        errorEl.textContent = 'Rate must be positive';
        errorEl.classList.add('show');
        rateInput.classList.add('field-error');
        return false;
    }
    
    errorEl.textContent = '';
    errorEl.classList.remove('show');
    rateInput.classList.remove('field-error');
    return true;
}

/**
 * Validate terms and conditions length
 */
function validateTermsFieldRealTime() {
    const terms = document.getElementById('termsConditions').value;
    const errorEl = document.getElementById('termsError');
    const charCountEl = document.getElementById('termsCharCount');
    const inputEl = document.getElementById('termsConditions');
    
    charCountEl.textContent = `${terms.length}/1000`;
    
    if (!terms.trim()) {
        errorEl.textContent = 'Terms and conditions are required';
        inputEl.classList.add('field-error');
        return false;
    }
    
    if (terms.length < 10) {
        errorEl.textContent = `Need ${10 - terms.length} more character(s)`;
        inputEl.classList.add('field-error');
        return false;
    }
    
    if (terms.length > 1000) {
        errorEl.textContent = 'Terms are too long (max 1000 characters)';
        inputEl.classList.add('field-error');
        return false;
    }
    
    errorEl.textContent = '';
    inputEl.classList.remove('field-error');
    inputEl.classList.add('field-valid');
    return true;
}

/**
 * Initialize real-time validation for form fields
 */
function setupRealtimeValidation() {
    // Mobile validation
    const mobileInput = document.getElementById('customerMobile');
    if (mobileInput) {
        mobileInput.addEventListener('input', validateMobileFieldRealTime);
        mobileInput.addEventListener('blur', validateMobileFieldRealTime);
    }
    
    // Address validation
    const addressInput = document.getElementById('customerAddress');
    if (addressInput) {
        addressInput.addEventListener('input', validateAddressFieldRealTime);
        addressInput.addEventListener('blur', validateAddressFieldRealTime);
    }
    
    // GST validation
    const gstInput = document.getElementById('customerGST');
    if (gstInput) {
        gstInput.addEventListener('input', validateGSTFieldRealTime);
        gstInput.addEventListener('blur', validateGSTFieldRealTime);
    }
    
    // Terms validation
    const termsInput = document.getElementById('termsConditions');
    if (termsInput) {
        termsInput.addEventListener('input', validateTermsFieldRealTime);
        termsInput.addEventListener('blur', validateTermsFieldRealTime);
    }
}

/**
 * Add real-time validation listeners to item rows
 */
function addItemValidationListeners(row) {
    const quantityInput = row.querySelector('.item-quantity');
    const rateInput = row.querySelector('.item-rate');
    
    if (quantityInput) {
        quantityInput.addEventListener('input', () => validateItemQuantity(quantityInput));
        quantityInput.addEventListener('blur', () => validateItemQuantity(quantityInput));
    }
    
    if (rateInput) {
        rateInput.addEventListener('input', () => validateItemRate(rateInput));
        rateInput.addEventListener('blur', () => validateItemRate(rateInput));
    }
}

// ===== END REAL-TIME VALIDATION =====

// Setup invoice number edit functionality
function setupInvoiceNumberEdit() {
    const invoiceNumberField = document.getElementById('invoiceNumber');
    const editBtn = document.getElementById('editInvoiceNumberBtn');
    const errorSpan = document.getElementById('invoiceNumberError');
    
    if (!invoiceNumberField || !editBtn) return;
    
    editBtn.addEventListener('click', function() {
        if (invoiceNumberField.hasAttribute('readonly')) {
            // Enable editing
            invoiceNumberField.removeAttribute('readonly');
            invoiceNumberField.focus();
            invoiceNumberField.select();
            editBtn.innerHTML = '<span class="material-icons">save</span> Save';
            editBtn.style.background = '#4CAF50';
            editBtn.style.borderColor = '#4CAF50';
            editBtn.style.color = 'white';
        } else {
            // Save and validate
            validateInvoiceNumber();
        }
    });
    
    // Validate on blur
    invoiceNumberField.addEventListener('blur', function() {
        if (!invoiceNumberField.hasAttribute('readonly')) {
            validateInvoiceNumber();
        }
    });
}

// Validate invoice number for duplicates
async function validateInvoiceNumber() {
    const invoiceNumberField = document.getElementById('invoiceNumber');
    const editBtn = document.getElementById('editInvoiceNumberBtn');
    const errorSpan = document.getElementById('invoiceNumberError');
    const invoiceNumber = invoiceNumberField.value.trim();
    
    if (!invoiceNumber) {
        errorSpan.textContent = '❌ Invoice number is required';
        errorSpan.style.display = 'block';
        return false;
    }
    
    // Check for duplicates
    try {
        const result = await supabaseGetInvoices();
        if (result.success && result.data) {
            const duplicate = result.data.find(inv => 
                inv.invoice_number === invoiceNumber && 
                inv.id !== editingInvoiceId
            );
            
            if (duplicate) {
                errorSpan.textContent = '❌ This invoice number already exists. Please use a different number.';
                errorSpan.style.display = 'block';
                invoiceNumberField.focus();
                return false;
            }
        }
        
        // No duplicate found - lock the field
        invoiceNumberField.setAttribute('readonly', 'readonly');
        editBtn.innerHTML = '<span class="material-icons">edit</span> Edit';
        editBtn.style.background = '';
        editBtn.style.borderColor = '';
        editBtn.style.color = '';
        errorSpan.style.display = 'none';
        return true;
    } catch (error) {
        console.error('Error validating invoice number:', error);
        errorSpan.textContent = '❌ Error validating invoice number';
        errorSpan.style.display = 'block';
        return false;
    }
}

// Initialize form
async function initForm() {
    // Check if in edit mode
    const urlParams = new URLSearchParams(window.location.search);
    const isEditMode = urlParams.get('mode') === 'edit';
    
    // Update page title and button if in edit mode
    if (isEditMode) {
        // Update page titles
        const pageTitle = document.querySelector('.page-title');
        if (pageTitle) pageTitle.textContent = 'Edit Invoice';
        
        const pageSubtitle = document.querySelector('.page-subtitle');
        if (pageSubtitle) pageSubtitle.textContent = 'Modify the invoice details below';
        
        const mobileTitle = document.querySelector('.mobile-header-title');
        if (mobileTitle) mobileTitle.textContent = 'Edit Invoice';
        
        // Update submit button text
        const submitBtn = document.getElementById('submitBtn');
        if (submitBtn) submitBtn.innerHTML = '<span class="material-icons">save</span> Update Invoice';
    }
    
    // Setup tax mode toggle
    const taxModeRadios = document.querySelectorAll('input[name="taxMode"]');
    taxModeRadios.forEach(radio => {
        radio.addEventListener('change', (e) => {
            taxMode = e.target.value;
            updateTaxModeDisplay();
            calculateAmounts();
        });
    });
    
    updateTaxModeDisplay();
    
    // Load user profile and inventory data
    await loadUserProfile();
    await loadInventory();
    
    // Generate and populate invoice number (unless in edit mode)
    if (!isEditMode) {
        const invoiceNumberField = document.getElementById('invoiceNumber');
        if (invoiceNumberField) {
            invoiceNumberField.value = 'Generating...';
            const generatedNumber = await generateInvoiceNumber();
            invoiceNumberField.value = generatedNumber;
        }
        
        // Set default date to today
        const invoiceDateField = document.getElementById('invoiceDate');
        if (invoiceDateField) {
            const today = new Date();
            const year = today.getFullYear();
            const month = String(today.getMonth() + 1).padStart(2, '0');
            const day = String(today.getDate()).padStart(2, '0');
            invoiceDateField.value = `${year}-${month}-${day}`;
        }
    }
    
    // Setup invoice number edit functionality
    setupInvoiceNumberEdit();
    
    // Load terms and conditions from profile (or use default)
    const defaultTerms = `1. Payment should be made on delivery.
2. Goods once sold will not be taken back or exchanged.
3. Warranty on all peripherals/parts is as per manufacturer's policy and shall be got done no claim will be entertained by the firm for any loss arising from damage, shortage & or non-delivery of the goods afterwards.
4. Our responsibility ceases the moment goods leave our premises.
5. No claim will be entertained by the firm for any loss arising from damage, shortage & or non-delivery of the goods afterwards.`;
    
    const termsTextarea = document.getElementById('termsConditions');
    if (userProfile && userProfile.terms_conditions) {
        termsTextarea.value = userProfile.terms_conditions;
    } else {
        termsTextarea.value = defaultTerms;
    }
    
    // Load customers for autocomplete
    await loadCustomers();
    initCustomerAutocomplete();
    
    // Load invoice data if in edit mode
    if (isEditMode) {
        const loaded = loadInvoiceForEditing();
        if (!loaded) {
            alert('❌ Error loading invoice for editing. Redirecting to dashboard...');
            window.location.href = 'index.html';
            return;
        }
    }
    
    // Add event listeners to initial row
    const initialRow = document.querySelector('.item-row');
    if (initialRow) {
        addItemEventListeners(initialRow);
    }
    
    // Add event listeners to SGST and CGST rates
    document.getElementById('sgstRate').addEventListener('input', calculateAmounts);
    document.getElementById('cgstRate').addEventListener('input', calculateAmounts);
    
    // Setup real-time validation for form fields
    setupRealtimeValidation();
    
    // Add validation to initial item row
    if (initialRow) {
        addItemValidationListeners(initialRow);
    }
    
    // Add form submit listener
    document.getElementById('invoiceForm').addEventListener('submit', handleFormSubmit);
}

// ============================================
// CREDIT PAYMENT FUNCTIONS
// ============================================

let selectedCustomerId = null; // Track selected customer ID

/**
 * Handle payment type change (Cash/Credit)
 */
function handlePaymentTypeChange() {
    const paymentType = document.querySelector('input[name="paymentType"]:checked').value;
    const creditOptions = document.getElementById('creditPaymentOptions');
    
    if (paymentType === 'credit') {
        creditOptions.style.display = 'block';
        
        // Show customer balance if customer is selected
        if (selectedCustomerId) {
            loadCustomerBalance(selectedCustomerId);
        }
    } else {
        creditOptions.style.display = 'none';
        document.getElementById('customerBalanceDisplay').style.display = 'none';
        
        // Reset partial payment fields
        document.getElementById('partialPaymentCheckbox').checked = false;
        document.getElementById('partialPaymentSection').style.display = 'none';
        document.getElementById('amountPaid').value = '';
    }
}

/**
 * Toggle partial payment section
 */
function togglePartialPayment() {
    const checkbox = document.getElementById('partialPaymentCheckbox');
    const section = document.getElementById('partialPaymentSection');
    
    if (checkbox.checked) {
        section.style.display = 'block';
        calculateCredit();
    } else {
        section.style.display = 'none';
        document.getElementById('amountPaid').value = '';
        document.getElementById('amountPaidError').textContent = '';
    }
}

/**
 * Calculate credit summary (amount paid vs amount due)
 */
function calculateCredit() {
    const grandTotalText = document.getElementById('grandTotal').textContent;
    const totalAmount = parseFloat(grandTotalText.replace(/[₹,]/g, '')) || 0;
    const amountPaid = parseFloat(document.getElementById('amountPaid').value) || 0;
    const amountDue = totalAmount - amountPaid;
    
    // Update credit summary display
    document.getElementById('creditTotalAmount').textContent = formatIndianCurrency(totalAmount);
    document.getElementById('creditAmountPaid').textContent = formatIndianCurrency(amountPaid);
    document.getElementById('creditAmountDue').textContent = formatIndianCurrency(amountDue);
    
    // Validation
    const errorElement = document.getElementById('amountPaidError');
    if (amountPaid < 0) {
        errorElement.textContent = 'Amount paid cannot be negative';
    } else if (amountPaid > totalAmount) {
        errorElement.textContent = `Amount paid cannot exceed total amount (₹${formatIndianCurrency(totalAmount)})`;
    } else {
        errorElement.textContent = '';
    }
}

/**
 * Load and display customer's outstanding balance
 */
async function loadCustomerBalance(customerId) {
    try {
        const result = await supabaseGetCustomerBalance(customerId);
        
        if (result.success && result.balance > 0) {
            const balanceCard = document.getElementById('customerBalanceDisplay');
            const balanceAmount = document.getElementById('customerBalanceAmount');
            
            balanceAmount.textContent = `₹${formatIndianCurrency(result.balance)}`;
            balanceCard.style.display = 'block';
            
            // Add warning class if balance is high (>10000)
            if (result.balance > 10000) {
                balanceCard.classList.add('warning');
            } else {
                balanceCard.classList.remove('warning');
            }
        } else {
            document.getElementById('customerBalanceDisplay').style.display = 'none';
        }
    } catch (error) {
        console.error('Error loading customer balance:', error);
    }
}

/**
 * Find customer ID from saved customers by name or mobile
 */
function findCustomerId(customerName, customerMobile) {
    if (!customers || customers.length === 0) return null;
    
    // Try to find by exact name match first
    let customer = customers.find(c => 
        c.name.toLowerCase() === customerName.toLowerCase()
    );
    
    // If not found by name, try mobile
    if (!customer && customerMobile) {
        const cleanMobile = customerMobile.replace(/[\s\-\+]/g, '');
        customer = customers.find(c => 
            c.mobile && c.mobile.replace(/[\s\-\+]/g, '') === cleanMobile
        );
    }
    
    return customer ? customer.id : null;
}

// Initialize form when page loads
document.addEventListener('DOMContentLoaded', initForm);