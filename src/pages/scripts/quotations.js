// Quotations Page — Full Quotation Management

const PAGE_SIZE = 10;
let currentPage = 1;
let allQuotesCache = [];
let filteredQuotes = [];
let currentQuoteForPDF = null;
let userProfile = null;

// ─── Bootstrap ────────────────────────────────────────────────────────────────

document.addEventListener('DOMContentLoaded', async () => {
    setupSidebarToggle();
    setupSearchListener();
    await loadQuotations();
});

async function loadQuotations() {
    showTableLoading();

    const result = await supabaseGetQuotations();
    allQuotesCache = result.success ? result.data : [];

    allQuotesCache.sort((a, b) => new Date(b.created_at) - new Date(a.created_at));
    filteredQuotes = [...allQuotesCache];

    currentPage = 1;
    renderTable();
    renderPagination();
    updateCountLabel();

    const user = await supabaseGetCurrentUser();
    if (user) {
        const profileResult = await supabaseGetUserProfile(user.id);
        if (profileResult.success) userProfile = profileResult.data;
    }
}

// ─── Table Rendering ──────────────────────────────────────────────────────────

function showTableLoading() {
    const tbody = document.getElementById('quotesTableBody');
    if (!tbody) return;
    tbody.innerHTML = Array(4).fill(0).map(() => `
        <tr>
            ${Array(7).fill('<td><div class="skeleton skeleton-text"></div></td>').join('')}
        </tr>
    `).join('');
}

function renderTable() {
    const tbody = document.getElementById('quotesTableBody');
    if (!tbody) return;

    const start = (currentPage - 1) * PAGE_SIZE;
    const pageData = filteredQuotes.slice(start, start + PAGE_SIZE);

    tbody.innerHTML = '';

    if (filteredQuotes.length === 0) {
        tbody.innerHTML = `
            <tr>
                <td colspan="7" style="text-align:center;padding:48px;color:#999;">
                    <span class="material-icons" style="font-size:52px;color:#ddd;">request_quote</span>
                    <p style="margin-top:16px;font-size:15px;">No quotations found.</p>
                    <a href="create-quotation.html" class="btn-primary" style="display:inline-flex;align-items:center;gap:8px;margin-top:12px;text-decoration:none;">
                        <span class="material-icons">add</span> Create First Quotation
                    </a>
                </td>
            </tr>
        `;
        return;
    }

    pageData.forEach(q => tbody.appendChild(buildRow(q)));
}

function statusLabel(status) {
    return { draft: 'Draft', sent: 'Sent', accepted: 'Accepted', rejected: 'Rejected' }[status] || 'Draft';
}

function statusClass(status) {
    return { draft: 'status-draft', sent: 'status-sent', accepted: 'status-accepted', rejected: 'status-rejected' }[status] || 'status-draft';
}

function buildRow(quote) {
    const row = document.createElement('tr');
    const date = quote.date ? new Date(quote.date).toLocaleDateString('en-IN') : '-';
    const validUntil = quote.valid_until ? new Date(quote.valid_until).toLocaleDateString('en-IN') : '-';
    const amount = parseFloat(quote.total_amount) || 0;
    const isExpired = quote.valid_until && new Date(quote.valid_until) < new Date() && quote.status === 'sent';

    row.innerHTML = `
        <td data-label="Quote No">
            <span class="mobile-field-label">Quote No</span>
            <div class="field-value"><strong>${quote.quote_number || '-'}</strong></div>
        </td>
        <td data-label="Customer">
            <span class="mobile-field-label">Customer</span>
            <div class="field-value">${quote.customer_name || '-'}</div>
        </td>
        <td data-label="Amount">
            <span class="mobile-field-label">Amount</span>
            <div class="field-value">₹${formatIndianCurrency(amount)}</div>
        </td>
        <td data-label="Date">
            <span class="mobile-field-label">Date</span>
            <div class="field-value">${date}</div>
        </td>
        <td data-label="Valid Until">
            <span class="mobile-field-label">Valid Until</span>
            <div class="field-value" style="${isExpired ? 'color:#dc2626;font-weight:600;' : ''}">${validUntil}</div>
        </td>
        <td data-label="Status">
            <span class="mobile-field-label">Status</span>
            <div class="field-value"><span class="status-badge ${statusClass(quote.status)}">${statusLabel(quote.status)}</span></div>
        </td>
        <td class="action-cell" data-label="Actions">
            <span class="mobile-field-label">Actions</span>
            <div class="field-value card-actions">
                <a href="#" class="action-link view-link" data-id="${quote.id}">
                    <span class="material-icons">visibility</span> View
                </a>
                <a href="#" class="action-link edit-link" data-id="${quote.id}">
                    <span class="material-icons">edit</span> Edit
                </a>
                <a href="#" class="action-link status-link" data-id="${quote.id}">
                    <span class="material-icons">swap_horiz</span> Status
                </a>
                <a href="#" class="action-link delete-link" data-id="${quote.id}">
                    <span class="material-icons">delete</span>
                </a>
            </div>
        </td>
    `;

    row.querySelector('.view-link').addEventListener('click', e => { e.preventDefault(); viewQuote(quote.id); });
    row.querySelector('.edit-link').addEventListener('click', e => { e.preventDefault(); editQuote(quote.id); });
    row.querySelector('.status-link').addEventListener('click', e => { e.preventDefault(); changeStatus(quote.id, quote.status); });
    row.querySelector('.delete-link').addEventListener('click', e => { e.preventDefault(); deleteQuote(quote.id); });

    return row;
}

// ─── Pagination ───────────────────────────────────────────────────────────────

function renderPagination() {
    const wrapper = document.getElementById('paginationWrapper');
    const container = document.getElementById('paginationContainer');
    const infoEl = document.getElementById('paginationInfo');
    if (!wrapper || !container) return;

    const totalPages = Math.ceil(filteredQuotes.length / PAGE_SIZE);
    const start = filteredQuotes.length ? (currentPage - 1) * PAGE_SIZE + 1 : 0;
    const end = Math.min(currentPage * PAGE_SIZE, filteredQuotes.length);

    if (infoEl) {
        infoEl.textContent = filteredQuotes.length > 0
            ? `Showing ${start}–${end} of ${filteredQuotes.length} quotation${filteredQuotes.length !== 1 ? 's' : ''}`
            : '';
    }

    if (totalPages <= 1) { wrapper.style.display = 'none'; return; }

    wrapper.style.display = 'flex';

    const pageNumbers = buildPageNumbers(currentPage, totalPages);
    let html = `<button class="pagination-btn" onclick="goToPage(${currentPage - 1})" ${currentPage === 1 ? 'disabled' : ''}>
        <span class="material-icons" style="font-size:16px;">chevron_left</span> Prev</button>`;
    pageNumbers.forEach(p => {
        if (p === '...') html += `<span class="pagination-ellipsis">…</span>`;
        else html += `<button class="pagination-btn ${p === currentPage ? 'active' : ''}" onclick="goToPage(${p})">${p}</button>`;
    });
    html += `<button class="pagination-btn" onclick="goToPage(${currentPage + 1})" ${currentPage === totalPages ? 'disabled' : ''}>
        Next <span class="material-icons" style="font-size:16px;">chevron_right</span></button>`;

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
    const totalPages = Math.ceil(filteredQuotes.length / PAGE_SIZE);
    if (page < 1 || page > totalPages) return;
    currentPage = page;
    renderTable();
    renderPagination();
    document.getElementById('quotesTableWrapper')?.scrollIntoView({ behavior: 'smooth', block: 'start' });
}

// ─── Count label ──────────────────────────────────────────────────────────────

function updateCountLabel() {
    const el = document.getElementById('quoteCountLabel');
    if (!el) return;
    const total = allQuotesCache.length;
    el.textContent = total > 0 ? `${total} total quotation${total !== 1 ? 's' : ''}` : '';
}

// ─── Search ───────────────────────────────────────────────────────────────────

function setupSearchListener() {
    const input = document.getElementById('quoteSearch');
    if (!input) return;
    let timer;
    input.addEventListener('input', () => {
        clearTimeout(timer);
        timer = setTimeout(applySearchAndFilter, 250);
    });
}

function applySearchAndFilter() {
    const query = (document.getElementById('quoteSearch')?.value || '').toLowerCase().trim();
    const fromDate = document.getElementById('filterFromDate')?.value;
    const toDate = document.getElementById('filterToDate')?.value;
    const status = document.getElementById('filterStatus')?.value;

    filteredQuotes = allQuotesCache.filter(q => {
        if (query) {
            const match =
                q.quote_number?.toLowerCase().includes(query) ||
                q.customer_name?.toLowerCase().includes(query) ||
                q.customer_mobile?.includes(query);
            if (!match) return false;
        }
        if (fromDate || toDate) {
            const d = q.date?.split('T')[0];
            if (fromDate && d < fromDate) return false;
            if (toDate && d > toDate) return false;
        }
        if (status && q.status !== status) return false;
        return true;
    });

    currentPage = 1;
    renderTable();
    renderPagination();

    const label = document.getElementById('quoteCountLabel');
    if (label) {
        const total = allQuotesCache.length;
        const showing = filteredQuotes.length;
        label.textContent = showing < total
            ? `${showing} of ${total} quotations`
            : `${total} total quotation${total !== 1 ? 's' : ''}`;
    }
}

// ─── Filter Modal ─────────────────────────────────────────────────────────────

function showFilterModal() { document.getElementById('filterModal').classList.add('show'); }
function closeFilterModal() { document.getElementById('filterModal').classList.remove('show'); }
function applyFilter() { closeFilterModal(); applySearchAndFilter(); }
function clearFilter() {
    document.getElementById('filterFromDate').value = '';
    document.getElementById('filterToDate').value = '';
    document.getElementById('filterStatus').value = '';
    closeFilterModal();
    applySearchAndFilter();
}

// ─── Actions ──────────────────────────────────────────────────────────────────

function viewQuote(quoteId) {
    const quote = allQuotesCache.find(q => q.id === quoteId);
    if (!quote) return;
    currentQuoteForPDF = quote;
    generateAndShowPDF(quote);
}

function editQuote(quoteId) {
    const quote = allQuotesCache.find(q => q.id === quoteId);
    if (!quote) return;
    sessionStorage.setItem('editingQuotation', JSON.stringify(quote));
    window.location.href = 'create-quotation.html?mode=edit';
}

async function changeStatus(quoteId, currentStatus) {
    const labels = { draft: 'Draft', sent: 'Sent', accepted: 'Accepted', rejected: 'Rejected' };
    const newStatus = await showStatusPickerDialog(currentStatus);
    if (!newStatus) return;

    const result = await supabaseUpdateQuotation(quoteId, { status: newStatus });
    if (result.success) {
        showSuccess(`Quotation marked as ${labels[newStatus]}`);
        await loadQuotations();
    } else {
        showError('Failed to update status: ' + result.error);
    }
}

async function deleteQuote(quoteId) {
    const quote = allQuotesCache.find(q => q.id === quoteId);
    if (!quote) return;

    const confirmed = await showDeleteConfirm(`quotation ${quote.quote_number}`);
    if (!confirmed) return;

    const result = await supabaseDeleteQuotation(quoteId);
    if (result.success) {
        showSuccess('Quotation deleted');
        await loadQuotations();
    } else {
        showError('Failed to delete: ' + result.error);
    }
}

// ─── PDF Generation ───────────────────────────────────────────────────────────

// Map DB snake_case record → renderQuotationTemplate camelCase shape
function _mapQuoteDbToTemplateData(quote) {
    let items = [];
    try { items = typeof quote.items === 'string' ? JSON.parse(quote.items) : (quote.items || []); } catch (_) {}

    const gstRate = parseFloat(quote.gst_rate) || 0;
    const sgstRate = parseFloat(quote.sgst_rate) || gstRate / 2;
    const cgstRate = parseFloat(quote.cgst_rate) || gstRate / 2;

    const mappedItems = items.map(item => {
        const qty = parseFloat(item.quantity) || 0;
        const rate = parseFloat(item.rate) || 0;
        const discPct = parseFloat(item.discount_percent || item.discount) || 0;
        const base = qty * rate;
        const amount = parseFloat((base * (1 - discPct / 100)).toFixed(2));
        return {
            description: item.description || item.name || '',
            hsn_code: item.hsn_code || '',
            quantity: qty,
            rate,
            discount_percent: discPct,
            amount
        };
    });

    return {
        quoteNumber:     quote.quote_number || '',
        date:            quote.date || '',
        validUntil:      quote.valid_until || null,
        customerName:    quote.customer_name || '',
        customerAddress: quote.customer_address || '',
        customerMobile:  quote.customer_mobile || '',
        customerGST:     quote.customer_gst || '',
        items:           mappedItems,
        taxMode:         quote.tax_mode || 'with-tax',
        subtotal:        parseFloat(quote.subtotal) || 0,
        sgstRate,
        cgstRate,
        sgstAmount:      parseFloat(quote.sgst_amount) || 0,
        cgstAmount:      parseFloat(quote.cgst_amount) || 0,
        grandTotal:      parseFloat(quote.total_amount) || 0,
        notes:           quote.notes || ''
    };
}

async function generateAndShowPDF(quote) {
    const modal = document.getElementById('pdfModal');
    const body = document.getElementById('pdfModalBody');
    body.innerHTML = '<div style="padding:20px;text-align:center;color:#888;">Generating preview…</div>';
    modal.classList.add('show');

    const isNative = !!(window.Capacitor &&
        typeof window.Capacitor.isNativePlatform === 'function' &&
        window.Capacitor.isNativePlatform());

    if (isNative) {
        body.innerHTML = renderQuotationHTMLPreview(quote);
        return;
    }

    // Desktop: build PDF with the template renderer (no save), display in iframe
    const { jsPDF } = window.jspdf;
    const pdf = new jsPDF();
    const profile = userProfile || {};
    const templateType = profile.invoice_template || 'classic';
    const brandColor = profile.brand_color || '#2845D6';
    const settings = {
        brand_color: brandColor,
        show_logo: !!(profile.show_logo && profile.logo_url),
        logo_url: profile.logo_url || null
    };
    const quoteData = _mapQuoteDbToTemplateData(quote);

    switch (templateType) {
        case 'modern':     await renderQuotationModern(pdf, quoteData, profile, brandColor, settings); break;
        case 'gst_format': await renderQuotationGST(pdf, quoteData, profile, brandColor, settings);    break;
        case 'retail':     await renderQuotationRetail(pdf, quoteData, profile, brandColor, settings); break;
        default:           await renderQuotationClassic(pdf, quoteData, profile, brandColor, settings);
    }
    _addQuotationFooter(pdf, quoteData, profile);

    const dataUrl = pdf.output('dataurlstring');
    body.innerHTML = '';
    const iframe = document.createElement('iframe');
    iframe.style.cssText = 'width:100%;height:600px;border:none;';
    iframe.src = dataUrl;
    body.appendChild(iframe);
}

function renderQuotationHTMLPreview(quote) {
    const profile = userProfile || {};
    const brandColor = profile.brand_color || '#2845D6';
    let items = [];
    try { items = typeof quote.items === 'string' ? JSON.parse(quote.items) : (quote.items || []); } catch (_) {}

    const taxMode = quote.tax_mode || 'with-tax';
    const sgstAmount = parseFloat(quote.sgst_amount) || 0;
    const cgstAmount = parseFloat(quote.cgst_amount) || 0;
    const subtotal   = parseFloat(quote.subtotal) || 0;
    const grandTotal = parseFloat(quote.total_amount) || 0;
    const sgstRate   = parseFloat(quote.sgst_rate) || (parseFloat(quote.gst_rate) || 0) / 2;
    const cgstRate   = parseFloat(quote.cgst_rate) || sgstRate;
    const dateStr    = quote.date ? new Date(quote.date).toLocaleDateString('en-IN') : '';
    const validStr   = quote.valid_until ? new Date(quote.valid_until).toLocaleDateString('en-IN') : '';

    const itemRows = items.map((item, idx) => {
        const qty  = parseFloat(item.quantity) || 0;
        const rate = parseFloat(item.rate) || 0;
        const discPct = parseFloat(item.discount_percent || item.discount) || 0;
        const amount = parseFloat((qty * rate * (1 - discPct / 100)).toFixed(2));
        return `
        <tr>
            <td style="padding:6px 4px;border-bottom:1px solid #eee;">${idx + 1}</td>
            <td style="padding:6px 4px;border-bottom:1px solid #eee;">${item.description || item.name || ''}</td>
            <td style="padding:6px 4px;border-bottom:1px solid #eee;text-align:center;">${item.hsn_code || '-'}</td>
            <td style="padding:6px 4px;border-bottom:1px solid #eee;text-align:center;">${qty}</td>
            <td style="padding:6px 4px;border-bottom:1px solid #eee;text-align:right;">₹${formatIndianCurrency(rate)}</td>
            <td style="padding:6px 4px;border-bottom:1px solid #eee;text-align:right;">₹${formatIndianCurrency(amount)}</td>
        </tr>`;
    }).join('');

    const gstRows = (taxMode === 'with-tax' && (sgstAmount + cgstAmount) > 0) ? `
        <tr>
            <td colspan="5" style="text-align:right;padding:4px;">Subtotal (excl. GST):</td>
            <td style="text-align:right;padding:4px;">₹${formatIndianCurrency(subtotal)}</td>
        </tr>
        <tr>
            <td colspan="5" style="text-align:right;padding:4px;">SGST (${sgstRate}%):</td>
            <td style="text-align:right;padding:4px;">₹${formatIndianCurrency(sgstAmount)}</td>
        </tr>
        <tr>
            <td colspan="5" style="text-align:right;padding:4px;">CGST (${cgstRate}%):</td>
            <td style="text-align:right;padding:4px;">₹${formatIndianCurrency(cgstAmount)}</td>
        </tr>` : '';

    return `
    <div style="font-family:sans-serif;font-size:13px;color:#222;padding:12px;">
        <div style="display:flex;justify-content:space-between;align-items:flex-start;margin-bottom:12px;">
            <div>
                <div style="font-size:18px;font-weight:700;color:${brandColor};">${(profile.business_name || 'BUSINESS NAME').toUpperCase()}</div>
                <div style="color:#555;margin-top:2px;">${profile.business_address || ''}</div>
                ${profile.contact_number_1 ? `<div style="color:#555;">Ph: ${profile.contact_number_1}</div>` : ''}
                ${profile.gst_number ? `<div style="color:#555;">GST: ${profile.gst_number}</div>` : ''}
            </div>
            <div style="text-align:right;">
                <div style="font-size:15px;font-weight:700;color:${brandColor};">QUOTATION</div>
                <div>Quote No: <strong>${quote.quote_number || ''}</strong></div>
                <div>Date: ${dateStr}</div>
                ${validStr ? `<div>Valid Until: ${validStr}</div>` : ''}
            </div>
        </div>
        <div style="background:#f3f4f8;border-radius:6px;padding:8px 12px;margin-bottom:12px;">
            <div style="font-weight:600;margin-bottom:4px;">Quoted For:</div>
            <div style="font-weight:500;">${quote.customer_name || ''}</div>
            ${quote.customer_address ? `<div style="color:#555;">${quote.customer_address}</div>` : ''}
            ${quote.customer_mobile  ? `<div style="color:#555;">Ph: ${quote.customer_mobile}</div>` : ''}
            ${quote.customer_gst     ? `<div style="color:#555;">GST: ${quote.customer_gst}</div>`   : ''}
        </div>
        <table style="width:100%;border-collapse:collapse;font-size:12px;">
            <thead>
                <tr style="background:${brandColor};color:#fff;">
                    <th style="padding:6px 4px;text-align:left;">#</th>
                    <th style="padding:6px 4px;text-align:left;">Description</th>
                    <th style="padding:6px 4px;text-align:center;">HSN</th>
                    <th style="padding:6px 4px;text-align:center;">Qty</th>
                    <th style="padding:6px 4px;text-align:right;">Rate</th>
                    <th style="padding:6px 4px;text-align:right;">Amount</th>
                </tr>
            </thead>
            <tbody>${itemRows}</tbody>
            <tfoot>
                ${gstRows}
                <tr style="font-weight:700;font-size:14px;background:#f3f4f8;">
                    <td colspan="5" style="text-align:right;padding:8px 4px;border-top:2px solid ${brandColor};">Grand Total:</td>
                    <td style="text-align:right;padding:8px 4px;border-top:2px solid ${brandColor};color:${brandColor};">₹${formatIndianCurrency(grandTotal)}</td>
                </tr>
            </tfoot>
        </table>
        ${quote.notes ? `<div style="margin-top:12px;padding:8px;background:#fffde7;border-radius:4px;font-size:11px;"><strong>Notes:</strong> ${quote.notes}</div>` : ''}
        <div style="text-align:center;color:#888;font-style:italic;margin-top:16px;font-size:11px;">Thank you for your business!</div>
    </div>`;
}

function closePDFModal() {
    document.getElementById('pdfModal').classList.remove('show');
    currentQuoteForPDF = null;
}

async function downloadCurrentPDF() {
    if (!currentQuoteForPDF) return;
    const profile = userProfile || {};
    const settings = {
        brand_color: profile.brand_color || '#2845D6',
        show_logo: !!(profile.show_logo && profile.logo_url),
        logo_url: profile.logo_url || null
    };
    const quoteData = _mapQuoteDbToTemplateData(currentQuoteForPDF);
    await renderQuotationTemplate(profile.invoice_template || 'classic', quoteData, profile, settings);
}

function sendCurrentViaWhatsApp() {
    if (!currentQuoteForPDF) return;
    downloadCurrentPDF();
    const mobile = currentQuoteForPDF.customer_mobile;
    if (!mobile) { showWarning('No mobile number for this customer'); return; }
    const clean = mobile.replace(/[\s\-\+]/g, '');
    const intl = clean.startsWith('91') ? clean : '91' + clean;
    const msg = encodeURIComponent(
        `Hello ${currentQuoteForPDF.customer_name},\n\nPlease find attached the quotation ${currentQuoteForPDF.quote_number} for ₹${formatIndianCurrency(currentQuoteForPDF.total_amount)}.\n\nThank you for your business!`
    );
    window.open(`https://wa.me/${intl}?text=${msg}`, '_blank');
}

// ─── Helpers ──────────────────────────────────────────────────────────────────

function formatIndianCurrency(amount) {
    const num = parseFloat(amount).toFixed(2);
    const [intPart, dec] = num.split('.');
    const neg = intPart.startsWith('-');
    const abs = neg ? intPart.slice(1) : intPart;
    const result = abs.length <= 3 ? abs : abs.slice(0, -3).replace(/\B(?=(\d{2})+(?!\d))/g, ',') + ',' + abs.slice(-3);
    return (neg ? '-' : '') + result + '.' + dec;
}

function setupSidebarToggle() {
    const sidebar = document.querySelector('.sidebar');
    const overlay = document.getElementById('sidebarOverlay');
    const toggleBtn = document.getElementById('sidebarToggle');
    const mobileToggle = document.getElementById('mobileMenuToggle');
    const mobileMenuBtn = document.getElementById('mobileMenuBtn');

    if (toggleBtn) toggleBtn.addEventListener('click', () => {
        sidebar.classList.toggle('collapsed');
        localStorage.setItem('sidebarCollapsed', sidebar.classList.contains('collapsed'));
    });
    [mobileToggle, mobileMenuBtn].forEach(btn => {
        if (btn) btn.addEventListener('click', () => {
            sidebar.classList.add('show');
            if (overlay) overlay.classList.add('show');
        });
    });
    if (overlay) overlay.addEventListener('click', () => {
        sidebar.classList.remove('show');
        overlay.classList.remove('show');
    });
    if (window.innerWidth > 768 && localStorage.getItem('sidebarCollapsed') === 'true') {
        sidebar.classList.add('collapsed');
    }
}

function showSuccess(msg) { if (typeof showToast === 'function') showToast(msg, 'success'); else alert(msg); }
function showError(msg)   { if (typeof showToast === 'function') showToast(msg, 'error');   else alert(msg); }
function showWarning(msg) { if (typeof showToast === 'function') showToast(msg, 'warning'); else alert(msg); }
