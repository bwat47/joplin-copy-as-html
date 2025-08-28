import {
    unescape,
    collapseExtraBlankLines,
    formatTable,
    parseTableTokens,
    calculateColumnWidths,
} from './tokenRenderers';
import { PlainTextOptions } from '../types';
import MarkdownIt from 'markdown-it';

// A default set of options to satisfy the PlainTextOptions type.
// We can override specific properties for each test.
const defaultOptions: PlainTextOptions = {
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

// Helper function to generate tokens from a markdown string
const generateTableTokens = (markdown: string) => {
    const md = new MarkdownIt();
    const tokens = md.parse(markdown, {});

    // Find the table tokens and extract them
    const tableOpenIndex = tokens.findIndex((t) => t.type === 'table_open');
    const tableCloseIndex = tokens.findIndex((t) => t.type === 'table_close');

    if (tableOpenIndex !== -1 && tableCloseIndex !== -1) {
        // We only need the tokens between table_open and table_close
        return tokens.slice(tableOpenIndex + 1, tableCloseIndex);
    }
    return [];
};

describe('unescape', () => {
    it('should remove backslash escapes from markdown characters', () => {
        expect(unescape('This is \*bold\*')).toBe('This is *bold*'); // eslint-disable-line no-useless-escape
        expect(unescape('And this is \_italic\_')).toBe('And this is _italic_'); // eslint-disable-line no-useless-escape
        expect(unescape('A \`code\` block')).toBe('A `code` block'); // eslint-disable-line no-useless-escape
        expect(unescape('A heading \#hash')).toBe('A heading #hash'); // eslint-disable-line no-useless-escape
    });

    it('should not affect unescaped text', () => {
        const text = 'This text has no escapes.';
        expect(unescape(text)).toBe(text);
    });

    it('should not remove backslashes from non-markdown characters', () => {
        const text = 'This is a normal backslash \n';
        expect(unescape(text)).toBe(text);
    });
});

describe('Table Rendering', () => {
    it('should format a simple table with correct padding', () => {
        const markdownTable = `
| Header 1 | Header 2 |
|----------|----------|
| Cell 1   | Cell 2   |
`;
        const tableTokens = generateTableTokens(markdownTable);
        const tableData = parseTableTokens(tableTokens, defaultOptions, null, 0);
        const colWidths = calculateColumnWidths(tableData);
        const result = formatTable(tableData, colWidths);

        // prettier-ignore
        const expected =
`Header 1  Header 2
--------  --------
Cell 1    Cell 2  

`;
        expect(result).toBe(expected);
    });

    it('should handle columns with different content lengths', () => {
        const markdownTable = `
| Short | A Much Longer Header |
|-------|----------------------|
| Data  | More Data            |
`;
        const tableTokens = generateTableTokens(markdownTable);
        const tableData = parseTableTokens(tableTokens, defaultOptions, null, 0);
        const colWidths = calculateColumnWidths(tableData);
        const result = formatTable(tableData, colWidths);

        // prettier-ignore
        const expected =
`Short  A Much Longer Header
-----  --------------------
Data   More Data           

`;
        expect(result).toBe(expected);
    });

    it('should render inline markdown within table cells correctly', () => {
        const markdownTable = `
| Format   | Example      |
|----------|--------------|
| *Italic* | **Bold** |
`;
        const tableTokens = generateTableTokens(markdownTable);
        const tableData = parseTableTokens(
            tableTokens,
            { ...defaultOptions, preserveEmphasis: true, preserveBold: true },
            null,
            0
        );

        expect(tableData.rows[1].cells[0]).toBe('*Italic*');
        expect(tableData.rows[1].cells[1]).toBe('**Bold**');

        const colWidths = calculateColumnWidths(tableData);
        const result = formatTable(tableData, colWidths);

        // prettier-ignore
        const expected =
`Format    Example 
--------  --------
*Italic*  **Bold**

`;
        expect(result).toBe(expected);
    });
});

// Blank Line Collapsing (direct helper tests)
describe('Blank Line Collapsing (direct helper tests)', () => {
    interface Case {
        input: string;
        expected: string;
        note?: string;
    }
    const cases: Case[] = [
        {
            input: 'A\n\n\n\nB',
            expected: 'A\n\nB',
            note: 'Collapse 4 consecutive newlines between text to 2',
        },
        {
            input: '\n\n\nA',
            expected: '\n\nA',
            note: 'Leading 3 newlines collapsed to 2 (contract: allow at most 2)',
        },
        {
            // Inside a code fence we do NOT call collapseExtraBlankLines via renderer;
            // this test shows that if applied naively it would also collapse, hence we
            // separately test render behavior below.
            input: 'line1\n\n\nline2\n',
            expected: 'line1\n\nline2\n',
            note: 'Pure helper collapses interior triple newlines',
        },
    ];

    for (const c of cases) {
        it(c.note || JSON.stringify(c.input), () => {
            expect(collapseExtraBlankLines(c.input)).toBe(c.expected);
        });
    }
});
