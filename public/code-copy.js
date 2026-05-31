(function () {
    function warn(message, error) {
        console.warn(`[code-copy] ${message}`, error || '');
    }

    async function writeClipboard(text) {
        if (!navigator.clipboard?.writeText) {
            throw new Error('当前浏览器不支持 navigator.clipboard.writeText');
        }
        await navigator.clipboard.writeText(text);
    }

    function resetLabel(button, label, delay = 1800) {
        window.setTimeout(() => {
            button.textContent = label;
        }, delay);
    }

    function setupCodeCopy() {
        document.querySelectorAll('.prose pre').forEach((pre) => {
            if (pre.dataset.copyReady === 'true') return;

            const code = pre.querySelector('code');
            if (!code) return;

            pre.dataset.copyReady = 'true';
            pre.classList.add('code-block');

            const button = document.createElement('button');
            button.type = 'button';
            button.className = 'code-copy-button';
            button.textContent = '复制';
            button.setAttribute('aria-label', '复制代码');

            button.addEventListener('click', async () => {
                try {
                    await writeClipboard(code.innerText);
                    button.textContent = '已复制';
                } catch (error) {
                    warn('复制代码失败', error);
                    button.textContent = '复制失败';
                }

                resetLabel(button, '复制');
            });

            pre.appendChild(button);
        });
    }

    function setupUrlCopy() {
        document.querySelectorAll('.copy-url-button').forEach((button) => {
            if (button.dataset.copyReady === 'true') return;
            button.dataset.copyReady = 'true';

            button.addEventListener('click', async () => {
                const url = button.getAttribute('data-url') || window.location.href;
                const label = button.textContent || '分享';
                const successLabel = button.getAttribute('data-tooltip-success') || '已复制';

                try {
                    await writeClipboard(url);
                    button.textContent = successLabel;
                } catch (error) {
                    warn('复制链接失败', error);
                    button.textContent = '复制失败';
                }

                resetLabel(button, label, 2500);
            });
        });
    }

    function setupCopyButtons() {
        setupCodeCopy();
        setupUrlCopy();
    }

    document.addEventListener('astro:page-load', setupCopyButtons);
    document.addEventListener('astro:after-swap', setupCopyButtons);
})();
