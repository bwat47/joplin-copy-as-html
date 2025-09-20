/* eslint-disable @typescript-eslint/no-require-imports */

import * as fs from 'fs';
import * as path from 'path';
import { convertMarkdownToPlainText } from './plainTextRenderer';
import { PlainTextOptions } from './types';

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

// List rendering tests

describe('List rendering', () => {
    it('should handle nested bulleted lists with correct indentation using spaces', () => {
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
        expect(result.trimEnd()).toBe(expected.trimEnd());
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
        expect(result.trimEnd()).toBe(expected.trimEnd());
    });
});

// Character preservation tests

describe('Character Preservation Options', () => {
    test.each([
        ['preserveHeading', '## This is a heading', '## This is a heading', 'This is a heading'],
        ['preserveBold', '**This is bold text**', '**This is bold text**', 'This is bold text'],
        ['preserveEmphasis', '*This is emphasis text*', '*This is emphasis text*', 'This is emphasis text'],
        ['preserveStrikethrough', '~~deleted text~~', '~~deleted text~~', 'deleted text'],
        ['preserveHorizontalRule', '---', '---', '\u00A0'],
        ['preserveMark', '==highlighted text==', '==highlighted text==', 'highlighted text'],
        ['preserveInsert', '++inserted text++', '++inserted text++', 'inserted text'],
        ['preserveSubscript', 'H~2~O', 'H~2~O', 'H2O'],
        ['preserveSuperscript', 'x^2^', 'x^2^', 'x2'],
    ])('should handle %s option correctly', (optionName, input, expectedWhenEnabled, expectedWhenDisabled) => {
        // Test when option is enabled
        const enabledOptions = { ...defaultOptions, [optionName]: true };
        const enabledResult = convertMarkdownToPlainText(input, enabledOptions);
        expect(enabledResult.trim()).toBe(expectedWhenEnabled);

        // Test when option is disabled (default behavior)
        const disabledResult = convertMarkdownToPlainText(input, defaultOptions);

        // Special case for horizontal rule: nbsp gets trimmed, so check raw result
        if (optionName === 'preserveHorizontalRule') {
            expect(disabledResult).toBe(expectedWhenDisabled);
        } else {
            expect(disabledResult.trim()).toBe(expectedWhenDisabled);
        }
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

// Code Block Handling
describe('Code Block Handling', () => {
    it('should preserve content of fenced code blocks', () => {
        const markdown = '```javascript\nconst x = 1;\nconsole.log(x);\n```';
        const result = convertMarkdownToPlainText(markdown, defaultOptions);
        expect(result.trim()).toBe('const x = 1;\nconsole.log(x);');
    });

    it('should preserve content of fenced code blocks with language specifier', () => {
        const markdown = '```python\nprint("Hello, World!")\n```';
        const result = convertMarkdownToPlainText(markdown, defaultOptions);
        expect(result.trim()).toBe('print("Hello, World!")');
    });

    it('should handle fenced code blocks without language specifier', () => {
        const markdown = '```\nsome code here\nmore code\n```';
        const result = convertMarkdownToPlainText(markdown, defaultOptions);
        expect(result.trim()).toBe('some code here\nmore code');
    });

    it('should preserve indented code blocks', () => {
        const markdown = `    const x = 1;
    console.log(x);`;
        const result = convertMarkdownToPlainText(markdown, defaultOptions);
        expect(result.trim()).toBe('const x = 1;\nconsole.log(x);');
    });

    it('should preserve inline code content', () => {
        const markdown = 'Use the `console.log()` function to debug.';
        const result = convertMarkdownToPlainText(markdown, defaultOptions);
        expect(result.trim()).toBe('Use the console.log() function to debug.');
    });

    it('should handle multiple inline code spans', () => {
        const markdown = 'Variables like `x` and `y` are common in `math`.';
        const result = convertMarkdownToPlainText(markdown, defaultOptions);
        expect(result.trim()).toBe('Variables like x and y are common in math.');
    });

    it('should handle empty code blocks', () => {
        const markdown = '```\n```';
        const result = convertMarkdownToPlainText(markdown, defaultOptions);
        expect(result.trim()).toBe('');
    });

    it('should handle code blocks with special characters', () => {
        const markdown = '```\n<div class="test">Hello & goodbye</div>\n```';
        const result = convertMarkdownToPlainText(markdown, defaultOptions);
        expect(result.trim()).toBe('<div class="test">Hello & goodbye</div>');
    });

    it('should handle nested backticks in inline code', () => {
        const markdown = 'Use `` `backticks` `` for inline code.';
        const result = convertMarkdownToPlainText(markdown, defaultOptions);
        expect(result.trim()).toBe('Use `backticks` for inline code.');
    });

    it('should remove fence markers but preserve content', () => {
        const markdown = `\`\`\`typescript
function test() {
    return "hello";
}
\`\`\``;
        const result = convertMarkdownToPlainText(markdown, defaultOptions);
        const expected = `function test() {
    return "hello";
}`;
        expect(result.trim()).toBe(expected);
    });
});

// Line Break Handling
describe('Line Break Handling', () => {
    it('should convert soft line breaks to newlines', () => {
        const markdown = 'Line one\nLine two';
        const result = convertMarkdownToPlainText(markdown, defaultOptions);
        expect(result.trim()).toBe('Line one\nLine two');
    });

    it('should convert hard line breaks to newlines', () => {
        const markdown = 'Line one  \nLine two'; // Two spaces + newline = hard break
        const result = convertMarkdownToPlainText(markdown, defaultOptions);
        expect(result.trim()).toBe('Line one\nLine two');
    });

    it('should handle backslash hard line breaks', () => {
        const markdown = 'Line one\\\nLine two'; // Backslash + newline = hard break
        const result = convertMarkdownToPlainText(markdown, defaultOptions);
        expect(result.trim()).toBe('Line one\nLine two');
    });

    it('should handle mixed line break scenarios', () => {
        const markdown = `First paragraph with soft break
and continuation.

Second paragraph with hard break  
on new line.

Third paragraph with backslash break\\
on new line.`;
        const result = convertMarkdownToPlainText(markdown, defaultOptions);
        const expected = `First paragraph with soft break
and continuation.

Second paragraph with hard break
on new line.

Third paragraph with backslash break
on new line.`;
        expect(result.trim()).toBe(expected);
    });

    it('should preserve line breaks within code blocks', () => {
        const markdown = `\`\`\`
line one
line two
line three
\`\`\``;
        const result = convertMarkdownToPlainText(markdown, defaultOptions);
        expect(result.trim()).toBe('line one\nline two\nline three');
    });

    it('should handle line breaks in lists', () => {
        const markdown = `- Item with soft break
  continuation
- Item with hard break  
  new line`;
        const result = convertMarkdownToPlainText(markdown, defaultOptions);
        const expected = `- Item with soft break
continuation

- Item with hard break
new line
`;
        expect(result.trimEnd()).toBe(expected.trimEnd());
    });

    it('should handle multiple consecutive line breaks', () => {
        const markdown = 'Line one\n\n\nLine two'; // Multiple newlines
        const result = convertMarkdownToPlainText(markdown, defaultOptions);
        // Should collapse to max configured newlines (likely 2)
        expect(result.trim()).toBe('Line one\n\nLine two');
    });

    it('should handle line breaks in blockquotes', () => {
        const markdown = `> First line
> Second line  
> Hard break line
> 
> New paragraph in quote`;
        const result = convertMarkdownToPlainText(markdown, defaultOptions);
        const expected = `First line
Second line
Hard break line

New paragraph in quote`;
        expect(result.trim()).toBe(expected);
    });
});

describe('Blank Line Collapsing (render context)', () => {
    it('should not collapse blank lines inside fenced code but should collapse outside', () => {
        const markdown = '```\nline1\n\n\nline2\n```\n\n\n\nAfter';
        const rendered = convertMarkdownToPlainText(markdown, defaultOptions);
        // Fenced content: collapseExtraBlankLines is never applied there, so triple newline preserved.
        // Outside fence: trailing 4 newlines after fence should collapse to 2.
        const expected = 'line1\n\n\nline2\n\nAfter';
        expect(rendered.trim()).toBe(expected);
    });
});

// Footnotes

describe('Footnote Handling', () => {
    it('should convert footnote references [^id] to [id]', () => {
        const markdown = 'This is a reference [^note1] inside text.';
        const result = convertMarkdownToPlainText(markdown, defaultOptions);
        expect(result.trim()).toBe('This is a reference [note1] inside text.');
    });

    it('should convert footnote definition labels [^id]: to [id]:', () => {
        const markdown = '[^note1]: This is the note definition.';
        const result = convertMarkdownToPlainText(markdown, defaultOptions);
        // Definition label should lose the caret.
        expect(result.trim()).toBe('[note1]: This is the note definition.');
    });

    it('should handle mixed references and definitions separated by blank lines', () => {
        const markdown = `
Text referencing [^a] and also [^b].

[^a]: First footnote
[^b]: Second footnote
`;
        const result = convertMarkdownToPlainText(markdown, defaultOptions).trim();

        const expected = `Text referencing [a] and also [b].

[a]: First footnote
[b]: Second footnote`;
        expect(result).toBe(expected);
    });
});

describe('Integration', () => {
    it('renders the repository README without throwing', () => {
        const markdown = fs.readFileSync(path.resolve(__dirname, '../README.md'), 'utf8');
        expect(() => convertMarkdownToPlainText(markdown, defaultOptions)).not.toThrow();
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
