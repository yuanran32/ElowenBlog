---
title: 从零搭建个人博客：技术选型与踩坑记录
excerpt: 记录使用 Astro 5 + Tailwind CSS v4 搭建个人博客的完整过程，包括技术选型思路、开发体验和部署踩坑。
publishDate: '2026-05-30'
isFeatured: true
cover: ../../assets/images/blog/hello-blog.png
series: 博客建设
tags:
  - 前端
  - Astro
  - 工程化
seo:
  title: 从零搭建个人博客：Astro 5 + Tailwind CSS v4 实践
  description: 使用 Astro 5 和 Tailwind CSS v4 搭建个人博客的技术选型、开发体验和 GitHub Pages 部署踩坑记录。
  image:
    src: ../../assets/images/blog/hello-blog.png
    alt: 从零搭建个人博客文章封面
  pageType: article
---

一直想有一个自己的技术博客，用来沉淀学习过程中的思考和实践。经过一番调研和折腾，最终选择了 Astro 作为框架，这篇文章记录整个搭建过程中的决策和踩坑经历。

## 为什么选择 Astro

在选型阶段对比了几个方案：

- **VuePress / VitePress**：文档站点体验很好，但博客场景下自定义布局的灵活度有限
- **Next.js / Nuxt**：功能强大但对于纯静态博客来说过于重量级，打包产物也偏大
- **Hexo / Hugo**：成熟的博客方案，但模板语法学习成本高，想用现代组件化的方式写页面

Astro 的几个特点打动了我：

1. **内容优先**：原生支持 Markdown/MDX，content collections 提供类型安全的内容管理
2. **零 JS 默认**：静态页面不发送 JavaScript，性能天然优秀
3. **框架无关**：虽然我目前只用 Astro 组件，但未来可以按需引入 React/Vue
4. **Islands 架构**：需要交互的部分按需 hydrate，不会拖累整站性能

## Tailwind CSS v4 的体验

这个项目直接用了 Tailwind CSS v4，通过 `@tailwindcss/vite` 插件集成。相比 v3 的变化：

- 不再需要 `tailwind.config.js`，配置直接写在 CSS 文件中用 `@theme` 声明
- CSS 变量原生支持，主题切换变得更自然
- 构建速度明显提升

配合 `@tailwindcss/typography` 插件处理 Markdown 渲染的排版，通过 CSS 变量实现了亮色/暗色主题下的统一样式控制。

## 内容管理方案

使用 Astro 的 Content Collections 管理所有内容：

```typescript
const blog = defineCollection({
  loader: glob({ pattern: '**/*.{md,mdx}', base: './src/content/blog' }),
  schema: z.object({
    title: z.string(),
    publishDate: z.coerce.date(),
    tags: z.array(z.string()).default([]),
    series: z.string().optional(),
    // ...
  })
})
```

这套方案的好处是 frontmatter 有 Zod schema 校验，写错字段名或类型会在构建时报错，比运行时才发现问题要好得多。

## GitHub Pages 部署踩坑

部署到 GitHub Pages 的项目页（`username.github.io/repo`）时，最大的坑是 **base path**。

所有内部链接和静态资源都需要加上 `/myBlog` 前缀，否则在生产环境会 404。解决方案是封装一个 `withBase()` 工具函数：

```typescript
export function withBase(path: string): string {
  const base = import.meta.env.BASE_URL
  if (path.startsWith('http') || path.startsWith(base)) return path
  return base + path.replace(/^\//, '')
}
```

所有内部链接统一通过这个函数处理，避免遗漏。

另一个坑是 Astro 的 `site` 和 `base` 配置需要配合使用：`site` 是完整域名，`base` 是路径前缀，RSS、sitemap 等插件会自动拼接这两个值生成正确的 URL。

## 其他值得一提的细节

- **阅读时间估算**：中文按 350 字/分钟、英文按 200 词/分钟计算，比固定值更准确
- **View Transitions**：使用 Astro 内置的 ClientRouter 实现页面切换动画，体验接近 SPA
- **代码复制按钮**：监听 `astro:page-load` 事件，在每个代码块右上角注入复制按钮
- **主题持久化**：localStorage 存储用户偏好，同时监听系统主题变化作为 fallback

## 总结

整个搭建过程大约花了一周时间，从选型到部署上线。Astro 5 的开发体验确实很流畅，Content Collections 的类型安全让内容管理变得可靠，Tailwind v4 的 CSS-first 配置方式也比之前更直观。

后续计划持续完善博客功能，同时把日常学习中的技术思考沉淀成文章。如果你也在考虑搭建个人博客，希望这篇记录能提供一些参考。
