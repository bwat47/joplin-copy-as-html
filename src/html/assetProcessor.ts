/**
 * @fileoverview Asset Processor for HTML Renderer
 *
 * This module handles asset-related logic for the HTML conversion process.
 * Responsibilities:
 * - Joplin resource to base64 conversion
 * - Remote image download to base64 (with Content-Type validation)
 * - Filesystem access for user stylesheets
 * - Error handling and utility functions for assets
 *
 * @author bwat47
 * @since 1.1.8
 */

import joplin from 'api';
import { CONSTANTS, LINK_RESOURCE_MATCHERS, RESOURCE_ID_REGEX } from '../constants';
import { JoplinFileData, JoplinResource } from '../types';
import * as fs from 'fs/promises';
import * as path from 'path';
import { defaultStylesheet } from '../defaultStylesheet';
import { logger } from '../logger';

// Note: User-facing error messages are handled during DOM post-processing.
// Any return value that is not a data URI (doesn't begin with "data:image/") is treated as a failure
// and replaced with a generic "Image failed to load" text in domPostProcess.ts. We return `null` for
// errors so the type stays simple and there's no risk of colliding with real URLs.
export const EMBED_ERROR_TOKEN: null = null;

/**
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
    return typeof id === 'string' && id.length === 32 && RESOURCE_ID_REGEX.test(id);
}

/**
 * Formats a byte size as megabytes for logging.
 * @param bytes The size in bytes.
 * @returns Formatted string like "15MB".
 */
function formatMB(bytes: number): string {
    return `${Math.round(bytes / 1024 / 1024)}MB`;
}

// Narrow unknown resource objects returned by the Joplin API (runtime validation)
function isMinimalJoplinResource(obj: unknown): obj is Pick<JoplinResource, 'id' | 'mime'> {
    return (
        !!obj &&
        typeof (obj as { id?: unknown }).id === 'string' &&
        typeof (obj as { mime?: unknown }).mime === 'string'
    );
}

/**
 * Converts a Joplin resource ID (:/id) to a base64 data URI.
 * Validates the ID, ensures the resource is an image, enforces size limits,
 * and returns a user-visible error span on failure.
 * @param id 32-character hex Joplin resource ID
 * @returns data:image/* base64 URI or null on failure
 */
export async function convertResourceToBase64(id: string): Promise<string | null> {
    if (!validateResourceId(id)) {
        logger.warn(`Invalid Joplin resource ID: :/${id}`);
        return EMBED_ERROR_TOKEN;
    }
    try {
        const rawResource = await joplin.data.get(['resources', id], { fields: ['id', 'mime'] });

        if (!rawResource) {
            logger.warn(`Resource not found: :/${id}`);
            return EMBED_ERROR_TOKEN;
        }

        // Validate shape before casting to avoid runtime crashes on unexpected data
        if (!isMinimalJoplinResource(rawResource)) {
            logger.warn(`Resource metadata invalid for :/${id}`);
            return EMBED_ERROR_TOKEN;
        }

        if (!rawResource.mime.toLowerCase().startsWith('image/')) {
            logger.warn(`Resource is not an image: :/${id} (${rawResource.mime})`);
            return EMBED_ERROR_TOKEN;
        }

        // Fetch resource file with timeout
        const filePromise = joplin.data.get(['resources', id, 'file']);
        const timeoutPromise = new Promise<never>((_, reject) => {
            setTimeout(() => reject(new Error('Timeout retrieving resource file')), CONSTANTS.BASE64_TIMEOUT_MS);
        });
        const fileObj = (await Promise.race([filePromise, timeoutPromise])) as JoplinFileData;
        let fileBuffer: Buffer;
        try {
            fileBuffer = extractFileBuffer(fileObj);

            // Check file size limits
            if (fileBuffer.length > CONSTANTS.MAX_IMAGE_SIZE_BYTES) {
                logger.warn(
                    `Resource too large: :/${id} is ${formatMB(fileBuffer.length)} (max ${formatMB(CONSTANTS.MAX_IMAGE_SIZE_BYTES)})`
                );
                return EMBED_ERROR_TOKEN;
            } else if (fileBuffer.length > CONSTANTS.MAX_IMAGE_SIZE_WARNING) {
                logger.warn(`Large image detected: Resource :/${id} is ${formatMB(fileBuffer.length)}`);
            }
        } catch (err) {
            const msg = err && err.message ? err.message : String(err);
            logger.error(`Error retrieving resource file :/${id}: ${msg}`);
            return EMBED_ERROR_TOKEN;
        }
        const base64 = fileBuffer.toString('base64');
        return `data:${rawResource.mime};base64,${base64}`;
    } catch (err) {
        logger.error(`Failed to convert resource :/${id} to base64:`, err);
        return EMBED_ERROR_TOKEN;
    }
}

/**
 * Downloads a remote image and converts it to a base64 data URI.
 * Validates Content-Type and size; on failure returns a user-visible error span.
 * @param url HTTP/HTTPS image URL
 * @returns data:image/* base64 URI or null on failure
 */
export async function downloadRemoteImageAsBase64(url: string): Promise<string | null> {
    const controller = new AbortController();
    const AbortSignalWithTimeout = AbortSignal as typeof AbortSignal & {
        timeout(ms: number): AbortSignal;
        any(signals: AbortSignal[]): AbortSignal;
    };
    const timeoutSignal = AbortSignalWithTimeout.timeout(CONSTANTS.REMOTE_TIMEOUT_MS);
    const combinedSignal = AbortSignalWithTimeout.any([controller.signal, timeoutSignal]);

    try {
        const response = await fetch(url, {
            // Avoid leaking cookies/referrer in Electron/Hybrid environments
            credentials: 'omit',
            referrerPolicy: 'no-referrer',
            headers: {
                'User-Agent': CONSTANTS.REMOTE_IMAGE_USER_AGENT,
                Accept: 'image/*',
            },
            signal: combinedSignal,
        });

        if (!response.ok) {
            logger.warn(`Remote image download failed ${url}: ${response.status} ${response.statusText}`);
            return EMBED_ERROR_TOKEN;
        }

        const contentType = response.headers.get('content-type');
        const normalizedContentType = contentType?.toLowerCase();
        if (!normalizedContentType?.startsWith('image/')) {
            logger.warn(`Remote content is not an image ${url} (Content-Type: ${contentType})`);
            return EMBED_ERROR_TOKEN;
        }

        const contentLengthHeader = response.headers.get('content-length');
        if (contentLengthHeader) {
            const declaredSize = Number(contentLengthHeader);
            if (!Number.isNaN(declaredSize) && declaredSize > CONSTANTS.MAX_IMAGE_SIZE_BYTES) {
                logger.warn(
                    `Remote image too large ${url}: ${formatMB(declaredSize)} (max ${formatMB(CONSTANTS.MAX_IMAGE_SIZE_BYTES)})`
                );
                return EMBED_ERROR_TOKEN;
            }
        }

        const reader = response.body?.getReader();
        let buffer: Buffer;

        if (reader) {
            // Streaming path for Chromium/Electron environments
            const chunks: Buffer[] = [];
            let totalSize = 0;

            try {
                while (true) {
                    const { done, value } = await reader.read();
                    if (done) break;
                    if (!value) continue;

                    const chunk = Buffer.from(value);
                    if (totalSize + chunk.length > CONSTANTS.MAX_IMAGE_SIZE_BYTES) {
                        await reader.cancel();
                        logger.warn(
                            `Remote image exceeded maximum size during download ${url}: ${formatMB(totalSize + chunk.length)} (max ${formatMB(CONSTANTS.MAX_IMAGE_SIZE_BYTES)})`
                        );
                        return EMBED_ERROR_TOKEN;
                    }

                    totalSize += chunk.length;
                    chunks.push(chunk);
                }

                if (totalSize > CONSTANTS.MAX_IMAGE_SIZE_WARNING) {
                    logger.warn(`Large remote image: ${url} is ${formatMB(totalSize)}`);
                }

                buffer = Buffer.concat(chunks);
            } finally {
                reader.releaseLock();
            }
        } else {
            // Fallback for test environments or when streaming is unavailable
            const arrayBuffer = await response.arrayBuffer();
            buffer = Buffer.from(arrayBuffer);

            if (buffer.length > CONSTANTS.MAX_IMAGE_SIZE_BYTES) {
                controller.abort();
                logger.warn(
                    `Remote image too large ${url}: ${formatMB(buffer.length)} (max ${formatMB(CONSTANTS.MAX_IMAGE_SIZE_BYTES)})`
                );
                return EMBED_ERROR_TOKEN;
            }

            if (buffer.length > CONSTANTS.MAX_IMAGE_SIZE_WARNING) {
                logger.warn(`Large remote image: ${url} is ${formatMB(buffer.length)}`);
            }
        }

        const base64 = buffer.toString('base64');
        return `data:${contentType};base64,${base64}`;
    } catch (err) {
        logger.error('Failed to download remote image:', url, err);
        return EMBED_ERROR_TOKEN;
    } finally {
        if (!controller.signal.aborted) {
            controller.abort();
        }
    }
}

/**
 * Loads the user stylesheet from the profile directory if present; otherwise returns
 * the bundled default stylesheet. Used when exporting full HTML documents.
 */
export async function getUserStylesheet(): Promise<string> {
    const profileDir = await joplin.settings.globalValue('profileDir');
    if (typeof profileDir !== 'string' || !profileDir) {
        return defaultStylesheet;
    }
    const cssPath = path.join(profileDir, 'copy-as-html-user.css');
    try {
        return await fs.readFile(cssPath, 'utf8');
    } catch {
        return defaultStylesheet;
    }
}

/**
 * Build a map of original image URL -> embedded value (data URI or null),
 * based on plugin options. Only returns mappings for URLs we intend to embed.
 * - Joplin resources (:/id, joplin://resource/id) are embedded when `embedImages` is true.
 * - Remote http(s) images are embedded when both `embedImages` and `downloadRemoteImages` are true.
 */
export async function buildImageEmbedMap(
    urls: Set<string>,
    opts: { embedImages: boolean; downloadRemoteImages: boolean }
): Promise<Map<string, string | null>> {
    const out = new Map<string, string | null>();
    if (!urls.size || !opts.embedImages) return out;

    // Classify and dedupe
    const urlToId = new Map<string, string>();
    const joplinIds = new Set<string>();
    const remoteUrls = new Set<string>();

    for (const url of urls) {
        const m = LINK_RESOURCE_MATCHERS.map((rx) => url.match(rx)).find(Boolean) as RegExpMatchArray | undefined;
        if (m && m[1]) {
            urlToId.set(url, m[1]);
            joplinIds.add(m[1]);
            continue;
        }
        if (opts.downloadRemoteImages && /^https?:\/\//i.test(url)) {
            remoteUrls.add(url);
        }
    }

    // Fetch once per unique id/url
    const idResults = new Map<string, string | null>();
    const jobs: Array<Promise<void>> = [];

    for (const id of joplinIds) {
        jobs.push(
            convertResourceToBase64(id).then((val) => {
                idResults.set(id, val);
            })
        );
    }
    for (const url of remoteUrls) {
        jobs.push(
            downloadRemoteImageAsBase64(url).then((val) => {
                out.set(url, val);
            })
        );
    }

    await Promise.all(jobs);

    // Fan out ID results to all URL variants that referenced the same resource
    for (const [url, id] of urlToId) {
        const val = idResults.get(id);
        if (val !== undefined) out.set(url, val);
    }

    return out;
}
