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

type RendererStateSnapshot = {
    currentParagraph: string | null;
    skipUntilIndex: number | null;
    listDepth: number;
    linkStack: LinkStackItem[];
};

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
        this.installParagraphRules();
        this.installHeadingRules();
        this.installInlineRules();
        this.installBreakRules();
        this.installLinkRules();
        this.installEmphasisRules();
        this.installEmojiAndCodeRules();
        this.installHorizontalRule();
        this.installBlockquoteRules();
        this.installCodeBlockRules();
        this.installListRules();
        this.installTableRules();
    }

    private installParagraphRules(): void {
        const rules = this.md.renderer.rules;

        rules.paragraph_open = (tokens, idx) =>
            this.handleToken(idx, () => {
                this.flushParagraph();
                this.currentParagraph = '';
                return '';
            });

        rules.paragraph_close = (tokens, idx) =>
            this.handleToken(idx, () => {
                if (this.currentParagraph) {
                    this.blocks.push({ type: 'paragraph', lines: this.splitParagraphLines(this.currentParagraph) });
                    this.currentParagraph = null;
                }
                return '';
            });
    }

    private installHeadingRules(): void {
        const rules = this.md.renderer.rules;

        rules.heading_open = (tokens, idx) =>
            this.handleToken(idx, () => {
                this.flushParagraph();
                const token = tokens[idx];
                const level = this.normalizeHeadingLevel(token.tag);
                this.blocks.push({ type: 'heading', level, text: '' });
                return '';
            });

        rules.heading_close = (_tokens, idx) => this.handleToken(idx, () => '');
    }

    private installInlineRules(): void {
        const rules = this.md.renderer.rules;

        rules.text = (tokens, idx) =>
            this.handleToken(idx, () => {
                const token = tokens[idx];
                const content = token.content
                    .replace(PLAIN_TEXT_REGEX.FOOTNOTE_REF, '[$1]')
                    .replace(PLAIN_TEXT_REGEX.FOOTNOTE_DEF, '[$1]:');
                const appended = handleTextToken(token, content, this.linkStack, this.options, '');
                if (appended) {
                    this.appendText(appended);
                }
                return '';
            });
    }

    private installBreakRules(): void {
        const rules = this.md.renderer.rules;

        const createBreakHandler = () => (tokens: Token[], idx: number) =>
            this.handleToken(idx, () => {
                if (this.currentParagraph !== null) {
                    this.currentParagraph += '\n';
                }
                return '';
            });

        rules.softbreak = createBreakHandler();
        rules.hardbreak = createBreakHandler();
    }

    private installLinkRules(): void {
        const rules = this.md.renderer.rules;

        rules.link_open = (tokens, idx) =>
            this.handleToken(idx, () => {
                handleLinkToken(tokens[idx], this.linkStack, '');
                return '';
            });

        rules.link_close = (_tokens, idx) =>
            this.handleToken(idx, () => {
                const appended = handleLinkCloseToken(this.linkStack, this.options, '');
                if (appended) {
                    this.appendText(appended);
                }
                return '';
            });
    }

    private installEmphasisRules(): void {
        const rules = this.md.renderer.rules;

        const createMarkerHandler = (shouldPreserve: boolean, marker: string) => (_tokens: Token[], idx: number) =>
            this.handleToken(idx, () => {
                if (shouldPreserve) this.appendText(marker);
                return '';
            });

        const emphasisHandler = (tokens: Token[], idx: number) =>
            this.handleToken(idx, () => {
                if (this.options.preserveEmphasis) this.appendText(tokens[idx].markup);
                return '';
            });

        const boldHandler = (tokens: Token[], idx: number) =>
            this.handleToken(idx, () => {
                if (this.options.preserveBold) this.appendText(tokens[idx].markup);
                return '';
            });

        rules.em_open = emphasisHandler;
        rules.em_close = emphasisHandler;

        rules.strong_open = boldHandler;
        rules.strong_close = boldHandler;

        const markHandler = createMarkerHandler(this.options.preserveMark, INLINE_MARKERS.MARK);
        rules.mark_open = markHandler;
        rules.mark_close = markHandler;

        const insertHandler = createMarkerHandler(this.options.preserveInsert, INLINE_MARKERS.INSERT);
        rules.ins_open = insertHandler;
        rules.ins_close = insertHandler;

        const strikeHandler = createMarkerHandler(this.options.preserveStrikethrough, INLINE_MARKERS.STRIKETHROUGH);
        rules.s_open = strikeHandler;
        rules.s_close = strikeHandler;

        const subHandler = createMarkerHandler(this.options.preserveSubscript, INLINE_MARKERS.SUB);
        rules.sub_open = subHandler;
        rules.sub_close = subHandler;

        const supHandler = createMarkerHandler(this.options.preserveSuperscript, INLINE_MARKERS.SUP);
        rules.sup_open = supHandler;
        rules.sup_close = supHandler;
    }

    private installEmojiAndCodeRules(): void {
        const rules = this.md.renderer.rules;

        rules.emoji = (tokens, idx) =>
            this.handleToken(idx, () => {
                if (this.options.displayEmojis) this.appendText(tokens[idx].content);
                return '';
            });

        rules.code_inline = (tokens, idx) =>
            this.handleToken(idx, () => {
                this.appendText(tokens[idx].content);
                return '';
            });
    }

    private installHorizontalRule(): void {
        const rules = this.md.renderer.rules;

        rules.hr = (_tokens, idx) =>
            this.handleToken(idx, () => {
                const marker = this.options.preserveHorizontalRule
                    ? PLAIN_TEXT_CONSTANTS.HORIZONTAL_RULE_MARKER
                    : '\u00A0';
                this.flushParagraph();
                this.blocks.push({ type: 'paragraph', lines: [marker] });
                return '';
            });

        rules.thematic_break = rules.hr;
    }

    private installBlockquoteRules(): void {
        const rules = this.md.renderer.rules;

        rules.blockquote_open = (tokens, idx) =>
            this.handleToken(idx, () => {
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
            });

        rules.blockquote_close = (_tokens, idx) => this.handleToken(idx, () => '');
    }

    private installCodeBlockRules(): void {
        const rules = this.md.renderer.rules;

        const handler = (tokens: Token[], idx: number) =>
            this.handleToken(idx, () => {
                this.flushParagraph();
                const token = tokens[idx];
                const lines = this.buildCodeLines(token.content);
                this.blocks.push({ type: 'code', lines });
                return '';
            });

        rules.fence = handler;
        rules.code_block = handler;
    }

    private installListRules(): void {
        const rules = this.md.renderer.rules;

        rules.bullet_list_open = (tokens, idx) =>
            this.handleToken(idx, () => {
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
            });

        rules.ordered_list_open = (tokens, idx) =>
            this.handleToken(idx, () => {
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
            });

        rules.bullet_list_close = (_tokens, idx) => this.handleToken(idx, () => '');

        rules.ordered_list_close = (_tokens, idx) => this.handleToken(idx, () => '');

        rules.list_item_open = (_tokens, idx) => this.handleToken(idx, () => '');

        rules.list_item_close = (_tokens, idx) => this.handleToken(idx, () => '');
    }

    private installTableRules(): void {
        const rules = this.md.renderer.rules;

        rules.table_open = (tokens, idx) =>
            this.handleToken(idx, () => {
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
            });

        rules.table_close = (_tokens, idx) => this.handleToken(idx, () => '');
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
        if (this.skipUntilIndex === null) return false;
        return index <= this.skipUntilIndex;
    }

    private consumeSkipIfNeeded(index?: number): void {
        if (typeof index !== 'number') return;
        if (this.skipUntilIndex !== null && index >= this.skipUntilIndex) {
            this.skipUntilIndex = null;
        }
    }

    private handleToken<T>(index: number, handler: () => T, defaultValue: T = '' as unknown as T): T {
        if (this.shouldSkipToken(index)) {
            this.consumeSkipIfNeeded(index);
            return defaultValue;
        }
        return handler();
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
        const snapshot = this.captureState();

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

        this.restoreState(snapshot);
        this.fragmentStack.pop();

        return formatted;
    }

    private captureState(): RendererStateSnapshot {
        return {
            currentParagraph: this.currentParagraph,
            skipUntilIndex: this.skipUntilIndex,
            listDepth: this.listDepth,
            linkStack: this.linkStack,
        };
    }

    private restoreState(snapshot: RendererStateSnapshot): void {
        this.currentParagraph = snapshot.currentParagraph;
        this.skipUntilIndex = snapshot.skipUntilIndex;
        this.listDepth = snapshot.listDepth;
        this.linkStack = snapshot.linkStack;
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
        return withoutTrailingNewlines.split('\n');
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
