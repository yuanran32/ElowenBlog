import type { ResumeVersion } from './types';

const version: ResumeVersion = {
    label: '2026 实习版',
    date: '2026-05',
    data: {
        name: 'Elowen',
        summary: '成都信息工程大学在读，专注前端开发与工程化实践，有个人项目和实习经验。',
        contactLinks: [
            { icon: 'mail', label: '邮箱', value: '3916048194@qq.com', href: 'mailto:3916048194@qq.com' },
            { icon: 'github', label: 'GitHub', value: 'yuanran32', href: 'https://github.com/yuanran32' },
            { icon: 'globe', label: '博客', value: 'yuanran32.github.io/myBlog', href: 'https://yuanran32.github.io/myBlog/' }
        ],
        skills: [
            '深入理解事件循环、浏览器渲染等前端核心原理',
            '熟练掌握 JavaScript/TypeScript，熟悉 React 及相关生态，了解 Vue',
            '熟悉前端工程化与代码规范，能够使用 ESLint + Prettier + TypeScript 构建规范化项目',
            '熟练使用 Ant Design、ECharts 等常用组件库与工具，具备数据可视化开发经验',
            '能够使用 Claude Code、Cursor、OpenSpec、Codex 等工具辅助开发',
            '熟悉 Git 协作与 PR 流程，掌握 CI/CD（GitHub Actions）、容器化部署基础'
        ],
        projects: [
            {
                title: '个人博客系统',
                techStack: 'Astro + TypeScript + Tailwind CSS + Markdown',
                github: 'https://github.com/yuanran32/myBlog',
                description: '基于 Astro 和 Tailwind CSS 搭建的个人博客，用于记录技术文章、项目经验和学习笔记。',
                highlights: [
                    '负责博客站点的页面配置、内容管理和部署流程',
                    '使用 Markdown 管理文章内容，支持标签、分页、系列和 SEO 信息',
                    '配置站点地图、RSS 和基础 SEO 元信息，适配 GitHub Pages 部署'
                ]
            },
            {
                title: '前端数据透视分析工作台',
                techStack: 'TypeScript + xlsx + Web Worker + IndexedDB + 数据可视化',
                description: '面向本地 Excel / CSV 数据分析场景，提升数据导入、透视聚合、图表展示和结果导出效率。',
                highlights: [
                    '基于 xlsx 实现 Excel / CSV 导入，处理空行、重复表头和字段类型推断',
                    '对手机号、编号、id、code、前导 0 和长数字等字段做字符串保留，避免精度丢失',
                    '基于 Map 分桶实现多维度聚合，支持 sum、count、avg、min、max 等计算',
                    '将透视计算迁移到 Web Worker，降低主线程阻塞并提升复杂数据场景交互流畅度',
                    '使用 IndexedDB 缓存最近数据集、透视配置和分析模板，支持 CSV / Excel / PNG 导出'
                ]
            }
        ],
        experiences: [
            {
                company: '北京博视',
                role: '前端实习',
                period: '2026.05 - 至今',
                highlights: [
                    '参与业务模块开发，完成页面、接口或数据处理逻辑',
                    '与产品、设计或后端协作，推动功能上线',
                    '修复线上问题，提升用户体验或系统稳定性'
                ]
            }
        ],
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
