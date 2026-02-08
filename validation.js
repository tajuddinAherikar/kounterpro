// Validation and Sanitization Utilities

// ===== INPUT SANITIZATION =====

/**
 * Sanitize string input to prevent XSS attacks
 * Removes HTML tags and encodes special characters
 */
function sanitizeInput(input) {
    if (typeof input !== 'string') return input;
    
    // Create a temporary div to use browser's HTML encoding
    const temp = document.createElement('div');
    temp.textContent = input;
    return temp.innerHTML;
}

/**
 * Sanitize object with all string properties
 */
function sanitizeObject(obj) {
    const sanitized = {};
    for (const key in obj) {
        if (typeof obj[key] === 'string') {
            sanitized[key] = sanitizeInput(obj[key]);
        } else if (typeof obj[key] === 'object' && obj[key] !== null) {
            sanitized[key] = sanitizeObject(obj[key]);
        } else {
            sanitized[key] = obj[key];
        }
    }
    return sanitized;
}

// ===== VALIDATION FUNCTIONS =====

/**
 * Validate Indian mobile number
 * Accepts 10-digit numbers with optional country code
 */
function validateMobileNumber(mobile) {
    if (!mobile) return { valid: false, message: 'Mobile number is required' };
    
    // Remove spaces, dashes, and country code
    const cleaned = mobile.replace(/[\s\-\+]/g, '');
    
    // Check if it's 10 digits (Indian format)
    if (cleaned.length === 10 && /^[6-9]\d{9}$/.test(cleaned)) {
        return { valid: true, number: cleaned };
    }
    
    // Check if it's 12 digits with country code (91)
    if (cleaned.length === 12 && /^91[6-9]\d{9}$/.test(cleaned)) {
        return { valid: true, number: cleaned.substring(2) };
    }
    
    return { 
        valid: false, 
        message: 'Please enter a valid 10-digit mobile number (starting with 6-9)' 
    };
}

/**
 * Validate GST number format
 * Format: 22AAAAA0000A1Z5 (15 characters)
 */
function validateGSTNumber(gst) {
    if (!gst) return { valid: true, message: 'GST is optional' }; // GST is optional
    
    const cleaned = gst.trim().toUpperCase();
    
    // GST format: 2 digits + 10 chars + 1 digit + 1 char + 1 digit
    const gstRegex = /^[0-9]{2}[A-Z]{5}[0-9]{4}[A-Z]{1}[1-9A-Z]{1}Z[0-9A-Z]{1}$/;
    
    if (gstRegex.test(cleaned)) {
        return { valid: true, number: cleaned };
    }
    
    return { 
        valid: false, 
        message: 'Invalid GST format. Example: 22AAAAA0000A1Z5' 
    };
}

/**
 * Validate email address
 */
function validateEmail(email) {
    if (!email) return { valid: false, message: 'Email is required' };
    
    const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
    
    if (emailRegex.test(email)) {
        return { valid: true, email: email.toLowerCase() };
    }
    
    return { valid: false, message: 'Please enter a valid email address' };
}

/**
 * Validate positive number
 */
function validatePositiveNumber(value, fieldName = 'Value') {
    const num = parseFloat(value);
    
    if (isNaN(num)) {
        return { valid: false, message: `${fieldName} must be a number` };
    }
    
    if (num < 0) {
        return { valid: false, message: `${fieldName} cannot be negative` };
    }
    
    if (num === 0) {
        return { valid: false, message: `${fieldName} must be greater than 0` };
    }
    
    return { valid: true, value: num };
}

/**
 * Validate positive integer
 */
function validatePositiveInteger(value, fieldName = 'Value') {
    const num = parseInt(value);
    
    if (isNaN(num)) {
        return { valid: false, message: `${fieldName} must be a number` };
    }
    
    if (num < 0) {
        return { valid: false, message: `${fieldName} cannot be negative` };
    }
    
    if (!Number.isInteger(parseFloat(value))) {
        return { valid: false, message: `${fieldName} must be a whole number` };
    }
    
    return { valid: true, value: num };
}

/**
 * Validate string with length constraints
 */
function validateString(value, fieldName, minLength = 1, maxLength = 255) {
    if (!value || value.trim().length === 0) {
        return { valid: false, message: `${fieldName} is required` };
    }
    
    const trimmed = value.trim();
    
    if (trimmed.length < minLength) {
        return { valid: false, message: `${fieldName} must be at least ${minLength} characters` };
    }
    
    if (trimmed.length > maxLength) {
        return { valid: false, message: `${fieldName} must not exceed ${maxLength} characters` };
    }
    
    return { valid: true, value: trimmed };
}

/**
 * Validate date
 */
function validateDate(dateString, fieldName = 'Date') {
    if (!dateString) {
        return { valid: false, message: `${fieldName} is required` };
    }
    
    const date = new Date(dateString);
    
    if (isNaN(date.getTime())) {
        return { valid: false, message: `${fieldName} is not a valid date` };
    }
    
    // Check if date is not too far in the past or future
    const minDate = new Date('2020-01-01');
    const maxDate = new Date('2030-12-31');
    
    if (date < minDate || date > maxDate) {
        return { valid: false, message: `${fieldName} must be between 2020 and 2030` };
    }
    
    return { valid: true, date: date };
}

// ===== LOCALSTORAGE ERROR HANDLING =====

/**
 * Safe localStorage getItem with error handling
 */
function safeGetItem(key, defaultValue = null) {
    try {
        const item = localStorage.getItem(key);
        return item ? JSON.parse(item) : defaultValue;
    } catch (error) {
        console.error(`Error reading from localStorage (${key}):`, error);
        showError(`Failed to load ${key} data. Your browser's storage might be corrupted.`);
        return defaultValue;
    }
}

/**
 * Safe localStorage setItem with error handling
 */
function safeSetItem(key, value) {
    try {
        localStorage.setItem(key, JSON.stringify(value));
        return { success: true };
    } catch (error) {
        console.error(`Error writing to localStorage (${key}):`, error);
        
        // Check if quota exceeded
        if (error.name === 'QuotaExceededError') {
            showError('Storage limit exceeded! Please backup and clear old data.');
            return { success: false, error: 'quota_exceeded' };
        }
        
        showError(`Failed to save ${key} data. Please try again.`);
        return { success: false, error: 'storage_error' };
    }
}

// ===== USER FEEDBACK =====

/**
 * Show error message to user
 */
function showError(message) {
    // For now, use alert. Can be replaced with toast notifications later
    alert('❌ Error: ' + message);
}

/**
 * Show success message to user
 */
function showSuccess(message) {
    alert('✅ Success: ' + message);
}

/**
 * Show confirmation dialog
 */
function showConfirmation(message) {
    return confirm(message);
}

/**
 * Show loading indicator
 */
function showLoading(message = 'Processing...') {
    // Create loading overlay if it doesn't exist
    let overlay = document.getElementById('loadingOverlay');
    
    if (!overlay) {
        overlay = document.createElement('div');
        overlay.id = 'loadingOverlay';
        overlay.innerHTML = `
            <div class="loading-content">
                <div class="spinner"></div>
                <p id="loadingMessage">${message}</p>
            </div>
        `;
        document.body.appendChild(overlay);
    } else {
        document.getElementById('loadingMessage').textContent = message;
    }
    
    overlay.style.display = 'flex';
}

/**
 * Hide loading indicator
 */
function hideLoading() {
    const overlay = document.getElementById('loadingOverlay');
    if (overlay) {
        overlay.style.display = 'none';
    }
}

// ===== STOCK VALIDATION =====

/**
 * Check if sufficient stock is available
 */
function validateStock(productName, requiredQuantity, inventory) {
    const product = inventory.find(item => 
        item.name.toLowerCase() === productName.toLowerCase()
    );
    
    if (!product) {
        return { 
            valid: false, 
            message: `Product "${productName}" not found in inventory`,
            type: 'not_found'
        };
    }
    
    if (product.stock <= 0) {
        return { 
            valid: false, 
            message: `"${productName}" is out of stock (0 units available)`,
            type: 'out_of_stock',
            available: 0
        };
    }
    
    if (product.stock < requiredQuantity) {
        return { 
            valid: false, 
            message: `Insufficient stock for "${productName}". Available: ${product.stock}, Required: ${requiredQuantity}`,
            type: 'insufficient_stock',
            available: product.stock
        };
    }
    
    // Warning for low stock
    if (product.stock < 10 && product.stock >= requiredQuantity) {
        return {
            valid: true,
            warning: true,
            message: `Low stock warning: Only ${product.stock} units of "${productName}" remaining after this sale`,
            available: product.stock
        };
    }
    
    return { valid: true, available: product.stock };
}

/**
 * Validate all items in invoice have sufficient stock
 */
function validateInvoiceStock(items, inventory) {
    const warnings = [];
    const errors = [];
    
    for (const item of items) {
        const result = validateStock(item.description, item.quantity, inventory);
        
        if (!result.valid) {
            errors.push(result.message);
        } else if (result.warning) {
            warnings.push(result.message);
        }
    }
    
    return { 
        valid: errors.length === 0, 
        errors, 
        warnings 
    };
}

// ===== CHARACTER LIMITS =====

const LIMITS = {
    CUSTOMER_NAME: { min: 2, max: 100 },
    CUSTOMER_ADDRESS: { min: 5, max: 255 },
    MOBILE_NUMBER: { exact: 10 },
    GST_NUMBER: { exact: 15 },
    PRODUCT_NAME: { min: 2, max: 100 },
    PRODUCT_DESCRIPTION: { min: 0, max: 255 },
    SERIAL_NUMBER: { min: 0, max: 50 },
    TERMS: { min: 10, max: 1000 }
};

/**
 * Apply character limit to input field
 */
function applyCharacterLimit(inputElement, maxLength) {
    inputElement.setAttribute('maxlength', maxLength);
    
    // Add character counter if doesn't exist
    let counter = inputElement.nextElementSibling;
    if (!counter || !counter.classList.contains('char-counter')) {
        counter = document.createElement('span');
        counter.className = 'char-counter';
        inputElement.parentNode.insertBefore(counter, inputElement.nextSibling);
    }
    
    const updateCounter = () => {
        const remaining = maxLength - inputElement.value.length;
        counter.textContent = `${remaining} characters remaining`;
        counter.style.color = remaining < 10 ? '#c62828' : '#666';
    };
    
    inputElement.addEventListener('input', updateCounter);
    updateCounter();
}
