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
            themes: {
                light: 'github-light',
                dark: 'github-dark'
            },
            defaultColor: false,
            transformers: [
                {
                    pre(node) {
                        const lang = this.options.lang;
                        if (lang && lang !== 'text' && lang !== 'plaintext' && lang !== '') {
                            node.properties['data-lang'] = lang;
                        }
                    }
                }
            ]
        }
    },
    vite: {
        plugins: [tailwindcss()]
    },
    integrations: [mdx(), sitemap()]
});
