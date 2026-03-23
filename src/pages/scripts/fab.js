// Floating Action Button (FAB) functionality

(function() {
    'use strict';

    let fabContainer;
    let fabButton;
    let fabMenu;
    let isOpen = false;

    // Initialize FAB
    function initFAB() {
        fabContainer = document.getElementById('fabContainer');
        fabButton = document.getElementById('fabButton');
        fabMenu = document.getElementById('fabMenu');

        if (!fabContainer || !fabButton || !fabMenu) {
            return;
        }

        // Toggle FAB menu on button click
        fabButton.addEventListener('click', toggleFAB);

        // Close FAB when clicking outside
        document.addEventListener('click', handleClickOutside);

        // Prevent menu clicks from closing the FAB
        fabMenu.addEventListener('click', (e) => {
            e.stopPropagation();
        });

        // Keyboard shortcuts
        document.addEventListener('keydown', handleKeyboardShortcuts);

        // Track action clicks for analytics
        const fabActions = document.querySelectorAll('.fab-action');
        fabActions.forEach(action => {
            action.addEventListener('click', (e) => {
                const actionType = action.dataset.action;
                console.log('FAB Action clicked:', actionType);
                closeFAB();
            });
        });
    }

    // Toggle FAB menu
    function toggleFAB(e) {
        e.stopPropagation();
        
        if (isOpen) {
            closeFAB();
        } else {
            openFAB();
        }
    }

    // Open FAB menu
    function openFAB() {
        fabContainer.classList.add('active');
        isOpen = true;
        
        // Animate menu items
        const actions = fabMenu.querySelectorAll('.fab-action');
        actions.forEach((action, index) => {
            action.style.animationDelay = `${(index + 1) * 0.05}s`;
        });
    }

    // Close FAB menu
    function closeFAB() {
        fabContainer.classList.remove('active');
        isOpen = false;
    }

    // Handle clicks outside FAB
    function handleClickOutside(e) {
        if (!fabContainer.contains(e.target) && isOpen) {
            closeFAB();
        }
    }

    // Keyboard shortcuts
    function handleKeyboardShortcuts(e) {
        // Escape key to close FAB
        if (e.key === 'Escape' && isOpen) {
            closeFAB();
            return;
        }

        // Ctrl/Cmd + Plus (+) to toggle FAB
        if ((e.ctrlKey || e.metaKey) && (e.key === '+' || e.key === '=')) {
            e.preventDefault();
            toggleFAB(e);
            return;
        }

        // Quick action shortcuts (when FAB is open)
        if (isOpen) {
            switch(e.key) {
                case '1':
                    e.preventDefault();
                    window.location.href = 'create-bill.html';
                    break;
                case '2':
                    e.preventDefault();
                    window.location.href = 'inventory.html';
                    break;
                case '3':
                    e.preventDefault();
                    window.location.href = 'expenses.html';
                    break;
            }
        }
    }

    // Hide FAB on scroll down, show on scroll up (optional enhancement)
    let lastScrollTop = 0;
    let scrollTimeout;

    function handleScroll() {
        if (!fabContainer) return;

        clearTimeout(scrollTimeout);
        
        scrollTimeout = setTimeout(() => {
            const scrollTop = window.pageYOffset || document.documentElement.scrollTop;
            
            if (scrollTop > lastScrollTop && scrollTop > 100) {
                // Scrolling down
                fabContainer.style.transform = 'translateY(100px)';
            } else {
                // Scrolling up
                fabContainer.style.transform = 'translateY(0)';
            }
            
            lastScrollTop = scrollTop <= 0 ? 0 : scrollTop;
        }, 100);
    }

    // Optional: Enable auto-hide on scroll
    // Uncomment the line below to enable
    // window.addEventListener('scroll', handleScroll);

    // Initialize on DOM ready
    if (document.readyState === 'loading') {
        document.addEventListener('DOMContentLoaded', initFAB);
    } else {
        initFAB();
    }

    // Export functions for external use
    window.FAB = {
        open: openFAB,
        close: closeFAB,
        toggle: toggleFAB
    };
})();
