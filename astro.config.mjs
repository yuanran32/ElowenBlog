import mdx from '@astrojs/mdx';
import sitemap from '@astrojs/sitemap';
import tailwindcss from '@tailwindcss/vite';
import { defineConfig } from 'astro/config';
import siteConfig from './src/data/site-config';

// https://astro.build/config
export default defineConfig({
    site: siteConfig.website,
    markdown: {
        shikiConfig: {
            // 双主题模式：只输出 --shiki-light/--shiki-dark CSS 变量（defaultColor: false），
            // 由 global.css 按 html.dark 切换，背景色交给站点的 bg-muted。
            themes: {
                light: 'github-light',
                dark: 'github-dark'
            },
            defaultColor: false
        }
    },
    vite: {
        plugins: [tailwindcss()]
    },
    integrations: [mdx(), sitemap()]
});
