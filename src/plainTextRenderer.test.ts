import { unescape, convertMarkdownToPlainText } from './plainTextRenderer';
import { PlainTextOptions } from './types';
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

describe('unescape', () => {
    it('should remove backslash escapes from markdown characters', () => {
        expect(unescape('This is \\*bold\\*')).toBe('This is *bold*');
        expect(unescape('And this is \\_italic\\_')).toBe('And this is _italic_');
        expect(unescape('A \\`code\\` block')).toBe('A `code` block');
        expect(unescape('A heading \\#hash')).toBe('A heading #hash');
    });

    it('should not affect unescaped text', () => {
        const text = 'This text has no escapes.';
        expect(unescape(text)).toBe(text);
    });

    it('should not remove backslashes from non-markdown characters', () => {
        const text = 'This is a normal backslash \\n';
        expect(unescape(text)).toBe(text);
    });
});

describe('Link Handling in Plain Text', () => {
    it('should display only the link title when hyperlinkBehavior is "title"', () => {
        const markdown = '[Joplin](https://joplinapp.org)';
        // Use the spread operator to create a complete options object
        const options: PlainTextOptions = { ...defaultOptions, hyperlinkBehavior: 'title' };
        const result = convertMarkdownToPlainText(markdown, options);
        // Use .trim() to remove any trailing newlines from the renderer
        expect(result.trim()).toBe('Joplin');
    });

    it('should display only the URL when hyperlinkBehavior is "url"', () => {
        const markdown = '[Joplin](https://joplinapp.org)';
        const options: PlainTextOptions = { ...defaultOptions, hyperlinkBehavior: 'url' };
        const result = convertMarkdownToPlainText(markdown, options);
        expect(result.trim()).toBe('https://joplinapp.org');
    });

    it('should display the full markdown link when hyperlinkBehavior is "markdown"', () => {
        const markdown = '[Joplin](https://joplinapp.org)';
        const options: PlainTextOptions = { ...defaultOptions, hyperlinkBehavior: 'markdown' };
        const result = convertMarkdownToPlainText(markdown, options);
        expect(result.trim()).toBe('[Joplin](https://joplinapp.org)');
    });
});

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

// Table Tests
import { formatTable, parseTableTokens, calculateColumnWidths } from './plainTextRenderer';

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
