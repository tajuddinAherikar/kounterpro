/**
 * Invoice Template Renderers
 * Modular system for generating different invoice template styles
 * Supports: Classic, Modern, GST Format, and Retail templates
 */

// ============================================
// UTILITY FUNCTIONS
// ============================================

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
    pdf.text('Serial No', 85, y + 5);
    pdf.text('Qty', 115, y + 5);
    pdf.text('Rate', 135, y + 5);
    pdf.text('Amount', 165, y + 5);
    
    y += 8;
    pdf.setFont(undefined, 'normal');
    
    // Table rows
    invoiceData.items.forEach((item, index) => {
        if (y > 250) {
            pdf.addPage();
            y = 20;
        }
        
        pdf.text(String(item.slNo ?? index + 1), 17, y + 5);
        const descText = pdf.splitTextToSize(item.description, 55);
        pdf.text(descText, 28, y + 5);
        if (item.serialNo) {
            const serialText = pdf.splitTextToSize(item.serialNo, 28);
            pdf.text(serialText, 85, y + 5);
        }
        pdf.text(String(item.quantity), 115, y + 5);
        pdf.text(formatIndianCurrency(item.rate), 135, y + 5);
        pdf.text(formatIndianCurrency(item.amount), 165, y + 5);
        
        pdf.setDrawColor(220, 220, 220);
        pdf.line(15, y + 8, 195, y + 8);
        y += 8;
    });
    
    // Totals
    y += 5;
    pdf.setFont(undefined, 'normal');
    pdf.text('Subtotal:', 130, y);
    pdf.text(formatIndianCurrency(invoiceData.subtotal), 165, y);
    
    y += 6;
    pdf.text(`GST (${invoiceData.gstRate}%)`, 130, y);
    pdf.text(formatIndianCurrency(invoiceData.gstAmount), 165, y);
    
    y += 6;
    applyBrandFillColor(pdf, brandColor);
    pdf.rect(128, y - 4, 67, 8, 'F');
    pdf.setTextColor(255, 255, 255);
    pdf.setFont(undefined, 'bold');
    pdf.setFontSize(11);
    pdf.text('Grand Total:', 130, y + 2);
    pdf.text(formatIndianCurrency(invoiceData.grandTotal), 165, y + 2);
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
    pdf.text('Qty', 125, y + 6);
    pdf.text('Rate', 145, y + 6);
    pdf.text('Amount', 170, y + 6);
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
        pdf.text(String(item.quantity), 125, y + 5);
        pdf.text(formatIndianCurrency(item.rate), 145, y + 5);
        pdf.text(formatIndianCurrency(item.amount), 170, y + 5);
        
        y += 8;
        isAlternate = !isAlternate;
    });
    
    // Totals section
    y += 5;
    pdf.setDrawColor(220, 220, 220);
    pdf.line(125, y, 195, y);
    y += 5;
    
    pdf.text('Subtotal', 125, y);
    pdf.text(formatIndianCurrency(invoiceData.subtotal), 170, y);
    
    y += 6;
    pdf.text(`Tax (${invoiceData.gstRate}%)`, 125, y);
    pdf.text(formatIndianCurrency(invoiceData.gstAmount), 170, y);
    
    y += 8;
    applyBrandFillColor(pdf, brandColor);
    pdf.rect(125, y - 5, 70, 10, 'F');
    pdf.setTextColor(255, 255, 255);
    pdf.setFont(undefined, 'bold');
    pdf.setFontSize(12);
    pdf.text('TOTAL', 127, y + 2);
    pdf.text(formatIndianCurrency(invoiceData.grandTotal), 170, y + 2);
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
        
        const gstRate = invoiceData.gstRate || 18;
        const taxableAmount = item.amount;
        const cgstAmount = (taxableAmount * gstRate / 2) / 100;
        const sgstAmount = cgstAmount;
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
    
    const gstRate = invoiceData.gstRate || 18;
    const cgstAmount = invoiceData.gstAmount / 2;
    const sgstAmount = invoiceData.gstAmount / 2;
    
    pdf.text('Taxable Amount:', 120, y);
    pdf.text(formatIndianCurrency(invoiceData.subtotal), 165, y);
    y += 5;
    
    pdf.text(`CGST (${gstRate/2}%):`, 120, y);
    pdf.text(formatIndianCurrency(cgstAmount), 165, y);
    y += 5;
    
    pdf.text(`SGST (${gstRate/2}%):`, 120, y);
    pdf.text(formatIndianCurrency(sgstAmount), 165, y);
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
    pdf.text('Qty', 125, y + 4);
    pdf.text('Price', 145, y + 4);
    pdf.text('Total', 170, y + 4);
    
    y += 6;
    pdf.setFont(undefined, 'normal');
    
    // Compact items list
    invoiceData.items.forEach(item => {
        if (y > 260) {
            pdf.addPage();
            y = 20;
        }
        
        pdf.text(item.description, 17, y + 4);
        pdf.text(String(item.quantity), 125, y + 4);
        pdf.text(formatIndianCurrency(item.rate), 145, y + 4);
        pdf.text(formatIndianCurrency(item.amount), 170, y + 4);
        
        pdf.setDrawColor(240, 240, 240);
        pdf.line(15, y + 6, 195, y + 6);
        y += 6;
    });
    
    // Quick totals
    y += 3;
    pdf.setFontSize(9);
    pdf.text('Subtotal:', 145, y);
    pdf.text(formatIndianCurrency(invoiceData.subtotal), 170, y);
    
    y += 5;
    pdf.text(`Tax (${invoiceData.gstRate}%):`, 145, y);
    pdf.text(formatIndianCurrency(invoiceData.gstAmount), 170, y);
    
    y += 6;
    applyBrandFillColor(pdf, brandColor);
    pdf.rect(143, y - 3, 52, 7, 'F');
    pdf.setTextColor(255, 255, 255);
    pdf.setFont(undefined, 'bold');
    pdf.setFontSize(10);
    pdf.text('TOTAL:', 145, y + 2);
    pdf.text(formatIndianCurrency(invoiceData.grandTotal), 170, y + 2);
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
