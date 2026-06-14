---
title: 用 Vercel 部署 Astro 博客：一次告别 base path 的迁移
excerpt: GitHub Pages 的 /myBlog 子路径让我修了一路 404。这次我把博客迁到 Vercel，记录从连接仓库到自动部署的完整步骤，以及迁移时最容易忘改的那几处配置。
publishDate: '2026-06-14'
isFeatured: false
cover: ../../assets/images/blog/deploy-blog-to-vercel.png
series: 博客建设
tags:
  - 前端
  - Astro
  - 部署
  - Vercel
seo:
  title: 用 Vercel 部署 Astro 博客：从 GitHub Pages 迁移的实操记录
  description: 一步步把 Astro 静态博客从 GitHub Pages 迁到 Vercel 的完整指南，包括连接仓库、去掉 base path、固定 pnpm 版本、自动部署与 Preview 等实操细节。
  image:
    src: ../../assets/images/blog/deploy-blog-to-vercel.png
    alt: Vercel 部署 Astro 博客文章封面
  pageType: article
---

[上一篇](/blog/deploy-blog-to-github-pages/)我用 GitHub Actions 把博客自动部署到了 GitHub Pages，整套流程跑通之后确实省心了不少。但有个东西始终硌得慌——`/myBlog` 这个子路径。

因为是项目页部署，站点挂在 `username.github.io/myBlog` 下，于是所有内部链接和资源都得带上 base 前缀，漏一个就 404。我封装了 `withBase()` 兜底，也确实管用，但每次写新组件、引新资源，脑子里都得绷一根弦：这个路径过 `withBase()` 了吗？

写到后来我冒出一个念头：**有没有一种部署方式，根本不需要折腾子路径？**

有，而且很省事——把站点部署在根域名上就行。Vercel 就是干这个的。这篇就记录我怎么把博客迁到 Vercel，以及迁移时那几个最容易踩的点。

## 为什么 Vercel 能省掉 base path

先说清楚根源。base path 的麻烦不是 Astro 的锅，是"项目页挂在子路径"带来的。

GitHub Pages 项目页地址是 `username.github.io/仓库名`，站点天生在 `/仓库名` 这个子目录下，所以 `base` 必须配成 `/myBlog`。

而 Vercel 部署出来的地址是 `项目名.vercel.app`，站点直接挂在**根域名**下。没有子路径，也就不需要 `base`，更不需要给每个链接加前缀。

> 子路径部署，base path 是必修课；根域名部署，这门课直接免修。

这就是我想迁过去的核心原因。代价是要改几处配置，但改完之后，心智负担小很多。

## 前提：代码得在 Git 仓库里

Vercel 是从 Git 仓库拉代码来构建的，所以第一步是确保博客代码已经推到了 GitHub（GitLab、Bitbucket 也行）。

我这个博客本来就托管在 GitHub 上，这步天然满足。如果你的还在本地，先建个仓库推上去。

## 一步步把博客接到 Vercel

整个流程基本是点点鼠标，没几步：

**1. 用 GitHub 账号登录 Vercel。** 打开 [vercel.com](https://vercel.com)，选用 GitHub 登录。个人博客用免费的 Hobby 计划完全够，不用付费。

**2. 新建项目，导入仓库。** 进 Dashboard 点 "Add New… → Project"，在 "Import Git Repository" 里找到博客的仓库，点 Import。第一次用会让你授权 Vercel 访问 GitHub 仓库，按引导授权即可。

**3. 让 Vercel 自动识别 Astro。** 导入后 Vercel 会扫描项目，认出这是 Astro，自动把构建配置填好：

- **Framework Preset**：Astro
- **Build Command**：`astro build`（或读你 `package.json` 里的 build 脚本）
- **Output Directory**：`dist`
- **Install Command**：检测到 `pnpm-lock.yaml`，自动用 `pnpm install`

这些默认值对这个项目都是对的，基本不用改。Astro 静态构建默认就输出到 `dist`，和 Vercel 认的目录对得上。

**4. 点 Deploy，等构建。** 不用先改任何东西，先让它跑一次。Vercel 会拉代码、装依赖、`build`，然后把 `dist` 托管出去。一两分钟后给你一个 `项目名.vercel.app` 的地址。

**5. 打开看看。** 这时大概率会发现——首页能开，但**样式全没了、点链接到处 404**。

别慌，这是预期之中的，因为 base path 还没改。下面就是迁移的关键。

## 迁移必须改的：把 base path 拿掉

为什么先让它失败一次？因为我想让你亲眼看到 base path 不匹配长什么样：F12 一看，全是 `项目名.vercel.app/myBlog/assets/...` 这种请求，但 Vercel 根本没有 `/myBlog` 这层目录——站点就在根目录，所以全 404。

Astro 在构建时，会把所有资源按 `base` 配置去拼前缀。之前为 GitHub Pages 配的 `base: '/myBlog'` 还在，于是产物里全是 `/myBlog/...`，到了 Vercel 的根域名就全错位了。

改 `astro.config.mjs`，把 `base` 去掉，`site` 换成 Vercel 的域名：

```js
import mdx from '@astrojs/mdx';
import sitemap from '@astrojs/sitemap';
import tailwindcss from '@tailwindcss/vite';
import { defineConfig } from 'astro/config';

export default defineConfig({
  site: 'https://my-blog.vercel.app', // 换成你的 Vercel 域名
  // base: '/myBlog'  ← 删掉，默认就是 '/'
  vite: {
    plugins: [tailwindcss()]
  },
  integrations: [mdx(), sitemap()]
});
```

两个改动：

- **删掉 `base`**：不写时 Astro 默认 `base` 就是 `/`，站点回到根目录
- **改 `site`**：换成 Vercel 给的生产域名。`site` 是 sitemap、RSS、canonical、Open Graph 这些绝对链接的来源，不改的话，RSS 里链接还指向旧的 github.io

推上去，Vercel 自动重新部署，这次资源路径就对了。

这里 `site` 要填**稳定的生产域名**（`项目名.vercel.app` 或后面绑的自定义域名），不要填每次部署都变的那个临时 deployment URL。

## 意外之喜：withBase() 一行没动就适配了

迁移时我有点担心那些散落在组件里的 `withBase()` 调用——是不是要一个个去掉？

结果发现完全不用动。回看它的实现：

```ts
export function withBase(path: string): string {
  const base = import.meta.env.BASE_URL;
  if (path.startsWith('http') || path.startsWith(base)) return path;
  return base + path.replace(/^\//, '');
}
```

它读的是 `import.meta.env.BASE_URL`，也就是当前的 `base` 配置。把 `base` 去掉后，`BASE_URL` 变成 `/`。这时 `withBase('/dot-grid.js')` 里，`'/dot-grid.js'` 正好以 `/` 开头，命中 `path.startsWith(base)`，原样返回 `/dot-grid.js`——正好是根路径下的正确地址。

也就是说，**所有 `withBase()` 调用自动跟着 `base` 变了，一处源码没改。**

这件事让我有点感慨。当初为了 GitHub Pages 封装 `withBase()`，纯粹是被 404 逼的，当时只觉得是个补丁。没想到换平台时，正是因为路径都收口在这一个函数里，迁移成本几乎为零。

> 把易变的东西收口到一个地方，当初看像麻烦，真要变的时候才知道是省了大事。

如果当初我是把 `/myBlog` 写死在每个链接里，这次迁移就得全局搜索替换，还提心吊胆怕漏。

## 几个容易踩的小坑

base path 是最大的一个，剩下几个相对小，但也值得提前知道。

**静态站不用装 `@astrojs/vercel`。** 这个最容易把人带偏。翻 Astro 部署文档会看到一个 `@astrojs/vercel` adapter，但那是给**按需渲染（SSR）**用的。我这个博客是纯静态站（没配任何 adapter，`astro.config` 里只有 mdx 和 sitemap），Vercel 直接托管 `dist` 就行，**不需要装 adapter，也不要改 `output`**。装了反而把简单问题复杂化。只有当你需要服务端渲染、API 路由这类动态能力时，才需要那个 adapter。

**固定 pnpm 版本。** Vercel 通过 Corepack 决定用哪个版本的 pnpm，依据是 `package.json` 里的 `packageManager` 字段。如果不写，云端用的版本可能和你本地不一致，偶尔会因为 lockfile 格式对不上而装依赖失败。稳妥起见加一行：

```json
{
  "packageManager": "pnpm@10.0.0"
}
```

版本号填你本地 `pnpm -v` 的那个。

**Node 版本对齐。** 我本地用 Node 22，就在 Vercel 项目的 Settings → Build & Deployment 里把 Node 版本也设成 22，避免本地能 build、云端报错的尴尬。

**让检查也在云端跑（可选）。** 这个项目的 `package.json` 里有个现成的脚本：

```json
"build:strict": "pnpm run check && pnpm run build"
```

我把 Vercel 的 Build Command 从 `astro build` 改成了 `pnpm run build:strict`，这样每次部署前会先跑 `astro check`，类型或内容 frontmatter 写错了会直接让部署失败。听起来像给自己添堵，其实是好事——**坏内容压根别上线**，比上线后才发现强。

**sitemap 和 RSS 跟着 `site` 变。** 上面改 `site` 那步如果漏了，页面看着正常，但 RSS 和 sitemap 里的链接还是旧域名。这种问题平时点不到，等别人订阅了才发现，挺尴尬，所以改 `site` 别忘。

## 白嫖到的好东西：每次 PR 自动预览

接好之后，最让我意外好用的是 **Preview 部署**。

接到 Vercel 之后，部署行为是这样的：

- push 到生产分支（`main` / `master`）→ 自动构建并更新**正式站点**
- 开 PR 或 push 到其他分支 → 自动生成一个**独立的预览地址**

这意味着我改个样式、调个布局，开个 PR，Vercel 就给一条专属的预览链接，能在真实环境里点一圈确认没问题再合并。以前在 GitHub Pages 上，我只有一个生产环境，想预览就得本地 `pnpm preview`，没法把链接发给别人看。

对个人博客来说，这个能力有点奢侈，但确实香。

## 那到底选 GitHub Pages 还是 Vercel？

两篇都写完了，顺便说说我现在的看法，不吹也不踩：

- **GitHub Pages**：代码和部署都在 GitHub 里，不引入第三方平台，纯粹、干净。代价是项目页要忍受 base path，配置门槛略高。适合愿意自己掌控 workflow、不介意子路径的人。
- **Vercel**：根域名部署省掉 base path，自动 Preview、自定义域名、回滚都很顺手，几乎零配置。代价是多依赖一个平台。适合想把精力全放在写作上、不想折腾部署细节的人。

我自己最后是怎么选的？说实话，对这个静态博客，两个都能跑得很好。真正影响体验的不是平台多强，而是**部署这件事还要不要占用我写作的注意力**。Vercel 在这点上更省心，所以我把日常更新放在了它上面。

## 最后

迁到 Vercel 之后，我的发布流程更短了：写完、push，剩下交给 Vercel，连 `withBase()` 那根弦都不用绷了。

回头看这两篇部署记录，其实是同一个主题的两面。GitHub Pages 那篇，我在学着和子路径、和权限、和 404 相处；Vercel 这篇，我选择干脆绕开它们。没有哪个绝对更好，只是把复杂度放在了不同的地方。

如果说迁移这一趟让我记住了什么，大概是那个意外之喜：当初被迫封装的 `withBase()`，在换平台时几乎零成本地适配了。很多看起来麻烦的"收口"，价值不在当下，而在你下一次要改的时候。

> 好的抽象不是为了今天少写代码，是为了明天改起来不疼。

部署方式可以换，平台可以挑，但这条经验我大概会一直带着。
