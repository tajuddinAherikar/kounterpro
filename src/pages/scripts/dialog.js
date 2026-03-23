/**
 * Custom Dialog System
 * Replaces browser confirm() with stylish custom dialogs
 */

/**
 * Create a confirmation dialog
 * @param {Object} options - Dialog options
 * @param {string} options.title - Dialog title
 * @param {string} options.message - Dialog message/content
 * @param {string} options.confirmText - Confirm button text (default: "Confirm")
 * @param {string} options.cancelText - Cancel button text (default: "Cancel")
 * @param {string} options.type - Dialog type: 'danger', 'warning', 'success', 'info' (default: 'info')
 * @param {string} options.icon - Material icon name
 * @returns {Promise<boolean>} - Resolves to true if confirmed, false if cancelled
 */
function showConfirmDialog(options = {}) {
    return new Promise((resolve) => {
        // Set defaults
        const {
            title = 'Confirm Action',
            message = 'Are you sure you want to continue?',
            confirmText = 'Confirm',
            cancelText = 'Cancel',
            type = 'info',
            icon = getDefaultIcon(type)
        } = options;

        // Create modal overlay
        const overlay = document.createElement('div');
        overlay.className = 'modal-overlay show';

        // Create dialog
        const dialog = document.createElement('div');
        dialog.className = 'confirmation-dialog';

        // Create header
        const header = document.createElement('div');
        header.className = `dialog-header ${type}`;
        header.innerHTML = `
            <h2>
                <span class="material-icons icon">${icon}</span>
                ${title}
            </h2>
        `;

        // Create content
        const content = document.createElement('div');
        content.className = 'dialog-content';
        content.textContent = message;

        // Create footer with buttons
        const footer = document.createElement('div');
        footer.className = 'dialog-footer';

        const cancelBtn = document.createElement('button');
        cancelBtn.className = 'dialog-btn dialog-btn-cancel';
        cancelBtn.textContent = cancelText;
        cancelBtn.onclick = () => {
            closeDialog();
            resolve(false);
        };

        const confirmBtn = document.createElement('button');
        confirmBtn.className = `dialog-btn dialog-btn-confirm ${type}`;
        confirmBtn.textContent = confirmText;
        confirmBtn.onclick = () => {
            closeDialog();
            resolve(true);
        };

        footer.appendChild(cancelBtn);
        footer.appendChild(confirmBtn);

        // Assemble dialog
        dialog.appendChild(header);
        dialog.appendChild(content);
        dialog.appendChild(footer);
        overlay.appendChild(dialog);
        document.body.appendChild(overlay);

        // Handle keyboard events
        const handleKeydown = (e) => {
            if (e.key === 'Escape') {
                closeDialog();
                resolve(false);
            }
            if (e.key === 'Enter') {
                closeDialog();
                resolve(true);
            }
        };

        document.addEventListener('keydown', handleKeydown);

        // Close dialog function
        function closeDialog() {
            document.removeEventListener('keydown', handleKeydown);
            overlay.classList.remove('show');
            setTimeout(() => {
                if (overlay.parentElement) {
                    overlay.parentElement.removeChild(overlay);
                }
            }, 200);
        }

        // Auto-focus confirm button for accessibility
        setTimeout(() => {
            confirmBtn.focus();
        }, 100);
    });
}

/**
 * Show a deletion confirmation dialog (convenience function)
 * @param {string} itemName - Name of the item being deleted
 * @returns {Promise<boolean>}
 */
function showDeleteConfirm(itemName = 'this item') {
    return showConfirmDialog({
        title: 'Delete Confirmation',
        message: `Are you sure you want to delete ${itemName}? This action cannot be undone.`,
        confirmText: 'Delete',
        cancelText: 'Cancel',
        type: 'danger',
        icon: 'delete_outline'
    });
}

/**
 * Show a restore/overwrite confirmation dialog
 * @returns {Promise<boolean>}
 */
function showRestoreConfirm() {
    return showConfirmDialog({
        title: 'Restore Backup',
        message: 'This will replace all current data with the backup file. Are you sure you want to continue? Make sure to backup current data first!',
        confirmText: 'Restore',
        cancelText: 'Cancel',
        type: 'warning',
        icon: 'warning'
    });
}

/**
 * Show a logout confirmation dialog
 * @returns {Promise<boolean>}
 */
function showLogoutConfirm() {
    return showConfirmDialog({
        title: 'Logout',
        message: 'Are you sure you want to logout? Make sure you have backed up your data.',
        confirmText: 'Logout',
        cancelText: 'Cancel',
        type: 'warning',
        icon: 'logout'
    });
}

/**
 * Show a clear data confirmation dialog
 * @returns {Promise<boolean>}
 */
function showClearDataConfirm() {
    return showConfirmDialog({
        title: 'Clear All Data',
        message: 'Are you sure you want to clear all data? This will delete all invoices, inventory, and customer data. This action cannot be undone!',
        confirmText: 'Clear All Data',
        cancelText: 'Cancel',
        type: 'danger',
        icon: 'delete_sweep'
    });
}

/**
 * Get default icon based on dialog type
 * @param {string} type - Dialog type
 * @returns {string} - Material icon name
 */
function getDefaultIcon(type) {
    const icons = {
        danger: 'error_outline',
        warning: 'warning',
        success: 'check_circle',
        info: 'info'
    };
    return icons[type] || icons.info;
}

/**
 * Close all open dialogs
 */
function closeAllDialogs() {
    const overlays = document.querySelectorAll('.modal-overlay.show');
    overlays.forEach(overlay => {
        overlay.classList.remove('show');
        setTimeout(() => {
            if (overlay.parentElement) {
                overlay.parentElement.removeChild(overlay);
            }
        }, 200);
    });
}
