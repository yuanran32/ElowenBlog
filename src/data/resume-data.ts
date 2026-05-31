export type ContactLink = {
    icon: string;
    label: string;
    value: string;
    href: string;
};

export type ResumeProject = {
    title: string;
    techStack: string;
    github?: string;
    period?: string;
    description: string;
    highlights: string[];
};

export type Experience = {
    company: string;
    role: string;
    period: string;
    highlights: string[];
};

export type Education = {
    school: string;
    badge?: string;
    achievements?: string[];
};

export type ResumeVersion = {
    label: string;
    date: string;
    active?: boolean;
};

export type ResumeData = {
    name: string;
    summary: string;
    contactLinks: ContactLink[];
    skills: string[];
    projects: ResumeProject[];
    experiences: Experience[];
    education: Education[];
    versions: ResumeVersion[];
};

const resumeData: ResumeData = {
    name: 'Elowen',
    title: '前端开发 / 全栈开发',
    summary: '关注前端开发、Web 工程化和全栈应用开发，重视项目落地、问题复盘和可维护的工程实践。',
    contactLinks: [
        { label: '邮箱', value: '3916048194@qq.com', href: 'mailto:3916048194@qq.com' },
        { label: 'GitHub', value: 'github.com/yuanran32', href: 'https://github.com/yuanran32' },
        { label: '博客', value: 'yuanran32.github.io/myBlog', href: 'https://yuanran32.github.io/myBlog/' }
    ],
    skillGroups: [
        {
            title: '前端基础',
            skills: ['HTML', 'CSS', 'JavaScript', 'TypeScript']
        },
        {
            title: '框架与工程',
            skills: ['React', 'Vue', 'Astro', 'Vite', 'Tailwind CSS']
        },
        {
            title: '后端与数据',
            skills: ['Node.js', '接口开发', 'MySQL', 'MongoDB']
        },
        {
            title: '工具链',
            skills: ['Git', 'npm', 'pnpm', 'Web 工程化']
        }
    ],
    projects: [
        {
            title: '个人博客系统',
            description: '基于 Astro 和 Tailwind CSS 搭建的个人博客，用于记录技术文章、项目经验和学习笔记。',
            techStack: ['Astro', 'Markdown', 'Tailwind CSS', 'TypeScript'],
            highlights: [
                '负责博客站点的页面配置、内容管理和部署流程',
                '使用 Markdown 管理文章内容，支持标签、分页、系列和 SEO 信息',
                '配置站点地图、RSS 和基础 SEO 元信息，适配 GitHub Pages 部署'
            ]
        },
        {
            title: '前端数据透视分析工作台',
            description: '面向本地 Excel / CSV 数据分析场景，提升数据导入、透视聚合、图表展示和结果导出效率。',
            techStack: ['TypeScript', 'xlsx', 'Web Worker', 'IndexedDB', '数据可视化'],
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
            major: '软件工程',
            period: '2025.09 - 2029.06'
        }
    ]
};

export default resumeData;
