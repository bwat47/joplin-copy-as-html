/**
 * @fileoverview Plain text block definitions and formatter skeleton.
 *
 * Phase 1 introduces a block-based formatter that will become the second pass
 * for plain text rendering. It focuses on paragraph and heading support along
 * with explicit inter-block spacing rules.
 */

import { PLAIN_TEXT_CONSTANTS } from '../constants';
import type { PlainTextOptions, ListItem, TableData } from '../types';
import { formatList, formatTable, calculateColumnWidths } from './tokenRenderers';

export type PlainTextParagraphBlock = {
    type: 'paragraph';
    lines: string[];
};

export type PlainTextHeadingBlock = {
    type: 'heading';
    level: number;
    text: string;
};

export type PlainTextRawBlock = {
    type: 'raw';
    text: string;
};

export type PlainTextListBlock = {
    type: 'list';
    items: ListItem[];
};

export type PlainTextTableBlock = {
    type: 'table';
    data: TableData;
};

export type PlainTextCodeBlock = {
    type: 'code';
    lines: string[];
};

export type PlainTextBlockquoteBlock = {
    type: 'blockquote';
    lines: string[];
};

export type PlainTextBlock =
    | PlainTextParagraphBlock
    | PlainTextHeadingBlock
    | PlainTextRawBlock
    | PlainTextListBlock
    | PlainTextTableBlock
    | PlainTextCodeBlock
    | PlainTextBlockquoteBlock;

export type PlainTextBlockType = PlainTextBlock['type'];

export type BlockSpacingRules = Partial<Record<PlainTextBlockType, Partial<Record<PlainTextBlockType, boolean>>>>;

/**
 * Default spacing rules between adjacent blocks.
 * A value of `true` indicates that a blank line should be inserted before the
 * current block when it follows the previous block type.
 */
export const DEFAULT_BLOCK_SPACING_RULES: Readonly<BlockSpacingRules> = {
    heading: {
        heading: true,
        paragraph: true,
        raw: true,
        list: true,
        table: true,
        code: true,
        blockquote: true,
    },
    paragraph: {
        heading: true,
        paragraph: true,
        raw: true,
        list: true,
        table: true,
        code: true,
        blockquote: true,
    },
    raw: {
        heading: true,
        paragraph: true,
        list: true,
        table: true,
        code: true,
        blockquote: true,
    },
    list: {
        heading: true,
        paragraph: true,
        raw: true,
        table: true,
        code: true,
        blockquote: true,
    },
    table: {
        heading: true,
        paragraph: true,
        raw: true,
        list: true,
        code: true,
        blockquote: true,
    },
    code: {
        heading: true,
        paragraph: true,
        raw: true,
        list: true,
        table: true,
        blockquote: true,
        code: true,
    },
    blockquote: {
        heading: true,
        paragraph: true,
        raw: true,
        list: true,
        table: true,
        code: true,
        blockquote: true,
    },
};

function needsBlankLine(
    previous: PlainTextBlock | undefined,
    current: PlainTextBlock,
    rules: BlockSpacingRules
): boolean {
    if (!previous) return false;
    return !!rules[previous.type]?.[current.type];
}

function pushBlankLine(buffer: string[]): void {
    if (buffer.length === 0) return;
    if (buffer[buffer.length - 1] !== '') {
        buffer.push('');
    }
}

/**
 * Responsible for converting semantic blocks into the final plain text output.
 */
export class PlainTextBlockFormatter {
    private readonly options: PlainTextOptions;
    private readonly spacingRules: BlockSpacingRules;

    constructor(options: PlainTextOptions, spacingRules: BlockSpacingRules = DEFAULT_BLOCK_SPACING_RULES) {
        this.options = options;
        this.spacingRules = spacingRules;
    }

    format(blocks: PlainTextBlock[]): string {
        const lines: string[] = [];
        let previousBlock: PlainTextBlock | undefined;

        for (const block of blocks) {
            if (needsBlankLine(previousBlock, block, this.spacingRules)) {
                pushBlankLine(lines);
            }

            switch (block.type) {
                case 'paragraph':
                    this.renderParagraph(block, lines);
                    break;
                case 'heading':
                    this.renderHeading(block, lines);
                    break;
                case 'raw':
                    this.renderRaw(block, lines);
                    break;
                case 'list':
                    this.renderList(block, lines);
                    break;
                case 'table':
                    this.renderTable(block, lines);
                    break;
                case 'code':
                    this.renderCode(block, lines);
                    break;
                case 'blockquote':
                    this.renderBlockquote(block, lines);
                    break;
                default:
                    break;
            }

            previousBlock = block;
        }

        return lines.join('\n').replace(/\n+$/g, '\n').trimEnd();
    }

    private renderParagraph(block: PlainTextParagraphBlock, lines: string[]): void {
        lines.push(...block.lines);
    }

    private renderHeading(block: PlainTextHeadingBlock, lines: string[]): void {
        if (this.options.preserveHeading) {
            const level = Math.min(Math.max(block.level, 1), 6);
            const prefix = PLAIN_TEXT_CONSTANTS.HEADING_PREFIX_CHAR.repeat(level);
            lines.push(`${prefix} ${block.text}`.trim());
        } else {
            lines.push(block.text);
        }
    }

    private renderRaw(block: PlainTextRawBlock, lines: string[]): void {
        lines.push(block.text);
    }

    private renderList(block: PlainTextListBlock, lines: string[]): void {
        const formatted = formatList(block.items, this.options).replace(/\n+$/g, '');
        if (!formatted) return;
        lines.push(...formatted.split('\n'));
    }

    private renderTable(block: PlainTextTableBlock, lines: string[]): void {
        const colWidths = calculateColumnWidths(block.data);
        const formatted = formatTable(block.data, colWidths).replace(/\n+$/g, '');
        if (!formatted) return;
        lines.push(...formatted.split('\n'));
    }

    private renderCode(block: PlainTextCodeBlock, lines: string[]): void {
        if (!block.lines.length) {
            lines.push('');
            return;
        }
        lines.push(...block.lines);
    }

    private renderBlockquote(block: PlainTextBlockquoteBlock, lines: string[]): void {
        if (!block.lines.length) return;
        lines.push(...block.lines);
    }
}
