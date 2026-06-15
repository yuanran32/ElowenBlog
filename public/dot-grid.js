(function () {
    const SPACING = 32;
    const BASE_SIZE = 2;
    const REPEL_RADIUS = 130;
    const REPEL_FORCE = 26;
    const LERP = 0.18;
    const DRIFT_SPEED = 0.22;
    const BREATH_FREQ = 0.0014;
    const BREATH_SIZE_AMP = 0.35;
    const BREATH_ALPHA_LO = 0.65;
    const BREATH_ALPHA_HI = 1;
    const MORPH_THRESHOLD = 0.55;
    const GLYPH_FONT = '600 13px "SF Mono", "Cascadia Mono", "JetBrains Mono", Consolas, monospace';

    const root = document.documentElement;
    const reduceMotion = window.matchMedia && window.matchMedia('(prefers-reduced-motion: reduce)').matches;

    let canvas;
    let ctx;
    let cells = [];
    let trackLength = 0;
    let dpr = 1;
    let viewW = 0;
    let viewH = 0;
    let mx = -9999;
    let my = -9999;
    let lastMoveTs = 0;
    let lastScrollTs = 0;
    let lastFrameTs = 0;
    let raf = null;
    let cleanup = null;

    function token(name) {
        return getComputedStyle(root).getPropertyValue(name).trim();
    }

    function parseRGBA(value) {
        // Hex with alpha: #rrggbbaa or #rgba
        var hexMatch = value.match(/^#([0-9a-fA-F]{3,8})$/);
        if (hexMatch) {
            var h = hexMatch[1];
            var r, g, b, a = 1;
            if (h.length === 3) {
                r = parseInt(h[0] + h[0], 16);
                g = parseInt(h[1] + h[1], 16);
                b = parseInt(h[2] + h[2], 16);
            } else if (h.length === 4) {
                r = parseInt(h[0] + h[0], 16);
                g = parseInt(h[1] + h[1], 16);
                b = parseInt(h[2] + h[2], 16);
                a = parseInt(h[3] + h[3], 16) / 255;
            } else if (h.length === 6) {
                r = parseInt(h.substring(0, 2), 16);
                g = parseInt(h.substring(2, 4), 16);
                b = parseInt(h.substring(4, 6), 16);
            } else {
                r = parseInt(h.substring(0, 2), 16);
                g = parseInt(h.substring(2, 4), 16);
                b = parseInt(h.substring(4, 6), 16);
                a = parseInt(h.substring(6, 8), 16) / 255;
            }
            return [r, g, b, a];
        }

        // Modern rgb() / rgba() with alpha as percentage
        var modMatch = value.match(/rgba?\(\s*(\d+)\s+(\d+)\s+(\d+)\s*\/\s*([\d.]+)\)/);
        if (modMatch) {
            var pct = parseFloat(modMatch[4]);
            return [parseInt(modMatch[1], 10), parseInt(modMatch[2], 10), parseInt(modMatch[3], 10), pct > 1 ? pct / 100 : pct];
        }

        // Legacy rgba(r, g, b, a) or rgb(r, g, b)
        var match = value.match(/rgba?\(\s*(\d+)\s*,\s*(\d+)\s*,\s*(\d+)(?:\s*,\s*([\d.]+))?\s*\)/);
        if (!match) return [0, 0, 0, 1];
        return [parseInt(match[1], 10), parseInt(match[2], 10), parseInt(match[3], 10), match[4] ? parseFloat(match[4]) : 1];
    }

    function mixRGB(a, b, t) {
        return [Math.round(a[0] + (b[0] - a[0]) * t), Math.round(a[1] + (b[1] - a[1]) * t), Math.round(a[2] + (b[2] - a[2]) * t), a[3] + (b[3] - a[3]) * t];
    }

    function withAlpha(rgb, multiplier) {
        return `rgba(${rgb[0]}, ${rgb[1]}, ${rgb[2]}, ${(rgb[3] * multiplier).toFixed(3)})`;
    }

    function resize() {
        viewW = window.innerWidth;
        viewH = window.innerHeight;
        dpr = Math.max(1, window.devicePixelRatio || 1);

        canvas.width = Math.floor(viewW * dpr);
        canvas.height = Math.floor(viewH * dpr);
        canvas.style.width = viewW + 'px';
        canvas.style.height = viewH + 'px';
        ctx.setTransform(dpr, 0, 0, dpr, 0, 0);

        const nRows = Math.ceil((viewH + 2 * SPACING) / SPACING);
        trackLength = nRows * SPACING;
        cells = [];

        for (let row = 0; row < nRows; row++) {
            const y = -SPACING + row * SPACING;
            for (let x = SPACING / 2; x < viewW; x += SPACING) {
                cells.push({
                    x,
                    y,
                    dispX: 0,
                    dispY: 0,
                    glyph: Math.random() < 0.5 ? '+' : '−',
                    bp: Math.random() * Math.PI * 2
                });
            }
        }
    }

    function paintStatic() {
        const baseColor = parseRGBA(token('--dot-color') || 'rgba(0, 0, 0, 0.16)');
        ctx.clearRect(0, 0, viewW, viewH);
        ctx.fillStyle = withAlpha(baseColor, 1);

        for (const cell of cells) {
            ctx.beginPath();
            ctx.arc(cell.x, cell.y, BASE_SIZE, 0, Math.PI * 2);
            ctx.fill();
        }
    }

    function frame() {
        const now = performance.now();
        const dt = Math.min(48, now - lastFrameTs || 16.667);
        const dtScale = dt / 16.667;
        lastFrameTs = now;

        const baseColor = parseRGBA(token('--dot-color') || 'rgba(0, 0, 0, 0.16)');
        const hotColor = parseRGBA(token('--dot-color-hot') || 'rgba(196, 149, 106, 0.9)');

        ctx.clearRect(0, 0, viewW, viewH);
        ctx.font = GLYPH_FONT;
        ctx.textAlign = 'center';
        ctx.textBaseline = 'middle';

        for (const cell of cells) {
            cell.y += DRIFT_SPEED * dtScale;
            if (cell.y > trackLength - SPACING) {
                cell.y -= trackLength;
            }

            let hot = 0;
            let displaceX = 0;
            let displaceY = 0;
            const dx = mx - cell.x;
            const dy = my - cell.y;
            const dist2 = dx * dx + dy * dy;

            if (dist2 < REPEL_RADIUS * REPEL_RADIUS) {
                const dist = Math.sqrt(dist2) || 0.0001;
                const factor = 1 - dist / REPEL_RADIUS;
                hot = factor * factor;
                displaceX = -(dx / dist) * hot * REPEL_FORCE;
                displaceY = -(dy / dist) * hot * REPEL_FORCE;
            }

            cell.dispX += (displaceX - cell.dispX) * LERP;
            cell.dispY += (displaceY - cell.dispY) * LERP;

            const x = cell.x + cell.dispX;
            const y = cell.y + cell.dispY;
            const breath = (Math.sin(now * BREATH_FREQ + cell.bp) + 1) * 0.5;
            const size = BASE_SIZE + (breath - 0.5) * 2 * BREATH_SIZE_AMP;
            const breathAlpha = BREATH_ALPHA_LO + breath * (BREATH_ALPHA_HI - BREATH_ALPHA_LO);
            const morph = Math.max(0, Math.min(1, hot / MORPH_THRESHOLD));
            const color = morph > 0.02 ? mixRGB(baseColor, hotColor, hot) : baseColor;

            const circleAlpha = (1 - morph) * breathAlpha;
            if (circleAlpha > 0.02) {
                ctx.fillStyle = withAlpha(color, circleAlpha);
                ctx.beginPath();
                ctx.arc(x, y, size, 0, Math.PI * 2);
                ctx.fill();
            }

            if (morph > 0.05) {
                ctx.fillStyle = withAlpha(color, morph);
                ctx.fillText(cell.glyph, x, y);
            }
        }

        const idle = now - lastMoveTs > 1200 && now - lastScrollTs > 1200 && mx < 0;
        if (idle) {
            setTimeout(() => {
                raf = requestAnimationFrame(frame);
            }, 16);
            return;
        }

        raf = requestAnimationFrame(frame);
    }

    function setup() {
        canvas = document.getElementById('dot-grid');
        if (!canvas) return;
        if (cleanup) cleanup();

        ctx = canvas.getContext('2d');
        if (!ctx) return;

        mx = -9999;
        my = -9999;
        lastMoveTs = 0;
        lastScrollTs = 0;
        lastFrameTs = performance.now();

        resize();

        const onResize = () => {
            resize();
            if (reduceMotion) paintStatic();
        };
        const onMove = (event) => {
            mx = event.clientX;
            my = event.clientY;
            lastMoveTs = performance.now();
        };
        const onLeave = () => {
            mx = -9999;
            my = -9999;
        };
        const onScroll = () => {
            lastScrollTs = performance.now();
        };
        const themeObserver = new MutationObserver(() => {
            if (reduceMotion) paintStatic();
        });

        window.addEventListener('resize', onResize);
        document.addEventListener('mousemove', onMove, { passive: true });
        document.addEventListener('mouseleave', onLeave);
        document.addEventListener('scroll', onScroll, { passive: true });
        themeObserver.observe(root, { attributes: true, attributeFilter: ['class'] });

        if (reduceMotion) {
            paintStatic();
        } else {
            raf = requestAnimationFrame(frame);
        }

        cleanup = () => {
            if (raf) cancelAnimationFrame(raf);
            raf = null;
            window.removeEventListener('resize', onResize);
            document.removeEventListener('mousemove', onMove);
            document.removeEventListener('mouseleave', onLeave);
            document.removeEventListener('scroll', onScroll);
            themeObserver.disconnect();
        };
    }

    document.addEventListener('astro:page-load', setup);
    document.addEventListener('astro:after-swap', setup);
})();
