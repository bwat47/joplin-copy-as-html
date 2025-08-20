import joplin from 'api';
import { JSDOM } from 'jsdom';
import { CONSTANTS, REGEX_PATTERNS, SETTINGS } from './constants';
import { ImageDimensions, MarkdownSegment, JoplinFileData, JoplinResource, HtmlOptions } from './types';
import { validateHtmlSettings } from './utils';
import * as fs from 'fs/promises';
import * as path from 'path';
import MarkdownIt = require('markdown-it');
import markdownItMark = require('markdown-it-mark');
import markdownItIns = require('markdown-it-ins');
import markdownItSub = require('markdown-it-sub');
import markdownItSup = require('markdown-it-sup');
// Import additional plugins with try-catch to prevent conflicts
let markdownItAbbr: any;
let markdownItDeflist: any;
let markdownItEmoji: any;
let markdownItFootnote: any;
let markdownItMultimdTable: any;
let markdownItTocDoneRight: any;

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

import { defaultStylesheet } from './defaultStylesheet';

/**
 * Creates a consistent error HTML span for resource errors.
 * @param message The error message to display.
 * @param italic Whether to italicize the message.
 * @returns HTML span string.
 */
function createErrorSpan(message: string, italic: boolean = false): string {
    const style = `color: red;${italic ? ' font-style: italic;' : ''}`;
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
 * It extracts dimensions (width, height, style) and replaces the <img> tag
 * with a markdown equivalent containing a unique key. This key is used later
 * by applyPreservedDimensions to restore the attributes.
 * Also removes all image tags if embedImages is false.
 * @param markdown The raw markdown string from the user selection.
 * @param embedImages A boolean to determine if images should be processed or stripped.
 * @returns An object containing the processed markdown and a map of dimension data.
 */
export function extractImageDimensions(markdown: string, embedImages: boolean): { processedMarkdown: string, dimensions: Map<string, ImageDimensions> } {
	const dimensions = new Map<string, ImageDimensions>();
    let counter = 0;
    
    // Split markdown into code/non-code segments
	const codeBlockRegex = REGEX_PATTERNS.CODE_BLOCKS;
	let segments: MarkdownSegment[] = [];
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
    
	const processedSegments: MarkdownSegment[] = segments.map(segment => {
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
				// Extract width, height, and style attributes
				const widthMatch = attrs.match(/\bwidth\s*=\s*["']?([^"'\s>]+)["']?/i);
				const heightMatch = attrs.match(/\bheight\s*=\s*["']?([^"'\s>]+)["']?/i);
				const styleMatch = attrs.match(/\bstyle\s*=\s*["']([^"']*)["']/i);
				if (widthMatch || heightMatch || styleMatch) {
					const dimensionKey = `${CONSTANTS.DIMENSION_KEY_PREFIX}${counter}`;
					dimensions.set(dimensionKey, {
						width: widthMatch ? widthMatch[1] : undefined,
						height: heightMatch ? heightMatch[1] : undefined,
						style: styleMatch ? styleMatch[1] : undefined,
						resourceId: resourceId
					});
					const result = `![${dimensionKey}](://${resourceId})`;
					counter++;
					return result;
				}
				// No dimensions to preserve, convert to standard markdown
				return `![](://${resourceId})`;
			});
         }
         
         return { ...segment, content: processedContent };
     });
     
     // Recombine segments
     const processedMarkdown = processedSegments.map(seg => seg.content).join('');
     
     return { processedMarkdown, dimensions };
}

/**
 * Applies preserved width, height, and style attributes to <img> tags in HTML.
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
			
			// Add or merge style if preserved
			if (attrs.style) {
				const existingStyleMatch = newAttrs.match(/style\s*=\s*["']([^"']*)["']/i);
				if (existingStyleMatch) {
					// Merge with existing style
					const existingStyle = existingStyleMatch[1];
					const mergedStyle = existingStyle.endsWith(';') ? existingStyle + attrs.style : existingStyle + ';' + attrs.style;
					newAttrs = newAttrs.replace(/style\s*=\s*["'][^"']*["']/i, `style="${mergedStyle}"`);
				} else {
					// Add new style attribute
					newAttrs += ` style="${attrs.style}"`;
				}
			}
			
			// Clean up the alt attribute (remove dimension marker)
			const escapedPrefix = CONSTANTS.DIMENSION_KEY_PREFIX.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
			newAttrs = newAttrs.replace(new RegExp(`alt\\s*=\\s*["']${escapedPrefix}\\d+["']`), 'alt=""');
			
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
	asyncFn: (match: string, ...args: any[]) => Promise<string>
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
    return !!id && typeof id === 'string' && /^[a-f0-9]{32}$/i.test(id);
}

export async function convertResourceToBase64(id: string): Promise<string> {
    if (!validateResourceId(id)) {
        return createResourceError(id, 'is not a valid Joplin resource ID.');
    }
    try {
        const resource = await joplin.data.get(['resources', id], { fields: ['id', 'mime'] }) as JoplinResource;
        if (!resource || !resource.mime.startsWith('image/')) {
            return createResourceError(id, 'could not be found or is not an image.');
        }

        // Timeout handling- underlying request is not cancelled, but doesn't seem to cause any issues
        const fileObj = await Promise.race([
            joplin.data.get(['resources', id, 'file']),
            new Promise((_, reject) => setTimeout(() => reject(new Error('Timeout retrieving resource file')), CONSTANTS.BASE64_TIMEOUT_MS))
        ]) as JoplinFileData;
        let fileBuffer: Buffer;
        try {
            fileBuffer = extractFileBuffer(fileObj);
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
 * Safe plugin loader that handles potential import issues
 */
function safePluginUse(md: MarkdownIt, plugin: any, options?: any): boolean {
    if (!plugin) {
        return false;
    }
    
    try {
        if (typeof plugin === 'function') {
            md.use(plugin, options);
        } else if (plugin && typeof plugin.default === 'function') {
            md.use(plugin.default, options);
        } else if (plugin && plugin.plugin && typeof plugin.plugin === 'function') {
            md.use(plugin.plugin, options);
        } else {
            console.warn('[copy-as-html] Could not load markdown-it plugin:', plugin);
            return false;
        }
        return true;
    } catch (err) {
        console.error('[copy-as-html] Error loading markdown-it plugin:', err);
        return false;
    }
}

/**
 * Safe function to get global setting value with fallback
 */
async function safeGetGlobalSetting(key: string, defaultValue: boolean = false): Promise<boolean> {
    try {
        const value = await joplin.settings.globalValue(key);
        return !!value;
    } catch (err) {
        console.warn(`[copy-as-html] Global setting '${key}' not found, using default:`, defaultValue);
        return defaultValue;
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
export async function processHtmlConversion(
    selection: string,
    options?: HtmlOptions
): Promise<string> {
    // Get HTML settings if not provided
    if (!options) {
        const htmlSettings = {
            embedImages: await joplin.settings.value(SETTINGS.EMBED_IMAGES),
            exportFullHtml: await joplin.settings.value(SETTINGS.EXPORT_FULL_HTML),
        };
        options = validateHtmlSettings(htmlSettings);
    }

    // Get Joplin global settings with safe fallbacks
    const globalSubEnabled = await safeGetGlobalSetting('markdown.plugin.sub');
    const globalSupEnabled = await safeGetGlobalSetting('markdown.plugin.sup');
    const globalMarkEnabled = await safeGetGlobalSetting('markdown.plugin.mark');
    const globalInsEnabled = await safeGetGlobalSetting('markdown.plugin.insert');
    const globalSoftBreaksEnabled = await safeGetGlobalSetting('markdown.plugin.softbreaks');
    const globalTypographerEnabled = await safeGetGlobalSetting('markdown.plugin.typographer');
    const globalAbbrEnabled = await safeGetGlobalSetting('markdown.plugin.abbr');
    const globalDeflistEnabled = await safeGetGlobalSetting('markdown.plugin.deflist');
    const globalEmojiEnabled = await safeGetGlobalSetting('markdown.plugin.emoji');
    const globalFootnoteEnabled = await safeGetGlobalSetting('markdown.plugin.footnote');
    // Try different possible keys for multimd-table
    const globalMultimdTableEnabled = 
        await safeGetGlobalSetting('markdown.plugin.multimdtable') ||
        await safeGetGlobalSetting('markdown.plugin.multimd-table') ||
        await safeGetGlobalSetting('markdown.plugin.table');
    const globalTocEnabled = await safeGetGlobalSetting('markdown.plugin.toc');

    // Handle soft breaks: rely on markdown-it `breaks` option (no pre-processing)
    const processedSelection = selection;

    // Extract and preserve image dimensions from HTML img tags
    const { processedMarkdown, dimensions } = extractImageDimensions(processedSelection, options.embedImages);

    // Render with a local markdown-it instance for full control
    const md = new MarkdownIt({
        html: true,
        linkify: true,
        // Joplin "Enable soft breaks" => DO NOT insert <br> for single newlines.
        // markdown-it `breaks` inserts <br> when true, so invert the flag.
        breaks: !globalSoftBreaksEnabled,
        typographer: !!globalTypographerEnabled,
    });

    // Apply plugins based on Joplin's global settings
    if (globalMarkEnabled) safePluginUse(md, markdownItMark);
    if (globalInsEnabled) safePluginUse(md, markdownItIns);
    if (globalSubEnabled) safePluginUse(md, markdownItSub);
    if (globalSupEnabled) safePluginUse(md, markdownItSup);
    if (globalAbbrEnabled && markdownItAbbr) safePluginUse(md, markdownItAbbr);
    if (globalDeflistEnabled && markdownItDeflist) safePluginUse(md, markdownItDeflist);
    if (globalEmojiEnabled && markdownItEmoji) safePluginUse(md, markdownItEmoji);
    if (globalFootnoteEnabled && markdownItFootnote) safePluginUse(md, markdownItFootnote);
    if (globalMultimdTableEnabled && markdownItMultimdTable) {
        safePluginUse(md, markdownItMultimdTable, {
            multiline: true,
            rowspan: true,
            headerless: true,
        });
    }
    if (globalTocEnabled && markdownItTocDoneRight) {
        safePluginUse(md, markdownItTocDoneRight, {
            placeholder: '\\[\\[toc\\]\\]',
            slugify: (s: string) => s.trim().toLowerCase().replace(/\s+/g, '-'),
            containerId: 'toc',
            listType: 'ul',
        });
    }

    // Replicate Joplin's non-image resource link marker so later cleanup still works
    const defaultLinkOpen = md.renderer.rules.link_open
        || ((tokens, idx, _opts, _env, self) => self.renderToken(tokens, idx, _opts));
    md.renderer.rules.link_open = function(tokens, idx, opts, env, self) {
        const token = tokens[idx];
        const hrefIdx = token.attrIndex('href');
        if (hrefIdx >= 0) {
            const href = token.attrs![hrefIdx][1] || '';
            // Match :/id, :/id#..., :/id?..., and joplin://resource/id variants
            const m =
                href.match(/^:\/([a-f0-9]{32})(?:$|[/?#])/i) ||
                href.match(/^joplin:\/\/resource\/([a-f0-9]{32})(?:$|[/?#])/i);
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
            const base64Result = await convertResourceToBase64(id);
            if (base64Result.startsWith('data:image')) {
                return match.replace(/src=["'][^"']+["']/, `src="${base64Result}"`);
            } else {
                return base64Result;
            }
        });
        // Joplin renderer fallback "[Image: :/id]" won't appear with markdown-it; safe to omit.
    }

    // Clean up with JSDOM to produce a clean semantic fragment.
    // We no longer rely on #rendered-md; operate on the whole document.
     let fragment = html.trim();
     try {
         const dom = new JSDOM(html);
         const document = dom.window.document;
         // Remove any Joplin source blocks if present (noop under markdown-it)
         document.querySelectorAll('pre.joplin-source').forEach(el => el.remove?.());
         // Remove any inline onclick handlers
         document.querySelectorAll('a[onclick]').forEach(link => link.removeAttribute('onclick'));
         // Non-image Joplin resource links -> title only.
         // Support both our data-resource-id and raw HTML href forms.
         document.querySelectorAll(
             'a[data-resource-id], a[href^=":/"], a[href^="joplin://resource/"]'
         ).forEach(link => {
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

    // Optionally wrap as a full HTML document with user stylesheet
    if (options.exportFullHtml) {
        const userStylesheet = await getUserStylesheet();
        const styleTag = userStylesheet
            ? `<style type="text/css">\n${userStylesheet}\n</style>`
            : '';
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
    const cssPath = path.join(profileDir, 'copy-as-html-user.css');
    try {
        return await fs.readFile(cssPath, 'utf8');
    } catch {
        // If user file not found, return the bundled default stylesheet
        return defaultStylesheet;
    }
}