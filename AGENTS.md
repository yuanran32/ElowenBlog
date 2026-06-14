# AGENTS.md

This file provides guidance to Codex (Codex.ai/code) when working with code in this repository.

## Commands

- `pnpm install` - install dependencies.
- `pnpm dev` or `pnpm start` - run the Astro development server.
- `pnpm build` - build the static site and run Astro's type/content checks.
- `pnpm preview` - preview the production build locally.
- `pnpm astro check` - run Astro diagnostics/type checking without building.
- `pnpm prettier --check .` - check formatting.
- `pnpm prettier --write .` - format the repository.

There is currently no test runner configured in `package.json`; use `pnpm build` and targeted manual browser checks for validation.

## Architecture

This is an Astro 5 static personal blog hosted under the `/myBlog` base path. The canonical site URL, navigation, hero copy, pagination sizes, social links, and default SEO image live in `src/data/site-config.ts`; `astro.config.mjs` imports this config for `site` and sets `base: '/myBlog'`.

Content is managed with Astro content collections in `src/content.config.ts`:

- `blog` reads `src/content/blog/**/*.{md,mdx}` with frontmatter for dates, draft status, featured posts, tags, series, and optional SEO overrides.
- `pages` reads `src/content/pages/**/*.{md,mdx}` for static pages such as about/contact/terms/resume.
- `projects` reads `src/content/projects/**/*.{md,mdx}` for portfolio entries with tech stack, role, links, and highlights.

Routing is file-based under `src/pages`:

- `index.astro` builds the home page from featured blog posts/projects and `siteConfig.hero`.
- `blog/[...page].astro` and `projects/[...page].astro` are paginated archive routes.
- `blog/[id].astro` and `projects/[id].astro` render individual collection entries and previous/next navigation.
- `tags/[id]/[...page].astro` and `series/[id]/[...page].astro` derive their static paths from blog frontmatter via helpers in `src/utils/data-utils.ts`.
- `[...id].astro` renders generic content pages, except `page.id === 'resume'`, which uses `src/components/ResumePage.astro` instead of the Markdown body.
- `rss.xml.js` generates RSS from published blog posts.

`src/layouts/BaseLayout.astro` wraps all pages with `BaseHead`, `Nav`, optional `Header`, the page slot, and `Footer`. It also loads global theme and copy scripts from `public/` through `withBase()`. Use `withBase()` from `src/utils/common-utils.ts` for internal URLs/assets that must work with the `/myBlog` base path.

`src/components/BaseHead.astro` centralizes metadata, canonical URLs, Open Graph/Twitter tags, font preloads, RSS/sitemap links, and JSON-LD serialization. Page components pass SEO overrides through `BaseLayout`; default metadata comes from `siteConfig`.

Draft blog posts are included during local development and filtered out only in production by `filterPublishedPosts()` in `src/utils/data-utils.ts`. Blog and project ordering is consistently newest-first using `sortItemsByDateDesc()`.

Styling uses Tailwind CSS v4 via `@tailwindcss/vite`, with global styles and theme tokens in `src/styles/global.css`. Components are mostly Astro components with utility classes and Chinese UI copy.
