import DOMPurify from 'dompurify';

let purifyHooksInstalled = false;

function ensurePurifyHooks(): void {
    if (purifyHooksInstalled) return;
    // Add security hook to only allow checkbox inputs
    DOMPurify.addHook('afterSanitizeAttributes', (node) => {
        if (node.tagName === 'INPUT') {
            const type = node.getAttribute('type')?.toLowerCase();
            if (type !== 'checkbox') node.remove();
        }
    });
    purifyHooksInstalled = true;
}

/**
 * Sanitizes HTML using DOMPurify with our security policy.
 * Uses the sanitized DOM directly (RETURN_DOM) so post-processing operates on
 * the exact tree DOMPurify validated, avoiding a serialize/reparse round-trip.
 * @param html - Raw HTML string to sanitize
 * @returns The sanitized `<body>` (in a fresh, inert document), or null if DOMPurify could not parse the input
 */
export function sanitizeToRoot(html: string): HTMLElement | null {
    ensurePurifyHooks();
    const root = DOMPurify.sanitize(html, {
        RETURN_DOM: true,
        // Keep it permissive for rich content but remove dangerous elements
        ALLOWED_TAGS: [
            // Required with RETURN_DOM: otherwise DOMPurify removes the returned <body> from its document
            'body',
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
            'div',
            'details',
            'summary',
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
            'data-resource-id',
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
            // Accessibility attributes (aria-* is allowed by DOMPurify's default ALLOW_ARIA_ATTR)
            'role',
            // Expanded state for <details>
            'open',
        ],
    });
    // Typed as Node, but DOMPurify returns null when it cannot create a document
    return root instanceof HTMLElement ? root : null;
}
