/**
 * @fileoverview Token Renderers for Plain Text
 *
 * This module contains the core logic for rendering markdown-it tokens into
 * a formatted plain text string. It preserves structure like lists and tables.
 *
 * @author bwat47
 * @since 1.1.8
 */

import type { Token } from 'markdown-it';
import { PlainTextOptions, TableData, TableRow, ListItem } from '../types';
import { PLAIN_TEXT_CONSTANTS, INLINE_MARKERS, PLAIN_TEXT_REGEX } from '../constants';
import stringWidth from 'string-width';

export type LinkStackItem = { href: string; title: string };
export type ListContext = { type: 'ordered'; index: number } | { type: 'bullet' } | null;
export type TokenFragmentRenderer = (tokens: Token[], listContext: ListContext, indentLevel: number) => string;

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
    return /^https?:\/\/./i.test(url);
}

/**
 * Parses table-related tokens into a structured TableData object.
 */
export function parseTableTokens(
    tableTokens: Token[],
    options: PlainTextOptions,
    listContext: ListContext,
    indentLevel: number,
    renderFragment?: TokenFragmentRenderer
): TableData {
    const tableRows: TableRow[] = [];
    let currentRow: string[] = [];
    let isHeaderRow = false;
    for (let tokenIndex = 0; tokenIndex < tableTokens.length; tokenIndex++) {
        const tk = tableTokens[tokenIndex];
        if (tk.type === 'thead_open') isHeaderRow = true;
        if (tk.type === 'thead_close') isHeaderRow = false;
        if (tk.type === 'tr_open') currentRow = [];
        if (tk.type === 'th_open' || tk.type === 'td_open') {
            let cellContent = '';
            let cellIndex = tokenIndex + 1;
            while (
                cellIndex < tableTokens.length &&
                tableTokens[cellIndex].type !== 'th_close' &&
                tableTokens[cellIndex].type !== 'td_close'
            ) {
                const inner = tableTokens[cellIndex];
                if (inner.type === 'inline' && inner.children) {
                    const renderFn = renderFragment
                        ? renderFragment
                        : (tokens) => renderPlainText(tokens, listContext, indentLevel, options);
                    cellContent += renderFn(inner.children, listContext, indentLevel);
                } else if (inner.type === 'text') {
                    cellContent += inner.content;
                }
                cellIndex++;
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
 * Calculates the maximum width for each column in the table.
 */
export function calculateColumnWidths(tableData: TableData): number[] {
    const colWidths: number[] = [];
    for (let r = 0; r < tableData.rows.length; r++) {
        const cells = tableData.rows[r].cells;
        for (let c = 0; c < cells.length; c++) {
            colWidths[c] = Math.max(colWidths[c] || 0, stringWidth(cells[c]));
        }
    }
    return colWidths;
}

/**
 * Formats the table as a human-readable aligned plain text string.
 */
export function formatTable(tableData: TableData, colWidths: number[]): string {
    function padCell(cell: string, width: number) {
        const pad = width - stringWidth(cell);
        return cell + ' '.repeat(pad > 0 ? pad : 0);
    }
    let result = '';
    let headerDone = false;
    for (let r = 0; r < tableData.rows.length; r++) {
        const paddedCells = tableData.rows[r].cells.map((c, i) => padCell(c, colWidths[i]));
        result += paddedCells.join(' '.repeat(PLAIN_TEXT_CONSTANTS.TABLE_CELL_PADDING)) + '\n';
        if (tableData.rows[r].isHeader && !headerDone && tableData.rows.length > 1) {
            const sepCells = colWidths.map((w) => '-'.repeat(Math.max(PLAIN_TEXT_CONSTANTS.MIN_COLUMN_WIDTH, w)));
            result += sepCells.join('  ') + '\n';
            headerDone = true;
        }
    }
    return result + '\n';
}

/**
 * Main orchestrator for table rendering.
 */
export function renderTableFromTokens(
    tableTokens: Token[],
    options: PlainTextOptions,
    listContext: ListContext,
    indentLevel: number
): string {
    const tableData = parseTableTokens(tableTokens, options, listContext, indentLevel);
    const colWidths = calculateColumnWidths(tableData);
    return formatTable(tableData, colWidths);
}

/**
 * Parses list-related tokens into a structured array of ListItem objects.
 */
export function parseListTokens(
    listTokens: Token[],
    listContext: ListContext,
    indentLevel: number,
    options: PlainTextOptions,
    renderFragment?: TokenFragmentRenderer
): ListItem[] {
    const items: ListItem[] = [];
    const ordered = !!(listContext && listContext.type === 'ordered');
    let index =
        ordered && typeof listContext.index === 'number' ? listContext.index : PLAIN_TEXT_CONSTANTS.ORDERED_LIST_START;

    for (let i = 0; i < listTokens.length; i++) {
        const token = listTokens[i];
        if (token.type === 'list_item_open') {
            const itemTokens: Token[] = [];
            let nestingDepth = 1;
            let scanIndex = i + 1;
            while (scanIndex < listTokens.length && nestingDepth > 0) {
                const scanTok = listTokens[scanIndex];
                if (scanTok.type === 'list_item_open') nestingDepth++;
                if (scanTok.type === 'list_item_close') nestingDepth--;
                if (nestingDepth > 0) itemTokens.push(scanTok);
                scanIndex++;
            }
            const renderFn = renderFragment
                ? renderFragment
                : (tokens: Token[], ctx: ListContext, level: number) =>
                      renderPlainText(tokens, ctx, level, options);
            const content = renderFn(itemTokens, listContext, indentLevel);
            items.push({
                content: content.trim(),
                ordered,
                index: ordered ? index : undefined,
                indentLevel,
            });
            if (ordered) index++;
            i = scanIndex - 1;
        }
    }
    return items;
}

/**
 * Formats the list items as a human-readable plain text string.
 */
export function formatList(listItems: ListItem[], options: PlainTextOptions): string {
    const lines: string[] = [];
    for (const item of listItems) {
        const indentChar = options.indentType === 'tabs' ? '\t' : ' '.repeat(PLAIN_TEXT_CONSTANTS.SPACES_PER_INDENT);
        const indent = item.indentLevel > 1 ? indentChar.repeat(item.indentLevel - 1) : '';
        const prefix = item.ordered
            ? `${item.index}${PLAIN_TEXT_CONSTANTS.ORDERED_SUFFIX}`
            : PLAIN_TEXT_CONSTANTS.BULLET_PREFIX;
        const segments = item.content.split('\n');
        const firstSegment = segments.shift() ?? '';
        lines.push(indent + prefix + firstSegment);
        for (const segment of segments) {
            lines.push(segment);
        }
        if (PLAIN_TEXT_CONSTANTS.LIST_ITEM_TRAILING_BLANK_LINE) lines.push('');
    }
    while (lines.length > 1 && lines[lines.length - 1] === '' && lines[lines.length - 2] === '') {
        lines.pop();
    }
    return lines.join('\n');
}

/**
 * Parses and formats a list from markdown-it tokens.
 */
export function renderListFromTokens(
    listTokens: Token[],
    listContext: ListContext,
    indentLevel: number,
    options: PlainTextOptions,
    renderFragment?: TokenFragmentRenderer
): string {
    const listItems = parseListTokens(listTokens, listContext, indentLevel, options, renderFragment);
    return formatList(listItems, options);
}

/**
 * Handles opening of a markdown link token.
 */
export function handleLinkToken(t: Token, linkStack: LinkStackItem[], result: string): string {
    const hrefAttr = t.attrs?.find((attr: unknown) => Array.isArray(attr) && attr[0] === 'href');
    const href = hrefAttr ? hrefAttr[1] : '';
    if (isExternalHttpUrl(href)) {
        linkStack.push({ href, title: '' });
    } else {
        linkStack.push({ href: '', title: '' });
    }
    return result;
}

/**
 * Handles closing of a markdown link token, popping from the stack and appending link text as needed
 */
export function handleLinkCloseToken(linkStack: LinkStackItem[], options: PlainTextOptions, result: string): string {
    const link = linkStack.pop();
    if (link && link.href && link.title) {
        if (options.hyperlinkBehavior === 'url') {
            result += link.href;
        } else if (options.hyperlinkBehavior === 'markdown') {
            result += `[${link.title}](${link.href})`;
        }
    }
    return result;
}

/**
 * Handles a text token.
 */
export function handleTextToken(
    t: Token,
    content: string,
    linkStack: LinkStackItem[],
    options: PlainTextOptions,
    result: string
): string {
    let txt = content;
    if (linkStack.length && linkStack[linkStack.length - 1].href) {
        linkStack[linkStack.length - 1].title += txt;
        if (options.hyperlinkBehavior === 'title') {
            result += txt;
        }
    } else {
        txt = txt.replace(/<img[^>]*>/gi, '');
        txt = txt.replace(/\n{3,}/g, '\n'.repeat(PLAIN_TEXT_CONSTANTS.MAX_PARAGRAPH_NEWLINES));
        txt = unescape(txt);
        result += txt;
    }
    return result;
}

/**
 * Extracts a slice of tokens from an opening token to its corresponding closing token.
 */
export function extractBlockTokens(tokens: Token[], startIndex: number): { blockTokens: Token[]; endIndex: number } {
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
 * Collapses more than 2 consecutive blank lines into just two.
 */
export function collapseExtraBlankLines(text: string): string {
    return text.replace(/\n{3,}/g, '\n'.repeat(PLAIN_TEXT_CONSTANTS.MAX_PARAGRAPH_NEWLINES));
}

function normalizeHeadingLevel(tag?: string): number {
    if (!tag || tag[0] !== 'h') return 1;
    const n = parseInt(tag.slice(1), 10);
    return Math.min(6, Math.max(1, isNaN(n) ? 1 : n));
}

/**
 * Recursively renders an array of markdown-it tokens into a plain text string.
 */
export function renderPlainText(
    tokens: Token[],
    listContext: ListContext = null,
    indentLevel: number = 0,
    options: PlainTextOptions
): string {
    let result = '';
    const linkStack: LinkStackItem[] = [];
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
                (nextToken.type === 'paragraph_open' ||
                    nextToken.type === 'heading_open' ||
                    nextToken.type === 'hr' ||
                    nextToken.type === 'thematic_break' ||
                    nextToken.type === 'text' ||
                    nextToken.type === 'bullet_list_open' ||
                    nextToken.type === 'ordered_list_open' ||
                    nextToken.type === 'fence' ||
                    nextToken.type === 'code_block' ||
                    nextToken.type === 'blockquote_open')
            ) {
                if (!result.endsWith('\n\n')) result = result.replace(/\n*$/, '\n\n');
            }
            i = endIndex;
            continue;
        }

        switch (t.type) {
            case 'fence':
            case 'code_block': {
                const lines = t.content.split('\n');
                if (
                    lines.length > 2 &&
                    lines[0].trim().startsWith(PLAIN_TEXT_CONSTANTS.CODE_FENCE_MARKER) &&
                    lines[lines.length - 1].trim().startsWith(PLAIN_TEXT_CONSTANTS.CODE_FENCE_MARKER)
                ) {
                    result += lines.slice(1, -1).join('\n') + '\n';
                } else {
                    result += t.content + '\n';
                }
                break;
            }
            case 'code_inline':
                result += t.content;
                break;
            case 'inline':
                if (t.children) result += renderPlainText(t.children, listContext, indentLevel, options);
                break;
            case 'heading_open':
                if (options.preserveHeading) {
                    const level = normalizeHeadingLevel(t.tag);
                    result += PLAIN_TEXT_CONSTANTS.HEADING_PREFIX_CHAR.repeat(level) + ' ';
                }
                break;
            case 'heading_close':
                result += '\n\n';
                break;
            case 'hr':
            case 'thematic_break':
                if (options.preserveHorizontalRule) {
                    result += `${PLAIN_TEXT_CONSTANTS.HORIZONTAL_RULE_MARKER}\n\n`;
                } else {
                    result += '\u00A0\n\n'; // Non-breaking space + paragraph spacing
                }
                break;
            case 'em_open':
            case 'em_close':
                if (options.preserveEmphasis) result += t.markup;
                break;
            case 'strong_open':
            case 'strong_close':
                if (options.preserveBold) result += t.markup;
                break;
            case 'mark_open':
            case 'mark_close':
                if (options.preserveMark) result += INLINE_MARKERS.MARK;
                break;
            case 'ins_open':
            case 'ins_close':
                if (options.preserveInsert) result += INLINE_MARKERS.INSERT;
                break;
            case 's_open':
            case 's_close':
                if (options.preserveStrikethrough) result += INLINE_MARKERS.STRIKETHROUGH;
                break;
            case 'sub_open':
            case 'sub_close':
                if (options.preserveSubscript) result += INLINE_MARKERS.SUB;
                break;
            case 'sup_open':
            case 'sup_close':
                if (options.preserveSuperscript) result += INLINE_MARKERS.SUP;
                break;
            case 'link_open':
                result = handleLinkToken(t, linkStack, result);
                break;
            case 'link_close':
                result = handleLinkCloseToken(linkStack, options, result);
                break;
            case 'emoji':
                if (options.displayEmojis) result += t.content;
                break;
            case 'text': {
                const content = t.content
                    .replace(PLAIN_TEXT_REGEX.FOOTNOTE_REF, '[$1]')
                    .replace(PLAIN_TEXT_REGEX.FOOTNOTE_DEF, '[$1]:');
                result = handleTextToken(t, content, linkStack, options, result);
                break;
            }
            case 'softbreak':
            case 'hardbreak':
                result += '\n';
                break;
            case 'paragraph_close':
                result += '\n\n';
                break;
            case 'blockquote_close': {
                result += '\n\n';
                let k = i + 1;
                while (
                    k < tokens.length &&
                    (tokens[k].type === 'paragraph_open' ||
                        tokens[k].type === 'paragraph_close' ||
                        tokens[k].type === 'softbreak' ||
                        tokens[k].type === 'hardbreak')
                ) {
                    k++;
                }
                if (k < tokens.length && tokens[k].type === 'blockquote_open') {
                    result = result.replace(/\n*$/, '\n\n');
                }
                result = collapseExtraBlankLines(result);
                break;
            }
            default:
                break;
        }
    }
    return result;
}
