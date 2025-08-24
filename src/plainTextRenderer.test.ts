/* eslint-disable @typescript-eslint/no-require-imports */

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

// List rendering tests

describe('List rendering', () => {
    it('should handle nested bulleted lists with correct indentation', () => {
        const markdown = `
- Item 1
  - Nested Item 1.1
  - Nested Item 1.2
- Item 2
`;
        const result = convertMarkdownToPlainText(markdown, { ...defaultOptions, indentType: 'spaces' });
        const expected = `- Item 1

    - Nested Item 1.1

    - Nested Item 1.2

- Item 2
`;
        expect(result).toBe(expected);
    });

    it('should handle nested ordered lists with correct indentation using tabs', () => {
        const markdown = `
1. Item 1
   1. Nested 1.1
2. Item 2
`;
        const result = convertMarkdownToPlainText(markdown, { ...defaultOptions, indentType: 'tabs' });
        // prettier-ignore
        const expected =
`1. Item 1

\t1. Nested 1.1

2. Item 2
`;
        expect(result).toBe(expected);
    });
    it('should handle nested bulleted lists with correct indentation using spaces', () => {
        const markdown = `
- Item 1
  - Nested Item 1.1
- Item 2
`;
        const result = convertMarkdownToPlainText(markdown, { ...defaultOptions, indentType: 'spaces' });

        // prettier-ignore
        const expected = 
`- Item 1

    - Nested Item 1.1

- Item 2
`;
        expect(result).toBe(expected);
    });
});

// Character preservation tests

describe('Character Preservation Options', () => {
    it('should preserve heading characters when enabled', () => {
        const markdown = `## This is a heading`;
        const options = { ...defaultOptions, preserveHeading: true };
        const result = convertMarkdownToPlainText(markdown, options);
        expect(result.trim()).toBe('## This is a heading');
    });

    it('should strip heading characters by default', () => {
        const markdown = `## This is a heading`;
        const result = convertMarkdownToPlainText(markdown, defaultOptions);
        expect(result.trim()).toBe('This is a heading');
    });

    it('should preserve strikethrough characters when enabled', () => {
        const markdown = '~~deleted text~~';
        const options = { ...defaultOptions, preserveStrikethrough: true };
        const result = convertMarkdownToPlainText(markdown, options);
        expect(result.trim()).toBe('~~deleted text~~');
    });

    it('should strip strikethrough characters by default', () => {
        const markdown = '~~deleted text~~';
        const result = convertMarkdownToPlainText(markdown, defaultOptions);
        expect(result.trim()).toBe('deleted text');
    });

    it('should render a horizontal rule when preserved', () => {
        const markdown = '---';
        const options = { ...defaultOptions, preserveHorizontalRule: true };
        const result = convertMarkdownToPlainText(markdown, options);
        expect(result.trim()).toBe('---');
    });

    it('should strip horizontal rule by default', () => {
        const markdown = '---';
        const result = convertMarkdownToPlainText(markdown, defaultOptions);
        // The function correctly leaves a blank line for spacing, so the trimmed result should be empty.
        expect(result.trim()).toBe('');
    });

    it('should preserve highlight characters (mark) when enabled', () => {
        const markdown = '==highlighted text==';
        const options = { ...defaultOptions, preserveMark: true };
        const result = convertMarkdownToPlainText(markdown, options);
        expect(result.trim()).toBe('==highlighted text==');
    });

    it('should strip highlight characters by default', () => {
        const markdown = '==highlighted text==';
        const result = convertMarkdownToPlainText(markdown, defaultOptions);
        expect(result.trim()).toBe('highlighted text');
    });

    it('should preserve insert characters when enabled', () => {
        const markdown = '++inserted text++';
        const options = { ...defaultOptions, preserveInsert: true };
        const result = convertMarkdownToPlainText(markdown, options);
        expect(result.trim()).toBe('++inserted text++');
    });

    it('should strip insert characters by default', () => {
        const markdown = '++inserted text++';
        const result = convertMarkdownToPlainText(markdown, defaultOptions);
        expect(result.trim()).toBe('inserted text');
    });

    it('should preserve subscript characters when enabled', () => {
        const markdown = 'H~2~O';
        const options = { ...defaultOptions, preserveSubscript: true };
        const result = convertMarkdownToPlainText(markdown, options);
        expect(result.trim()).toBe('H~2~O');
    });

    it('should strip subscript characters by default', () => {
        const markdown = 'H~2~O';
        const result = convertMarkdownToPlainText(markdown, defaultOptions);
        expect(result.trim()).toBe('H2O');
    });

    it('should preserve superscript characters when enabled', () => {
        const markdown = 'x^2^';
        const options = { ...defaultOptions, preserveSuperscript: true };
        const result = convertMarkdownToPlainText(markdown, options);
        expect(result.trim()).toBe('x^2^');
    });

    it('should strip superscript characters by default', () => {
        const markdown = 'x^2^';
        const result = convertMarkdownToPlainText(markdown, defaultOptions);
        expect(result.trim()).toBe('x2');
    });
});

// Display emoji

describe('Emoji Handling', () => {
    it('should display emojis when the setting is enabled', () => {
        const markdown = 'Joplin is great :tada:';
        // The displayEmojis option is true in defaultOptions, so we can just use that
        const result = convertMarkdownToPlainText(markdown, defaultOptions);
        expect(result.trim()).toBe('Joplin is great 🎉');
    });

    it('should strip emojis when the setting is disabled', () => {
        const markdown = 'Joplin is great :tada:';
        const options = { ...defaultOptions, displayEmojis: false };
        const result = convertMarkdownToPlainText(markdown, options);
        expect(result.trim()).toBe('Joplin is great');
    });
});

// Complex Structures and Edge Cases

describe('Complex Structures and Edge Cases', () => {
    it('should handle a single blockquote', () => {
        const markdown = '> This is a quote.';
        const result = convertMarkdownToPlainText(markdown, defaultOptions);
        // Your current implementation correctly renders the text content of a blockquote.
        // This test confirms that behavior.
        expect(result.trim()).toBe('This is a quote.');
    });

    it('should handle nested blockquotes', () => {
        const markdown = `
> Level 1
>
> > Level 2
>
> Back to Level 1
`;
        const result = convertMarkdownToPlainText(markdown, defaultOptions);
        const expected = `Level 1

Level 2

Back to Level 1`;
        expect(result.trim()).toBe(expected);
    });

    it('should correctly render a complex document with nested elements', () => {
        const markdown = `
# Main Heading
Some introductory text.

> ## A Quote with a Heading
>
> - List item 1
> - **Bold** and *italic* item 2
>   - Nested list

Final paragraph.
`;
        const options = { ...defaultOptions, preserveHeading: true, preserveBold: true, preserveEmphasis: true };
        const result = convertMarkdownToPlainText(markdown, options);

        // prettier-ignore
        const expected = 
`# Main Heading

Some introductory text.

## A Quote with a Heading

- List item 1

- **Bold** and *italic* item 2

    - Nested list

Final paragraph.`;
        expect(result.trim()).toBe(expected);
    });

    it('should return an empty string for empty input', () => {
        const markdown = '';
        const result = convertMarkdownToPlainText(markdown, defaultOptions);
        expect(result).toBe('');
    });

    it('should return an empty string for input with only whitespace', () => {
        const markdown = ' \n \t \n ';
        const result = convertMarkdownToPlainText(markdown, defaultOptions);
        expect(result.trim()).toBe('');
    });
});

// Safe plugin loading
describe('Safe Plugin Loading', () => {
    // Store the original defaultOptions before any tests run
    const originalDefaultOptions = { ...defaultOptions };

    beforeEach(() => {
        // This is the key: Reset the module system's cache before each test
        jest.resetModules();
    });

    it('should use markdown-it-mark when the plugin is available', () => {
        // Freshly require the module for this test
        const { convertMarkdownToPlainText } = require('./plainTextRenderer');

        const markdown = '==highlighted==';
        const options = { ...originalDefaultOptions, preserveMark: true };
        const result = convertMarkdownToPlainText(markdown, options);
        expect(result.trim()).toBe('==highlighted==');
    });

    it('should not crash and should treat marks as plain text if markdown-it-mark is not found', () => {
        // This mock is hoisted by Jest and will apply before the require() call below
        jest.mock('markdown-it-mark', () => {
            throw new Error('Module not found');
        });

        // Freshly require the module AFTER the mock is in place
        const { convertMarkdownToPlainText } = require('./plainTextRenderer');

        const markdown = '==highlighted==';
        const options = { ...originalDefaultOptions, preserveMark: true };
        const result = convertMarkdownToPlainText(markdown, options);

        expect(result.trim()).toBe('==highlighted==');

        // Jest automatically un-hoists the mock after the test, so no cleanup is needed
    });
});
