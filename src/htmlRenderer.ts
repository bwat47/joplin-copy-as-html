import joplin from 'api';
import { JSDOM } from 'jsdom';
import { CONSTANTS, REGEX_PATTERNS } from './constants';
import { ImageDimensions, MarkdownSegment, JoplinFileData, JoplinResource } from './types';
import { validateEmbedImagesSetting } from './utils';
import { SETTINGS } from './constants';

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
 * Extracts width, height, and style from HTML <img> tags in markdown, preserving them in a map.
 * Optionally removes all images if embedImages is false.
 * @param markdown The markdown string to process.
 * @param embedImages Whether to preserve images or remove them.
 * @returns An object with processedMarkdown and a map of dimension info.
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
        return createErrorSpan(`Resource ID ":/${id}" is not a valid Joplin resource ID.`);
    }
    try {
        const resource = await joplin.data.get(['resources', id], { fields: ['id', 'mime'] }) as JoplinResource;
        if (!resource || !resource.mime.startsWith('image/')) {
            return createErrorSpan(`Resource ID ":/${id}" could not be found or is not an image.`);
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
            return createErrorSpan(`Resource ID ":/${id}" could not be retrieved: ${msg}`);
        }
        const base64 = fileBuffer.toString('base64');
        return `data:${resource.mime};base64,${base64}`;
    } catch (err) {
        console.error(`[copy-as-html] Failed to convert resource :/${id} to base64:`, err);
        const msg = err && err.message ? err.message : err;
        return createErrorSpan(`Resource ID ":/${id}" could not be retrieved: ${msg}`);
    }
}

/**
 * Converts a markdown selection to processed HTML, including image embedding and dimension preservation.
 * Returns the final HTML fragment.
 */
export async function processHtmlConversion(selection: string): Promise<string> {
    // Get Joplin global settings
    const globalSubEnabled = await joplin.settings.globalValue('markdown.plugin.sub');
    const globalSupEnabled = await joplin.settings.globalValue('markdown.plugin.sup');
    const globalMarkEnabled = await joplin.settings.globalValue('markdown.plugin.mark');
    const globalSoftBreaksEnabled = await joplin.settings.globalValue('markdown.plugin.softbreaks');
    const embedImages = validateEmbedImagesSetting(await joplin.settings.value(SETTINGS.EMBED_IMAGES));

    // Handle soft breaks
    let processedSelection = selection;
    if (!globalSoftBreaksEnabled) {
        processedSelection = processedSelection.replace(/([^\n])\n(?!\n)/g, '$1  \n');
    }

    // Extract and preserve image dimensions from HTML img tags
    const { processedMarkdown, dimensions } = extractImageDimensions(processedSelection, embedImages);

    // Create renderer with plugin options
    const { MarkupToHtml, MarkupLanguage } = require('@joplin/renderer');
    let pluginOptions: any = {};
    if (!globalSubEnabled) pluginOptions.sub = { enabled: false };
    if (!globalSupEnabled) pluginOptions.sup = { enabled: false };
    if (!globalMarkEnabled) pluginOptions.mark = { enabled: false };

    const markupToHtml = new MarkupToHtml({ pluginOptions });

    // Render processed markdown to HTML using MarkupLanguage.Markdown
    const renderOptions = {};
    const theme = {};
    const renderResult = await markupToHtml.render(MarkupLanguage.Markdown, processedMarkdown, theme, renderOptions);
    let html = renderResult.html;

    // Apply preserved dimensions to the rendered HTML
    if (embedImages) {
        html = applyPreservedDimensions(html, dimensions);
    }

    // If embedding images, convert Joplin resource URLs to base64
    if (embedImages) {
        // Replace src attribute for Joplin resource images with base64 data
        html = await replaceAsync(html, REGEX_PATTERNS.IMG_TAG_WITH_RESOURCE, async (match: string, id: string) => {
            if (!validateResourceId(id)) {
                return `<span style="color: red;">Resource ID “:/${id}” could not be found</span>`;
            }
            const base64Result = await convertResourceToBase64(id);
            if (base64Result.startsWith('data:image')) {
                return match.replace(/src=["'][^"']+["']/, `src="${base64Result}"`);
            } else {
                return base64Result;
            }
        });

        // Replace fallback [Image: :/resourceId] text with actual base64 image
        const fallbackRegex = /\[Image: :\/{1,2}([a-f0-9]{32})\]/gi;
        html = await replaceAsync(html, fallbackRegex, async (match: string, id: string) => {
            if (!id) return match;
            const base64Result = await convertResourceToBase64(id);
            if (base64Result.startsWith('data:image')) {
                return `<img src="${base64Result}" alt="" />`;
            } else {
                return base64Result;
            }
        });
    }

    // Use JSDOM to reliably extract #rendered-md content to get clean semantic HTML fragment
	// Regex parsing proved unreliable due to nested HTML complexity
	// Also remove source blocks (to prevent duplicate code blocks when pasting)
    let fragment = html.trim();
    try {
        const dom = new JSDOM(html);
        const renderedMd = dom.window.document.querySelector('#rendered-md');
        if (renderedMd) {
            // Remove all <pre class="joplin-source"> blocks
            const sourceBlocks = renderedMd.querySelectorAll('pre.joplin-source');
            sourceBlocks.forEach((el) => {
                if (el && typeof el.remove === 'function') {
                    el.remove();
                }
            });
            fragment = renderedMd.innerHTML.trim();
        } else {
            fragment = html.trim();
        }
    } catch (err) {
        console.error('[copy-as-html] jsdom extraction error:', err);
    }

    return fragment;
}