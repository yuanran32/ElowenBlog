import type { ResumeVersion } from './types';

const version: ResumeVersion = {
    label: '2026-05-01',
    date: '2026-05-01',
    data: {
        name: 'Elowen',
        summary: '成都信息工程大学软件工程在读，关注前端开发与 Web 工程化。',
        contactLinks: [
            { icon: 'mail', label: '邮箱', value: '3916048194@qq.com', href: 'mailto:3916048194@qq.com' },
            { icon: 'github', label: 'GitHub', value: 'yuanran32', href: 'https://github.com/yuanran32' },
            { icon: 'globe', label: '博客', value: 'elowen-blog.vercel.app', href: 'https://elowen-blog.vercel.app/' }
        ],
        skills: [
            '熟悉 HTML5、CSS、掌握 JavaScript ES6+、异步编程、闭包、原型链、事件循环等核心基础知识。',
            '熟练掌握 Vue3 + Composition API，熟悉React18 + Hooks，具备 TypeScript  开发经验，能够使用组合式函数 / 自定义 Hooks拆分复杂业务状态。',
            '熟悉 Vite、ESLint、Prettier、Git，了解组件库构建、类型声明生成、npm 包发布、GitHub Actions CI 流程。',
            '了解 uni-app 跨端框架，具备小程序多端开发实践经验；',
            '了解 Web Worker、IndexedDB、ECharts、Vitest、Playwright、VitePress，并在项目中用于性能优化、本地缓存、图表展示、测试和文档建设。',
            '了解后端语言node.js、java等，具备相应的开发经验。'
        ],
        projects: [
            {
                title: '个人博客系统',
                techStack: 'Astro + TypeScript + Tailwind CSS + Markdown',
                github: 'https://github.com/yuanran32/myBlog',
                description: '基于 Astro 和 Tailwind CSS 搭建的个人博客，用于记录技术文章和学习笔记。',
                highlights: [
                    '负责博客站点的页面配置、内容管理和部署流程',
                    '使用 Markdown 管理文章内容，支持标签、分页和 SEO 信息',
                    '配置站点地图、RSS，适配 Vercel 部署'
                ]
            }
        ],
        experiences: [],
        education: [
            {
                school: '成都信息工程大学',
                badge: '本科',
                achievements: ['软件工程 · 2025.09 - 2029.06']
            }
        ]
    }
};

export default version;
