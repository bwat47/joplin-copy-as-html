import { logger } from '../logger';
import type { PngScale } from '../types';
import { convertResourceToBase64, downloadRemoteImageAsBase64 } from './assetProcessor';
import { isInsideCode } from './domHelpers';

// Conservative caps on canvas dimensions to limit memory use during SVG rasterization.
// These are the plugin's own limits, set below Chromium's maximums.
// At the pixel-area cap, one RGBA buffer uses 256 MiB.
const MAX_CANVAS_SIDE = 16_384;
const MAX_CANVAS_AREA = 8_192 * 8_192;
const PNG_DATA_URL_PREFIX = 'data:image/png;base64,';

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
        const isJoplinSrc = src.startsWith(':/') || /^joplin:\/\/resource\//i.test(src);

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
 * Lowers `requested` if needed so a `width`×`height` image's canvas stays within the plugin's
 * side and pixel-area caps (`MAX_CANVAS_SIDE`, `MAX_CANVAS_AREA`) while preserving its aspect ratio.
 * Expects positive dimensions; callers reject zero-sized images before calling.
 */
export function fitPngScale(width: number, height: number, requested: number): number {
    const limit = Math.min(
        MAX_CANVAS_SIDE / width,
        MAX_CANVAS_SIDE / height,
        Math.sqrt(MAX_CANVAS_AREA / (width * height))
    );
    return Math.min(requested, limit);
}

/**
 * Checks whether a canvas-encoded string is a valid non-empty PNG data URL.
 * Rejects failure markers such as `data:,` or empty payloads.
 */
function isValidPngDataUrl(dataUrl: string): boolean {
    return dataUrl.startsWith(PNG_DATA_URL_PREFIX) && dataUrl.length > PNG_DATA_URL_PREFIX.length;
}

/**
 * Converts all SVG images in the document to PNG for better compatibility.
 * @param root - Content root to process
 * @param pngScale - Requested PNG pixel scale relative to the SVG's natural dimensions
 */
export async function convertSvgImagesToPng(root: HTMLElement, pngScale: PngScale): Promise<void> {
    const svgImgs = Array.from(root.querySelectorAll('img'))
        .map((img) => ({ img, src: img.getAttribute('src') }))
        .filter(
            (item): item is { img: HTMLImageElement; src: string } => !isInsideCode(item.img) && isSvgDataUri(item.src)
        );

    const jobs = svgImgs.map(async ({ img, src }) => {
        try {
            const existingWidth = img.getAttribute('width');
            const existingHeight = img.getAttribute('height');

            const png = await rasterizeSvgDataUriToPng(src, pngScale);
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
 * @param requestedScale - Requested PNG pixel scale relative to the SVG's natural dimensions
 * @returns Object with PNG data URI and original dimensions, or null on failure
 * @remarks
 * Requires browser environment with Canvas API (Chromium 116+).
 * Returns null in Node.js/SSR environments or if rasterization fails.
 * Reduces `requestedScale` per image if needed to stay within the plugin's canvas memory caps.
 */
async function rasterizeSvgDataUriToPng(
    svgDataUri: string,
    requestedScale: PngScale
): Promise<{ dataUrl: string; originalWidth: number; originalHeight: number } | null> {
    if (typeof Image === 'undefined' || typeof document === 'undefined') {
        return null;
    }

    return new Promise((resolve) => {
        const img = new Image();

        const cleanup = () => {
            img.removeEventListener('load', handleLoad);
            img.removeEventListener('error', handleError);
        };

        const handleLoad = () => {
            try {
                const sourceWidth = img.naturalWidth;
                const sourceHeight = img.naturalHeight;

                if (!sourceWidth || !sourceHeight) {
                    resolve(null);
                    return;
                }

                const scale = fitPngScale(sourceWidth, sourceHeight, requestedScale);
                // Round down so fractional dimensions cannot exceed the pixel-area cap.
                const width = Math.max(1, Math.floor(sourceWidth * scale));
                const height = Math.max(1, Math.floor(sourceHeight * scale));

                const canvas = document.createElement('canvas');
                canvas.width = width;
                canvas.height = height;

                const ctx = canvas.getContext('2d');
                if (!ctx) {
                    resolve(null);
                    return;
                }

                ctx.drawImage(img, 0, 0, width, height);

                const dataUrl = canvas.toDataURL('image/png');
                if (!isValidPngDataUrl(dataUrl)) {
                    logger.debug('Canvas encoding returned an invalid PNG data URL');
                    resolve(null);
                    return;
                }

                resolve({
                    dataUrl,
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

        const handleError = () => {
            cleanup();
            resolve(null);
        };

        img.addEventListener('load', handleLoad);
        img.addEventListener('error', handleError);
        img.src = svgDataUri;
    });
}
