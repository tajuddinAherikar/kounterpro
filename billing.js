// Billing functionality
let itemCounter = 1;
let inventory = [];

// Load inventory from localStorage
function loadInventory() {
    try {
        const stored = localStorage.getItem('inventory');
        inventory = stored ? JSON.parse(stored) : [];
    } catch (error) {
        console.error('Error loading inventory:', error);
        alert('❌ Error loading inventory. Please refresh the page.');
        inventory = [];
    }
}

// Save inventory to localStorage
function saveInventory() {
    try {
        localStorage.setItem('inventory', JSON.stringify(inventory));
        return true;
    } catch (error) {
        console.error('Error saving inventory:', error);
        alert('❌ Error updating inventory. Please try again.');
        return false;
    }
}

// Calculate item amounts and totals (Rate is GST-inclusive)
function calculateAmounts() {
    const rows = document.querySelectorAll('.item-row');
    const gstRate = parseFloat(document.getElementById('gstRate').value) || 0;
    const gstMultiplier = 1 + (gstRate / 100);
    
    let subtotalExclGST = 0;
    let grandTotal = 0;
    
    rows.forEach(row => {
        const quantity = parseFloat(row.querySelector('.item-quantity').value) || 0;
        const rateInclGST = parseFloat(row.querySelector('.item-rate').value) || 0;
        
        // Calculate base rate (excluding GST from the entered rate)
        const rateExclGST = rateInclGST / gstMultiplier;
        const amountExclGST = quantity * rateExclGST;
        const amountInclGST = quantity * rateInclGST;
        
        row.querySelector('.item-amount').textContent = amountInclGST.toFixed(2);
        subtotalExclGST += amountExclGST;
        grandTotal += amountInclGST;
    });
    
    const gstAmount = grandTotal - subtotalExclGST;
    
    document.getElementById('subtotal').textContent = `₹${subtotalExclGST.toFixed(2)}`;
    document.getElementById('gstAmount').textContent = `₹${gstAmount.toFixed(2)}`;
    document.getElementById('grandTotal').textContent = `₹${grandTotal.toFixed(2)}`;
    document.getElementById('displayGstRate').textContent = gstRate.toFixed(2);
}

// Add new item row
function addItem() {
    itemCounter++;
    const tbody = document.getElementById('itemsTableBody');
    const newRow = document.createElement('tr');
    newRow.className = 'item-row';
    newRow.setAttribute('data-row', itemCounter);
    newRow.innerHTML = `
        <td>${itemCounter}</td>
        <td><input type="text" class="item-description" required></td>
        <td><input type="text" class="item-serial" placeholder="Optional"></td>
        <td><input type="number" class="item-quantity" min="1" value="1" required></td>
        <td><input type="number" class="item-rate" min="0" step="0.01" required></td>
        <td class="item-amount">0.00</td>
        <td><button type="button" class="btn-remove" onclick="removeItem(${itemCounter})">✕</button></td>
    `;
    tbody.appendChild(newRow);
    
    // Add event listeners to new inputs
    addItemEventListeners(newRow);
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
        row.querySelector('td:first-child').textContent = index + 1;
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
    
    // Create autocomplete container
    const autocompleteContainer = document.createElement('div');
    autocompleteContainer.className = 'autocomplete-items';
    input.parentNode.appendChild(autocompleteContainer);
    
    // Input event - show suggestions
    input.addEventListener('input', function() {
        const val = this.value.toLowerCase();
        closeAllLists();
        
        if (!val || val.length < 1) return;
        
        currentFocus = -1;
        
        const matches = inventory.filter(item => 
            item.name.toLowerCase().includes(val) ||
            (item.description && item.description.toLowerCase().includes(val))
        );
        
        if (matches.length === 0) return;
        
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
                <br><small>${stockBadge} | Stock: ${item.stock} units | Rate: ₹${item.rate.toFixed(2)}</small>
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
    }
    
    // Close on click outside
    document.addEventListener('click', function(e) {
        if (e.target !== input) {
            closeAllLists();
        }
    });
}

// Generate invoice number
function generateInvoiceNumber() {
    const invoices = JSON.parse(localStorage.getItem('invoices') || '[]');
    const lastInvoice = invoices.length > 0 ? invoices[invoices.length - 1] : null;
    
    if (lastInvoice) {
        const lastNumber = parseInt(lastInvoice.invoiceNo.split('/')[0].replace('K', ''));
        return `K${String(lastNumber + 1).padStart(4, '0')}/${new Date().getMonth() + 1}/${new Date().getFullYear().toString().slice(-2)}`;
    }
    
    return `K0001/${new Date().getMonth() + 1}/${new Date().getFullYear().toString().slice(-2)}`;
}

// Collect form data (Rate is GST-inclusive)
function collectFormData() {
    const customerName = document.getElementById('customerName').value.trim();
    const customerAddress = document.getElementById('customerAddress').value.trim();
    const customerMobile = document.getElementById('customerMobile').value.trim();
    const customerGST = document.getElementById('customerGST').value.trim();
    const gstRate = parseFloat(document.getElementById('gstRate').value);
    const gstMultiplier = 1 + (gstRate / 100);
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
    
    if (isNaN(gstRate) || gstRate < 0 || gstRate > 50) {
        throw new Error('GST rate must be between 0 and 50');
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
        
        // Calculate base rate (excluding GST)
        const rateExclGST = rateInclGST / gstMultiplier;
        const amountExclGST = quantity * rateExclGST;
        const amountInclGST = quantity * rateInclGST;
        
        items.push({
            slNo: index + 1,
            description,
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
    
    const gstAmount = grandTotal - subtotal;
    
    return {
        invoiceNo: generateInvoiceNumber(),
        date: new Date().toISOString(),
        customerName,
        customerAddress,
        customerMobile,
        customerGST,
        items,
        gstRate,
        subtotal,
        gstAmount,
        grandTotal,
        totalUnits,
        termsConditions
    };
}

// Generate PDF using jsPDF
function generatePDF(invoiceData) {
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
    pdf.text('Indra Auto Nagar, Rangeen Masjid Road Bijapur', 15, y);
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
    const tableStartY = y;
    
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
    pdf.text(`${invoiceData.subtotal.toFixed(2)}`, 165, y);
    
    y += 6;
    pdf.text(`GST (${invoiceData.gstRate}%)`, 130, y);
    pdf.text(`${invoiceData.gstAmount.toFixed(2)}`, 165, y);
    
    y += 6;
    pdf.setFont(undefined, 'bold');
    pdf.setFontSize(11);
    pdf.text('Grand Total:', 130, y);
    pdf.text(`${invoiceData.grandTotal.toFixed(2)}`, 165, y);
    
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
    const upiId = 'mahammadtajuddin@ybl';
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
            pdf.text(`Amount: ${amount}`, 52, y + 15);
            pdf.text('Scan QR to pay via any UPI app', 52, y + 25);
        }
        
        document.body.removeChild(qrContainer);
        
        // Stamp/Seal placeholder - moved to right side
        pdf.setFontSize(9);
        pdf.text('[Stamp/Seal]', 155, y + 15);
        pdf.rect(150, y + 5, 40, 25);
        
        // Footer
        pdf.setFontSize(8);
        pdf.text('This copy is generated electronically and does not require a physical signature.| KounterPro', 105, 285, { align: 'center' });
        
        // Save PDF
        pdf.save(`Invoice_${invoiceData.invoiceNo.replace(/\//g, '_')}.pdf`);
    }, 100);
}

// Format invoice data for WhatsApp message
function formatWhatsAppMessage(invoiceData) {
    let message = `*KEEN BATTERIES*\n`;
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
        message += `  Qty: ${item.quantity} × ₹${item.rateInclGST.toFixed(2)} = ₹${(item.quantity * item.rateInclGST).toFixed(2)}\n`;
    });
    
    message += `━━━━━━━━━━━━━━━━━━\n\n`;
    message += `*Subtotal:* ₹${invoiceData.subtotal.toFixed(2)}\n`;
    message += `*GST (${invoiceData.gstRate}%):* ₹${invoiceData.gstAmount.toFixed(2)}\n`;
    message += `*Grand Total:* ₹${invoiceData.grandTotal.toFixed(2)}\n\n`;
    
    message += `Thank you for your business! 🙏\n\n`;
    message += `_This is a computer generated invoice._`;
    
    return encodeURIComponent(message);
}

// Send invoice via WhatsApp
function sendViaWhatsApp(invoiceData) {
    const mobileNumber = invoiceData.customerMobile.replace(/\D/g, '');
    const countryCode = '91'; // India country code, change if needed
    const message = formatWhatsAppMessage(invoiceData);
    
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
    const date = new Date(dateString);
    const day = String(date.getDate()).padStart(2, '0');
    const month = String(date.getMonth() + 1).padStart(2, '0');
    const year = date.getFullYear();
    return `${day}/${month}/${year}`;
}

// Save invoice to localStorage and update inventory
function saveInvoice(invoiceData) {
    const invoices = JSON.parse(localStorage.getItem('invoices') || '[]');
    invoices.push(invoiceData);
    localStorage.setItem('invoices', JSON.stringify(invoices));
    
    // Deduct stock from inventory
    deductStock(invoiceData.items);
}

// Deduct stock from inventory
function deductStock(soldItems) {
    soldItems.forEach(soldItem => {
        // Find matching inventory item by name
        const invItem = inventory.find(item => 
            item.name.toLowerCase() === soldItem.description.toLowerCase()
        );
        
        if (invItem) {
            invItem.stock -= soldItem.quantity;
            // Ensure stock doesn't go negative
            if (invItem.stock < 0) invItem.stock = 0;
            invItem.updatedAt = new Date().toISOString();
        }
    });
    
    saveInventory();
}

// Handle form submission
function handleFormSubmit(e) {
    e.preventDefault();
    
    // Create loading overlay if it doesn't exist
    let loadingOverlay = document.getElementById('loadingOverlay');
    if (!loadingOverlay) {
        loadingOverlay = document.createElement('div');
        loadingOverlay.id = 'loadingOverlay';
        loadingOverlay.innerHTML = `
            <div class="loading-content">
                <div class="spinner"></div>
                <p id="loadingMessage">Generating invoice...</p>
            </div>
        `;
        document.body.appendChild(loadingOverlay);
    }
    
    // Show loading
    loadingOverlay.style.display = 'flex';
    
    // Use setTimeout to allow UI to update
    setTimeout(() => {
        try {
            const invoiceData = collectFormData();
            
            // Validate items
            if (invoiceData.items.length === 0) {
                throw new Error('Please add at least one item');
            }
            
            // Generate PDF
            generatePDF(invoiceData);
            
            // Save to localStorage
            saveInvoice(invoiceData);
            
            // Hide loading
            loadingOverlay.style.display = 'none';
            
            // Show WhatsApp modal
            document.getElementById('modalInvoiceNo').textContent = invoiceData.invoiceNo;
            document.getElementById('whatsappModal').style.display = 'flex';
            
            // Setup WhatsApp button
            document.getElementById('sendWhatsappBtn').onclick = () => {
                sendViaWhatsApp(invoiceData);
            };
            
        } catch (error) {
            // Hide loading
            loadingOverlay.style.display = 'none';
            
            console.error('Error generating invoice:', error);
            alert('\u274c ' + error.message);
        }
    }, 100); // Small delay to allow UI to update
}

// Initialize form
function initForm() {
    // Load inventory data
    loadInventory();
    
    // Add event listeners to initial row
    const initialRow = document.querySelector('.item-row');
    addItemEventListeners(initialRow);
    
    // Add event listener to GST rate
    document.getElementById('gstRate').addEventListener('input', calculateAmounts);
    
    // Add form submit listener
    document.getElementById('invoiceForm').addEventListener('submit', handleFormSubmit);
}

// Initialize when page loads
document.addEventListener('DOMContentLoaded', initForm);
