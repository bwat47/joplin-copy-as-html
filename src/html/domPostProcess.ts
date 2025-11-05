/**
 * @fileoverview DOM Post-processor for HTML Renderer
 *
 * This module handles all post-processing of the rendered HTML using DOMParser.
 * This includes:
 * - Sanitizing HTML
 * - Cleaning up Joplin-specific resource links
 * - Image embedding
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
import { HTML_CONSTANTS } from '../constants';
import { logger } from '../logger';

// Initialize DOMPurify instance (jsdom provides window in tests; Electron provides window at runtime)
const purifyInstance = DOMPurify;
let purifyHooksInstalled = false;

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

export async function postProcessHtml(
    html: string,
    opts?: {
        imageSrcMap?: Map<string, string | null>;
        stripJoplinImages?: boolean;
        convertSvgToPng?: boolean;
    }
): Promise<string> {
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
            // Accessibility attributes
            'role',
            'aria-*',
        ],
        FORBID_TAGS: ['script', 'iframe', 'object', 'embed', 'form'],
        FORBID_ATTR: ['onload', 'onerror', 'onclick'], // Remove event handlers
    });

    // Check if we have any Joplin resource links or images to process
    const hasJoplinLinks = /(?:data-resource-id|href=["']?(?::|joplin:\/\/resource\/))/.test(sanitizedHtml);
    const hasAnyImg = /<img\b/i.test(sanitizedHtml);
    const needImageRewrite = !!opts?.imageSrcMap && hasAnyImg;
    const needStripJoplinImages = !!opts?.stripJoplinImages && hasAnyImg;
    const needSvgProcessing = !!opts?.convertSvgToPng && /image\/svg\+xml/i.test(sanitizedHtml);
    const needTopLevelWrap = hasAnyImg;
    if (!hasJoplinLinks && !needImageRewrite && !needStripJoplinImages && !needTopLevelWrap && !needSvgProcessing) {
        return sanitizedHtml;
    }

    const parser = new DOMParser();
    const doc = parser.parseFromString(`<body>${sanitizedHtml}</body>`, 'text/html');

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
            if (mapped !== undefined) {
                if (typeof mapped === 'string' && mapped.startsWith('data:image/')) {
                    img.setAttribute('src', mapped);
                } else {
                    // Replace the <img> with a consistent inline error message
                    const fallback = doc.createElement('span');
                    fallback.textContent = 'Image failed to load';
                    fallback.style.color = HTML_CONSTANTS.ERROR_COLOR;
                    img.parentNode?.replaceChild(fallback, img);
                }
            }
        });
    }

    // Convert SVG images to PNG for better compatibility
    if (opts?.convertSvgToPng) {
        const svgImages = Array.from(doc.querySelectorAll('img'));
        const conversionPromises: Promise<void>[] = [];

        svgImages.forEach((img) => {
            if (shouldSkipRasterization(img)) return;
            if (!(img instanceof HTMLImageElement)) return;
            const src = img.getAttribute('src');
            if (!isSvgDataSource(src)) return;
            conversionPromises.push(
                convertSvgImageElement(img, src).catch((error) => logger.debug('SVG rasterization failed', error))
            );
        });

        if (conversionPromises.length) {
            await Promise.all(conversionPromises);
        }
    }

    // Normalize top-level raw HTML images to behave like markdown images visually:
    // wrap each direct child <img> of <body> in its own <p> block.
    // This keeps each image on its own line consistently.
    const topLevelImgs: Element[] = Array.from(doc.body.children).filter((el) => el.tagName === 'IMG');
    for (const img of topLevelImgs) {
        const p = doc.createElement('p');
        img.parentNode?.replaceChild(p, img);
        p.appendChild(img);
    }

    return doc.body.innerHTML;
}

function shouldSkipRasterization(node: Element): boolean {
    return !!node.closest('pre, code');
}

function isSvgDataSource(src: string | null): boolean {
    if (!src) return false;
    return /^data:image\/svg\+xml/i.test(src.trim());
}

async function convertSvgImageElement(img: HTMLImageElement, src: string): Promise<void> {
    const png = await rasterizeSvgDataUriToPng(src);
    if (!png || !img.isConnected) return;
    img.setAttribute('src', png);
}

async function rasterizeSvgDataUriToPng(svgDataUri: string): Promise<string | null> {
    if (
        typeof Image === 'undefined' ||
        typeof document === 'undefined' ||
        typeof document.createElement !== 'function'
    ) {
        return null;
    }

    return new Promise((resolve) => {
        try {
            const img = new Image();
            img.onload = () => {
                try {
                    const sourceWidth = img.naturalWidth;
                    const sourceHeight = img.naturalHeight;

                    if (!sourceWidth || !sourceHeight) {
                        resolve(null);
                        return;
                    }

                    const width = Math.max(1, Math.round(sourceWidth));
                    const height = Math.max(1, Math.round(sourceHeight));

                    const canvas = document.createElement('canvas') as HTMLCanvasElement;
                    if (!canvas) {
                        resolve(null);
                        return;
                    }

                    canvas.width = width;
                    canvas.height = height;

                    const ctx = canvas.getContext('2d');
                    if (!ctx) {
                        resolve(null);
                        return;
                    }

                    ctx.clearRect(0, 0, width, height);
                    ctx.drawImage(img, 0, 0, width, height);

                    try {
                        resolve(canvas.toDataURL('image/png'));
                    } catch (dataUrlError) {
                        logger.debug('SVG to PNG conversion failed in canvas.toDataURL', dataUrlError);
                        resolve(null);
                    }
                } finally {
                    img.onload = null;
                    img.onerror = null;
                }
            };
            img.onerror = () => {
                img.onload = null;
                img.onerror = null;
                resolve(null);
            };
            img.src = svgDataUri;
        } catch (error) {
            logger.debug('Failed to rasterize SVG data URI', error);
            resolve(null);
        }
    });
}
