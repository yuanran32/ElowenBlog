---
title: 个人博客
description: 基于 Astro 5 + Tailwind CSS v4 搭建的个人技术博客，支持内容集合、主题切换、RSS 订阅和 SEO 优化。
publishDate: '2026-05-30'
isFeatured: true
techStack:
  - Astro 5
  - Tailwind CSS v4
  - TypeScript
  - Markdown / MDX
demoUrl: 'https://elowen-blog.vercel.app/'
githubUrl: 'https://github.com/yuanran32/myBlog'
role: 独立开发
highlights:
  - 基于 Content Collections 的类型安全内容管理
  - Tailwind CSS v4 + CSS 变量实现亮色/暗色主题切换
  - 适配 Vercel 根路径部署方案
  - View Transitions 页面切换动画
  - 自动生成 RSS、Sitemap 和结构化数据
seo:
  title: 个人博客项目
  description: 基于 Astro 5 和 Tailwind CSS v4 的个人技术博客，支持内容集合、主题切换和 SEO 优化。
---

## 项目简介

一个面向前端工程师的个人技术博客，用于记录技术学习、项目实践和工程化思考。设计上追求简洁、可读性强，技术上注重性能和可维护性。

## 技术实现

**内容管理**：使用 Astro Content Collections 管理博客文章、项目和静态页面，Zod schema 校验 frontmatter，构建时即可发现内容错误。

**样式方案**：Tailwind CSS v4 通过 Vite 插件集成，主题 token 用 CSS 变量定义，支持亮色/暗色模式切换并持久化到 localStorage。Typography 插件处理 Markdown 排版。

**路由设计**：文件系统路由 + 动态分页，支持按标签和系列筛选文章。

**部署方案**：Vercel 静态站点部署，保留 `withBase()` 工具函数统一处理路径，避免不同部署环境下的资源路径问题。

**SEO**：每个页面生成 canonical URL、Open Graph / Twitter Card 元标签和 JSON-LD 结构化数据。

## 开发亮点

- 零 JS 默认输出，仅在需要交互的地方（主题切换、代码复制、菜单）加载脚本
- 中英文混合内容的阅读时间估算（中文 350 字/分钟，英文 200 词/分钟）
- 构建时内容健康检查：检测空标题、未来日期、缺失描述、重复 slug
- 代码块一键复制 + 文章链接分享功能
