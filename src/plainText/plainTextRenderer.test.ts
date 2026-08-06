import * as fs from 'fs';
import * as path from 'path';
import { convertMarkdownToPlainText } from './plainTextRenderer';
import { PlainTextOptions } from '../types';

// A default set of options to satisfy the PlainTextOptions type.
// We can override specific properties for each test.
const defaultOptions: PlainTextOptions = {
    preserveSuperscript: false,
    preserveSubscript: false,
    preserveEmphasis: false,
    preserveBold: false,
    preserveHeading: false,
    preserveQuoteMarkers: false,
    preserveStrikethrough: false,
    preserveHorizontalRule: false,
    preserveMark: false,
    preserveInsert: false,
    preserveCodeBackticks: false,
    displayEmojis: true,
    hyperlinkBehavior: 'title',
    indentType: 'spaces',
    listSpacing: 'tight',
    preserveTablePipes: false,
};

describe('Link Handling in Plain Text', () => {
    it.each([
        ['title', 'Joplin'],
        ['url', 'https://joplinapp.org'],
        ['markdown', '[Joplin](https://joplinapp.org)'],
    ] as const)('should render the expected output when hyperlinkBehavior is "%s"', (hyperlinkBehavior, expected) => {
        const markdown = '[Joplin](https://joplinapp.org)';
        // Use the spread operator to create a complete options object
        const options: PlainTextOptions = { ...defaultOptions, hyperlinkBehavior };
        const result = convertMarkdownToPlainText(markdown, options);
        // Use .trim() to remove any trailing newlines from the renderer
        expect(result.trim()).toBe(expected);
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

    it('should preserve GFM task list markers', () => {
        const markdown = `
- [x] Finished
- [ ] Pending
`;
        const result = convertMarkdownToPlainText(markdown, defaultOptions);
        const expected = `- [x] Finished
- [ ] Pending`;
        expect(result.trimEnd()).toBe(expected);
    });

    it('should add blank lines between list items when list spacing is loose', () => {
        const markdown = `
- Item 1
  - Nested Item 1.1
  - Nested Item 1.2
- Item 2
`;
        const result = convertMarkdownToPlainText(markdown, { ...defaultOptions, listSpacing: 'loose' });
        const expected = `- Item 1

    - Nested Item 1.1

    - Nested Item 1.2

- Item 2
`;
        expect(result.trimEnd()).toBe(expected.trimEnd());
    });

    it('should add a blank line before nested lists when list spacing is loose', () => {
        const markdown = `
1. Parent item:
    - Child item:
        - Grandchild item
2. Next parent item
`;
        const result = convertMarkdownToPlainText(markdown, { ...defaultOptions, listSpacing: 'loose' });
        const expected = `1. Parent item:

    - Child item:

        - Grandchild item

2. Next parent item`;
        expect(result.trimEnd()).toBe(expected);
    });

    it('should add a blank line before continuation paragraphs when list spacing is loose', () => {
        const markdown = `3. Go to the Companies tab and make sure that your Test company is there. If your test company is already there, continue to step 4.

   Or, if you only see your Live company, create the Test company by clicking 'New', select your Test company from the dropdown, click OK, and then click Create. This will create the Test company database.

4. Then, take a backup of your LIVE database. To do this, go to the Companies tab and highlight your **LIVE** Company and click **Backup As**. Choose where to save/what to name the backup (it will be a .DAT file).`;
        const result = convertMarkdownToPlainText(markdown, { ...defaultOptions, listSpacing: 'loose' });
        const expected = `3. Go to the Companies tab and make sure that your Test company is there. If your test company is already there, continue to step 4.

    Or, if you only see your Live company, create the Test company by clicking 'New', select your Test company from the dropdown, click OK, and then click Create. This will create the Test company database.

4. Then, take a backup of your LIVE database. To do this, go to the Companies tab and highlight your LIVE Company and click Backup As. Choose where to save/what to name the backup (it will be a .DAT file).`;
        expect(result.trimEnd()).toBe(expected);
    });

    it('should add a blank line before code blocks within list items when list spacing is loose', () => {
        const markdown = `3. **\`buildColorTheme\`** - emit per-type rules:

   \`\`\`typescript
   rules[\`.cm-gh-alert-\${type}\`] = {
       '--cm-gh-alert-color': color,
       '--cm-gh-alert-bg': bg,
   };
   return EditorView.theme(rules);
   \`\`\`

4. **Range computation helper**:`;
        const result = convertMarkdownToPlainText(markdown, {
            ...defaultOptions,
            listSpacing: 'loose',
            preserveBold: true,
            preserveCodeBackticks: true,
        });
        const expected = `3. **\`buildColorTheme\`** - emit per-type rules:

    \`\`\`typescript
    rules[\`.cm-gh-alert-\${type}\`] = {
        '--cm-gh-alert-color': color,
        '--cm-gh-alert-bg': bg,
    };
    return EditorView.theme(rules);
    \`\`\`

4. **Range computation helper**:`;
        expect(result.trimEnd()).toBe(expected);
    });

    it('should add a blank line before code blocks within list items when list spacing is loose (preserveCodeBackticks disabled)', () => {
        const markdown = `3. **\`buildColorTheme\`** - emit per-type rules:

   \`\`\`typescript
   rules[\`.cm-gh-alert-\${type}\`] = {
       '--cm-gh-alert-color': color,
       '--cm-gh-alert-bg': bg,
   };
   return EditorView.theme(rules);
   \`\`\`

4. **Range computation helper**:`;
        const result = convertMarkdownToPlainText(markdown, {
            ...defaultOptions,
            listSpacing: 'loose',
            preserveBold: true,
            preserveCodeBackticks: false,
        });
        const expected = `3. **buildColorTheme** - emit per-type rules:

    rules[\`.cm-gh-alert-\${type}\`] = {
        '--cm-gh-alert-color': color,
        '--cm-gh-alert-bg': bg,
    };
    return EditorView.theme(rules);

4. **Range computation helper**:`;
        expect(result.trimEnd()).toBe(expected);
    });
});

// Character preservation tests

describe('Character Preservation Options', () => {
    test.each([
        ['preserveHeading', '## This is a heading', '## This is a heading', 'This is a heading'],
        ['preserveBold', '**This is bold text**', '**This is bold text**', 'This is bold text'],
        ['preserveEmphasis', '*This is emphasis text*', '*This is emphasis text*', 'This is emphasis text'],
        ['preserveQuoteMarkers', '> This is a quote.', '> This is a quote.', 'This is a quote.'],
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

    it.each([
        ['should strip emojis', 'Joplin is great :tada:', 'Joplin is great'],
        [
            'should strip valid emoji aliases without corrupting colon-delimited text',
            'Time 10:30:45 and :tada: plus :+1: remains formatted.',
            'Time 10:30:45 and  plus  remains formatted.',
        ],
        [
            'should leave unknown shortcode-like text unchanged',
            'Keep :not-an-emoji: as written.',
            'Keep :not-an-emoji: as written.',
        ],
    ])('%s when the setting is disabled', (_name, markdown, expected) => {
        const options = { ...defaultOptions, displayEmojis: false };
        const result = convertMarkdownToPlainText(markdown, options);
        expect(result.trim()).toBe(expected);
    });

    it('should render emojis contained within table cells', () => {
        const markdown = `
| Feature | Status | Notes |
| --- | --- | --- |
| Bug Fixes | :white_check_mark: | All major bugs resolved. |
| Celebration | :tada: | Release time! |
`;
        const result = convertMarkdownToPlainText(markdown, defaultOptions);
        const trimmed = result.trim();
        expect(trimmed).toContain('✅');
        expect(trimmed).toContain('🎉');
    });
});

describe('Table rendering', () => {
    const markdown = `
| Feature | Status |
| --- | --- |
| Bug Fixes | Done |
`;

    it('should render plain text tables without pipes by default', () => {
        const result = convertMarkdownToPlainText(markdown, defaultOptions);
        const expected = `Feature    Status
---------  ------
Bug Fixes  Done`;

        expect(result.trim()).toBe(expected);
    });

    it('should preserve markdown table pipes when enabled', () => {
        const result = convertMarkdownToPlainText(markdown, { ...defaultOptions, preserveTablePipes: true });
        const expected = `| Feature   | Status |
| --------- | ------ |
| Bug Fixes | Done   |`;

        expect(result.trim()).toBe(expected);
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

    it('should remove marker-only GitHub alert syntax from blockquotes', () => {
        const markdown = `> [!note]
> Test abc`;
        const result = convertMarkdownToPlainText(markdown, defaultOptions);

        expect(result.trim()).toBe('Test abc');
    });

    it('should keep GitHub alert titles as blockquote content', () => {
        const markdown = `> [!note] title
> Test abc`;
        const result = convertMarkdownToPlainText(markdown, defaultOptions);

        expect(result.trim()).toBe(`title
Test abc`);
    });

    it('should remove extended GitHub alert types from blockquotes', () => {
        const markdown = `> [!example] Extended title
> Test abc`;
        const result = convertMarkdownToPlainText(markdown, defaultOptions);

        expect(result.trim()).toBe(`Extended title
Test abc`);
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

    it('should preserve quote markers when enabled', () => {
        const markdown = `> First line
>
> Second line`;
        const result = convertMarkdownToPlainText(markdown, { ...defaultOptions, preserveQuoteMarkers: true });
        const expected = `> First line
>
> Second line`;

        expect(result.trim()).toBe(expected);
    });

    it('should preserve nested quote markers when enabled', () => {
        const markdown = `
> Level 1
>
> > Level 2
>
> Back to Level 1
`;
        const result = convertMarkdownToPlainText(markdown, { ...defaultOptions, preserveQuoteMarkers: true });
        const expected = `> Level 1
>
> > Level 2
>
> Back to Level 1`;

        expect(result.trim()).toBe(expected);
    });

    it('should remove GitHub alert syntax while preserving quote markers', () => {
        const markdown = `> [!example] Extended title
> Test abc`;
        const result = convertMarkdownToPlainText(markdown, { ...defaultOptions, preserveQuoteMarkers: true });
        const expected = `> Extended title
> Test abc`;

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

describe('HTML Handling', () => {
    it('should strip inline HTML while preserving text content', () => {
        const markdown =
            'This is a\u00A0<span style="color: rgb(186, 55, 42);">test <span style="color: rgb(0, 0, 0);">of colored text</span></span>';
        const result = convertMarkdownToPlainText(markdown, defaultOptions);
        expect(result.trim()).toBe('This is a test of colored text');
    });

    it('should strip block HTML while preserving plain text structure', () => {
        const markdown = `Intro

<div>
    <p>First line with <span>inline</span> HTML.</p>
    <p>Second&nbsp;line<br>with break.</p>
</div>

Outro`;
        const result = convertMarkdownToPlainText(markdown, defaultOptions);
        const expected = `Intro

First line with inline HTML.
Second line
with break.

Outro`;
        expect(result.trim()).toBe(expected.trim());
    });
});

// Code Block Handling
describe('Code Block Handling', () => {
    it.each([
        [
            'should preserve content of fenced code blocks',
            '```javascript\nconst x = 1;\nconsole.log(x);\n```',
            'const x = 1;\nconsole.log(x);',
        ],
        [
            'should preserve content of fenced code blocks with language specifier',
            '```python\nprint("Hello, World!")\n```',
            'print("Hello, World!")',
        ],
        [
            'should handle fenced code blocks without language specifier',
            '```\nsome code here\nmore code\n```',
            'some code here\nmore code',
        ],
        [
            'should preserve indented code blocks',
            '    const x = 1;\n    console.log(x);',
            'const x = 1;\nconsole.log(x);',
        ],
        [
            'should preserve inline code content',
            'Use the `console.log()` function to debug.',
            'Use the console.log() function to debug.',
        ],
        [
            'should handle multiple inline code spans',
            'Variables like `x` and `y` are common in `math`.',
            'Variables like x and y are common in math.',
        ],
        ['should handle empty code blocks', '```\n```', ''],
        [
            'should handle code blocks with special characters',
            '```\n<div class="test">Hello & goodbye</div>\n```',
            '<div class="test">Hello & goodbye</div>',
        ],
        [
            'should handle nested backticks in inline code',
            'Use `` `backticks` `` for inline code.',
            'Use `backticks` for inline code.',
        ],
        [
            'should remove fence markers but preserve content',
            '```typescript\nfunction test() {\n    return "hello";\n}\n```',
            'function test() {\n    return "hello";\n}',
        ],
    ])('%s', (_name, markdown, expected) => {
        const result = convertMarkdownToPlainText(markdown, defaultOptions);
        expect(result.trim()).toBe(expected);
    });

    it.each([
        [
            'should preserve inline code backticks',
            'Use the `console.log()` function to debug.',
            'Use the `console.log()` function to debug.',
        ],
        [
            'should preserve nested inline code backticks',
            'Use `` `backticks` `` for inline code.',
            'Use `` `backticks` `` for inline code.',
        ],
        [
            'should preserve fenced code block backticks',
            '```javascript\nconst x = 1;\nconsole.log(x);\n```',
            '```javascript\nconst x = 1;\nconsole.log(x);\n```',
        ],
        [
            'should use a longer code block fence when the content contains triple backticks',
            '````\n```nested fence```\n````',
            '````\n```nested fence```\n````',
        ],
    ])('%s when preserveCodeBackticks is enabled', (_name, markdown, expected) => {
        const result = convertMarkdownToPlainText(markdown, { ...defaultOptions, preserveCodeBackticks: true });
        expect(result.trim()).toBe(expected);
    });
});

// Line Break Handling
describe('Line Break Handling', () => {
    it.each([
        ['should convert soft line breaks to newlines', 'Line one\nLine two', 'Line one\nLine two'],
        // Two spaces + newline = hard break
        ['should convert hard line breaks to newlines', 'Line one  \nLine two', 'Line one\nLine two'],
        // Backslash + newline = hard break
        ['should handle backslash hard line breaks', 'Line one\\\nLine two', 'Line one\nLine two'],
        [
            'should handle mixed line break scenarios',
            'First paragraph with soft break\nand continuation.\n\nSecond paragraph with hard break  \non new line.\n\nThird paragraph with backslash break\\\non new line.',
            'First paragraph with soft break\nand continuation.\n\nSecond paragraph with hard break\non new line.\n\nThird paragraph with backslash break\non new line.',
        ],
        [
            'should preserve line breaks within code blocks',
            '```\nline one\nline two\nline three\n```',
            'line one\nline two\nline three',
        ],
        // Multiple newlines should collapse to max configured newlines (likely 2)
        ['should handle multiple consecutive line breaks', 'Line one\n\n\nLine two', 'Line one\n\nLine two'],
        [
            'should handle line breaks in blockquotes',
            '> First line\n> Second line  \n> Hard break line\n> \n> New paragraph in quote',
            'First line\nSecond line\nHard break line\n\nNew paragraph in quote',
        ],
    ])('%s', (_name, markdown, expected) => {
        const result = convertMarkdownToPlainText(markdown, defaultOptions);
        expect(result.trim()).toBe(expected);
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
        const markdown = fs.readFileSync(path.resolve(__dirname, '../../README.md'), 'utf8');
        expect(() => convertMarkdownToPlainText(markdown, defaultOptions)).not.toThrow();
    });
});

// Remark plugin integration
describe('Remark Plugin Integration', () => {
    it('should use remark marker support for highlighted text', () => {
        const markdown = '==highlighted==';
        const options = { ...defaultOptions, preserveMark: true };
        const result = convertMarkdownToPlainText(markdown, options);
        expect(result.trim()).toBe('==highlighted==');
    });
});
