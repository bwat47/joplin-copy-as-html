/**
 * @fileoverview DOM Post-processor for HTML Renderer
 *
 * This module handles all post-processing of the rendered HTML using DOMParser.
 * This includes:
 * - Sanitizing HTML
 * - Cleaning up Joplin-specific resource links
 * - Future DOM transformations
 *
 * @author bwat47
 * @since 1.1.8
 */

/**
 * Post-processes the HTML using DOMParser to perform clean-up operations.
 * @param html The HTML string to process.
 * @returns The processed HTML string.
 */
import DOMPurify from 'dompurify';

// Initialize DOMPurify instance
let purifyInstance: typeof DOMPurify;

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

export function postProcessHtml(html: string): string {
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

    // Add security hook to only allow checkbox inputs
    purifyInstance.addHook('afterSanitizeAttributes', function (node) {
        // Check if the current node is an <input> element.
        if (node.tagName === 'INPUT') {
            // Check if the 'type' attribute is NOT 'checkbox'.
            // We convert to lowercase to be safe.
            if (node.getAttribute('type')?.toLowerCase() !== 'checkbox') {
                // If it's an input but not a checkbox, remove it.
                node.remove();
            }
        }
    });

    // Check if we have any Joplin resource links to process
    const hasJoplinLinks = /(?:data-resource-id|href=["']?(?::|joplin:\/\/resource\/))/.test(sanitizedHtml);
    if (!hasJoplinLinks) {
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

    return doc.body.innerHTML;
}
