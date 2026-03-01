// Advanced Reports for KounterPro
let allInvoices = [];
let revenueChart = null;
let productsChart = null;
let customersChart = null;
let currentDateFilter = { from: null, to: null };

// Format number in Indian currency
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
    console.log('📊 Reports page loading...');
    
    try {
        // Try to get current user with error handling
        let user = null;
        try {
            user = await supabaseGetCurrentUser();
        } catch (userError) {
            console.error('Error getting current user:', userError);
            user = null;
        }

        if (!user) {
            console.warn('⚠️ User not authenticated in reports');
            // Don't redirect - auth.js should handle this
            // Wait a bit in case auth.js is still processing
            setTimeout(() => {
                if (!user) {
                    window.location.href = 'login.html';
                }
            }, 1000);
            return;
        }

        console.log('✅ User authenticated, loading reports...');

        // Load invoices
        await loadReportData();
        console.log(`📈 Loaded ${allInvoices.length} invoices`);
        
        // Initialize first tab
        renderRevenueReport();
        
        // Setup sidebar and notifications
        setupSidebarToggle();
        setupNotificationListener();
        
        console.log('✅ Reports page fully loaded');
    } catch (error) {
        console.error('Error initializing reports:', error);
        showError('Failed to load reports: ' + error.message);
    }
});

// Load all invoices from Supabase
async function loadReportData() {
    const result = await supabaseGetInvoices();
    if (result.success) {
        allInvoices = result.data || [];
    } else {
        console.error('Failed to load invoices:', result.error);
        allInvoices = [];
    }
}

// Get filtered invoices based on date range
function getFilteredInvoices() {
    if (!currentDateFilter.from && !currentDateFilter.to) {
        return allInvoices;
    }

    return allInvoices.filter(invoice => {
        const invoiceDate = new Date(invoice.date);
        const fromDate = currentDateFilter.from ? new Date(currentDateFilter.from) : null;
        const toDate = currentDateFilter.to ? new Date(currentDateFilter.to) : null;

        if (fromDate && invoiceDate < fromDate) return false;
        if (toDate) {
            toDate.setHours(23, 59, 59, 999);
            if (invoiceDate > toDate) return false;
        }
        return true;
    });
}

// ============ DATE FILTER FUNCTIONS ============
function applyReportDateFilter() {
    const fromDate = document.getElementById('reportFromDate').value;
    const toDate = document.getElementById('reportToDate').value;

    if (fromDate && toDate && new Date(fromDate) > new Date(toDate)) {
        showWarning('From date must be before To date');
        return;
    }

    currentDateFilter = { from: fromDate || null, to: toDate || null };
    
    // Re-render all visible tabs
    const activeTab = document.querySelector('.report-tab.active').getAttribute('onclick').match(/switchReportTab\('(\w+)'/)[1];
    
    if (activeTab === 'revenue') renderRevenueReport();
    else if (activeTab === 'products') renderProductsReport();
    else if (activeTab === 'customers') renderCustomersReport();

    showSuccess('Date filter applied');
}

function clearReportDateFilter() {
    currentDateFilter = { from: null, to: null };
    document.getElementById('reportFromDate').value = '';
    document.getElementById('reportToDate').value = '';

    const activeTab = document.querySelector('.report-tab.active').getAttribute('onclick').match(/switchReportTab\('(\w+)'/)[1];
    
    if (activeTab === 'revenue') renderRevenueReport();
    else if (activeTab === 'products') renderProductsReport();
    else if (activeTab === 'customers') renderCustomersReport();

    showSuccess('Date filter cleared');
}

// ============ TAB SWITCHING ============
function switchReportTab(tabName) {
    // Hide all tabs
    document.querySelectorAll('.report-tab-content').forEach(tab => {
        tab.style.display = 'none';
    });

    // Remove active class from all tab buttons
    document.querySelectorAll('.report-tab').forEach(btn => {
        btn.classList.remove('active');
    });

    // Show selected tab
    document.getElementById(tabName + '-tab').style.display = 'block';

    // Add active class to clicked button
    event.target.closest('.report-tab').classList.add('active');

    // Render appropriate report
    if (tabName === 'revenue') renderRevenueReport();
    else if (tabName === 'products') renderProductsReport();
    else if (tabName === 'customers') renderCustomersReport();
}

// ============ REVENUE REPORT ============
function renderRevenueReport() {
    const invoices = getFilteredInvoices();
    
    if (invoices.length === 0) {
        document.getElementById('revenueTableBody').innerHTML = '<tr><td colspan="5" style="text-align: center; color: #999;">No invoices found</td></tr>';
        return;
    }

    // Group by month
    const monthlyData = {};
    invoices.forEach(invoice => {
        const date = new Date(invoice.date);
        const monthKey = `${date.getFullYear()}-${String(date.getMonth() + 1).padStart(2, '0')}`;
        const monthDisplay = date.toLocaleDateString('en-IN', { year: 'numeric', month: 'long' });

        if (!monthlyData[monthKey]) {
            monthlyData[monthKey] = {
                display: monthDisplay,
                revenue: 0,
                units: 0,
                count: 0,
                sortKey: monthKey
            };
        }

        const total = parseFloat(invoice.total_amount) || 0;
        monthlyData[monthKey].revenue += total;
        monthlyData[monthKey].count += 1;

        // Count units
        const items = typeof invoice.items === 'string' ? JSON.parse(invoice.items) : invoice.items;
        monthlyData[monthKey].units += items.length;
    });

    // Sort by month
    const sortedMonths = Object.keys(monthlyData).sort();
    const chartData = sortedMonths.map(key => monthlyData[key]);

    // Calculate stats
    const totalRevenue = chartData.reduce((sum, m) => sum + m.revenue, 0);
    const avgMonthly = totalRevenue / chartData.length;
    const bestMonth = chartData.reduce((max, m) => m.revenue > max.revenue ? m : max);

    document.getElementById('totalRevenue').textContent = formatIndianCurrency(totalRevenue);
    document.getElementById('avgMonthlyRevenue').textContent = formatIndianCurrency(avgMonthly);
    document.getElementById('bestMonth').textContent = formatIndianCurrency(bestMonth.revenue);
    document.getElementById('bestMonthDate').textContent = bestMonth.display;

    // Render chart
    renderRevenueChart(chartData);

    // Render table
    renderRevenueTable(chartData);
}

function renderRevenueChart(data) {
    const ctx = document.getElementById('revenueChart').getContext('2d');
    
    if (revenueChart) revenueChart.destroy();

    revenueChart = new Chart(ctx, {
        type: 'bar',
        data: {
            labels: data.map(d => d.display),
            datasets: [{
                label: 'Monthly Revenue',
                data: data.map(d => d.revenue),
                backgroundColor: 'rgba(40, 69, 214, 0.7)',
                borderColor: '#2845D6',
                borderWidth: 1,
                borderRadius: 4,
                tension: 0.4
            }]
        },
        options: {
            responsive: true,
            maintainAspectRatio: false,
            plugins: {
                legend: { display: false },
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
                        callback: (value) => `₹${value.toLocaleString('en-IN')}`
                    }
                }
            }
        }
    });
}

function renderRevenueTable(data) {
    let html = '';
    let prevRevenue = null;

    data.forEach((month, idx) => {
        const growth = prevRevenue ? ((month.revenue - prevRevenue) / prevRevenue * 100).toFixed(1) : '-';
        const growthClass = growth === '-' ? '' : growth > 0 ? ' style="color: #27ae60;"' : ' style="color: #e74c3c;"';
        const growthSymbol = growth === '-' ? '-' : growth > 0 ? '+' : '';

        html += `
            <tr>
                <td>${month.display}</td>
                <td style="text-align: right;">${month.count}</td>
                <td style="text-align: right;">${month.units}</td>
                <td style="text-align: right;">${formatIndianCurrency(month.revenue)}</td>
                <td style="text-align: right;"${growthClass}>${growthSymbol}${growth}%</td>
            </tr>
        `;
        prevRevenue = month.revenue;
    });

    document.getElementById('revenueTableBody').innerHTML = html;
}

// ============ PRODUCTS REPORT ============
function renderProductsReport() {
    const invoices = getFilteredInvoices();
    
    if (invoices.length === 0) {
        document.getElementById('productsTableBody').innerHTML = '<tr><td colspan="6" style="text-align: center; color: #999;">No invoices found</td></tr>';
        return;
    }

    // Aggregate products
    const products = {};
    invoices.forEach(invoice => {
        const items = typeof invoice.items === 'string' ? JSON.parse(invoice.items) : invoice.items;
        items.forEach(item => {
            const name = item.description || 'Unknown Product';
            if (!products[name]) {
                products[name] = {
                    name: name,
                    units: 0,
                    revenue: 0,
                    count: 0
                };
            }
            products[name].units += parseFloat(item.quantity) || 1;
            products[name].revenue += parseFloat(item.amount) || 0;
            products[name].count += 1;
        });
    });

    // Sort by revenue
    const sorted = Object.values(products).sort((a, b) => b.revenue - a.revenue).slice(0, 20);
    
    const totalRevenue = sorted.reduce((sum, p) => sum + p.revenue, 0);
    const totalUnits = sorted.reduce((sum, p) => sum + p.units, 0);

    document.getElementById('totalProductTypes').textContent = Object.keys(products).length;
    document.getElementById('totalUnitsSold').textContent = totalUnits;
    document.getElementById('productsRevenue').textContent = formatIndianCurrency(totalRevenue);

    renderProductsChart(sorted, totalRevenue);
    renderProductsTable(sorted, totalRevenue);
}

function renderProductsChart(data, totalRevenue) {
    const ctx = document.getElementById('productsChart').getContext('2d');
    
    if (productsChart) productsChart.destroy();

    productsChart = new Chart(ctx, {
        type: 'doughnut',
        data: {
            labels: data.map(p => p.name),
            datasets: [{
                data: data.map(p => p.revenue),
                backgroundColor: [
                    'rgba(40, 69, 214, 0.8)',
                    'rgba(72, 126, 219, 0.8)',
                    'rgba(104, 183, 224, 0.8)',
                    'rgba(246, 128, 72, 0.8)',
                    'rgba(228, 57, 60, 0.8)',
                    'rgba(155, 89, 182, 0.8)',
                    'rgba(52, 152, 219, 0.8)',
                    'rgba(26, 188, 156, 0.8)',
                    'rgba(39, 174, 96, 0.8)',
                    'rgba(230, 126, 34, 0.8)'
                ]
            }]
        },
        options: {
            responsive: true,
            maintainAspectRatio: false,
            plugins: {
                legend: {
                    position: 'right',
                    labels: { padding: 15 }
                },
                tooltip: {
                    callbacks: {
                        label: (ctx) => `₹${ctx.parsed.toLocaleString('en-IN')}`
                    }
                }
            }
        }
    });
}

function renderProductsTable(data, totalRevenue) {
    let html = '';

    data.forEach((product, idx) => {
        const percentage = ((product.revenue / totalRevenue) * 100).toFixed(1);
        const avgPrice = (product.revenue / product.units).toFixed(0);

        html += `
            <tr>
                <td>${idx + 1}</td>
                <td>${product.name}</td>
                <td style="text-align: right;">${product.units.toFixed(0)}</td>
                <td style="text-align: right;">${formatIndianCurrency(product.revenue)}</td>
                <td style="text-align: right;">${percentage}%</td>
                <td style="text-align: right;">₹${parseInt(avgPrice).toLocaleString('en-IN')}</td>
            </tr>
        `;
    });

    document.getElementById('productsTableBody').innerHTML = html;
}

// ============ CUSTOMERS REPORT ============
function renderCustomersReport() {
    const invoices = getFilteredInvoices();
    
    if (invoices.length === 0) {
        document.getElementById('customersTableBody').innerHTML = '<tr><td colspan="6" style="text-align: center; color: #999;">No invoices found</td></tr>';
        return;
    }

    // Aggregate customers
    const customers = {};
    invoices.forEach(invoice => {
        const name = invoice.customer_name || 'Unknown Customer';
        if (!customers[name]) {
            customers[name] = {
                name: name,
                spent: 0,
                count: 0
            };
        }
        customers[name].spent += parseFloat(invoice.total_amount) || 0;
        customers[name].count += 1;
    });

    // Sort by spending
    const sorted = Object.values(customers).sort((a, b) => b.spent - a.spent).slice(0, 20);
    
    const totalSpent = sorted.reduce((sum, c) => sum + c.spent, 0);
    const totalCustomers = Object.keys(customers).length;
    const repeatCount = sorted.filter(c => c.count > 1).length;
    const avgOrder = totalSpent / invoices.length;

    document.getElementById('totalCustomers').textContent = totalCustomers;
    document.getElementById('repeatCustomers').textContent = repeatCount;
    document.getElementById('repeatPercentage').textContent = `${((repeatCount / totalCustomers) * 100).toFixed(1)}%`;
    document.getElementById('avgOrderValue').textContent = formatIndianCurrency(avgOrder);

    renderCustomersChart(sorted, totalSpent);
    renderCustomersTable(sorted, totalSpent);
}

function renderCustomersChart(data, totalSpent) {
    const ctx = document.getElementById('customersChart').getContext('2d');
    
    if (customersChart) customersChart.destroy();

    customersChart = new Chart(ctx, {
        type: 'bar',
        data: {
            labels: data.map(c => c.name),
            datasets: [{
                label: 'Customer Spending',
                data: data.map(c => c.spent),
                backgroundColor: 'rgba(246, 128, 72, 0.7)',
                borderColor: '#F68048',
                borderWidth: 1,
                borderRadius: 4
            }]
        },
        options: {
            indexAxis: 'y',
            responsive: true,
            maintainAspectRatio: false,
            plugins: {
                legend: { display: false },
                tooltip: {
                    callbacks: {
                        label: (ctx) => `₹${ctx.parsed.x.toLocaleString('en-IN')}`
                    }
                }
            },
            scales: {
                x: {
                    beginAtZero: true,
                    ticks: {
                        callback: (value) => `₹${value.toLocaleString('en-IN')}`
                    }
                }
            }
        }
    });
}

function renderCustomersTable(data, totalSpent) {
    let html = '';

    data.forEach((customer, idx) => {
        const percentage = ((customer.spent / totalSpent) * 100).toFixed(1);
        const avgOrder = (customer.spent / customer.count).toFixed(0);

        html += `
            <tr>
                <td>${idx + 1}</td>
                <td>${customer.name}</td>
                <td style="text-align: right;">${customer.count}</td>
                <td style="text-align: right;">${formatIndianCurrency(customer.spent)}</td>
                <td style="text-align: right;">₹${parseInt(avgOrder).toLocaleString('en-IN')}</td>
                <td style="text-align: right;">${percentage}%</td>
            </tr>
        `;
    });

    document.getElementById('customersTableBody').innerHTML = html;
}

// ============ CSV EXPORT FUNCTIONS ============
function downloadCSV(csv, filename) {
    const blob = new Blob([csv], { type: 'text/csv' });
    const url = window.URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = filename;
    a.click();
    window.URL.revokeObjectURL(url);
}

function exportRevenueData() {
    const invoices = getFilteredInvoices();
    if (invoices.length === 0) {
        showWarning('No data to export');
        return;
    }

    // Group by month
    const monthlyData = {};
    invoices.forEach(invoice => {
        const date = new Date(invoice.date);
        const monthKey = `${date.getFullYear()}-${String(date.getMonth() + 1).padStart(2, '0')}`;
        const monthDisplay = date.toLocaleDateString('en-IN', { year: 'numeric', month: 'long' });

        if (!monthlyData[monthKey]) {
            monthlyData[monthKey] = {
                display: monthDisplay,
                revenue: 0,
                units: 0,
                count: 0,
                sortKey: monthKey
            };
        }

        const total = parseFloat(invoice.total_amount) || 0;
        monthlyData[monthKey].revenue += total;
        monthlyData[monthKey].count += 1;

        const items = typeof invoice.items === 'string' ? JSON.parse(invoice.items) : invoice.items;
        monthlyData[monthKey].units += items.length;
    });

    const sortedMonths = Object.keys(monthlyData).sort();
    const chartData = sortedMonths.map(key => monthlyData[key]);

    let csv = 'Monthly Revenue Report\n';
    csv += `Generated: ${new Date().toLocaleDateString('en-IN')}\n\n`;
    csv += 'Month,Invoices,Units Sold,Revenue\n';

    chartData.forEach(month => {
        csv += `"${month.display}",${month.count},${month.units},${month.revenue.toFixed(2)}\n`;
    });

    downloadCSV(csv, `revenue-report-${new Date().toISOString().split('T')[0]}.csv`);
    showSuccess('Revenue report exported');
}

function exportProductsData() {
    const invoices = getFilteredInvoices();
    if (invoices.length === 0) {
        showWarning('No data to export');
        return;
    }

    const products = {};
    invoices.forEach(invoice => {
        const items = typeof invoice.items === 'string' ? JSON.parse(invoice.items) : invoice.items;
        items.forEach(item => {
            const name = item.description || 'Unknown Product';
            if (!products[name]) {
                products[name] = { name: name, units: 0, revenue: 0, count: 0 };
            }
            products[name].units += parseFloat(item.quantity) || 1;
            products[name].revenue += parseFloat(item.amount) || 0;
            products[name].count += 1;
        });
    });

    const sorted = Object.values(products).sort((a, b) => b.revenue - a.revenue).slice(0, 20);
    const totalRevenue = sorted.reduce((sum, p) => sum + p.revenue, 0);

    let csv = 'Top Products Report\n';
    csv += `Generated: ${new Date().toLocaleDateString('en-IN')}\n\n`;
    csv += 'Rank,Product,Units,Revenue,% of Total,Avg Price\n';

    sorted.forEach((product, idx) => {
        const percentage = ((product.revenue / totalRevenue) * 100).toFixed(1);
        const avgPrice = (product.revenue / product.units).toFixed(2);
        csv += `${idx + 1},"${product.name}",${product.units.toFixed(0)},${product.revenue.toFixed(2)},${percentage},${avgPrice}\n`;
    });

    downloadCSV(csv, `products-report-${new Date().toISOString().split('T')[0]}.csv`);
    showSuccess('Products report exported');
}

function exportCustomersData() {
    const invoices = getFilteredInvoices();
    if (invoices.length === 0) {
        showWarning('No data to export');
        return;
    }

    const customers = {};
    invoices.forEach(invoice => {
        const name = invoice.customer_name || 'Unknown Customer';
        if (!customers[name]) {
            customers[name] = { name: name, spent: 0, count: 0 };
        }
        customers[name].spent += parseFloat(invoice.total_amount) || 0;
        customers[name].count += 1;
    });

    const sorted = Object.values(customers).sort((a, b) => b.spent - a.spent).slice(0, 20);
    const totalSpent = sorted.reduce((sum, c) => sum + c.spent, 0);

    let csv = 'Top Customers Report\n';
    csv += `Generated: ${new Date().toLocaleDateString('en-IN')}\n\n`;
    csv += 'Rank,Customer,Orders,Total Spent,Avg Order,% of Total\n';

    sorted.forEach((customer, idx) => {
        const percentage = ((customer.spent / totalSpent) * 100).toFixed(1);
        const avgOrder = (customer.spent / customer.count).toFixed(2);
        csv += `${idx + 1},"${customer.name}",${customer.count},${customer.spent.toFixed(2)},${avgOrder},${percentage}\n`;
    });

    downloadCSV(csv, `customers-report-${new Date().toISOString().split('T')[0]}.csv`);
    showSuccess('Customers report exported');
}

// Sidebar toggle (reuse from dashboard)
function setupSidebarToggle() {
    const sidebar = document.getElementById('sidebar');
    const overlay = document.getElementById('sidebarOverlay');
    const toggleBtn = document.getElementById('sidebarToggle');
    const mobileMenuBtn = document.getElementById('mobileMenuBtn');
    const mobileMenuToggle = document.getElementById('mobileMenuToggle');

    if (toggleBtn) {
        toggleBtn.addEventListener('click', () => {
            sidebar.classList.toggle('collapsed');
        });
    }

    if (mobileMenuToggle) {
        mobileMenuToggle.addEventListener('click', () => {
            sidebar.classList.toggle('active');
            overlay?.classList.toggle('active');
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

// Setup notification listeners
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
    
    // Close dropdown when clicking outside
    if (notificationDropdown) {
        document.addEventListener('click', (e) => {
            if (!notificationDropdown.contains(e.target) && (notificationBtn && !notificationBtn.contains(e.target))) {
                notificationDropdown.classList.remove('show');
            }
        });
    }
}
