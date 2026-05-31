import { getCollection, type CollectionEntry } from 'astro:content';
import { slugify } from './common-utils';

type BlogPost = CollectionEntry<'blog'>;
type Project = CollectionEntry<'projects'>;
type ContentIndexItem = { name: string; id: string; count: number };

const warnedMessages = new Set<string>();

function warnOnce(message: string) {
    if (warnedMessages.has(message)) return;
    warnedMessages.add(message);
    console.warn(`[content-health] ${message}`);
}

export function sortItemsByDateDesc(itemA: BlogPost | Project, itemB: BlogPost | Project) {
    return new Date(itemB.data.publishDate).getTime() - new Date(itemA.data.publishDate).getTime();
}

export function filterPublishedPosts(posts: BlogPost[]) {
    if (!import.meta.env.PROD) {
        return posts;
    }

    return posts.filter((post) => !post.data.draft);
}

export async function getPublishedBlogPosts() {
    const posts = filterPublishedPosts(await getCollection('blog')).sort(sortItemsByDateDesc);
    reportBlogContentHealth(posts);
    return posts;
}

export async function getFeaturedBlogPosts() {
    return (await getPublishedBlogPosts()).filter(({ data }) => data.isFeatured);
}

export async function getAllProjects() {
    const projects = (await getCollection('projects')).sort(sortItemsByDateDesc);
    reportProjectContentHealth(projects);
    return projects;
}

export async function getFeaturedProjects() {
    return (await getAllProjects()).filter(({ data }) => data.isFeatured);
}

export function getReadingTime(content?: string) {
    if (!content) return 1;

    const words = content
        .replace(/```[\s\S]*?```/g, ' ')
        .replace(/<[^>]+>/g, ' ')
        .trim();
    const chineseChars = words.match(/[一-鿿]/g)?.length ?? 0;
    const latinWords = words.match(/[a-zA-Z0-9]+/g)?.length ?? 0;
    const minutes = Math.ceil(chineseChars / 350 + latinWords / 200 || 1);

    return Math.max(1, minutes);
}

export function getAllTags(posts: BlogPost[]) {
    return getTagIndex(posts).map(({ name, id }) => ({ name, id }));
}

export function getTagIndex(posts: BlogPost[]): ContentIndexItem[] {
    const tagMap = new Map<string, ContentIndexItem>();

    for (const post of posts) {
        for (const tag of post.data.tags || []) {
            const id = slugify(tag);
            if (!id) continue;
            const existing = tagMap.get(id);
            if (existing) {
                existing.count += 1;
                if (existing.name !== tag) {
                    warnOnce(`标签 "${existing.name}" 与 "${tag}" 生成了相同 slug: ${id}`);
                }
            } else {
                tagMap.set(id, { name: tag, id, count: 1 });
            }
        }
    }

    return [...tagMap.values()].sort((tagA, tagB) => tagB.count - tagA.count || tagA.name.localeCompare(tagB.name));
}

export function getPostsByTag(posts: BlogPost[], tagId: string) {
    return posts.filter((post) => (post.data.tags || []).map((tag) => slugify(tag)).includes(tagId));
}

export function getAllSeries(posts: BlogPost[]) {
    return getSeriesIndex(posts).map(({ name, id }) => ({ name, id }));
}

export function getSeriesIndex(posts: BlogPost[]): ContentIndexItem[] {
    const seriesMap = new Map<string, ContentIndexItem>();

    for (const post of posts) {
        if (!post.data.series) continue;
        const id = slugify(post.data.series);
        if (!id) continue;
        const existing = seriesMap.get(id);
        if (existing) {
            existing.count += 1;
            if (existing.name !== post.data.series) {
                warnOnce(`系列 "${existing.name}" 与 "${post.data.series}" 生成了相同 slug: ${id}`);
            }
        } else {
            seriesMap.set(id, { name: post.data.series, id, count: 1 });
        }
    }

    return [...seriesMap.values()].sort((seriesA, seriesB) => seriesB.count - seriesA.count || seriesA.name.localeCompare(seriesB.name));
}

export function getPostsBySeries(posts: BlogPost[], seriesId: string) {
    return posts.filter((post) => post.data.series && slugify(post.data.series) === seriesId);
}

export function createPostDescription(post: BlogPost) {
    if (post.data.excerpt) return post.data.excerpt;

    return (post.body ?? '')
        .replace(/```[\s\S]*?```/g, ' ')
        .replace(/[#>*_`[\]()-]/g, ' ')
        .replace(/\s+/g, ' ')
        .trim()
        .slice(0, 180);
}

function reportBlogContentHealth(posts: BlogPost[]) {
    const now = Date.now();

    for (const post of posts) {
        if (!post.data.title.trim()) {
            warnOnce(`博客 ${post.id} 标题为空`);
        }
        if (post.data.updatedDate && post.data.updatedDate < post.data.publishDate) {
            warnOnce(`博客 ${post.id} 的 updatedDate 早于 publishDate`);
        }
        if (post.data.publishDate.getTime() > now) {
            warnOnce(`博客 ${post.id} 的 publishDate 是未来日期`);
        }
        if (!post.data.draft && !post.data.excerpt && !post.data.seo?.description) {
            warnOnce(`已发布博客 ${post.id} 缺少 excerpt 或 seo.description`);
        }
        for (const tag of post.data.tags || []) {
            if (!tag.trim()) {
                warnOnce(`博客 ${post.id} 包含空标签`);
            }
        }
        if (import.meta.env.PROD && post.data.draft) {
            warnOnce(`草稿博客 ${post.id} 出现在生产发布列表中`);
        }
    }

    getTagIndex(posts);
    getSeriesIndex(posts);
}

function reportProjectContentHealth(projects: Project[]) {
    const now = Date.now();

    for (const project of projects) {
        if (!project.data.title.trim()) {
            warnOnce(`项目 ${project.id} 标题为空`);
        }
        if (project.data.publishDate.getTime() > now) {
            warnOnce(`项目 ${project.id} 的 publishDate 是未来日期`);
        }
        if (!project.data.description && !project.data.seo?.description) {
            warnOnce(`项目 ${project.id} 缺少 description 或 seo.description`);
        }
    }
}
