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
import { CONSTANTS, HTML_CONSTANTS } from '../constants';
import { JoplinFileData, JoplinResource } from '../types';
import * as fs from 'fs/promises';
import * as path from 'path';
import { defaultStylesheet } from '../defaultStylesheet';

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
 * Creates a standardized error span for remote image errors.
 */
function createRemoteImageError(url: string, reason: string): string {
    return createErrorSpan(`Remote image ${url} ${reason}`);
}

// Image pre-processing for embedding is handled in src/html/imagePreProcessor.ts

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
 * @returns data:image/* base64 URI or an HTML error <span>
 */
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

/**
 * Downloads a remote image and converts it to a base64 data URI.
 * Validates Content-Type and size; on failure returns a user-visible error span.
 * @param url HTTP/HTTPS image URL
 * @returns data:image/* base64 URI or an HTML error <span>
 */
export async function downloadRemoteImageAsBase64(url: string): Promise<string> {
    try {
        const response = await withTimeout(
            fetch(url, {
                // Avoid leaking cookies/referrer in Electron/Hybrid environments
                credentials: 'omit',
                referrerPolicy: 'no-referrer',
                headers: {
                    'User-Agent': CONSTANTS.REMOTE_IMAGE_USER_AGENT,
                    Accept: 'image/*',
                },
            }),
            CONSTANTS.REMOTE_TIMEOUT_MS,
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
