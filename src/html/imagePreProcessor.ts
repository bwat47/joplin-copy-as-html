import { REGEX_PATTERNS } from '../constants';
import { HtmlOptions } from '../types';
import { convertResourceToBase64, downloadRemoteImageAsBase64 } from './assetProcessor';

type Segment = { type: 'text' | 'code'; content: string };

function segmentByCodeBlocks(markdown: string): Segment[] {
    const segments: Segment[] = [];
    const codeBlockRegex = new RegExp(REGEX_PATTERNS.CODE_BLOCKS.source, REGEX_PATTERNS.CODE_BLOCKS.flags);
    let lastIndex = 0;
    let match: RegExpExecArray | null;

    while ((match = codeBlockRegex.exec(markdown)) !== null) {
        if (match.index > lastIndex) {
            segments.push({ type: 'text', content: markdown.slice(lastIndex, match.index) });
        }
        segments.push({ type: 'code', content: match[0] });
        lastIndex = codeBlockRegex.lastIndex;
    }

    if (lastIndex < markdown.length) {
        segments.push({ type: 'text', content: markdown.slice(lastIndex) });
    }
    return segments;
}

export async function preprocessImageResources(markdown: string, options: HtmlOptions): Promise<string> {
    const { embedImages, downloadRemoteImages } = options;
    const segments = segmentByCodeBlocks(markdown);

    if (!embedImages) {
        // Strip only Joplin resource images; preserve remote images
        return segments
            .map((s) =>
                s.type === 'code'
                    ? s.content
                    : s.content
                          .replace(/<img[^>]*src=["']:\/{1,2}[a-f0-9]{32}["'][^>]*>/gi, '')
                          .replace(/!\[[^\]]*\]\(:\/[a-f0-9]{32}\)/gi, '')
            )
            .join('');
    }

    // Collect unique Joplin resource ids from image contexts
    const resourceIds = new Set<string>();
    for (const s of segments) {
        if (s.type === 'code') continue;
        for (const m of s.content.matchAll(REGEX_PATTERNS.HTML_IMG_JOPLIN_SRC)) {
            resourceIds.add(m[1]);
        }
        // Markdown image with optional title: ![alt](:/id "title")
        for (const m of s.content.matchAll(REGEX_PATTERNS.MD_IMG_JOPLIN_WITH_TITLE)) {
            resourceIds.add(m[2]);
        }
    }

    const resourceMap = new Map<string, string>();
    await Promise.all(
        Array.from(resourceIds).map(async (id) => {
            resourceMap.set(id, await convertResourceToBase64(id));
        })
    );

    // Collect unique remote urls from image contexts
    const remoteUrls = new Set<string>();
    if (downloadRemoteImages) {
        for (const s of segments) {
            if (s.type === 'code') continue;
            for (const m of s.content.matchAll(REGEX_PATTERNS.HTML_IMG_REMOTE_SRC)) {
                remoteUrls.add(m[1]);
            }
            // Markdown image with optional title: ![alt](url "title")
            for (const m of s.content.matchAll(REGEX_PATTERNS.MD_IMG_REMOTE_WITH_TITLE)) {
                remoteUrls.add(m[2]);
            }
        }
    }

    const remoteMap = new Map<string, string>();
    if (remoteUrls.size) {
        await Promise.all(
            Array.from(remoteUrls).map(async (url) => {
                remoteMap.set(url, await downloadRemoteImageAsBase64(url));
            })
        );
    }

    // Apply replacements in image contexts only
    const out = segments.map((s) => {
        if (s.type === 'code') return s.content;
        let t = s.content;

        // HTML Joplin resource images
        t = t.replace(REGEX_PATTERNS.HTML_IMG_JOPLIN_SRC, (imgTag: string, id: string) => {
            const v = resourceMap.get(id) || '';
            if (v.startsWith('data:image/')) return imgTag.replace(/src=["'][^"']+["']/, `src="${v}"`);
            if (v) return v; // error span
            return imgTag;
        });

        // Markdown Joplin resource images, with optional title
        t = t.replace(
            REGEX_PATTERNS.MD_IMG_JOPLIN_WITH_TITLE,
            (m0: string, alt: string, id: string, titlePart?: string) => {
                const v = resourceMap.get(id) || '';
                if (v.startsWith('data:image/')) return `![${alt}](${v}${titlePart ? ` ${titlePart}` : ''})`;
                if (v) return v; // error span
                return m0;
            }
        );

        if (downloadRemoteImages && remoteMap.size) {
            // HTML remote images
            t = t.replace(REGEX_PATTERNS.HTML_IMG_REMOTE_SRC, (imgTag: string, url: string) => {
                const v = remoteMap.get(url) || '';
                if (v.startsWith('data:image/')) return imgTag.replace(/src=["'][^"']+["']/, `src="${v}"`);
                if (v) return v; // error span
                return imgTag;
            });

            // Markdown remote images, with optional title
            t = t.replace(
                REGEX_PATTERNS.MD_IMG_REMOTE_WITH_TITLE,
                (m0: string, alt: string, url: string, titlePart?: string) => {
                    const v = remoteMap.get(url) || '';
                    if (v.startsWith('data:image/')) return `![${alt}](${v}${titlePart ? ` ${titlePart}` : ''})`;
                    if (v) return v; // error span
                    return m0;
                }
            );
        }

        return t;
    });

    return out.join('');
}
