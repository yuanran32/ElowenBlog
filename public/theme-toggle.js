(function () {
    const root = document.documentElement;

    function warn(message, error) {
        console.warn(`[theme-toggle] ${message}`, error || '');
    }

    function getStoredTheme() {
        try {
            return localStorage.getItem('theme');
        } catch (error) {
            warn('无法读取 localStorage.theme', error);
            return null;
        }
    }

    function storeTheme(theme) {
        try {
            localStorage.setItem('theme', theme);
        } catch (error) {
            warn('无法写入 localStorage.theme', error);
        }
    }

    function getActiveTheme() {
        const stored = getStoredTheme();
        return stored || 'light';
    }

    function applyTheme(theme) {
        root.classList.toggle('dark', theme === 'dark');
    }

    function setupThemeToggle() {
        const button = document.getElementById('theme-toggle');
        if (!button) return;

        button.onclick = () => {
            const isDark = root.classList.toggle('dark');
            storeTheme(isDark ? 'dark' : 'light');
        };
    }

    applyTheme(getActiveTheme());
    document.addEventListener('astro:page-load', setupThemeToggle);
    document.addEventListener('astro:after-swap', () => {
        applyTheme(getActiveTheme());
        setupThemeToggle();
    });
})();
