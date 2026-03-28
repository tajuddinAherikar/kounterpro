/**
 * quick-bill.js — Quick Bill page logic
 * Fast billing for walk-in customers with optional thermal print (80mm).
 */

'use strict';

let qbRowCounter = 0;
let qbUserProfile = null;
let qbInventory = [];

// ─── Init ────────────────────────────────────────────────────────────────────

document.addEventListener('DOMContentLoaded', async () => {
    // Set today's date
    const today = new Date().toISOString().split('T')[0];
    document.getElementById('qbDate').value = today;

    // Wait for auth.js to expose userProfile via the global set by checkAuth
    // auth.js sets window.userProfileData after profile load
    await qbWaitForProfile();

    // Generate bill number
    await qbRefreshBillNumber();

    // Load inventory for autocomplete suggestions
    qbLoadInventory();

    // Add first empty row
    qbAddRow();

    // Close autocomplete when clicking outside
    document.addEventListener('click', () => {
        document.querySelectorAll('.autocomplete-items').forEach(el => {
            el.innerHTML = '';
            el.style.display = 'none';
        });
    });
});

async function qbLoadInventory() {
    try {
        const result = await supabaseGetInventory();
        if (result.success) {
            qbInventory = result.data.map(item => ({
                id: item.id,
                name: item.name,
                description: item.description,
                stock: item.stock,
                rate: parseFloat(item.rate),
                gstRate: item.gst_rate != null ? parseFloat(item.gst_rate) : null,
                lowStockThreshold: item.low_stock_threshold
            }));
        }
    } catch (e) {
        console.warn('qbLoadInventory error:', e);
    }
}

async function qbWaitForProfile() {
    try {
        const user = await supabaseGetCurrentUser();
        if (user) {
            const res = await supabaseGetUserProfile(user.id);
            if (res.success && res.data) {
                qbUserProfile = res.data;
            }
        }
    } catch (e) {
        console.warn('qbWaitForProfile error:', e);
    }
}

// ─── Invoice Number ──────────────────────────────────────────────────────────

async function qbRefreshBillNumber() {
    const field = document.getElementById('qbBillNo');
    field.value = 'Generating…';
    try {
        const num = await qbGenerateInvoiceNumber();
        field.value = num;
    } catch (e) {
        console.error('qbGenerateInvoiceNumber error:', e);
        field.value = 'QB-' + Date.now();
    }
}

async function qbGenerateInvoiceNumber() {
    // Offline fallback
    if (!navigator.onLine) {
        return 'DRAFT-' + Date.now();
    }

    // Use cached profile if available
    let profile = qbUserProfile;
    if (!profile) {
        const user = await supabaseGetCurrentUser();
        if (!user) throw new Error('Not authenticated');
        const res = await supabaseGetUserProfile(user.id);
        if (res.success && res.data) {
            profile = res.data;
            qbUserProfile = profile;
        }
    }

    if (profile && profile.invoice_prefix) {
        const startingNumber = profile.starting_invoice_number || 1;
        const currentCounter = profile.current_invoice_counter || 0;
        const nextNumber = startingNumber + currentCounter;
        const padded = String(nextNumber).padStart(4, '0');
        return `${profile.invoice_prefix}-${padded}`;
    }

    // Legacy format: K0001/MM/YY
    const result = await supabaseGetInvoices();
    const now = new Date();
    const mm = String(now.getMonth() + 1).padStart(2, '0');
    const yy = String(now.getFullYear()).slice(-2);

    if (!result.success || !result.data || result.data.length === 0) {
        return `K0001/${mm}/${yy}`;
    }

    // Count invoices this financial year
    const currentMonth = now.getMonth() + 1;
    const currentYear = now.getFullYear();
    let fyStartYear, fyEndYear;
    if (currentMonth >= 4) {
        fyStartYear = currentYear;
        fyEndYear = currentYear + 1;
    } else {
        fyStartYear = currentYear - 1;
        fyEndYear = currentYear;
    }
    const fyStart = new Date(fyStartYear, 3, 1); // April 1
    const fyEnd = new Date(fyEndYear, 2, 31, 23, 59, 59); // March 31

    const fyInvoices = result.data.filter(inv => {
        const d = new Date(inv.date || inv.created_at);
        return d >= fyStart && d <= fyEnd;
    });

    const count = fyInvoices.length + 1;
    const padded = String(count).padStart(4, '0');
    return `K${padded}/${mm}/${yy}`;
}

// ─── Row Management ──────────────────────────────────────────────────────────

function qbAddRow() {
    const idx = qbRowCounter++;
    const tbody = document.getElementById('qbItemsBody');
    const gstVisible = document.getElementById('qbGstToggle').checked;

    const tr = document.createElement('tr');
    tr.dataset.idx = idx;
    tr.innerHTML = `
        <td class="col-desc">
            <input type="text" class="qb-input qb-desc" placeholder="Item description" oninput="qbCalcRow(${idx})">
        </td>
        <td class="col-qty">
            <input type="number" class="qb-input qb-qty" value="1" min="0.01" step="any" oninput="qbCalcRow(${idx})">
        </td>
        <td class="col-rate">
            <input type="number" class="qb-input qb-rate" value="" min="0" step="any" placeholder="0.00" oninput="qbCalcRow(${idx})">
        </td>
        <td class="col-disc">
            <input type="number" class="qb-input qb-disc" value="0" min="0" max="100" step="any" oninput="qbCalcRow(${idx})">
        </td>
        <td class="col-gst qb-gst-col" style="${gstVisible ? '' : 'display:none;'}">
            <select class="qb-input qb-gst-rate" onchange="qbCalcRow(${idx})">
                <option value="0">0%</option>
                <option value="5">5%</option>
                <option value="12">12%</option>
                <option value="18" selected>18%</option>
                <option value="28">28%</option>
            </select>
        </td>
        <td class="col-amt">
            <span class="qb-row-amt" id="qbRowAmt${idx}">₹0.00</span>
        </td>
        <td class="col-del">
            <button type="button" class="btn-del-row" onclick="qbRemoveRow(${idx})" title="Remove">
                <span class="material-icons" style="font-size:18px;">delete_outline</span>
            </button>
        </td>
    `;
    tbody.appendChild(tr);
    // Wire up inventory autocomplete on the description input
    qbSetupDescriptionAutocomplete(tr, idx);
    // Focus description
    tr.querySelector('.qb-desc').focus();
}

// ─── Inventory autocomplete for description inputs ─────────────────────────

function qbSetupDescriptionAutocomplete(tr, idx) {
    const input = tr.querySelector('.qb-desc');
    const rateInput = tr.querySelector('.qb-rate');
    const qtyInput = tr.querySelector('.qb-qty');
    const gstSelect = tr.querySelector('.qb-gst-rate');
    let currentFocus = -1;

    const container = document.createElement('div');
    container.className = 'autocomplete-items';
    container.style.position = 'fixed';
    document.body.appendChild(container);

    function positionDropdown() {
        const rect = input.getBoundingClientRect();
        container.style.top = rect.bottom + 'px';
        container.style.left = rect.left + 'px';
        container.style.width = rect.width + 'px';
    }

    function closeList() {
        container.innerHTML = '';
        container.style.display = 'none';
        currentFocus = -1;
    }

    input.addEventListener('input', function () {
        const val = this.value.toLowerCase().trim();
        closeList();
        if (!val) return;

        const matches = qbInventory.filter(item =>
            item.name.toLowerCase().includes(val) ||
            (item.description && item.description.toLowerCase().includes(val))
        );
        if (matches.length === 0) return;

        positionDropdown();
        container.style.display = 'block';

        matches.forEach(item => {
            const threshold = item.lowStockThreshold || 10;
            let stockBadge, stockClass;
            if (item.stock === 0) {
                stockBadge = '<span style="color:#c62828;font-weight:bold;">🔴 OUT OF STOCK</span>';
                stockClass = 'out-of-stock';
            } else if (item.stock <= threshold) {
                stockBadge = '<span style="color:#f68048;font-weight:bold;">🟡 LOW STOCK</span>';
                stockClass = 'low-stock';
            } else {
                stockBadge = '<span style="color:#28a745;">🟢 In Stock</span>';
                stockClass = 'in-stock';
            }

            const div = document.createElement('div');
            div.className = 'autocomplete-item ' + stockClass;
            div.innerHTML =
                '<strong>' + item.name + '</strong>' +
                (item.description ? '<br><small>' + item.description + '</small>' : '') +
                '<br><small>' + stockBadge + ' | Stock: ' + item.stock + ' units | Rate: ₹' + item.rate.toFixed(2) + '</small>';

            div.addEventListener('mousedown', function (e) {
                e.preventDefault(); // prevent input blur before click fires
                if (item.stock === 0) {
                    alert('❌ Cannot add "' + item.name + '" — Out of stock!');
                    return;
                }
                input.value = item.name;
                rateInput.value = item.rate.toFixed(2);
                qtyInput.value = 1;
                // Set per-item GST rate if the column is visible and item has a GST rate
                if (gstSelect && item.gstRate != null) {
                    gstSelect.value = item.gstRate;
                }
                // Low-stock highlight on qty input
                if (item.stock <= threshold) {
                    qtyInput.style.borderColor = '#f68048';
                    qtyInput.style.backgroundColor = '#fff8f0';
                } else {
                    qtyInput.style.borderColor = '';
                    qtyInput.style.backgroundColor = '';
                }
                qbCalcRow(idx);
                closeList();
                qtyInput.focus();
                qtyInput.select();
            });

            container.appendChild(div);
        });
    });

    input.addEventListener('keydown', function (e) {
        const items = container.getElementsByClassName('autocomplete-item');
        if (e.key === 'ArrowDown') {
            currentFocus = Math.min(currentFocus + 1, items.length - 1);
            Array.from(items).forEach((el, i) => el.classList.toggle('autocomplete-active', i === currentFocus));
            e.preventDefault();
        } else if (e.key === 'ArrowUp') {
            currentFocus = Math.max(currentFocus - 1, 0);
            Array.from(items).forEach((el, i) => el.classList.toggle('autocomplete-active', i === currentFocus));
            e.preventDefault();
        } else if (e.key === 'Enter') {
            if (currentFocus > -1 && items[currentFocus]) {
                items[currentFocus].dispatchEvent(new Event('mousedown'));
            }
        } else if (e.key === 'Escape') {
            closeList();
        }
    });

    input.addEventListener('blur', () => setTimeout(closeList, 150));

    window.addEventListener('scroll', () => { if (container.innerHTML) positionDropdown(); }, true);
    window.addEventListener('resize', () => { if (container.innerHTML) positionDropdown(); });
}

function qbRemoveRow(idx) {
    const tr = document.querySelector(`#qbItemsBody tr[data-idx="${idx}"]`);
    if (tr) tr.remove();
    qbCalcTotals();
}

function qbCalcRow(idx) {
    const tr = document.querySelector(`#qbItemsBody tr[data-idx="${idx}"]`);
    if (!tr) return;
    const qty = parseFloat(tr.querySelector('.qb-qty').value) || 0;
    const rate = parseFloat(tr.querySelector('.qb-rate').value) || 0;
    const disc = parseFloat(tr.querySelector('.qb-disc').value) || 0;
    const amount = qty * rate * (1 - disc / 100);
    const el = document.getElementById(`qbRowAmt${idx}`);
    if (el) el.textContent = '₹' + amount.toFixed(2);
    qbCalcTotals();
}

function qbCalcTotals() {
    const rows = document.querySelectorAll('#qbItemsBody tr');
    const gstOn = document.getElementById('qbGstToggle').checked;
    const globalGstRate = parseFloat(document.getElementById('qbGstRate').value) || 18;

    let subtotal = 0;
    let totalGst = 0;

    rows.forEach(tr => {
        const idx = tr.dataset.idx;
        const qty = parseFloat(tr.querySelector('.qb-qty').value) || 0;
        const rate = parseFloat(tr.querySelector('.qb-rate').value) || 0;
        const disc = parseFloat(tr.querySelector('.qb-disc').value) || 0;
        const amount = qty * rate * (1 - disc / 100);

        if (gstOn) {
            // Row-level GST (from dropdown if visible)
            const gstRateEl = tr.querySelector('.qb-gst-rate');
            const rowGst = gstRateEl ? parseFloat(gstRateEl.value) || 0 : globalGstRate;
            subtotal += amount;
            totalGst += amount * rowGst / 100;
        } else {
            // No-tax mode — amount is inclusive already
            subtotal += amount;
        }
    });

    const grand = subtotal + totalGst;
    const halfGst = totalGst / 2;
    const halfRate = (globalGstRate / 2).toFixed(0);

    document.getElementById('qbSubtotal').textContent = '₹' + subtotal.toFixed(2);
    document.getElementById('qbCgstAmt').textContent = '₹' + halfGst.toFixed(2);
    document.getElementById('qbSgstAmt').textContent = '₹' + halfGst.toFixed(2);
    document.getElementById('qbDisplayCgstRate').textContent = halfRate;
    document.getElementById('qbDisplaySgstRate').textContent = halfRate;
    document.getElementById('qbGrandTotal').textContent = '₹' + grand.toFixed(2);
}

// ─── GST Toggle ──────────────────────────────────────────────────────────────

function qbHandleGstToggle(el) {
    const on = el.checked;
    document.getElementById('qbGstLabel').textContent = on ? 'ON' : 'OFF';
    document.getElementById('qbGstRate').style.display = on ? '' : 'none';

    // Show/hide GST column headers and cells
    document.querySelectorAll('.qb-gst-col').forEach(c => {
        c.style.display = on ? '' : 'none';
    });

    // Show/hide GST total rows
    document.querySelectorAll('.qb-gst-rows').forEach(r => {
        r.style.display = on ? '' : 'none';
    });

    qbCalcTotals();
}

// ─── Save ────────────────────────────────────────────────────────────────────

async function qbSave(andPrint) {
    // Bail out immediately if offline
    if (!navigator.onLine || (typeof window.PWA !== 'undefined' && !window.PWA.isOnline())) {
        showToast('⚠️ You are offline. Please check your internet connection and try again.', 'warning');
        return;
    }

    const saveBtn = document.getElementById('qbSaveBtn');
    const printBtn = document.getElementById('qbPrintBtn');

    // ── Collect items ──
    const rows = document.querySelectorAll('#qbItemsBody tr');
    const items = [];
    let valid = true;

    rows.forEach(tr => {
        const desc = tr.querySelector('.qb-desc').value.trim();
        const qty = parseFloat(tr.querySelector('.qb-qty').value) || 0;
        const rate = parseFloat(tr.querySelector('.qb-rate').value) || 0;
        const disc = parseFloat(tr.querySelector('.qb-disc').value) || 0;
        const gstRateEl = tr.querySelector('.qb-gst-rate');
        const rowGst = gstRateEl ? parseFloat(gstRateEl.value) || 0 : 0;
        const amount = qty * rate * (1 - disc / 100);

        if (desc === '' && rate === 0 && qty > 0) return; // skip empty rows silently
        if (desc === '' || rate <= 0) {
            if (desc !== '' || rate > 0) valid = false; // only flag if partially filled
            return;
        }
        items.push({ description: desc, quantity: qty, rate, discount_percent: disc, gst_rate: rowGst, amount, hsn_code: '' });
    });

    if (items.length === 0) {
        showToast('Please add at least one item with a description and rate.', 'warning');
        return;
    }
    if (!valid) {
        showToast('Some items are missing description or rate.', 'warning');
        return;
    }

    // ── Disable buttons ──
    saveBtn.disabled = true;
    printBtn.disabled = true;
    saveBtn.textContent = 'Saving…';

    try {
        const gstOn = document.getElementById('qbGstToggle').checked;
        const globalGstRate = parseFloat(document.getElementById('qbGstRate').value) || 18;
        const taxMode = gstOn ? 'with-tax' : 'no-tax';

        let subtotal = 0;
        let totalGst = 0;
        items.forEach(item => {
            subtotal += item.amount;
            if (gstOn) {
                totalGst += item.amount * item.gst_rate / 100;
            }
        });
        const grandTotal = subtotal + totalGst;
        const cgstRate = globalGstRate / 2;
        const sgstRate = globalGstRate / 2;
        const totalUnits = items.reduce((s, i) => s + i.quantity, 0);

        const paymentMethod = document.querySelector('input[name="qbPayment"]:checked')?.value || 'cash';
        const customerName = document.getElementById('qbCustomerName').value.trim() || 'Walk-in Customer';
        const customerMobile = document.getElementById('qbCustomerMobile').value.trim() || null;
        const billNo = document.getElementById('qbBillNo').value.trim();
        const date = document.getElementById('qbDate').value;

        const invoiceData = {
            invoiceNumber: billNo,
            date,
            customerName,
            customerMobile,
            mobile: customerMobile,   // alias read by supabaseAddInvoice
            customerId: null,
            items,                    // pass array directly — Supabase JS serialises it
            subtotal,
            gstAmount: totalGst,
            gstRate: globalGstRate,
            cgstRate,
            sgstRate,
            totalAmount: grandTotal,
            totalUnits,
            paymentMethod,
            paymentType: 'cash',
            taxMode,
            discountAmount: 0
        };

        const result = await supabaseAddInvoice(invoiceData);

        if (!result.success) {
            throw new Error(result.error || 'Failed to save bill');
        }

        // Increment invoice counter
        await qbIncrementCounter();

        showToast('✅ Bill saved successfully!', 'success');

        if (andPrint) {
            qbPrintThermal(invoiceData);
        }

        // Reset form for next bill
        qbResetForm();

    } catch (err) {
        console.error('qbSave error:', err);
        showToast('❌ Error saving bill: ' + (err.message || err), 'error');
    } finally {
        saveBtn.disabled = false;
        printBtn.disabled = false;
        saveBtn.innerHTML = '<span class="material-icons">save</span> Save Bill';
    }
}

async function qbIncrementCounter() {
    try {
        const user = await supabaseGetCurrentUser();
        if (!user) return;

        let profile = qbUserProfile;
        if (!profile) {
            const res = await supabaseGetUserProfile(user.id);
            if (res.success && res.data) profile = res.data;
        }

        if (profile && profile.invoice_prefix) {
            const newCounter = (profile.current_invoice_counter || 0) + 1;
            await supabaseUpdateUserProfile(user.id, { current_invoice_counter: newCounter });
            if (qbUserProfile) qbUserProfile.current_invoice_counter = newCounter;
        }
    } catch (e) {
        console.warn('qbIncrementCounter error:', e);
    }
}

async function qbResetForm() {
    // Clear items
    document.getElementById('qbItemsBody').innerHTML = '';
    qbRowCounter = 0;

    // Reset customer fields
    document.getElementById('qbCustomerName').value = '';
    document.getElementById('qbCustomerMobile').value = '';

    // Reset payment to cash
    const cashRadio = document.querySelector('input[name="qbPayment"][value="cash"]');
    if (cashRadio) cashRadio.checked = true;

    // Reset date to today
    document.getElementById('qbDate').value = new Date().toISOString().split('T')[0];

    // Generate new bill number
    await qbRefreshBillNumber();

    // Add first empty row
    qbAddRow();
}

// ─── Thermal Print ───────────────────────────────────────────────────────────

function qbPrintThermal(invoice) {
    const profile = qbUserProfile || {};
    const businessName = profile.business_name || profile.full_name || 'My Business';
    const businessAddress = profile.address || '';
    const businessPhone = profile.phone || profile.mobile || '';
    const gstNo = profile.gst_number || '';

    const items = typeof invoice.items === 'string' ? JSON.parse(invoice.items) : invoice.items;
    const gstOn = invoice.taxMode === 'with-tax';
    const date = invoice.date ? new Date(invoice.date).toLocaleDateString('en-IN') : new Date().toLocaleDateString('en-IN');

    let itemsHtml = '';
    items.forEach(item => {
        const lineTotal = item.amount.toFixed(2);
        itemsHtml += `
            <tr>
                <td style="padding:1.5px 0;">${item.description}</td>
                <td style="text-align:right;white-space:nowrap;">${item.quantity}×${parseFloat(item.rate).toFixed(2)}</td>
                <td style="text-align:right;padding-left:4px;">₹${lineTotal}</td>
            </tr>`;
        if (item.discount_percent > 0) {
            itemsHtml += `<tr><td colspan="3" style="padding:0 0 1.5px;font-size:10px;">  Disc: ${item.discount_percent}%</td></tr>`;
        }
    });

    const subtotalRow = gstOn
        ? `<tr><td>Subtotal</td><td></td><td style="text-align:right;">₹${invoice.subtotal.toFixed(2)}</td></tr>
           <tr><td>CGST (${(invoice.cgstRate || invoice.gstRate / 2).toFixed(0)}%)</td><td></td><td style="text-align:right;">₹${(invoice.gstAmount / 2).toFixed(2)}</td></tr>
           <tr><td>SGST (${(invoice.sgstRate || invoice.gstRate / 2).toFixed(0)}%)</td><td></td><td style="text-align:right;">₹${(invoice.gstAmount / 2).toFixed(2)}</td></tr>`
        : '';

    const html = `
        <div style="font-family:'Courier New',monospace;font-size:11px;width:72mm;margin:0 auto;color:#000;">
            <div style="text-align:center;font-weight:bold;font-size:14px;margin-bottom:2px;">${businessName}</div>
            ${businessAddress ? `<div style="text-align:center;font-size:10px;">${businessAddress}</div>` : ''}
            ${businessPhone ? `<div style="text-align:center;font-size:10px;">Ph: ${businessPhone}</div>` : ''}
            ${gstNo ? `<div style="text-align:center;font-size:10px;">GSTIN: ${gstNo}</div>` : ''}
            <div style="border-top:1px dashed #000;margin:4px 0;"></div>
            <div style="display:flex;justify-content:space-between;font-size:10px;">
                <span>Bill No: <b>${invoice.invoiceNumber}</b></span>
                <span>${date}</span>
            </div>
            ${invoice.customerName && invoice.customerName !== 'Walk-in Customer'
                ? `<div style="font-size:10px;">Customer: ${invoice.customerName}${invoice.customerMobile ? ' | ' + invoice.customerMobile : ''}</div>`
                : ''}
            <div style="border-top:1px dashed #000;margin:4px 0;"></div>
            <table style="width:100%;border-collapse:collapse;font-size:11px;">
                <thead>
                    <tr>
                        <th style="text-align:left;font-weight:bold;">Item</th>
                        <th style="text-align:right;font-weight:bold;">Qty×Rate</th>
                        <th style="text-align:right;font-weight:bold;padding-left:4px;">Amt</th>
                    </tr>
                </thead>
                <tbody>${itemsHtml}</tbody>
            </table>
            <div style="border-top:1px dashed #000;margin:4px 0;"></div>
            <table style="width:100%;font-size:11px;">
                ${subtotalRow}
                <tr style="font-weight:bold;font-size:13px;">
                    <td>TOTAL</td><td></td>
                    <td style="text-align:right;">₹${invoice.totalAmount.toFixed(2)}</td>
                </tr>
            </table>
            <div style="border-top:1px dashed #000;margin:4px 0;"></div>
            <div style="font-size:11px;">Payment: <b>${invoice.paymentMethod.toUpperCase()}</b></div>
            <div style="border-top:1px dashed #000;margin:4px 0;"></div>
            <div style="text-align:center;font-size:10px;margin-top:4px;">Thank you for your purchase!</div>
            <div style="text-align:center;font-size:10px;">Please visit again.</div>
            <div style="margin-bottom:8mm;"></div>
        </div>`;

    const printArea = document.getElementById('thermalPrintArea');
    printArea.innerHTML = html;

    // Check if native platform (Capacitor)
    if (typeof Capacitor !== 'undefined' && Capacitor.isNativePlatform && Capacitor.isNativePlatform()) {
        showToast('Print via your device\'s share/print option. Thermal print works best on a paired 80mm printer.', 'info');
    }

    window.print();
}
