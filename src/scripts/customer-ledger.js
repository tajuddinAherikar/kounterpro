// Customer Ledger functionality
let currentCustomer = null;
let customerInvoices = [];
let purchaseChart = null;

// Format currency
function formatIndianCurrency(amount) {
    return new Intl.NumberFormat('en-IN', {
        style: 'currency',
        currency: 'INR',
        minimumFractionDigits: 0,
        maximumFractionDigits: 0
    }).format(amount);
}

// Initialize page
document.addEventListener('DOMContentLoaded', async () => {
    console.log('📊 Customer Ledger loading...');
    
    try {
        // Get current user
        let user = null;
        try {
            user = await supabaseGetCurrentUser();
        } catch (userError) {
            console.error('Error getting current user:', userError);
            user = null;
        }

        if (!user) {
            console.warn('⚠️ User not authenticated');
            setTimeout(() => {
                if (!user) {
                    window.location.href = 'login.html';
                }
            }, 1000);
            return;
        }

        // Get customer ID from URL params
        const params = new URLSearchParams(window.location.search);
        const customerId = params.get('id');

        if (!customerId) {
            console.error('❌ No customer ID provided');
            showError('No customer ID provided. Please select a customer.');
            setTimeout(() => window.location.href = 'customers.html', 2000);
            return;
        }

        console.log('✅ Loading customer:', customerId);

        // Load customer and invoices
        await loadCustomerData(customerId);
        
        // Setup UI
        setupSidebarToggle();
        setupNotificationListener();
        
        console.log('✅ Customer ledger fully loaded');
    } catch (error) {
        console.error('Error initializing customer ledger:', error);
        showError('Failed to load customer ledger: ' + error.message);
    }
});

// Load customer data and invoices
async function loadCustomerData(customerId) {
    try {
        // Get all customers
        const customersResult = await supabaseGetCustomers();
        if (!customersResult.success) {
            throw new Error('Failed to load customers');
        }

        // Find the customer
        currentCustomer = customersResult.data.find(c => c.id === customerId);
        if (!currentCustomer) {
            throw new Error('Customer not found');
        }

        // Get all invoices
        const invoicesResult = await supabaseGetInvoices();
        if (!invoicesResult.success) {
            throw new Error('Failed to load invoices');
        }

        // Filter invoices for this customer (by customer_name)
        customerInvoices = invoicesResult.data.filter(inv => 
            inv.customer_name?.toLowerCase() === currentCustomer.name.toLowerCase()
        );

        console.log(`📦 Found ${customerInvoices.length} invoices for customer`);

        // Display customer info
        displayCustomerInfo();
        
        // Calculate and display stats
        calculateLedgerStats();
        
        // Render chart
        renderPurchaseChart();
        
        // Render table
        renderLedgerTable();

    } catch (error) {
        console.error('Error loading customer data:', error);
        showError(error.message);
    }
}

// Display customer information
function displayCustomerInfo() {
    if (!currentCustomer) return;

    // Update header
    document.getElementById('customerName').textContent = currentCustomer.name;
    document.getElementById('customerSubtitle').textContent = `Mobile: ${currentCustomer.mobile || '-'}`;

    // Update info card
    document.getElementById('infoName').textContent = currentCustomer.name;
    document.getElementById('infoMobile').textContent = currentCustomer.mobile || '-';
    document.getElementById('infoEmail').textContent = currentCustomer.email || '-';
    document.getElementById('infoGST').textContent = currentCustomer.gst_number || '-';
    document.getElementById('infoAddress').textContent = currentCustomer.address || '-';
}

// Calculate ledger statistics
function calculateLedgerStats() {
    if (customerInvoices.length === 0) {
        document.getElementById('totalSpent').textContent = '₹0';
        document.getElementById('spentCount').textContent = '0 invoices';
        document.getElementById('lastPurchase').textContent = '-';
        document.getElementById('avgOrder').textContent = '₹0';
        document.getElementById('outstandingBalance').textContent = '₹0';
        document.getElementById('pendingCount').textContent = '0 pending invoices';
        return;
    }

    // Total spent
    const totalSpent = customerInvoices.reduce((sum, inv) => {
        const amount = parseFloat(inv.grand_total || inv.total_amount || 0);
        return sum + amount;
    }, 0);

    // Calculate outstanding balance
    const outstandingBalance = currentCustomer.outstanding_balance || 0;
    const pendingInvoices = customerInvoices.filter(inv => 
        inv.payment_status === 'unpaid' || inv.payment_status === 'partial'
    );

    // Last purchase (most recent invoice)
    const sortedByDate = [...customerInvoices].sort((a, b) => 
        new Date(b.date) - new Date(a.date)
    );
    const lastPurchaseDate = sortedByDate[0]?.date 
        ? new Date(sortedByDate[0].date).toLocaleDateString('en-IN')
        : '-';

    // Average order value
    const avgOrder = totalSpent / customerInvoices.length;

    // Update display
    document.getElementById('totalSpent').textContent = formatIndianCurrency(totalSpent);
    document.getElementById('spentCount').textContent = `${customerInvoices.length} invoice${customerInvoices.length !== 1 ? 's' : ''}`;
    document.getElementById('lastPurchase').textContent = lastPurchaseDate;
    document.getElementById('avgOrder').textContent = formatIndianCurrency(avgOrder);
    
    // Update outstanding balance
    document.getElementById('outstandingBalance').textContent = formatIndianCurrency(outstandingBalance);
    document.getElementById('pendingCount').textContent = `${pendingInvoices.length} pending invoice${pendingInvoices.length !== 1 ? 's' : ''}`;
    
    // Show Record Payment button if there's outstanding balance
    const recordPaymentBtn = document.getElementById('recordPaymentBtn');
    if (outstandingBalance > 0 && recordPaymentBtn) {
        recordPaymentBtn.style.display = 'flex';
        recordPaymentBtn.style.alignItems = 'center';
        recordPaymentBtn.style.justifyContent = 'center';
        recordPaymentBtn.style.gap = '6px';
    }
    
    // Update card styling based on balance
    const outstandingCard = document.getElementById('outstandingCard');
    if (outstandingBalance > 0) {
        outstandingCard.style.borderLeftColor = '#f44336';
    } else {
        outstandingCard.style.borderLeftColor = '#4caf50';
    }
}

// Render purchase timeline chart
function renderPurchaseChart() {
    const ctx = document.getElementById('purchaseChart');
    if (!ctx) return;

    if (customerInvoices.length === 0) {
        ctx.parentElement.innerHTML = '<p style="text-align: center; color: #999; padding: 40px;">No invoice data to display</p>';
        return;
    }

    // Group invoices by month
    const monthlyData = {};
    customerInvoices.forEach(inv => {
        const date = inv.date ? new Date(inv.date) : null;
        if (!date) return;

        const monthKey = date.toLocaleString('en-IN', { year: 'numeric', month: 'short' });
        const amount = parseFloat(inv.grand_total || inv.total_amount || 0);
        
        monthlyData[monthKey] = (monthlyData[monthKey] || 0) + amount;
    });

    const labels = Object.keys(monthlyData);
    const data = Object.values(monthlyData);

    if (purchaseChart) {
        purchaseChart.destroy();
    }

    purchaseChart = new Chart(ctx, {
        type: 'bar',
        data: {
            labels: labels,
            datasets: [{
                label: 'Monthly Amount (₹)',
                data: data,
                backgroundColor: 'rgba(40, 69, 214, 0.6)',
                borderColor: '#2845D6',
                borderWidth: 2,
                borderRadius: 6,
                tension: 0.3
            }]
        },
        options: {
            responsive: true,
            maintainAspectRatio: false,
            plugins: {
                legend: {
                    display: true,
                    labels: {
                        font: { family: "'DM Sans', sans-serif", size: 12 },
                        color: '#7f8c8d',
                        padding: 20
                    }
                },
                tooltip: {
                    callbacks: {
                        label: (ctx) => `₹${ctx.parsed.y.toLocaleString('en-IN')}`
                    }
                }
            },
            scales: {
                y: {
                    beginAtZero: true,
                    ticks: {
                        callback: (value) => '₹' + value.toLocaleString('en-IN'),
                        font: { family: "'DM Sans', sans-serif", size: 11 }
                    },
                    grid: {
                        color: 'rgba(0, 0, 0, 0.05)'
                    }
                },
                x: {
                    ticks: {
                        font: { family: "'DM Sans', sans-serif", size: 11 }
                    },
                    grid: {
                        display: false
                    }
                }
            }
        }
    });
}

// Render ledger table
function renderLedgerTable() {
    const tbody = document.getElementById('ledgerTableBody');
    if (!tbody) return;

    if (customerInvoices.length === 0) {
        tbody.innerHTML = `
            <tr>
                <td colspan="5" style="text-align: center; padding: 40px; color: #999;">
                    <span class="material-icons" style="font-size: 48px; color: #ddd;">receipt_long</span>
                    <p style="margin-top: 16px;">No invoices found for this customer</p>
                </td>
            </tr>
        `;
        return;
    }

    // Sort by date (most recent first)
    const sorted = [...customerInvoices].sort((a, b) => 
        new Date(b.date) - new Date(a.date)
    );

    let html = '';
    sorted.forEach(inv => {
        const date = inv.date 
            ? new Date(inv.date).toLocaleDateString('en-IN')
            : '-';
        const amount = parseFloat(inv.grand_total || inv.total_amount || 0);
        
        // Count items
        let itemCount = 0;
        try {
            const items = typeof inv.items === 'string' ? JSON.parse(inv.items) : inv.items;
            itemCount = Array.isArray(items) ? items.reduce((sum, item) => sum + (parseInt(item.quantity) || 0), 0) : 0;
        } catch (e) {
            itemCount = 0;
        }

        html += `
            <tr class="invoice-row">
                <td>${inv.invoice_number || '-'}</td>
                <td>${date}</td>
                <td>${itemCount} item${itemCount !== 1 ? 's' : ''}</td>
                <td>${formatIndianCurrency(amount)}</td>
                <td>
                    <a href="#" class="action-link" onclick="viewInvoiceLedger('${inv.id}'); return false;" title="View">
                        <span class="material-icons">visibility</span> View
                    </a>
                </td>
            </tr>
        `;
    });

    tbody.innerHTML = html;
}

// View invoice details
function viewInvoiceLedger(invoiceId) {
    // For now, just show a toast - can be enhanced to show modal or PDF preview
    showSuccess('Invoice viewing feature coming soon');
}

// Export ledger as CSV
function exportLedgerData() {
    if (customerInvoices.length === 0) {
        showError('No invoices to export');
        return;
    }

    const headers = ['Invoice No', 'Date', 'Items', 'Amount'];
    const rows = customerInvoices
        .sort((a, b) => new Date(b.date) - new Date(a.date))
        .map(inv => {
            const date = inv.date ? new Date(inv.date).toLocaleDateString('en-IN') : '-';
            const amount = parseFloat(inv.grand_total || inv.total_amount || 0);
            
            let itemCount = 0;
            try {
                const items = typeof inv.items === 'string' ? JSON.parse(inv.items) : inv.items;
                itemCount = Array.isArray(items) ? items.reduce((sum, item) => sum + (parseInt(item.quantity) || 0), 0) : 0;
            } catch (e) {
                itemCount = 0;
            }

            return [
                inv.invoice_number || '-',
                date,
                itemCount,
                amount
            ];
        });

    // Add summary row
    const totalSpent = customerInvoices.reduce((sum, inv) => 
        sum + (parseFloat(inv.grand_total || inv.total_amount || 0)), 0
    );
    rows.push(['', 'TOTAL', '', totalSpent]);

    // Create CSV
    let csv = headers.join(',') + '\n';
    rows.forEach(row => {
        csv += row.map(cell => `"${cell}"`).join(',') + '\n';
    });

    // Download
    const blob = new Blob([csv], { type: 'text/csv' });
    const url = window.URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = `${currentCustomer.name.replace(/\s+/g, '_')}_ledger_${new Date().toISOString().split('T')[0]}.csv`;
    document.body.appendChild(a);
    a.click();
    window.URL.revokeObjectURL(url);
    document.body.removeChild(a);

    showSuccess('Ledger exported successfully');
}

// Sidebar toggle
function setupSidebarToggle() {
    const sidebar = document.querySelector('.sidebar');
    const toggleBtn = document.getElementById('sidebarToggle');
    const mobileToggle = document.getElementById('mobileMenuToggle');
    const mobileMenuBtn = document.getElementById('mobileMenuBtn');
    const overlay = document.getElementById('sidebarOverlay');
    
    if (toggleBtn) {
        toggleBtn.addEventListener('click', () => {
            sidebar.classList.toggle('collapsed');
            localStorage.setItem('sidebarCollapsed', sidebar.classList.contains('collapsed'));
        });
    }
    
    if (mobileToggle) {
        mobileToggle.addEventListener('click', () => {
            sidebar.classList.add('active');
            overlay.classList.add('active');
        });
    }

    if (mobileMenuBtn) {
        mobileMenuBtn.addEventListener('click', () => {
            sidebar.classList.add('active');
            overlay.classList.add('active');
        });
    }
    
    if (overlay) {
        overlay.addEventListener('click', () => {
            sidebar.classList.remove('active');
            overlay.classList.remove('active');
        });
    }
}

// Notification listener
function setupNotificationListener() {
    const notificationBtn = document.getElementById('notificationBtn');
    const notificationDropdown = document.getElementById('notificationDropdown');
    
    if (notificationBtn) {
        notificationBtn.addEventListener('click', (e) => {
            e.stopPropagation();
            if (notificationDropdown) {
                notificationDropdown.classList.toggle('show');
            }
        });
    }
    
    if (notificationDropdown) {
        document.addEventListener('click', (e) => {
            if (!notificationDropdown.contains(e.target) && (notificationBtn && !notificationBtn.contains(e.target))) {
                notificationDropdown.classList.remove('show');
            }
        });
    }
}

// ============================================
// PAYMENT RECORDING FUNCTIONS
// ============================================

/**
 * Open payment recording modal
 */
function openPaymentModal() {
    const modal = document.getElementById('paymentModal');
    const select = document.getElementById('paymentInvoiceSelect');
    
    // Clear previous data
    select.innerHTML = '<option value="">-- Select an unpaid invoice --</option>';
    document.getElementById('paymentForm').reset();
    document.getElementById('paymentInvoiceSummary').style.display = 'none';
    document.getElementById('paymentAmountError').textContent = '';
    
    // Get pending invoices (unpaid or partial)
    const pendingInvoices = customerInvoices.filter(inv => 
        inv.payment_status === 'unpaid' || inv.payment_status === 'partial'
    );
    
    if (pendingInvoices.length === 0) {
        alert('No pending invoices found for this customer.');
        return;
    }
    
    // Populate invoice dropdown
    pendingInvoices.forEach(inv => {
        const option = document.createElement('option');
        option.value = inv.id;
        option.textContent = `${inv.invoice_number} - ${new Date(inv.date).toLocaleDateString('en-IN')} - ${formatIndianCurrency(inv.amount_due || inv.total_amount)}`;
        option.dataset.totalAmount = inv.total_amount || 0;
        option.dataset.amountPaid = inv.amount_paid || 0;
        option.dataset.amountDue = inv.amount_due || inv.total_amount || 0;
        select.appendChild(option);
    });
    
    // Set default payment date to today
    document.getElementById('paymentDate').valueAsDate = new Date();
    
    // Show modal
    modal.style.display = 'flex';
}

/**
 * Close payment modal
 */
function closePaymentModal() {
    document.getElementById('paymentModal').style.display = 'none';
}

/**
 * Update payment details when invoice is selected
 */
function updatePaymentDetails() {
    const select = document.getElementById('paymentInvoiceSelect');
    const selectedOption = select.options[select.selectedIndex];
    const summary = document.getElementById('paymentInvoiceSummary');
    
    if (!select.value) {
        summary.style.display = 'none';
        return;
    }
    
    const totalAmount = parseFloat(selectedOption.dataset.totalAmount);
    const amountPaid = parseFloat(selectedOption.dataset.amountPaid);
    const amountDue = parseFloat(selectedOption.dataset.amountDue);
    
    document.getElementById('paymentInvoiceTotal').textContent = formatIndianCurrency(totalAmount);
    document.getElementById('paymentAlreadyPaid').textContent = formatIndianCurrency(amountPaid);
    document.getElementById('paymentAmountDue').textContent = formatIndianCurrency(amountDue);
    
    // Set max amount for payment input
    document.getElementById('paymentAmount').max = amountDue;
    document.getElementById('paymentAmount').value = amountDue; // Default to full amount
    
    summary.style.display = 'block';
}

/**
 * Handle payment form submission
 */
async function handlePaymentSubmit(event) {
    event.preventDefault();
    
    const submitBtn = document.getElementById('submitPaymentBtn');
    const invoiceId = document.getElementById('paymentInvoiceSelect').value;
    const amount = parseFloat(document.getElementById('paymentAmount').value);
    const paymentDate = document.getElementById('paymentDate').value;
    const paymentMethod = document.getElementById('paymentMethod').value;
    const notes = document.getElementById('paymentNotes').value.trim();
    
    // Get selected invoice details
    const select = document.getElementById('paymentInvoiceSelect');
    const selectedOption = select.options[select.selectedIndex];
    const amountDue = parseFloat(selectedOption.dataset.amountDue);
    
    // Validation
    if (amount <= 0) {
        document.getElementById('paymentAmountError').textContent = 'Amount must be greater than zero';
        return;
    }
    
    if (amount > amountDue) {
        document.getElementById('paymentAmountError').textContent = `Amount cannot exceed ${formatIndianCurrency(amountDue)}`;
        return;
    }
    
    // Disable button and show loading
    submitBtn.disabled = true;
    submitBtn.innerHTML = '<span class="material-icons rotating">sync</span> Recording...';
    
    try {
        // Record payment
        const result = await supabaseRecordPayment({
            invoiceId: invoiceId,
            customerId: currentCustomer.id,
            amount: amount,
            paymentDate: paymentDate,
            paymentMethod: paymentMethod,
            notes: notes || null
        });
        
        if (!result.success) {
            throw new Error(result.error || 'Failed to record payment');
        }
        
        // Show success message
        if (typeof showToast === 'function') {
            showToast('Payment recorded successfully! Outstanding balance updated.', 'success');
        } else {
            alert('✅ Payment recorded successfully!');
        }
        
        // Close modal
        closePaymentModal();
        
        // Reload customer data to reflect changes
        await loadCustomerData(currentCustomer.id);
        
    } catch (error) {
        console.error('Error recording payment:', error);
        document.getElementById('paymentAmountError').textContent = error.message;
        
        if (typeof showToast === 'function') {
            showToast('Error: ' + error.message, 'error');
        } else {
            alert('❌ Error: ' + error.message);
        }
    } finally {
        // Re-enable button
        submitBtn.disabled = false;
        submitBtn.innerHTML = '<span class="material-icons">check</span> Record Payment';
    }
}

// Close modal when clicking outside
document.addEventListener('click', (e) => {
    const modal = document.getElementById('paymentModal');
    if (e.target === modal) {
        closePaymentModal();
    }
});
