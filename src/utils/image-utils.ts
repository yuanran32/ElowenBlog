import { getImage } from 'astro:assets';
import type { ImageInput } from '../types';
import { absoluteUrl } from './common-utils';

export type ResolvedShareImage = {
    src: string;
    alt?: string;
};

/**
 * 把分享图（本地 ImageMetadata 或路径字符串）统一解析为 1200x630 的绝对 URL，
 * 供 og:image / twitter:image / JSON-LD 共用，保证三处输出同一张图。
 */
export async function resolveShareImage(image: ImageInput | undefined, site: URL | undefined): Promise<ResolvedShareImage | undefined> {
    if (!image?.src) return undefined;

    if (typeof image.src === 'string') {
        return {
            src: absoluteUrl(image.src, site),
            alt: image.alt
        };
    }

    const optimizedImage = await getImage({
        src: image.src,
        width: 1200,
        height: 630,
        format: 'jpeg',
        fit: 'cover'
    });
    return {
        src: new URL(optimizedImage.src, site).toString(),
        alt: image.alt
    };
}
