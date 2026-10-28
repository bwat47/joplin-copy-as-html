/**
 * @fileoverview Asset Processor for HTML Renderer
 *
 * This module handles asset-related logic for the HTML conversion process.
 * Responsibilities:
 * - Joplin resource to base64 conversion
 * - Remote image download to base64 (with Content-Type validation)
 * - Error handling and utility functions for assets
 */

import joplin from 'api';
import type { JoplinFileData, JoplinResource } from '../types';
import { MIMEType } from 'util';
import { logger } from '../logger';

const RESOURCE_FILE_TIMEOUT_MS = 5000;
const REMOTE_IMAGE_TIMEOUT_MS = 10000;
const MAX_IMAGE_SIZE_BYTES = 25 * 1024 * 1024;

/**
 * Extracts a Buffer from a Joplin file object returned by the API.
 * Desktop Joplin returns { body: Buffer | Uint8Array }.
 */
function extractFileBuffer(fileObj: JoplinFileData): Buffer {
    const data = fileObj?.body ?? fileObj;

    if (Buffer.isBuffer(data)) return data;
    if (data instanceof Uint8Array) return Buffer.from(data);

    throw new Error('Invalid file buffer format');
}

// Joplin resource ID: exactly 32 hex characters, e.g. 0123456789abcdef0123456789abcdef
const RESOURCE_ID_REGEX = /^[a-f0-9]{32}$/i;

/**
 * Validates that a string is a valid Joplin resource ID (32 hex characters).
 * @param id The resource ID to validate.
 * @returns True if valid, false otherwise.
 */
function validateResourceId(id: string): boolean {
    return RESOURCE_ID_REGEX.test(id);
}

/**
 * Formats a byte size as megabytes for logging.
 * @param bytes The size in bytes.
 * @returns Formatted string like "15MB".
 */
function formatMB(bytes: number): string {
    return `${Math.round(bytes / 1024 / 1024)}MB`;
}
/**
 * Rejects if a promise does not settle within the given time.
 * The underlying operation is not cancelled; its result is ignored after the timeout.
 * @param promise The operation to wait for.
 * @param ms Timeout in milliseconds.
 * @param message Error message used when the timeout elapses.
 * @returns The promise's result.
 */
async function withTimeout<T>(promise: Promise<T>, ms: number, message: string): Promise<T> {
    let timeoutId: ReturnType<typeof setTimeout> | undefined;
    const timeout = new Promise<never>((_, reject) => {
        timeoutId = setTimeout(() => reject(new Error(message)), ms);
    });

    try {
        return await Promise.race([promise, timeout]);
    } finally {
        clearTimeout(timeoutId);
    }
}

/**
 * Narrows unknown resource metadata returned by the Joplin API (runtime validation).
 * @param obj The value returned by the resource metadata request.
 * @returns True if it has a string id and mime, and a numeric or missing size.
 */
function isJoplinResource(obj: unknown): obj is JoplinResource {
    return (
        !!obj &&
        typeof (obj as { id?: unknown }).id === 'string' &&
        typeof (obj as { mime?: unknown }).mime === 'string' &&
        ['number', 'undefined'].includes(typeof (obj as { size?: unknown }).size)
    );
}

/**
 * Converts a Joplin resource ID (:/id) to a base64 data URI.
 * Validates the ID, ensures the resource is an image, enforces size limits.
 * @param id 32-character hex Joplin resource ID
 * @returns data:image/* base64 URI or null on failure
 */
export async function convertResourceToBase64(id: string): Promise<string | null> {
    if (!validateResourceId(id)) {
        logger.warn(`Invalid Joplin resource ID: :/${id}`);
        return null;
    }
    try {
        const rawResource: unknown = await joplin.data.get(['resources', id], { fields: ['id', 'mime', 'size'] });

        // Validate shape before use to avoid runtime crashes on unexpected data
        if (!isJoplinResource(rawResource)) {
            logger.warn(`Resource not found or metadata invalid: :/${id}`);
            return null;
        }

        const mimeType = normalizeImageMimeType(rawResource.mime);
        if (!mimeType) {
            logger.warn(`Resource is not a valid image type: :/${id} (${rawResource.mime})`);
            return null;
        }

        // Check size limits from metadata before loading the file.
        // Missing or non-positive sizes (legacy resources) are treated as unknown and allowed.
        const size = rawResource.size ?? 0;
        if (size > MAX_IMAGE_SIZE_BYTES) {
            logger.warn(`Resource too large: :/${id} is ${formatMB(size)} (max ${formatMB(MAX_IMAGE_SIZE_BYTES)})`);
            return null;
        }

        const fileObj = (await withTimeout(
            joplin.data.get(['resources', id, 'file']),
            RESOURCE_FILE_TIMEOUT_MS,
            'Timeout retrieving resource file'
        )) as JoplinFileData;

        const fileBuffer = extractFileBuffer(fileObj);
        const base64 = fileBuffer.toString('base64');
        return `data:${mimeType};base64,${base64}`;
    } catch (err) {
        logger.error(`Failed to convert resource :/${id} to base64:`, err);
        return null;
    }
}

// Data URI-safe image subtype, e.g. png, svg+xml, vnd.microsoft.icon.
// Valid MIME subtypes may also contain characters like '#' or '%', which would break a data URI.
const SAFE_IMAGE_SUBTYPE_REGEX = /^[a-z0-9.+-]+$/;

/**
 * Parses an image MIME type and reduces it to a lowercase type/subtype for a data URI, dropping parameters.
 * For example, IMAGE/SVG+XML; charset="utf-8" becomes image/svg+xml.
 * @param mimeType A Content-Type header or stored resource MIME type.
 * @returns The normalized image MIME type, or null if missing, malformed, or not an image.
 */
function normalizeImageMimeType(mimeType: string | null): string | null {
    if (!mimeType) return null;

    try {
        const mime = new MIMEType(mimeType);
        return mime.type === 'image' && SAFE_IMAGE_SUBTYPE_REGEX.test(mime.subtype) ? mime.essence : null;
    } catch {
        return null;
    }
}

/**
 * Validates a remote image response's status, Content-Type and declared Content-Length.
 * @param response The fetch response to validate.
 * @param url The requested URL (for logging).
 * @returns A data URI-safe Content-Type, or null if the response should be rejected.
 */
function validateRemoteImageHeaders(response: Response, url: string): string | null {
    if (!response.ok) {
        logger.warn(`Remote image download failed ${url}: ${response.status} ${response.statusText}`);
        return null;
    }

    const contentType = response.headers.get('content-type');
    const normalizedContentType = normalizeImageMimeType(contentType);
    if (!normalizedContentType) {
        logger.warn(`Remote content is not a valid image type ${url} (Content-Type: ${contentType})`);
        return null;
    }

    const contentLengthHeader = response.headers.get('content-length');
    const declaredSize = contentLengthHeader ? Number(contentLengthHeader) : NaN;
    if (!Number.isNaN(declaredSize) && declaredSize > MAX_IMAGE_SIZE_BYTES) {
        logger.warn(`Remote image too large ${url}: ${formatMB(declaredSize)} (max ${formatMB(MAX_IMAGE_SIZE_BYTES)})`);
        return null;
    }

    return normalizedContentType;
}

/**
 * Streams a response body into a Buffer, aborting if it exceeds the maximum image size.
 * @param reader Reader for the response body.
 * @param url The requested URL (for logging).
 * @returns The downloaded bytes, or null if the size limit was exceeded.
 */
async function readRemoteImageBody(
    reader: ReadableStreamDefaultReader<Uint8Array>,
    url: string
): Promise<Buffer | null> {
    const chunks: Buffer[] = [];
    let totalSize = 0;

    try {
        for (;;) {
            const { done, value } = await reader.read();
            if (done) break;
            if (!value) continue;

            const chunk = Buffer.from(value);
            if (totalSize + chunk.length > MAX_IMAGE_SIZE_BYTES) {
                await reader.cancel();
                logger.warn(
                    `Remote image exceeded maximum size during download ${url}: ${formatMB(totalSize + chunk.length)} (max ${formatMB(MAX_IMAGE_SIZE_BYTES)})`
                );
                return null;
            }

            totalSize += chunk.length;
            chunks.push(chunk);
        }

        return Buffer.concat(chunks);
    } finally {
        reader.releaseLock();
    }
}

/**
 * Downloads a remote image and converts it to a base64 data URI.
 * Validates Content-Type and size.
 * @param url HTTP/HTTPS image URL
 * @returns data:image/* base64 URI or null on failure
 */
export async function downloadRemoteImageAsBase64(url: string): Promise<string | null> {
    try {
        const response = await fetch(url, {
            // Avoid leaking cookies/referrer in Electron/Hybrid environments
            credentials: 'omit',
            referrerPolicy: 'no-referrer',
            headers: {
                Accept: 'image/*',
            },
            signal: AbortSignal.timeout(REMOTE_IMAGE_TIMEOUT_MS),
        });

        const contentType = validateRemoteImageHeaders(response, url);
        if (!contentType) {
            // Release the connection instead of leaving the unread body open.
            // Cancellation failures are irrelevant once the response is rejected.
            void response.body?.cancel().catch(() => undefined);
            return null;
        }

        // Streaming path for Chromium/Electron environments
        const reader = response.body?.getReader();
        if (!reader) {
            logger.warn(`Remote content body is not streamable: ${url}`);
            return null;
        }

        const buffer = await readRemoteImageBody(reader, url);
        if (!buffer) return null;

        const base64 = buffer.toString('base64');
        return `data:${contentType};base64,${base64}`;
    } catch (err) {
        logger.error('Failed to download remote image:', url, err);
        return null;
    }
}
