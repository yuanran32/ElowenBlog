import rss from '@astrojs/rss';
import siteConfig from '../data/site-config.ts';
import { absoluteUrl } from '../utils/common-utils.ts';
import { createPostDescription, getPublishedBlogPosts } from '../utils/data-utils.ts';

function escapeXml(value) {
    return value.replace(/[<>&'"]/g, (char) => {
        return {
            '<': '&lt;',
            '>': '&gt;',
            '&': '&amp;',
            "'": '&apos;',
            '"': '&quot;'
        }[char];
    });
}

export async function GET(context) {
    const posts = await getPublishedBlogPosts();

    return rss({
        title: siteConfig.title,
        description: siteConfig.description,
        site: context.site,
        items: posts.map((item) => ({
            title: item.data.title,
            description: createPostDescription(item),
            link: absoluteUrl(`/blog/${item.id}/`, context.site),
            pubDate: new Date(item.data.publishDate),
            categories: item.data.tags,
            customData: [
                item.data.updatedDate ? `<updated>${item.data.updatedDate.toISOString()}</updated>` : '',
                item.data.series ? `<series>${escapeXml(item.data.series)}</series>` : ''
            ]
                .filter(Boolean)
                .join('')
        }))
    });
}
