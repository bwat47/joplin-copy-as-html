/**
 * @fileoverview DOM Post-processor for HTML Renderer
 *
 * This module handles all post-processing of the rendered HTML using DOMParser.
 * This includes:
 * - Sanitizing HTML
 * - Cleaning up Joplin-specific resource links
 * - Image embedding (for raw html img, markdown images handled by imageRendererRule.ts)
 *
 * @author bwat47
 * @since 1.1.8
 */

/**
 * Sanitizes HTML with DOMPurifier
 * Cleans non-image joplin resource links and Embeds images
 * @param html The HTML string to process.
 * @returns The processed HTML string.
 */
import DOMPurify from 'dompurify';

// Initialize DOMPurify instance
let purifyInstance: typeof DOMPurify;
let purifyHooksInstalled = false;

if (typeof window !== 'undefined') {
    // Browser environment
    purifyInstance = DOMPurify;
} else {
    // Node.js environment - try to load JSDOM dynamically
    try {
        // eslint-disable-next-line @typescript-eslint/no-require-imports
        const { JSDOM } = require('jsdom');
        const window = new JSDOM('').window;
        purifyInstance = DOMPurify(window as unknown as Window & typeof globalThis);
    } catch {
        // JSDOM not available (e.g., in webpack bundle), use DOMPurify as-is
        purifyInstance = DOMPurify;
    }
}

function ensurePurifyHooks(): void {
    if (purifyHooksInstalled) return;
    // Add security hook to only allow checkbox inputs
    purifyInstance.addHook('afterSanitizeAttributes', function (node) {
        if (node.tagName === 'INPUT') {
            if (node.getAttribute('type')?.toLowerCase() !== 'checkbox') {
                node.remove();
            }
        }
    });
    purifyHooksInstalled = true;
}

export function postProcessHtml(
    html: string,
    opts?: { imageSrcMap?: Map<string, string>; stripJoplinImages?: boolean }
): string {
    ensurePurifyHooks();
    const sanitizedHtml = purifyInstance.sanitize(html, {
        // Keep it permissive for rich content but remove dangerous elements
        ALLOWED_TAGS: [
            'h1',
            'h2',
            'h3',
            'h4',
            'h5',
            'h6',
            'p',
            'br',
            'hr',
            'strong',
            'b',
            'em',
            'i',
            'u',
            'mark',
            'del',
            's',
            'ins',
            'sub',
            'sup',
            'ul',
            'ol',
            'li',
            'blockquote',
            'table',
            'thead',
            'tbody',
            'tfoot',
            'tr',
            'th',
            'td',
            'colgroup',
            'col',
            'caption',
            'a',
            'img',
            'code',
            'pre',
            'div',
            'span',
            // Definition lists
            'dl',
            'dt',
            'dd',
            // Abbreviations
            'abbr',
            // Task list checkboxes
            'input',
            // Semantic HTML elements
            'section',
            'nav',
            'article',
            'aside',
            'header',
            'footer',
            'main',
            'figure',
            'figcaption',
            // Additional formatting
            'small',
            'cite',
            'q',
            'dfn',
            'time',
            'var',
            'samp',
            'kbd',
            // GitHub alerts
            'div', // for .markdown-alert classes
        ],
        ALLOWED_ATTR: [
            'href',
            'src',
            'alt',
            'title',
            'width',
            'height',
            'style',
            'class',
            'id',
            'data-*', // for any legitimate data attributes
            // Tables
            'colspan',
            'rowspan',
            'scope',
            'align',
            'valign',
            // Task list checkboxes
            'type',
            'checked',
            'disabled',
            // Additional semantic attributes
            'datetime',
            'cite',
            'lang',
            // Accessibility attributes
            'role',
            'aria-*',
        ],
        FORBID_TAGS: ['script', 'iframe', 'object', 'embed', 'form'],
        FORBID_ATTR: ['onload', 'onerror', 'onclick'], // Remove event handlers
        ALLOW_DATA_ATTR: true,
    });

    // Check if we have any Joplin resource links or images to process
    const hasJoplinLinks = /(?:data-resource-id|href=["']?(?::|joplin:\/\/resource\/))/.test(sanitizedHtml);
    const needImageRewrite = !!opts?.imageSrcMap && /<img\b/i.test(sanitizedHtml);
    const needStripJoplinImages = !!opts?.stripJoplinImages && /<img\b/i.test(sanitizedHtml);
    if (!hasJoplinLinks && !needImageRewrite && !needStripJoplinImages) {
        return sanitizedHtml;
    }

    let doc: Document;
    if (typeof window !== 'undefined') {
        // Browser environment
        const parser = new DOMParser();
        doc = parser.parseFromString(`<body>${sanitizedHtml}</body>`, 'text/html');
    } else {
        // Node.js environment - use JSDOM
        // eslint-disable-next-line @typescript-eslint/no-require-imports
        const { JSDOM } = require('jsdom');
        const dom = new JSDOM(`<body>${sanitizedHtml}</body>`);
        doc = dom.window.document;
    }

    // Clean up non-image Joplin resource links to be just their text content.
    // This handles links created by Joplin's rich text editor and markdown links.
    doc.querySelectorAll('a[data-resource-id], a[href^=":/"], a[href^="joplin://resource/"]').forEach((link) => {
        // Don't modify links that contain images
        if (link.querySelector('img')) {
            return;
        }
        const textContent = link.textContent?.trim() || 'Resource';
        const textNode = doc.createTextNode(textContent);
        link.parentNode?.replaceChild(textNode, link);
    });

    // Rewrite <img> src using the provided map, and optionally strip Joplin resource images
    if (needImageRewrite || needStripJoplinImages) {
        const imgs = doc.querySelectorAll('img');
        imgs.forEach((img) => {
            // Skip images inside code/pre blocks
            if (img.closest('pre, code')) return;

            const src = img.getAttribute('src') || '';

            if (opts?.stripJoplinImages && (/^:\//.test(src) || /^joplin:\/\/resource\//i.test(src))) {
                img.remove();
                return;
            }

            const mapped = opts?.imageSrcMap?.get(src);
            if (mapped) {
                if (mapped.startsWith('data:image/')) {
                    img.setAttribute('src', mapped);
                } else {
                    // Replace the <img> with the mapped error HTML in a type-safe way
                    const wrapper = doc.createElement('span');
                    wrapper.innerHTML = mapped;
                    img.parentNode?.replaceChild(wrapper, img);
                }
            }
        });
    }

    return doc.body.innerHTML;
}
