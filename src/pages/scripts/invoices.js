// Invoices Page — Full Invoice Management

const PAGE_SIZE = 10;
let currentPage = 1;
let allInvoicesCache = [];    // full list from Supabase
let filteredInvoices = [];    // after search/filter
let userProfile = null;
let currentInvoiceForPDF = null;

// ─── Bootstrap ────────────────────────────────────────────────────────────────

document.addEventListener('DOMContentLoaded', async () => {
    setupSidebarToggle();
    setupSearchListener();
    setupNotificationListeners();
    await loadInvoices();
});

async function loadInvoices() {
    showTableLoading();

    const result = await supabaseGetInvoices();
    allInvoicesCache = result.success ? result.data : [];

    // Sort newest first
    allInvoicesCache.sort((a, b) => new Date(b.created_at) - new Date(a.created_at));
    filteredInvoices = [...allInvoicesCache];

    currentPage = 1;
    renderTable();
    renderPagination();
    updateCountLabel();

    // Load user profile for PDF generation
    const user = await supabaseGetCurrentUser();
    if (user) {
        const profileResult = await supabaseGetUserProfile(user.id);
        if (profileResult.success) userProfile = profileResult.data;
    }
}

// ─── Table Rendering ──────────────────────────────────────────────────────────

function showTableLoading() {
    const tbody = document.getElementById('invoicesTableBody');
    if (!tbody) return;
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

function renderTable() {
    const tbody = document.getElementById('invoicesTableBody');
    if (!tbody) return;

    const start = (currentPage - 1) * PAGE_SIZE;
    const end = start + PAGE_SIZE;
    const pageData = filteredInvoices.slice(start, end);

    tbody.innerHTML = '';

    if (filteredInvoices.length === 0) {
        tbody.innerHTML = `
            <tr>
                <td colspan="6" style="text-align:center;padding:48px;color:#999;">
                    <span class="material-icons" style="font-size:52px;color:#ddd;">receipt_long</span>
                    <p style="margin-top:16px;font-size:15px;">No invoices found.</p>
                    <a href="create-bill.html" class="btn-primary" style="display:inline-flex;align-items:center;gap:8px;margin-top:12px;text-decoration:none;">
                        <span class="material-icons">add</span> Create First Invoice
                    </a>
                </td>
            </tr>
        `;
        return;
    }

    pageData.forEach(inv => tbody.appendChild(buildRow(inv)));
}

function buildRow(invoice) {
    const row = document.createElement('tr');
    const date = invoice.date ? new Date(invoice.date).toLocaleDateString('en-IN') : '-';
    const amount = parseFloat(invoice.total_amount) || 0;
    const status = invoice.payment_status || 'paid';
    const statusLabel = status === 'paid' ? 'Paid' : status === 'partial' ? 'Partial' : 'Unpaid';
    const statusClass = status === 'paid' ? 'status-paid' : status === 'partial' ? 'status-partial' : 'status-unpaid';

    row.innerHTML = `
        <td data-label="Invoice No">
            <span class="mobile-field-label">Invoice No</span>
            <div class="field-value"><strong>${invoice.invoice_number || '-'}</strong></div>
        </td>
        <td data-label="Customer">
            <span class="mobile-field-label">Customer</span>
            <div class="field-value">${invoice.customer_name || '-'}</div>
        </td>
        <td data-label="Amount">
            <span class="mobile-field-label">Amount</span>
            <div class="field-value">₹${formatIndianCurrency(amount)}</div>
        </td>
        <td data-label="Date">
            <span class="mobile-field-label">Date</span>
            <div class="field-value">${date}</div>
        </td>
        <td data-label="Status">
            <span class="mobile-field-label">Status</span>
            <div class="field-value"><span class="status-badge ${statusClass}">${statusLabel}</span></div>
        </td>
        <td class="action-cell" data-label="Actions">
            <span class="mobile-field-label">Actions</span>
            <div class="field-value card-actions">
                <a href="#" class="action-link view-link" data-id="${invoice.id}">
                    <span class="material-icons">visibility</span> View
                </a>
                <a href="#" class="action-link edit-link" data-id="${invoice.id}">
                    <span class="material-icons">edit</span> Edit
                </a>
                <a href="#" class="action-link delete-link" data-id="${invoice.id}">
                    <span class="material-icons">delete</span> Delete
                </a>
            </div>
        </td>
    `;

    row.querySelector('.view-link').addEventListener('click', e => { e.preventDefault(); viewInvoice(invoice.id); });
    row.querySelector('.edit-link').addEventListener('click', e => { e.preventDefault(); editInvoice(invoice.id); });
    row.querySelector('.delete-link').addEventListener('click', e => { e.preventDefault(); deleteInvoice(invoice.id); });

    return row;
}

// ─── Pagination ───────────────────────────────────────────────────────────────

function renderPagination() {
    const wrapper = document.getElementById('paginationWrapper');
    const container = document.getElementById('paginationContainer');
    const infoEl = document.getElementById('paginationInfo');
    if (!wrapper || !container) return;

    const totalPages = Math.ceil(filteredInvoices.length / PAGE_SIZE);
    const start = filteredInvoices.length ? (currentPage - 1) * PAGE_SIZE + 1 : 0;
    const end = Math.min(currentPage * PAGE_SIZE, filteredInvoices.length);

    if (infoEl) {
        infoEl.textContent = filteredInvoices.length > 0
            ? `Showing ${start}–${end} of ${filteredInvoices.length} invoices`
            : '';
    }

    if (totalPages <= 1) {
        wrapper.style.display = 'none';
        return;
    }

    wrapper.style.display = 'flex';

    const pageNumbers = buildPageNumbers(currentPage, totalPages);

    let html = `
        <button class="pagination-btn" onclick="goToPage(${currentPage - 1})" ${currentPage === 1 ? 'disabled' : ''}>
            <span class="material-icons" style="font-size:16px;">chevron_left</span> Prev
        </button>
    `;

    pageNumbers.forEach(p => {
        if (p === '...') {
            html += `<span class="pagination-ellipsis">…</span>`;
        } else {
            html += `<button class="pagination-btn ${p === currentPage ? 'active' : ''}" onclick="goToPage(${p})">${p}</button>`;
        }
    });

    html += `
        <button class="pagination-btn" onclick="goToPage(${currentPage + 1})" ${currentPage === totalPages ? 'disabled' : ''}>
            Next <span class="material-icons" style="font-size:16px;">chevron_right</span>
        </button>
    `;

    container.innerHTML = html;
}

function buildPageNumbers(current, total) {
    const pages = [];
    const delta = 2;
    let prev = null;

    for (let i = 1; i <= total; i++) {
        if (i === 1 || i === total || (i >= current - delta && i <= current + delta)) {
            if (prev !== null && i - prev > 1) pages.push('...');
            pages.push(i);
            prev = i;
        }
    }
    return pages;
}

function goToPage(page) {
    const totalPages = Math.ceil(filteredInvoices.length / PAGE_SIZE);
    if (page < 1 || page > totalPages) return;
    currentPage = page;
    renderTable();
    renderPagination();
    document.getElementById('invoicesTableWrapper')?.scrollIntoView({ behavior: 'smooth', block: 'start' });
}

// ─── Count label ──────────────────────────────────────────────────────────────

function updateCountLabel() {
    const el = document.getElementById('invoiceCountLabel');
    if (!el) return;
    const total = allInvoicesCache.length;
    el.textContent = total > 0 ? `${total} total invoice${total !== 1 ? 's' : ''}` : '';
}

// ─── Search ───────────────────────────────────────────────────────────────────

function setupSearchListener() {
    const input = document.getElementById('invoiceSearch');
    if (!input) return;
    let debounceTimer;
    input.addEventListener('input', () => {
        clearTimeout(debounceTimer);
        debounceTimer = setTimeout(() => applySearchAndFilter(), 250);
    });
}

function applySearchAndFilter() {
    const query = (document.getElementById('invoiceSearch')?.value || '').toLowerCase().trim();
    const fromDate = document.getElementById('filterFromDate')?.value;
    const toDate = document.getElementById('filterToDate')?.value;
    const status = document.getElementById('filterStatus')?.value;

    filteredInvoices = allInvoicesCache.filter(inv => {
        // Search
        if (query) {
            const matchSearch =
                inv.invoice_number?.toLowerCase().includes(query) ||
                inv.customer_name?.toLowerCase().includes(query) ||
                inv.customer_mobile?.includes(query);
            if (!matchSearch) return false;
        }
        // Date range
        if (fromDate || toDate) {
            const invDate = inv.date?.split('T')[0];
            if (fromDate && invDate < fromDate) return false;
            if (toDate && invDate > toDate) return false;
        }
        // Status
        if (status && inv.payment_status !== status) return false;

        return true;
    });

    currentPage = 1;
    renderTable();
    renderPagination();

    const label = document.getElementById('invoiceCountLabel');
    if (label) {
        const total = allInvoicesCache.length;
        const showing = filteredInvoices.length;
        label.textContent = showing < total
            ? `${showing} of ${total} invoices`
            : `${total} total invoice${total !== 1 ? 's' : ''}`;
    }
}

// ─── Filter Modal ─────────────────────────────────────────────────────────────

function showFilterModal() {
    document.getElementById('filterModal').classList.add('show');
}
function closeFilterModal() {
    document.getElementById('filterModal').classList.remove('show');
}
function applyFilter() {
    closeFilterModal();
    applySearchAndFilter();
}
function clearFilter() {
    document.getElementById('filterFromDate').value = '';
    document.getElementById('filterToDate').value = '';
    document.getElementById('filterStatus').value = '';
    closeFilterModal();
    applySearchAndFilter();
}

// ─── Report Modal ─────────────────────────────────────────────────────────────

function showReportModal() {
    document.getElementById('reportModal').classList.add('show');
}
function closeReportModal() {
    document.getElementById('reportModal').classList.remove('show');
}

async function downloadSummaryReport() {
    if (filteredInvoices.length === 0) { showWarning('No invoices to export'); return; }
    const total = filteredInvoices.reduce((s, inv) => s + (parseFloat(inv.total_amount) || 0), 0);
    let csv = 'Sales Summary Report\n\n';
    csv += `Total Invoices:,${filteredInvoices.length}\n`;
    csv += `Total Sales:,₹${total.toFixed(2)}\n\n`;
    csv += 'Invoice No,Date,Customer,Amount,Status\n';
    filteredInvoices.forEach(inv => {
        const date = inv.date ? new Date(inv.date).toLocaleDateString('en-IN') : '-';
        csv += `${inv.invoice_number},${date},"${inv.customer_name}",₹${parseFloat(inv.total_amount || 0).toFixed(2)},${inv.payment_status || 'paid'}\n`;
    });
    downloadCSV(csv, 'summary-report.csv');
    closeReportModal();
    showSuccess('Summary report downloaded');
}

async function downloadDetailedReport() {
    if (filteredInvoices.length === 0) { showWarning('No invoices to export'); return; }
    let csv = 'Detailed Sales Report\n\n';
    csv += 'Invoice No,Date,Customer Name,Customer Mobile,Customer Address,GST No,Item Description,Quantity,Rate,Amount,Total Amount,Status\n';
    filteredInvoices.forEach(inv => {
        const date = inv.date ? new Date(inv.date).toLocaleDateString('en-IN') : '-';
        let items;
        try { items = typeof inv.items === 'string' ? JSON.parse(inv.items) : (inv.items || []); }
        catch (e) { items = []; }
        if (items.length === 0) {
            csv += `${inv.invoice_number},${date},"${inv.customer_name}",${inv.customer_mobile || ''},"${inv.customer_address || ''}",${inv.customer_gst || ''},,,,, ₹${parseFloat(inv.total_amount || 0).toFixed(2)},${inv.payment_status || 'paid'}\n`;
        } else {
            items.forEach(item => {
                csv += `${inv.invoice_number},${date},"${inv.customer_name}",${inv.customer_mobile || ''},"${inv.customer_address || ''}",${inv.customer_gst || ''},"${item.description || item.name || ''}",${item.quantity},₹${parseFloat(item.rate || 0).toFixed(2)},₹${(item.quantity * parseFloat(item.rate || 0)).toFixed(2)},₹${parseFloat(inv.total_amount || 0).toFixed(2)},${inv.payment_status || 'paid'}\n`;
            });
        }
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

// ─── Invoice Actions ──────────────────────────────────────────────────────────

function viewInvoice(invoiceId) {
    const invoice = allInvoicesCache.find(inv => inv.id === invoiceId);
    if (!invoice) { showWarning('Invoice not found'); return; }
    currentInvoiceForPDF = invoice;
    generateAndShowPDF(invoice);
}

function editInvoice(invoiceId) {
    const invoice = allInvoicesCache.find(inv => inv.id === invoiceId);
    if (!invoice) { showWarning('Invoice not found'); return; }
    sessionStorage.setItem('editingInvoice', JSON.stringify(invoice));
    window.location.href = 'create-bill.html?mode=edit';
}

async function deleteInvoice(invoiceId) {
    const invoice = allInvoicesCache.find(inv => inv.id === invoiceId);
    if (!invoice) { showWarning('Invoice not found'); return; }

    const confirmed = await showDeleteConfirm(`invoice ${invoice.invoice_number}`);
    if (!confirmed) return;

    const result = await supabaseDeleteInvoice(invoiceId);
    if (result.success) {
        showSuccess('Invoice deleted successfully');
        await loadInvoices();
    } else {
        showError('Failed to delete invoice: ' + result.error);
    }
}

// ─── PDF Preview ──────────────────────────────────────────────────────────────

function generateAndShowPDF(invoice) {
    const { jsPDF } = window.jspdf;
    const pdf = new jsPDF();
    generatePDFContent(pdf, invoice);

    const modal = document.getElementById('pdfModal');
    const body = modal.querySelector('.pdf-modal-body');
    body.innerHTML = '';

    // Android WebView cannot render data: URIs in iframes — show HTML preview instead
    const isNative = !!(window.Capacitor &&
        typeof window.Capacitor.isNativePlatform === 'function' &&
        window.Capacitor.isNativePlatform());

    if (isNative) {
        body.innerHTML = renderInvoiceHTMLPreview(invoice);
    } else {
        const dataUrl = pdf.output('dataurlstring');
        const iframe = document.createElement('iframe');
        iframe.style.cssText = 'width:100%;height:600px;border:none;';
        iframe.src = dataUrl;
        body.appendChild(iframe);
    }

    modal.classList.add('show');
}

function renderInvoiceHTMLPreview(invoice) {
    const items = typeof invoice.items === 'string' ? JSON.parse(invoice.items) : (invoice.items || []);
    const taxMode = invoice.tax_mode || 'with-tax';
    const gstRate = parseFloat(invoice.gst_rate) || 0;
    const totalAmount = parseFloat(invoice.total_amount) || 0;
    const storedSubtotal = invoice.subtotal ? parseFloat(invoice.subtotal) : null;
    const storedGstAmount = invoice.gst_amount ? parseFloat(invoice.gst_amount) : null;
    const gstAmount = storedGstAmount !== null ? storedGstAmount
        : (taxMode === 'with-tax' && gstRate > 0 ? (totalAmount * gstRate) / (100 + gstRate) : 0);
    const subtotal = storedSubtotal !== null ? storedSubtotal : (totalAmount - gstAmount);

    const dateStr = invoice.date ? new Date(invoice.date).toLocaleDateString('en-IN') : '';

    const itemRows = items.map((item, idx) => `
        <tr>
            <td style="padding:6px 4px;border-bottom:1px solid #eee;">${idx + 1}</td>
            <td style="padding:6px 4px;border-bottom:1px solid #eee;">${item.description || item.name || ''}</td>
            <td style="padding:6px 4px;border-bottom:1px solid #eee;text-align:center;">${item.serial_no || '-'}</td>
            <td style="padding:6px 4px;border-bottom:1px solid #eee;text-align:center;">${item.quantity}</td>
            <td style="padding:6px 4px;border-bottom:1px solid #eee;text-align:right;">₹${formatIndianCurrency(parseFloat(item.rate))}</td>
            <td style="padding:6px 4px;border-bottom:1px solid #eee;text-align:right;">₹${formatIndianCurrency(item.quantity * parseFloat(item.rate))}</td>
        </tr>`).join('');

    const gstRows = (taxMode === 'with-tax' && gstRate > 0) ? `
        <tr>
            <td colspan="5" style="text-align:right;padding:4px;">SGST (${gstRate / 2}%):</td>
            <td style="text-align:right;padding:4px;">₹${formatIndianCurrency(gstAmount / 2)}</td>
        </tr>
        <tr>
            <td colspan="5" style="text-align:right;padding:4px;">CGST (${gstRate / 2}%):</td>
            <td style="text-align:right;padding:4px;">₹${formatIndianCurrency(gstAmount / 2)}</td>
        </tr>` : '';

    return `
    <div style="font-family:sans-serif;font-size:13px;color:#222;padding:12px;">
        <div style="display:flex;justify-content:space-between;align-items:flex-start;margin-bottom:12px;">
            <div>
                <div style="font-size:18px;font-weight:700;color:#2845D6;">${(userProfile?.business_name || 'BUSINESS NAME').toUpperCase()}</div>
                <div style="color:#555;margin-top:2px;">${userProfile?.business_address || ''}</div>
                <div style="color:#555;">Contact: ${userProfile?.contact_number_1 || ''}</div>
                ${userProfile?.gst_number ? `<div style="color:#555;">GST: ${userProfile.gst_number}</div>` : ''}
            </div>
            <div style="text-align:right;">
                <div style="font-size:15px;font-weight:700;">TAX INVOICE</div>
                <div>Invoice No: <strong>${invoice.invoice_number}</strong></div>
                <div>Date: ${dateStr}</div>
            </div>
        </div>
        <div style="background:#f3f4f8;border-radius:6px;padding:8px 12px;margin-bottom:12px;">
            <div style="font-weight:600;margin-bottom:4px;">Bill To:</div>
            <div style="font-weight:500;">${invoice.customer_name || ''}</div>
            ${invoice.customer_address ? `<div style="color:#555;">${invoice.customer_address}</div>` : ''}
            ${invoice.customer_mobile ? `<div style="color:#555;">Mobile: ${invoice.customer_mobile}</div>` : ''}
            ${invoice.customer_gst ? `<div style="color:#555;">GST: ${invoice.customer_gst}</div>` : ''}
        </div>
        <table style="width:100%;border-collapse:collapse;font-size:12px;">
            <thead>
                <tr style="background:#2845D6;color:#fff;">
                    <th style="padding:6px 4px;text-align:left;">S.No</th>
                    <th style="padding:6px 4px;text-align:left;">Description</th>
                    <th style="padding:6px 4px;text-align:center;">Serial No</th>
                    <th style="padding:6px 4px;text-align:center;">Qty</th>
                    <th style="padding:6px 4px;text-align:right;">Rate</th>
                    <th style="padding:6px 4px;text-align:right;">Amount</th>
                </tr>
            </thead>
            <tbody>${itemRows}</tbody>
            <tfoot>
                <tr>
                    <td colspan="5" style="text-align:right;padding:6px 4px;border-top:1px solid #ccc;">Subtotal:</td>
                    <td style="text-align:right;padding:6px 4px;border-top:1px solid #ccc;">₹${formatIndianCurrency(subtotal)}</td>
                </tr>
                ${gstRows}
                <tr style="font-weight:700;font-size:14px;background:#f3f4f8;">
                    <td colspan="5" style="text-align:right;padding:8px 4px;border-top:2px solid #2845D6;">Grand Total:</td>
                    <td style="text-align:right;padding:8px 4px;border-top:2px solid #2845D6;color:#2845D6;">₹${formatIndianCurrency(totalAmount)}</td>
                </tr>
            </tfoot>
        </table>
        <div style="text-align:center;color:#888;font-style:italic;margin-top:16px;font-size:11px;">Thank you for your business!</div>
    </div>`;
}

function closePDFModal() {
    document.getElementById('pdfModal').classList.remove('show');
    currentInvoiceForPDF = null;
}

function downloadCurrentPDF() {
    if (!currentInvoiceForPDF) return;
    const { jsPDF } = window.jspdf;
    const pdf = new jsPDF();
    generatePDFContent(pdf, currentInvoiceForPDF);
    savePDF(pdf, `Invoice_${currentInvoiceForPDF.invoice_number}.pdf`);
}

function formatIndianCurrency(amount) {
    const num = parseFloat(amount).toFixed(2);
    const [integerPart, decimalPart] = num.split('.');
    const isNegative = integerPart.startsWith('-');
    const abs = isNegative ? integerPart.slice(1) : integerPart;
    let result = abs.length <= 3 ? abs : abs.slice(0, -3).replace(/\B(?=(\d{2})+(?!\d))/g, ',') + ',' + abs.slice(-3);
    return (isNegative ? '-' : '') + result + '.' + decimalPart;
}

function generatePDFContent(pdf, invoiceData) {
    let y = 20;
    const items = typeof invoiceData.items === 'string' ? JSON.parse(invoiceData.items) : (invoiceData.items || []);

    pdf.setFontSize(16); pdf.setFont(undefined, 'bold');
    pdf.text('TAX INVOICE', 105, y, { align: 'center' });
    y += 10; pdf.setFontSize(10); pdf.setFont(undefined, 'normal');
    pdf.text(`Invoice No: ${invoiceData.invoice_number}`, 150, y);
    pdf.text(`Date: ${new Date(invoiceData.date).toLocaleDateString('en-IN')}`, 150, y + 5);

    y += 10; pdf.setFontSize(14); pdf.setFont(undefined, 'bold');
    pdf.text((userProfile?.business_name || 'BUSINESS NAME').toUpperCase(), 15, y);
    pdf.setFontSize(9); pdf.setFont(undefined, 'normal');
    y += 5; pdf.text(userProfile?.business_address || '', 15, y);
    y += 4; pdf.text(`Contact: ${userProfile?.contact_number_1 || ''}`, 15, y);
    if (userProfile?.gst_number) { y += 4; pdf.text(`GST: ${userProfile.gst_number}`, 15, y); }

    y += 10; pdf.setFont(undefined, 'bold'); pdf.text('Bill To:', 15, y);
    pdf.setFont(undefined, 'normal'); y += 5;
    pdf.text(invoiceData.customer_name || '', 15, y); y += 5;
    if (invoiceData.customer_address) {
        pdf.splitTextToSize(invoiceData.customer_address, 80).forEach(l => { pdf.text(l, 15, y); y += 5; });
    }
    if (invoiceData.customer_gst) { pdf.text(`GST: ${invoiceData.customer_gst}`, 15, y); y += 5; }
    if (invoiceData.customer_mobile) { pdf.text(`Mobile: ${invoiceData.customer_mobile}`, 15, y); y += 5; }

    y += 5; pdf.setFontSize(9); pdf.setFont(undefined, 'bold');
    ['S.No','Description','Serial No','Qty','Rate','Amount'].forEach((h, i) => {
        pdf.text(h, [15,35,100,135,155,180][i], y);
    });
    y += 2; pdf.line(15, y, 200, y); y += 5;
    pdf.setFont(undefined, 'normal');
    items.forEach((item, idx) => {
        if (y > 270) { pdf.addPage(); y = 20; }
        pdf.text(`${idx + 1}`, 15, y);
        pdf.text(pdf.splitTextToSize(item.description || item.name || '', 60)[0], 35, y);
        pdf.text(item.serial_no || '-', 100, y);
        pdf.text(`${item.quantity}`, 135, y);
        pdf.text(`Rs.${formatIndianCurrency(parseFloat(item.rate))}`, 155, y);
        pdf.text(`Rs.${formatIndianCurrency(item.quantity * parseFloat(item.rate))}`, 180, y);
        y += 6;
    });

    const taxMode = invoiceData.tax_mode || 'with-tax';
    const gstRate = parseFloat(invoiceData.gst_rate) || 0;
    const totalAmount = parseFloat(invoiceData.total_amount) || 0;
    const storedSubtotal = invoiceData.subtotal ? parseFloat(invoiceData.subtotal) : null;
    const storedGstAmount = invoiceData.gst_amount ? parseFloat(invoiceData.gst_amount) : null;
    const gstAmount = storedGstAmount !== null ? storedGstAmount
        : (taxMode === 'with-tax' && gstRate > 0 ? (totalAmount * gstRate) / (100 + gstRate) : 0);
    const subtotal = storedSubtotal !== null ? storedSubtotal : (totalAmount - gstAmount);

    y += 5; pdf.line(15, y, 200, y); y += 6;
    pdf.setFont(undefined, 'bold'); pdf.text('Subtotal:', 155, y, { align: 'right' });
    pdf.setFont(undefined, 'normal'); pdf.text(`Rs.${formatIndianCurrency(subtotal)}`, 195, y, { align: 'right' });
    if (taxMode === 'with-tax' && gstRate > 0) {
        y += 6;
        pdf.setFont(undefined, 'bold'); pdf.text(`SGST (${gstRate / 2}%):`, 155, y, { align: 'right' });
        pdf.setFont(undefined, 'normal'); pdf.text(`Rs.${formatIndianCurrency(gstAmount / 2)}`, 195, y, { align: 'right' });
        y += 6;
        pdf.setFont(undefined, 'bold'); pdf.text(`CGST (${gstRate / 2}%):`, 155, y, { align: 'right' });
        pdf.setFont(undefined, 'normal'); pdf.text(`Rs.${formatIndianCurrency(gstAmount / 2)}`, 195, y, { align: 'right' });
    }
    y += 6; pdf.line(155, y, 200, y); y += 6;
    pdf.setFont(undefined, 'bold'); pdf.setFontSize(11);
    pdf.text('Grand Total:', 155, y, { align: 'right' });
    pdf.text(`Rs.${formatIndianCurrency(totalAmount)}`, 195, y, { align: 'right' });
    y += 15; pdf.setFontSize(8); pdf.setFont(undefined, 'italic');
    pdf.text('Thank you for your business!', 105, y, { align: 'center' });
}

// ─── Notifications ────────────────────────────────────────────────────────────

function setupNotificationListeners() {
    const btn = document.getElementById('notificationBtn');
    const dropdown = document.getElementById('notificationDropdown');
    if (btn) btn.addEventListener('click', e => { e.stopPropagation(); dropdown?.classList.toggle('show'); });
    document.addEventListener('click', e => {
        if (dropdown && !dropdown.contains(e.target) && !btn?.contains(e.target)) {
            dropdown.classList.remove('show');
        }
    });
}

function markAllAsRead() {
    const items = document.querySelectorAll('.notification-item.unread');
    items.forEach(i => i.classList.remove('unread'));
    const badge = document.getElementById('notificationBadge');
    if (badge) { badge.style.display = 'none'; badge.textContent = '0'; }
}

// ─── Sidebar Toggle ───────────────────────────────────────────────────────────

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
    [mobileToggle, mobileMenuBtn].forEach(btn => {
        if (btn) btn.addEventListener('click', () => {
            sidebar.classList.add('show');
            overlay?.classList.add('show');
        });
    });
    if (overlay) overlay.addEventListener('click', () => {
        sidebar.classList.remove('show');
        overlay.classList.remove('show');
    });
    document.querySelectorAll('.nav-item').forEach(item => item.addEventListener('click', () => {
        if (window.innerWidth <= 768) {
            sidebar.classList.remove('show');
            overlay?.classList.remove('show');
        }
    }));
    if (window.innerWidth > 768 && localStorage.getItem('sidebarCollapsed') === 'true') {
        sidebar.classList.add('collapsed');
    }
}

// ─── Logout ───────────────────────────────────────────────────────────────────

async function logout() {
    await supabaseSignOut();
    window.location.href = 'login.html';
}

// ─── Backup stubs (used by nav) ───────────────────────────────────────────────

async function exportBackup() {
    if (typeof downloadSupabaseBackup === 'function') {
        const result = await downloadSupabaseBackup();
        if (result.success) showSuccess('Backup downloaded');
        else showError('Backup failed: ' + result.error);
    }
}

async function importBackup(event) {
    const file = event.target.files[0];
    if (!file) return;
    showDialog({ title: 'Restore Not Available', message: 'Please use the Supabase Dashboard to manage your data.', type: 'info' });
    event.target.value = '';
}
