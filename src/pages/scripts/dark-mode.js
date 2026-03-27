// Dark Mode Toggle Functionality

// Initialize dark mode on page load
function initializeDarkMode() {
    // Check for saved preference only (don't use system preference)
    const savedTheme = localStorage.getItem('theme') || 'light';
    
    // Apply theme instantly without transition
    document.documentElement.setAttribute('data-theme-changing', '');
    document.documentElement.setAttribute('data-theme', savedTheme);
    
    // Update toggle icon
    updateDarkModeIcon(savedTheme);
    
    // Remove changing attribute after a brief moment
    setTimeout(() => {
        document.documentElement.removeAttribute('data-theme-changing');
    }, 50);
}

// Toggle dark mode
function toggleDarkMode() {
    const currentTheme = document.documentElement.getAttribute('data-theme') || 'light';
    const newTheme = currentTheme === 'dark' ? 'light' : 'dark';
    
    // Apply theme with smooth transition
    document.documentElement.setAttribute('data-theme', newTheme);
    
    // Save preference
    localStorage.setItem('theme', newTheme);
    
    // Update icon
    updateDarkModeIcon(newTheme);
    
    // Update chart colors if chart exists
    updateChartColors(newTheme);
}

// Update dark mode toggle icon
function updateDarkModeIcon(theme) {
    const desktopIcons = document.querySelectorAll('.dark-mode-toggle .material-icons');
    const mobileIcons = document.querySelectorAll('.mobile-dark-mode-toggle .material-icons');
    
    const icon = theme === 'dark' ? 'light_mode' : 'dark_mode';
    
    desktopIcons.forEach(el => el.textContent = icon);
    mobileIcons.forEach(el => el.textContent = icon);
}

// Update chart colors for dark mode
function updateChartColors(theme) {
    if (typeof Chart === 'undefined' || !window.salesChart) {
        return;
    }
    
    const isDark = theme === 'dark';
    
    // Update chart options
    if (window.salesChart) {
        window.salesChart.options.scales.x.grid.color = isDark ? '#1F2937' : '#e5e7eb';
        window.salesChart.options.scales.y.grid.color = isDark ? '#1F2937' : '#e5e7eb';
        window.salesChart.options.scales.x.ticks.color = isDark ? '#9CA3AF' : '#64748b';
        window.salesChart.options.scales.y.ticks.color = isDark ? '#9CA3AF' : '#64748b';
        
        // Update dataset colors
        window.salesChart.data.datasets[0].borderColor = isDark ? '#3B82F6' : '#2845D6';
        window.salesChart.data.datasets[0].backgroundColor = isDark 
            ? 'rgba(59, 130, 246, 0.1)' 
            : 'rgba(40, 69, 214, 0.1)';
        
        // Update tooltip
        window.salesChart.options.plugins.tooltip.backgroundColor = isDark ? '#111827' : '#ffffff';
        window.salesChart.options.plugins.tooltip.titleColor = isDark ? '#E5E7EB' : '#1e293b';
        window.salesChart.options.plugins.tooltip.bodyColor = isDark ? '#9CA3AF' : '#64748b';
        window.salesChart.options.plugins.tooltip.borderColor = isDark ? '#1F2937' : '#e2e8f0';
        
        window.salesChart.update();
    }
}

// Listen for system theme changes
window.matchMedia('(prefers-color-scheme: dark)').addEventListener('change', (e) => {
    // Only auto-switch if user hasn't set a preference
    if (!localStorage.getItem('theme')) {
        const newTheme = e.matches ? 'dark' : 'light';
        document.documentElement.setAttribute('data-theme', newTheme);
        updateDarkModeIcon(newTheme);
        updateChartColors(newTheme);
    }
});

// Initialize on DOM load
if (document.readyState === 'loading') {
    document.addEventListener('DOMContentLoaded', initializeDarkMode);
} else {
    initializeDarkMode();
}

// ─── Nav Group (collapsible sidebar submenu) ──────────────────────────────────

function toggleNavGroup(id) {
    const group = document.getElementById(id);
    if (!group) return;
    const isOpen = group.classList.toggle('open');
    // Only save when explicitly closed; open is the default
    if (!isOpen) {
        localStorage.setItem('navGroup_' + id, 'closed');
    } else {
        localStorage.removeItem('navGroup_' + id);
    }
}

// Apply saved closed state (groups default to open; only close if user closed them)
document.addEventListener('DOMContentLoaded', () => {
    document.querySelectorAll('.nav-group').forEach(group => {
        // Never collapse a group that has an active child
        if (group.querySelector('.nav-sub-item.active')) return;
        if (localStorage.getItem('navGroup_' + group.id) === 'closed') {
            group.classList.remove('open');
        }
    });
});
