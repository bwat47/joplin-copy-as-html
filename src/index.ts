import joplin from 'api';
import { SettingItemType, ToastType, MenuItemLocation } from 'api/types';

const SETTINGS = {
	EMBED_IMAGES: 'embedImages',
	PRESERVE_SUPERSCRIPT: 'preserveSuperscript',
	PRESERVE_SUBSCRIPT: 'preserveSubscript',
	PRESERVE_EMPHASIS: 'preserveEmphasis',
	PRESERVE_BOLD: 'preserveBold',
	PRESERVE_HEADING: 'preserveHeading',
};

// Extract width/height from HTML img tags before rendering (excluding code blocks)
// Also remove images entirely if embedImages is false
function extractImageDimensions(markdown: string, embedImages: boolean): { processedMarkdown: string, dimensions: Map<string, {width?: string, height?: string, style?: string}> } {
	const dimensions = new Map();
	let counter = 0;
	
	// Split markdown into code/non-code segments
	const codeBlockRegex = /(```[\s\S]*?```|`[^`\n]*`)/g;
	let segments: Array<{type: 'text' | 'code', content: string}> = [];
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
	
	const processedSegments = segments.map(segment => {
		if (segment.type === 'code') {
			// Don't process code blocks - return as-is
			return segment;
		}
		
		let processedContent = segment.content;
		
		// If not embedding images, remove all image references
		if (!embedImages) {
			// Remove HTML img tags
			processedContent = processedContent.replace(/<img[^>]*>/gi, '');
			// Remove markdown image syntax ![alt](://resourceId)
			processedContent = processedContent.replace(/!\[[^\]]*\]\(:\/[a-zA-Z0-9]+\)/g, '');
			// Remove standalone markdown images ![](://resourceId) 
			processedContent = processedContent.replace(/!\[\]\(:\/[a-zA-Z0-9]+\)/g, '');
		} else {
			// Only process HTML img tags that contain Joplin resource IDs in non-code segments
			const htmlImgRegex = /<img([^>]*src=["']:\/([a-zA-Z0-9]+)["'][^>]*)>/gi;
			
			processedContent = processedContent.replace(htmlImgRegex, (match, attrs, resourceId) => {
				// Extract width, height, and style attributes
				const widthMatch = attrs.match(/\bwidth\s*=\s*["']?([^"'\s>]+)["']?/i);
				const heightMatch = attrs.match(/\bheight\s*=\s*["']?([^"'\s>]+)["']?/i);
				const styleMatch = attrs.match(/\bstyle\s*=\s*["']([^"']*)["']/i);
				
				if (widthMatch || heightMatch || styleMatch) {
					const dimensionKey = `DIMENSION_${counter}`;
					dimensions.set(dimensionKey, {
						width: widthMatch ? widthMatch[1] : undefined,
						height: heightMatch ? heightMatch[1] : undefined,
						style: styleMatch ? styleMatch[1] : undefined,
						resourceId: resourceId
					});
					
					// Convert to markdown image syntax with dimension marker
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

// Apply preserved dimensions to rendered HTML
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

// Helper: async replace for regex  
async function replaceAsync(str: string, regex: RegExp, asyncFn: Function) {
	const promises: Promise<string>[] = [];
	str.replace(regex, (match, ...args) => {
		promises.push(asyncFn(match, ...args));
		return match;
	});
	const data = await Promise.all(promises);
	return str.replace(regex, () => data.shift());
}

// Helper: Convert Joplin resource to base64
async function convertResourceToBase64(id: string): Promise<string> {
	try {
		const resource = await joplin.data.get(['resources', id], { fields: ['id', 'mime'] });
		if (!resource || !resource.mime.startsWith('image/')) {
			return `<span style="color: red; font-style: italic;">Resource ID ":/${id}" could not be found.</span>`;
		}

		const fileObj = await joplin.data.get(['resources', id, 'file']);
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
		return `<span style="color: red; font-style: italic;">Resource ID ":/${id}" could not be found.</span>`;
	}
}

joplin.plugins.register({
	onStart: async function() {
		// Register settings (unchanged)
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
				html = applyPreservedDimensions(html, dimensions);

				// If embedding images, convert Joplin resource URLs to base64
				if (embedImages) {
					// Replace src attribute for Joplin resource images with base64 data
					const srcRegex = /(<img[^>]*src=["']):\/{1,2}([a-zA-Z0-9]+)(["'][^>]*>)/g;
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
					const fallbackRegex = /\[Image: :\/([a-zA-Z0-9]+)\]/g;
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
				const { JSDOM } = require('jsdom');
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

		// Register keyboard shortcut
		await joplin.views.menuItems.create('copyAsHtmlShortcut', 'copyAsHtml', MenuItemLocation.EditorContextMenu, {
			accelerator: 'Ctrl+Shift+C',
		});

		// Plain text copy command (completely unchanged)
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

// Use markdown-it to parse and render plain text
const MarkdownIt = require('markdown-it');
const md = new MarkdownIt();
const tokens = md.parse(selection, {});

// Helper: Remove backslash escapes
function unescape(text) {
    return text.replace(/\\([*_~^`#])/g, '$1');
}

// Recursively process tokens for plain text extraction
function renderPlainText(tokens, listContext = null, indentLevel = 0) {
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
							cellContent += renderPlainText(tableTokens[l].children);
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
					let sepCells = colWidths.map(w => '-'.repeat(Math.max(3, w)));
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
			result += renderPlainText(t.children, listContext, indentLevel);
		} else if (t.type === 'heading_open') {
			if (preserveHeading) {
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
            result += renderPlainText(subTokens, { type: 'bullet' }, indentLevel + 1);
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
            result += renderPlainText(subTokens, { type: 'ordered', index: start }, indentLevel + 1);
            i += subTokens.length;

        } else if (t.type === 'list_item_open') {
            // Only indent if indentLevel > 1 (top-level lists have no indent)
            const indent = indentLevel > 1 ? '\t'.repeat(indentLevel - 1) : '';
            if (listContext && listContext.type === 'ordered' && typeof t.orderedIndex !== 'undefined') {
                result += indent + t.orderedIndex + '. ';
            } else {
                result += indent + '- ';
            }
		} else if (t.type === 'em_open') {
			if (preserveEmphasis) result += t.markup;
		} else if (t.type === 'em_close') {
			if (preserveEmphasis) result += t.markup;
		} else if (t.type === 'strong_open') {
			if (preserveBold) result += t.markup;
		} else if (t.type === 'strong_close') {
			if (preserveBold) result += t.markup;
		} else if (t.type === 'text') {
			let txt = t.content;

			// Remove HTML <img> tags ONLY in text tokens
    		txt = txt.replace(/<img[^>]*>/gi, '');

			// Collapse 3+ consecutive newlines to 2 ONLY in text tokens
    		txt = txt.replace(/\n{3,}/g, '\n\n');

			if (preserveSuperscript) {
				txt = txt.replace(/\^([^\^]+)\^/g, '^$1^');
			} else {
				txt = txt.replace(/\^([^\^]+)\^/g, '$1');
			}
			if (preserveSubscript) {
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

				let plainText = renderPlainText(tokens);

				await joplin.clipboard.writeText(plainText);
				await joplin.views.dialogs.showToast({ message: 'Copied selection as Plain Text!', type: ToastType.Success });
			},
		});

		await joplin.views.menuItems.create('copyAsPlainTextShortcut', 'copyAsPlainText', MenuItemLocation.EditorContextMenu, {
			accelerator: 'Ctrl+Alt+C',
		});
	},
});