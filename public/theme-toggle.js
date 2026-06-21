(function () {
    const root = document.documentElement;
    const mediaQuery = window.matchMedia ? window.matchMedia('(prefers-color-scheme: dark)') : null;

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
        return ['dark', 'light', 'system'].includes(stored) ? stored : 'light';
    }

    function applyTheme(theme) {
        const resolvedTheme = theme === 'system' ? (mediaQuery?.matches ? 'dark' : 'light') : theme;
        root.classList.toggle('dark', resolvedTheme === 'dark');
    }

    function setTheme(theme) {
        const nextTheme = ['dark', 'light', 'system'].includes(theme) ? theme : 'system';
        storeTheme(nextTheme);
        applyTheme(nextTheme);
        window.dispatchEvent(new CustomEvent('themechange', { detail: { theme: nextTheme } }));
        return nextTheme;
    }

    window.blogTheme = {
        get: getActiveTheme,
        set: setTheme,
        apply: applyTheme
    };

    function setupThemeToggle() {
        const button = document.getElementById('theme-toggle');
        if (!button) return;

        button.onclick = () => {
            const isDark = root.classList.contains('dark');
            setTheme(isDark ? 'light' : 'dark');
        };
    }

    applyTheme(getActiveTheme());
    mediaQuery?.addEventListener('change', () => {
        if (getActiveTheme() === 'system') applyTheme('system');
    });
    document.addEventListener('astro:page-load', setupThemeToggle);
    document.addEventListener('astro:after-swap', () => {
        applyTheme(getActiveTheme());
        setupThemeToggle();
    });
})();
