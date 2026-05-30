export function slugify(input?: string) {
    if (!input) return '';

    // make lower case and trim
    var slug = input.toLowerCase().trim();

    // remove accents from charaters
    slug = slug.normalize('NFD').replace(/[\u0300-\u036f]/g, '');

    // replace invalid chars with spaces, while keeping unicode letters such as Chinese
    slug = slug.replace(/[^\p{L}\p{N}\s-]/gu, ' ').trim();

    // replace multiple spaces or hyphens with a single hyphen
    slug = slug.replace(/[\s-]+/g, '-');

    return slug;
}

export function withBase(path: string) {
    if (!path || /^(?:[a-z][a-z0-9+.-]*:|\/\/|#)/i.test(path)) {
        return path;
    }

    const base = import.meta.env.BASE_URL.replace(/\/$/, '');
    const normalizedPath = path.startsWith('/') ? path : `/${path}`;

    if (base && (normalizedPath === base || normalizedPath.startsWith(`${base}/`))) {
        return normalizedPath;
    }

    return `${base}${normalizedPath}`;
}
