/**
 * @fileoverview Remark-based plain text renderer.
 *
 * Parses Markdown to mdast, then renders the AST directly to paste-friendly
 * plain text with the plugin's preservation settings.
 */

import type { Root } from 'mdast';
import * as nodeEmoji from 'node-emoji';
import stringWidth from 'string-width';
import remarkEmoji from 'remark-emoji';
import remarkFlexibleMarkers from 'remark-flexible-markers';
import remarkGfm from 'remark-gfm';
import remarkIns from 'remark-ins';
import remarkParse from 'remark-parse';
import remarkSupersub from 'remark-supersub';
import { unified } from 'unified';
import type { Plugin } from 'unified';
import { PLAIN_TEXT_CONSTANTS, PLAIN_TEXT_REGEX } from '../constants';
import { logger } from '../logger';
import type { PlainTextOptions } from '../types';

type PlainTextNode = {
    type: string;
    value?: string;
    identifier?: string;
    label?: string;
    url?: string;
    depth?: number;
    ordered?: boolean;
    start?: number;
    checked?: boolean | null;
    children?: PlainTextNode[];
};

const EMOJI_SHORTCODE_PATTERN = /:([+\w-]+):/g;

const domParser: DOMParser | null = typeof DOMParser !== 'undefined' ? new DOMParser() : null;

function createRemarkProcessor(displayEmojis: boolean) {
    const processor = unified()
        .use(remarkParse)
        .use(remarkGfm, { singleTilde: false })
        .use(remarkSupersub)
        .use(remarkIns)
        .use(remarkFlexibleMarkers);

    if (displayEmojis) {
        processor.use(remarkEmoji);
    } else {
        processor.use(stripEmojiShortcodes);
    }

    return processor;
}

const stripEmojiShortcodes: Plugin<[], Root> = () => {
    return (tree: Root): void => {
        walkTextNodes(tree as unknown as PlainTextNode, (node) => {
            node.value = (node.value ?? '').replace(EMOJI_SHORTCODE_PATTERN, (match, key: string) => {
                return nodeEmoji.has(key) ? '' : match;
            });
        });
    };
};

function walkTextNodes(node: PlainTextNode, visitor: (node: PlainTextNode) => void): void {
    if (node.type === 'text') {
        visitor(node);
    }

    for (const child of node.children ?? []) {
        walkTextNodes(child, visitor);
    }
}

function htmlFragmentToPlainText(html: string): string {
    if (!html) return '';
    if (!domParser) {
        logger.warn('DOMParser not available - cannot extract text from HTML');
        return '';
    }

    const doc = domParser.parseFromString(`<body>${html}</body>`, 'text/html');
    const body = doc.body;
    if (!body) return '';

    body.querySelectorAll('br').forEach((br) => {
        br.replaceWith(doc.createTextNode('\n'));
    });

    const text = body.textContent ?? '';
    return text
        .replace(/\u00A0/g, ' ')
        .replace(/\n[\t ]+/g, '\n')
        .trim();
}

function isExternalHttpUrl(url: string): boolean {
    return /^https?:\/\/./i.test(url);
}

function unescapeMarkdownText(text: string): string {
    return text.replace(/\\([*_~^`#])/g, '$1').replace(/\u00A0/g, ' ');
}

function normalizeBlockText(text: string): string {
    return text.replace(/\n{3,}/g, '\n'.repeat(PLAIN_TEXT_CONSTANTS.MAX_PARAGRAPH_NEWLINES)).trim();
}

function renderChildrenInline(children: PlainTextNode[] | undefined, options: PlainTextOptions): string {
    return (children ?? []).map((child) => renderInlineNode(child, options)).join('');
}

function renderInlineWithMarkers(
    node: PlainTextNode,
    options: PlainTextOptions,
    preserve: boolean,
    marker: string
): string {
    const text = renderChildrenInline(node.children, options);
    return preserve ? `${marker}${text}${marker}` : text;
}

function renderInlineNode(node: PlainTextNode, options: PlainTextOptions): string {
    switch (node.type) {
        case 'text':
            return unescapeMarkdownText((node.value ?? '').replace(PLAIN_TEXT_REGEX.FOOTNOTE_REF, '[$1]'));
        case 'inlineCode':
            return node.value ?? '';
        case 'break':
            return '\n';
        case 'html':
            return htmlFragmentToPlainText(node.value ?? '');
        case 'emphasis':
            return renderInlineWithMarkers(node, options, options.preserveEmphasis, '*');
        case 'strong':
            return renderInlineWithMarkers(node, options, options.preserveBold, '**');
        case 'delete':
            return renderInlineWithMarkers(node, options, options.preserveStrikethrough, '~~');
        case 'insert':
            return renderInlineWithMarkers(node, options, options.preserveInsert, '++');
        case 'mark':
            return renderInlineWithMarkers(node, options, options.preserveMark, '==');
        case 'subscript':
            return renderInlineWithMarkers(node, options, options.preserveSubscript, '~');
        case 'superscript':
            return renderInlineWithMarkers(node, options, options.preserveSuperscript, '^');
        case 'link': {
            const text = renderChildrenInline(node.children, options);
            const url = node.url ?? '';
            if (!isExternalHttpUrl(url)) return text;
            if (options.hyperlinkBehavior === 'url') return url;
            if (options.hyperlinkBehavior === 'markdown') return `[${text}](${url})`;
            return text;
        }
        case 'footnoteReference':
            return `[${node.label ?? node.identifier ?? ''}]`;
        case 'image':
        case 'imageReference':
            return '';
        default:
            return renderChildrenInline(node.children, options);
    }
}

function indentUnit(options: PlainTextOptions): string {
    return options.indentType === 'tabs' ? '\t' : ' '.repeat(PLAIN_TEXT_CONSTANTS.SPACES_PER_INDENT);
}

function renderListItemContent(node: PlainTextNode, options: PlainTextOptions, depth: number): string[] {
    const lines: string[] = [];

    for (const child of node.children ?? []) {
        if (child.type === 'paragraph') {
            const paragraph = normalizeBlockText(renderChildrenInline(child.children, options));
            if (options.listSpacing === 'loose' && paragraph && lines.length > 0 && lines[lines.length - 1] !== '') {
                lines.push('');
            }
            if (paragraph) lines.push(...paragraph.split('\n'));
            continue;
        }

        if (
            options.listSpacing === 'loose' &&
            child.type === 'list' &&
            lines.length > 0 &&
            lines[lines.length - 1] !== ''
        ) {
            lines.push('');
        }

        const block = renderBlockNode(child, options, child.type === 'list' ? depth : depth + 1);
        if (block) lines.push(...block.split('\n'));
    }

    return lines;
}

function renderListNode(node: PlainTextNode, options: PlainTextOptions, depth: number): string {
    const lines: string[] = [];
    const start = node.start ?? PLAIN_TEXT_CONSTANTS.ORDERED_LIST_START;
    const indent = indentUnit(options).repeat(Math.max(0, depth));

    const items = node.children ?? [];

    items.forEach((item, index) => {
        const ordered = !!node.ordered;
        const taskMarker = typeof item.checked === 'boolean' ? `[${item.checked ? 'x' : ' '}] ` : '';
        const marker = ordered
            ? `${start + index}${PLAIN_TEXT_CONSTANTS.ORDERED_SUFFIX}`
            : PLAIN_TEXT_CONSTANTS.BULLET_PREFIX;
        const itemLines = renderListItemContent(item, options, depth);
        const firstLine = itemLines.shift() ?? '';

        lines.push(`${indent}${marker}${taskMarker}${firstLine}`);
        for (const line of itemLines) {
            lines.push(line ? `${indent}${indentUnit(options)}${line}` : '');
        }

        if (options.listSpacing === 'loose' && index < items.length - 1) {
            lines.push('');
        }
    });

    return lines.join('\n');
}

function renderTableNode(node: PlainTextNode, options: PlainTextOptions): string {
    const rows = (node.children ?? []).map((row) =>
        (row.children ?? []).map((cell) => normalizeBlockText(renderChildrenInline(cell.children, options)))
    );

    if (!rows.length) return '';

    const columnWidths: number[] = [];
    for (const row of rows) {
        row.forEach((cell, index) => {
            columnWidths[index] = Math.max(columnWidths[index] ?? 0, stringWidth(cell));
        });
    }

    function padCell(cell: string, width: number): string {
        const pad = width - stringWidth(cell);
        return `${cell}${' '.repeat(Math.max(0, pad))}`;
    }

    const lines: string[] = [];
    rows.forEach((row, rowIndex) => {
        const paddedCells = row.map((cell, index) => padCell(cell, columnWidths[index] ?? 0));
        lines.push(
            options.preserveTablePipes
                ? `${PLAIN_TEXT_CONSTANTS.TABLE_PIPE} ${paddedCells.join(` ${PLAIN_TEXT_CONSTANTS.TABLE_PIPE} `)} ${PLAIN_TEXT_CONSTANTS.TABLE_PIPE}`
                : paddedCells.join(' '.repeat(PLAIN_TEXT_CONSTANTS.TABLE_CELL_PADDING))
        );
        if (rowIndex === 0 && rows.length > 1) {
            const separatorCells = columnWidths.map((width) =>
                '-'.repeat(Math.max(PLAIN_TEXT_CONSTANTS.MIN_COLUMN_WIDTH, width))
            );
            lines.push(
                options.preserveTablePipes
                    ? `${PLAIN_TEXT_CONSTANTS.TABLE_PIPE} ${separatorCells.join(` ${PLAIN_TEXT_CONSTANTS.TABLE_PIPE} `)} ${PLAIN_TEXT_CONSTANTS.TABLE_PIPE}`
                    : separatorCells.join('  ')
            );
        }
    });

    return lines.join('\n');
}

function renderBlockNode(node: PlainTextNode, options: PlainTextOptions, depth = 0): string {
    switch (node.type) {
        case 'paragraph':
            return normalizeBlockText(renderChildrenInline(node.children, options));
        case 'heading': {
            const text = normalizeBlockText(renderChildrenInline(node.children, options));
            if (!options.preserveHeading) return text;
            const level = Math.min(Math.max(node.depth ?? 1, 1), 6);
            return `${PLAIN_TEXT_CONSTANTS.HEADING_PREFIX_CHAR.repeat(level)} ${text}`.trim();
        }
        case 'blockquote':
            return renderBlocks(node.children ?? [], options, depth).trim();
        case 'code':
            return (node.value ?? '').replace(/\n+$/g, '');
        case 'html':
            return htmlFragmentToPlainText(node.value ?? '');
        case 'thematicBreak':
            return options.preserveHorizontalRule ? PLAIN_TEXT_CONSTANTS.HORIZONTAL_RULE_MARKER : '\u00A0';
        case 'list':
            return renderListNode(node, options, depth);
        case 'table':
            return renderTableNode(node, options);
        case 'definition':
            return '';
        case 'footnoteDefinition': {
            const label = node.label ?? node.identifier ?? '';
            const body = renderBlocks(node.children ?? [], options, depth).trim();
            return `[${label}]: ${body}`.trim();
        }
        default:
            return normalizeBlockText(renderChildrenInline(node.children, options));
    }
}

function renderBlocks(nodes: PlainTextNode[], options: PlainTextOptions, depth = 0): string {
    const output: string[] = [];
    let previousType = '';

    for (const node of nodes) {
        const block = renderBlockNode(node, options, depth);
        if (!block) continue;

        if (output.length) {
            output.push(previousType === 'footnoteDefinition' && node.type === 'footnoteDefinition' ? '\n' : '\n\n');
        }

        output.push(block);
        previousType = node.type;
    }

    return output.join('');
}

/**
 * Converts markdown to plain text using the provided options.
 * @param markdown The markdown string to convert.
 * @param options The plain text rendering options.
 * @returns The resulting plain text string.
 */
export function convertMarkdownToPlainText(markdown: string, options: PlainTextOptions): string {
    const processor = createRemarkProcessor(options.displayEmojis);
    const parsed = processor.parse(markdown) as Root;
    const tree = processor.runSync(parsed) as PlainTextNode;
    return renderBlocks(tree.children ?? [], options);
}
