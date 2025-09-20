import { PlainTextBlockFormatter, PlainTextBlock, DEFAULT_BLOCK_SPACING_RULES } from './plainTextFormatter';
import type { PlainTextOptions, ListItem, TableData } from '../types';

describe('PlainTextBlockFormatter', () => {
    const baseOptions: PlainTextOptions = {
        preserveSuperscript: false,
        preserveSubscript: false,
        preserveEmphasis: false,
        preserveBold: false,
        preserveHeading: false,
        preserveStrikethrough: false,
        preserveHorizontalRule: false,
        preserveMark: false,
        preserveInsert: false,
        displayEmojis: true,
        hyperlinkBehavior: 'title',
        indentType: 'spaces',
    };

    it('renders a single paragraph without introducing extra spacing', () => {
        const formatter = new PlainTextBlockFormatter(baseOptions);
        const blocks: PlainTextBlock[] = [
            {
                type: 'paragraph',
                lines: ['Line one.', 'Line two.'],
            },
        ];

        expect(formatter.format(blocks)).toBe('Line one.\nLine two.');
    });

    it('inserts blank lines according to default spacing rules', () => {
        const formatter = new PlainTextBlockFormatter(baseOptions);
        const blocks: PlainTextBlock[] = [
            { type: 'heading', level: 2, text: 'Heading title' },
            { type: 'paragraph', lines: ['First paragraph.'] },
            { type: 'paragraph', lines: ['Second paragraph.'] },
        ];

        expect(formatter.format(blocks)).toBe('Heading title\n\nFirst paragraph.\n\nSecond paragraph.');
    });

    it('honors heading preservation option when rendering headings', () => {
        const formatter = new PlainTextBlockFormatter({ ...baseOptions, preserveHeading: true });
        const blocks: PlainTextBlock[] = [
            { type: 'heading', level: 3, text: 'Preserved Heading' },
            { type: 'paragraph', lines: ['Paragraph after preserved heading.'] },
        ];

        expect(formatter.format(blocks)).toBe('### Preserved Heading\n\nParagraph after preserved heading.');
    });

    it('supports spacing rule overrides', () => {
        const formatter = new PlainTextBlockFormatter(baseOptions, {
            ...DEFAULT_BLOCK_SPACING_RULES,
            paragraph: {
                heading: false,
                paragraph: false,
            },
        });
        const blocks: PlainTextBlock[] = [
            { type: 'paragraph', lines: ['Paragraph alpha.'] },
            { type: 'paragraph', lines: ['Paragraph beta.'] },
        ];

        expect(formatter.format(blocks)).toBe('Paragraph alpha.\nParagraph beta.');
    });

    it('formats list blocks with configured indentation', () => {
        const items: ListItem[] = [
            { content: 'First item', ordered: false, indentLevel: 1 },
            { content: 'Second item', ordered: false, indentLevel: 1 },
        ];
        const formatter = new PlainTextBlockFormatter(baseOptions);
        const blocks: PlainTextBlock[] = [{ type: 'list', items }];

        expect(formatter.format(blocks).trimEnd()).toBe('- First item\n\n- Second item');
    });

    it('formats table blocks with aligned columns', () => {
        const tableData: TableData = {
            rows: [
                { cells: ['Header 1', 'Header 2'], isHeader: true },
                { cells: ['Value A', 'Value B'], isHeader: false },
            ],
        };
        const formatter = new PlainTextBlockFormatter(baseOptions);
        const blocks: PlainTextBlock[] = [{ type: 'table', data: tableData }];

        const output = formatter.format(blocks);
        expect(output.trimEnd()).toBe('Header 1  Header 2\n--------  --------\nValue A   Value B');
    });

    it('inserts spacing between sequential list blocks', () => {
        const firstList: ListItem[] = [
            { content: 'First ordered item', ordered: true, index: 1, indentLevel: 1 },
        ];
        const secondList: ListItem[] = [
            { content: 'Now a bullet', ordered: false, indentLevel: 1 },
        ];
        const formatter = new PlainTextBlockFormatter(baseOptions);
        const blocks: PlainTextBlock[] = [
            { type: 'list', items: firstList },
            { type: 'list', items: secondList },
        ];

        expect(formatter.format(blocks).trimEnd()).toBe('1. First ordered item\n\n- Now a bullet');
    });

    it('formats code blocks without trailing blank lines', () => {
        const formatter = new PlainTextBlockFormatter(baseOptions);
        const blocks: PlainTextBlock[] = [
            { type: 'code', lines: ['const x = 1;', 'console.log(x);'] },
        ];

        expect(formatter.format(blocks)).toBe('const x = 1;\nconsole.log(x);');
    });

    it('formats blockquote blocks by emitting contained lines', () => {
        const formatter = new PlainTextBlockFormatter(baseOptions);
        const blocks: PlainTextBlock[] = [
            { type: 'blockquote', lines: ['Quote line 1', '', 'Quote line 2'] },
            { type: 'paragraph', lines: ['After quote.'] },
        ];

        expect(formatter.format(blocks)).toBe('Quote line 1\n\nQuote line 2\n\nAfter quote.');
    });
});
