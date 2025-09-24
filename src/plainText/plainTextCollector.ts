/**
 * @fileoverview Plain text token collector
 *
 * Walks the markdown-it token stream directly and produces PlainTextBlock[]
 *
 * Architecture:
 * - tokens (md.parse) -> collector (this module) -> PlainTextBlock[] -> formatter
 * - Reuses pure helpers from tokenRenderers for lists, tables, and links.
 * - Keeps inline preservation options (bold/emphasis/etc.) consistent via options.
 */

import type MarkdownIt from 'markdown-it';
import type { Token } from 'markdown-it';
import type { PlainTextOptions } from '../types';
import type { PlainTextBlock } from './plainTextFormatter';
import { PlainTextBlockFormatter } from './plainTextFormatter';
import {
    extractBlockTokens,
    parseListTokens,
    parseTableTokens,
    ListContext,
    handleLinkToken,
    handleLinkCloseToken,
    handleTextToken,
    LinkStackItem,
    collapseExtraBlankLines,
} from './tokenRenderers';
import { PLAIN_TEXT_CONSTANTS, PLAIN_TEXT_REGEX } from '../constants';

/**
 * Collects blocks from markdown string via md.parse.
 */
export function collectPlainTextBlocks(md: MarkdownIt, markdown: string, options: PlainTextOptions): PlainTextBlock[] {
    const tokens = md.parse(markdown, {});
    return collectPlainTextBlocksFromTokens(md, tokens, options, 0);
}

/**
 * Collects blocks from a token slice. Pure; no global renderer state.
 */
export function collectPlainTextBlocksFromTokens(
    md: MarkdownIt,
    tokens: Token[],
    options: PlainTextOptions,
    indentLevel: number
): PlainTextBlock[] {
    const blocks: PlainTextBlock[] = [];
    let currentParagraph: string | null = null;
    let listDepth = indentLevel;
    const linkStack: LinkStackItem[] = [];

    function splitParagraphLines(text: string): string[] {
        return text.split('\n');
    }

    function flushParagraph(): void {
        if (currentParagraph && currentParagraph.length > 0) {
            blocks.push({ type: 'paragraph', lines: splitParagraphLines(currentParagraph) });
        }
        currentParagraph = null;
    }

    function appendText(text: string): void {
        if (!text) return;
        if (currentParagraph !== null) {
            currentParagraph += text;
            return;
        }
        const last = blocks[blocks.length - 1];
        if (last && last.type === 'heading') {
            last.text += text;
            return;
        }
        if (last && last.type === 'paragraph' && last.lines.length > 0) {
            last.lines[last.lines.length - 1] += text;
            return;
        }
        currentParagraph = text;
    }

    function normalizeHeadingLevel(tag?: string): number {
        if (!tag || tag[0] !== 'h') return 1;
        const lvl = parseInt(tag.slice(1), 10);
        if (!Number.isFinite(lvl)) return 1;
        return Math.max(1, Math.min(lvl, 6));
    }

    function buildCodeLines(content: string): string[] {
        if (!content) return [];
        const withoutTrailingNewlines = content.replace(/\n+$/g, '');
        if (!withoutTrailingNewlines) return [];
        return withoutTrailingNewlines.split('\n');
    }

    function renderInlineTokensToString(inlineTokens: Token[], ctx: ListContext, level: number): string {
        const nestedBlocks = collectPlainTextBlocksFromTokens(md, inlineTokens, options, level);
        const formatter = new PlainTextBlockFormatter(options);
        return formatter.format(nestedBlocks);
    }

    function processInline(children: Token[] | null | undefined): void {
        if (!children || !children.length) return;
        for (let j = 0; j < children.length; j++) {
            const c = children[j];
            switch (c.type) {
                case 'text': {
                    const content = c.content
                        .replace(PLAIN_TEXT_REGEX.FOOTNOTE_REF, '[$1]')
                        .replace(PLAIN_TEXT_REGEX.FOOTNOTE_DEF, '[$1]:');
                    const appended = handleTextToken(c, content, linkStack, options, '');
                    if (appended) appendText(appended);
                    break;
                }
                case 'softbreak':
                case 'hardbreak':
                    if (currentParagraph !== null) appendText('\n');
                    break;
                case 'link_open':
                    handleLinkToken(c, linkStack, '');
                    break;
                case 'link_close': {
                    const appended = handleLinkCloseToken(linkStack, options, '');
                    if (appended) appendText(appended);
                    break;
                }
                case 'emoji':
                    if (options.displayEmojis) appendText(c.content);
                    break;
                case 'code_inline':
                    appendText(c.content);
                    break;
                case 'em_open':
                case 'em_close':
                    if (options.preserveEmphasis) appendText(c.markup);
                    break;
                case 'strong_open':
                case 'strong_close':
                    if (options.preserveBold) appendText(c.markup);
                    break;
                case 'mark_open':
                case 'mark_close':
                    if (options.preserveMark) appendText(c.markup);
                    break;
                case 'ins_open':
                case 'ins_close':
                    if (options.preserveInsert) appendText(c.markup);
                    break;
                case 's_open':
                case 's_close':
                    if (options.preserveStrikethrough) appendText(c.markup);
                    break;
                case 'sub_open':
                case 'sub_close':
                    if (options.preserveSubscript) appendText(c.markup);
                    break;
                case 'sup_open':
                case 'sup_close':
                    if (options.preserveSuperscript) appendText(c.markup);
                    break;
                default:
                    break;
            }
        }
    }

    for (let i = 0; i < tokens.length; i++) {
        const t = tokens[i];

        switch (t.type) {
            case 'paragraph_open':
                flushParagraph();
                currentParagraph = '';
                break;

            case 'inline':
                processInline(t.children);
                break;

            case 'paragraph_close':
                if (currentParagraph !== null) {
                    blocks.push({ type: 'paragraph', lines: splitParagraphLines(currentParagraph) });
                    currentParagraph = null;
                }
                break;

            case 'heading_open': {
                flushParagraph();
                const level = normalizeHeadingLevel(t.tag);
                blocks.push({ type: 'heading', level, text: '' });
                break;
            }

            case 'heading_close':
                break;

            case 'blockquote_open': {
                flushParagraph();
                const { blockTokens, endIndex } = extractBlockTokens(tokens, i);
                const inlineText = renderInlineTokensToString(blockTokens, null, listDepth);
                const normalized = collapseExtraBlankLines(inlineText).replace(/^\n+/, '').replace(/\n+$/, '');
                const lines = normalized ? normalized.split('\n') : [];
                if (lines.length) blocks.push({ type: 'blockquote', lines });
                i = endIndex;
                break;
            }

            case 'fence':
            case 'code_block': {
                flushParagraph();
                const lines = buildCodeLines(t.content);
                blocks.push({ type: 'code', lines });
                break;
            }

            case 'bullet_list_open': {
                flushParagraph();
                const { blockTokens, endIndex } = extractBlockTokens(tokens, i);
                const indent = listDepth + 1;
                const items = parseListTokens(blockTokens, { type: 'bullet' }, indent, (inlineTokens, ctx, level) =>
                    renderInlineTokensToString(inlineTokens, ctx, level)
                );
                blocks.push({ type: 'list', items });
                i = endIndex;
                break;
            }

            case 'ordered_list_open': {
                flushParagraph();
                const { blockTokens, endIndex } = extractBlockTokens(tokens, i);
                const startAttr = t.attrGet ? t.attrGet('start') : null;
                const parsed = startAttr ? parseInt(startAttr, 10) : NaN;
                const start = Number.isFinite(parsed) && parsed > 0 ? parsed : 1;
                const indent = listDepth + 1;
                const items = parseListTokens(
                    blockTokens,
                    { type: 'ordered', index: start },
                    indent,
                    (inlineTokens, ctx, level) => renderInlineTokensToString(inlineTokens, ctx, level)
                );
                blocks.push({ type: 'list', items });
                i = endIndex;
                break;
            }

            case 'table_open': {
                flushParagraph();
                const { blockTokens, endIndex } = extractBlockTokens(tokens, i);
                const tableData = parseTableTokens(
                    blockTokens,
                    (inlineTokens, ctx, level) => renderInlineTokensToString(inlineTokens, ctx, level),
                    null,
                    listDepth
                );
                blocks.push({ type: 'table', data: tableData });
                i = endIndex;
                break;
            }

            case 'hr':
            case 'thematic_break': {
                const marker = options.preserveHorizontalRule ? PLAIN_TEXT_CONSTANTS.HORIZONTAL_RULE_MARKER : '\u00A0';
                flushParagraph();
                blocks.push({ type: 'paragraph', lines: [marker] });
                break;
            }

            // Top-level text tokens are rare; handle for completeness.
            case 'text': {
                const content = t.content
                    .replace(PLAIN_TEXT_REGEX.FOOTNOTE_REF, '[$1]')
                    .replace(PLAIN_TEXT_REGEX.FOOTNOTE_DEF, '[$1]:');
                const appended = handleTextToken(t, content, linkStack, options, '');
                if (appended) appendText(appended);
                break;
            }

            default:
                break;
        }
    }

    flushParagraph();
    return blocks;
}
