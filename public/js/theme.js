(function() {
    const storageKey = 'medilife-theme';
    const savedTheme = localStorage.getItem(storageKey) || 'light';

    function applyTheme(theme) {
        document.documentElement.setAttribute('data-theme', theme);
        localStorage.setItem(storageKey, theme);
        document.querySelectorAll('[data-theme-toggle]').forEach((button) => {
            const icon = button.querySelector('i');
            if (icon) {
                icon.className = theme === 'dark' ? 'fa-solid fa-sun' : 'fa-solid fa-moon';
            }
            button.setAttribute('aria-label', theme === 'dark' ? 'Switch to light mode' : 'Switch to dark mode');
        });
    }

    applyTheme(savedTheme);

    document.addEventListener('DOMContentLoaded', function() {
        applyTheme(localStorage.getItem(storageKey) || 'light');
        document.querySelectorAll('[data-theme-toggle]').forEach((button) => {
            button.addEventListener('click', function() {
                const nextTheme = document.documentElement.getAttribute('data-theme') === 'dark' ? 'light' : 'dark';
                applyTheme(nextTheme);
            });
        });
    });
})();
