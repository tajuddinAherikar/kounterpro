// Dashboard functionality
let allInvoices = [];
let inventory = [];

// Load inventory from localStorage
function loadInventory() {
    try {
        const stored = localStorage.getItem('inventory');
        inventory = stored ? JSON.parse(stored) : [];
    } catch (error) {
        console.error('Error loading inventory:', error);
        inventory = [];
    }
}

// Load invoices from localStorage
function loadInvoices() {
    try {
        const stored = localStorage.getItem('invoices');
        allInvoices = stored ? JSON.parse(stored) : [];
    } catch (error) {
        console.error('Error loading invoices:', error);
        alert('❌ Error loading invoices. Your data may be corrupted. Please restore from backup.');
        allInvoices = [];
    }
}

// Calculate statistics
function calculateStats(invoices) {
    const today = new Date().toDateString();
    
    const todayInvoices = invoices.filter(inv => 
        new Date(inv.date).toDateString() === today
    );
    
    const todaySales = todayInvoices.reduce((sum, inv) => sum + inv.grandTotal, 0);
    const todayUnits = todayInvoices.reduce((sum, inv) => sum + inv.totalUnits, 0);
    
    const totalSales = invoices.reduce((sum, inv) => sum + inv.grandTotal, 0);
    
    return {
        todaySales,
        todayCount: todayInvoices.length,
        todayUnits,
        totalSales,
        totalCount: invoices.length
    };
}

// Update dashboard statistics
function updateStats() {
    const stats = calculateStats(allInvoices);
    
    document.getElementById('todaySales').textContent = `₹${stats.todaySales.toFixed(2)}`;
    document.getElementById('todayCount').textContent = `${stats.todayCount} invoices`;
    document.getElementById('todayUnits').textContent = stats.todayUnits;
    document.getElementById('totalSales').textContent = `₹${stats.totalSales.toFixed(2)}`;
    document.getElementById('totalCount').textContent = `${stats.totalCount} invoices`;
}

// Display invoices in table
function displayInvoices(invoices) {
    const tbody = document.getElementById('invoicesTableBody');
    
    if (invoices.length === 0) {
        tbody.innerHTML = '<tr><td colspan="6" style="text-align: center; padding: 40px;">No invoices found for the selected period.</td></tr>';
        return;
    }
    
    tbody.innerHTML = invoices
        .sort((a, b) => new Date(b.date) - new Date(a.date))
        .map(invoice => `
            <tr class="invoice-row">
                <td>${invoice.invoiceNo}</td>
                <td>${formatDate(invoice.date)}</td>
                <td>${invoice.customerName}</td>
                <td>${invoice.totalUnits}</td>
                <td>₹${invoice.grandTotal.toFixed(2)}</td>
                <td>
                    <a href="#" class="action-link" onclick="viewInvoice('${invoice.invoiceNo}')">View</a>
                    <a href="#" class="action-link" onclick="downloadInvoicePDF('${invoice.invoiceNo}')">Download</a>
                    <a href="#" class="action-link" onclick="deleteInvoice('${invoice.invoiceNo}')">Delete</a>
                </td>
            </tr>
        `).join('');
}

// Search invoices in real-time
function searchInvoices() {
    const searchTerm = document.getElementById('invoiceSearch').value.toLowerCase();
    const rows = document.querySelectorAll('.invoice-row');
    
    let visibleCount = 0;
    
    rows.forEach(row => {
        const invoiceNo = row.cells[0].textContent.toLowerCase();
        const date = row.cells[1].textContent.toLowerCase();
        const customer = row.cells[2].textContent.toLowerCase();
        const units = row.cells[3].textContent.toLowerCase();
        const amount = row.cells[4].textContent.toLowerCase();
        
        // Find the invoice data to search in serial numbers
        const invoice = allInvoices.find(inv => inv.invoiceNo === row.cells[0].textContent);
        const serialNumbers = invoice ? invoice.items.map(item => (item.serialNo || '').toLowerCase()).join(' ') : '';
        
        const matches = invoiceNo.includes(searchTerm) ||
                       date.includes(searchTerm) ||
                       customer.includes(searchTerm) ||
                       units.includes(searchTerm) ||
                       amount.includes(searchTerm) ||
                       serialNumbers.includes(searchTerm);
        
        if (matches) {
            row.style.display = '';
            visibleCount++;
        } else {
            row.style.display = 'none';
        }
    });
    
    // Show message if no results
    const tbody = document.getElementById('invoicesTableBody');
    if (visibleCount === 0 && searchTerm) {
        const existingRows = tbody.querySelectorAll('.invoice-row');
        if (existingRows.length > 0) {
            // Add a temporary no results message
            const noResultsRow = tbody.querySelector('.no-results-row');
            if (!noResultsRow) {
                const tr = document.createElement('tr');
                tr.className = 'no-results-row';
                tr.innerHTML = '<td colspan="6" style="text-align: center; padding: 40px; color: #999;">No invoices match your search.</td>';
                tbody.appendChild(tr);
            }
        }
    } else {
        // Remove no results message if it exists
        const noResultsRow = tbody.querySelector('.no-results-row');
        if (noResultsRow) {
            noResultsRow.remove();
        }
    }
}

// Format date for display
function formatDate(dateString) {
    const date = new Date(dateString);
    const day = String(date.getDate()).padStart(2, '0');
    const month = String(date.getMonth() + 1).padStart(2, '0');
    const year = date.getFullYear();
    return `${day}/${month}/${year}`;
}

// Filter sales by date range
function filterSales() {
    const fromDate = document.getElementById('fromDate').value;
    const toDate = document.getElementById('toDate').value;
    
    if (!fromDate || !toDate) {
        alert('Please select both from and to dates');
        return;
    }
    
    const from = new Date(fromDate);
    const to = new Date(toDate);
    to.setHours(23, 59, 59, 999); // Include the entire end date
    
    const filtered = allInvoices.filter(inv => {
        const invDate = new Date(inv.date);
        return invDate >= from && invDate <= to;
    });
    
    displayInvoices(filtered);
}

// Clear filter and show all invoices
function clearFilter() {
    document.getElementById('fromDate').value = '';
    document.getElementById('toDate').value = '';
    displayInvoices(allInvoices);
}

// View invoice details
function viewInvoice(invoiceNo) {
    const invoice = allInvoices.find(inv => inv.invoiceNo === invoiceNo);
    if (invoice) {
        // Store the invoice temporarily for viewing
        sessionStorage.setItem('viewInvoice', JSON.stringify(invoice));
        alert('Invoice Details:\n\n' +
              `Invoice No: ${invoice.invoiceNo}\n` +
              `Date: ${formatDate(invoice.date)}\n` +
              `Customer: ${invoice.customerName}\n` +
              `Total Units: ${invoice.totalUnits}\n` +
              `Grand Total: ₹${invoice.grandTotal.toFixed(2)}\n\n` +
              'PDF regeneration feature can be added if needed.');
    }
}

// Delete invoice
function deleteInvoice(invoiceNo) {
    const invoice = allInvoices.find(inv => inv.invoiceNo === invoiceNo);
    if (!invoice) {
        alert('❌ Invoice not found');
        return;
    }
    
    const confirmMessage = `⚠️ Delete Invoice Confirmation\n\n` +
        `Invoice No: ${invoiceNo}\n` +
        `Customer: ${invoice.customerName}\n` +
        `Amount: ₹${invoice.grandTotal.toFixed(2)}\n\n` +
        `This action cannot be undone!\n\n` +
        `Are you sure you want to delete this invoice?`;
    
    if (confirm(confirmMessage)) {
        try {
            allInvoices = allInvoices.filter(inv => inv.invoiceNo !== invoiceNo);
            localStorage.setItem('invoices', JSON.stringify(allInvoices));
            updateStats();
            displayInvoices(allInvoices);
            alert('✅ Invoice deleted successfully');
        } catch (error) {
            console.error('Error deleting invoice:', error);
            alert('❌ Error deleting invoice. Please try again.');
        }
    }
}

// Download invoice PDF
function downloadInvoicePDF(invoiceNo) {
    const invoice = allInvoices.find(inv => inv.invoiceNo === invoiceNo);
    if (!invoice) {
        alert('Invoice not found');
        return;
    }
    
    generatePDFFromInvoice(invoice);
}

// Generate PDF from stored invoice data
function generatePDFFromInvoice(invoiceData) {
    const { jsPDF } = window.jspdf;
    const pdf = new jsPDF();
    
    let y = 20;
    
    // Header
    pdf.setFontSize(16);
    pdf.setFont(undefined, 'bold');
    pdf.text('TAX INVOICE', 105, y, { align: 'center' });
    
    y += 10;
    pdf.setFontSize(10);
    pdf.setFont(undefined, 'normal');
    pdf.text(`Invoice No: ${invoiceData.invoiceNo}`, 150, y);
    pdf.text(`Date: ${formatDateForPDF(invoiceData.date)}`, 150, y + 5);
    
    // Company Details
    y += 10;
    pdf.setFontSize(14);
    pdf.setFont(undefined, 'bold');
    pdf.text('KEEN BATTERIES', 15, y);
    
    pdf.setFontSize(9);
    pdf.setFont(undefined, 'normal');
    y += 5;
    pdf.text('Indra Auto Nagar, Rangeen Maujid Road Bijapur', 15, y);
    y += 4;
    pdf.text('Contact No: 6361082439, 8088573717', 15, y);
    y += 4;
    pdf.text('Email: keenbatteries@gmail.com', 15, y);
    y += 4;
    pdf.text('Dealer GST: 29AVLPA7490C1ZH', 15, y);
    
    // Bill To
    y += 10;
    pdf.setFont(undefined, 'bold');
    pdf.text('Bill To:', 15, y);
    pdf.setFont(undefined, 'normal');
    y += 5;
    pdf.text(invoiceData.customerName, 15, y);
    y += 5;
    
    const addressLines = pdf.splitTextToSize(invoiceData.customerAddress, 80);
    addressLines.forEach(line => {
        pdf.text(line, 15, y);
        y += 5;
    });
    
    if (invoiceData.customerGST) {
        pdf.text(`GST No: ${invoiceData.customerGST}`, 15, y);
        y += 5;
    }
    
    // Items Table
    y += 5;
    
    // Table header
    pdf.setFillColor(240, 240, 240);
    pdf.rect(15, y, 180, 8, 'F');
    pdf.setFont(undefined, 'bold');
    pdf.text('Sl', 17, y + 5);
    pdf.text('Description of Goods', 28, y + 5);
    pdf.text('Serial No', 85, y + 5);
    pdf.text('Qty', 115, y + 5);
    pdf.text('Rate', 135, y + 5);
    pdf.text('Amount', 165, y + 5);
    
    y += 8;
    pdf.setFont(undefined, 'normal');
    
    // Table rows
    invoiceData.items.forEach(item => {
        if (y > 250) {
            pdf.addPage();
            y = 20;
        }
        
        pdf.text(String(item.slNo), 17, y + 5);
        const descText = pdf.splitTextToSize(item.description, 55);
        pdf.text(descText, 28, y + 5);
        if (item.serialNo) {
            const serialText = pdf.splitTextToSize(item.serialNo, 28);
            pdf.text(serialText, 85, y + 5);
        }
        pdf.text(String(item.quantity), 115, y + 5);
        pdf.text(item.rate.toFixed(2), 135, y + 5);
        pdf.text(item.amount.toFixed(2), 165, y + 5);
        
        pdf.line(15, y + 8, 195, y + 8);
        y += 8;
    });
    
    // Totals
    y += 5;
    pdf.text('Subtotal:', 130, y);
    pdf.text(`₹${invoiceData.subtotal.toFixed(2)}`, 165, y);
    
    y += 6;
    pdf.text(`GST (${invoiceData.gstRate}%)`, 130, y);
    pdf.text(`₹${invoiceData.gstAmount.toFixed(2)}`, 165, y);
    
    y += 6;
    pdf.setFont(undefined, 'bold');
    pdf.setFontSize(11);
    pdf.text('Grand Total:', 130, y);
    pdf.text(`₹${invoiceData.grandTotal.toFixed(2)}`, 165, y);
    
    // Terms & Conditions
    y += 15;
    pdf.setFontSize(10);
    pdf.text('Terms & Conditions:', 15, y);
    
    y += 5;
    pdf.setFontSize(8);
    pdf.setFont(undefined, 'normal');
    const termsLines = pdf.splitTextToSize(invoiceData.termsConditions, 180);
    termsLines.forEach(line => {
        if (y > 270) {
            pdf.addPage();
            y = 20;
        }
        pdf.text(line, 15, y);
        y += 4;
    });
    
    // Stamp/Seal placeholder
    y += 10;
    if (y > 250) {
        pdf.addPage();
        y = 20;
    }
    
    // Add UPI QR Code
    const upiId = 'mahammad.aherikar@ybl';
    const payeeName = 'Keen Batteries';
    const amount = invoiceData.grandTotal.toFixed(2);
    const upiString = `upi://pay?pa=${upiId}&pn=${encodeURIComponent(payeeName)}&am=${amount}&cu=INR&tn=Invoice ${invoiceData.invoiceNo}`;
    
    // Generate QR code
    const qrContainer = document.createElement('div');
    qrContainer.style.display = 'none';
    document.body.appendChild(qrContainer);
    
    const qr = new QRCode(qrContainer, {
        text: upiString,
        width: 120,
        height: 120
    });
    
    // Wait for QR code to be generated then add to PDF
    setTimeout(() => {
        const qrCanvas = qrContainer.querySelector('canvas');
        if (qrCanvas) {
            const qrImage = qrCanvas.toDataURL('image/png');
            
            pdf.setFontSize(10);
            pdf.setFont(undefined, 'bold');
            pdf.text('Scan to Pay', 15, y);
            pdf.addImage(qrImage, 'PNG', 15, y + 2, 35, 35);
            
            pdf.setFontSize(8);
            pdf.setFont(undefined, 'normal');
            pdf.text(`UPI ID: ${upiId}`, 52, y + 10);
            pdf.text(`Amount: ₹${amount}`, 52, y + 15);
            pdf.text('Scan QR to pay via any UPI app', 52, y + 25);
        }
        
        document.body.removeChild(qrContainer);
        
        // Stamp/Seal placeholder - moved to right side
        pdf.setFontSize(9);
        pdf.text('[Stamp/Seal]', 155, y + 15);
        pdf.rect(150, y + 5, 40, 25);
        
        // Footer
        pdf.setFontSize(8);
        pdf.text('This is a Computer Generated copy', 105, 285, { align: 'center' });
        
        // Save PDF
        pdf.save(`Invoice_${invoiceData.invoiceNo.replace(/\//g, '_')}.pdf`);
    }, 100);
}

// Format date for PDF
function formatDateForPDF(dateString) {
    const date = new Date(dateString);
    const day = String(date.getDate()).padStart(2, '0');
    const month = String(date.getMonth() + 1).padStart(2, '0');
    const year = date.getFullYear();
    return `${day}/${month}/${year}`;
}

// Initialize dashboard
function initDashboard() {
    loadInvoices();
    updateStats();
    displayInvoices(allInvoices);
    
    // Set default date range to current month
    const today = new Date();
    const firstDay = new Date(today.getFullYear(), today.getMonth(), 1);
    document.getElementById('fromDate').value = firstDay.toISOString().split('T')[0];
    document.getElementById('toDate').value = today.toISOString().split('T')[0];
}

// Initialize when page loads
document.addEventListener('DOMContentLoaded', initDashboard);

// ============ REPORT GENERATION ============

// Get filtered invoices based on date range
function getFilteredInvoices() {
    const fromDate = document.getElementById('fromDate').value;
    const toDate = document.getElementById('toDate').value;
    
    if (!fromDate || !toDate) {
        return allInvoices;
    }
    
    const from = new Date(fromDate);
    const to = new Date(toDate);
    to.setHours(23, 59, 59, 999);
    
    return allInvoices.filter(inv => {
        const invDate = new Date(inv.date);
        return invDate >= from && invDate <= to;
    });
}

// Download Excel file
function downloadExcel(filename, sheets) {
    const wb = XLSX.utils.book_new();
    
    sheets.forEach(sheet => {
        const ws = XLSX.utils.aoa_to_sheet(sheet.data);
        
        // Set column widths
        ws['!cols'] = sheet.colWidths || [];
        
        XLSX.utils.book_append_sheet(wb, ws, sheet.name);
    });
    
    XLSX.writeFile(wb, filename);
}

// Generate Summary Report
function downloadSummaryReport() {
    const invoices = getFilteredInvoices();
    
    if (invoices.length === 0) {
        alert('No invoices found for the selected period');
        return;
    }
    
    const fromDate = document.getElementById('fromDate').value || 'All Time';
    const toDate = document.getElementById('toDate').value || 'All Time';
    
    // Calculate summary data
    const totalInvoices = invoices.length;
    const totalSales = invoices.reduce((sum, inv) => sum + inv.grandTotal, 0);
    const totalSubtotal = invoices.reduce((sum, inv) => sum + inv.subtotal, 0);
    const totalGST = invoices.reduce((sum, inv) => sum + inv.gstAmount, 0);
    const totalUnits = invoices.reduce((sum, inv) => sum + inv.totalUnits, 0);
    
    // Group by GST rate
    const gstBreakdown = {};
    invoices.forEach(inv => {
        const rate = inv.gstRate;
        if (!gstBreakdown[rate]) {
            gstBreakdown[rate] = { subtotal: 0, gst: 0, total: 0 };
        }
        gstBreakdown[rate].subtotal += inv.subtotal;
        gstBreakdown[rate].gst += inv.gstAmount;
        gstBreakdown[rate].total += inv.grandTotal;
    });
    
    // Build Summary Sheet
    const summaryData = [
        ['KEEN BATTERIES - SALES SUMMARY REPORT'],
        [`Generated: ${new Date().toLocaleString()}`],
        [`Period: ${fromDate} to ${toDate}`],
        [],
        ['OVERALL SUMMARY'],
        ['Metric', 'Value'],
        ['Total Invoices', totalInvoices],
        ['Total Units Sold', totalUnits],
        ['Total Sales (excl. GST)', `₹${totalSubtotal.toFixed(2)}`],
        ['Total GST Collected', `₹${totalGST.toFixed(2)}`],
        ['Grand Total', `₹${totalSales.toFixed(2)}`],
        [],
        ['GST BREAKDOWN BY RATE'],
        ['GST Rate (%)', 'Subtotal', 'GST Amount', 'Total']
    ];
    
    Object.keys(gstBreakdown).forEach(rate => {
        const data = gstBreakdown[rate];
        summaryData.push([
            `${rate}%`,
            `₹${data.subtotal.toFixed(2)}`,
            `₹${data.gst.toFixed(2)}`,
            `₹${data.total.toFixed(2)}`
        ]);
    });
    
    summaryData.push([]);
    summaryData.push(['INVOICE LIST']);
    summaryData.push(['Invoice No', 'Date', 'Customer', 'Units', 'Subtotal', 'GST', 'Grand Total']);
    
    invoices.forEach(inv => {
        summaryData.push([
            inv.invoiceNo,
            formatDate(inv.date),
            inv.customerName,
            inv.totalUnits,
            `₹${inv.subtotal.toFixed(2)}`,
            `₹${inv.gstAmount.toFixed(2)}`,
            `₹${inv.grandTotal.toFixed(2)}`
        ]);
    });
    
    const sheets = [
        {
            name: 'Summary',
            data: summaryData,
            colWidths: [
                { wch: 20 },
                { wch: 20 },
                { wch: 15 },
                { wch: 10 },
                { wch: 15 },
                { wch: 15 },
                { wch: 15 }
            ]
        }
    ];
    
    const filename = `Sales_Summary_${fromDate}_to_${toDate}.xlsx`;
    downloadExcel(filename, sheets);
}

// Generate Detailed Report
function downloadDetailedReport() {
    const invoices = getFilteredInvoices();
    
    if (invoices.length === 0) {
        alert('No invoices found for the selected period');
        return;
    }
    
    const fromDate = document.getElementById('fromDate').value || 'All Time';
    const toDate = document.getElementById('toDate').value || 'All Time';
    
    // Build detailed data
    const detailedData = [
        ['KEEN BATTERIES - DETAILED SALES REPORT'],
        [`Generated: ${new Date().toLocaleString()}`],
        [`Period: ${fromDate} to ${toDate}`],
        [],
        ['Invoice No', 'Date', 'Customer Name', 'Customer Address', 'Customer Mobile', 'Customer GST', 'Item Description', 'Serial No', 'Quantity', 'Rate (excl. GST)', 'Amount (excl. GST)', 'GST Rate (%)', 'GST Amount', 'Total Amount']
    ];
    
    invoices.forEach(inv => {
        inv.items.forEach(item => {
            const itemGSTAmount = (item.amount * inv.gstRate) / 100;
            const itemTotal = item.amount + itemGSTAmount;
            
            detailedData.push([
                inv.invoiceNo,
                formatDate(inv.date),
                inv.customerName,
                inv.customerAddress.replace(/\n/g, ' '),
                inv.customerMobile || 'N/A',
                inv.customerGST || 'N/A',
                item.description,
                item.serialNo || 'N/A',
                item.quantity,
                `₹${item.rate.toFixed(2)}`,
                `₹${item.amount.toFixed(2)}`,
                `${inv.gstRate}%`,
                `₹${itemGSTAmount.toFixed(2)}`,
                `₹${itemTotal.toFixed(2)}`
            ]);
        });
    });
    
    detailedData.push([]);
    detailedData.push(['TOTALS']);
    const totalSubtotal = invoices.reduce((sum, inv) => sum + inv.subtotal, 0);
    const totalGST = invoices.reduce((sum, inv) => sum + inv.gstAmount, 0);
    const totalAmount = invoices.reduce((sum, inv) => sum + inv.grandTotal, 0);
    detailedData.push([
        '', '', '', '', '', '', 'Total', '', '',
        '',
        `₹${totalSubtotal.toFixed(2)}`,
        '',
        `₹${totalGST.toFixed(2)}`,
        `₹${totalAmount.toFixed(2)}`
    ]);
    
    const sheets = [
        {
            name: 'Detailed Report',
            data: detailedData,
            colWidths: [
                { wch: 12 },
                { wch: 12 },
                { wch: 20 },
                { wch: 25 },
                { wch: 15 },
                { wch: 18 },
                { wch: 25 },
                { wch: 10 },
                { wch: 15 },
                { wch: 18 },
                { wch: 12 },
                { wch: 15 },
                { wch: 15 }
            ]
        }
    ];
    
    const filename = `Sales_Detailed_${fromDate}_to_${toDate}.xlsx`;
    downloadExcel(filename, sheets);
}

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

// ===== LOW STOCK ALERTS =====

// Check and display low stock alerts
function checkLowStockAlerts() {
    const DEFAULT_THRESHOLD = 10;
    
    const outOfStock = inventory.filter(item => item.stock === 0);
    const lowStock = inventory.filter(item => {
        const threshold = item.lowStockThreshold || DEFAULT_THRESHOLD;
        return item.stock > 0 && item.stock <= threshold;
    });
    
    const alertItems = [...outOfStock, ...lowStock];
    
    if (alertItems.length === 0) {
        document.getElementById('lowStockWidget').style.display = 'none';
        return;
    }
    
    // Sort by urgency (out of stock first, then by stock level)
    alertItems.sort((a, b) => {
        if (a.stock === 0 && b.stock > 0) return -1;
        if (a.stock > 0 && b.stock === 0) return 1;
        return a.stock - b.stock;
    });
    
    const alertContent = document.getElementById('lowStockAlertContent');
    alertContent.innerHTML = alertItems.map(item => {
        const threshold = item.lowStockThreshold || DEFAULT_THRESHOLD;
        const isCritical = item.stock === 0;
        const icon = isCritical ? '🔴' : '🟡';
        const statusText = isCritical ? 'OUT OF STOCK' : `Low Stock (${item.stock}/${threshold})`;
        
        return `
            <div class="alert-item ${isCritical ? 'critical' : ''}">
                <div class="alert-item-info">
                    <div class="alert-item-name">${icon} ${item.name}</div>
                    <div class="alert-item-stock">
                        ${isCritical ? 
                            '<strong>OUT OF STOCK</strong> - Cannot create invoices' : 
                            `Only <strong>${item.stock} units</strong> remaining (Alert threshold: ${threshold})`
                        }
                    </div>
                </div>
            </div>
        `;
    }).join('');
    
    document.getElementById('lowStockWidget').style.display = 'block';
}

// Initialize dashboard
function initDashboard() {
    loadInvoices();
    loadInventory();
    updateStats();
    displayInvoices(allInvoices);
    checkLowStockAlerts();
}

// Call init when page loads
document.addEventListener('DOMContentLoaded', initDashboard);

