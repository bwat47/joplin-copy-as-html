/* eslint-disable @typescript-eslint/no-require-imports */

/**
 * @fileoverview HTML Renderer - Converts markdown to clean, portable HTML
 *
 * This module handles the complex process of converting Joplin markdown to portable HTML:
 *
 * Key Features:
 * 1. Respects all Joplin global markdown plugin settings
 * 2. Extracts and preserves image dimensions from rich text editor
 * 3. Embeds images as base64 or strips them based on user preference
 * 4. Removes Joplin-specific elements for cross-application compatibility
 * 5. Handles resource loading with timeout and deduplication
 *
 * The rendering process:
 * - Pre-processes HTML img tags to preserve dimensions
 * - Configures markdown-it to match Joplin's behavior
 * - Converts Joplin resources to base64 data URLs
 * - Cleans up output using JSDOM for semantic HTML
 * - Optionally wraps as full HTML document with custom CSS
 *
 * @author bwat47
 * @since 1.0.0
 */

import joplin from 'api';
import { JSDOM } from 'jsdom';
import {
    CONSTANTS,
    REGEX_PATTERNS,
    SETTINGS,
    JOPLIN_SETTINGS,
    HTML_CONSTANTS,
    PLUGIN_DEFAULTS,
    LINK_RESOURCE_MATCHERS,
} from './constants';
import { ImageDimensions, MarkdownSegment, JoplinFileData, JoplinResource, HtmlOptions } from './types';
import { validateHtmlSettings, safeGetGlobalSetting } from './utils';
import { safePluginUse, loadPluginsConditionally } from './pluginUtils';
import * as fs from 'fs/promises';
import * as path from 'path';
import MarkdownIt from 'markdown-it';
import markdownItMark = require('markdown-it-mark');
import markdownItIns = require('markdown-it-ins');
import markdownItSub = require('markdown-it-sub');
import markdownItSup = require('markdown-it-sup');
// Import additional plugins with try-catch to prevent conflicts
let markdownItAbbr: unknown;
let markdownItDeflist: unknown;
let markdownItEmoji: unknown;
let markdownItFootnote: unknown;
let markdownItMultimdTable: unknown;
let markdownItTocDoneRight: unknown;
let markdownItTaskLists: unknown;

try {
    markdownItAbbr = require('markdown-it-abbr');
} catch (e) {
    console.warn('[copy-as-html] markdown-it-abbr not available:', e);
}

try {
    markdownItDeflist = require('markdown-it-deflist');
} catch (e) {
    console.warn('[copy-as-html] markdown-it-deflist not available:', e);
}

try {
    markdownItEmoji = require('markdown-it-emoji');
} catch (e) {
    console.warn('[copy-as-html] markdown-it-emoji not available:', e);
}

try {
    markdownItFootnote = require('markdown-it-footnote');
} catch (e) {
    console.warn('[copy-as-html] markdown-it-footnote not available:', e);
}

try {
    markdownItMultimdTable = require('markdown-it-multimd-table');
} catch (e) {
    console.warn('[copy-as-html] markdown-it-multimd-table not available:', e);
}

try {
    markdownItTocDoneRight = require('markdown-it-toc-done-right');
} catch (e) {
    console.warn('[copy-as-html] markdown-it-toc-done-right not available:', e);
}

try {
    markdownItTaskLists = require('markdown-it-task-lists');
} catch (e) {
    console.warn('[copy-as-html] markdown-it-task-lists not available:', e);
}

import { defaultStylesheet } from './defaultStylesheet';

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
    embedImages: boolean
): { processedMarkdown: string; dimensions: Map<string, ImageDimensions> } {
    const dimensions = new Map<string, ImageDimensions>();
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

        // If not embedding images, remove all image references
        if (!embedImages) {
            // Remove HTML img tags
            processedContent = processedContent.replace(REGEX_PATTERNS.HTML_IMG, '');
            // Remove markdown image syntax for Joplin resources (more precise)
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
        }

        return { ...segment, content: processedContent };
    });

    // Recombine segments
    const processedMarkdown = processedSegments.map((seg) => seg.content).join('');

    return { processedMarkdown, dimensions };
}

/**
 * Applies preserved width and height attributes to <img> tags in HTML.
 * @param html The HTML string to process.
 * @param dimensions Map of dimension keys to attribute objects.
 * @returns The HTML string with dimensions applied.
 */
export function applyPreservedDimensions(html: string, dimensions: Map<string, ImageDimensions>): string {
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
            newAttrs = newAttrs.replace(new RegExp(`alt\\s*=\\s*["']${escapedPrefix}\\d+["']`), `alt="${originalAlt}"`);

            return `<img${newAttrs}>`;
        });
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
    const promises: Promise<string>[] = [];
    str.replace(regex, (match, ...args) => {
        promises.push(asyncFn(match, ...args));
        return match;
    });
    const data = await Promise.all(promises);
    return str.replace(regex, () => data.shift());
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
        const resource = (await joplin.data.get(['resources', id], { fields: ['id', 'mime'] })) as JoplinResource;
        if (!resource || !resource.mime.startsWith('image/')) {
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
        return `data:${resource.mime};base64,${base64}`;
    } catch (err) {
        console.error(`[copy-as-html] Failed to convert resource :/${id} to base64:`, err);
        const msg = err && err.message ? err.message : err;
        return createResourceError(id, `could not be retrieved: ${msg}`);
    }
}

/**
 * Converts a markdown selection to processed HTML.
 * This includes embedding images as base64, preserving image dimensions,
 * and cleaning the final HTML for portability.
 * @param selection The markdown string selected by the user.
 * @param options HTML processing options, including embedImages and exportFullHtml settings.
 * @returns A promise that resolves to the final HTML string (either a fragment or a full document).
 */
export async function processHtmlConversion(selection: string, options?: HtmlOptions): Promise<string> {
    // Get HTML settings if not provided
    if (!options) {
        const htmlSettings = {
            embedImages: await joplin.settings.value(SETTINGS.EMBED_IMAGES),
            exportFullHtml: await joplin.settings.value(SETTINGS.EXPORT_FULL_HTML),
        };
        options = validateHtmlSettings(htmlSettings);
    }

    // Get Joplin global settings with safe fallbacks
    const globalSubEnabled = await safeGetGlobalSetting(JOPLIN_SETTINGS.SUB);
    const globalSupEnabled = await safeGetGlobalSetting(JOPLIN_SETTINGS.SUP);
    const globalMarkEnabled = await safeGetGlobalSetting(JOPLIN_SETTINGS.MARK);
    const globalInsEnabled = await safeGetGlobalSetting(JOPLIN_SETTINGS.INSERT);
    const globalSoftBreaksEnabled = await safeGetGlobalSetting(JOPLIN_SETTINGS.SOFT_BREAKS);
    const globalTypographerEnabled = await safeGetGlobalSetting(JOPLIN_SETTINGS.TYPOGRAPHER);
    const globalAbbrEnabled = await safeGetGlobalSetting(JOPLIN_SETTINGS.ABBR);
    const globalDeflistEnabled = await safeGetGlobalSetting(JOPLIN_SETTINGS.DEFLIST);
    const globalEmojiEnabled = await safeGetGlobalSetting(JOPLIN_SETTINGS.EMOJI);
    const globalFootnoteEnabled = await safeGetGlobalSetting(JOPLIN_SETTINGS.FOOTNOTE);
    const globalMultimdTableEnabled = await safeGetGlobalSetting(JOPLIN_SETTINGS.MULTITABLE);
    const globalTocEnabled = await safeGetGlobalSetting(JOPLIN_SETTINGS.TOC);
    const globalLinkifyEnabled = await safeGetGlobalSetting(JOPLIN_SETTINGS.LINKIFY);

    // Extract and preserve image dimensions from HTML img tags
    const { processedMarkdown, dimensions } = extractImageDimensions(selection, options.embedImages);

    // Render with a local markdown-it instance for full control
    const md = new MarkdownIt({
        html: true,
        linkify: !!globalLinkifyEnabled,
        // Invert the soft breaks setting:
        // Joplin's "Enable soft breaks" means "do NOT insert <br> for single newlines".
        // markdown-it's `breaks: true` option DOES insert <br> tags.
        // So, we invert the Joplin setting to get the correct markdown-it behavior.
        breaks: !globalSoftBreaksEnabled,
        typographer: !!globalTypographerEnabled,
    });

    // Configure linkify to only handle HTTP/HTTPS URLs and mailto (matching Joplin's behavior)
    if (globalLinkifyEnabled) {
        md.linkify.set({
            fuzzyLink: false, // Disable fuzzy linking (URLs without protocol)
            fuzzyEmail: false, // Disable automatic email detection (we'll use explicit mailto:)
            fuzzyIP: false, // Disable IP address linking
        });

        // Only allow specific schemes by re-adding them explicitly
        md.linkify.add('http:', {
            validate: /^\/\/.*/,
        });
        md.linkify.add('https:', {
            validate: /^\/\/.*/,
        });
        md.linkify.add('mailto:', {
            validate:
                /^[a-zA-Z0-9.!#$%&'*+/=?^_`{|}~-]+@[a-zA-Z0-9](?:[a-zA-Z0-9-]{0,61}[a-zA-Z0-9])?(?:\.[a-zA-Z0-9](?:[a-zA-Z0-9-]{0,61}[a-zA-Z0-9])?)*/,
        });
    }

    // Load plugins conditionally based on Joplin's global settings
    loadPluginsConditionally(md, [
        { enabled: globalMarkEnabled, plugin: markdownItMark, name: 'markdown-it-mark' },
        { enabled: globalInsEnabled, plugin: markdownItIns, name: 'markdown-it-ins' },
        { enabled: globalSubEnabled, plugin: markdownItSub, name: 'markdown-it-sub' },
        { enabled: globalSupEnabled, plugin: markdownItSup, name: 'markdown-it-sup' },
        { enabled: globalAbbrEnabled, plugin: markdownItAbbr, name: 'markdown-it-abbr' },
        { enabled: globalDeflistEnabled, plugin: markdownItDeflist, name: 'markdown-it-deflist' },
        { enabled: globalFootnoteEnabled, plugin: markdownItFootnote, name: 'markdown-it-footnote' },
        { enabled: globalEmojiEnabled, plugin: markdownItEmoji, name: 'markdown-it-emoji' },
        {
            enabled: globalMultimdTableEnabled,
            plugin: markdownItMultimdTable,
            name: 'markdown-it-multimd-table',
            options: PLUGIN_DEFAULTS.MULTIMD_TABLE,
        },
        {
            enabled: globalTocEnabled,
            plugin: markdownItTocDoneRight,
            name: 'markdown-it-toc-done-right',
            options: {
                placeholder: HTML_CONSTANTS.TOC_PLACEHOLDER_PATTERN,
                slugify: (s: string) => s.trim().toLowerCase().replace(/\s+/g, '-'),
                containerId: HTML_CONSTANTS.TOC_CONTAINER_ID,
                listType: 'ul',
            },
        },
    ]);

    // Add task list support (checkboxes) - always enabled since it's core Joplin functionality
    if (markdownItTaskLists) {
        safePluginUse(
            md,
            markdownItTaskLists,
            {
                enabled: true,
                lineNumber: false,
            },
            'markdown-it-task-lists'
        );
    }

    // Replicate Joplin's non-image resource link marker so later cleanup still works
    const defaultLinkOpen =
        md.renderer.rules.link_open || ((tokens, idx, _opts, _env, self) => self.renderToken(tokens, idx, _opts));
    md.renderer.rules.link_open = function (tokens, idx, opts, env, self) {
        const token = tokens[idx];
        const hrefIdx = token.attrIndex('href');
        if (hrefIdx >= 0) {
            const href = token.attrs![hrefIdx][1] || '';
            // Match :/id, :/id#..., :/id?..., and joplin://resource/id variants
            const m = LINK_RESOURCE_MATCHERS.map((rx) => href.match(rx)).find(Boolean);
            if (m) token.attrPush(['data-resource-id', m[1]]);
        }
        return defaultLinkOpen(tokens, idx, opts, env, self);
    };
    let html = md.render(processedMarkdown);

    // Apply preserved dimensions to the rendered HTML
    if (options.embedImages) {
        html = applyPreservedDimensions(html, dimensions);
    }

    // If embedding images, convert Joplin resource URLs to base64
    if (options.embedImages) {
        // Replace src attribute for Joplin resource images with base64 data
        html = await replaceAsync(html, REGEX_PATTERNS.IMG_TAG_WITH_RESOURCE, async (match: string, id: string) => {
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

    // Clean up with JSDOM to produce a clean semantic fragment.
    // We no longer rely on #rendered-md; operate on the whole document.
    let fragment = html.trim();
    try {
        const dom = new JSDOM(html);
        const document = dom.window.document;
        // Non-image Joplin resource links -> title only.
        // Support both our data-resource-id and raw HTML href forms.
        document
            .querySelectorAll('a[data-resource-id], a[href^=":/"], a[href^="joplin://resource/"]')
            .forEach((link) => {
                if (link.querySelector('img')) return;
                const textContent = link.textContent?.trim() || 'Resource';
                const textNode = document.createTextNode(textContent);
                link.parentNode?.replaceChild(textNode, link);
            });
        fragment = document.body.innerHTML.trim();
    } catch (err) {
        console.error('[copy-as-html] JSDOM parsing failed:', err);
        fragment = html.trim();
    }

    // Optionally wrap as a full HTML document with user stylesheet. Note that Clipboard host (chromium/electron) will wrap again,
    // This produces a nested <html>/<body>. Tested targets (Outlook web/win32, Gmail, MS Word) accept this without issue.
    if (options.exportFullHtml) {
        const userStylesheet = await getUserStylesheet();
        const styleTag = userStylesheet ? `<style type="text/css">\n${userStylesheet}\n</style>` : '';
        fragment = `<!DOCTYPE html>
<html>
<head>
<meta charset="UTF-8">
${styleTag}
</head>
<body>
${fragment}
</body>
</html>`;
    }

    return fragment;
}

async function getUserStylesheet(): Promise<string> {
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
