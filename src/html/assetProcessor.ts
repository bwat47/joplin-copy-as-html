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
import { CONSTANTS, LINK_RESOURCE_MATCHERS } from '../constants';
import { JoplinFileData, JoplinResource } from '../types';
import * as fs from 'fs/promises';
import * as path from 'path';
import { defaultStylesheet } from '../defaultStylesheet';

// Note: User-facing error messages are handled during DOM post-processing.
// Any non-data URI value returned from the functions below will be treated as an error
// and replaced with a generic "Image failed to load" text in domPostProcess.ts.
// Use a Symbol as the error token to avoid collisions with real URLs.
export const EMBED_ERROR_TOKEN = Symbol('embed-error');

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
    const idRegex = new RegExp(`^[a-f0-9]{${CONSTANTS.JOPLIN_RESOURCE_ID_LENGTH}}$`, 'i');
    return !!id && typeof id === 'string' && idRegex.test(id);
}

/**
 * Simple timeout wrapper that ensures cleanup
 */
async function withTimeout<T>(
    promise: Promise<T>,
    timeoutMs: number,
    errorMessage: string = 'Operation timed out',
    onTimeout?: () => void
): Promise<T> {
    let timeoutId: NodeJS.Timeout;

    const timeoutPromise = new Promise<never>((_, reject) => {
        timeoutId = setTimeout(() => {
            try {
                onTimeout?.();
            } finally {
                reject(new Error(errorMessage));
            }
        }, timeoutMs);
    });

    try {
        return await Promise.race([promise, timeoutPromise]);
    } finally {
        clearTimeout(timeoutId);
    }
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
 * @returns data:image/* base64 URI or error symbol
 */
export async function convertResourceToBase64(id: string): Promise<string | symbol> {
    if (!validateResourceId(id)) {
        console.warn(`[copy-as-html] Invalid Joplin resource ID: :/${id}`);
        return EMBED_ERROR_TOKEN;
    }
    try {
        const rawResource = await joplin.data.get(['resources', id], { fields: ['id', 'mime'] });

        // Not found: preserve existing combined not-found/not-image messaging
        if (!rawResource) {
            console.warn(`[copy-as-html] Resource not found or not an image: :/${id}`);
            return EMBED_ERROR_TOKEN;
        }

        // Validate shape before casting to avoid runtime crashes on unexpected data
        if (!isMinimalJoplinResource(rawResource)) {
            console.warn(`[copy-as-html] Resource metadata invalid for :/${id}`);
            return EMBED_ERROR_TOKEN;
        }

        if (!rawResource.mime.toLowerCase().startsWith('image/')) {
            console.warn(`[copy-as-html] Resource is not an image: :/${id} (${rawResource.mime})`);
            return EMBED_ERROR_TOKEN;
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
                console.warn(
                    `[copy-as-html] Resource too large: :/${id} is ${Math.round(fileBuffer.length / 1024 / 1024)}MB (max ${Math.round(
                        CONSTANTS.MAX_IMAGE_SIZE_BYTES / 1024 / 1024
                    )}MB)`
                );
                return EMBED_ERROR_TOKEN;
            } else if (fileBuffer.length > CONSTANTS.MAX_IMAGE_SIZE_WARNING) {
                console.warn(
                    `[copy-as-html] Large image detected: Resource :/${id} is ${Math.round(fileBuffer.length / 1024 / 1024)}MB`
                );
            }
        } catch (err) {
            const msg = err && err.message ? err.message : String(err);
            console.error(`[copy-as-html] Error retrieving resource file :/${id}: ${msg}`);
            return EMBED_ERROR_TOKEN;
        }
        const base64 = fileBuffer.toString('base64');
        return `data:${rawResource.mime};base64,${base64}`;
    } catch (err) {
        console.error(`[copy-as-html] Failed to convert resource :/${id} to base64:`, err);
        return EMBED_ERROR_TOKEN;
    }
}

/**
 * Downloads a remote image and converts it to a base64 data URI.
 * Validates Content-Type and size; on failure returns a user-visible error span.
 * @param url HTTP/HTTPS image URL
 * @returns data:image/* base64 URI or error symbol
 */
export async function downloadRemoteImageAsBase64(url: string): Promise<string | symbol> {
    try {
        const controller = new AbortController();
        const response = await withTimeout(
            fetch(url, {
                // Avoid leaking cookies/referrer in Electron/Hybrid environments
                credentials: 'omit',
                referrerPolicy: 'no-referrer',
                headers: {
                    'User-Agent': CONSTANTS.REMOTE_IMAGE_USER_AGENT,
                    Accept: 'image/*',
                },
                signal: controller.signal,
            }),
            CONSTANTS.REMOTE_TIMEOUT_MS,
            'Remote image download timeout',
            () => controller.abort()
        );

        if (!response.ok) {
            console.warn(
                `[copy-as-html] Remote image download failed ${url}: ${response.status} ${response.statusText}`
            );
            return EMBED_ERROR_TOKEN;
        }

        const contentType = response.headers.get('content-type');
        if (!contentType?.startsWith('image/')) {
            console.warn(`[copy-as-html] Remote content is not an image ${url} (Content-Type: ${contentType})`);
            return EMBED_ERROR_TOKEN;
        }

        const contentLengthHeader = response.headers.get('content-length');
        if (contentLengthHeader) {
            const declaredSize = Number(contentLengthHeader);
            if (!Number.isNaN(declaredSize) && declaredSize > CONSTANTS.MAX_IMAGE_SIZE_BYTES) {
                console.warn(
                    `[copy-as-html] Remote image too large ${url}: ${Math.round(declaredSize / 1024 / 1024)}MB (max ${Math.round(
                        CONSTANTS.MAX_IMAGE_SIZE_BYTES / 1024 / 1024
                    )}MB)`
                );
                return EMBED_ERROR_TOKEN;
            }
        }

        const stream = response.body;
        if (!stream) {
            console.warn(`[copy-as-html] Remote image had no readable body: ${url}`);
            return EMBED_ERROR_TOKEN;
        }

        const chunks: Buffer[] = [];
        let totalSize = 0;
        const abortForSize = () => {
            if (!controller.signal.aborted) {
                controller.abort();
            }
        };

        const handleChunk = (chunk: Buffer | Uint8Array): boolean => {
            const bufferChunk = Buffer.isBuffer(chunk) ? chunk : Buffer.from(chunk);
            totalSize += bufferChunk.length;
            if (totalSize > CONSTANTS.MAX_IMAGE_SIZE_BYTES) {
                abortForSize();
                return false;
            }
            chunks.push(bufferChunk);
            return true;
        };

        const webStream = stream as
            | {
                  getReader?: () => {
                      read: () => Promise<{ done: boolean; value?: Uint8Array }>;
                      cancel: () => Promise<void>;
                      releaseLock?: () => void;
                  };
              }
            | undefined;
        if (typeof webStream?.getReader === 'function') {
            const reader = webStream.getReader();
            try {
                while (true) {
                    const { done, value } = await reader.read();
                    if (done) break;
                    if (!value) continue;
                    if (!handleChunk(value)) {
                        await reader.cancel();
                        console.warn(`[copy-as-html] Remote image exceeded maximum size during download: ${url}`);
                        return EMBED_ERROR_TOKEN;
                    }
                }
            } finally {
                reader.releaseLock?.();
            }
        } else if (Symbol.asyncIterator in stream) {
            const asyncIterable = stream as AsyncIterable<Uint8Array | Buffer> & { destroy?: (error?: Error) => void };
            try {
                for await (const chunk of asyncIterable) {
                    if (!handleChunk(chunk)) {
                        if (typeof asyncIterable.destroy === 'function') {
                            asyncIterable.destroy();
                        }
                        console.warn(`[copy-as-html] Remote image exceeded maximum size during download: ${url}`);
                        return EMBED_ERROR_TOKEN;
                    }
                }
            } catch (streamErr) {
                const msg = (streamErr as Error)?.message ?? String(streamErr);
                console.warn(`[copy-as-html] Remote image stream error ${url}: ${msg}`);
                return EMBED_ERROR_TOKEN;
            }
        } else {
            const arrayBuffer = await response.arrayBuffer();
            const buffer = Buffer.from(arrayBuffer);
            chunks.push(buffer);
            totalSize = buffer.length;
        }

        if (totalSize > CONSTANTS.MAX_IMAGE_SIZE_BYTES) {
            console.warn(
                `[copy-as-html] Remote image too large after download ${url}: ${Math.round(totalSize / 1024 / 1024)}MB (max ${Math.round(
                    CONSTANTS.MAX_IMAGE_SIZE_BYTES / 1024 / 1024
                )}MB)`
            );
            return EMBED_ERROR_TOKEN;
        }

        if (totalSize > CONSTANTS.MAX_IMAGE_SIZE_WARNING) {
            console.warn(`[copy-as-html] Large remote image: ${url} is ${Math.round(totalSize / 1024 / 1024)}MB`);
        }

        const buffer = chunks.length === 1 ? chunks[0] : Buffer.concat(chunks);
        const base64 = buffer.toString('base64');
        return `data:${contentType};base64,${base64}`;
    } catch (err) {
        console.error('[copy-as-html] Failed to download remote image:', url, err);
        return EMBED_ERROR_TOKEN;
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
 * Build a map of original image URL -> embedded value (data URI or error span),
 * based on plugin options. Only returns mappings for URLs we intend to embed.
 * - Joplin resources (:/id, joplin://resource/id) are embedded when `embedImages` is true.
 * - Remote http(s) images are embedded when both `embedImages` and `downloadRemoteImages` are true.
 */
export async function buildImageEmbedMap(
    urls: Set<string>,
    opts: { embedImages: boolean; downloadRemoteImages: boolean }
): Promise<Map<string, string | symbol>> {
    const out = new Map<string, string | symbol>();
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
    const idResults = new Map<string, string | symbol>();
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
