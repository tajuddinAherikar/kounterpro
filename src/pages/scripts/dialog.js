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
 * Show a status picker dialog for quotation status changes.
 * @param {string} currentStatus - The current status key ('draft','sent','accepted','rejected')
 * @returns {Promise<string|null>} - Resolves to new status key, or null on cancel
 */
function showStatusPickerDialog(currentStatus) {
    return new Promise((resolve) => {
        const statuses = [
            { key: 'draft',    label: 'Draft',    icon: 'edit_note',    css: 'status-draft' },
            { key: 'sent',     label: 'Sent',     icon: 'send',         css: 'status-sent' },
            { key: 'accepted', label: 'Accepted', icon: 'check_circle', css: 'status-accepted' },
            { key: 'rejected', label: 'Rejected', icon: 'cancel',       css: 'status-rejected' },
        ];
        const options = statuses.filter(s => s.key !== currentStatus);
        const current = statuses.find(s => s.key === currentStatus) || statuses[0];

        const overlay = document.createElement('div');
        overlay.className = 'modal-overlay show';

        const dialog = document.createElement('div');
        dialog.className = 'confirmation-dialog';
        dialog.style.maxWidth = '340px';

        const header = document.createElement('div');
        header.className = 'dialog-header info';
        header.innerHTML = `<h2><span class="material-icons icon">swap_horiz</span> Change Status</h2>`;

        const content = document.createElement('div');
        content.className = 'dialog-content';
        content.innerHTML = `
            <p style="margin:0 0 14px;color:var(--text-secondary,#64748b);font-size:13px;">
                Current:
                <span class="status-badge ${current.css}" style="display:inline-flex;align-items:center;gap:4px;padding:3px 10px;border-radius:20px;vertical-align:middle;">
                    <span class="material-icons" style="font-size:13px;">${current.icon}</span>${current.label}
                </span>
            </p>
            <p style="margin:0 0 12px;font-weight:500;font-size:14px;color:var(--text-primary,#1e293b);">Select new status:</p>
        `;

        const optionsContainer = document.createElement('div');
        optionsContainer.style.cssText = 'display:flex;flex-direction:column;gap:10px;';

        options.forEach(s => {
            const btn = document.createElement('button');
            btn.className = `status-badge ${s.css}`;
            btn.style.cssText = 'display:flex;align-items:center;gap:10px;padding:13px 16px;border-radius:10px;border:1.5px solid transparent;cursor:pointer;font-size:15px;font-weight:500;width:100%;text-align:left;transition:opacity .15s,transform .1s;';
            btn.innerHTML = `<span class="material-icons" style="font-size:20px;">${s.icon}</span>${s.label}`;
            btn.onmouseenter = () => { btn.style.opacity = '0.85'; btn.style.transform = 'translateY(-1px)'; };
            btn.onmouseleave = () => { btn.style.opacity = '1'; btn.style.transform = ''; };
            btn.onclick = () => { closeDialog(); resolve(s.key); };
            optionsContainer.appendChild(btn);
        });

        content.appendChild(optionsContainer);

        const footer = document.createElement('div');
        footer.className = 'dialog-footer';
        const cancelBtn = document.createElement('button');
        cancelBtn.className = 'dialog-btn dialog-btn-cancel';
        cancelBtn.textContent = 'Cancel';
        cancelBtn.onclick = () => { closeDialog(); resolve(null); };
        footer.appendChild(cancelBtn);

        dialog.appendChild(header);
        dialog.appendChild(content);
        dialog.appendChild(footer);
        overlay.appendChild(dialog);
        document.body.appendChild(overlay);

        const handleKeydown = (e) => {
            if (e.key === 'Escape') { closeDialog(); resolve(null); }
        };
        document.addEventListener('keydown', handleKeydown);

        function closeDialog() {
            document.removeEventListener('keydown', handleKeydown);
            overlay.classList.remove('show');
            setTimeout(() => { if (overlay.parentElement) overlay.parentElement.removeChild(overlay); }, 200);
        }
    });
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
