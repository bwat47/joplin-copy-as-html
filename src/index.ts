import joplin from 'api';
import { SettingItemType, ToastType, MenuItemLocation } from 'api/types';
import * as MarkdownIt from 'markdown-it';
import { JSDOM } from 'jsdom';

const SETTINGS = {
	EMBED_IMAGES: 'embedImages',
	PRESERVE_SUPERSCRIPT: 'preserveSuperscript',
	PRESERVE_SUBSCRIPT: 'preserveSubscript',
	PRESERVE_EMPHASIS: 'preserveEmphasis',
	PRESERVE_BOLD: 'preserveBold',
	PRESERVE_HEADING: 'preserveHeading',
	HYPERLINK_BEHAVIOR: 'hyperlinkBehavior',
};

// Regex patterns for Joplin resource and image handling
const REGEX_PATTERNS = {
	CODE_BLOCKS: /(```[\s\S]*?```|`[^`\n]*`)/g,
	HTML_IMG: /<img[^>]*>/gi,
	MARKDOWN_IMG: /!\[[^\]]*\]\(:\/{1,2}[a-f0-9]{32}\)/gi,
	HTML_IMG_WITH_RESOURCE: /<img([^>]*src=["']:\/{1,2}([a-f0-9]{32})["'][^>]*)>/gi,
};

// TypeScript interfaces for type safety
interface ImageDimensions {
    width?: string;
    height?: string;
    style?: string;
    resourceId?: string;
}

interface MarkdownSegment {
    type: 'text' | 'code';
    content: string;
}

interface PluginOptions {
    sub?: { enabled: boolean };
    sup?: { enabled: boolean };
    mark?: { enabled: boolean };
}

// Constants for timeouts, formatting, and dimension keys
const CONSTANTS = {
    BASE64_TIMEOUT_MS: 5000,
    MIN_COLUMN_WIDTH: 3,
    DIMENSION_KEY_PREFIX: 'DIMENSION_'
};

/**
 * Extracts width, height, and style from HTML <img> tags in markdown, preserving them in a map.
 * Optionally removes all images if embedImages is false.
 * @param markdown The markdown string to process.
 * @param embedImages Whether to preserve images or remove them.
 * @returns An object with processedMarkdown and a map of dimension info.
 */
function extractImageDimensions(markdown: string, embedImages: boolean): { processedMarkdown: string, dimensions: Map<string, ImageDimensions> } {
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
function applyPreservedDimensions(html: string, dimensions: Map<string, any>): string {
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
			newAttrs = newAttrs.replace(/alt\s*=\s*["']DIMENSION_\d+["']/, 'alt=""');
			
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
async function replaceAsync(str: string, regex: RegExp, asyncFn: Function): Promise<string> {
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
async function convertResourceToBase64(id: string): Promise<string> {
	try {
		const resource = await joplin.data.get(['resources', id], { fields: ['id', 'mime'] });
		if (!resource || !resource.mime.startsWith('image/')) {
			return `<span style="color: red; font-style: italic;">Resource ID ":/${id}" could not be found or is not an image.</span>`;
		}

		const fileObj = await Promise.race([
			joplin.data.get(['resources', id, 'file']),
			new Promise((_, reject) => setTimeout(() => reject(new Error('Timeout retrieving resource file')), CONSTANTS.BASE64_TIMEOUT_MS))
		]);
		let fileBuffer;
		if (fileObj && fileObj.body) {
			fileBuffer = fileObj.body;
		} else if (fileObj && fileObj.data) {
			fileBuffer = fileObj.data;
		} else if (fileObj && fileObj.content) {
			fileBuffer = fileObj.content;
		} else {
			fileBuffer = fileObj;
		}

		const base64 = Buffer.from(fileBuffer).toString('base64');
		return `data:${resource.mime};base64,${base64}`;
	} catch (err) {
		console.error(`[copy-as-html] Failed to convert resource :/${id} to base64:`, err);
		const msg = err && err.message ? err.message : err;
		return `<span style="color: red; font-style: italic;">Resource ID ":/${id}" could not be retrieved: ${msg}</span>`;
	}
}

/**
 * Removes markdown backslash escapes from a string.
 * @param text The input string.
 * @returns The unescaped string.
 */
function unescape(text: string): string {
    return text.replace(/\\([*_~^`#])/g, '$1');
}

/**
 * Checks if a URL is an external HTTP/HTTPS link.
 * @param url The URL to check.
 * @returns True if the URL is an external HTTP/HTTPS link.
 */
function isExternalHttpUrl(url: string): boolean {
    return /^https?:\/\//i.test(url);
}

interface PlainTextOptions {
    preserveHeading: boolean;
    preserveEmphasis: boolean;
    preserveBold: boolean;
    preserveSuperscript: boolean;
    preserveSubscript: boolean;
	hyperlinkBehavior: 'title' | 'url' | 'markdown';
}

/**
 * Renders markdown-it tokens as plain text, with options for preserving formatting.
 * @param tokens The markdown-it token array.
 * @param listContext The current list context (for nested lists).
 * @param indentLevel The current indentation level.
 * @param options Formatting preservation options.
 * @returns The rendered plain text string.
 */
function renderPlainText(
    tokens: any[],
    listContext: any = null,
    indentLevel: number = 0,
    options: PlainTextOptions
): string {
     let result = '';
     let orderedIndex = listContext && listContext.type === 'ordered' ? listContext.index : 1;
     for (let i = 0; i < tokens.length; i++) {
         const t = tokens[i];
         if (t.type === 'table_open') {
			// Collect all tokens until table_close
			let tableTokens = [];
			let depth = 1;
			let j = i + 1;
			while (j < tokens.length && depth > 0) {
				if (tokens[j].type === 'table_open') depth++;
				if (tokens[j].type === 'table_close') depth--;
				tableTokens.push(tokens[j]);
				j++;
			}
			// Parse table rows
			let tableRows = [];
			let currentRow = [];
			let isHeaderRow = false;
			for (let k = 0; k < tableTokens.length; k++) {
				const tk = tableTokens[k];
				if (tk.type === 'thead_open') isHeaderRow = true;
				if (tk.type === 'thead_close') isHeaderRow = false;
				if (tk.type === 'tr_open') currentRow = [];
				if ((tk.type === 'th_open' || tk.type === 'td_open')) {
					// Collect cell content
					let cellContent = '';
					let l = k + 1;
					while (l < tableTokens.length && tableTokens[l].type !== 'th_close' && tableTokens[l].type !== 'td_close') {
						if (tableTokens[l].type === 'inline' && tableTokens[l].children) {
							cellContent += renderPlainText(tableTokens[l].children, listContext, indentLevel, options);
						} else if (tableTokens[l].type === 'text') {
							cellContent += tableTokens[l].content;
						}
						l++;
					}
					currentRow.push(cellContent.trim());
				}
				if (tk.type === 'tr_close') {
					tableRows.push({ cells: currentRow.slice(), isHeader: isHeaderRow });
				}
			}
			// Calculate max width for each column
			let colWidths = [];
			for (let r = 0; r < tableRows.length; r++) {
				let cells = tableRows[r].cells;
				for (let c = 0; c < cells.length; c++) {
					colWidths[c] = Math.max(colWidths[c] || 0, cells[c].length);
				}
			}
			// Helper to pad a cell
			function padCell(cell, width) {
				return cell + ' '.repeat(width - cell.length);
			}
			// Output table rows
			let headerDone = false;
			for (let r = 0; r < tableRows.length; r++) {
				let paddedCells = tableRows[r].cells.map((c, i) => padCell(c, colWidths[i]));
				result += paddedCells.join('  ') + '\n';
				if (tableRows[r].isHeader && !headerDone && tableRows.length > 1) {
					// Add separator after header
					let sepCells = colWidths.map(w => '-'.repeat(Math.max(CONSTANTS.MIN_COLUMN_WIDTH, w)));
					result += sepCells.join('  ') + '\n';
					headerDone = true;
				}
			}
			i = j - 1; // Skip all table tokens
			continue;
		}
		if (t.type === 'fence' || t.type === 'code_block') {
			// Output code block content only (no backticks)
			result += t.content + '\n';
		} else if (t.type === 'code_inline') {
			// Output inline code content only (no backticks)
			result += t.content;
		} else if (t.type === 'inline' && t.children) {
			result += renderPlainText(t.children, listContext, indentLevel, options);
		} else if (t.type === 'heading_open') {
			if (options.preserveHeading) {
				result += '#'.repeat(parseInt(t.tag[1])) + ' ';
			}
		} else if (t.type === 'heading_close') {
			result += '\n\n';
		} else if (t.type === 'bullet_list_open') {
            // Indent nested bullet lists by increasing indentLevel.
            // Top-level lists (indentLevel === 1) have no indent.
            // Nested lists (indentLevel > 1) are indented by one tab per level.
            let subTokens = [];
            let depth = 1;
            for (let j = i + 1; j < tokens.length; j++) {
                if (tokens[j].type === 'bullet_list_open') depth++;
                if (tokens[j].type === 'bullet_list_close') depth--;
                if (depth === 0) break;
                subTokens.push(tokens[j]);
            }
            result += renderPlainText(subTokens, { type: 'bullet' }, indentLevel + 1, options);
            i += subTokens.length;

        } else if (t.type === 'ordered_list_open') {
            // Indent nested ordered lists by increasing indentLevel.
            // Top-level lists (indentLevel === 1) have no indent.
            // Nested lists (indentLevel > 1) are indented by one tab per level.
            let subTokens = [];
            let depth = 1;
            let start = 1;
            if (t.attrs) {
                const startAttr = t.attrs.find(attr => attr[0] === 'start');
                if (startAttr) start = parseInt(startAttr[1]);
            }
            let idx = start;
            for (let j = i + 1; j < tokens.length; j++) {
                if (tokens[j].type === 'ordered_list_open') depth++;
                if (tokens[j].type === 'ordered_list_close') depth--;
                if (depth === 0) break;
                if (tokens[j].type === 'bullet_list_open' && depth === 1) {
                    let bulletDepth = 1;
                    subTokens.push(tokens[j]);
                    for (let k = j + 1; k < tokens.length; k++) {
                        if (tokens[k].type === 'bullet_list_open') bulletDepth++;
                        if (tokens[k].type === 'bullet_list_close') bulletDepth--;
                        subTokens.push(tokens[k]);
                        if (bulletDepth === 0) {
                            j = k;
                            break;
                        }
                    }
                    continue;
                }
                if (tokens[j].type === 'list_item_open' && depth === 1) {
                    tokens[j].orderedIndex = idx++;
                }
                subTokens.push(tokens[j]);
            }
            result += renderPlainText(subTokens, { type: 'ordered', index: start }, indentLevel + 1, options);
            i += subTokens.length;

        } else if (t.type === 'list_item_open') {
            // Only indent if indentLevel > 1 (top-level lists have no indent)
            const indent = indentLevel > 1 ? '\t'.repeat(indentLevel - 1) : '';
            if (listContext && listContext.type === 'ordered' && typeof t.orderedIndex !== 'undefined') {
                result += indent + t.orderedIndex + '. ';
            } else {
                result += indent + '- ';
            }
		} else if (t.type === 'link_open') {
			// Handle hyperlink behavior for external HTTP/HTTPS links
			const href = t.attrGet('href');
			if (href && isExternalHttpUrl(href)) {
				if (options.hyperlinkBehavior === 'url') {
					// Show URL only, skip the link text
					result += href;
					// Skip to link_close by finding matching close token
					let linkDepth = 1;
					while (i + 1 < tokens.length && linkDepth > 0) {
						i++;
						if (tokens[i].type === 'link_open') linkDepth++;
						if (tokens[i].type === 'link_close') linkDepth--;
					}
				} else if (options.hyperlinkBehavior === 'markdown') {
					// Show raw markdown format
					result += '[';
					// Continue processing normally to get link text, then add URL in link_close
				}
				// For 'title' behavior, continue processing normally (default behavior)
			}
		} else if (t.type === 'link_close') {
			// Handle closing of hyperlinks for markdown format
			const linkOpenIndex = tokens.slice(0, i).reverse().findIndex(token => token.type === 'link_open');
			if (linkOpenIndex !== -1) {
				const linkOpen = tokens[i - linkOpenIndex - 1];
				const href = linkOpen.attrGet('href');
				if (href && isExternalHttpUrl(href) && options.hyperlinkBehavior === 'markdown') {
					result += `](${href})`;
				}
			}
		} else if (t.type === 'em_open') {
			if (options.preserveEmphasis) result += t.markup;
		} else if (t.type === 'em_close') {
			if (options.preserveEmphasis) result += t.markup;
		} else if (t.type === 'strong_open') {
			if (options.preserveBold) result += t.markup;
		} else if (t.type === 'strong_close') {
			if (options.preserveBold) result += t.markup;
		} else if (t.type === 'text') {
			let txt = t.content;

			// Remove HTML <img> tags ONLY in text tokens
			txt = txt.replace(/<img[^>]*>/gi, '');

			// Collapse 3+ consecutive newlines to 2 ONLY in text tokens
			txt = txt.replace(/\n{3,}/g, '\n\n');

			if (options.preserveSuperscript) {
				txt = txt.replace(/\^([^\^]+)\^/g, '^$1^');
			} else {
				txt = txt.replace(/\^([^\^]+)\^/g, '$1');
			}
			if (options.preserveSubscript) {
				txt = txt.replace(/~([^~]+)~/g, '~$1~');
			} else {
				txt = txt.replace(/~([^~]+)~/g, '$1');
			}
			txt = unescape(txt);
			result += txt;
		} else if (t.type === 'softbreak' || t.type === 'hardbreak') {
			result += '\n';
		} else if (t.type === 'paragraph_close') {
			result += '\n\n';
		}
	}
	return result;
}

joplin.plugins.register({
	onStart: async function() {
		// Register plugin settings
		await joplin.settings.registerSection('copyAsHtml', {
			label: 'Copy as HTML',
			iconName: 'fas fa-copy',
		});

		await joplin.settings.registerSettings({
			[SETTINGS.EMBED_IMAGES]: {
				value: true,
				type: SettingItemType.Bool,
				section: 'copyAsHtml',
				public: true,
				label: 'Embed images as base64',
				description: 'If enabled, images in selection will be embedded as base64 in HTML output.',
			},
			[SETTINGS.PRESERVE_SUPERSCRIPT]: {
				value: false,
				type: SettingItemType.Bool,
				section: 'copyAsHtml',
				public: true,
				label: 'Preserve superscript characters (^TEST^)',
				description: 'If enabled, ^TEST^ will remain ^TEST^ in plain text output.',
			},
			[SETTINGS.PRESERVE_SUBSCRIPT]: {
				value: false,
				type: SettingItemType.Bool,
				section: 'copyAsHtml',
				public: true,
				label: 'Preserve subscript characters (~TEST~)',
				description: 'If enabled, ~TEST~ will remain ~TEST^ in plain text output.',
			},
			[SETTINGS.PRESERVE_EMPHASIS]: {
				value: false,
				type: SettingItemType.Bool,
				section: 'copyAsHtml',
				public: true,
				label: 'Preserve emphasis characters (*TEST* or _TEST_)',
				description: 'If enabled, *TEST* or _TEST_ will remain as-is in plain text output.',
			},
			[SETTINGS.PRESERVE_BOLD]: {
				value: false,
				type: SettingItemType.Bool,
				section: 'copyAsHtml',
				public: true,
				label: 'Preserve bold characters (**TEST** or __TEST__)',
				description: 'If enabled, **TEST** or __TEST__ will remain as-is in plain text output.',
			},
			[SETTINGS.PRESERVE_HEADING]: {
				value: false,
				type: SettingItemType.Bool,
				section: 'copyAsHtml',
				public: true,
				label: 'Preserve heading characters (## TEST)',
				description: 'If enabled, ## TEST will remain as-is in plain text output.',
			},
			[SETTINGS.HYPERLINK_BEHAVIOR]: {
				value: 'title',
				type: SettingItemType.String,
				isEnum: true,
				options: {
					'title': 'Link Title',
					'url': 'Link URL', 
					'markdown': 'Markdown Format'
				},
				section: 'copyAsHtml',
				public: true,
				label: 'Plain text hyperlink behavior',
				description: 'How external HTTP/HTTPS links should appear in plain text output.',
			},
		});

		// Register main HTML copy command
		await joplin.commands.register({
			name: 'copyAsHtml',
			label: 'Copy selection as HTML',
			iconName: 'fas fa-copy',
			when: 'markdownEditorVisible',
			execute: async () => {
				// Get selected markdown
				let selection = await joplin.commands.execute('editor.execCommand', { name: 'getSelection' });
				if (!selection) {
					await joplin.views.dialogs.showToast({ message: 'No text selected.', type: ToastType.Info });
					return;
				}

				// Get Joplin global settings
				const globalSubEnabled = await joplin.settings.globalValue('markdown.plugin.sub');
				const globalSupEnabled = await joplin.settings.globalValue('markdown.plugin.sup');
				const globalMarkEnabled = await joplin.settings.globalValue('markdown.plugin.mark');
				const globalSoftBreaksEnabled = await joplin.settings.globalValue('markdown.plugin.softbreaks');
				const embedImages = await joplin.settings.value(SETTINGS.EMBED_IMAGES);

				// Handle soft breaks
				if (!globalSoftBreaksEnabled) {
					selection = selection.replace(/([^\n])\n(?!\n)/g, '$1  \n');
				}

				// Extract and preserve image dimensions from HTML img tags
				const { processedMarkdown, dimensions } = extractImageDimensions(selection, embedImages);

				// Create renderer with plugin options
				const { MarkupToHtml, MarkupLanguage } = require('@joplin/renderer');
				let pluginOptions: PluginOptions = {};
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
					const srcRegex = /(<img[^>]*src=["']):\/{1,2}([a-f0-9]{32})(["'][^>]*>)/gi;
					html = await replaceAsync(html, srcRegex, async (match: string, pre: string, id: string, post: string) => {
						if (!id) return match;
						const base64Result = await convertResourceToBase64(id);
						if (base64Result.startsWith('data:image')) {
							return `${pre}${base64Result}${post}`;
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
							// Error case - return error span
							return base64Result;
						}
					});
				}

				// Extract the final HTML using jsdom
				let fragment = html.trim();
				try {
					const dom = new JSDOM(html);
					const renderedMd = dom.window.document.querySelector('#rendered-md');
					if (renderedMd) {
						// Remove all <pre class="joplin-source"> blocks
						const sourceBlocks = renderedMd.querySelectorAll('pre.joplin-source');
						sourceBlocks.forEach((el: any) => el.remove());
						fragment = renderedMd.innerHTML.trim();
					} else {
						fragment = html.trim();
					}
				} catch (err) {
					console.error('[copy-as-html] jsdom extraction error:', err);
				}

				// Copy to clipboard
				await joplin.clipboard.writeHtml(fragment);
				await joplin.views.dialogs.showToast({ message: 'Copied selection as HTML!', type: ToastType.Success });
			},
		});

		// Register keyboard shortcut for HTML copy
		await joplin.views.menuItems.create('copyAsHtmlShortcut', 'copyAsHtml', MenuItemLocation.EditorContextMenu, {
			accelerator: 'Ctrl+Shift+C',
		});

		// Register plain text copy command
		await joplin.commands.register({
			name: 'copyAsPlainText',
			label: 'Copy selection as Plain Text',
			iconName: 'fas fa-copy',
			when: 'markdownEditorVisible',
			execute: async () => {
							// Get selected markdown
const selection = await joplin.commands.execute('editor.execCommand', { name: 'getSelection' });
if (!selection) {
    await joplin.views.dialogs.showToast({ message: 'No text selected.', type: ToastType.Info });
    return;
}

// Get preservation settings
const preserveSuperscript = await joplin.settings.value(SETTINGS.PRESERVE_SUPERSCRIPT);
const preserveSubscript = await joplin.settings.value(SETTINGS.PRESERVE_SUBSCRIPT);
const preserveEmphasis = await joplin.settings.value(SETTINGS.PRESERVE_EMPHASIS);
const preserveBold = await joplin.settings.value(SETTINGS.PRESERVE_BOLD);
const preserveHeading = await joplin.settings.value(SETTINGS.PRESERVE_HEADING);
const hyperlinkBehavior = await joplin.settings.value(SETTINGS.HYPERLINK_BEHAVIOR) as 'title' | 'url' | 'markdown';

// Use markdown-it to parse and render plain text
const md = new MarkdownIt();
const tokens = md.parse(selection, {});

                 let plainText = renderPlainText(tokens, null, 0, {
                     preserveHeading,
                     preserveEmphasis,
                     preserveBold,
                     preserveSuperscript,
                     preserveSubscript,
                     hyperlinkBehavior
                 });

				// Copy to clipboard as plain text
				await joplin.clipboard.writeText(plainText);
				await joplin.views.dialogs.showToast({ message: 'Copied selection as Plain Text!', type: ToastType.Success });
			},
		});

		// Register keyboard shortcut for plain text copy
		await joplin.views.menuItems.create('copyAsPlainTextShortcut', 'copyAsPlainText', MenuItemLocation.EditorContextMenu, {
			accelerator: 'Ctrl+Alt+C',
		});
	},
});

export {
    extractImageDimensions,
    applyPreservedDimensions,
    replaceAsync,
    convertResourceToBase64,
    unescape,
    renderPlainText,
    ImageDimensions,
    MarkdownSegment,
    PluginOptions,
    PlainTextOptions,
};