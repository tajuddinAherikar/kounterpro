// KounterPro Configuration
const APP_CONFIG = {
    version: '2.2.0',
    name: 'KounterPro',
    year: '2026'
};

// Function to display app version and copyright
function displayAppInfo() {
    const versionElements = document.querySelectorAll('.app-version');
    versionElements.forEach(element => {
        element.textContent = `Version ${APP_CONFIG.version} | © ${APP_CONFIG.year} ${APP_CONFIG.name}`;
    });
}

// Auto-initialize on page load
if (document.readyState === 'loading') {
    document.addEventListener('DOMContentLoaded', displayAppInfo);
} else {
    displayAppInfo();
}
