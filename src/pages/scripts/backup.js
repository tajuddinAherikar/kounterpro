// ===== BACKUP & RESTORE FUNCTIONALITY =====
// Centralized backup functions for all pages

/**
 * Export all user data as JSON backup from Supabase
 * Downloads a JSON file containing inventory, invoices, customers, and expenses
 */
async function exportBackup() {
    try {
        const result = await downloadSupabaseBackup();
        if (result.success) {
            if (typeof showToast === 'function') {
                showToast('✅ Backup downloaded successfully', 'success');
            } else {
                alert('✅ Backup downloaded successfully');
            }
        } else {
            if (typeof showToast === 'function') {
                showToast('❌ Backup failed: ' + result.error, 'error');
            } else {
                alert('❌ Backup failed: ' + result.error);
            }
        }
    } catch (error) {
        console.error('Backup error:', error);
        if (typeof showToast === 'function') {
            showToast('❌ Backup failed: ' + error.message, 'error');
        } else {
            alert('❌ Backup failed: ' + error.message);
        }
    }
}

/**
 * Import and restore data from JSON backup file
 * Note: Currently shows info message as restore is not implemented for Supabase
 */
async function importBackup(event) {
    const file = event.target.files[0];
    
    if (!file) {
        return;
    }
    
    // Validate file type
    if (!file.name.endsWith('.json')) {
        if (typeof showToast === 'function') {
            showToast('❌ Invalid file type. Please select a JSON backup file.', 'error');
        } else {
            alert('❌ Invalid file type. Please select a JSON backup file.');
        }
        event.target.value = '';
        return;
    }
    
    // Note: Restore from file not implemented for Supabase
    const message = 'Backup restore from file is not yet available with Supabase.\n\n' +
                    'Your data is safely stored in the cloud and automatically backed up.\n\n' +
                    'To restore data or manage backups, please use the Supabase Dashboard.';
    
    if (typeof showDialog === 'function') {
        showDialog({
            title: 'Restore Not Available',
            message: message,
            type: 'info'
        });
    } else {
        alert('ℹ️ ' + message);
    }
    
    event.target.value = '';
}
