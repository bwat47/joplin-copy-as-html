import { logger } from '../logger';
import { convertResourceToBase64, downloadRemoteImageAsBase64 } from './assetProcessor';
import { isInsideCode } from './domHelpers';

/**
 * Replaces `element` with a red "Image failed to load" message.
 * @param element - Element to replace
 */
function replaceWithImageError(element: Element): void {
    const span = element.ownerDocument.createElement('span');
    span.textContent = 'Image failed to load';
    span.style.color = 'red';
    element.replaceWith(span);
}

/**
 * Replaces Joplin's broken resource placeholders with our custom error message.
 * Joplin renders broken images as a span with class "not-loaded-resource" containing a large placeholder image.
 * @param root - Content root to process
 */
export function replaceBrokenResourceSpans(root: HTMLElement): void {
    root.querySelectorAll('span.not-loaded-resource').forEach(replaceWithImageError);
}

/**
 * Removes Joplin resource images from the document.
 * @param root - Content root to process
 */
export function stripJoplinImages(root: HTMLElement): void {
    const imgs = Array.from(root.querySelectorAll('img'));
    for (const img of imgs) {
        if (isInsideCode(img)) continue;

        const src = img.getAttribute('src') || '';
        const resourceId = img.getAttribute('data-resource-id');
        const isJoplinSrc = /^:\//.test(src) || /^joplin:\/\/resource\//i.test(src);

        if (isJoplinSrc || resourceId) {
            img.remove();
        }
    }
}

/**
 * Iterates through images in the DOM and embeds them as base64 data URIs.
 * Embeds local Joplin resources and optionally downloads remote images.
 * @param root - Content root to process
 * @param downloadRemoteImages - Whether to download and embed remote images
 */
export async function embedImagesInDom(root: HTMLElement, downloadRemoteImages: boolean): Promise<void> {
    const images = Array.from(root.querySelectorAll('img'));
    logger.debug(`Found ${images.length} images to process`);

    const jobs: Promise<void>[] = [];

    for (const img of images) {
        if (isInsideCode(img)) continue;

        const resourceId = img.getAttribute('data-resource-id');
        const src = img.getAttribute('src') || '';

        // Case 1: Joplin Resource (local)
        if (resourceId) {
            jobs.push(
                convertResourceToBase64(resourceId).then((dataUri) => {
                    if (dataUri) {
                        img.setAttribute('src', dataUri);
                        logger.debug(`Embedded resource: ${resourceId}`);
                    } else {
                        replaceWithImageError(img);
                    }
                })
            );
        }
        // Case 2: Remote Image
        else if (/^https?:\/\//i.test(src) && downloadRemoteImages) {
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
 * Checks if a source is an SVG data URI.
 * @param src - Image source to check
 * @returns True if source is an SVG data URI
 */
function isSvgDataUri(src: string | null): boolean {
    return !!src && /^data:image\/svg\+xml/i.test(src.trim());
}

/**
 * Converts all SVG images in the document to PNG for better compatibility.
 * @param root - Content root to process
 */
export async function convertSvgImagesToPng(root: HTMLElement): Promise<void> {
    const svgImgs = Array.from(root.querySelectorAll('img'))
        .map((img) => ({ img, src: img.getAttribute('src') }))
        .filter(
            (item): item is { img: HTMLImageElement; src: string } => !isInsideCode(item.img) && isSvgDataUri(item.src)
        );

    const jobs = svgImgs.map(async ({ img, src }) => {
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
    if (typeof Image === 'undefined' || typeof document === 'undefined') {
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
                const width = sourceWidth * SCALE_FACTOR;
                const height = sourceHeight * SCALE_FACTOR;

                const canvas = document.createElement('canvas');
                canvas.width = width;
                canvas.height = height;

                const ctx = canvas.getContext('2d');
                if (!ctx) {
                    resolve(null);
                    return;
                }

                ctx.drawImage(img, 0, 0, width, height);

                resolve({
                    dataUrl: canvas.toDataURL('image/png'),
                    originalWidth: sourceWidth,
                    originalHeight: sourceHeight,
                });
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
