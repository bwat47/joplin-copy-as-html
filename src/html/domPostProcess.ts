import DOMPurify from 'dompurify';
import { HTML_CONSTANTS } from '../constants';
import { logger } from '../logger';
import { convertResourceToBase64, downloadRemoteImageAsBase64 } from './assetProcessor';

// ----------------------
// Sanitization Configuration
// ----------------------

const purifyInstance = DOMPurify;
let purifyHooksInstalled = false;

function ensurePurifyHooks(): void {
    if (purifyHooksInstalled) return;
    // Add security hook to only allow checkbox inputs
    purifyInstance.addHook('afterSanitizeAttributes', (node) => {
        if (node.tagName === 'INPUT') {
            const type = node.getAttribute('type')?.toLowerCase();
            if (type !== 'checkbox') node.remove();
        }
    });
    purifyHooksInstalled = true;
}

/**
 * Sanitizes HTML using DOMPurify with our security policy.
 * @param html - Raw HTML string to sanitize
 * @returns Sanitized HTML string
 */
function sanitizeHtml(html: string): string {
    ensurePurifyHooks();
    return purifyInstance.sanitize(html, {
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
}

// ----------------------
// DOM Transform Helpers
// ----------------------

/**
 * Removes non-image Joplin resource links and replaces them with their text content.
 * Links containing images are preserved.
 * @param doc - DOM document to process
 */
function stripJoplinLinks(doc: Document): void {
    doc.querySelectorAll('a[data-resource-id], a[href^=":/"], a[href^="joplin://resource/"]').forEach((link) => {
        // Don't modify links that contain images
        if (link.querySelector('img')) return;

        const text = link.textContent?.trim() || 'Resource';
        link.replaceWith(doc.createTextNode(text));
    });
}

/**
 * Removes Joplin resource images from the document.
 * @param doc - DOM document to process
 */
function stripJoplinImages(doc: Document): void {
    const imgs = Array.from(doc.querySelectorAll('img'));
    for (const img of imgs) {
        if (img.closest('pre, code')) continue;

        const src = img.getAttribute('src') || '';
        const resourceId = img.getAttribute('data-resource-id');
        const isJoplinSrc = /^:\//.test(src) || /^joplin:\/\/resource\//i.test(src);

        if (isJoplinSrc || resourceId) {
            img.remove();
        }
    }
}

/**
 * Removes joplin-source elements that duplicate code block content.
 * renderMarkup includes both the raw source (for RTE round-tripping) and
 * the highlighted version - we only want the highlighted one.
 * @param doc - DOM document to process
 */
function removeJoplinSourceElements(doc: Document): void {
    const sourceElements = doc.querySelectorAll('.joplin-source');
    if (sourceElements.length > 0) {
        logger.debug(`Removing ${sourceElements.length} joplin-source elements`);
        sourceElements.forEach((el) => el.remove());
    }
}

/**
 * Iterates through images in the DOM and embeds them as base64 data URIs.
 * Handles both local Joplin resources and remote images based on options.
 * @param doc - DOM document to process
 * @param options - Embedding options
 */
async function embedImagesInDom(
    doc: Document,
    options: { embedImages: boolean; downloadRemoteImages: boolean }
): Promise<void> {
    const images = Array.from(doc.querySelectorAll('img'));
    logger.debug(`Found ${images.length} images to process`);

    const jobs: Promise<void>[] = [];

    for (const img of images) {
        // Skip images inside code blocks
        if (img.closest('pre, code')) continue;

        const resourceId = img.getAttribute('data-resource-id');
        const src = img.getAttribute('src') || '';

        // Case 1: Joplin Resource (local)
        if (resourceId && options.embedImages) {
            jobs.push(
                convertResourceToBase64(resourceId).then((dataUri) => {
                    if (dataUri) {
                        img.setAttribute('src', dataUri);
                        logger.debug(`Embedded resource: ${resourceId}`);
                    } else {
                        // Replace with error placeholder
                        const span = doc.createElement('span');
                        span.textContent = HTML_CONSTANTS.IMAGE_LOAD_ERROR;
                        span.style.color = HTML_CONSTANTS.ERROR_COLOR;
                        img.replaceWith(span);
                    }
                })
            );
        }
        // Case 2: Remote Image
        else if (/^https?:\/\//i.test(src) && options.embedImages && options.downloadRemoteImages) {
            jobs.push(
                downloadRemoteImageAsBase64(src).then((dataUri) => {
                    if (dataUri) {
                        img.setAttribute('src', dataUri);
                        logger.debug(`Embedded remote image: ${src}`);
                    }
                    // For remote images, we leave the original URL on failure as it might still be reachable
                })
            );
        }
    }

    await Promise.all(jobs);
}

/**
 * Wraps top-level images in paragraph tags for consistent formatting.
 * @param doc - DOM document to process
 */
function wrapTopLevelImages(doc: Document): void {
    Array.from(doc.body.children)
        .filter((el) => el.tagName === 'IMG')
        .forEach((img) => {
            const p = doc.createElement('p');
            img.replaceWith(p);
            p.appendChild(img);
        });
}

/**
 * Checks if an element should skip rasterization (e.g., inside code blocks).
 * @param node - Element to check
 * @returns True if rasterization should be skipped
 */
function shouldSkipRasterization(node: Element): boolean {
    return !!node.closest('pre, code');
}

/**
 * Checks if a source is an SVG data URI.
 * @param src - Image source to check
 * @returns True if source is an SVG data URI
 */
function isSvgDataUri(src: string | null): boolean {
    return !!src && /^data:image\/svg\+xml/i.test(src.trim());
}

/**
 * Converts all SVG images in the document to PNG for better compatibility.
 * @param doc - DOM document to process
 */
async function convertSvgImagesToPng(doc: Document): Promise<void> {
    const svgImgs = Array.from(doc.querySelectorAll('img'))
        .map((img) => ({ img, src: img.getAttribute('src') }))
        .filter((item): item is { img: HTMLImageElement; src: string } => {
            return item.src !== null && isSvgDataUri(item.src);
        });

    const jobs = svgImgs.map(async ({ img, src }) => {
        if (shouldSkipRasterization(img)) return;

        try {
            const existingWidth = img.getAttribute('width');
            const existingHeight = img.getAttribute('height');

            const png = await rasterizeSvgDataUriToPng(src);
            if (!png) return;

            if (!img.isConnected) {
                logger.debug('SVG image became disconnected during rasterization, skipping');
                return;
            }

            img.setAttribute('src', png.dataUrl);

            // Set explicit dimensions to maintain original display size
            // Prefer existing attributes, otherwise use dimensions from rasterization (unscaled)
            if (!existingWidth && png.originalWidth) {
                img.setAttribute('width', String(png.originalWidth));
            }
            if (!existingHeight && png.originalHeight) {
                img.setAttribute('height', String(png.originalHeight));
            }
        } catch (err) {
            logger.debug('SVG rasterization failed', err);
        }
    });

    await Promise.all(jobs);
}

/**
 * Rasterizes an SVG data URI to a PNG data URI using the Canvas API.
 * @param svgDataUri - SVG image encoded as a data URI
 * @returns Object with PNG data URI and original dimensions, or null on failure
 * @remarks
 * Requires browser environment with Canvas API (Chromium 116+).
 * Returns null in Node.js/SSR environments or if rasterization fails.
 * Renders at 2x scale for sharper output on high-DPI displays.
 */
async function rasterizeSvgDataUriToPng(
    svgDataUri: string
): Promise<{ dataUrl: string; originalWidth: number; originalHeight: number } | null> {
    if (
        typeof Image === 'undefined' ||
        typeof document === 'undefined' ||
        typeof document.createElement !== 'function'
    ) {
        return null;
    }

    return new Promise((resolve) => {
        const img = new Image();

        const cleanup = () => {
            img.onload = null;
            img.onerror = null;
        };

        img.onload = () => {
            try {
                const sourceWidth = img.naturalWidth;
                const sourceHeight = img.naturalHeight;

                if (!sourceWidth || !sourceHeight) {
                    resolve(null);
                    return;
                }

                // Render at 2x scale for sharper output (especially on high-DPI displays)
                const SCALE_FACTOR = 2;
                const width = Math.max(1, Math.round(sourceWidth * SCALE_FACTOR));
                const height = Math.max(1, Math.round(sourceHeight * SCALE_FACTOR));

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
                    const dataUrl = canvas.toDataURL('image/png');
                    resolve({
                        dataUrl,
                        originalWidth: sourceWidth,
                        originalHeight: sourceHeight,
                    });
                } catch (dataUrlError) {
                    logger.debug('Canvas toDataURL failed', dataUrlError);
                    resolve(null);
                }
            } catch (err) {
                logger.debug('SVG rasterization failed', err);
                resolve(null);
            } finally {
                cleanup();
            }
        };

        img.onerror = () => {
            cleanup();
            resolve(null);
        };

        img.src = svgDataUri;
    });
}

// ----------------------
// Main Orchestrator
// ----------------------

interface PostProcessOptions {
    embedImages: boolean;
    downloadRemoteImages: boolean;
    convertSvgToPng: boolean;
}

/**
 * Post-processes rendered HTML with sanitization, resource cleanup, and image processing.
 *
 * @param html - Raw HTML string to process
 * @param opts - Processing configuration
 * @returns Sanitized and processed HTML string
 *
 * @remarks
 * Processing pipeline:
 * 1. Sanitize HTML with DOMPurify (removes scripts, dangerous attributes)
 * 2. Remove duplicate joplin-source elements from code blocks
 * 3. Remove non-image Joplin resource links (:/... or joplin://resource/...)
 * 4. Strip Joplin images if embedding is disabled
 * 5. Embed images (local and remote) as base64 if enabled
 * 6. Wrap top-level images in paragraph tags for consistent formatting
 * 7. Convert SVG data URIs to PNG (requires Canvas API)
 */
export async function postProcessHtml(
    html: string,
    opts: PostProcessOptions = {
        embedImages: true,
        downloadRemoteImages: false,
        convertSvgToPng: true,
    }
): Promise<string> {
    const sanitized = sanitizeHtml(html);

    // Parse into DOM
    const parser = new DOMParser();
    const doc = parser.parseFromString(`<body>${sanitized}</body>`, 'text/html');

    // Pipeline of transformations
    removeJoplinSourceElements(doc);
    stripJoplinLinks(doc);

    if (!opts.embedImages) {
        stripJoplinImages(doc);
    } else {
        await embedImagesInDom(doc, {
            embedImages: opts.embedImages,
            downloadRemoteImages: opts.downloadRemoteImages,
        });
    }

    wrapTopLevelImages(doc);

    if (opts.convertSvgToPng) {
        await convertSvgImagesToPng(doc);
    }

    return doc.body.innerHTML;
}
