/**
 * @fileoverview Plain text parsing helpers
 *
 * Provides shared utilities for the block-based plain text renderer: table/list
 * parsing, link handling, unescape helpers, and spacing utilities.
 */

import type { Token } from 'markdown-it';
import { PlainTextOptions, TableData, TableRow, ListItem } from '../types';
import { PLAIN_TEXT_CONSTANTS } from '../constants';
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
    renderFragment: TokenFragmentRenderer,
    listContext: ListContext,
    indentLevel: number
): TableData {
    if (!renderFragment) throw new Error('renderFragment is required to parse table tokens');
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
                    cellContent += renderFragment(inner.children, listContext, indentLevel);
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
 * Parses list-related tokens into a structured array of ListItem objects.
 */
export function parseListTokens(
    listTokens: Token[],
    listContext: ListContext,
    indentLevel: number,
    renderFragment: TokenFragmentRenderer
): ListItem[] {
    if (!renderFragment) throw new Error('renderFragment is required to parse list tokens');
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
            const content = renderFragment(itemTokens, listContext, indentLevel);
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
