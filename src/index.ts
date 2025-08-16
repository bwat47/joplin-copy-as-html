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

// Types for table helpers
interface TableRow {
    cells: string[];
    isHeader: boolean;
}
interface TableData {
    rows: TableRow[];
}

/**
 * Parses table-related tokens into a structured TableData object.
 * Handles header and body rows, and extracts cell content using renderPlainText for nested formatting.
 */
function parseTableTokens(tableTokens: any[], options: PlainTextOptions, listContext: any, indentLevel: number): TableData {
    let tableRows: TableRow[] = [];
    let currentRow: string[] = [];
    let isHeaderRow = false;
    for (let k = 0; k < tableTokens.length; k++) {
        const tk = tableTokens[k];
        if (tk.type === 'thead_open') isHeaderRow = true;
        if (tk.type === 'thead_close') isHeaderRow = false;
        if (tk.type === 'tr_open') currentRow = [];
        if ((tk.type === 'th_open' || tk.type === 'td_open')) {
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
    return { rows: tableRows };
}

/**
 * Calculates the maximum width for each column in the table for aligned formatting.
 */
function calculateColumnWidths(tableData: TableData): number[] {
    let colWidths: number[] = [];
    for (let r = 0; r < tableData.rows.length; r++) {
        let cells = tableData.rows[r].cells;
        for (let c = 0; c < cells.length; c++) {
            colWidths[c] = Math.max(colWidths[c] || 0, cells[c].length);
        }
    }
    return colWidths;
}

/**
 * Formats the table as a human-readable aligned plain text string, including header separators.
 * Adds an extra newline at the end for spacing.
 */
function formatTable(tableData: TableData, colWidths: number[]): string {
    function padCell(cell: string, width: number) {
        return cell + ' '.repeat(width - cell.length);
    }
    let result = '';
    let headerDone = false;
    for (let r = 0; r < tableData.rows.length; r++) {
        let paddedCells = tableData.rows[r].cells.map((c, i) => padCell(c, colWidths[i]));
        result += paddedCells.join('  ') + '\n';
        if (tableData.rows[r].isHeader && !headerDone && tableData.rows.length > 1) {
            let sepCells = colWidths.map(w => '-'.repeat(Math.max(CONSTANTS.MIN_COLUMN_WIDTH, w)));
            result += sepCells.join('  ') + '\n';
            headerDone = true;
        }
    }
    return result + '\n';
}

// Main orchestrator for table rendering
function renderTableFromTokens(tableTokens: any[], options: PlainTextOptions, listContext: any, indentLevel: number): string {
    const tableData = parseTableTokens(tableTokens, options, listContext, indentLevel);
    const colWidths = calculateColumnWidths(tableData);
    return formatTable(tableData, colWidths);
}

/**
 * Represents a parsed list item.
 */
interface ListItem {
    content: string;
    ordered: boolean;
    index?: number;
    indentLevel: number;
}

/**
 * Parses list-related tokens into a structured array of ListItem objects.
 */
function parseListTokens(listTokens: any[], listContext: any, indentLevel: number, options: PlainTextOptions): ListItem[] {
    let items: ListItem[] = [];
    let ordered = listContext && listContext.type === 'ordered';
    let index = listContext && listContext.index ? listContext.index : 1;
    for (let i = 0; i < listTokens.length; i++) {
        const t = listTokens[i];
        if (t.type === 'list_item_open') {
            // Collect all tokens for this list item
            let itemTokens = [];
            let depth = 1;
            let j = i + 1;
            while (j < listTokens.length && depth > 0) {
                if (listTokens[j].type === 'list_item_open') depth++;
                if (listTokens[j].type === 'list_item_close') depth--;
                if (depth > 0) itemTokens.push(listTokens[j]);
                j++;
            }
            // Render the content of the list item
            let content = renderPlainText(itemTokens, listContext, indentLevel, options);
            items.push({
                content: content.trim(),
                ordered,
                index: ordered ? index : undefined,
                indentLevel
            });
            if (ordered) index++;
            i = j - 1;
        }
    }
    return items;
}

/**
 * Formats the list items as a human-readable plain text string.
 */
function formatList(listItems: ListItem[], options: PlainTextOptions): string {
    let lines: string[] = [];
    for (const item of listItems) {
        const indent = item.indentLevel > 1 ? '\t'.repeat(item.indentLevel - 1) : '';
        const prefix = item.ordered ? `${item.index}. ` : '- ';
        lines.push(indent + prefix + item.content);
        lines.push(''); // Always add a blank line after every list item
    }
    // Remove trailing blank lines (to avoid extra newlines at the end)
    while (lines.length > 1 && lines[lines.length - 1] === '' && lines[lines.length - 2] === '') {
        lines.pop();
    }
    return lines.join('\n');
}

/**
 * Orchestrates list rendering by parsing tokens and formatting the list.
 */
function renderListFromTokens(listTokens: any[], listContext: any, indentLevel: number, options: PlainTextOptions): string {
    const listItems = parseListTokens(listTokens, listContext, indentLevel, options);
    return formatList(listItems, options);
}

// Link handling helper
function handleLinkToken(
    t: any,
    linkStack: { href: string, title: string }[],
    options: PlainTextOptions,
    result: string
): string {
    // Only handle external HTTP/HTTPS links for special behavior
    const hrefAttr = t.attrs?.find((attr: any) => attr[0] === 'href');
    const href = hrefAttr ? hrefAttr[1] : '';
    if (isExternalHttpUrl(href)) {
        linkStack.push({ href, title: '' });
    } else {
        linkStack.push({ href: '', title: '' });
    }
    return result;
}

function handleLinkCloseToken(
    linkStack: { href: string, title: string }[],
    options: PlainTextOptions,
    result: string
): string {
    const link = linkStack.pop();
    if (link && link.href && link.title) {
        if (options.hyperlinkBehavior === 'url') {
            result += link.href;
        } else if (options.hyperlinkBehavior === 'markdown') {
            result += `[${link.title}](${link.href})`;
        }
        // For 'title', do nothing extra (title already added)
    }
    return result;
}

function handleTextToken(
    t: any,
    linkStack: { href: string, title: string }[],
    options: PlainTextOptions,
    inCode: boolean,
    result: string
): string {
    let txt = t.content;
    if (!inCode && linkStack.length && linkStack[linkStack.length - 1].href) {
        // If inside an external link, capture the title for later
        linkStack[linkStack.length - 1].title += txt;
        if (options.hyperlinkBehavior === 'title') {
            result += txt;
        }
        // For 'url' and 'markdown', don't add title here (will be handled on link_close)
    } else {
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
    }
    return result;
}

/**
 * Converts markdown-it tokens to plain text, with options to preserve or remove markdown formatting.
 *
 * Features:
 * - Handles tables, lists, headings, emphasis, bold, superscript, subscript, and hyperlinks.
 * - Honors user settings for preserving markdown formatting (e.g., headings, emphasis, bold, etc.).
 * - Supports a user-configurable hyperlink behavior for external links: show title, URL, or markdown format.
 * - Ensures all code blocks and inline code are output as-is, without formatting or link processing.
 * - Recursively processes nested tokens and respects context (e.g., inside lists or code).
 *
 * @param tokens        The markdown-it token array to process.
 * @param listContext   The current list context (for nested lists).
 * @param indentLevel   The current indentation level for lists.
 * @param options       Formatting preservation and hyperlink behavior options.
 * @param inCode        True if currently inside a code block or inline code.
 * @returns             The rendered plain text string.
 */
function renderPlainText(
    tokens: any[],
    listContext: any = null,
    indentLevel: number = 0,
    options: PlainTextOptions,
    inCode: boolean = false
): string {
    let result = '';
    let linkStack: { href: string, title: string }[] = [];
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
			result += renderTableFromTokens(tableTokens, options, listContext, indentLevel);
			i = j - 1;
			continue;
		}
		if (t.type === 'fence' || t.type === 'code_block') {
			// Output code block content only (no backticks or formatting)
			result += t.content + '\n';
		} else if (t.type === 'code_inline') {
			// Output inline code content only (no backticks or formatting)
			result += t.content;
		} else if (t.type === 'inline' && t.children) {
			// If we're inside code, pass inCode=true to children
			result += renderPlainText(
                t.children,
                listContext,
                indentLevel,
                options,
                inCode
            );
		} else if (t.type === 'heading_open') {
			if (options.preserveHeading) {
				result += '#'.repeat(parseInt(t.tag[1])) + ' ';
			}
		} else if (t.type === 'heading_close') {
			result += '\n\n';
		} else if (t.type === 'bullet_list_open' || t.type === 'ordered_list_open') {
			// Collect all tokens until the matching list_close
			let subTokens = [];
			let depth = 1;
			let j = i + 1;
			while (j < tokens.length && depth > 0) {
				if (tokens[j].type === t.type) depth++;
				if (
					(t.type === 'bullet_list_open' && tokens[j].type === 'bullet_list_close') ||
					(t.type === 'ordered_list_open' && tokens[j].type === 'ordered_list_close')
				) depth--;
				if (depth > 0) subTokens.push(tokens[j]);
				j++;
			}
			result += renderListFromTokens(subTokens, t.type === 'ordered_list_open' ? { type: 'ordered', index: 1 } : { type: 'bullet' }, indentLevel + 1, options);
			const nextToken = tokens[j];
			if (
				nextToken &&
				(
					nextToken.type === 'paragraph_open' ||
					nextToken.type === 'heading_open' ||
					nextToken.type === 'text' ||
					nextToken.type === 'bullet_list_open' ||
					nextToken.type === 'ordered_list_open' ||
					nextToken.type === 'fence' ||
					nextToken.type === 'code_block'
				) &&
				!result.endsWith('\n\n')
			) {
				result += '\n';
			}
			i = j - 1;
			continue;
		
		} else if (!inCode && t.type === 'em_open') {
            if (options.preserveEmphasis) result += t.markup;
        } else if (!inCode && t.type === 'em_close') {
            if (options.preserveEmphasis) result += t.markup;
        } else if (!inCode && t.type === 'strong_open') {
            if (options.preserveBold) result += t.markup;
        } else if (!inCode && t.type === 'strong_close') {
            if (options.preserveBold) result += t.markup;
		} else if (!inCode && t.type === 'link_open') {
			result = handleLinkToken(t, linkStack, options, result);
        } else if (!inCode && t.type === 'link_close') {
			result = handleLinkCloseToken(linkStack, options, result);
        } else if (t.type === 'text') {
			result = handleTextToken(t, linkStack, options, inCode, result);
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