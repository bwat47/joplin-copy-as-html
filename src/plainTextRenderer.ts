import type { Token } from 'markdown-it';
import * as MarkdownIt from 'markdown-it';
// Use safe imports to prevent conflicts with htmlRenderer
let markdownItMark: any;
let markdownItIns: any;
let markdownItEmoji: any;

try {
    markdownItMark = require('markdown-it-mark');
} catch (e) {
    console.warn('[copy-as-plain-text] markdown-it-mark not available:', e);
}

try {
    markdownItIns = require('markdown-it-ins');
} catch (e) {
    console.warn('[copy-as-plain-text] markdown-it-ins not available:', e);
}

try {
    markdownItEmoji = require('markdown-it-emoji');
} catch (e) {
    console.warn('[copy-as-plain-text] markdown-it-emoji not available:', e);
}

import { PlainTextOptions, TableData, TableRow, ListItem } from './types';
import { CONSTANTS } from './constants';
import stringWidth from 'string-width';

type LinkStackItem = { href: string, title: string };
type ListContext = { type: 'ordered', index: number } | { type: 'bullet' } | null;

/**
 * Removes markdown backslash escapes from a string.
 * @param text The input string.
 * @returns The unescaped string.
 */
export function unescape(text: string): string {
    return text.replace(/\\([*_~^`#])/g, '$1');
}

/**
 * Checks if a URL is an external HTTP/HTTPS link.
 * @param url The URL to check.
 * @returns True if the URL is an external HTTP/HTTPS link.
 */
export function isExternalHttpUrl(url: string): boolean {
    return /^https?:\/\//i.test(url);
}

/**
 * Parses table-related tokens into a structured TableData object.
 * Handles header and body rows, and extracts cell content using renderPlainText for nested formatting.
 */
export function parseTableTokens(tableTokens: Token[], options: PlainTextOptions, listContext: ListContext, indentLevel: number): TableData {
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
export function calculateColumnWidths(tableData: TableData): number[] {
    let colWidths: number[] = [];
    for (let r = 0; r < tableData.rows.length; r++) {
        let cells = tableData.rows[r].cells;
        for (let c = 0; c < cells.length; c++) {
            colWidths[c] = Math.max(colWidths[c] || 0, stringWidth(cells[c]));
        }
    }
    return colWidths;
}

/**
 * Formats the table as a human-readable aligned plain text string, including header separators.
 * Adds an extra newline at the end for spacing.
 */
export function formatTable(tableData: TableData, colWidths: number[]): string {
    function padCell(cell: string, width: number) {
        const pad = width - stringWidth(cell);
        return cell + ' '.repeat(pad > 0 ? pad : 0);
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
export function renderTableFromTokens(tableTokens: Token[], options: PlainTextOptions, listContext: ListContext, indentLevel: number): string {
    const tableData = parseTableTokens(tableTokens, options, listContext, indentLevel);
    const colWidths = calculateColumnWidths(tableData);
    return formatTable(tableData, colWidths);
}

/**
 * Parses list-related tokens into a structured array of ListItem objects.
 */
export function parseListTokens(listTokens: Token[], listContext: ListContext, indentLevel: number, options: PlainTextOptions): ListItem[] {
    let items: ListItem[] = [];
    let ordered = listContext && listContext.type === 'ordered';
    let index = (listContext && listContext.type === 'ordered' && typeof listContext.index === 'number')
        ? listContext.index
        : 1;
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
export function formatList(listItems: ListItem[], options: PlainTextOptions): string {
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
 * Parses and formats a list from markdown-it tokens using the configured options.
 */
export function renderListFromTokens(listTokens: Token[], listContext: ListContext, indentLevel: number, options: PlainTextOptions): string {
    const listItems = parseListTokens(listTokens, listContext, indentLevel, options);
    return formatList(listItems, options);
}

/**
 * Handles opening of a markdown link token, pushing link info onto the stack.
 */
export function handleLinkToken(
    t: Token,
    linkStack: LinkStackItem[],
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

/**
 * Handles closing of a markdown link token, popping from the stack and appending link text as needed.
 */
export function handleLinkCloseToken(
    linkStack: LinkStackItem[],
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

/**
 * Handles a text token, including link title capture and formatting options.
 */
export function handleTextToken(
    t: Token,
    content: string,
    linkStack: LinkStackItem[],
    options: PlainTextOptions,
    inCode: boolean,
    result: string
): string {
    let txt = content;
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
 * Extracts a slice of tokens from an opening token to its corresponding closing token.
 */
export function extractBlockTokens(tokens: Token[], startIndex: number): { blockTokens: Token[], endIndex: number } {
    const startToken = tokens[startIndex];
    const closeType = startToken.type.replace('_open', '_close');
    const blockTokens: Token[] = [];
    let depth = 1;
    let i = startIndex + 1;
    while (i < tokens.length && depth > 0) {
        const currentToken = tokens[i];
        if (currentToken.type === startToken.type) depth++;
        if (currentToken.type === closeType) depth--;
        if (depth > 0) blockTokens.push(currentToken);
        i++;
    }
    return { blockTokens, endIndex: i - 1 };
}

/**
 * Safe plugin use function for plain text renderer
 */
function safePluginUse(md: MarkdownIt, plugin: any, pluginName: string = 'unknown'): boolean {
    if (!plugin) {
        return false;
    }
    
    try {
        // Try different plugin formats
        let pluginFunc = null;
        
        if (typeof plugin === 'function') {
            pluginFunc = plugin;
        } else if (plugin && typeof plugin.default === 'function') {
            pluginFunc = plugin.default;
        } else if (plugin && plugin.plugin && typeof plugin.plugin === 'function') {
            pluginFunc = plugin.plugin;
        } else if (plugin && typeof plugin === 'object') {
            // For object plugins, look for common export patterns
            if (typeof plugin.markdownit === 'function') {
                pluginFunc = plugin.markdownit;
            } else if (typeof plugin.render === 'function') {
                pluginFunc = plugin.render;
            } else if (typeof plugin.parse === 'function') {
                pluginFunc = plugin.parse;
            } else if (plugin.full && typeof plugin.full === 'function') {
                // For markdown-it-emoji which exports {bare, full, light}
                pluginFunc = plugin.full;
            } else if (plugin.light && typeof plugin.light === 'function') {
                // Alternative emoji option
                pluginFunc = plugin.light;
            } else if (plugin.bare && typeof plugin.bare === 'function') {
                // Another emoji option
                pluginFunc = plugin.bare;
            } else {
                // Try to find any function in the object
                const funcKeys = Object.keys(plugin).filter(key => typeof plugin[key] === 'function');
                if (funcKeys.length === 1) {
                    pluginFunc = plugin[funcKeys[0]];
                } else if (funcKeys.length > 1) {
                    // If multiple functions, try common patterns first
                    if (funcKeys.includes('full')) {
                        pluginFunc = plugin.full;
                    } else if (funcKeys.includes('default')) {
                        pluginFunc = plugin.default;
                    } else {
                        // Use the first available function
                        pluginFunc = plugin[funcKeys[0]];
                    }
                } else {
                    console.warn(`[copy-as-plain-text] Plugin ${pluginName} object found but no callable function. Available keys:`, Object.keys(plugin));
                    return false;
                }
            }
        }
        
        if (!pluginFunc) {
            console.warn(`[copy-as-plain-text] Could not find callable plugin function for ${pluginName}`);
            return false;
        }
        
        // Try to use the plugin
        md.use(pluginFunc);
        return true;
    } catch (err) {
        console.error(`[copy-as-plain-text] Error loading plugin ${pluginName}:`, err);
        return false;
    }
}

/**
 * Recursively renders an array of markdown-it tokens into a plain text string.
 * It handles various token types to strip markdown formatting while preserving
 * structure like lists, tables, and headings based on the provided options.
 * @param tokens An array of markdown-it tokens to process.
 * @param listContext The current list context (ordered or bullet) for indentation.
 * @param indentLevel The current level of indentation for nested structures.
 * @param options The user-configured options for preserving markdown formatting.
 * @param inCode A flag to indicate if the renderer is currently inside a code block.
 * @returns The generated plain text string.
 */
export function renderPlainText(
    tokens: Token[],
    listContext: ListContext = null,
    indentLevel: number = 0,
    options: PlainTextOptions,
    inCode: boolean = false
): string {
    let result = '';
    let linkStack: LinkStackItem[] = [];
    for (let i = 0; i < tokens.length; i++) {
        const t = tokens[i];

        if (t.type === 'table_open' || t.type === 'bullet_list_open' || t.type === 'ordered_list_open') {
            const { blockTokens, endIndex } = extractBlockTokens(tokens, i);
            
            if (t.type === 'table_open') {
                result += renderTableFromTokens(blockTokens, options, listContext, indentLevel);
            } else {
                result += renderListFromTokens(
                    blockTokens,
                    t.type === 'ordered_list_open' ? { type: 'ordered', index: 1 } : { type: 'bullet' },
                    indentLevel + 1,
                    options
                );
            }

            const nextToken = tokens[endIndex + 1];
            if (
                nextToken &&
                (
                    nextToken.type === 'paragraph_open' ||
                    nextToken.type === 'heading_open' ||
                    nextToken.type === 'hr' ||
                    nextToken.type === 'thematic_break' ||
                    nextToken.type === 'text' ||
                    nextToken.type === 'bullet_list_open' ||
                    nextToken.type === 'ordered_list_open' ||
                    nextToken.type === 'fence' ||
                    nextToken.type === 'code_block' ||
                    nextToken.type === 'blockquote_open'
                )
            ) {
                // Ensure two newlines before block-level elements after a list
                if (!result.endsWith('\n\n')) result = result.replace(/\n*$/, '\n\n');
            }
            i = endIndex;
            continue;
        }

        if (t.type === 'fence' || t.type === 'code_block') {
            // Only strip outer fences if they are the only thing on the first and last line
            const lines = t.content.split('\n');
            if (
                lines.length > 2 &&
                lines[0].trim().startsWith('```') &&
                lines[lines.length - 1].trim().startsWith('```')
            ) {
                // Remove first and last line (the fences)
                result += lines.slice(1, -1).join('\n') + '\n';
            } else {
                result += t.content + '\n';
            }
        } else if (t.type === 'code_inline') {
            // Inline code: preserve literal content without markdown markers
            result += t.content;
        } else if (t.type === 'inline' && t.children) {
            // Inline container: recursively render child tokens (em, strong, links, text, etc.)
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
            // Ensure blank line(s) after headings
            result += '\n\n';
        } else if (t.type === 'hr' || t.type === 'thematic_break') {
            // Horizontal rule: preserve as markdown '---' if requested, otherwise emit spacing
            if (options.preserveHorizontalRule) {
                result += '---\n\n';
            } else {
                // keep a blank line separator for readability
                result += '\n\n';
            }
        // emit the original markup only when the corresponding setting is enabled
        } else if (!inCode && t.type === 'em_open') {
            if (options.preserveEmphasis) result += t.markup;
        } else if (!inCode && t.type === 'em_close') {
            if (options.preserveEmphasis) result += t.markup;
        } else if (!inCode && t.type === 'strong_open') {
            if (options.preserveBold) result += t.markup;
        } else if (!inCode && t.type === 'strong_close') {
            if (options.preserveBold) result += t.markup;
        } else if (!inCode && t.type === 'mark_open') {
            if (options.preserveMark) result += '==';
        } else if (!inCode && t.type === 'mark_close') {
            if (options.preserveMark) result += '==';
        } else if (!inCode && t.type === 'ins_open') {
            if (options.preserveInsert) result += '++';
        } else if (!inCode && t.type === 'ins_close') {
            if (options.preserveInsert) result += '++';
        } else if (!inCode && t.type === 's_open') {
            if (options.preserveStrikethrough) result += '~~';
        } else if (!inCode && t.type === 's_close') {
            if (options.preserveStrikethrough) result += '~~';
        } else if (!inCode && t.type === 'link_open') {
            result = handleLinkToken(t, linkStack, options, result);
        } else if (!inCode && t.type === 'link_close') {
            result = handleLinkCloseToken(linkStack, options, result);
        } else if (t.type === 'emoji') {
        if (options.displayEmojis) {
            result += t.content;
        }
        } else if (t.type === 'text') {
            // Replace [^n] and [^text]: with [n] and [text]: (don't mutate original token)
            let content = t.content.replace(/\[\^([^\]]+)\]/g, '[$1]');
            content = content.replace(/\[\^([^\]]+)\]:/g, '[$1]:');
            // Pass modified content as separate parameter
            result = handleTextToken(t, content, linkStack, options, inCode, result);
        } else if (t.type === 'softbreak' || t.type === 'hardbreak') {
            result += '\n';
        } else if (t.type === 'paragraph_close') {
            result += '\n\n';
        } else if (t.type === 'blockquote_close') {
            result += '\n\n';
            let k = i + 1;
            while (
                k < tokens.length &&
                (
                    tokens[k].type === 'paragraph_open' ||
                    tokens[k].type === 'paragraph_close' ||
                    tokens[k].type === 'softbreak' ||
                    tokens[k].type === 'hardbreak'
                )
            ) {
                k++;
            }
            if (k < tokens.length && tokens[k].type === 'blockquote_open') {
                result = result.replace(/\n*$/, '\n\n');
            }
            result = result.replace(/\n{3,}/g, '\n\n');
        }
    }
    return result;
}

/**
 * Converts markdown to plain text using the provided options.
 * @param markdown The markdown string to convert.
 * @param options The plain text rendering options.
 * @returns The resulting plain text string.
 */
export function convertMarkdownToPlainText(
    markdown: string,
    options: PlainTextOptions
): string {
    const md = new MarkdownIt();
    
    // Use safe plugin loading to prevent conflicts
    if (markdownItMark) safePluginUse(md, markdownItMark, 'markdown-it-mark');
    if (markdownItIns) safePluginUse(md, markdownItIns, 'markdown-it-ins');
    if (markdownItEmoji) safePluginUse(md, markdownItEmoji, 'markdown-it-emoji');
    
    const tokens = md.parse(markdown, {});
    return renderPlainText(tokens, null, 0, options);
}