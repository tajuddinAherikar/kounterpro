/**
 * Invoice Template Renderers
 * Modular system for generating different invoice template styles
 * Supports: Classic, Modern, GST Format, and Retail templates
 */

// ============================================
// UTILITY FUNCTIONS
// ============================================

/**
 * Mobile-safe PDF save.
 * On native Capacitor (Android/iOS) we write via the Filesystem plugin to the
 * device's Documents folder.  The blob-URL / <a download> approach is silently
 * blocked by Android WebView and never triggers a download.
 * On the web we fall back to the standard blob-URL approach.
 */
function savePDF(pdf, filename) {
    // Detect native Capacitor runtime (Android / iOS)
    const isNative = !!(
        window.Capacitor &&
        typeof window.Capacitor.isNativePlatform === 'function' &&
        window.Capacitor.isNativePlatform()
    );

    if (isNative) {
        const Filesystem = window.Capacitor && window.Capacitor.Plugins && window.Capacitor.Plugins.Filesystem;
        if (Filesystem) {
            // datauristring = "data:application/pdf;base64,..." — Capacitor strips the header
            const dataUri = pdf.output('datauristring');
            Filesystem.writeFile({
                path: filename,
                data: dataUri,
                directory: 'DOCUMENTS',
                recursive: true
            }).then(() => {
                showToast('PDF saved to Documents: ' + filename, 'success');
            }).catch(function(err) {
                console.error('Filesystem.writeFile error:', err);
                showToast('Could not save PDF: ' + (err.message || JSON.stringify(err)), 'error');
            });
            return;
        }
        // Filesystem plugin unavailable — fall through to blob approach
        console.warn('savePDF: Capacitor Filesystem plugin not found, falling back to blob URL');
    }

    // Web / PWA path
    try {
        const blob = pdf.output('blob');
        const url = URL.createObjectURL(blob);
        const a = document.createElement('a');
        a.href = url;
        a.download = filename;
        a.style.display = 'none';
        document.body.appendChild(a);
        a.click();
        // Delay revoke so the browser has time to start the download
        setTimeout(function() {
            URL.revokeObjectURL(url);
            document.body.removeChild(a);
        }, 2000);
    } catch (e) {
        // Last-resort fallback: open in new tab
        try {
            const blobUrl = URL.createObjectURL(pdf.output('blob'));
            window.open(blobUrl, '_blank');
        } catch (_) {
            throw new Error('Could not save PDF. Please try again or use a different browser.');
        }
    }
}

/**
 * Format date for PDF display
 */
function formatDateForPDF(dateString) {
    // Check if it's a simple date string (YYYY-MM-DD)
    if (dateString && dateString.length === 10 && !dateString.includes('T')) {
        const [year, month, day] = dateString.split('-');
        return `${day}/${month}/${year}`;
    }
    // Otherwise treat as timestamp
    const date = new Date(dateString);
    const day = String(date.getDate()).padStart(2, '0');
    const month = String(date.getMonth() + 1).padStart(2, '0');
    const year = date.getFullYear();
    return `${day}/${month}/${year}`;
}

/**
 * Format currency in Indian numbering system
 */
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

/**
 * Helper to apply brand color to PDF text
 */
function applyBrandColor(pdf, color) {
    const hex = color.replace('#', '');
    const r = parseInt(hex.substr(0, 2), 16);
    const g = parseInt(hex.substr(2, 2), 16);
    const b = parseInt(hex.substr(4, 2), 16);
    pdf.setTextColor(r, g, b);
}

/**
 * Reset text color to black
 */
function resetTextColor(pdf) {
    pdf.setTextColor(0, 0, 0);
}

/**
 * Apply brand color as fill
 */
function applyBrandFillColor(pdf, color) {
    const hex = color.replace('#', '');
    const r = parseInt(hex.substr(0, 2), 16);
    const g = parseInt(hex.substr(2, 2), 16);
    const b = parseInt(hex.substr(4, 2), 16);
    pdf.setFillColor(r, g, b);
}

/**
 * Add logo to PDF if available
 */
async function addLogoToPDF(pdf, logoUrl, x, y, width, height) {
    if (!logoUrl) {
        console.log('No logo URL provided');
        return y;
    }
    
    console.log('Adding logo to PDF:', logoUrl);
    
    try {
        // Load image and add to PDF
        const img = await loadImageFromUrl(logoUrl);
        console.log('Logo image loaded successfully:', img.width, 'x', img.height);
        
        // Calculate aspect ratio to maintain proportions
        const imgAspectRatio = img.width / img.height;
        let finalWidth = width;
        let finalHeight = height;
        
        if (imgAspectRatio > width / height) {
            // Image is wider - fit to width
            finalHeight = width / imgAspectRatio;
        } else {
            // Image is taller - fit to height
            finalWidth = height * imgAspectRatio;
        }
        
        // Determine image format
        let format = 'PNG';
        if (logoUrl.toLowerCase().includes('.jpg') || logoUrl.toLowerCase().includes('.jpeg')) {
            format = 'JPEG';
        } else if (logoUrl.toLowerCase().includes('.svg')) {
            format = 'PNG'; // SVG will be converted to canvas/PNG
        }
        
        console.log(`Adding ${format} image at (${x}, ${y}) with size ${finalWidth}x${finalHeight}`);
        
        // Add image to PDF
        pdf.addImage(img.src, format, x, y, finalWidth, finalHeight);
        
        console.log('Logo added successfully to PDF');
        return y + finalHeight;
    } catch (error) {
        console.error('Error adding logo to PDF:', error);
        // Fallback: just return y without adding logo
        return y;
    }
}

/**
 * Helper function to load image from URL
 */
function loadImageFromUrl(url) {
    return new Promise((resolve, reject) => {
        const img = new Image();
        img.crossOrigin = 'Anonymous'; // Enable CORS
        
        img.onload = () => {
            resolve(img);
        };
        
        img.onerror = (error) => {
            console.error('Failed to load logo image:', error);
            reject(error);
        };
        
        img.src = url;
    });
}

/**
 * Generate UPI QR code and add to PDF
 */
function addUPIQRCodeToPDF(pdf, profile, invoiceData, x, y) {
    return new Promise((resolve) => {
        const upiId = profile?.upi_id;
        
        // Skip if no UPI ID configured
        if (!upiId) {
            resolve(y);
            return;
        }
        
        const payeeName = profile?.business_name || 'Business';
        const amount = invoiceData.grandTotal.toFixed(2);
        const upiString = `upi://pay?pa=${upiId}&pn=${encodeURIComponent(payeeName)}&am=${amount}&cu=INR&tn=Invoice ${invoiceData.invoiceNo}`;
        
        // Generate QR code
        const qrContainer = document.createElement('div');
        qrContainer.style.display = 'none';
        document.body.appendChild(qrContainer);
        
        try {
            const qr = new QRCode(qrContainer, {
                text: upiString,
                width: 120,
                height: 120
            });
            
            // Wait for QR code to be generated
            setTimeout(() => {
                const qrCanvas = qrContainer.querySelector('canvas');
                if (qrCanvas) {
                    const qrImage = qrCanvas.toDataURL('image/png');
                    
                    // Add to PDF
                    pdf.setFontSize(10);
                    pdf.setFont(undefined, 'bold');
                    pdf.text('Scan to Pay', x, y);
                    pdf.addImage(qrImage, 'PNG', x, y + 2, 35, 35);
                    
                    pdf.setFontSize(8);
                    pdf.setFont(undefined, 'normal');
                    pdf.text(`UPI ID: ${upiId}`, x + 37, y + 10);
                    pdf.text(`Amount: Rs ${amount}`, x + 37, y + 15);
                    pdf.text('Scan QR to pay via any UPI app', x + 37, y + 25);
                }
                
                // Clean up
                document.body.removeChild(qrContainer);
                resolve(y + 40);
            }, 100);
        } catch (error) {
            console.error('Error generating UPI QR code:', error);
            document.body.removeChild(qrContainer);
            resolve(y);
        }
    });
}

// ============================================
// CLASSIC TEMPLATE
// ============================================

/**
 * Classic Template - Simple, minimal layout
 * Best for traditional businesses
 */
async function renderClassicTemplate(pdf, invoiceData, profile, settings) {
    const brandColor = settings.brand_color || '#2845D6';
    let y = 20;
    
    // Header
    pdf.setFontSize(16);
    pdf.setFont(undefined, 'bold');
    applyBrandColor(pdf, brandColor);
    pdf.text('TAX INVOICE', 105, y, { align: 'center' });
    resetTextColor(pdf);
    
    y += 10;
    pdf.setFontSize(10);
    pdf.setFont(undefined, 'normal');
    pdf.text(`Invoice No: ${invoiceData.invoiceNo}`, 150, y);
    pdf.text(`Date: ${formatDateForPDF(invoiceData.date)}`, 150, y + 5);
    
    // Logo (if enabled)
    if (settings.show_logo && settings.logo_url) {
        const logoY = await addLogoToPDF(pdf, settings.logo_url, 15, 15, 30, 15);
        y = Math.max(y, logoY);
    }
    
    // Company Details
    y += 10;
    pdf.setFontSize(14);
    pdf.setFont(undefined, 'bold');
    const companyName = profile?.business_name || 'Your Business';
    pdf.text(companyName.toUpperCase(), 15, y);
    
    pdf.setFontSize(9);
    pdf.setFont(undefined, 'normal');
    y += 5;
    
    // Address
    const companyAddress = profile?.business_address || '';
    if (companyAddress) {
        const addressLines = pdf.splitTextToSize(companyAddress, 100);
        addressLines.forEach(line => {
            pdf.text(line, 15, y);
            y += 4;
        });
    }
    
    // Contact
    const contact1 = profile?.contact_number_1 || '';
    const contact2 = profile?.contact_number_2;
    if (contact1) {
        const contactText = contact2 ? `Contact: ${contact1}, ${contact2}` : `Contact: ${contact1}`;
        pdf.text(contactText, 15, y);
        y += 4;
    }
    
    // Email
    const companyEmail = profile?.business_email || '';
    if (companyEmail) {
        pdf.text(`Email: ${companyEmail}`, 15, y);
        y += 4;
    }
    
    // GST
    const companyGST = profile?.gst_number || '';
    if (companyGST) {
        pdf.text(`GST: ${companyGST}`, 15, y);
        y += 4;
    }
    
    // Bill To
    y += 6;
    pdf.setFont(undefined, 'bold');
    pdf.text('Bill To:', 15, y);
    pdf.setFont(undefined, 'normal');
    y += 5;
    pdf.text(invoiceData.customerName, 15, y);
    y += 5;
    
    if (invoiceData.customerAddress) {
        const customerAddressLines = pdf.splitTextToSize(invoiceData.customerAddress, 80);
        customerAddressLines.forEach(line => {
            pdf.text(line, 15, y);
            y += 5;
        });
    }
    
    if (invoiceData.customerGST) {
        pdf.text(`GST: ${invoiceData.customerGST}`, 15, y);
        y += 5;
    }
    
    // Items Table
    y += 5;
    renderItemsTable(pdf, invoiceData, y, brandColor);
    
    return pdf;
}

// ============================================
// MODERN TEMPLATE
// ============================================

/**
 * Modern Template - Clean layout with better spacing
 * Best for modern businesses and startups
 */
async function renderModernTemplate(pdf, invoiceData, profile, settings) {
    const brandColor = settings.brand_color || '#2845D6';
    let y = 15;
    
    // Header with brand color background
    applyBrandFillColor(pdf, brandColor);
    pdf.rect(0, 0, 210, 35, 'F');

    // Logo (centre of header banner, if enabled)
    if (settings.show_logo && settings.logo_url) {
        await addLogoToPDF(pdf, settings.logo_url, 130, 3, 20, 29);
    }

    // White text for header
    pdf.setTextColor(255, 255, 255);
    pdf.setFontSize(24);
    pdf.setFont(undefined, 'bold');
    pdf.text('INVOICE', 15, y + 10);
    
    // Invoice details in header
    pdf.setFontSize(10);
    pdf.setFont(undefined, 'normal');
    pdf.text(`#${invoiceData.invoiceNo}`, 195, y + 8, { align: 'right' });
    pdf.text(`Date: ${formatDateForPDF(invoiceData.date)}`, 195, y + 14, { align: 'right' });
    
    resetTextColor(pdf);
    y = 40;
    
    // Company and Customer side by side
    pdf.setFontSize(9);
    pdf.setFont(undefined, 'bold');
    applyBrandColor(pdf, brandColor);
    pdf.text('FROM', 15, y);
    pdf.text('TO', 110, y);
    resetTextColor(pdf);
    
    y += 6;
    pdf.setFontSize(11);
    pdf.setFont(undefined, 'bold');
    
    // Company name
    const companyName = profile?.business_name || 'Your Business';
    pdf.text(companyName, 15, y);
    
    // Customer name
    pdf.text(invoiceData.customerName, 110, y);
    
    y += 5;
    pdf.setFontSize(9);
    pdf.setFont(undefined, 'normal');
    
    // Company details (left column)
    let leftY = y;
    const companyAddress = profile?.business_address || '';
    if (companyAddress) {
        const addressLines = pdf.splitTextToSize(companyAddress, 85);
        addressLines.forEach(line => {
            pdf.text(line, 15, leftY);
            leftY += 4;
        });
    }
    
    const contact1 = profile?.contact_number_1 || '';
    if (contact1) {
        pdf.text(contact1, 15, leftY);
        leftY += 4;
    }
    
    const companyEmail = profile?.business_email || '';
    if (companyEmail) {
        pdf.text(companyEmail, 15, leftY);
        leftY += 4;
    }
    
    const companyGST = profile?.gst_number || '';
    if (companyGST) {
        pdf.text(`GST: ${companyGST}`, 15, leftY);
        leftY += 4;
    }
    
    // Customer details (right column)
    let rightY = y;
    if (invoiceData.customerAddress) {
        const customerAddressLines = pdf.splitTextToSize(invoiceData.customerAddress, 85);
        customerAddressLines.forEach(line => {
            pdf.text(line, 110, rightY);
            rightY += 4;
        });
    }
    
    if (invoiceData.customerMobile) {
        pdf.text(invoiceData.customerMobile, 110, rightY);
        rightY += 4;
    }
    
    if (invoiceData.customerGST) {
        pdf.text(`GST: ${invoiceData.customerGST}`, 110, rightY);
        rightY += 4;
    }
    
    y = Math.max(leftY, rightY) + 10;
    
    // Items Table with modern styling
    renderModernItemsTable(pdf, invoiceData, y, brandColor);
    
    return pdf;
}

// ============================================
// GST FORMAT TEMPLATE
// ============================================

/**
 * GST Format Template - Structured for GST compliance
 * Best for businesses requiring detailed GST breakdown
 */
async function renderGSTFormatTemplate(pdf, invoiceData, profile, settings) {
    const brandColor = settings.brand_color || '#2845D6';
    let y = 15;

    // Logo (top-left, if enabled)
    if (settings.show_logo && settings.logo_url) {
        await addLogoToPDF(pdf, settings.logo_url, 15, 3, 25, 12);
    }

    // Header
    pdf.setFontSize(18);
    pdf.setFont(undefined, 'bold');
    applyBrandColor(pdf, brandColor);
    pdf.text('TAX INVOICE', 105, y, { align: 'center' });
    resetTextColor(pdf);
    
    y += 8;
    
    // Invoice details box
    pdf.setLineWidth(0.5);
    pdf.rect(15, y, 180, 15);
    pdf.line(105, y, 105, y + 15); // Vertical divider
    
    pdf.setFontSize(9);
    pdf.setFont(undefined, 'bold');
    pdf.text('Invoice No:', 17, y + 5);
    pdf.text('Invoice Date:', 17, y + 11);
    pdf.setFont(undefined, 'normal');
    pdf.text(invoiceData.invoiceNo, 45, y + 5);
    pdf.text(formatDateForPDF(invoiceData.date), 45, y + 11);
    
    // Due date and other fields
    pdf.setFont(undefined, 'bold');
    pdf.text('Place of Supply:', 107, y + 5);
    pdf.text('Payment Terms:', 107, y + 11);
    pdf.setFont(undefined, 'normal');
    pdf.text(profile?.business_address?.split(',')[1]?.trim() || '-', 145, y + 5);
    pdf.text(invoiceData.paymentType || 'Cash', 145, y + 11);
    
    y += 20;
    
    // Company and Customer in table format
    pdf.setLineWidth(0.5);
    pdf.rect(15, y, 180, 35);
    pdf.line(105, y, 105, y + 35); // Vertical divider
    pdf.line(15, y + 7, 195, y + 7); // Horizontal divider after title
    
    // Company details
    applyBrandFillColor(pdf, brandColor);
    pdf.rect(15, y, 90, 7, 'F');
    pdf.rect(105, y, 90, 7, 'F');
    
    pdf.setTextColor(255, 255, 255);
    pdf.setFontSize(10);
    pdf.setFont(undefined, 'bold');
    pdf.text('SELLER DETAILS', 17, y + 5);
    pdf.text('BUYER DETAILS', 107, y + 5);
    resetTextColor(pdf);
    
    y += 10;
    pdf.setFontSize(9);
    pdf.setFont(undefined, 'bold');
    
    // Company name
    const companyName = profile?.business_name || 'Your Business';
    pdf.text(companyName, 17, y);
    
    // Customer name
    pdf.text(invoiceData.customerName, 107, y);
    
    y += 4;
    pdf.setFont(undefined, 'normal');
    
    // Detailed company info
    let leftY = y;
    const companyAddress = profile?.business_address || '';
    if (companyAddress) {
        const addressLines = pdf.splitTextToSize(companyAddress, 85);
        addressLines.forEach(line => {
            pdf.text(line, 17, leftY);
            leftY += 3.5;
        });
    }
    
    const companyGST = profile?.gst_number || '';
    if (companyGST) {
        pdf.setFont(undefined, 'bold');
        pdf.text('GSTIN: ', 17, leftY);
        pdf.setFont(undefined, 'normal');
        pdf.text(companyGST, 33, leftY);
        leftY += 3.5;
    }
    
    // Detailed customer info
    let rightY = y;
    if (invoiceData.customerAddress) {
        const customerAddressLines = pdf.splitTextToSize(invoiceData.customerAddress, 85);
        customerAddressLines.forEach(line => {
            pdf.text(line, 107, rightY);
            rightY += 3.5;
        });
    }
    
    if (invoiceData.customerGST) {
        pdf.setFont(undefined, 'bold');
        pdf.text('GSTIN: ', 107, rightY);
        pdf.setFont(undefined, 'normal');
        pdf.text(invoiceData.customerGST, 123, rightY);
        rightY += 3.5;
    }
    
    y = Math.max(leftY, rightY, y + 18) + 10;
    
    // Items Table with GST breakdown
    renderGSTItemsTable(pdf, invoiceData, y, brandColor);
    
    return pdf;
}

// ============================================
// RETAIL FORMAT TEMPLATE
// ============================================

/**
 * Retail Format Template - Compact layout for retail
 * Best for quick retail transactions
 */
async function renderRetailTemplate(pdf, invoiceData, profile, settings) {
    const brandColor = settings.brand_color || '#2845D6';
    let y = 15;

    // Logo (top-left, if enabled)
    if (settings.show_logo && settings.logo_url) {
        await addLogoToPDF(pdf, settings.logo_url, 15, 3, 25, 10);
    }

    // Compact header
    pdf.setFontSize(16);
    pdf.setFont(undefined, 'bold');
    applyBrandColor(pdf, brandColor);
    const companyName = profile?.business_name || 'Your Business';
    pdf.text(companyName, 105, y, { align: 'center' });
    resetTextColor(pdf);
    
    y += 6;
    pdf.setFontSize(8);
    pdf.setFont(undefined, 'normal');
    
    // Compact company details
    const companyAddress = profile?.business_address || '';
    if (companyAddress) {
        pdf.text(companyAddress, 105, y, { align: 'center' });
        y += 4;
    }
    
    const contact1 = profile?.contact_number_1 || '';
    const companyEmail = profile?.business_email || '';
    const contactLine = [contact1, companyEmail].filter(Boolean).join(' | ');
    if (contactLine) {
        pdf.text(contactLine, 105, y, { align: 'center' });
        y += 4;
    }
    
    const companyGST = profile?.gst_number || '';
    if (companyGST) {
        pdf.text(`GST: ${companyGST}`, 105, y, { align: 'center' });
        y += 4;
    }
    
    // Divider line
    y += 2;
    applyBrandFillColor(pdf, brandColor);
    pdf.rect(15, y, 180, 0.5, 'F');
    y += 4;
    
    // Invoice info in compact format
    pdf.setFontSize(9);
    pdf.text(`Bill #${invoiceData.invoiceNo}`, 15, y);
    pdf.text(formatDateForPDF(invoiceData.date), 195, y, { align: 'right' });
    y += 5;
    
    // Customer info (compact)
    pdf.setFont(undefined, 'bold');
    pdf.text('Customer:', 15, y);
    pdf.setFont(undefined, 'normal');
    pdf.text(invoiceData.customerName, 38, y);
    if (invoiceData.customerMobile) {
        pdf.text(`| ${invoiceData.customerMobile}`, 90, y);
    }
    
    y += 8;
    
    // Compact items table
    renderRetailItemsTable(pdf, invoiceData, y, brandColor);
    
    return pdf;
}

// ============================================
// TABLE RENDERING HELPERS
// ============================================

/**
 * Render items table for Classic template
 */
function renderItemsTable(pdf, invoiceData, startY, brandColor) {
    let y = startY;
    
    // Table header
    pdf.setFillColor(240, 240, 240);
    pdf.rect(15, y, 180, 8, 'F');
    pdf.setFont(undefined, 'bold');
    pdf.setFontSize(9);
    pdf.text('Sl', 17, y + 5);
    pdf.text('Description', 28, y + 5);
    pdf.text('Serial No', 80, y + 5);
    pdf.text('Qty', 107, y + 5);
    pdf.text('Rate', 124, y + 5);
    pdf.text('Disc%', 144, y + 5);
    pdf.text('Amount', 162, y + 5);
    
    y += 8;
    pdf.setFont(undefined, 'normal');
    
    // Table rows
    invoiceData.items.forEach((item, index) => {
        if (y > 250) {
            pdf.addPage();
            y = 20;
        }
        
        pdf.text(String(item.slNo ?? index + 1), 17, y + 5);
        const descText = pdf.splitTextToSize(item.description, 50);
        pdf.text(descText, 28, y + 5);
        if (item.serialNo) {
            const serialText = pdf.splitTextToSize(item.serialNo, 24);
            pdf.text(serialText, 80, y + 5);
        }
        pdf.text(String(item.quantity), 107, y + 5);
        pdf.text(formatIndianCurrency(item.rate), 124, y + 5);
        const discPct = item.discount_percent || 0;
        pdf.text(discPct > 0 ? discPct + '%' : '-', 144, y + 5);
        pdf.text(formatIndianCurrency(item.amount), 162, y + 5);
        
        pdf.setDrawColor(220, 220, 220);
        pdf.line(15, y + 8, 195, y + 8);
        y += 8;
    });
    
    // Totals
    y += 5;
    pdf.setFont(undefined, 'normal');
    // Discount saved row
    const classicDiscSaved = invoiceData.items.reduce((sum, item) => {
        const r = item.rateInclGST || item.rate;
        return sum + item.quantity * r * ((item.discount_percent || 0) / 100);
    }, 0);
    if (classicDiscSaved > 0) {
        pdf.setTextColor(230, 126, 34);
        pdf.text('Discount Saved:', 130, y);
        pdf.text('-' + formatIndianCurrency(classicDiscSaved), 162, y);
        resetTextColor(pdf);
        y += 6;
    }
    if (invoiceData.taxMode === 'with-tax') {
        pdf.text('Subtotal:', 130, y);
        pdf.text(formatIndianCurrency(invoiceData.subtotal), 162, y);
        y += 6;
        pdf.text(`CGST (${invoiceData.cgstRate}%):`, 130, y);
        pdf.text(formatIndianCurrency(invoiceData.cgstAmount), 162, y);
        y += 6;
        pdf.text(`SGST (${invoiceData.sgstRate}%):`, 130, y);
        pdf.text(formatIndianCurrency(invoiceData.sgstAmount), 162, y);
        y += 6;
    }
    applyBrandFillColor(pdf, brandColor);
    pdf.rect(128, y - 4, 67, 8, 'F');
    pdf.setTextColor(255, 255, 255);
    pdf.setFont(undefined, 'bold');
    pdf.setFontSize(11);
    pdf.text('Grand Total:', 130, y + 2);
    pdf.text(formatIndianCurrency(invoiceData.grandTotal), 162, y + 2);
    resetTextColor(pdf);
}

/**
 * Render items table for Modern template
 */
function renderModernItemsTable(pdf, invoiceData, startY, brandColor) {
    let y = startY;
    
    // Table header with brand color
    applyBrandFillColor(pdf, brandColor);
    pdf.rect(15, y, 180, 10, 'F');
    pdf.setTextColor(255, 255, 255);
    pdf.setFont(undefined, 'bold');
    pdf.setFontSize(9);
    pdf.text('Item', 17, y + 6);
    pdf.text('Qty', 110, y + 6);
    pdf.text('Rate', 128, y + 6);
    pdf.text('Disc%', 148, y + 6);
    pdf.text('Amount', 168, y + 6);
    resetTextColor(pdf);
    
    y += 10;
    pdf.setFont(undefined, 'normal');
    
    // Alternating row colors
    let isAlternate = false;
    invoiceData.items.forEach(item => {
        if (y > 250) {
            pdf.addPage();
            y = 20;
        }
        
        if (isAlternate) {
            pdf.setFillColor(248, 248, 248);
            pdf.rect(15, y, 180, 8, 'F');
        }
        
        pdf.text(item.description, 17, y + 5);
        pdf.text(String(item.quantity), 110, y + 5);
        pdf.text(formatIndianCurrency(item.rate), 128, y + 5);
        const discPct = item.discount_percent || 0;
        pdf.text(discPct > 0 ? discPct + '%' : '-', 148, y + 5);
        pdf.text(formatIndianCurrency(item.amount), 168, y + 5);
        
        y += 8;
        isAlternate = !isAlternate;
    });
    
    // Totals section
    y += 5;
    pdf.setDrawColor(220, 220, 220);
    pdf.line(125, y, 195, y);
    y += 5;
    
    // Discount saved row
    const modernDiscSaved = invoiceData.items.reduce((sum, item) => {
        const r = item.rateInclGST || item.rate;
        return sum + item.quantity * r * ((item.discount_percent || 0) / 100);
    }, 0);
    if (modernDiscSaved > 0) {
        pdf.setFontSize(9);
        pdf.setTextColor(230, 126, 34);
        pdf.text('Discount Saved:', 125, y);
        pdf.text('-' + formatIndianCurrency(modernDiscSaved), 168, y);
        resetTextColor(pdf);
        y += 6;
    }
    if (invoiceData.taxMode === 'with-tax') {
        pdf.text('Subtotal', 125, y);
        pdf.text(formatIndianCurrency(invoiceData.subtotal), 168, y);
        y += 6;
        pdf.text(`CGST (${invoiceData.cgstRate}%)`, 125, y);
        pdf.text(formatIndianCurrency(invoiceData.cgstAmount), 168, y);
        y += 6;
        pdf.text(`SGST (${invoiceData.sgstRate}%)`, 125, y);
        pdf.text(formatIndianCurrency(invoiceData.sgstAmount), 168, y);
        y += 8;
    } else {
        y += 3;
    }
    applyBrandFillColor(pdf, brandColor);
    pdf.rect(125, y - 5, 70, 10, 'F');
    pdf.setTextColor(255, 255, 255);
    pdf.setFont(undefined, 'bold');
    pdf.setFontSize(12);
    pdf.text('TOTAL', 127, y + 2);
    pdf.text(formatIndianCurrency(invoiceData.grandTotal), 168, y + 2);
    resetTextColor(pdf);
}

/**
 * Render items table for GST Format template
 */
function renderGSTItemsTable(pdf, invoiceData, startY, brandColor) {
    let y = startY;
    
    // GST detailed table
    pdf.setLineWidth(0.5);
    
    // Header
    applyBrandFillColor(pdf, brandColor);
    pdf.rect(15, y, 180, 10, 'F');
    pdf.setTextColor(255, 255, 255);
    pdf.setFont(undefined, 'bold');
    pdf.setFontSize(8);
    
    pdf.text('Sl', 17, y + 6);
    pdf.text('Description', 25, y + 6);
    pdf.text('HSN', 70, y + 6);
    pdf.text('Qty', 85, y + 6);
    pdf.text('Rate', 100, y + 6);
    pdf.text('Taxable', 120, y + 6);
    pdf.text('CGST', 145, y + 6);
    pdf.text('SGST', 165, y + 6);
    pdf.text('Total', 180, y + 6);
    resetTextColor(pdf);
    
    y += 10;
    pdf.setFont(undefined, 'normal');
    pdf.setFontSize(8);
    
    // Items with GST breakdown
    invoiceData.items.forEach((item, index) => {
        if (y > 250) {
            pdf.addPage();
            y = 20;
        }
        
        const itemCgstRate = invoiceData.cgstRate || (invoiceData.gstRate || 18) / 2;
        const itemSgstRate = invoiceData.sgstRate || (invoiceData.gstRate || 18) / 2;
        const taxableAmount = item.amount;
        const cgstAmount = taxableAmount * itemCgstRate / 100;
        const sgstAmount = taxableAmount * itemSgstRate / 100;
        const totalAmount = taxableAmount + cgstAmount + sgstAmount;
        
        pdf.text(String(index + 1), 17, y + 4);
        pdf.text(item.description.substring(0, 20), 25, y + 4);
        pdf.text(item.hsnCode || '-', 70, y + 4);
        pdf.text(String(item.quantity), 85, y + 4);
        pdf.text(formatIndianCurrency(item.rate), 100, y + 4);
        pdf.text(formatIndianCurrency(taxableAmount), 120, y + 4);
        pdf.text(formatIndianCurrency(cgstAmount), 145, y + 4);
        pdf.text(formatIndianCurrency(sgstAmount), 165, y + 4);
        pdf.text(formatIndianCurrency(totalAmount), 180, y + 4);
        
        pdf.setDrawColor(220, 220, 220);
        pdf.line(15, y + 7, 195, y + 7);
        y += 7;
    });
    
    // GST Summary
    y += 5;
    pdf.setFontSize(9);
    pdf.setFont(undefined, 'bold');
    
    const cgstTotalAmt = invoiceData.cgstAmount || invoiceData.gstAmount / 2;
    const sgstTotalAmt = invoiceData.sgstAmount || invoiceData.gstAmount / 2;
    const cgstDisplayRate = invoiceData.cgstRate || (invoiceData.gstRate || 18) / 2;
    const sgstDisplayRate = invoiceData.sgstRate || (invoiceData.gstRate || 18) / 2;
    
    // Discount saved row
    const gstDiscSaved = invoiceData.items.reduce((sum, item) => {
        const r = item.rateInclGST || item.rate;
        return sum + item.quantity * r * ((item.discount_percent || 0) / 100);
    }, 0);
    if (gstDiscSaved > 0) {
        pdf.setTextColor(230, 126, 34);
        pdf.text('Discount Saved:', 120, y);
        pdf.text('-' + formatIndianCurrency(gstDiscSaved), 165, y);
        resetTextColor(pdf);
        y += 5;
    }
    pdf.text('Taxable Amount:', 120, y);
    pdf.text(formatIndianCurrency(invoiceData.subtotal), 165, y);
    y += 5;
    
    pdf.text(`CGST (${cgstDisplayRate}%):`, 120, y);
    pdf.text(formatIndianCurrency(cgstTotalAmt), 165, y);
    y += 5;
    
    pdf.text(`SGST (${sgstDisplayRate}%):`, 120, y);
    pdf.text(formatIndianCurrency(sgstTotalAmt), 165, y);
    y += 5;

    // Round off (if any)
    const roundOff = Math.round(invoiceData.grandTotal) - invoiceData.grandTotal;
    if (Math.abs(roundOff) > 0.01) {
        pdf.text('Round Off:', 120, y);
        pdf.text(formatIndianCurrency(roundOff), 165, y);
        y += 5;
    }
    
    // Grand Total
    applyBrandFillColor(pdf, brandColor);
    pdf.rect(118, y - 2, 77, 8, 'F');
    pdf.setTextColor(255, 255, 255);
    pdf.setFontSize(11);
    pdf.text('INVOICE TOTAL:', 120, y + 4);
    pdf.text(formatIndianCurrency(Math.round(invoiceData.grandTotal)), 165, y + 4);
    resetTextColor(pdf);
}

/**
 * Render items table for Retail template
 */
function renderRetailItemsTable(pdf, invoiceData, startY, brandColor) {
    let y = startY;
    
    // Compact header
    pdf.setFontSize(8);
    pdf.setFont(undefined, 'bold');
    pdf.setFillColor(245, 245, 245);
    pdf.rect(15, y, 180, 6, 'F');
    
    pdf.text('Item', 17, y + 4);
    pdf.text('Qty', 108, y + 4);
    pdf.text('Price', 126, y + 4);
    pdf.text('Disc%', 147, y + 4);
    pdf.text('Total', 167, y + 4);
    
    y += 6;
    pdf.setFont(undefined, 'normal');
    
    // Compact items list
    invoiceData.items.forEach(item => {
        if (y > 260) {
            pdf.addPage();
            y = 20;
        }
        
        pdf.text(item.description, 17, y + 4);
        pdf.text(String(item.quantity), 108, y + 4);
        pdf.text(formatIndianCurrency(item.rate), 126, y + 4);
        const discPct = item.discount_percent || 0;
        pdf.text(discPct > 0 ? discPct + '%' : '-', 147, y + 4);
        pdf.text(formatIndianCurrency(item.amount), 167, y + 4);
        
        pdf.setDrawColor(240, 240, 240);
        pdf.line(15, y + 6, 195, y + 6);
        y += 6;
    });
    
    // Quick totals
    y += 3;
    pdf.setFontSize(9);
    // Discount saved row
    const retailDiscSaved = invoiceData.items.reduce((sum, item) => {
        const r = item.rateInclGST || item.rate;
        return sum + item.quantity * r * ((item.discount_percent || 0) / 100);
    }, 0);
    if (retailDiscSaved > 0) {
        pdf.setTextColor(230, 126, 34);
        pdf.text('Discount Saved:', 140, y);
        pdf.text('-' + formatIndianCurrency(retailDiscSaved), 167, y);
        resetTextColor(pdf);
        y += 5;
    }
    if (invoiceData.taxMode === 'with-tax') {
        pdf.text('Subtotal:', 140, y);
        pdf.text(formatIndianCurrency(invoiceData.subtotal), 167, y);
        y += 5;
        pdf.text(`CGST (${invoiceData.cgstRate}%):`, 140, y);
        pdf.text(formatIndianCurrency(invoiceData.cgstAmount), 167, y);
        y += 5;
        pdf.text(`SGST (${invoiceData.sgstRate}%):`, 140, y);
        pdf.text(formatIndianCurrency(invoiceData.sgstAmount), 167, y);
        y += 6;
    } else {
        y += 3;
    }
    applyBrandFillColor(pdf, brandColor);
    pdf.rect(138, y - 3, 57, 7, 'F');
    pdf.setTextColor(255, 255, 255);
    pdf.setFont(undefined, 'bold');
    pdf.setFontSize(10);
    pdf.text('TOTAL:', 140, y + 2);
    pdf.text(formatIndianCurrency(invoiceData.grandTotal), 167, y + 2);
    resetTextColor(pdf);
}

// ============================================
// MAIN TEMPLATE RENDERER
// ============================================

/**
 * Main function to render invoice with selected template
 * @param {string} templateType - Template type: classic, modern, gst_format, retail
 * @param {Object} invoiceData - Invoice data
 * @param {Object} profile - User profile data
 * @param {Object} settings - Template settings (brand color, logo, etc.)
 * @returns {Promise<jsPDF>} - PDF document
 */
async function renderInvoiceTemplate(templateType, invoiceData, profile, settings) {
    const { jsPDF } = window.jspdf;
    const pdf = new jsPDF();
    
    // Default settings
    const defaultSettings = {
        brand_color: '#2845D6',
        show_logo: false,
        logo_url: null,
        logo_position: 'left'
    };
    
    const mergedSettings = { ...defaultSettings, ...settings };
    
    // Route to appropriate template renderer
    switch (templateType) {
        case 'modern':
            await renderModernTemplate(pdf, invoiceData, profile, mergedSettings);
            break;
        case 'gst_format':
            await renderGSTFormatTemplate(pdf, invoiceData, profile, mergedSettings);
            break;
        case 'retail':
            await renderRetailTemplate(pdf, invoiceData, profile, mergedSettings);
            break;
        case 'classic':
        default:
            await renderClassicTemplate(pdf, invoiceData, profile, mergedSettings);
            break;
    }
    
    // Add UPI QR code payment section (if UPI ID configured)
    await addUPIQRCodeToPDF(pdf, profile, invoiceData, 15, 215);
    
    // Add terms and conditions at the bottom (if space available)
    addTermsAndFooter(pdf, invoiceData, profile);
    
    return pdf;
}

/**
 * Add terms and conditions footer
 */
function addTermsAndFooter(pdf, invoiceData, profile) {
    const pageCount = pdf.internal.getNumberOfPages();
    const currentPage = pdf.internal.getCurrentPageInfo().pageNumber;
    
    // Only add on last page
    if (currentPage === pageCount) {
        let y = 258; // Near bottom of page (adjusted for UPI QR code above)
        
        if (invoiceData.termsConditions || profile?.terms_conditions) {
            const terms = invoiceData.termsConditions || profile?.terms_conditions;
            pdf.setFontSize(8);
            pdf.setFont(undefined, 'bold');
            pdf.text('Terms & Conditions:', 15, y);
            y += 4;
            
            pdf.setFont(undefined, 'normal');
            pdf.setFontSize(7);
            const termsLines = pdf.splitTextToSize(terms, 180);
            const maxLines = 5; // Limit to 5 lines
            termsLines.slice(0, maxLines).forEach(line => {
                pdf.text(line, 15, y);
                y += 3;
            });
        }
        
        // Signature space
        y = 275;
        pdf.setFontSize(9);
        pdf.text('Authorized Signatory', 160, y);
        pdf.line(160, y - 2, 195, y - 2);
    }
}

// ============================================
// QUOTATION TEMPLATE RENDERER
// ============================================

/**
 * Render a styled QUOTATION PDF using the user's invoice template + brand color.
 * quoteData shape: { quoteNumber, date, validUntil, customerName, customerAddress,
 *   customerMobile, customerGST, items:[{description,hsn_code,quantity,rate,discount_percent,amount}],
 *   taxMode, subtotal, sgstAmount, cgstAmount, sgstRate, cgstRate, grandTotal, notes }
 */
async function renderQuotationTemplate(templateType, quoteData, profile, settings) {
    const { jsPDF } = window.jspdf;
    const pdf = new jsPDF();
    const brandColor = settings.brand_color || '#2845D6';

    switch (templateType) {
        case 'modern':
            await renderQuotationModern(pdf, quoteData, profile, brandColor, settings);
            break;
        case 'gst_format':
            await renderQuotationGST(pdf, quoteData, profile, brandColor, settings);
            break;
        case 'retail':
            await renderQuotationRetail(pdf, quoteData, profile, brandColor, settings);
            break;
        case 'classic':
        default:
            await renderQuotationClassic(pdf, quoteData, profile, brandColor, settings);
            break;
    }

    // Terms & notes footer
    _addQuotationFooter(pdf, quoteData, profile);

    savePDF(pdf, `Quotation_${quoteData.quoteNumber}.pdf`);
}

// ─── Quotation: Classic ───────────────────────────────────────────────────────
async function renderQuotationClassic(pdf, q, profile, brandColor, settings) {
    let y = 20;

    // Title
    applyBrandColor(pdf, brandColor);
    pdf.setFontSize(20);
    pdf.setFont(undefined, 'bold');
    pdf.text('QUOTATION', 105, y, { align: 'center' });
    resetTextColor(pdf);

    // Meta row: Quote No / Date / Valid Until
    y += 8;
    pdf.setFontSize(9);
    pdf.setFont(undefined, 'normal');
    pdf.text(`Quote No: ${q.quoteNumber}`, 150, y);
    pdf.text(`Date: ${formatDateForPDF(q.date)}`, 150, y + 5);
    if (q.validUntil) pdf.text(`Valid Until: ${formatDateForPDF(q.validUntil)}`, 150, y + 10);

    // Logo
    if (settings.show_logo && settings.logo_url) {
        await addLogoToPDF(pdf, settings.logo_url, 15, 12, 30, 15);
    }

    // Company details
    y += 16;
    pdf.setFontSize(13);
    pdf.setFont(undefined, 'bold');
    pdf.text((profile?.business_name || 'Your Business').toUpperCase(), 15, y);
    pdf.setFontSize(9);
    pdf.setFont(undefined, 'normal');
    y += 5;
    if (profile?.business_address) {
        const al = pdf.splitTextToSize(profile.business_address, 100);
        al.forEach(l => { pdf.text(l, 15, y); y += 4; });
    }
    if (profile?.contact_number_1) { pdf.text(`Contact: ${profile.contact_number_1}`, 15, y); y += 4; }
    if (profile?.business_email)   { pdf.text(`Email: ${profile.business_email}`, 15, y); y += 4; }
    if (profile?.gst_number)       { pdf.text(`GST: ${profile.gst_number}`, 15, y); y += 4; }

    // Bill To
    y += 4;
    pdf.setFont(undefined, 'bold');
    pdf.text('Quotation For:', 15, y);
    pdf.setFont(undefined, 'normal');
    y += 5;
    pdf.text(q.customerName || '', 15, y); y += 5;
    if (q.customerAddress) {
        const al = pdf.splitTextToSize(q.customerAddress, 80);
        al.forEach(l => { pdf.text(l, 15, y); y += 4; });
    }
    if (q.customerMobile) { pdf.text(`Mobile: ${q.customerMobile}`, 15, y); y += 4; }
    if (q.customerGST)    { pdf.text(`GST: ${q.customerGST}`, 15, y); y += 4; }

    y += 4;
    _renderQuoteItemsClassic(pdf, q, y + 2, brandColor);
}

// ─── Quotation: Modern ────────────────────────────────────────────────────────
async function renderQuotationModern(pdf, q, profile, brandColor, settings) {
    // Coloured header banner
    applyBrandFillColor(pdf, brandColor);
    pdf.rect(0, 0, 210, 38, 'F');

    // Logo in header
    if (settings.show_logo && settings.logo_url) {
        await addLogoToPDF(pdf, settings.logo_url, 130, 4, 20, 30);
    }

    pdf.setTextColor(255, 255, 255);
    pdf.setFontSize(26);
    pdf.setFont(undefined, 'bold');
    pdf.text('QUOTATION', 15, 22);
    pdf.setFontSize(9);
    pdf.setFont(undefined, 'normal');
    pdf.text(`#${q.quoteNumber}`, 195, 12, { align: 'right' });
    pdf.text(`Date: ${formatDateForPDF(q.date)}`, 195, 18, { align: 'right' });
    if (q.validUntil) pdf.text(`Valid Until: ${formatDateForPDF(q.validUntil)}`, 195, 24, { align: 'right' });
    resetTextColor(pdf);

    let y = 45;

    // FROM / TO columns
    pdf.setFontSize(8);
    pdf.setFont(undefined, 'bold');
    applyBrandColor(pdf, brandColor);
    pdf.text('FROM', 15, y);
    pdf.text('TO', 110, y);
    resetTextColor(pdf);
    y += 5;

    pdf.setFontSize(11);
    pdf.setFont(undefined, 'bold');
    pdf.text(profile?.business_name || 'Your Business', 15, y);
    pdf.text(q.customerName || '', 110, y);
    y += 5;
    pdf.setFontSize(9);
    pdf.setFont(undefined, 'normal');

    let leftY = y, rightY = y;
    if (profile?.business_address) {
        const al = pdf.splitTextToSize(profile.business_address, 85);
        al.forEach(l => { pdf.text(l, 15, leftY); leftY += 4; });
    }
    if (profile?.contact_number_1) { pdf.text(profile.contact_number_1, 15, leftY); leftY += 4; }
    if (profile?.business_email)   { pdf.text(profile.business_email, 15, leftY); leftY += 4; }
    if (profile?.gst_number)       { pdf.text(`GST: ${profile.gst_number}`, 15, leftY); leftY += 4; }

    if (q.customerAddress) {
        const al = pdf.splitTextToSize(q.customerAddress, 85);
        al.forEach(l => { pdf.text(l, 110, rightY); rightY += 4; });
    }
    if (q.customerMobile) { pdf.text(`Mobile: ${q.customerMobile}`, 110, rightY); rightY += 4; }
    if (q.customerGST)    { pdf.text(`GST: ${q.customerGST}`, 110, rightY); rightY += 4; }

    y = Math.max(leftY, rightY) + 8;
    _renderQuoteItemsModern(pdf, q, y, brandColor);
}

// ─── Quotation: GST Format ────────────────────────────────────────────────────
async function renderQuotationGST(pdf, q, profile, brandColor, settings) {
    let y = 15;

    // Logo
    if (settings.show_logo && settings.logo_url) {
        await addLogoToPDF(pdf, settings.logo_url, 15, 3, 25, 12);
        y = 20;
    }

    // Company header box
    applyBrandFillColor(pdf, brandColor);
    pdf.rect(0, y, 210, 20, 'F');
    pdf.setTextColor(255, 255, 255);
    pdf.setFontSize(13);
    pdf.setFont(undefined, 'bold');
    pdf.text((profile?.business_name || 'Your Business').toUpperCase(), 105, y + 8, { align: 'center' });
    pdf.setFontSize(8);
    pdf.setFont(undefined, 'normal');
    const headerParts = [
        profile?.business_address,
        profile?.contact_number_1 ? `Ph: ${profile.contact_number_1}` : null,
        profile?.gst_number ? `GSTIN: ${profile.gst_number}` : null
    ].filter(Boolean).join('  |  ');
    pdf.text(headerParts, 105, y + 15, { align: 'center' });
    resetTextColor(pdf);
    y += 26;

    // Title strip
    applyBrandFillColor(pdf, brandColor);
    pdf.setFillColor(240, 240, 240);
    pdf.rect(0, y, 210, 8, 'F');
    pdf.setFontSize(11);
    pdf.setFont(undefined, 'bold');
    applyBrandColor(pdf, brandColor);
    pdf.text('QUOTATION', 105, y + 5.5, { align: 'center' });
    resetTextColor(pdf);
    y += 12;

    // Meta row
    pdf.setFontSize(9);
    pdf.setFont(undefined, 'bold');
    pdf.text(`Quote No: `, 15, y); pdf.setFont(undefined, 'normal'); pdf.text(q.quoteNumber, 38, y);
    pdf.setFont(undefined, 'bold'); pdf.text('Date: ', 80, y); pdf.setFont(undefined, 'normal'); pdf.text(formatDateForPDF(q.date), 93, y);
    if (q.validUntil) {
        pdf.setFont(undefined, 'bold'); pdf.text('Valid Until: ', 130, y); pdf.setFont(undefined, 'normal'); pdf.text(formatDateForPDF(q.validUntil), 155, y);
    }
    y += 10;

    // Bill To box
    pdf.setFontSize(9);
    pdf.setFont(undefined, 'bold');
    applyBrandColor(pdf, brandColor);
    pdf.text('BILL TO:', 15, y);
    resetTextColor(pdf);
    pdf.setFont(undefined, 'normal');
    y += 4;
    pdf.text(q.customerName || '', 15, y); y += 4;
    if (q.customerAddress) {
        const al = pdf.splitTextToSize(q.customerAddress, 85);
        al.forEach(l => { pdf.text(l, 15, y); y += 4; });
    }
    if (q.customerMobile) { pdf.text(`Mobile: ${q.customerMobile}`, 15, y); y += 4; }
    if (q.customerGST) { pdf.text(`GSTIN: ${q.customerGST}`, 15, y); y += 4; }

    y += 4;
    _renderQuoteItemsGST(pdf, q, y, brandColor);
}

// ─── Quotation: Retail ────────────────────────────────────────────────────────
async function renderQuotationRetail(pdf, q, profile, brandColor, settings) {
    let y = 15;

    // Logo
    if (settings.show_logo && settings.logo_url) {
        await addLogoToPDF(pdf, settings.logo_url, 88, 2, 34, 14);
        y = 20;
    }

    // Business name centered
    applyBrandColor(pdf, brandColor);
    pdf.setFontSize(16);
    pdf.setFont(undefined, 'bold');
    pdf.text((profile?.business_name || 'Your Business').toUpperCase(), 105, y, { align: 'center' });
    resetTextColor(pdf);
    y += 6;
    pdf.setFontSize(8);
    pdf.setFont(undefined, 'normal');
    const parts = [profile?.business_address, profile?.contact_number_1, profile?.gst_number ? `GST: ${profile.gst_number}` : null].filter(Boolean);
    parts.forEach(p => { pdf.text(p, 105, y, { align: 'center' }); y += 4; });

    // Thick brand colour divider
    applyBrandFillColor(pdf, brandColor);
    pdf.rect(15, y, 180, 2, 'F');
    y += 6;

    // QUOTATION title + meta
    pdf.setFontSize(13);
    pdf.setFont(undefined, 'bold');
    applyBrandColor(pdf, brandColor);
    pdf.text('QUOTATION', 105, y, { align: 'center' });
    resetTextColor(pdf);
    y += 6;
    pdf.setFontSize(9);
    pdf.setFont(undefined, 'normal');
    pdf.text(`Quote No: ${q.quoteNumber}`, 15, y);
    pdf.text(`Date: ${formatDateForPDF(q.date)}`, 105, y, { align: 'center' });
    if (q.validUntil) pdf.text(`Valid Until: ${formatDateForPDF(q.validUntil)}`, 195, y, { align: 'right' });
    y += 8;

    // Bill To
    pdf.setFont(undefined, 'bold');
    pdf.text('Quoted For:', 15, y);
    pdf.setFont(undefined, 'normal');
    y += 5;
    pdf.text(q.customerName || '', 15, y); y += 4;
    if (q.customerAddress) {
        const al = pdf.splitTextToSize(q.customerAddress, 85);
        al.forEach(l => { pdf.text(l, 15, y); y += 4; });
    }
    if (q.customerMobile) { pdf.text(`Mobile: ${q.customerMobile}`, 15, y); y += 4; }
    if (q.customerGST)    { pdf.text(`GST: ${q.customerGST}`, 15, y); y += 4; }

    y += 4;
    _renderQuoteItemsRetail(pdf, q, y, brandColor);
}

// ─── Shared quotation items table renderers ───────────────────────────────────

function _renderQuoteItemsClassic(pdf, q, startY, brandColor) {
    let y = startY;
    // Header
    pdf.setFillColor(240, 240, 240);
    pdf.rect(15, y, 180, 8, 'F');
    pdf.setFont(undefined, 'bold'); pdf.setFontSize(9);
    pdf.text('#', 17, y + 5);
    pdf.text('Description', 25, y + 5);
    pdf.text('HSN', 95, y + 5);
    pdf.text('Qty', 115, y + 5);
    pdf.text('Rate', 130, y + 5);
    pdf.text('Disc%', 150, y + 5);
    pdf.text('Amount', 168, y + 5);
    y += 10;
    pdf.setFont(undefined, 'normal');
    q.items.forEach((item, idx) => {
        if (y > 250) { pdf.addPage(); y = 20; }
        const desc = pdf.splitTextToSize(item.description || '', 65);
        pdf.text(String(idx + 1), 17, y + 4);
        pdf.text(desc, 25, y + 4);
        pdf.text(item.hsn_code || '', 95, y + 4);
        pdf.text(String(item.quantity), 115, y + 4);
        pdf.text(formatIndianCurrency(item.rate), 130, y + 4);
        pdf.text(item.discount_percent > 0 ? item.discount_percent + '%' : '-', 150, y + 4);
        pdf.text(formatIndianCurrency(item.amount), 168, y + 4);
        pdf.setDrawColor(220, 220, 220);
        pdf.line(15, y + 8, 195, y + 8);
        y += Math.max(8, desc.length * 5);
    });
    y += 3;
    _renderQuoteTotals(pdf, q, y, brandColor, 130, 168);
}

function _renderQuoteItemsModern(pdf, q, startY, brandColor) {
    let y = startY;
    applyBrandFillColor(pdf, brandColor);
    pdf.rect(15, y, 180, 10, 'F');
    pdf.setTextColor(255, 255, 255);
    pdf.setFont(undefined, 'bold'); pdf.setFontSize(9);
    pdf.text('Description', 17, y + 6);
    pdf.text('HSN', 95, y + 6);
    pdf.text('Qty', 115, y + 6);
    pdf.text('Rate', 130, y + 6);
    pdf.text('Disc%', 150, y + 6);
    pdf.text('Amount', 170, y + 6);
    resetTextColor(pdf);
    y += 12;
    pdf.setFont(undefined, 'normal');
    let alt = false;
    q.items.forEach(item => {
        if (y > 250) { pdf.addPage(); y = 20; }
        if (alt) { pdf.setFillColor(248, 248, 248); pdf.rect(15, y, 180, 8, 'F'); }
        const desc = pdf.splitTextToSize(item.description || '', 70);
        pdf.text(desc, 17, y + 5);
        pdf.text(item.hsn_code || '', 95, y + 5);
        pdf.text(String(item.quantity), 115, y + 5);
        pdf.text(formatIndianCurrency(item.rate), 130, y + 5);
        pdf.text(item.discount_percent > 0 ? item.discount_percent + '%' : '-', 150, y + 5);
        pdf.text(formatIndianCurrency(item.amount), 170, y + 5);
        y += Math.max(8, desc.length * 5);
        alt = !alt;
    });
    y += 4;
    pdf.setDrawColor(220, 220, 220);
    pdf.line(125, y, 195, y);
    y += 4;
    _renderQuoteTotals(pdf, q, y, brandColor, 127, 170);
}

function _renderQuoteItemsGST(pdf, q, startY, brandColor) {
    let y = startY;
    applyBrandFillColor(pdf, brandColor);
    pdf.rect(15, y, 180, 10, 'F');
    pdf.setTextColor(255, 255, 255);
    pdf.setFont(undefined, 'bold'); pdf.setFontSize(8);
    pdf.text('#', 17, y + 6);
    pdf.text('Description', 25, y + 6);
    pdf.text('HSN', 75, y + 6);
    pdf.text('Qty', 93, y + 6);
    pdf.text('Rate', 108, y + 6);
    pdf.text('Disc%', 126, y + 6);
    pdf.text('Taxable', 144, y + 6);
    pdf.text('CGST/SGST', 168, y + 6);
    resetTextColor(pdf);
    y += 12;
    pdf.setFont(undefined, 'normal'); pdf.setFontSize(8);
    q.items.forEach((item, idx) => {
        if (y > 250) { pdf.addPage(); y = 20; }
        const taxable = item.taxMode === 'with-tax'
            ? item.amount / (1 + (q.cgstRate + q.sgstRate) / 100)
            : item.amount;
        const perTax = q.taxMode === 'with-tax' ? taxable * (q.cgstRate / 100) : 0;
        const desc = pdf.splitTextToSize(item.description || '', 45);
        pdf.text(String(idx + 1), 17, y + 4);
        pdf.text(desc, 25, y + 4);
        pdf.text(item.hsn_code || '', 75, y + 4);
        pdf.text(String(item.quantity), 93, y + 4);
        pdf.text(formatIndianCurrency(item.rate), 108, y + 4);
        pdf.text(item.discount_percent > 0 ? item.discount_percent + '%' : '-', 126, y + 4);
        pdf.text(formatIndianCurrency(taxable), 144, y + 4);
        pdf.text(formatIndianCurrency(perTax), 168, y + 4);
        pdf.setDrawColor(220, 220, 220);
        pdf.line(15, y + 8, 195, y + 8);
        y += Math.max(8, desc.length * 5);
    });
    y += 3;
    _renderQuoteTotals(pdf, q, y, brandColor, 140, 168);
}

function _renderQuoteItemsRetail(pdf, q, startY, brandColor) {
    let y = startY;
    applyBrandFillColor(pdf, brandColor);
    pdf.rect(15, y, 180, 8, 'F');
    pdf.setTextColor(255, 255, 255);
    pdf.setFont(undefined, 'bold'); pdf.setFontSize(9);
    pdf.text('Item', 17, y + 5);
    pdf.text('HSN', 95, y + 5);
    pdf.text('Qty', 115, y + 5);
    pdf.text('Rate', 130, y + 5);
    pdf.text('Disc%', 150, y + 5);
    pdf.text('Amount', 170, y + 5);
    resetTextColor(pdf);
    y += 10;
    pdf.setFont(undefined, 'normal');
    q.items.forEach(item => {
        if (y > 250) { pdf.addPage(); y = 20; }
        const desc = pdf.splitTextToSize(item.description || '', 70);
        pdf.text(desc, 17, y + 4);
        pdf.text(item.hsn_code || '', 95, y + 4);
        pdf.text(String(item.quantity), 115, y + 4);
        pdf.text(formatIndianCurrency(item.rate), 130, y + 4);
        pdf.text(item.discount_percent > 0 ? item.discount_percent + '%' : '-', 150, y + 4);
        pdf.text(formatIndianCurrency(item.amount), 170, y + 4);
        pdf.setDrawColor(220, 220, 220);
        pdf.line(15, y + 7, 195, y + 7);
        y += Math.max(7, desc.length * 5);
    });
    y += 3;
    _renderQuoteTotals(pdf, q, y, brandColor, 130, 168);
}

// Shared totals block
function _renderQuoteTotals(pdf, q, y, brandColor, labelX, valueX) {
    pdf.setFontSize(9);
    pdf.setFont(undefined, 'normal');
    if (q.taxMode === 'with-tax') {
        pdf.text('Subtotal (excl. GST):', labelX, y);
        pdf.text(`Rs.${formatIndianCurrency(q.subtotal)}`, valueX + 27, y, { align: 'right' });
        y += 6;
        if (q.cgstAmount > 0) {
            pdf.text(`CGST (${q.cgstRate}%):`, labelX, y);
            pdf.text(`Rs.${formatIndianCurrency(q.cgstAmount)}`, valueX + 27, y, { align: 'right' });
            y += 6;
            pdf.text(`SGST (${q.sgstRate}%):`, labelX, y);
            pdf.text(`Rs.${formatIndianCurrency(q.sgstAmount)}`, valueX + 27, y, { align: 'right' });
            y += 6;
        }
    }
    applyBrandFillColor(pdf, brandColor);
    pdf.rect(labelX - 2, y - 4, valueX + 27 - labelX + 4, 10, 'F');
    pdf.setTextColor(255, 255, 255);
    pdf.setFont(undefined, 'bold');
    pdf.setFontSize(11);
    pdf.text('TOTAL:', labelX, y + 3);
    pdf.text(`Rs.${formatIndianCurrency(q.grandTotal)}`, valueX + 27, y + 3, { align: 'right' });
    resetTextColor(pdf);
}

// Quotation footer (notes / terms / signature)
function _addQuotationFooter(pdf, q, profile) {
    let y = 252;
    if (q.notes) {
        pdf.setFontSize(8);
        pdf.setFont(undefined, 'bold');
        pdf.text('Notes / Terms:', 15, y);
        y += 4;
        pdf.setFont(undefined, 'normal');
        pdf.setFontSize(7);
        const nl = pdf.splitTextToSize(q.notes, 180);
        nl.slice(0, 6).forEach(l => { pdf.text(l, 15, y); y += 3; });
    }
    y = 275;
    pdf.setFontSize(9);
    pdf.text('Authorised Signatory', 160, y);
    pdf.line(160, y - 2, 195, y - 2);
}

