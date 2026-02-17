// Notification system for all pages
function toggleNotificationDropdown() {
    const dropdown = document.getElementById('notificationDropdown');
    if (dropdown) {
        dropdown.classList.toggle('show');
    }
}

function markAllAsRead() {
    const notificationList = document.getElementById('notificationList');
    if (notificationList) {
        const items = notificationList.querySelectorAll('.notification-item.unread');
        items.forEach(item => item.classList.remove('unread'));
        updateNotificationBadge();
    }
}

function updateNotificationBadge() {
    const unreadCount = document.querySelectorAll('.notification-item.unread').length;
    const desktopBadge = document.getElementById('notificationBadge');
    const mobileBadge = document.getElementById('mobileNotificationBadge');
    
    if (desktopBadge) {
        if (unreadCount > 0) {
            desktopBadge.textContent = unreadCount;
            desktopBadge.style.display = 'block';
        } else {
            desktopBadge.style.display = 'none';
        }
    }
    
    if (mobileBadge) {
        if (unreadCount > 0) {
            mobileBadge.textContent = unreadCount;
            mobileBadge.style.display = 'block';
        } else {
            mobileBadge.style.display = 'none';
        }
    }
}

// Setup notification listeners
function setupNotificationListeners() {
    const notificationBtn = document.getElementById('notificationBtn');
    const mobileNotificationBtn = document.getElementById('mobileNotificationBtn');
    const notificationDropdown = document.getElementById('notificationDropdown');
    
    // Desktop notification button
    if (notificationBtn) {
        notificationBtn.addEventListener('click', (e) => {
            e.stopPropagation();
            toggleNotificationDropdown();
        });
    }
    
    // Mobile notification button
    if (mobileNotificationBtn) {
        mobileNotificationBtn.addEventListener('click', (e) => {
            e.stopPropagation();
            toggleNotificationDropdown();
        });
    }
    
    // Close dropdown when clicking outside
    document.addEventListener('click', (e) => {
        const isNotificationBtn = notificationBtn && notificationBtn.contains(e.target);
        const isMobileNotificationBtn = mobileNotificationBtn && mobileNotificationBtn.contains(e.target);
        const isDropdown = notificationDropdown && notificationDropdown.contains(e.target);
        
        if (!isNotificationBtn && !isMobileNotificationBtn && !isDropdown) {
            if (notificationDropdown) {
                notificationDropdown.classList.remove('show');
            }
        }
    });
    
    // Sync badges between mobile and desktop
    const desktopBadge = document.getElementById('notificationBadge');
    const mobileBadge = document.getElementById('mobileNotificationBadge');
    if (desktopBadge && mobileBadge) {
        const observer = new MutationObserver(() => {
            mobileBadge.textContent = desktopBadge.textContent;
            mobileBadge.style.display = desktopBadge.style.display;
        });
        observer.observe(desktopBadge, { childList: true, attributes: true, attributeFilter: ['style'] });
    }
}

// Initialize on DOM load
if (document.readyState === 'loading') {
    document.addEventListener('DOMContentLoaded', setupNotificationListeners);
} else {
    setupNotificationListeners();
}
