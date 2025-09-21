/**
 * @fileoverview Plain text renderer leveraging markdown-it renderer hooks to
 * collect semantic blocks. The renderer currently supports paragraphs,
 * headings, lists, tables, blockquotes, and code blocks while preserving the
 * existing plugin configuration.
 */

import type MarkdownIt from 'markdown-it';
import type { Token } from 'markdown-it';
import type { PlainTextOptions } from '../types';
import { PlainTextBlockFormatter, PlainTextBlock } from './plainTextFormatter';
import {
    extractBlockTokens,
    parseListTokens,
    parseTableTokens,
    ListContext,
    collapseExtraBlankLines,
    handleLinkToken,
    handleLinkCloseToken,
    handleTextToken,
    LinkStackItem,
} from './tokenRenderers';
import { INLINE_MARKERS, PLAIN_TEXT_CONSTANTS, PLAIN_TEXT_REGEX } from '../constants';

/**
 * Collector that uses markdown-it renderer hooks to build semantic blocks.
 */
export class PlainTextRenderer {
    private readonly md: MarkdownIt;
    private readonly options: PlainTextOptions;
    private readonly blocks: PlainTextBlock[] = [];
    private currentParagraph: string | null = null;
    private skipUntilIndex: number | null = null;
    private listDepth = 0;
    private linkStack: LinkStackItem[] = [];
    private readonly fragmentStack: number[] = [];

    constructor(md: MarkdownIt, options: PlainTextOptions) {
        this.md = md;
        this.options = options;
    }

    render(markdown: string): string {
        this.blocks.length = 0;
        this.currentParagraph = null;
        this.skipUntilIndex = null;
        this.listDepth = 0;
        this.linkStack = [];
        return this.withScopedRules(() => {
            this.installCustomRules();
            const tokens = this.md.parse(markdown, {});
            this.md.renderer.render(tokens, this.md.options, {});
            this.flushParagraph();
            return new PlainTextBlockFormatter(this.options).format(this.blocks);
        });
    }

    private withScopedRules<T>(run: () => T): T {
        const renderer = this.md.renderer;
        const originalRules = renderer.rules;
        const tempRules: typeof originalRules = { ...originalRules };
        renderer.rules = tempRules;
        try {
            return run();
        } finally {
            renderer.rules = originalRules;
        }
    }

    private installCustomRules(): void {
        const rendererRules = this.md.renderer.rules;

        rendererRules.paragraph_open = (tokens, idx) => {
            if (this.shouldSkipToken(idx)) return '';
            this.flushParagraph();
            this.currentParagraph = '';
            return '';
        };

        rendererRules.paragraph_close = (tokens, idx) => {
            if (this.shouldSkipToken(idx)) return '';
            if (this.currentParagraph) {
                this.blocks.push({ type: 'paragraph', lines: this.splitParagraphLines(this.currentParagraph) });
                this.currentParagraph = null;
            }
            return '';
        };

        rendererRules.heading_open = (tokens, idx) => {
            if (this.shouldSkipToken(idx)) return '';
            this.flushParagraph();
            const token = tokens[idx];
            const level = this.normalizeHeadingLevel(token.tag);
            this.blocks.push({ type: 'heading', level, text: '' });
            return '';
        };

        rendererRules.heading_close = (tokens, idx) => {
            this.shouldSkipToken(idx);
            return '';
        };

        rendererRules.text = (tokens, idx) => {
            if (this.shouldSkipToken(idx)) return '';
            const token = tokens[idx];
            const content = token.content
                .replace(PLAIN_TEXT_REGEX.FOOTNOTE_REF, '[$1]')
                .replace(PLAIN_TEXT_REGEX.FOOTNOTE_DEF, '[$1]:');
            const appended = handleTextToken(token, content, this.linkStack, this.options, '');
            if (appended) {
                this.appendText(appended);
            }
            return '';
        };

        rendererRules.softbreak = (tokens, idx) => {
            if (this.shouldSkipToken(idx)) return '';
            if (this.currentParagraph !== null) {
                this.currentParagraph += '\n';
            }
            return '';
        };

        rendererRules.hardbreak = (tokens, idx) => {
            if (this.shouldSkipToken(idx)) return '';
            if (this.currentParagraph !== null) {
                this.currentParagraph += '\n';
            }
            return '';
        };

        rendererRules.link_open = (tokens, idx) => {
            if (this.shouldSkipToken(idx)) return '';
            handleLinkToken(tokens[idx], this.linkStack, '');
            return '';
        };

        rendererRules.link_close = (tokens, idx) => {
            if (this.shouldSkipToken(idx)) return '';
            const appended = handleLinkCloseToken(this.linkStack, this.options, '');
            if (appended) {
                this.appendText(appended);
            }
            return '';
        };

        rendererRules.em_open = (tokens, idx) => {
            if (this.shouldSkipToken(idx)) return '';
            if (this.options.preserveEmphasis) this.appendText(tokens[idx].markup);
            return '';
        };

        rendererRules.em_close = rendererRules.em_open;

        rendererRules.strong_open = (tokens, idx) => {
            if (this.shouldSkipToken(idx)) return '';
            if (this.options.preserveBold) this.appendText(tokens[idx].markup);
            return '';
        };

        rendererRules.strong_close = rendererRules.strong_open;

        rendererRules.mark_open = (tokens, idx) => {
            if (this.shouldSkipToken(idx)) return '';
            if (this.options.preserveMark) this.appendText(INLINE_MARKERS.MARK);
            return '';
        };

        rendererRules.mark_close = rendererRules.mark_open;

        rendererRules.ins_open = (tokens, idx) => {
            if (this.shouldSkipToken(idx)) return '';
            if (this.options.preserveInsert) this.appendText(INLINE_MARKERS.INSERT);
            return '';
        };

        rendererRules.ins_close = rendererRules.ins_open;

        rendererRules.s_open = (tokens, idx) => {
            if (this.shouldSkipToken(idx)) return '';
            if (this.options.preserveStrikethrough) this.appendText(INLINE_MARKERS.STRIKETHROUGH);
            return '';
        };

        rendererRules.s_close = rendererRules.s_open;

        rendererRules.sub_open = (tokens, idx) => {
            if (this.shouldSkipToken(idx)) return '';
            if (this.options.preserveSubscript) this.appendText(INLINE_MARKERS.SUB);
            return '';
        };

        rendererRules.sub_close = rendererRules.sub_open;

        rendererRules.sup_open = (tokens, idx) => {
            if (this.shouldSkipToken(idx)) return '';
            if (this.options.preserveSuperscript) this.appendText(INLINE_MARKERS.SUP);
            return '';
        };

        rendererRules.sup_close = rendererRules.sup_open;

        rendererRules.emoji = (tokens, idx) => {
            if (this.shouldSkipToken(idx)) return '';
            if (this.options.displayEmojis) this.appendText(tokens[idx].content);
            return '';
        };

        rendererRules.code_inline = (tokens, idx) => {
            if (this.shouldSkipToken(idx)) return '';
            this.appendText(tokens[idx].content);
            return '';
        };

        rendererRules.hr = (tokens, idx) => {
            if (this.shouldSkipToken(idx)) return '';
            const marker = this.options.preserveHorizontalRule ? PLAIN_TEXT_CONSTANTS.HORIZONTAL_RULE_MARKER : '\u00A0';
            this.flushParagraph();
            this.blocks.push({ type: 'paragraph', lines: [marker] });
            return '';
        };

        rendererRules.thematic_break = rendererRules.hr;

        rendererRules.blockquote_open = (tokens, idx) => {
            if (this.shouldSkipToken(idx)) return '';
            this.flushParagraph();
            const { blockTokens, endIndex } = extractBlockTokens(tokens, idx);
            this.setSkipUntil(endIndex);
            const fragment = this.renderTokenFragment(blockTokens, null, this.listDepth);
            const normalized = collapseExtraBlankLines(fragment).replace(/^\n+/, '').replace(/\n+$/, '');
            const lines = normalized ? normalized.split('\n') : [];
            if (lines.length) {
                this.blocks.push({ type: 'blockquote', lines });
            }
            return '';
        };

        rendererRules.blockquote_close = (tokens, idx) => {
            this.shouldSkipToken(idx);
            return '';
        };

        rendererRules.fence = (tokens, idx) => {
            if (this.shouldSkipToken(idx)) return '';
            this.flushParagraph();
            const token = tokens[idx];
            const lines = this.buildCodeLines(token.content);
            this.blocks.push({ type: 'code', lines });
            return '';
        };

        rendererRules.code_block = (tokens, idx) => {
            if (this.shouldSkipToken(idx)) return '';
            this.flushParagraph();
            const token = tokens[idx];
            const lines = this.buildCodeLines(token.content);
            this.blocks.push({ type: 'code', lines });
            return '';
        };

        rendererRules.bullet_list_open = (tokens, idx) => {
            if (this.shouldSkipToken(idx)) return '';
            this.flushParagraph();
            const { blockTokens, endIndex } = extractBlockTokens(tokens, idx);
            this.setSkipUntil(endIndex);
            const previousDepth = this.listDepth;
            const indentLevel = previousDepth + 1;
            this.listDepth = indentLevel;
            try {
                const items = parseListTokens(
                    blockTokens,
                    { type: 'bullet' },
                    indentLevel,
                    (fragmentTokens, ctx, level) => this.renderTokenFragment(fragmentTokens, ctx, level)
                );
                this.blocks.push({ type: 'list', items });
            } finally {
                this.listDepth = previousDepth;
            }
            return '';
        };

        rendererRules.bullet_list_close = (tokens, idx) => {
            this.shouldSkipToken(idx);
            return '';
        };

        rendererRules.ordered_list_open = (tokens, idx) => {
            if (this.shouldSkipToken(idx)) return '';
            this.flushParagraph();
            const { blockTokens, endIndex } = extractBlockTokens(tokens, idx);
            this.setSkipUntil(endIndex);
            const start = this.getOrderedListStart(tokens[idx]);
            const previousDepth = this.listDepth;
            const indentLevel = previousDepth + 1;
            this.listDepth = indentLevel;
            try {
                const items = parseListTokens(
                    blockTokens,
                    { type: 'ordered', index: start },
                    indentLevel,
                    (fragmentTokens, ctx, level) => this.renderTokenFragment(fragmentTokens, ctx, level)
                );
                this.blocks.push({ type: 'list', items });
            } finally {
                this.listDepth = previousDepth;
            }
            return '';
        };

        rendererRules.ordered_list_close = (tokens, idx) => {
            this.shouldSkipToken(idx);
            return '';
        };

        rendererRules.list_item_open = (tokens, idx) => {
            this.shouldSkipToken(idx);
            return '';
        };

        rendererRules.list_item_close = (tokens, idx) => {
            this.shouldSkipToken(idx);
            return '';
        };

        rendererRules.table_open = (tokens, idx) => {
            if (this.shouldSkipToken(idx)) return '';
            this.flushParagraph();
            const { blockTokens, endIndex } = extractBlockTokens(tokens, idx);
            this.setSkipUntil(endIndex);
            const tableData = parseTableTokens(
                blockTokens,
                (fragmentTokens, ctx, level) => this.renderTokenFragment(fragmentTokens, ctx, level),
                null,
                this.listDepth
            );
            this.blocks.push({ type: 'table', data: tableData });
            return '';
        };

        rendererRules.table_close = (tokens, idx) => {
            this.shouldSkipToken(idx);
            return '';
        };
    }

    private flushParagraph(): void {
        if (this.currentParagraph && this.currentParagraph.length > 0) {
            this.blocks.push({ type: 'paragraph', lines: this.splitParagraphLines(this.currentParagraph) });
        }
        this.currentParagraph = null;
    }

    private splitParagraphLines(text: string): string[] {
        return text.split('\n');
    }

    private shouldSkipToken(index?: number): boolean {
        if (typeof index !== 'number') return false;
        if (this.skipUntilIndex === null) {
            return false;
        }
        if (index < this.skipUntilIndex) {
            return true;
        }
        if (index === this.skipUntilIndex) {
            this.skipUntilIndex = null;
            return true;
        }
        this.skipUntilIndex = null;
        return false;
    }

    private setSkipUntil(index: number): void {
        if (this.skipUntilIndex === null || index > this.skipUntilIndex) {
            this.skipUntilIndex = index;
        }
    }

    private appendText(text: string): void {
        if (!text) return;
        if (this.currentParagraph !== null) {
            this.currentParagraph += text;
            return;
        }
        const fragmentBase = this.fragmentStack.length ? this.fragmentStack[this.fragmentStack.length - 1] : 0;
        const lastIndex = this.blocks.length - 1;
        if (lastIndex >= fragmentBase && this.blocks.length > 0) {
            const lastBlock = this.blocks[this.blocks.length - 1];
            if (lastBlock.type === 'heading') {
                lastBlock.text += text;
                return;
            }
            if (lastBlock.type === 'paragraph' && lastBlock.lines.length > 0) {
                lastBlock.lines[lastBlock.lines.length - 1] += text;
                return;
            }
        }
        this.currentParagraph = text;
    }

    private renderTokenFragment(tokens: Token[], _listContext: ListContext, indentLevel: number): string {
        const originalLength = this.blocks.length;
        this.fragmentStack.push(originalLength);
        const previousParagraph = this.currentParagraph;
        const previousSkip = this.skipUntilIndex;
        const previousDepth = this.listDepth;
        const previousLinkStack = this.linkStack;

        this.currentParagraph = null;
        this.skipUntilIndex = null;
        this.listDepth = indentLevel;
        this.linkStack = [];

        this.md.renderer.render(tokens, this.md.options, {});

        if (this.currentParagraph && this.currentParagraph.length > 0) {
            this.blocks.push({ type: 'paragraph', lines: this.splitParagraphLines(this.currentParagraph) });
            this.currentParagraph = null;
        }

        const fragmentBlocks = this.blocks.splice(originalLength);
        const formatted = new PlainTextBlockFormatter(this.options).format(fragmentBlocks);

        this.currentParagraph = previousParagraph;
        this.skipUntilIndex = previousSkip;
        this.listDepth = previousDepth;
        this.linkStack = previousLinkStack;
        this.fragmentStack.pop();

        return formatted;
    }

    private getOrderedListStart(token: Token): number {
        const startAttr = token.attrGet ? token.attrGet('start') : null;
        const parsed = startAttr ? parseInt(startAttr, 10) : NaN;
        if (Number.isFinite(parsed) && parsed > 0) {
            return parsed;
        }
        return 1;
    }

    private buildCodeLines(content: string): string[] {
        if (!content) return [];
        const withoutTrailingNewlines = content.replace(/\n+$/g, '');
        if (!withoutTrailingNewlines) return [];
        const lines = withoutTrailingNewlines.split('\n');
        if (
            lines.length > 2 &&
            lines[0].trim().startsWith(PLAIN_TEXT_CONSTANTS.CODE_FENCE_MARKER) &&
            lines[lines.length - 1].trim().startsWith(PLAIN_TEXT_CONSTANTS.CODE_FENCE_MARKER)
        ) {
            return lines.slice(1, -1);
        }
        return lines;
    }

    private normalizeHeadingLevel(tag?: string): number {
        if (!tag || tag[0] !== 'h') return 1;
        const level = parseInt(tag.slice(1), 10);
        if (!Number.isFinite(level)) return 1;
        return Math.max(1, Math.min(level, 6));
    }
}

export function renderMarkdownToPlainText(md: MarkdownIt, markdown: string, options: PlainTextOptions): string {
    const renderer = new PlainTextRenderer(md, options);
    return renderer.render(markdown);
}
