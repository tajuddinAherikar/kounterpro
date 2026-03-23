// Customer management functionality
let customers = [];
let editingCustomerId = null;

// Load customers from Supabase
async function loadCustomers() {
    try {
        showSkeletonLoaders();
        const result = await supabaseGetCustomers();
        hideSkeletonLoaders();
        
        if (result.success) {
            customers = result.data.map(customer => ({
                id: customer.id,
                name: customer.name,
                mobile: customer.mobile,
                email: customer.email || '',
                address: customer.address,
                gst: customer.gst_number || ''
            }));
            displayCustomers();
            updateStats();
        } else {
            console.error('Error loading customers:', result.error);
            alert('❌ Error loading customers: ' + result.error);
            customers = [];
        }
    } catch (error) {
        hideSkeletonLoaders();
        console.error('Error loading customers:', error);
        alert('❌ Error loading customers. Please try again.');
        customers = [];
    }
}

// Show skeleton loaders
function showSkeletonLoaders() {
    const totalCustomers = document.getElementById('totalCustomers');
    const activeCustomers = document.getElementById('activeCustomers');
    const gstCustomers = document.getElementById('gstCustomers');
    
    if (totalCustomers) totalCustomers.classList.add('skeleton');
    if (activeCustomers) activeCustomers.classList.add('skeleton');
    if (gstCustomers) gstCustomers.classList.add('skeleton');
    
    const tbody = document.getElementById('customersTableBody');
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
    const totalCustomers = document.getElementById('totalCustomers');
    const activeCustomers = document.getElementById('activeCustomers');
    const gstCustomers = document.getElementById('gstCustomers');
    
    if (totalCustomers) totalCustomers.classList.remove('skeleton');
    if (activeCustomers) activeCustomers.classList.remove('skeleton');
    if (gstCustomers) gstCustomers.classList.remove('skeleton');
}

// Update statistics
function updateStats() {
    const totalCustomersEl = document.getElementById('totalCustomers');
    const activeCustomersEl = document.getElementById('activeCustomers');
    const gstCustomersEl = document.getElementById('gstCustomers');
    
    if (totalCustomersEl) totalCustomersEl.textContent = customers.length;
    
    // For now, assume all customers are active (can be enhanced with invoice data later)
    if (activeCustomersEl) activeCustomersEl.textContent = customers.length;
    
    const gstCount = customers.filter(c => c.gst && c.gst.trim()).length;
    if (gstCustomersEl) gstCustomersEl.textContent = gstCount;
}

// Display customers in table
function displayCustomers() {
    const tbody = document.getElementById('customersTableBody');
    if (!tbody) return;
    
    if (customers.length === 0) {
        tbody.innerHTML = '<tr><td colspan="6" style="text-align: center; padding: 40px;">No customers added yet. Add your first customer!</td></tr>';
        return;
    }
    
    tbody.innerHTML = customers
        .sort((a, b) => a.name.localeCompare(b.name))
        .map(customer => `
            <tr>
                <td><strong>${customer.name}</strong></td>
                <td>${customer.mobile}</td>
                <td>${customer.email || '-'}</td>
                <td>${customer.address}</td>
                <td>${customer.gst || '-'}</td>
                <td>
                    <a href="customer-ledger.html?id=${customer.id}" class="action-link" title="View Ledger">
                        <span class="material-icons">history</span> Ledger
                    </a>
                    <a href="#" class="action-link edit-link" onclick="editCustomer('${customer.id}'); return false;">
                        <span class="material-icons">edit</span> Edit
                    </a>
                    <a href="#" class="action-link delete-link" onclick="deleteCustomer('${customer.id}'); return false;">
                        <span class="material-icons">delete</span> Delete
                    </a>
                </td>
            </tr>
        `).join('');
}

// Show add customer modal
function showAddCustomerModal() {
    editingCustomerId = null;
    document.getElementById('modalTitle').textContent = 'Add New Customer';
    document.getElementById('customerForm').reset();
    document.getElementById('editCustomerId').value = '';
    document.getElementById('customerModal').style.display = 'flex';
}

// Edit customer
function editCustomer(customerId) {
    const customer = customers.find(c => c.id === customerId);
    if (!customer) return;
    
    editingCustomerId = customerId;
    document.getElementById('modalTitle').textContent = 'Edit Customer';
    document.getElementById('editCustomerId').value = customerId;
    document.getElementById('customerName').value = customer.name;
    document.getElementById('customerMobile').value = customer.mobile;
    document.getElementById('customerEmail').value = customer.email || '';
    document.getElementById('customerAddress').value = customer.address;
    document.getElementById('customerGST').value = customer.gst || '';
    document.getElementById('customerModal').style.display = 'flex';
}

// Close modal
function closeModal() {
    document.getElementById('customerModal').style.display = 'none';
    editingCustomerId = null;
}

// Delete customer
async function deleteCustomer(customerId) {
    const customer = customers.find(c => c.id === customerId);
    if (!customer) {
        alert('❌ Customer not found');
        return;
    }
    
    const confirmMessage = `⚠️ Delete Customer Confirmation\n\n` +
        `Customer: ${customer.name}\n` +
        `Mobile: ${customer.mobile}\n\n` +
        `This action cannot be undone!\n\n` +
        `Are you sure you want to delete this customer?`;
    
    const confirmed = await showDeleteConfirm(`${customer.name}`);
    if (confirmed) {
        showLoading('Deleting customer...');
        const result = await supabaseDeleteCustomer(customerId);
        hideLoading();
        
        if (result.success) {
            await loadCustomers();
            alert('✅ Customer deleted successfully');
        } else {
            alert('❌ Error deleting customer: ' + result.error);
        }
    }
}

// Handle form submission
async function handleFormSubmit(e) {
    e.preventDefault();
    
    const name = document.getElementById('customerName').value.trim();
    const mobile = document.getElementById('customerMobile').value.trim();
    const email = document.getElementById('customerEmail').value.trim();
    const address = document.getElementById('customerAddress').value.trim();
    const gst = document.getElementById('customerGST').value.trim().toUpperCase();
    
    // Validation
    if (!name || name.length < 2) {
        alert('❌ Customer name must be at least 2 characters');
        document.getElementById('customerName').focus();
        return;
    }
    
    if (!/^[0-9]{10}$/.test(mobile)) {
        alert('❌ Mobile number must be exactly 10 digits');
        document.getElementById('customerMobile').focus();
        return;
    }
    
    // Check for duplicate mobile (except when editing)
    const duplicate = customers.find(c => 
        c.mobile === mobile && c.id !== editingCustomerId
    );
    if (duplicate) {
        alert('❌ A customer with this mobile number already exists');
        document.getElementById('customerMobile').focus();
        return;
    }
    
    if (email && !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email)) {
        alert('❌ Please enter a valid email address');
        document.getElementById('customerEmail').focus();
        return;
    }
    
    if (!address || address.length < 5) {
        alert('❌ Address must be at least 5 characters');
        document.getElementById('customerAddress').focus();
        return;
    }
    
    if (gst && !/^[0-9]{2}[A-Z]{5}[0-9]{4}[A-Z]{1}[1-9A-Z]{1}Z[0-9A-Z]{1}$/.test(gst)) {
        alert('❌ Invalid GST number format. Format: 22AAAAA0000A1Z5');
        document.getElementById('customerGST').focus();
        return;
    }
    
    const customerData = {
        name,
        mobile,
        email: email || null,
        address,
        gst: gst || null
    };
    
    let result;
    if (editingCustomerId) {
        showLoading('Updating customer...');
        result = await supabaseUpdateCustomer(editingCustomerId, customerData);
    } else {
        showLoading('Adding customer...');
        result = await supabaseAddCustomer(customerData);
    }
    
    hideLoading();
    
    if (result.success) {
        await loadCustomers();
        closeModal();
        alert(editingCustomerId ? '✅ Customer updated successfully' : '✅ Customer added successfully');
    } else {
        alert('❌ Error saving customer: ' + result.error);
    }
}

// Search customers
function searchCustomers() {
    const searchTerm = document.getElementById('searchInput').value.toLowerCase().trim();
    const clearIcon = document.getElementById('clearSearchIcon');
    
    if (searchTerm) {
        clearIcon.style.display = 'block';
    } else {
        clearIcon.style.display = 'none';
    }
    
    const tbody = document.getElementById('customersTableBody');
    if (!tbody) return;
    
    const filteredCustomers = customers.filter(customer => 
        customer.name.toLowerCase().includes(searchTerm) ||
        customer.mobile.includes(searchTerm) ||
        (customer.email && customer.email.toLowerCase().includes(searchTerm)) ||
        (customer.gst && customer.gst.toLowerCase().includes(searchTerm)) ||
        customer.address.toLowerCase().includes(searchTerm)
    );
    
    if (filteredCustomers.length === 0) {
        tbody.innerHTML = '<tr><td colspan="6" style="text-align: center; padding: 40px;">No customers found matching your search.</td></tr>';
        return;
    }
    
    tbody.innerHTML = filteredCustomers
        .sort((a, b) => a.name.localeCompare(b.name))
        .map(customer => `
            <tr>
                <td><strong>${customer.name}</strong></td>
                <td>${customer.mobile}</td>
                <td>${customer.email || '-'}</td>
                <td>${customer.address}</td>
                <td>${customer.gst || '-'}</td>
                <td>
                    <a href="#" class="action-link view" onclick="editCustomer('${customer.id}'); return false;">
                        <span class="material-icons">edit</span> Edit
                    </a>
                    <a href="#" class="action-link delete" onclick="deleteCustomer('${customer.id}'); return false;">
                        <span class="material-icons">delete</span> Delete
                    </a>
                </td>
            </tr>
        `).join('');
}

// Clear search
function clearSearch() {
    document.getElementById('searchInput').value = '';
    document.getElementById('clearSearchIcon').style.display = 'none';
    displayCustomers();
}

// Loading helpers
function showLoading(message) {
    // Could implement a loading overlay here
    console.log(message);
}

function hideLoading() {
    // Hide loading overlay
}

// Initialize page
function initCustomers() {
    loadCustomers();
    
    // Add form submit listener
    document.getElementById('customerForm').addEventListener('submit', handleFormSubmit);
    
    // Add search on enter key
    document.getElementById('searchInput').addEventListener('keypress', function(e) {
        if (e.key === 'Enter') {
            searchCustomers();
        }
    });
}

// Initialize when page loads
document.addEventListener('DOMContentLoaded', initCustomers);

// Backup & restore (placeholder)
async function exportBackup() {
    await downloadSupabaseBackup();
}

async function importBackup(event) {
    alert('ℹ️ Backup restore from file is not yet available with Supabase.');
}
