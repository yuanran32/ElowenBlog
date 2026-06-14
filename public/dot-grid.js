(function () {
    // 交互式点阵背景：底层是淡色点阵，鼠标靠近时附近的点会放大并变成棕色的 + / −。
    const SPACING = 30; // 网格间距（px）
    const RADIUS = 140; // 鼠标影响半径（px）
    const root = document.documentElement;

    const PALETTES = {
        light: { dot: [176, 170, 160], accent: [150, 110, 80], dotA: 0.55, accentA: 0.95 },
        dark: { dot: [120, 128, 112], accent: [201, 170, 130], dotA: 0.5, accentA: 0.95 },
    };

    let canvas, ctx, raf;
    let dpr = 1;
    let cols = 0,
        rows = 0;
    // 目标鼠标位置 / 平滑跟随位置
    let targetX = -9999,
        targetY = -9999;
    let mx = -9999,
        my = -9999;
    let cleanup = null;
    const reduceMotion = window.matchMedia && window.matchMedia('(prefers-reduced-motion: reduce)').matches;

    // 基于坐标的确定性哈希 → 每个格点固定是 +、− 还是普通点
    function kindAt(i, j) {
        let h = (i * 73856093) ^ (j * 19349663);
        h = (h >>> 0) % 10;
        if (h < 3) return 'plus';
        if (h < 5) return 'minus';
        return 'dot';
    }

    function smoothstep(t) {
        t = Math.max(0, Math.min(1, t));
        return t * t * (3 - 2 * t);
    }

    function rgba(c, a) {
        return `rgba(${c[0]}, ${c[1]}, ${c[2]}, ${a})`;
    }

    function mix(a, b, t) {
        return [
            Math.round(a[0] + (b[0] - a[0]) * t),
            Math.round(a[1] + (b[1] - a[1]) * t),
            Math.round(a[2] + (b[2] - a[2]) * t),
        ];
    }

    function resize() {
        dpr = Math.min(window.devicePixelRatio || 1, 2);
        const w = window.innerWidth;
        const h = window.innerHeight;
        canvas.width = Math.floor(w * dpr);
        canvas.height = Math.floor(h * dpr);
        canvas.style.width = w + 'px';
        canvas.style.height = h + 'px';
        ctx.setTransform(dpr, 0, 0, dpr, 0, 0);
        cols = Math.ceil(w / SPACING) + 1;
        rows = Math.ceil(h / SPACING) + 1;
    }

    function drawGlyph(x, y, type, s, color, alpha) {
        const half = s / 2;
        if (type === 'dot') {
            ctx.beginPath();
            ctx.fillStyle = rgba(color, alpha);
            ctx.arc(x, y, half, 0, Math.PI * 2);
            ctx.fill();
            return;
        }
        ctx.strokeStyle = rgba(color, alpha);
        ctx.lineWidth = Math.max(1, s * 0.16);
        ctx.lineCap = 'round';
        ctx.beginPath();
        ctx.moveTo(x - half, y);
        ctx.lineTo(x + half, y);
        if (type === 'plus') {
            ctx.moveTo(x, y - half);
            ctx.lineTo(x, y + half);
        }
        ctx.stroke();
    }

    function render() {
        const pal = PALETTES[root.classList.contains('dark') ? 'dark' : 'light'];
        const w = window.innerWidth;
        const h = window.innerHeight;
        ctx.clearRect(0, 0, w, h);

        const offX = (w - (cols - 1) * SPACING) / 2;
        const offY = SPACING / 2;

        for (let i = 0; i < cols; i++) {
            for (let j = 0; j < rows; j++) {
                const x = offX + i * SPACING;
                const y = offY + j * SPACING;
                const dx = x - mx;
                const dy = y - my;
                const dist = Math.sqrt(dx * dx + dy * dy);
                const inf = smoothstep(1 - dist / RADIUS); // 0~1 影响力

                if (inf <= 0.001) {
                    // 静止状态：淡色小圆点
                    drawGlyph(x, y, 'dot', 2.2, pal.dot, pal.dotA);
                    continue;
                }

                const kind = kindAt(i, j);
                const t = inf; // 颜色 / 尺寸过渡
                const color = mix(pal.dot, pal.accent, t);
                const alpha = pal.dotA + (pal.accentA - pal.dotA) * t;

                if (kind === 'dot') {
                    const s = 2.2 + 5 * t; // 点：直径放大
                    drawGlyph(x, y, 'dot', s, color, alpha);
                } else {
                    const s = 3 + 11 * t; // +/−：跨度放大
                    drawGlyph(x, y, kind, s, color, alpha);
                }
            }
        }
    }

    function loop() {
        // 鼠标位置平滑跟随，产生拖尾过渡
        mx += (targetX - mx) * 0.18;
        my += (targetY - my) * 0.18;
        render();
        const settled = Math.abs(targetX - mx) < 0.5 && Math.abs(targetY - my) < 0.5;
        if (settled) {
            mx = targetX;
            my = targetY;
            render();
            raf = null; // 收敛后停止动画，省电
            return;
        }
        raf = requestAnimationFrame(loop);
    }

    function kick() {
        if (raf == null) raf = requestAnimationFrame(loop);
    }

    function onMove(e) {
        targetX = e.clientX;
        targetY = e.clientY;
        kick();
    }

    function onLeave() {
        targetX = -9999;
        targetY = -9999;
        kick();
    }

    function setup() {
        canvas = document.getElementById('dot-grid');
        if (!canvas) return;
        // 避免 Astro 视图切换重复绑定
        if (cleanup) cleanup();

        ctx = canvas.getContext('2d');
        resize();
        render();

        if (reduceMotion) {
            // 尊重「减少动态效果」偏好：仅渲染静态点阵，不响应鼠标
            const onResizeStatic = () => {
                resize();
                render();
            };
            window.addEventListener('resize', onResizeStatic);
            cleanup = () => window.removeEventListener('resize', onResizeStatic);
            return;
        }

        const onResize = () => {
            resize();
            kick();
        };
        window.addEventListener('mousemove', onMove, { passive: true });
        window.addEventListener('mouseleave', onLeave);
        window.addEventListener('resize', onResize);
        cleanup = () => {
            if (raf) cancelAnimationFrame(raf);
            raf = null;
            window.removeEventListener('mousemove', onMove);
            window.removeEventListener('mouseleave', onLeave);
            window.removeEventListener('resize', onResize);
        };
    }

    document.addEventListener('astro:page-load', setup);
    document.addEventListener('astro:after-swap', setup);
})();
