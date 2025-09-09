/**
 * @fileoverview Token-based image URL collector
 *
 * Walks markdown-it tokens to collect image sources for embedding.
 * - Collects from `image` tokens (parser excludes code by construction)
 * - Additionally scans `html_inline` and `html_block` token content for <img src="...">
 *   to cover raw HTML images present in the markdown source.
 *
 * Returns a Set of unique URL strings as they appear in the source/tokens.
 */

import type MarkdownIt from 'markdown-it';

/**
 * Collect image URLs from markdown-it tokens for a given markdown input.
 */
export function collectImageUrls(md: MarkdownIt, markdown: string, env?: unknown): Set<string> {
    const envObj: Record<string, unknown> =
        env && typeof env === 'object' ? (env as Record<string, unknown>) : {};
    const tokens = md.parse(markdown, envObj);
    const urls = new Set<string>();

    const htmlImgSrcRegex = /<img[^>]*\ssrc=("|')(.*?)(\1)[^>]*>/gi;

    function collectFromTokens(ts: typeof tokens): void {
        for (const t of ts) {
            // Standard markdown image tokens
            if (t.type === 'image') {
                const srcAttr = t.attrs?.find((a) => a[0] === 'src');
                if (srcAttr && srcAttr[1]) urls.add(srcAttr[1]);
            }

            // Raw HTML fragments that may contain <img>
            if (t.type === 'html_inline' || t.type === 'html_block') {
                const content = t.content || '';
                let m: RegExpExecArray | null;
                htmlImgSrcRegex.lastIndex = 0;
                while ((m = htmlImgSrcRegex.exec(content)) !== null) {
                    const src = m[2];
                    if (src) urls.add(src);
                }
            }

            // Recurse into inline children if present
            if (Array.isArray((t as unknown as { children?: typeof tokens }).children)) {
                collectFromTokens((t as unknown as { children: typeof tokens }).children);
            }
        }
    }

    collectFromTokens(tokens);
    return urls;
}
