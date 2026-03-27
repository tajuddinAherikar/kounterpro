// Create / Edit Quotation Script

let itemCounter = 1;
let inventory = [];
let customers = [];
let userProfile = null;
let editingQuoteId = null;
let savedQuoteData = null;
let taxMode = 'with-tax';
let selectedCustomerId = null;

// ─── Bootstrap ────────────────────────────────────────────────────────────────

document.addEventListener('DOMContentLoaded', async () => {
    const urlParams = new URLSearchParams(window.location.search);
    const isEditMode = urlParams.get('mode') === 'edit';

    if (isEditMode) {
        document.getElementById('pageTitle').textContent = 'Edit Quotation';
        document.querySelector('.mobile-header-title').textContent = 'Edit Quotation';
    }

    // Set default dates
    const today = new Date();
    const yyyy = today.getFullYear();
    const mm = String(today.getMonth() + 1).padStart(2, '0');
    const dd = String(today.getDate()).padStart(2, '0');
    const todayStr = `${yyyy}-${mm}-${dd}`;

    document.getElementById('quoteDate').value = todayStr;

    // Default valid-until = today + 30 days
    const validDate = new Date(today);
    validDate.setDate(validDate.getDate() + 30);
    const vy = validDate.getFullYear();
    const vm = String(validDate.getMonth() + 1).padStart(2, '0');
    const vd = String(validDate.getDate()).padStart(2, '0');
    document.getElementById('validUntil').value = `${vy}-${vm}-${vd}`;

    // Load user profile
    try {
        const user = await supabaseGetCurrentUser();
        if (user) {
            const profileResult = await supabaseGetUserProfile(user.id);
            if (profileResult.success) userProfile = profileResult.data;
        }
    } catch (_) {}

    // Generate quote number (unless editing)
    if (!isEditMode) {
        const qNum = await supabaseGenerateQuoteNumber();
        document.getElementById('quoteNumber').value = qNum;
    }

    // Setup editable quote number
    const editBtn = document.getElementById('editQuoteNumberBtn');
    const quoteNumberInput = document.getElementById('quoteNumber');
    editBtn.addEventListener('click', () => {
        quoteNumberInput.removeAttribute('readonly');
        quoteNumberInput.focus();
        editBtn.textContent = '✓ Done';
        editBtn.onclick = () => {
            quoteNumberInput.setAttribute('readonly', true);
            editBtn.innerHTML = '<span class="material-icons">edit</span> Edit';
            editBtn.onclick = null;
            editBtn.addEventListener('click', arguments.callee);
        };
    });

    // Tax mode toggle (GST ON/OFF switch)
    // handleGstToggle is defined below — called via onchange in HTML

    // Add event listeners to the initial row
    const initialRow = document.querySelector('.item-row');
    if (initialRow) addItemEventListeners(initialRow);

    // Load customers and inventory
    await Promise.all([loadCustomers(), loadInventory()]);
    initCustomerAutocomplete();

    // Load editing data if in edit mode
    if (isEditMode) {
        loadQuoteForEditing();
    }

    // Sync taxMode with checkbox actual state (handles browser back/forward cache
    // restoring the checkbox to a previous state while JS resets taxMode to default)
    const gstCheckInit = document.getElementById('gstToggleCheck');
    if (gstCheckInit) {
        taxMode = gstCheckInit.checked ? 'with-tax' : 'without-tax';
        const statusEl = document.getElementById('gstToggleStatus');
        if (statusEl) statusEl.textContent = gstCheckInit.checked ? 'ON' : 'OFF';
    }
    updateTaxModeDisplay();

    // Form submit
    document.getElementById('quotationForm').addEventListener('submit', handleFormSubmit);
});

// ─── Load Data ────────────────────────────────────────────────────────────────

async function loadCustomers() {
    try {
        const result = await supabaseGetCustomers();
        if (result.success) {
            customers = result.data.map(c => ({
                id: c.id,
                name: c.name || '',
                mobile: c.mobile || '',
                address: c.address || '',
                gst: c.gst_number || c.gst || ''
            }));
        }
    } catch (_) { customers = []; }
}

async function loadInventory() {
    try {
        const result = await supabaseGetInventory();
        if (result.success) {
            inventory = result.data.map(item => ({
                id: item.id,
                name: item.name,
                description: item.description,
                stock: item.stock,
                rate: parseFloat(item.sale_price || item.rate || 0),
                lowStockThreshold: item.low_stock_threshold || 10
            }));
        }
    } catch (_) { inventory = []; }
}

// ─── Edit Mode ────────────────────────────────────────────────────────────────

function loadQuoteForEditing() {
    const raw = sessionStorage.getItem('editingQuotation');
    if (!raw) { window.location.href = 'quotations.html'; return; }

    try {
        const quote = JSON.parse(raw);
        editingQuoteId = quote.id;

        document.getElementById('quoteNumber').value = quote.quote_number || '';
        document.getElementById('quoteDate').value = quote.date?.split('T')[0] || '';
        document.getElementById('validUntil').value = quote.valid_until?.split('T')[0] || '';
        document.getElementById('customerName').value = quote.customer_name || '';
        document.getElementById('customerSearch').value = quote.customer_name || '';
        document.getElementById('customerMobile').value = quote.customer_mobile || '';
        document.getElementById('customerAddress').value = quote.customer_address || '';
        document.getElementById('customerGST').value = quote.customer_gst || '';
        document.getElementById('quotationNotes').value = quote.notes || '';
        const discountField = document.getElementById('discountAmount');
        if (discountField && parseFloat(quote.discount_percent) > 0) discountField.value = quote.discount_percent;
        else if (discountField && parseFloat(quote.discount_amount) > 0) discountField.value = quote.discount_amount;

        // Tax mode
        const mode = quote.tax_mode || 'with-tax';
        taxMode = mode;
        const gstCheck = document.getElementById('gstToggleCheck');
        const gstStatus = document.getElementById('gstToggleStatus');
        if (gstCheck) gstCheck.checked = (mode === 'with-tax');
        if (gstStatus) gstStatus.textContent = (mode === 'with-tax') ? 'ON' : 'OFF';
        updateTaxModeDisplay();

        const gstRate = parseFloat(quote.gst_rate || 18);
        document.getElementById('sgstRate').value = (gstRate / 2).toFixed(2);
        document.getElementById('cgstRate').value = (gstRate / 2).toFixed(2);

        // Populate items
        const tbody = document.getElementById('itemsTableBody');
        tbody.innerHTML = '';
        itemCounter = 0;

        const items = typeof quote.items === 'string' ? JSON.parse(quote.items) : (quote.items || []);
        items.forEach(item => {
            itemCounter++;
            const row = createItemRow(itemCounter, item);
            tbody.appendChild(row);
            addItemEventListeners(row);
        });

        calculateAmounts();
    } catch (e) {
        console.error('Error loading quote for editing', e);
        window.location.href = 'quotations.html';
    }
}

// ─── Items Table ──────────────────────────────────────────────────────────────

function createItemRow(num, item = {}) {
    const row = document.createElement('tr');
    row.className = 'item-row';
    row.setAttribute('data-row', num);
    row.innerHTML = `
        <td class="item-slno" data-label="Sl no">${num}</td>
        <td data-label="Description">
            <span class="mobile-field-label">Description</span>
            <input type="text" class="item-description" value="${escapeHtml(item.description || item.name || '')}" required>
            <span class="error-message item-error"></span>
        </td>
        <td data-label="HSN Code">
            <span class="mobile-field-label">HSN</span>
            <input type="text" class="item-hsn" value="${escapeHtml(item.hsn_code || '')}" placeholder="–" maxlength="8">
        </td>
        <td data-label="Quantity">
            <span class="mobile-field-label">Qty</span>
            <div class="qty-stepper">
                <button type="button" class="qty-btn qty-dec" onclick="stepQty(this,-1)">−</button>
                <input type="number" class="item-quantity" min="1" value="${item.quantity || 1}" required>
                <button type="button" class="qty-btn qty-inc" onclick="stepQty(this,1)">+</button>
            </div>
            <span class="error-message item-error"></span>
        </td>
        <td data-label="Rate (₹)">
            <span class="mobile-field-label">Rate (₹)</span>
            <input type="number" class="item-rate" min="0" step="0.01" value="${item.rate || ''}" required>
            <span class="error-message item-error"></span>
        </td>
        <td data-label="Disc (%)">
            <span class="mobile-field-label">Disc %</span>
            <input type="number" class="item-discount" min="0" max="100" step="0.1" placeholder="0" value="${item.discount_percent || 0}">
        </td>
        <td class="col-gst-pct" data-label="GST %">
            <span class="mobile-field-label">GST %</span>
            <select class="item-gst">
                <option value="0" ${(item.gst_rate||18)==0?'selected':''}>0%</option>
                <option value="5" ${(item.gst_rate||18)==5?'selected':''}>5%</option>
                <option value="12" ${(item.gst_rate||18)==12?'selected':''}>12%</option>
                <option value="18" ${(item.gst_rate==null||item.gst_rate===18)?'selected':''}>18%</option>
                <option value="28" ${(item.gst_rate||18)==28?'selected':''}>28%</option>
            </select>
        </td>
        <td class="item-amount" data-label="Amount (₹)">
            <span class="mobile-field-label">Amount (₹)</span>
            <span class="item-amount-value">0.00</span>
        </td>
        <td data-label="Action"><button type="button" class="btn-remove" onclick="removeItem(${num})">✕</button></td>
    `;
    return row;
}

function addItem() {
    itemCounter++;
    const tbody = document.getElementById('itemsTableBody');
    const row = createItemRow(itemCounter);
    tbody.appendChild(row);
    addItemEventListeners(row);
    calculateAmounts();
}

function removeItem(rowNumber) {
    const rows = document.querySelectorAll('.item-row');
    if (rows.length === 1) { alert('At least one item is required'); return; }
    document.querySelector(`[data-row="${rowNumber}"]`)?.remove();
    renumberRows();
    calculateAmounts();
}

function renumberRows() {
    const rows = document.querySelectorAll('.item-row');
    rows.forEach((row, index) => {
        const slNo = row.querySelector('.item-slno');
        if (slNo) slNo.textContent = index + 1;
        row.setAttribute('data-row', index + 1);
        const removeBtn = row.querySelector('.btn-remove');
        if (removeBtn) removeBtn.setAttribute('onclick', `removeItem(${index + 1})`);
    });
    itemCounter = rows.length;
}

function addItemEventListeners(row) {
    row.querySelector('.item-quantity')?.addEventListener('input', calculateAmounts);
    row.querySelector('.item-rate')?.addEventListener('input', calculateAmounts);
    row.querySelector('.item-discount')?.addEventListener('input', calculateAmounts);
    row.querySelector('.item-gst')?.addEventListener('change', calculateAmounts);
    setupInventoryAutocomplete(row.querySelector('.item-description'), row.querySelector('.item-rate'), row.querySelector('.item-quantity'));
}

// ─── Calculations ─────────────────────────────────────────────────────────────

function calculateAmounts() {
    const rows = document.querySelectorAll('.item-row');
    const sgstRate = parseFloat(document.getElementById('sgstRate').value) || 0;
    const cgstRate = parseFloat(document.getElementById('cgstRate').value) || 0;
    const totalGstRate = sgstRate + cgstRate;

    if (taxMode === 'with-tax') {
        let subtotalExcl = 0, grandTotal = 0, totalGstAmount = 0;

        rows.forEach(row => {
            const qty = parseFloat(row.querySelector('.item-quantity').value) || 0;
            const rateIncl = parseFloat(row.querySelector('.item-rate').value) || 0;
            const itemGstPct = parseFloat(row.querySelector('.item-gst')?.value) || 0;
            const gstMultiplier = 1 + itemGstPct / 100;
            const rateExcl = rateIncl / gstMultiplier;
            const discPct = parseFloat(row.querySelector('.item-discount')?.value) || 0;
            const discMult = 1 - discPct / 100;
            const amtIncl = qty * rateIncl * discMult;
            const amtExcl = qty * rateExcl * discMult;

            const amtEl = row.querySelector('.item-amount-value');
            if (amtEl) amtEl.textContent = formatIndianCurrency(amtIncl);
            subtotalExcl += amtExcl;
            grandTotal += amtIncl;
            totalGstAmount += amtIncl - amtExcl;
        });

        const sgstAmt = totalGstAmount / 2;
        const cgstAmt = totalGstAmount / 2;

        // Total discount saved (on incl-GST price)
        let totalDiscountSaved = 0;
        rows.forEach(row => {
            const qtyD = parseFloat(row.querySelector('.item-quantity').value) || 0;
            const rateD = parseFloat(row.querySelector('.item-rate').value) || 0;
            const discD = parseFloat(row.querySelector('.item-discount')?.value) || 0;
            totalDiscountSaved += qtyD * rateD * (discD / 100);
        });
        const discountRowEl = document.getElementById('discountRow');
        if (discountRowEl) discountRowEl.style.display = totalDiscountSaved > 0 ? 'flex' : 'none';
        const discountSavingEl = document.getElementById('discountSaving');
        if (discountSavingEl) discountSavingEl.textContent = `-₹${formatIndianCurrency(totalDiscountSaved)}`;

        document.getElementById('subtotal').textContent = `₹${formatIndianCurrency(subtotalExcl)}`;
        document.getElementById('sgstAmount').textContent = `₹${formatIndianCurrency(sgstAmt)}`;
        document.getElementById('cgstAmount').textContent = `₹${formatIndianCurrency(cgstAmt)}`;
        document.getElementById('grandTotal').textContent = `₹${formatIndianCurrency(grandTotal)}`;
    } else {
        let grandTotal = 0;
        let totalDiscountSaved = 0;
        rows.forEach(row => {
            const qty = parseFloat(row.querySelector('.item-quantity').value) || 0;
            const rate = parseFloat(row.querySelector('.item-rate').value) || 0;
            const discPct = parseFloat(row.querySelector('.item-discount')?.value) || 0;
            const amt = qty * rate * (1 - discPct / 100);
            totalDiscountSaved += qty * rate * (discPct / 100);
            const amtEl = row.querySelector('.item-amount-value');
            if (amtEl) amtEl.textContent = formatIndianCurrency(amt);
            grandTotal += amt;
        });
        const discountRowEl = document.getElementById('discountRow');
        if (discountRowEl) discountRowEl.style.display = totalDiscountSaved > 0 ? 'flex' : 'none';
        const discountSavingEl = document.getElementById('discountSaving');
        if (discountSavingEl) discountSavingEl.textContent = `-₹${formatIndianCurrency(totalDiscountSaved)}`;
        const discountPct = parseFloat(document.getElementById('discountAmount')?.value) || 0;
        const discountAmt2 = grandTotal * discountPct / 100;
        document.getElementById('grandTotal').textContent = `₹${formatIndianCurrency(Math.max(0, grandTotal - discountAmt2))}`;
    }

    // Update running total
    const itemsTotalEl = document.getElementById('itemsRunningTotal');
    if (itemsTotalEl) {
        const gt = document.getElementById('grandTotal');
        if (gt) itemsTotalEl.textContent = gt.textContent.replace('₹', '');
    }
}

function updateTaxModeDisplay() {
    const withTax = taxMode === 'with-tax';
    const subtotalRow = document.getElementById('subtotalRow');
    const sgstRow = document.getElementById('sgstRow');
    const cgstRow = document.getElementById('cgstRow');
    const grandTotalLabel = document.querySelector('.grand-total span:first-child');
    const table = document.getElementById('itemsTable');
    if (subtotalRow) subtotalRow.style.display = withTax ? 'flex' : 'none';
    if (sgstRow) sgstRow.style.display = withTax ? 'flex' : 'none';
    if (cgstRow) cgstRow.style.display = withTax ? 'flex' : 'none';
    if (grandTotalLabel) grandTotalLabel.textContent = withTax ? 'Total Amount:' : 'Total Amount:';
    if (table) table.classList.toggle('hide-gst-col', !withTax);
}

function handleGstToggle(checkbox) {
    taxMode = checkbox.checked ? 'with-tax' : 'without-tax';
    const statusEl = document.getElementById('gstToggleStatus');
    if (statusEl) statusEl.textContent = checkbox.checked ? 'ON' : 'OFF';
    updateTaxModeDisplay();
    calculateAmounts();
}

function stepQty(btn, delta) {
    const input = btn.closest('.qty-stepper').querySelector('.item-quantity');
    const newVal = Math.max(1, (parseFloat(input.value) || 0) + delta);
    input.value = newVal;
    input.dispatchEvent(new Event('input'));
}

// ─── Form Submit ──────────────────────────────────────────────────────────────

async function handleFormSubmit(e) {
    e.preventDefault();

    // If already saved, just generate PDF
    if (savedQuoteData) {
        generateAndDownloadPDF(savedQuoteData);
        return;
    }

    const submitBtn = document.getElementById('submitBtn');
    const originalHTML = submitBtn.innerHTML;
    submitBtn.innerHTML = '<span class="material-icons">hourglass_empty</span> Saving...';
    submitBtn.disabled = true;

    try {
        const data = collectFormData();

        if (data.items.length === 0) throw new Error('Please add at least one item');

        let result;
        if (editingQuoteId) {
            result = await supabaseUpdateQuotation(editingQuoteId, {
                quote_number: data.quoteNumber,
                date: data.date,
                valid_until: data.validUntil || null,
                customer_name: data.customerName,
                customer_mobile: data.mobile || null,
                customer_gst: data.gstNumber || null,
                customer_address: data.address || null,
                items: data.items,
                subtotal: data.subtotal,
                gst_rate: data.gstRate,
                sgst_amount: data.sgstAmount,
                cgst_amount: data.cgstAmount,
                total_amount: data.totalAmount,
                discount_amount: data.discountAmount || 0,
                tax_mode: data.taxMode,
                notes: data.notes || null
            });
        } else {
            result = await supabaseAddQuotation(data);
        }

        if (!result.success) throw new Error(result.error || 'Failed to save quotation');

        savedQuoteData = data;

        // Show success modal
        document.getElementById('modalQuoteNo').textContent = data.quoteNumber;
        document.getElementById('successModal').style.display = 'flex';

        document.getElementById('downloadPDFBtn').onclick = () => {
            generateAndDownloadPDF(savedQuoteData);
        };

        document.getElementById('whatsappBtn').onclick = () => {
            generateAndDownloadPDF(savedQuoteData);
            const mobile = data.mobile;
            if (!mobile) return;
            const clean = mobile.replace(/[\s\-\+]/g, '');
            const intl = clean.startsWith('91') ? clean : '91' + clean;
            const msg = encodeURIComponent(
                `Hello ${data.customerName},\n\nPlease find the attached quotation ${data.quoteNumber} for ₹${formatIndianCurrency(data.totalAmount)}.\n\nThank you!`
            );
            setTimeout(() => window.open(`https://wa.me/${intl}?text=${msg}`, '_blank'), 600);
        };

        // Disable form
        document.querySelectorAll('#quotationForm input, #quotationForm textarea, #quotationForm select').forEach(el => {
            el.disabled = true;
        });
        document.querySelectorAll('.btn-remove').forEach(btn => btn.disabled = true);

        submitBtn.innerHTML = '<span class="material-icons">picture_as_pdf</span> Download PDF';
        submitBtn.disabled = false;

        if (editingQuoteId) sessionStorage.removeItem('editingQuotation');

    } catch (error) {
        console.error('Save quotation error:', error);
        alert('❌ ' + error.message);
        submitBtn.innerHTML = originalHTML;
        submitBtn.disabled = false;
    }
}

function collectFormData() {
    const sgstRate = parseFloat(document.getElementById('sgstRate').value) || 0;
    const cgstRate = parseFloat(document.getElementById('cgstRate').value) || 0;
    const totalGstRate = sgstRate + cgstRate;

    const rows = document.querySelectorAll('.item-row');
    const items = [];
    rows.forEach(row => {
        const desc = row.querySelector('.item-description').value.trim();
        const qty = parseFloat(row.querySelector('.item-quantity').value) || 0;
        const rate = parseFloat(row.querySelector('.item-rate').value) || 0;
        const hsn = row.querySelector('.item-hsn').value.trim();
        const discPct = parseFloat(row.querySelector('.item-discount')?.value) || 0;
        const gstRate = parseFloat(row.querySelector('.item-gst')?.value) ?? 18;
        if (desc && qty > 0) {
            items.push({ description: desc, quantity: qty, rate, hsn_code: hsn, discount_percent: discPct, gst_rate: gstRate });
        }
    });

    const grandTotalText = document.getElementById('grandTotal').textContent;
    const totalAmount = parseFloat(grandTotalText.replace(/[₹,]/g, '')) || 0;
    const subtotalText = document.getElementById('subtotal').textContent;
    const subtotal = taxMode === 'with-tax' ? (parseFloat(subtotalText.replace(/[₹,]/g, '')) || 0) : totalAmount;
    const gstMultiplier = 1 + totalGstRate / 100;
    const sgstAmount = taxMode === 'with-tax' ? subtotal * (sgstRate / 100) : 0;
    const cgstAmount = taxMode === 'with-tax' ? subtotal * (cgstRate / 100) : 0;

    return {
        quoteNumber: document.getElementById('quoteNumber').value.trim(),
        date: document.getElementById('quoteDate').value,
        validUntil: document.getElementById('validUntil').value || null,
        customerId: selectedCustomerId || null,
        customerName: (document.getElementById('customerName').value || document.getElementById('customerSearch').value).trim(),
        mobile: document.getElementById('customerMobile').value.trim() || null,
        address: document.getElementById('customerAddress').value.trim() || null,
        gstNumber: document.getElementById('customerGST').value.trim() || null,
        items,
        subtotal,
        gstRate: totalGstRate,
        sgstAmount,
        cgstAmount,
        totalAmount,
        taxMode,
        notes: document.getElementById('quotationNotes').value.trim() || null,
        discountAmount: 0
    };
}

// ─── PDF Generation ───────────────────────────────────────────────────────────

async function generateAndDownloadPDF(data) {
    if (!window.jspdf) {
        const msg = 'PDF library not loaded. Please check your internet connection and refresh the page.';
        if (typeof showToast === 'function') showToast('❌ ' + msg, 'error', 6000);
        else alert('❌ ' + msg);
        return;
    }
    const btn = document.getElementById('downloadPDFBtn');
    const origLabel = btn ? btn.innerHTML : null;
    try {
        if (btn) { btn.disabled = true; btn.innerHTML = '<span class="material-icons">hourglass_empty</span> Generating…'; }

        const profile = userProfile || {};
        const templateType = profile.invoice_template || 'classic';
        const settings = {
            brand_color: profile.brand_color || '#2845D6',
            show_logo: !!(profile.show_logo && profile.logo_url),
            logo_url: profile.logo_url || null
        };

        // Map collectFormData shape → renderQuotationTemplate shape
        const sgstRate = data.taxMode === 'with-tax' ? (data.gstRate / 2) : 0;
        const cgstRate = sgstRate;

        // Compute per-item amount (applying discount)
        const mappedItems = data.items.map(item => {
            const base = item.quantity * item.rate;
            const discounted = base * (1 - (item.discount_percent || 0) / 100);
            return {
                description: item.description,
                hsn_code: item.hsn_code || '',
                quantity: item.quantity,
                rate: item.rate,
                discount_percent: item.discount_percent || 0,
                amount: parseFloat(discounted.toFixed(2))
            };
        });

        const quoteData = {
            quoteNumber: data.quoteNumber,
            date: data.date,
            validUntil: data.validUntil || null,
            customerName: data.customerName,
            customerAddress: data.address || '',
            customerMobile: data.mobile || '',
            customerGST: data.gstNumber || '',
            items: mappedItems,
            taxMode: data.taxMode,
            subtotal: data.subtotal,
            sgstRate,
            cgstRate,
            sgstAmount: data.sgstAmount,
            cgstAmount: data.cgstAmount,
            grandTotal: data.totalAmount,
            notes: data.notes || ''
        };

        await renderQuotationTemplate(templateType, quoteData, profile, settings);
    } catch (error) {
        console.error('Error generating quotation PDF:', error);
        const msg = error.message || 'Unknown error';
        if (typeof showToast === 'function') showToast('❌ Failed to generate PDF: ' + msg, 'error', 6000);
        else alert('❌ Failed to generate PDF: ' + msg);
    } finally {
        if (btn && origLabel) { btn.disabled = false; btn.innerHTML = origLabel; }
    }
}

function buildQuotePDF(pdf, data) {
    const profile = userProfile || {};
    let y = 15;

    pdf.setFontSize(18);
    pdf.setFont('helvetica', 'bold');
    pdf.text(profile.business_name || 'Business Name', 105, y, { align: 'center' });
    y += 7;

    pdf.setFontSize(10);
    pdf.setFont('helvetica', 'normal');
    if (profile.business_address) {
        const addrLines = pdf.splitTextToSize(profile.business_address, 160);
        pdf.text(addrLines, 105, y, { align: 'center' });
        y += addrLines.length * 5;
    }
    if (profile.mobile)      { pdf.text(`Phone: ${profile.mobile}`, 105, y, { align: 'center' }); y += 5; }
    if (profile.gst_number)  { pdf.text(`GST No: ${profile.gst_number}`, 105, y, { align: 'center' }); y += 5; }

    y += 4;
    pdf.setLineWidth(0.5);
    pdf.line(10, y, 200, y);
    y += 6;

    pdf.setFontSize(14);
    pdf.setFont('helvetica', 'bold');
    pdf.text('QUOTATION', 105, y, { align: 'center' });
    y += 8;

    pdf.setFontSize(10);
    pdf.setFont('helvetica', 'normal');
    const leftX = 15, rightX = 110;

    pdf.setFont('helvetica', 'bold');
    pdf.text('Quote No:', leftX, y);
    pdf.setFont('helvetica', 'normal');
    pdf.text(data.quoteNumber || '-', leftX + 25, y);

    pdf.setFont('helvetica', 'bold');
    pdf.text('Bill To:', rightX, y);
    y += 6;

    pdf.setFont('helvetica', 'bold');
    pdf.text('Date:', leftX, y);
    pdf.setFont('helvetica', 'normal');
    pdf.text(data.date ? new Date(data.date).toLocaleDateString('en-IN') : '-', leftX + 25, y);

    const custLines = pdf.splitTextToSize(data.customerName || '', 80);
    pdf.text(custLines, rightX, y);
    y += Math.max(6, custLines.length * 5);

    if (data.validUntil) {
        pdf.setFont('helvetica', 'bold');
        pdf.text('Valid Until:', leftX, y);
        pdf.setFont('helvetica', 'normal');
        pdf.text(new Date(data.validUntil).toLocaleDateString('en-IN'), leftX + 28, y);
        y += 6;
    }

    if (data.mobile) { pdf.text(`Ph: ${data.mobile}`, rightX, y); y += 5; }
    if (data.address) {
        const al = pdf.splitTextToSize(data.address, 80);
        pdf.text(al, rightX, y);
        y += al.length * 5;
    }
    if (data.gstNumber) { pdf.text(`GSTIN: ${data.gstNumber}`, rightX, y); y += 5; }

    y += 4;
    pdf.line(10, y, 200, y);
    y += 6;

    // Items table header
    pdf.setFillColor(245, 247, 250);
    pdf.rect(10, y - 2, 190, 8, 'F');
    pdf.setFont('helvetica', 'bold');
    pdf.text('#', 13, y + 3);
    pdf.text('Description', 20, y + 3);
    pdf.text('HSN', 110, y + 3);
    pdf.text('Qty', 132, y + 3);
    pdf.text('Rate', 150, y + 3);
    pdf.text('Amount', 174, y + 3);
    y += 10;

    pdf.setFont('helvetica', 'normal');
    data.items.forEach((item, idx) => {
        const desc = pdf.splitTextToSize(item.description || '', 85);
        const qty = parseFloat(item.quantity) || 0;
        const rate = parseFloat(item.rate) || 0;
        const amt = qty * rate;

        pdf.text(String(idx + 1), 13, y + 3);
        pdf.text(desc, 20, y + 3);
        pdf.text(item.hsn_code || '', 110, y + 3);
        pdf.text(String(qty), 132, y + 3);
        pdf.text(formatIndianCurrency(rate), 148, y + 3, { align: 'right' });
        pdf.text(formatIndianCurrency(amt), 198, y + 3, { align: 'right' });

        y += Math.max(7, desc.length * 5);
        if (y > 260) { pdf.addPage(); y = 20; }
    });

    y += 2;
    pdf.line(10, y, 200, y);
    y += 5;

    // Totals
    if (data.taxMode === 'with-tax') {
        pdf.text('Subtotal (excl. GST):', 140, y);
        pdf.text(`Rs.${formatIndianCurrency(data.subtotal)}`, 198, y, { align: 'right' });
        y += 6;
        if (data.sgstAmount > 0) {
            pdf.text('SGST:', 140, y);
            pdf.text(`Rs.${formatIndianCurrency(data.sgstAmount)}`, 198, y, { align: 'right' });
            y += 6;
            pdf.text('CGST:', 140, y);
            pdf.text(`Rs.${formatIndianCurrency(data.cgstAmount)}`, 198, y, { align: 'right' });
            y += 6;
        }
    }

    if (data.taxMode === 'with-tax') {
        pdf.text('Subtotal (excl. GST):', 140, y);
        pdf.text(`Rs.${formatIndianCurrency(data.subtotal)}`, 198, y, { align: 'right' });
        y += 6;
        if (data.sgstAmount > 0) {
            pdf.text('SGST:', 140, y);
            pdf.text(`Rs.${formatIndianCurrency(data.sgstAmount)}`, 198, y, { align: 'right' });
            y += 6;
            pdf.text('CGST:', 140, y);
            pdf.text(`Rs.${formatIndianCurrency(data.cgstAmount)}`, 198, y, { align: 'right' });
            y += 6;
        }
    }

    pdf.setFont('helvetica', 'bold');
    pdf.text('Total Amount:', 140, y);
    pdf.text(`Rs.${formatIndianCurrency(data.totalAmount)}`, 198, y, { align: 'right' });
    y += 10;

    if (data.notes) {
        pdf.setLineWidth(0.3);
        pdf.line(10, y, 200, y);
        y += 6;
        pdf.setFont('helvetica', 'bold');
        pdf.text('Notes / Terms:', 15, y);
        y += 5;
        pdf.setFont('helvetica', 'normal');
        pdf.setFontSize(9);
        const nl = pdf.splitTextToSize(data.notes, 180);
        pdf.text(nl, 15, y);
    }
}

// ─── Customer Autocomplete ────────────────────────────────────────────────────

function initCustomerAutocomplete() {
    const searchInput = document.getElementById('customerSearch');
    const customerNameInput = document.getElementById('customerName');
    const suggestionsDiv = document.getElementById('customerSuggestions');

    if (!searchInput) return;

    searchInput.addEventListener('input', function () {
        const val = this.value.toLowerCase().trim();
        suggestionsDiv.innerHTML = '';
        suggestionsDiv.style.display = 'none';
        if (val.length < 1) return;

        const matches = customers.filter(c =>
            c.name.toLowerCase().includes(val) || c.mobile.includes(val)
        );
        if (matches.length === 0) return;

        suggestionsDiv.innerHTML = matches.slice(0, 5).map(c => `
            <div class="autocomplete-item" data-customer-id="${c.id}" style="cursor:pointer;">
                <div style="font-weight:600;">👤 ${c.name}</div>
                <div style="font-size:12px;color:#666;">📱 ${c.mobile}</div>
            </div>
        `).join('');
        suggestionsDiv.style.display = 'block';

        suggestionsDiv.querySelectorAll('.autocomplete-item').forEach(item => {
            item.addEventListener('click', function (e) {
                e.stopPropagation();
                const cid = this.getAttribute('data-customer-id');
                const customer = customers.find(c => c.id === cid);
                if (customer) {
                    searchInput.value = customer.name;
                    customerNameInput.value = customer.name;
                    document.getElementById('customerMobile').value = customer.mobile;
                    document.getElementById('customerAddress').value = customer.address || '';
                    document.getElementById('customerGST').value = customer.gst || '';
                    selectedCustomerId = customer.id;
                }
                suggestionsDiv.style.display = 'none';
            });
        });
    });

    searchInput.addEventListener('blur', function () {
        customerNameInput.value = this.value;
        setTimeout(() => { suggestionsDiv.style.display = 'none'; }, 200);
    });
}

// ─── Inventory Autocomplete ───────────────────────────────────────────────────

function setupInventoryAutocomplete(input, rateInput, quantityInput) {
    if (!input) return;
    let container = document.createElement('div');
    container.className = 'autocomplete-items';
    container.style.position = 'fixed';
    document.body.appendChild(container);

    function positionDropdown() {
        const rect = input.getBoundingClientRect();
        container.style.top = rect.bottom + 'px';
        container.style.left = rect.left + 'px';
        container.style.width = rect.width + 'px';
    }

    input.addEventListener('input', function () {
        const val = this.value.toLowerCase();
        container.innerHTML = '';
        container.style.display = 'none';
        if (!val) return;

        const matches = inventory.filter(item =>
            item.name.toLowerCase().includes(val) ||
            (item.description && item.description.toLowerCase().includes(val))
        );
        if (matches.length === 0) return;

        positionDropdown();
        container.style.display = 'block';

        matches.forEach(item => {
            const div = document.createElement('div');
            div.className = 'autocomplete-item';
            div.innerHTML = `
                <strong>${item.name}</strong>
                ${item.description ? '<br><small>' + item.description + '</small>' : ''}
                <br><small>Stock: ${item.stock} | Rate: ₹${formatIndianCurrency(item.rate)}</small>
            `;
            div.addEventListener('click', () => {
                input.value = item.name;
                rateInput.value = item.rate.toFixed(2);
                quantityInput.value = 1;
                calculateAmounts();
                container.style.display = 'none';
            });
            container.appendChild(div);
        });
    });

    document.addEventListener('click', e => {
        if (!input.contains(e.target) && !container.contains(e.target)) {
            container.style.display = 'none';
        }
    });
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

function escapeHtml(str) {
    if (!str) return '';
    return String(str)
        .replace(/&/g, '&amp;')
        .replace(/</g, '&lt;')
        .replace(/>/g, '&gt;')
        .replace(/"/g, '&quot;');
}
