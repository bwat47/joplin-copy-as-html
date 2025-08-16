import joplin from 'api';
import { JSDOM } from 'jsdom';
import { CONSTANTS, REGEX_PATTERNS } from './constants';
import { ImageDimensions, MarkdownSegment } from './types';

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
export function applyPreservedDimensions(html: string, dimensions: Map<string, any>): string {
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
export async function replaceAsync(str: string, regex: RegExp, asyncFn: Function): Promise<string> {
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
function extractFileBuffer(fileObj: any): Buffer {
	if (!fileObj) {
		throw new Error('No file object provided');
	}

	const buffer = fileObj.body || fileObj.data || fileObj.content || fileObj;

	if (!Buffer.isBuffer(buffer) && !(buffer instanceof Uint8Array)) {
		throw new Error('Invalid file buffer format');
	}

	return Buffer.isBuffer(buffer) ? buffer : Buffer.from(buffer);
}

export async function convertResourceToBase64(id: string): Promise<string> {
    try {
        const resource = await joplin.data.get(['resources', id], { fields: ['id', 'mime'] });
        if (!resource || !resource.mime.startsWith('image/')) {
            return `<span style="color: red; font-style: italic;">Resource ID ":/${id}" could not be found or is not an image.</span>`;
        }

        const fileObj = await Promise.race([
            joplin.data.get(['resources', id, 'file']),
            new Promise((_, reject) => setTimeout(() => reject(new Error('Timeout retrieving resource file')), CONSTANTS.BASE64_TIMEOUT_MS))
        ]);
		let fileBuffer: Buffer;
		try {
			fileBuffer = extractFileBuffer(fileObj);
		} catch (err) {
			const msg = err && err.message ? err.message : String(err);
			return `<span style="color: red; font-style: italic;">Resource ID ":/${id}" could not be retrieved: ${msg}</span>`;
		}
		const base64 = fileBuffer.toString('base64');
        return `data:${resource.mime};base64,${base64}`;
    } catch (err) {
        console.error(`[copy-as-html] Failed to convert resource :/${id} to base64:`, err);
        const msg = err && err.message ? err.message : err;
        return `<span style="color: red; font-style: italic;">Resource ID ":/${id}" could not be retrieved: ${msg}</span>`;
    }
}