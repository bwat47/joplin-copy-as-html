/**
 * @fileoverview Asset Processor for HTML Renderer
 *
 * This module handles all logic related to static assets for the HTML conversion process.
 * This includes:
 * - Image dimension extraction and preservation
 * - Joplin resource to base64 conversion
 * - Remote resource to base64 conversion
 * - Filesystem access for user stylesheets
 * - Error handling and utility functions for assets
 *
 * @author bwat47
 * @since 1.1.8
 */

import joplin from 'api';
import { CONSTANTS, REGEX_PATTERNS, HTML_CONSTANTS } from '../constants';
import { ImageDimensions, MarkdownSegment, JoplinFileData, JoplinResource, RemoteImageData } from '../types';
import * as fs from 'fs/promises';
import * as path from 'path';
import { defaultStylesheet } from '../defaultStylesheet';

// HTML attribute escaper (kept narrow for alt attribute usage). Extracted for reuse & to avoid
// recreating the function within tight loops.
function escapeHtmlAttr(value: string): string {
    return (
        value
            // Do not double-encode existing entities: only replace '&' not starting an entity pattern
            .replace(/&(?![a-zA-Z0-9#]+;)/g, '&amp;')
            .replace(/"/g, '&quot;')
            .replace(/</g, '&lt;')
            .replace(/>/g, '&gt;')
    );
}

/**
 * Creates a consistent error HTML span for resource errors.
 * @param message The error message to display.
 * @param italic Whether to italicize the message.
 * @returns HTML span string.
 */
function createErrorSpan(message: string, italic = false): string {
    const style = `color: ${HTML_CONSTANTS.ERROR_COLOR};${italic ? ' font-style: italic;' : ''}`;
    return `<span style="${style}">${message}</span>`;
}

/**
 * Creates a standardized error span for resource errors.
 */
function createResourceError(id: string, reason: string): string {
    return createErrorSpan(`Resource ":/${id}" ${reason}`);
}

/**
 * Pre-processes markdown to handle HTML <img> tags before rendering.
 * It extracts dimensions (width, height) and replaces the <img> tag
 * with a markdown equivalent containing a unique key. This key is used later
 * by applyPreservedDimensions to restore the attributes.
 * Also removes all image tags if embedImages is false.
 * @param markdown The raw markdown string from the user selection.
 * @param embedImages A boolean to determine if images should be processed or stripped.
 * @returns An object containing the processed markdown and a map of dimension data.
 */
export function extractImageDimensions(
    markdown: string,
    embedImages: boolean,
    downloadRemoteImages: boolean = false
): {
    processedMarkdown: string;
    dimensions: Map<string, ImageDimensions>;
    remoteImages: Map<string, RemoteImageData>;
} {
    const dimensions = new Map<string, ImageDimensions>();
    const remoteImages = new Map<string, RemoteImageData>();
    let counter = 0;

    // Split markdown into code/non-code segments
    const codeBlockRegex = REGEX_PATTERNS.CODE_BLOCKS;
    const segments: MarkdownSegment[] = [];
    let lastIndex = 0;
    let match;

    while ((match = codeBlockRegex.exec(markdown)) !== null) {
        // Add non-code segment before this code block
        if (match.index > lastIndex) {
            segments.push({ type: 'text', content: markdown.slice(lastIndex, match.index) });
        }
        // Add code block segment
        segments.push({ type: 'code', content: match[0] });
        lastIndex = codeBlockRegex.lastIndex;
    }
    // Add any remaining non-code segment
    if (lastIndex < markdown.length) {
        segments.push({ type: 'text', content: markdown.slice(lastIndex) });
    }

    const processedSegments: MarkdownSegment[] = segments.map((segment) => {
        if (segment.type === 'code') {
            // Don't process code blocks - return as-is
            return segment;
        }

        let processedContent = segment.content;

        // If not embedding images, remove only Joplin resource images (remote images can remain)
        if (!embedImages) {
            // Remove HTML img tags with Joplin resource IDs (keep remote images)
            processedContent = processedContent.replace(REGEX_PATTERNS.HTML_IMG_WITH_RESOURCE, '');
            // Remove markdown image syntax for Joplin resources (remote markdown images will be unaffected)
            processedContent = processedContent.replace(REGEX_PATTERNS.MARKDOWN_IMG, '');
        } else {
            // Only process HTML img tags that contain Joplin resource IDs in non-code segments
            const htmlImgRegex = REGEX_PATTERNS.HTML_IMG_WITH_RESOURCE;
            processedContent = processedContent.replace(htmlImgRegex, (match, attrs, resourceId) => {
                // Extract existing alt attribute
                const altMatch = attrs.match(/\balt\s*=\s*["']([^"']*)["']/i);
                const originalAlt = altMatch ? altMatch[1] : '';

                // Extract width and height attributes
                const widthMatch = attrs.match(/\bwidth\s*=\s*["']?([^"'\s>]+)["']?/i);
                const heightMatch = attrs.match(/\bheight\s*=\s*["']?([^"'\s>]+)["']?/i);
                if (widthMatch || heightMatch) {
                    const dimensionKey = `${CONSTANTS.DIMENSION_KEY_PREFIX}${counter}`;
                    dimensions.set(dimensionKey, {
                        width: widthMatch ? widthMatch[1] : undefined,
                        height: heightMatch ? heightMatch[1] : undefined,
                        resourceId: resourceId,
                        originalAlt: originalAlt,
                    });
                    const result = `![${dimensionKey}](:/${resourceId})`;
                    counter++;
                    return result;
                }
                // No dimensions to preserve, convert to standard markdown
                if (originalAlt) {
                    return `![${originalAlt}](:/${resourceId})`;
                }
                return `![](:/${resourceId})`;
            });

            // Process remote images if enabled
            if (downloadRemoteImages && embedImages) {
                // First process Markdown image syntax with remote URLs (avoid double-processing)
                const markdownRemoteImgRegex = /!\[([^\]]*)\]\((https?:\/\/[^)]+)\)/gi;
                processedContent = processedContent.replace(markdownRemoteImgRegex, (match, alt, url) => {
                    const placeholder = `REMOTE_${counter}`;

                    remoteImages.set(placeholder, {
                        originalUrl: url,
                        placeholder,
                        dimensions: {
                            width: undefined, // Markdown images don't have inline dimensions
                            height: undefined,
                            resourceId: url, // Use URL as identifier
                            originalAlt: alt || '',
                        },
                    });

                    counter++;
                    const result = `![${placeholder}](${url})`;
                    return result;
                });

                // Then process HTML <img> tags with remote URLs
                const remoteImgRegex = /<img([^>]*src=["'](https?:\/\/[^"']+)["'][^>]*)>/gi;
                processedContent = processedContent.replace(remoteImgRegex, (match, attrs, url) => {
                    const placeholder = `REMOTE_${counter}`;

                    // Extract dimensions and alt text
                    const widthMatch = attrs.match(/\bwidth\s*=\s*["']?([^"'\s>]+)["']?/i);
                    const heightMatch = attrs.match(/\bheight\s*=\s*["']?([^"'\s>]+)["']?/i);
                    const altMatch = attrs.match(/\balt\s*=\s*["']([^"']*)["']/i);

                    remoteImages.set(placeholder, {
                        originalUrl: url,
                        placeholder,
                        dimensions: {
                            width: widthMatch?.[1],
                            height: heightMatch?.[1],
                            resourceId: url, // Use URL as identifier
                            originalAlt: altMatch?.[1] || '',
                        },
                    });

                    counter++;
                    const result = `![${placeholder}](${url})`;
                    return result;
                });
            }
        }

        return { ...segment, content: processedContent };
    });

    // Recombine segments
    const processedMarkdown = processedSegments.map((seg) => seg.content).join('');

    return { processedMarkdown, dimensions, remoteImages };
}

/**
 * Applies preserved width and height attributes to <img> tags in HTML.
 * @param html The HTML string to process.
 * @param dimensions Map of dimension keys to attribute objects.
 * @param remoteImages Map of remote image data for dimension restoration.
 * @returns The HTML string with dimensions applied.
 */
export function applyPreservedDimensions(
    html: string,
    dimensions: Map<string, ImageDimensions>,
    remoteImages?: Map<string, RemoteImageData>
): string {
    // Handle Joplin resource dimensions
    for (const [dimensionKey, attrs] of dimensions) {
        // Find img tags that were created from our dimension markers
        const imgRegex = new RegExp(`<img([^>]*alt=["']${dimensionKey}["'][^>]*)>`, 'gi');

        html = html.replace(imgRegex, (match, existingAttrs) => {
            let newAttrs = existingAttrs;

            // Add width if preserved
            if (attrs.width && !newAttrs.includes('width=')) {
                newAttrs += ` width="${attrs.width}"`;
            }

            // Add height if preserved
            if (attrs.height && !newAttrs.includes('height=')) {
                newAttrs += ` height="${attrs.height}"`;
            }

            // Replace the dimension key with the original alt text
            const escapedPrefix = CONSTANTS.DIMENSION_KEY_PREFIX.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
            const originalAlt = attrs.originalAlt || '';
            newAttrs = newAttrs.replace(
                new RegExp(`alt\\s*=\\s*["']${escapedPrefix}\\d+["']`, 'i'),
                `alt="${escapeHtmlAttr(originalAlt)}"`
            );

            return `<img${newAttrs}>`;
        });
    }

    // Handle remote image dimensions
    if (remoteImages) {
        for (const [placeholder, remoteImageData] of remoteImages) {
            if (remoteImageData.dimensions) {
                const imgRegex = new RegExp(`<img([^>]*alt=["']${placeholder}["'][^>]*)>`, 'gi');

                html = html.replace(imgRegex, (match, existingAttrs) => {
                    let newAttrs = existingAttrs;

                    // Add width if preserved
                    if (remoteImageData.dimensions!.width && !newAttrs.includes('width=')) {
                        newAttrs += ` width="${remoteImageData.dimensions!.width}"`;
                    }

                    // Add height if preserved
                    if (remoteImageData.dimensions!.height && !newAttrs.includes('height=')) {
                        newAttrs += ` height="${remoteImageData.dimensions!.height}"`;
                    }

                    // Replace the placeholder with the original alt text
                    const originalAlt = remoteImageData.dimensions!.originalAlt || '';
                    newAttrs = newAttrs.replace(
                        new RegExp(`alt\\s*=\\s*["']${placeholder}["']`, 'i'),
                        `alt="${escapeHtmlAttr(originalAlt)}"`
                    );

                    return `<img${newAttrs}>`;
                });
            }
        }
    }

    return html;
}

/**
 * Asynchronously replaces matches of a regex in a string using an async function.
 * @param str The input string.
 * @param regex The regex to match.
 * @param asyncFn The async function to apply to each match.
 * @returns The processed string.
 */
export async function replaceAsync(
    str: string,
    regex: RegExp,
    asyncFn: (match: string, ...args: unknown[]) => Promise<string>
): Promise<string> {
    // Ensure we operate with a global regex to collect and replace all matches consistently
    const globalRegex = regex.global ? regex : new RegExp(regex.source, regex.flags + 'g');

    const promises: Promise<string>[] = [];
    str.replace(globalRegex, (match, ...args) => {
        promises.push(asyncFn(match, ...args));
        return match;
    });
    const data = await Promise.all(promises);
    let i = 0;
    return str.replace(globalRegex, () => data[i++]);
}

/**
 * Converts a Joplin resource (by ID) to a base64 data URL for embedding.
 * @param id The Joplin resource ID.
 * @returns A base64 data URL string or an error HTML span.
 * Safely extracts a Buffer from a Joplin file object returned by the API.
 * Accepts Buffer, Uint8Array, or compatible shapes on the file object.
 */
function extractFileBuffer(fileObj: JoplinFileData): Buffer {
    if (!fileObj) {
        throw new Error('No file object provided');
    }

    const buffer = fileObj.body || fileObj.data || fileObj.content || fileObj;

    if (!Buffer.isBuffer(buffer) && !(buffer instanceof Uint8Array)) {
        throw new Error('Invalid file buffer format');
    }

    return Buffer.isBuffer(buffer) ? buffer : Buffer.from(buffer);
}

/**
 * Validates that a string is a valid Joplin resource ID (32 hex characters).
 * @param id The resource ID to validate.
 * @returns True if valid, false otherwise.
 */
function validateResourceId(id: string): boolean {
    const idRegex = new RegExp(`^[a-f0-9]{${CONSTANTS.JOPLIN_RESOURCE_ID_LENGTH}}$`, 'i');
    return !!id && typeof id === 'string' && idRegex.test(id);
}

/**
 * Simple timeout wrapper that ensures cleanup
 */
async function withTimeout<T>(
    promise: Promise<T>,
    timeoutMs: number,
    errorMessage: string = 'Operation timed out'
): Promise<T> {
    let timeoutId: NodeJS.Timeout;

    const timeoutPromise = new Promise<never>((_, reject) => {
        timeoutId = setTimeout(() => reject(new Error(errorMessage)), timeoutMs);
    });

    try {
        return await Promise.race([promise, timeoutPromise]);
    } finally {
        clearTimeout(timeoutId);
    }
}

const pendingResourceRequests = new Map<string, Promise<string>>();

// Narrow unknown resource objects returned by the Joplin API (runtime validation)
function isMinimalJoplinResource(obj: unknown): obj is Pick<JoplinResource, 'id' | 'mime'> {
    return (
        !!obj &&
        typeof (obj as { id?: unknown }).id === 'string' &&
        typeof (obj as { mime?: unknown }).mime === 'string'
    );
}

async function getResourceWithDedupe(id: string): Promise<string> {
    if (pendingResourceRequests.has(id)) {
        return pendingResourceRequests.get(id)!;
    }

    const promise = convertResourceToBase64(id);
    pendingResourceRequests.set(id, promise);

    promise.finally(() => {
        pendingResourceRequests.delete(id);
    });

    return promise;
}

export async function convertResourceToBase64(id: string): Promise<string> {
    if (!validateResourceId(id)) {
        return createResourceError(id, 'is not a valid Joplin resource ID.');
    }
    try {
        const rawResource = await joplin.data.get(['resources', id], { fields: ['id', 'mime'] });

        // Not found: preserve existing combined not-found/not-image messaging
        if (!rawResource) {
            return createResourceError(id, 'could not be found or is not an image.');
        }

        // Validate shape before casting to avoid runtime crashes on unexpected data
        if (!isMinimalJoplinResource(rawResource)) {
            return createResourceError(id, 'metadata could not be retrieved');
        }

        if (!rawResource.mime.toLowerCase().startsWith('image/')) {
            return createResourceError(id, 'could not be found or is not an image.');
        }

        // Use timeout wrapper to ensure cleanup
        const fileObj = (await withTimeout(
            joplin.data.get(['resources', id, 'file']),
            CONSTANTS.BASE64_TIMEOUT_MS,
            'Timeout retrieving resource file'
        )) as JoplinFileData;
        let fileBuffer: Buffer;
        try {
            fileBuffer = extractFileBuffer(fileObj);

            // Check file size limits
            if (fileBuffer.length > CONSTANTS.MAX_IMAGE_SIZE_BYTES) {
                return createResourceError(
                    id,
                    `is too large (${Math.round(fileBuffer.length / 1024 / 1024)}MB). Maximum size: ${Math.round(CONSTANTS.MAX_IMAGE_SIZE_BYTES / 1024 / 1024)}MB`
                );
            } else if (fileBuffer.length > CONSTANTS.MAX_IMAGE_SIZE_WARNING) {
                console.warn(
                    `[copy-as-html] Large image detected: Resource :/${id} is ${Math.round(fileBuffer.length / 1024 / 1024)}MB`
                );
            }
        } catch (err) {
            const msg = err && err.message ? err.message : String(err);
            return createResourceError(id, `could not be retrieved: ${msg}`);
        }
        const base64 = fileBuffer.toString('base64');
        return `data:${rawResource.mime};base64,${base64}`;
    } catch (err) {
        console.error(`[copy-as-html] Failed to convert resource :/${id} to base64:`, err);
        const msg = err && err.message ? err.message : err;
        return createResourceError(id, `could not be retrieved: ${msg}`);
    }
}

export async function getUserStylesheet(): Promise<string> {
    const profileDir = await joplin.settings.globalValue('profileDir');
    // Guard: test mocks (or some environments) may return false/undefined.
    if (typeof profileDir !== 'string' || !profileDir) {
        return defaultStylesheet;
    }
    const cssPath = path.join(profileDir, 'copy-as-html-user.css');
    try {
        return await fs.readFile(cssPath, 'utf8');
    } catch {
        // If user file not found, return the bundled default stylesheet
        return defaultStylesheet;
    }
}

/**
 * Processes the HTML to embed images as base64.
 * @param html The HTML string to process.
 * @param embedImages If true, converts Joplin resource URLs to base64 data URIs
 * @returns HTML with embedded images or original HTML if embedImages is false
 */
export async function processEmbeddedImages(html: string, embedImages: boolean): Promise<string> {
    if (!embedImages) {
        return html;
    }

    // Replace src attribute for Joplin resource images with base64 data
    return await replaceAsync(html, REGEX_PATTERNS.IMG_TAG_WITH_RESOURCE, async (match: string, id: string) => {
        if (!validateResourceId(id)) {
            return createResourceError(id, 'could not be found');
        }
        const base64Result = await getResourceWithDedupe(id);
        if (base64Result.startsWith('data:image')) {
            return match.replace(/src=["'][^"']+["']/, `src="${base64Result}"`);
        } else {
            return base64Result;
        }
    });
}

/**
 * Helper function to escape regex special characters
 */
function escapeRegex(string: string): string {
    return string.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
}

/**
 * Creates a standardized error span for remote image errors.
 */
function createRemoteImageError(url: string, reason: string): string {
    return createErrorSpan(`Remote image ${url} ${reason}`);
}

/**
 * Downloads a remote image and converts it to base64.
 * @param url The remote image URL to download.
 * @returns A base64 data URL string or an error HTML span.
 */
async function downloadRemoteImageAsBase64(url: string): Promise<string> {
    try {
        const response = await withTimeout(
            fetch(url, {
                // Avoid leaking cookies/referrer in Electron/Hybrid environments
                credentials: 'omit',
                referrerPolicy: 'no-referrer',
                headers: {
                    'User-Agent': 'Mozilla/5.0 (compatible; Joplin Plugin)',
                    Accept: 'image/*',
                },
            }),
            CONSTANTS.BASE64_TIMEOUT_MS,
            'Remote image download timeout'
        );

        if (!response.ok) {
            return createRemoteImageError(url, `download failed: ${response.status} ${response.statusText}`);
        }

        const contentType = response.headers.get('content-type');
        if (!contentType?.startsWith('image/')) {
            return createRemoteImageError(url, `is not an image (Content-Type: ${contentType})`);
        }

        const arrayBuffer = await response.arrayBuffer();
        const buffer = Buffer.from(arrayBuffer);

        if (buffer.length > CONSTANTS.MAX_IMAGE_SIZE_BYTES) {
            return createRemoteImageError(
                url,
                `is too large (${Math.round(buffer.length / 1024 / 1024)}MB). Maximum size: ${Math.round(CONSTANTS.MAX_IMAGE_SIZE_BYTES / 1024 / 1024)}MB`
            );
        }

        if (buffer.length > CONSTANTS.MAX_IMAGE_SIZE_WARNING) {
            console.warn(`[copy-as-html] Large remote image: ${url} is ${Math.round(buffer.length / 1024 / 1024)}MB`);
        }

        const base64 = buffer.toString('base64');
        return `data:${contentType};base64,${base64}`;
    } catch (err) {
        console.error('[copy-as-html] Failed to download remote image:', url, err);
        const msg = err?.message || String(err);
        return createRemoteImageError(url, `download failed: ${msg}`);
    }
}

/**
 * Processes remote images in HTML by downloading and embedding them as base64.
 * @param html The HTML string to process.
 * @param remoteImages Map of placeholder keys to remote image data.
 * @returns HTML with remote images embedded or replaced with error messages.
 */
export async function processRemoteImages(html: string, remoteImages: Map<string, RemoteImageData>): Promise<string> {
    if (remoteImages.size === 0) return html;

    // Process all remote images concurrently
    const downloadPromises = Array.from(remoteImages.entries()).map(async ([, imageData]) => {
        const base64Result = await downloadRemoteImageAsBase64(imageData.originalUrl);
        return { imageData, base64Result };
    });

    const results = await Promise.all(downloadPromises);

    // Apply results to HTML
    for (const { imageData, base64Result } of results) {
        if (base64Result.startsWith('data:image')) {
            // Successful download - replace src with base64
            const srcRegex = new RegExp(`src=["']${escapeRegex(imageData.originalUrl)}["']`, 'gi');
            html = html.replace(srcRegex, `src="${base64Result}"`);
        } else {
            // Failed download - replace entire img tag with error span
            const imgRegex = new RegExp(`<img[^>]*src=["']${escapeRegex(imageData.originalUrl)}["'][^>]*>`, 'gi');
            html = html.replace(imgRegex, base64Result);
        }
    }

    return html;
}
