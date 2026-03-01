// Toast Notification System

// Create toast container if it doesn't exist
function ensureToastContainer() {
    let container = document.getElementById('toastContainer');
    if (!container) {
        container = document.createElement('div');
        container.id = 'toastContainer';
        container.className = 'toast-container';
        document.body.appendChild(container);
    }
    return container;
}

// Show toast notification
function showToast(message, type = 'info', duration = 4000) {
    const container = ensureToastContainer();
    
    // Parse message if it contains emoji prefix
    let title = '';
    let content = message;
    
    // Extract emoji and title from common patterns
    if (message.startsWith('✅')) {
        type = 'success';
        content = message.replace('✅', '').trim();
        title = 'Success';
    } else if (message.startsWith('❌')) {
        type = 'error';
        content = message.replace('❌', '').trim();
        title = 'Error';
    } else if (message.startsWith('⚠️') || message.startsWith('📎')) {
        type = 'warning';
        content = message.replace(/⚠️|📎/, '').trim();
        title = 'Warning';
    } else if (message.startsWith('ℹ️')) {
        type = 'info';
        content = message.replace('ℹ️', '').trim();
        title = 'Information';
    }
    
    // If content has "Error:" or "Success:" prefix, extract it
    const errorMatch = content.match(/^Error:\s*(.+)/i);
    const successMatch = content.match(/^Success:\s*(.+)/i);
    
    if (errorMatch) {
        content = errorMatch[1];
        title = 'Error';
        type = 'error';
    } else if (successMatch) {
        content = successMatch[1];
        title = 'Success';
        type = 'success';
    }
    
    // Set default titles based on type
    if (!title) {
        switch(type) {
            case 'success': title = 'Success'; break;
            case 'error': title = 'Error'; break;
            case 'warning': title = 'Warning'; break;
            case 'info': title = 'Information'; break;
            default: title = 'Notification';
        }
    }
    
    // Icon based on type
    const icons = {
        success: 'check_circle',
        error: 'error',
        warning: 'warning',
        info: 'info'
    };
    
    const icon = icons[type] || 'notifications';
    
    // Create toast element
    const toast = document.createElement('div');
    toast.className = `toast ${type}`;
    toast.innerHTML = `
        <div class="toast-icon">
            <span class="material-icons">${icon}</span>
        </div>
        <div class="toast-content">
            <p class="toast-title">${title}</p>
            <p class="toast-message">${content}</p>
        </div>
        <button class="toast-close" onclick="this.parentElement.remove()">
            <span class="material-icons">close</span>
        </button>
    `;
    
    container.appendChild(toast);
    
    // Auto remove after duration
    if (duration > 0) {
        setTimeout(() => {
            toast.classList.add('hiding');
            setTimeout(() => {
                if (toast.parentElement) {
                    toast.remove();
                }
            }, 300);
        }, duration);
    }
    
    return toast;
}

// Convenience methods
function showSuccess(message, duration = 4000) {
    return showToast(message, 'success', duration);
}

function showError(message, duration = 5000) {
    return showToast(message, 'error', duration);
}

function showWarning(message, duration = 5000) {
    return showToast(message, 'warning', duration);
}

function showInfo(message, duration = 4000) {
    return showToast(message, 'info', duration);
}

// Override default alert
const originalAlert = window.alert;
window.alert = function(message) {
    // Determine type based on message content
    if (message.includes('✅') || message.toLowerCase().includes('success')) {
        showSuccess(message);
    } else if (message.includes('❌') || message.toLowerCase().includes('error')) {
        showError(message);
    } else if (message.includes('⚠️') || message.includes('📎') || message.toLowerCase().includes('warning')) {
        showWarning(message);
    } else {
        showInfo(message);
    }
};

// Keep original alert available if needed
window.originalAlert = originalAlert;
