// Modern Dashboard JavaScript

let salesChart = null;
let currentInvoiceForPDF = null;
let userProfile = null;

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

// Initialize dashboard
document.addEventListener('DOMContentLoaded', async () => {
    showSkeletonLoaders();
    loadNotifications(); // Load notifications first
    await initializeDashboard();
    hideSkeletonLoaders();
    setupSidebarToggle();
    setupChartPeriodSelector();
    setupSearchListener();
    setupNotificationListeners();
});

// Show skeleton loaders
function showSkeletonLoaders() {
    // Add skeleton class to stat cards (preserving structure)
    const statCards = document.querySelectorAll('.stat-card-modern');
    statCards.forEach(card => {
        card.classList.add('skeleton-loading');
        const icon = card.querySelector('.stat-card-icon');
        const value = card.querySelector('.stat-card-value');
        const label = card.querySelector('.stat-card-label');
        const meta = card.querySelector('.stat-card-meta');
        
        if (icon) icon.style.opacity = '0.3';
        if (value) value.classList.add('skeleton');
        if (label) label.classList.add('skeleton');
        if (meta) meta.classList.add('skeleton');
    });
    
    // Add skeleton to invoice table
    const tableBody = document.getElementById('invoicesTableBody');
    if (tableBody) {
        tableBody.innerHTML = Array(5).fill(0).map(() => `
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
    
    // Add skeleton to activity feed
    const activityFeed = document.getElementById('activityFeed');
    if (activityFeed) {
        activityFeed.innerHTML = Array(5).fill(0).map(() => `
            <div class="activity-item">
                <div class="skeleton skeleton-icon" style="width: 40px; height: 40px;"></div>
                <div style="flex: 1;">
                    <div class="skeleton skeleton-text" style="width: 70%; margin-bottom: 4px;"></div>
                    <div class="skeleton skeleton-text small" style="width: 30%;"></div>
                </div>
            </div>
        `).join('');
    }
}

// Hide skeleton loaders
function hideSkeletonLoaders() {
    // Remove skeleton classes from stat cards
    const statCards = document.querySelectorAll('.stat-card-modern');
    statCards.forEach(card => {
        card.classList.remove('skeleton-loading');
        const icon = card.querySelector('.stat-card-icon');
        const value = card.querySelector('.stat-card-value');
        const label = card.querySelector('.stat-card-label');
        const meta = card.querySelector('.stat-card-meta');
        
        if (icon) icon.style.opacity = '1';
        if (value) value.classList.remove('skeleton');
        if (label) label.classList.remove('skeleton');
        if (meta) meta.classList.remove('skeleton');
    });
}

// Initialize dashboard data
async function initializeDashboard() {
    try {
        // Get current user first
        const user = await supabaseGetCurrentUser();
        if (!user) {
            window.location.href = 'login.html';
            return;
        }

        // Get user profile
        const profileResult = await supabaseGetUserProfile(user.id);
        if (!profileResult.success || !profileResult.data) {
            console.error('Failed to load user profile');
            // Continue without profile data
        } else {
            userProfile = profileResult.data;
            updateUserDisplay(userProfile);
        }

        // Fetch invoices
        const result = await supabaseGetInvoices();
        const invoices = result.success ? result.data : [];
        
        // Update statistics
        updateStatistics(invoices);
        
        // Initialize chart
        initializeSalesChart(invoices);
        
        // Populate activity feed
        populateActivityFeed(invoices);
        
        // Update invoice table
        updateInvoiceTable(invoices);
        
        // Check low stock and show banner
        checkLowStockBanner();

    } catch (error) {
        console.error('Error initializing dashboard:', error);
        // Use originalAlert to prevent recursion
        if (window.originalAlert) {
            window.originalAlert('❌ Error loading dashboard: ' + error.message);
        } else {
            console.error('❌ Error loading dashboard:', error.message);
        }
    }
}

// Update user display in header
function updateUserDisplay(userProfile) {
    const businessNameElement = document.getElementById('businessNameDisplay');
    if (businessNameElement && userProfile.business_name) {
        businessNameElement.textContent = userProfile.business_name;
    }
}

// Update statistics cards
function updateStatistics(invoices) {
    const today = new Date().toISOString().split('T')[0];
    const yesterday = new Date(Date.now() - 86400000).toISOString().split('T')[0];
    
    // Calculate today's sales
    let todaySales = 0;
    let todayUnits = 0;
    let yesterdaySales = 0;
    
    invoices.forEach(invoice => {
        const invoiceDate = invoice.date?.split('T')[0] || '';
        const total = parseFloat(invoice.total_amount) || 0;
        
        if (invoiceDate === today) {
            todaySales += total;
            // Count items in the invoice
            const items = typeof invoice.items === 'string' ? JSON.parse(invoice.items) : invoice.items;
            todayUnits += items.length;
        } else if (invoiceDate === yesterday) {
            yesterdaySales += total;
        }
    });
    
    // Calculate trend
    let trend = 0;
    if (yesterdaySales > 0) {
        trend = ((todaySales - yesterdaySales) / yesterdaySales * 100).toFixed(1);
    }
    
    // Update UI
    const todaySalesElement = document.getElementById('todaySales');
    const todayUnitsElement = document.getElementById('todayUnits');
    const todayTrendElement = document.getElementById('todayTrend');
    const todayCountElement = document.getElementById('todayCount');
    const todaySalesStatus = document.getElementById('todaySalesStatus');
    
    if (todaySalesElement) {
        todaySalesElement.textContent = `₹${formatIndianCurrency(todaySales)}`;
    }
    
    if (todayUnitsElement) {
        todayUnitsElement.textContent = todayUnits;
    }
    
    if (todayCountElement) {
        const invoiceCount = invoices.filter(inv => inv.date?.split('T')[0] === today).length;
        if (invoiceCount > 0) {
            todayCountElement.textContent = `${invoiceCount} invoice${invoiceCount !== 1 ? 's' : ''}`;
        } else {
            todayCountElement.textContent = 'No invoices yet today';
        }
    }
    
    // Update status text
    if (todaySalesStatus) {
        if (todaySales > 0) {
            todaySalesStatus.style.display = 'none';
        } else {
            todaySalesStatus.style.display = 'inline';
            todaySalesStatus.textContent = 'No activity yet';
        }
    }
    
    if (todayTrendElement) {
        if (trend > 0) {
            todayTrendElement.innerHTML = `<span class="material-icons">trending_up</span><span>+${trend}%</span>`;
            todayTrendElement.className = 'stat-card-trend positive';
            todayTrendElement.style.display = 'flex';
            if (todaySalesStatus) todaySalesStatus.style.display = 'none';
        } else if (trend < 0) {
            todayTrendElement.innerHTML = `<span class="material-icons">trending_down</span><span>${trend}%</span>`;
            todayTrendElement.className = 'stat-card-trend negative';
            todayTrendElement.style.display = 'flex';
            if (todaySalesStatus) todaySalesStatus.style.display = 'none';
        } else {
            todayTrendElement.style.display = 'none';
        }
    }
    
    // Calculate all-time sales and month-over-month trend
    let allTimeSales = 0;
    let currentMonthSales = 0;
    let previousMonthSales = 0;
    
    const now = new Date();
    const currentMonth = now.getMonth();
    const currentYear = now.getFullYear();
    
    const previousMonth = currentMonth === 0 ? 11 : currentMonth - 1;
    const previousMonthYear = currentMonth === 0 ? currentYear - 1 : currentYear;
    
    invoices.forEach(invoice => {
        const total = parseFloat(invoice.total_amount) || 0;
        allTimeSales += total;
        
        const invoiceDate = new Date(invoice.date);
        const invoiceMonth = invoiceDate.getMonth();
        const invoiceYear = invoiceDate.getFullYear();
        
        if (invoiceMonth === currentMonth && invoiceYear === currentYear) {
            currentMonthSales += total;
        } else if (invoiceMonth === previousMonth && invoiceYear === previousMonthYear) {
            previousMonthSales += total;
        }
    });
    
    // Update UI elements
    const totalSalesElement = document.getElementById('totalSales');
    if (totalSalesElement) {
        totalSalesElement.textContent = `₹${formatIndianCurrency(allTimeSales)}`;
    }
    
    const totalCountElement = document.getElementById('totalCount');
    const totalTrendElement = document.getElementById('totalTrend');
    
    if (totalCountElement) {
        totalCountElement.textContent = `${invoices.length} invoice${invoices.length !== 1 ? 's' : ''}`;
    }
    
    // Calculate and show month-over-month trend
    if (totalTrendElement && previousMonthSales > 0) {
        const trendPercent = ((currentMonthSales - previousMonthSales) / previousMonthSales * 100).toFixed(1);
        
        if (trendPercent > 0) {
            totalTrendElement.innerHTML = `<span class="material-icons">trending_up</span><span>+${trendPercent}% vs last month</span>`;
            totalTrendElement.className = 'stat-card-trend positive';
            totalTrendElement.style.display = 'flex';
        } else if (trendPercent < 0) {
            totalTrendElement.innerHTML = `<span class="material-icons">trending_down</span><span>${trendPercent}% vs last month</span>`;
            totalTrendElement.className = 'stat-card-trend negative';
            totalTrendElement.style.display = 'flex';
        } else {
            totalTrendElement.style.display = 'none';
        }
    } else if (totalTrendElement) {
        // Hide trend if no previous month data
        totalTrendElement.style.display = 'none';
    }
    
    // Get low stock count
    updateLowStockCount();
}

// Update low stock count
async function updateLowStockCount() {
    try {
        const result = await supabaseGetInventory();
        const inventory = result.success ? result.data : [];
        const lowStockItems = inventory.filter(item => {
            const stock = parseFloat(item.stock) || 0;
            const threshold = parseFloat(item.low_stock_threshold) || 10;
            return stock <= threshold && stock > 0;
        });
        
        document.getElementById('lowStockCount').textContent = lowStockItems.length;
    } catch (error) {
        console.error('Error fetching low stock count:', error);
        document.getElementById('lowStockCount').textContent = '0';
    }
}

// Initialize sales chart
function initializeSalesChart(invoices) {
    const ctx = document.getElementById('salesTrendChart');
    if (!ctx) return;

    const chartData = prepareSalesChartData(invoices, 7);
    
    salesChart = new Chart(ctx, {
        type: 'line',
        data: {
            labels: chartData.labels,
            datasets: [{
                label: 'Sales',
                data: chartData.data,
                borderColor: '#2845D6',
                backgroundColor: 'rgba(40, 69, 214, 0.1)',
                borderWidth: 2,
                fill: true,
                tension: 0.4,
                pointRadius: 4,
                pointHoverRadius: 6,
                pointBackgroundColor: '#2845D6',
                pointBorderColor: '#fff',
                pointBorderWidth: 2
            }]
        },
        options: {
            responsive: true,
            maintainAspectRatio: false,
            plugins: {
                legend: {
                    display: false
                },
                tooltip: {
                    backgroundColor: '#fff',
                    titleColor: '#2c3e50',
                    bodyColor: '#2c3e50',
                    borderColor: '#e0e0e0',
                    borderWidth: 1,
                    padding: 12,
                    displayColors: false,
                    callbacks: {
                        label: function(context) {
                            return '₹' + formatIndianCurrency(context.parsed.y);
                        }
                    }
                }
            },
            scales: {
                y: {
                    beginAtZero: true,
                    grid: {
                        color: '#f0f0f0'
                    },
                    ticks: {
                        callback: function(value) {
                            return '₹' + value;
                        }
                    }
                },
                x: {
                    grid: {
                        display: false
                    }
                }
            }
        }
    });
}

// Prepare chart data
function prepareSalesChartData(invoices, days) {
    const data = [];
    const labels = [];
    
    for (let i = days - 1; i >= 0; i--) {
        const date = new Date();
        date.setDate(date.getDate() - i);
        const dateStr = date.toISOString().split('T')[0];
        
        // Calculate sales for this date
        let sales = 0;
        invoices.forEach(invoice => {
            const invoiceDate = invoice.date?.split('T')[0] || '';
            if (invoiceDate === dateStr) {
                sales += parseFloat(invoice.total_amount) || 0;
            }
        });
        
        data.push(sales);
        labels.push(date.toLocaleDateString('en-IN', { month: 'short', day: 'numeric' }));
    }
    
    return { labels, data };
}

// Setup chart period selector
function setupChartPeriodSelector() {
    const selector = document.getElementById('chartPeriod');
    if (!selector) return;
    
    selector.addEventListener('change', async (e) => {
        const days = parseInt(e.target.value);
        const result = await supabaseGetInvoices();
        const invoices = result.success ? result.data : [];
        
        if (salesChart) {
            const chartData = prepareSalesChartData(invoices, days);
            salesChart.data.labels = chartData.labels;
            salesChart.data.datasets[0].data = chartData.data;
            salesChart.update();
        }
    });
}

// Populate activity feed
function populateActivityFeed(invoices) {
    const feedContainer = document.getElementById('activityFeed');
    if (!feedContainer) return;
    
    // Sort invoices by date (most recent first)
    const recentInvoices = [...invoices]
        .sort((a, b) => new Date(b.created_at) - new Date(a.created_at))
        .slice(0, 10);
    
    feedContainer.innerHTML = '';
    
    recentInvoices.forEach(invoice => {
        const activityItem = document.createElement('div');
        activityItem.className = 'activity-item';
        
        const timeAgo = getTimeAgo(invoice.created_at);
        const amount = parseFloat(invoice.total_amount) || 0;
        
        activityItem.innerHTML = `
            <div class="activity-icon blue">
                <span class="material-icons">receipt_long</span>
            </div>
            <div class="activity-content">
                <p class="activity-text">
                    Invoice ${invoice.invoice_number} - ${invoice.customer_name || 'Customer'}
                    <strong style="color: #2845D6;">₹${formatIndianCurrency(amount)}</strong>
                </p>
                <span class="activity-time">${timeAgo}</span>
            </div>
        `;
        
        feedContainer.appendChild(activityItem);
    });
}

// Get time ago string
function getTimeAgo(dateString) {
    const date = new Date(dateString);
    const now = new Date();
    const seconds = Math.floor((now - date) / 1000);
    
    if (seconds < 60) return 'Just now';
    if (seconds < 3600) return Math.floor(seconds / 60) + ' minutes ago';
    if (seconds < 86400) return Math.floor(seconds / 3600) + ' hours ago';
    if (seconds < 604800) return Math.floor(seconds / 86400) + ' days ago';
    return date.toLocaleDateString('en-IN');
}

// Update invoice table
function updateInvoiceTable(invoices) {
    const tbody = document.getElementById('invoicesTableBody');
    if (!tbody) return;
    
    // Sort by date (most recent first)
    const sortedInvoices = [...invoices]
        .sort((a, b) => new Date(b.created_at) - new Date(a.created_at));
    
    tbody.innerHTML = '';
    
    if (sortedInvoices.length === 0) {
        tbody.innerHTML = `
            <tr>
                <td colspan="6" style="text-align: center; padding: 40px; color: #999;">
                    <span class="material-icons" style="font-size: 48px; color: #ddd;">receipt_long</span>
                    <p style="margin-top: 16px;">No invoices yet. Create your first invoice!</p>
                </td>
            </tr>
        `;
        return;
    }
    
    sortedInvoices.forEach(invoice => {
        const row = document.createElement('tr');
        row.className = 'invoice-row';
        
        const date = invoice.date ? new Date(invoice.date).toLocaleDateString('en-IN') : '-';
        const amount = parseFloat(invoice.total_amount) || 0;
        
        // Count units
        let units = 0;
        try {
            const items = typeof invoice.items === 'string' ? JSON.parse(invoice.items) : invoice.items;
            units = Array.isArray(items) ? items.reduce((sum, item) => sum + (parseInt(item.quantity) || 0), 0) : 0;
        } catch (e) {
            units = 0;
        }
        
        row.innerHTML = `
            <td>${invoice.invoice_number || '-'}</td>
            <td>${date}</td>
            <td>${invoice.customer_name || '-'}</td>
            <td>${units}</td>
            <td>₹${formatIndianCurrency(amount)}</td>
            <td class="action-cell">
                <a href="#" class="action-link view-link" data-id="${invoice.id}">
                    <span class="material-icons">visibility</span>
                    View
                </a>
                <a href="#" class="action-link delete-link" data-id="${invoice.id}" style="color: #dc3545; margin-left: 12px;">
                    <span class="material-icons">delete</span>
                    Delete
                </a>
            </td>
        `;
        
        // Add event listeners
        const viewLink = row.querySelector('.view-link');
        const deleteLink = row.querySelector('.delete-link');
        
        viewLink.addEventListener('click', (e) => {
            e.preventDefault();
            viewInvoice(invoice.id);
        });
        
        deleteLink.addEventListener('click', (e) => {
            e.preventDefault();
            deleteInvoice(invoice.id);
        });
        
        tbody.appendChild(row);
    });
}

// View invoice details
async function viewInvoice(invoiceId) {
    try {
        const result = await supabaseGetInvoices();
        const invoices = result.success ? result.data : [];
        const invoice = invoices.find(inv => inv.id === invoiceId);
        
        if (!invoice) {
            alert('❌ Invoice not found');
            return;
        }
        
        currentInvoiceForPDF = invoice;
        generatePDFPreview(invoice);
    } catch (error) {
        console.error('Error viewing invoice:', error);
        alert('❌ Error loading invoice');
    }
}

// Generate PDF and show in modal
function generatePDFPreview(invoiceData) {
    const { jsPDF } = window.jspdf;
    const pdf = new jsPDF();
    
    generatePDFContent(pdf, invoiceData);
    
    // Render PDF to iframe
    const pdfDataUrl = pdf.output('dataurlstring');
    displayPDFInModal(pdfDataUrl);
}

// Display PDF in modal
function displayPDFInModal(pdfDataUrl) {
    const modal = document.getElementById('pdfModal');
    
    // Create an iframe to display the PDF
    const pdfFrame = document.createElement('iframe');
    pdfFrame.style.width = '100%';
    pdfFrame.style.height = '600px';
    pdfFrame.style.border = 'none';
    pdfFrame.src = pdfDataUrl;
    
    // Replace modal body content with iframe
    const modalBody = document.querySelector('.pdf-modal-body');
    modalBody.innerHTML = '';
    modalBody.appendChild(pdfFrame);
    
    modal.classList.add('show');
}

// Close PDF modal
function closePDFModal() {
    const modal = document.getElementById('pdfModal');
    modal.classList.remove('show');
    currentInvoiceForPDF = null;
}

// Download current PDF
function downloadCurrentPDF() {
    if (currentInvoiceForPDF) {
        const { jsPDF } = window.jspdf;
        const pdf = new jsPDF();
        generatePDFContent(pdf, currentInvoiceForPDF);
        pdf.save(`Invoice_${currentInvoiceForPDF.invoice_number}.pdf`);
    }
}

// Delete invoice
async function deleteInvoice(invoiceId) {
    try {
        const result = await supabaseGetInvoices();
        const invoices = result.success ? result.data : [];
        const invoice = invoices.find(inv => inv.id === invoiceId);
        
        if (!invoice) {
            alert('❌ Invoice not found');
            return;
        }
        
        const confirmMessage = `⚠️ Delete Invoice Confirmation\n\n` +
            `Invoice No: ${invoice.invoice_number}\n` +
            `Customer: ${invoice.customer_name}\n` +
            `Amount: ₹${formatIndianCurrency(parseFloat(invoice.total_amount))}\n\n` +
            `This action cannot be undone!\n\n` +
            `Are you sure you want to delete this invoice?`;
        
        if (confirm(confirmMessage)) {
            const deleteResult = await supabaseDeleteInvoice(invoiceId);
            
            if (deleteResult.success) {
                alert('✅ Invoice deleted successfully');
                await initializeDashboard(); // Reload dashboard
            } else {
                alert('❌ Error deleting invoice: ' + deleteResult.error);
            }
        }
    } catch (error) {
        console.error('Error deleting invoice:', error);
        alert('❌ Error deleting invoice. Please try again.');
    }
}

// Generate PDF content (shared function)
function generatePDFContent(pdf, invoiceData) {
    let y = 20;
    
    // Parse items if string
    const items = typeof invoiceData.items === 'string' ? JSON.parse(invoiceData.items) : invoiceData.items;
    
    // Header
    pdf.setFontSize(16);
    pdf.setFont(undefined, 'bold');
    pdf.text('TAX INVOICE', 105, y, { align: 'center' });
    
    y += 10;
    pdf.setFontSize(10);
    pdf.setFont(undefined, 'normal');
    pdf.text(`Invoice No: ${invoiceData.invoice_number}`, 150, y);
    pdf.text(`Date: ${new Date(invoiceData.date).toLocaleDateString('en-IN')}`, 150, y + 5);
    
    // Company Details
    y += 10;
    pdf.setFontSize(14);
    pdf.setFont(undefined, 'bold');
    pdf.text((userProfile?.business_name || 'KEEN BATTERIES').toUpperCase(), 15, y);
    
    pdf.setFontSize(9);
    pdf.setFont(undefined, 'normal');
    y += 5;
    pdf.text(userProfile?.business_address || 'Indra Auto Nagar, Rangeen Maujid Road Bijapur', 15, y);
    y += 4;
    pdf.text(`Contact No: ${userProfile?.contact_number_1 || '6361082439'}, ${userProfile?.contact_number_2 || '8088573717'}`, 15, y);
    y += 4;
    pdf.text(`Email: ${userProfile?.business_email || 'keenbatteries@gmail.com'}`, 15, y);
    if (userProfile?.gst_number) {
        y += 4;
        pdf.text(`Dealer GST: ${userProfile.gst_number}`, 15, y);
    }
    
    // Bill To
    y += 10;
    pdf.setFont(undefined, 'bold');
    pdf.text('Bill To:', 15, y);
    pdf.setFont(undefined, 'normal');
    y += 5;
    pdf.text(invoiceData.customer_name || '', 15, y);
    y += 5;
    
    if (invoiceData.customer_address) {
        const addressLines = pdf.splitTextToSize(invoiceData.customer_address, 80);
        addressLines.forEach(line => {
            pdf.text(line, 15, y);
            y += 5;
        });
    }
    
    if (invoiceData.customer_gst) {
        pdf.text(`GST No: ${invoiceData.customer_gst}`, 15, y);
        y += 5;
    }
    
    if (invoiceData.customer_mobile) {
        pdf.text(`Mobile: ${invoiceData.customer_mobile}`, 15, y);
        y += 5;
    }
    
    // Items Table
    y += 5;
    pdf.setFontSize(9);
    pdf.setFont(undefined, 'bold');
    pdf.text('S.No', 15, y);
    pdf.text('Description', 35, y);
    pdf.text('Serial No', 100, y);
    pdf.text('Qty', 135, y);
    pdf.text('Rate', 155, y);
    pdf.text('Amount', 180, y);
    
    y += 2;
    pdf.line(15, y, 200, y);
    y += 5;
    
    // Items
    pdf.setFont(undefined, 'normal');
    items.forEach((item, index) => {
        if (y > 270) {
            pdf.addPage();
            y = 20;
        }
        
        pdf.text(`${index + 1}`, 15, y);
        const descLines = pdf.splitTextToSize(item.description || item.name || '', 60);
        pdf.text(descLines[0], 35, y);
        pdf.text(item.serial_no || '-', 100, y);
        pdf.text(`${item.quantity}`, 135, y);
        pdf.text(`Rs.${formatIndianCurrency(parseFloat(item.rate))}`, 155, y);
        pdf.text(`Rs.${formatIndianCurrency(item.quantity * parseFloat(item.rate))}`, 180, y);
        y += 6;
    });
    
    // Calculate totals
    const gstRate = parseFloat(invoiceData.gst_rate) || 18;
    const totalAmount = parseFloat(invoiceData.total_amount) || 0;
    const gstAmount = (totalAmount * gstRate) / (100 + gstRate);
    const subtotal = totalAmount - gstAmount;
    
    // Totals
    y += 5;
    pdf.line(15, y, 200, y);
    y += 6;
    
    pdf.setFont(undefined, 'bold');
    pdf.text('Subtotal:', 155, y, { align: 'right' });
    pdf.setFont(undefined, 'normal');
    pdf.text(`Rs.${formatIndianCurrency(subtotal)}`, 195, y, { align: 'right' });
    
    y += 6;
    pdf.setFont(undefined, 'bold');
    pdf.text(`GST (${gstRate}%):`, 155, y, { align: 'right' });
    pdf.setFont(undefined, 'normal');
    pdf.text(`Rs.${formatIndianCurrency(gstAmount)}`, 195, y, { align: 'right' });
    
    y += 6;
    pdf.line(155, y, 200, y);
    y += 6;
    
    pdf.setFont(undefined, 'bold');
    pdf.setFontSize(11);
    pdf.text('Grand Total:', 155, y, { align: 'right' });
    pdf.text(`Rs.${formatIndianCurrency(totalAmount)}`, 195, y, { align: 'right' });
    
    // Footer
    y += 15;
    pdf.setFontSize(8);
    pdf.setFont(undefined, 'italic');
    pdf.text('Thank you for your business!', 105, y, { align: 'center' });
}

// Setup notification listeners
function setupNotificationListeners() {
    const notificationBtn = document.getElementById('notificationBtn');
    const notificationDropdown = document.getElementById('notificationDropdown');
    
    if (notificationBtn) {
        notificationBtn.addEventListener('click', (e) => {
            e.stopPropagation();
            toggleNotificationDropdown();
        });
    }
    
    // Close dropdown when clicking outside
    document.addEventListener('click', (e) => {
        if (notificationDropdown && !notificationDropdown.contains(e.target) && !notificationBtn.contains(e.target)) {
            notificationDropdown.classList.remove('show');
        }
    });
}

// Setup sidebar toggle
function setupSidebarToggle() {
    const sidebar = document.querySelector('.sidebar');
    const toggleBtn = document.getElementById('sidebarToggle');
    const mobileToggle = document.getElementById('mobileMenuToggle');
    const overlay = document.getElementById('sidebarOverlay');
    
    // Desktop toggle
    if (toggleBtn) {
        toggleBtn.addEventListener('click', () => {
            sidebar.classList.toggle('collapsed');
            localStorage.setItem('sidebarCollapsed', sidebar.classList.contains('collapsed'));
        });
    }
    
    // Mobile toggle
    if (mobileToggle) {
        mobileToggle.addEventListener('click', () => {
            sidebar.classList.add('show');
            if (overlay) overlay.classList.add('show');
        });
    }
    
    // Overlay click to close sidebar on mobile
    if (overlay) {
        overlay.addEventListener('click', () => {
            sidebar.classList.remove('show');
            overlay.classList.remove('show');
        });
    }
    
    // Close sidebar when clicking nav items on mobile
    const navItems = document.querySelectorAll('.nav-item');
    navItems.forEach(item => {
        item.addEventListener('click', () => {
            if (window.innerWidth <= 768) {
                sidebar.classList.remove('show');
                if (overlay) overlay.classList.remove('show');
            }
        });
    });
    
    // Restore sidebar state (desktop only)
    if (window.innerWidth > 768) {
        const isCollapsed = localStorage.getItem('sidebarCollapsed') === 'true';
        if (isCollapsed) {
            sidebar.classList.add('collapsed');
        }
    }
}

// Logout function
async function handleLogout() {
    try {
        await supabaseSignOut();
        window.location.href = 'login.html';
    } catch (error) {
        console.error('Error signing out:', error);
    }
}

// Setup search listener
function setupSearchListener() {
    const searchInput = document.getElementById('invoiceSearch');
    if (searchInput) {
        searchInput.addEventListener('input', (e) => {
            searchInvoices(e.target.value);
        });
    }
}

// Invoice search
let allInvoicesCache = [];

async function searchInvoices(query) {
    if (!query || query.trim() === '') {
        await initializeDashboard();
        return;
    }
    
    const result = await supabaseGetInvoices();
    const allInvoices = result.success ? result.data : [];
    
    const searchTerm = query.toLowerCase();
    const filtered = allInvoices.filter(inv => 
        inv.invoice_number?.toLowerCase().includes(searchTerm) ||
        inv.customer_name?.toLowerCase().includes(searchTerm) ||
        inv.customer_mobile?.includes(searchTerm)
    );
    
    updateInvoiceTable(filtered);
}

// Filter Modal
function showFilterModal() {
    document.getElementById('filterModal').classList.add('show');
}

function closeFilterModal() {
    document.getElementById('filterModal').classList.remove('show');
}

async function applyDateFilter() {
    const fromDate = document.getElementById('filterFromDate').value;
    const toDate = document.getElementById('filterToDate').value;
    
    if (!fromDate || !toDate) {
        showWarning('Please select both from and to dates');
        return;
    }
    
    const result = await supabaseGetInvoices();
    const allInvoices = result.success ? result.data : [];
    
    const filtered = allInvoices.filter(inv => {
        const invDate = inv.date?.split('T')[0];
        return invDate >= fromDate && invDate <= toDate;
    });
    
    updateInvoiceTable(filtered);
    updateStatistics(filtered);
    closeFilterModal();
    showSuccess(`Showing ${filtered.length} invoices from ${fromDate} to ${toDate}`);
}

async function clearDateFilter() {
    document.getElementById('filterFromDate').value = '';
    document.getElementById('filterToDate').value = '';
    closeFilterModal();
    await initializeDashboard();
}

// Report Modal
function showReportModal() {
    document.getElementById('reportModal').classList.add('show');
}

function closeReportModal() {
    document.getElementById('reportModal').classList.remove('show');
}

async function downloadSummaryReport() {
    const result = await supabaseGetInvoices();
    const invoices = result.success ? result.data : [];
    
    if (invoices.length === 0) {
        showWarning('No invoices to generate report');
        return;
    }
    
    // Calculate summary
    const totalSales = invoices.reduce((sum, inv) => sum + parseFloat(inv.total_amount || 0), 0);
    const totalInvoices = invoices.length;
    
    // Create CSV
    let csv = 'Sales Summary Report\n\n';
    csv += `Total Invoices:,${totalInvoices}\n`;
    csv += `Total Sales:,₹${totalSales.toFixed(2)}\n\n`;
    csv += 'Invoice No,Date,Customer,Amount\n';
    
    invoices.forEach(inv => {
        const date = inv.date ? new Date(inv.date).toLocaleDateString('en-IN') : '-';
        csv += `${inv.invoice_number},${date},${inv.customer_name},₹${parseFloat(inv.total_amount).toFixed(2)}\n`;
    });
    
    downloadCSV(csv, 'summary-report.csv');
    closeReportModal();
    showSuccess('Summary report downloaded');
}

async function downloadDetailedReport() {
    const result = await supabaseGetInvoices();
    const invoices = result.success ? result.data : [];
    
    if (invoices.length === 0) {
        showWarning('No invoices to generate report');
        return;
    }
    
    // Create detailed CSV
    let csv = 'Detailed Sales Report\n\n';
    csv += 'Invoice No,Date,Customer Name,Customer Mobile,Customer Address,GST No,Item Description,Quantity,Rate,Amount,Total Amount\n';
    
    invoices.forEach(inv => {
        const date = inv.date ? new Date(inv.date).toLocaleDateString('en-IN') : '-';
        const items = typeof inv.items === 'string' ? JSON.parse(inv.items) : inv.items;
        
        items.forEach(item => {
            csv += `${inv.invoice_number},${date},"${inv.customer_name}",${inv.customer_mobile},"${inv.customer_address}",${inv.customer_gst || ''},"${item.description}",${item.quantity},₹${item.rate},₹${(item.quantity * item.rate).toFixed(2)},₹${parseFloat(inv.total_amount).toFixed(2)}\n`;
        });
    });
    
    downloadCSV(csv, 'detailed-report.csv');
    closeReportModal();
    showSuccess('Detailed report downloaded');
}

function downloadCSV(content, filename) {
    const blob = new Blob([content], { type: 'text/csv;charset=utf-8;' });
    const link = document.createElement('a');
    link.href = URL.createObjectURL(blob);
    link.download = filename;
    link.click();
}

// Notification system
let notifications = [];

// Add notification to the system
function addNotification(type, title, message, action = null) {
    const notification = {
        id: Date.now(),
        type: type, // 'warning', 'success', 'info'
        title: title,
        message: message,
        action: action,
        timestamp: new Date(),
        read: false
    };
    
    notifications.unshift(notification);
    
    // Store in localStorage
    localStorage.setItem('notifications', JSON.stringify(notifications));
    
    updateNotificationUI();
}

// Load notifications from localStorage
function loadNotifications() {
    const stored = localStorage.getItem('notifications');
    if (stored) {
        notifications = JSON.parse(stored);
        // Filter out old notifications (older than 7 days)
        const sevenDaysAgo = new Date();
        sevenDaysAgo.setDate(sevenDaysAgo.getDate() - 7);
        notifications = notifications.filter(n => new Date(n.timestamp) > sevenDaysAgo);
    }
    updateNotificationUI();
}

// Update notification UI
function updateNotificationUI() {
    const badge = document.getElementById('notificationBadge');
    const list = document.getElementById('notificationList');
    
    const unreadCount = notifications.filter(n => !n.read).length;
    
    if (unreadCount > 0) {
        badge.textContent = unreadCount;
        badge.style.display = 'block';
    } else {
        badge.style.display = 'none';
    }
    
    if (notifications.length === 0) {
        list.innerHTML = `
            <div class="notification-empty">
                <span class="material-icons">notifications_none</span>
                <p>No notifications</p>
            </div>
        `;
    } else {
        list.innerHTML = notifications.map(n => {
            const timeAgo = getTimeAgo(new Date(n.timestamp));
            const icon = n.type === 'warning' ? 'warning' : n.type === 'success' ? 'check_circle' : 'info';
            
            return `
                <div class="notification-item ${n.read ? '' : 'unread'}" onclick="markAsRead('${n.id}')">
                    <div class="notification-icon ${n.type}">
                        <span class="material-icons">${icon}</span>
                    </div>
                    <div class="notification-content">
                        <p class="notification-title">${n.title}</p>
                        <p class="notification-message">${n.message}</p>
                        <span class="notification-time">${timeAgo}</span>
                    </div>
                </div>
            `;
        }).join('');
    }
}

// Get time ago string
function getTimeAgo(dateInput) {
    // Convert to Date object if it's a string
    const date = dateInput instanceof Date ? dateInput : new Date(dateInput);
    
    // Check if date is valid
    if (isNaN(date.getTime())) {
        return 'Unknown';
    }
    
    const seconds = Math.floor((new Date() - date) / 1000);
    
    if (seconds < 60) return 'Just now';
    if (seconds < 3600) return `${Math.floor(seconds / 60)} minutes ago`;
    if (seconds < 86400) return `${Math.floor(seconds / 3600)} hours ago`;
    if (seconds < 604800) return `${Math.floor(seconds / 86400)} days ago`;
    return date.toLocaleDateString();
}

// Mark notification as read
function markAsRead(id) {
    const notification = notifications.find(n => n.id == id);
    if (notification) {
        notification.read = true;
        localStorage.setItem('notifications', JSON.stringify(notifications));
        updateNotificationUI();
        
        // If it's an inventory notification, navigate to inventory
        if (notification.action === 'inventory') {
            window.location.href = 'inventory.html';
        }
    }
}

// Mark all as read
function markAllAsRead() {
    notifications.forEach(n => n.read = true);
    localStorage.setItem('notifications', JSON.stringify(notifications));
    updateNotificationUI();
}

// Toggle notification dropdown
function toggleNotificationDropdown() {
    const dropdown = document.getElementById('notificationDropdown');
    dropdown.classList.toggle('show');
}

// Check and show low stock banner (only once per session)
async function checkLowStockBanner() {
    try {
        // Check if banner was already shown this session
        const bannerShown = sessionStorage.getItem('lowStockBannerShown');
        if (bannerShown) {
            return; // Don't show banner again this session
        }
        
        const result = await supabaseGetInventory();
        const inventory = result.success ? result.data : [];
        const lowStockItems = inventory.filter(item => {
            const stock = parseFloat(item.stock) || 0;
            const threshold = parseFloat(item.low_stock_threshold) || 10;
            return stock <= threshold && stock > 0;
        });
        
        if (lowStockItems.length > 0) {
            // Add notification instead of showing banner immediately
            addNotification(
                'warning',
                `${lowStockItems.length} Low Stock Alert${lowStockItems.length > 1 ? 's' : ''}`,
                lowStockItems.map(item => item.name).slice(0, 3).join(', ') + 
                (lowStockItems.length > 3 ? ` and ${lowStockItems.length - 3} more...` : ''),
                'inventory'
            );
            
            // Mark as shown for this session
            sessionStorage.setItem('lowStockBannerShown', 'true');
        }
    } catch (error) {
        console.error('Error checking low stock:', error);
    }
}

// Reset low stock banner flag (call this from inventory page)
function resetLowStockBannerFlag() {
    sessionStorage.removeItem('lowStockBannerShown');
}
