import avatar from '../assets/images/avatar.jpg';
import type { SiteConfig } from '../types';

const siteConfig: SiteConfig = {
    website: 'https://yuanran32.github.io/myBlog',
    avatar: {
        src: avatar,
        alt: 'Elowen'
    },
    image: {
        src: '/og-image.png',
        alt: 'Elowen 技术小站'
    },
    title: 'Elowen',
    subtitle: '榆木勇闯技术圈',
    description: '前端工程师 Elowen 的技术博客，记录前端开发、Web 工程化、TypeScript 实践与项目复盘，分享学习过程中的思考和踩坑经验。',
    headerNavLinks: [
        {
            text: '首页',
            href: '/'
        },
        {
            text: '项目',
            href: '/projects/'
        },
        {
            text: '博客',
            href: '/blog/'
        },
        {
            text: '系列',
            href: '/series/'
        },
        {
            text: '简历',
            href: '/resume/'
        },
        {
            text: '标签',
            href: '/tags/'
        }
    ],
    footerNavLinks: [
        {
            text: '关于',
            href: '/about/'
        },
        {
            text: '联系',
            href: '/contact/'
        },
        {
            text: '条款',
            href: '/terms/'
        }
    ],
    socialLinks: [
        {
            text: 'GitHub',
            href: 'https://github.com/yuanran32'
        }
    ],
    hero: {
        title: 'Elowen的技术小站',
        text: '欢迎来到我的个人博客。这里会记录我的技术学习、项目实践、问题复盘和一些阶段性的思考。\n\n我目前关注前端开发、Web 工程化和全栈应用开发，也会持续整理学习过程中遇到的知识点和实践经验。\n\n你可以在 [GitHub](https://github.com/yuanran32) 查看我的项目，也可以通过联系页面找到我。',
        actions: [
            {
                text: '联系我',
                href: '/contact/'
            }
        ]
    },
    focusAreas: ['前端开发', 'Web 工程化', '前端测试', '全栈应用', '数据可视化'],
    subscribe: {
        enabled: false,
        title: '订阅博客更新',
        text: '有新文章时，把更新发送到你的邮箱。',
        form: {
            action: '#'
        }
    },
    postsPerPage: 8,
    projectsPerPage: 8
};

export default siteConfig;
