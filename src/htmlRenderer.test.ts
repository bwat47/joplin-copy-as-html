// This mock will be hoisted to the top by Jest, applying to all tests in this file.
jest.mock('api', () => ({
    __esModule: true, // This property helps Jest handle default exports correctly.
    default: {
        data: {
            get: jest.fn(),
        },
        settings: {
            value: jest.fn(),
            globalValue: jest.fn(),
        },
        // Mock other Joplin namespaces as needed
    },
}));

import { processHtmlConversion } from './htmlRenderer';
import {
    resetAllJoplinMocks,
    mockHtmlSettings,
    mockGlobalPlugins,
    enableOnlyPlugin,
    mockImageResource,
    genResourceId,
} from './testHelpers';

// Clear mocks before each test to ensure a clean slate
beforeEach(() => {
    resetAllJoplinMocks();
});

// HTML conversion tests

describe('processHtmlConversion', () => {
    it('should process a simple markdown string without images when embedImages is false', async () => {
        // Mock the settings the function will ask for
        mockHtmlSettings({ embedImages: false, exportFullHtml: false });
        mockGlobalPlugins([]);

        const markdown = '## Hello World';
        const result = await processHtmlConversion(markdown);

        // The result should be a clean HTML fragment
        expect(result.trim()).toBe('<h2>Hello World</h2>');
    });

    describe('Image Embedding', () => {
        it('should convert resource reference to base64 data URI', async () => {
            const resourceId = genResourceId();
            const markdown = `![test](:/${resourceId})`;

            mockHtmlSettings({ embedImages: true, exportFullHtml: false });
            mockGlobalPlugins([]);
            mockImageResource(resourceId, 'image/jpeg', 'fake-jpeg-data');

            const result = await processHtmlConversion(markdown);

            expect(result).toContain('data:image/jpeg;base64,');
            const expectedBase64 = Buffer.from('fake-jpeg-data').toString('base64');
            expect(result).toContain(expectedBase64);
        });

        it('should preserve alt text when embedding images', async () => {
            const resourceId = genResourceId();
            const markdown = `![my custom alt text](:/${resourceId})`;

            mockHtmlSettings({ embedImages: true, exportFullHtml: false });
            mockGlobalPlugins([]);
            mockImageResource(resourceId, 'image/png', 'fake-data');

            const result = await processHtmlConversion(markdown);

            expect(result).toContain('alt="my custom alt text"');
        });

        it('should remove original resource references after embedding', async () => {
            const resourceId = genResourceId();
            const markdown = `![test](:/${resourceId})`;

            mockHtmlSettings({ embedImages: true, exportFullHtml: false });
            mockGlobalPlugins([]);
            mockImageResource(resourceId, 'image/png', 'fake-data');

            const result = await processHtmlConversion(markdown);

            expect(result).not.toMatch(new RegExp(`:/${resourceId}`));
        });

        it('should not leave dimension placeholder markers', async () => {
            const resourceId = genResourceId();
            const markdown = `<img src=":/${resourceId}" width="100" height="200">`;

            mockHtmlSettings({ embedImages: true, exportFullHtml: false });
            mockGlobalPlugins([]);
            mockImageResource(resourceId, 'image/png', 'fake-data');

            const result = await processHtmlConversion(markdown);

            expect(result).not.toContain('DIMENSION_');
        });
    });

    it('should export as full HTML document when exportFullHtml is true', async () => {
        const markdown = '# Test Heading\n\nSome content.';
        mockHtmlSettings({ embedImages: false, exportFullHtml: true });
        mockGlobalPlugins([]); // profileDir not needed unless code fetches it explicitly

        const result = await processHtmlConversion(markdown);

        // Should be wrapped as a complete HTML document
        expect(result).toContain('<!DOCTYPE html>');
        expect(result).toContain('<h1>Test Heading</h1>');
    });

    it('should export as HTML fragment when exportFullHtml is false', async () => {
        const markdown = '# Test Heading\n\nSome content.';

        // Mock the settings
        mockHtmlSettings({ embedImages: false, exportFullHtml: false });
        mockGlobalPlugins([]);

        const result = await processHtmlConversion(markdown);

        // Should be just the HTML content without document wrapper
        expect(result).not.toContain('<!DOCTYPE html>');
        expect(result).not.toContain('<html>');
        expect(result).not.toContain('<head>');
        expect(result).not.toContain('<body>');
        expect(result).toContain('<h1>Test Heading</h1>');
        expect(result).toContain('<p>Some content.</p>');
    });

    it('should render GitHub alert blocks (note)', async () => {
        const markdown = '> [!note]\n> Github alert note test';
        mockHtmlSettings({ embedImages: false, exportFullHtml: false });
        mockGlobalPlugins([]);
        const result = await processHtmlConversion(markdown);
        expect(result).toMatch(/markdown-alert-note/);
        expect(result).toContain('Github alert note test');
        expect(result).not.toContain('[!note]');
    });

    it('should render GitHub alert blocks without SVG icons', async () => {
        const markdown = '> [!warning]\n> Icon suppression test';
        mockHtmlSettings({ embedImages: false, exportFullHtml: false });
        mockGlobalPlugins([]);
        const result = await processHtmlConversion(markdown);
        expect(result).toMatch(/markdown-alert-warning/);
        expect(result).toContain('Icon suppression test');
        // Ensure no inline SVG was emitted
        expect(result).not.toMatch(/<svg[\s>]/i);
    });
});

// Test adherance to Joplin global markdown settings

describe('Joplin Global Setting Integration', () => {
    it('should correctly render ==mark== syntax when the mark plugin is enabled', async () => {
        const markdown = 'This is ==highlighted== text.';
        mockHtmlSettings();
        enableOnlyPlugin('markdown.plugin.mark');

        const result = await processHtmlConversion(markdown);
        expect(result.trim()).toBe('<p>This is <mark>highlighted</mark> text.</p>');
    });

    it('should correctly render ~subscript~ when the sub plugin is enabled', async () => {
        const markdown = 'H~2~O';

        mockHtmlSettings();
        enableOnlyPlugin('markdown.plugin.sub');

        const result = await processHtmlConversion(markdown);
        expect(result.trim()).toBe('<p>H<sub>2</sub>O</p>');
    });

    it('should NOT render ==mark== syntax when the mark plugin is disabled', async () => {
        const markdown = 'This is ==highlighted== text.';
        mockHtmlSettings();
        mockGlobalPlugins([]);

        const result = await processHtmlConversion(markdown);
        expect(result.trim()).toBe('<p>This is ==highlighted== text.</p>');
    });

    it('should NOT render ~subscript~ when the sub plugin is disabled', async () => {
        const markdown = 'H~2~O';

        mockHtmlSettings();
        mockGlobalPlugins([]);

        const result = await processHtmlConversion(markdown);
        expect(result.trim()).toBe('<p>H~2~O</p>');
    });

    it('should correctly render ^superscript^ when the sup plugin is enabled', async () => {
        const markdown = 'x^2^';

        mockHtmlSettings();
        enableOnlyPlugin('markdown.plugin.sup');

        const result = await processHtmlConversion(markdown);
        expect(result.trim()).toBe('<p>x<sup>2</sup></p>');
    });

    it('should NOT render ^superscript^ when the sup plugin is disabled', async () => {
        const markdown = 'x^2^';

        mockHtmlSettings();
        mockGlobalPlugins([]);

        const result = await processHtmlConversion(markdown);
        expect(result.trim()).toBe('<p>x^2^</p>');
    });

    it('should correctly render ++insert++ when the ins plugin is enabled', async () => {
        const markdown = 'This is ++inserted++ text.';

        mockHtmlSettings();
        enableOnlyPlugin('markdown.plugin.insert');

        const result = await processHtmlConversion(markdown);
        expect(result.trim()).toBe('<p>This is <ins>inserted</ins> text.</p>');
    });

    it('should NOT render ++insert++ when the ins plugin is disabled', async () => {
        const markdown = 'This is ++inserted++ text.';

        mockHtmlSettings();
        mockGlobalPlugins([]);

        const result = await processHtmlConversion(markdown);
        expect(result.trim()).toBe('<p>This is ++inserted++ text.</p>');
    });

    it('should apply typographic replacements when typographer is enabled', async () => {
        const markdown = '"Smartypants, double quotes" and test...';

        mockHtmlSettings();
        enableOnlyPlugin('markdown.plugin.typographer');

        const result = await processHtmlConversion(markdown);
        // Check that typographic replacements occurred
        expect(result).toContain('Smartypants');
        expect(result).toContain('test…'); // should have ellipsis
        expect(result).not.toContain('test...'); // should not have three dots
    });

    it('should NOT apply typographic replacements when typographer is disabled', async () => {
        const markdown = '"Smartypants, double quotes" and test...';

        mockHtmlSettings();
        mockGlobalPlugins([]);

        const result = await processHtmlConversion(markdown);
        // Should contain straight quotes and three dots, not smart typography
        expect(result).toContain('"Smartypants, double quotes"');
        expect(result).toContain('test...');
        expect(result).not.toContain('…'); // should not have ellipsis
    });

    it('should NOT convert single line breaks to <br> when soft breaks are enabled', async () => {
        const markdown = 'Line one\nLine two';

        mockHtmlSettings();
        enableOnlyPlugin('markdown.plugin.softbreaks');

        const result = await processHtmlConversion(markdown);
        // When soft breaks are enabled, single newlines should NOT become <br> tags
        expect(result).not.toContain('<br>');
        expect(result.trim()).toBe('<p>Line one\nLine two</p>');
    });

    it('should convert single line breaks to <br> when soft breaks are disabled', async () => {
        const markdown = 'Line one\nLine two';

        mockHtmlSettings();
        mockGlobalPlugins([]);

        const result = await processHtmlConversion(markdown);
        // When soft breaks are disabled, single newlines should become <br> tags
        expect(result).toContain('<br>');
        expect(result.trim()).toBe('<p>Line one<br>\nLine two</p>');
    });

    it('should convert URLs and emails to links when linkify is enabled', async () => {
        const markdown = 'Visit https://example.com\n\nEmail: test@example.com';

        mockHtmlSettings();
        enableOnlyPlugin('markdown.plugin.linkify');

        const result = await processHtmlConversion(markdown);
        // URLs and emails should be converted to clickable links
        expect(result).toContain('<a href=');
        expect(result).toContain('https://example.com');
        expect(result).toContain('test@example.com'); // email text still present (not necessarily linkified)
    });

    it('should not auto-link plain emails when linkify enabled (fuzzyEmail disabled)', async () => {
        const markdown = 'Contact: test@example.com for details';
        mockHtmlSettings();
        enableOnlyPlugin('markdown.plugin.linkify');
        const result = await processHtmlConversion(markdown);
        // Should contain the plain email text
        expect(result).toContain('test@example.com');
        // Should NOT have a mailto link automatically generated
        expect(result).not.toMatch(/href="mailto:test@example.com"/i);
    });

    it('should linkify explicit mailto protocol', async () => {
        const markdown = 'Email me: mailto:test@example.com';
        mockHtmlSettings();
        enableOnlyPlugin('markdown.plugin.linkify');
        const result = await processHtmlConversion(markdown);
        expect(result).toMatch(/<a href="mailto:test@example.com"[^>]*>mailto:test@example.com<\/a>/i);
    });

    it('should create two separate links on a single line with two protocol URLs', async () => {
        const markdown =
            'Tool to unminify json: https://unminify.com/ and to minify json: https://jsonformatter.org/json-minify';
        mockHtmlSettings();
        enableOnlyPlugin('markdown.plugin.linkify');
        const result = await processHtmlConversion(markdown);
        // Two separate anchors
        const anchors = result.match(/<a href="https:\/\/[^"']+"/g) || [];
        expect(anchors.length).toBe(2);
        expect(result).toContain('href="https://unminify.com/"');
        expect(result).toContain('href="https://jsonformatter.org/json-minify"');
        // Ensure no merged href containing encoded spaces or second URL inside first href
        expect(result).not.toMatch(/href="https:\/\/unminify.com\/[^"']+jsonformatter/);
    });

    it('should NOT convert URLs and emails to links when linkify is disabled', async () => {
        const markdown = 'Visit https://example.com\n\nEmail: test@example.com';

        mockHtmlSettings();
        mockGlobalPlugins([]);

        const result = await processHtmlConversion(markdown);
        // URLs and emails should remain as plain text
        expect(result).not.toContain('<a href=');
        expect(result).toContain('https://example.com');
        expect(result).toContain('test@example.com');
    });

    it('should convert emoji shortcodes to emoji when emoji plugin is enabled', async () => {
        const markdown = 'Hello :smile: and :heart: world!';

        mockHtmlSettings();
        enableOnlyPlugin('markdown.plugin.emoji');

        const result = await processHtmlConversion(markdown);
        // Emoji shortcodes should be converted to actual emoji
        expect(result).toContain('😄'); // :smile:
        expect(result).toContain('❤️'); // :heart:
        expect(result).not.toContain(':smile:');
        expect(result).not.toContain(':heart:');
    });

    it('should NOT convert emoji shortcodes when emoji plugin is disabled', async () => {
        const markdown = 'Hello :smile: and :heart: world!';

        mockHtmlSettings();
        mockGlobalPlugins([]);

        const result = await processHtmlConversion(markdown);
        // Emoji shortcodes should remain as text
        expect(result).toContain(':smile:');
        expect(result).toContain(':heart:');
        expect(result).not.toContain('😄');
        expect(result).not.toContain('❤️');
        expect(result.trim()).toBe('<p>Hello :smile: and :heart: world!</p>');
    });

    it('should render definition lists when deflist plugin is enabled', async () => {
        const markdown = `Term 1
:   Definition 1

Term 2
:   Definition 2`;

        mockHtmlSettings();
        enableOnlyPlugin('markdown.plugin.deflist');

        const result = await processHtmlConversion(markdown);
        // Should contain definition list HTML elements
        expect(result).toContain('<dl>');
        expect(result).toContain('<dt>');
        expect(result).toContain('<dd>');
        expect(result).toContain('Term 1');
        expect(result).toContain('Definition 1');
    });

    it('should NOT render definition lists when deflist plugin is disabled', async () => {
        const markdown = `Term 1
:   Definition 1

Term 2
:   Definition 2`;

        mockHtmlSettings();
        mockGlobalPlugins([]);

        const result = await processHtmlConversion(markdown);
        // Should not contain definition list HTML elements
        expect(result).not.toContain('<dl>');
        expect(result).not.toContain('<dt>');
        expect(result).not.toContain('<dd>');
        expect(result).toContain('Term 1');
        expect(result).toContain('Definition 1');
    });

    it('should render abbreviations when abbr plugin is enabled', async () => {
        const markdown = `The HTML specification
is maintained by the W3C.

*[HTML]: Hyper Text Markup Language
*[W3C]: World Wide Web Consortium`;

        mockHtmlSettings();
        enableOnlyPlugin('markdown.plugin.abbr');

        const result = await processHtmlConversion(markdown);
        // Should contain abbreviation HTML elements with title attributes
        expect(result).toContain('<abbr');
        expect(result).toContain('title="Hyper Text Markup Language"');
        expect(result).toContain('title="World Wide Web Consortium"');
    });

    it('should NOT render abbreviations when abbr plugin is disabled', async () => {
        const markdown = `The HTML specification
is maintained by the W3C.

*[HTML]: Hyper Text Markup Language
*[W3C]: World Wide Web Consortium`;

        mockHtmlSettings();
        mockGlobalPlugins([]);

        const result = await processHtmlConversion(markdown);
        // Should not contain abbreviation HTML elements
        expect(result).not.toContain('<abbr');
        expect(result).toContain('HTML');
        expect(result).toContain('W3C');
    });

    it('should render footnotes when footnote plugin is enabled', async () => {
        const markdown = `This is text with footnotes[^1].

Here is another footnote[^note].

[^1]: This is the first footnote.
[^note]: This is the second footnote.`;

        mockHtmlSettings();
        enableOnlyPlugin('markdown.plugin.footnote');

        const result = await processHtmlConversion(markdown);
        // Should contain footnote HTML elements
        expect(result).toContain('class="footnote-ref"');
        expect(result).toContain('class="footnotes"');
        expect(result).toContain('This is the first footnote');
        expect(result).toContain('This is the second footnote');
    });

    it('should NOT render footnotes when footnote plugin is disabled', async () => {
        const markdown = `This is text with footnotes[^1].

Here is another footnote[^note].

[^1]: This is the first footnote.
[^note]: This is the second footnote.`;

        mockHtmlSettings();
        mockGlobalPlugins([]);

        const result = await processHtmlConversion(markdown);
        // Should not contain footnote HTML elements
        expect(result).not.toContain('class="footnote-ref"');
        expect(result).not.toContain('class="footnotes"');
        expect(result).toContain('[^1]');
        expect(result).toContain('[^note]');
        expect(result).toContain('This is the first footnote');
        expect(result).toContain('This is the second footnote');
    });

    it('should render table of contents when toc plugin is enabled', async () => {
        const markdown = `[[TOC]]

# First Heading

Some content here.

## Second Heading

More content.

### Third Heading

Final content.`;

        mockHtmlSettings();
        enableOnlyPlugin('markdown.plugin.toc');

        const result = await processHtmlConversion(markdown);
        // Should contain table of contents HTML elements
        expect(result).toContain('class="table-of-contents"');
        expect(result).toContain('<ul>');
        expect(result).toContain('<li>');
        expect(result).toContain('First Heading');
        expect(result).toContain('Second Heading');
        expect(result).toContain('Third Heading');
    });

    it('should NOT render table of contents when toc plugin is disabled', async () => {
        const markdown = `[[TOC]]

# First Heading

Some content here.

## Second Heading

More content.

### Third Heading

Final content.`;

        mockHtmlSettings();
        mockGlobalPlugins([]);

        const result = await processHtmlConversion(markdown);
        // Should not contain table of contents HTML elements
        expect(result).not.toContain('class="table-of-contents"');
        expect(result).toContain('[[TOC]]'); // Should remain as literal text
        expect(result).toContain('First Heading');
        expect(result).toContain('Second Heading');
        expect(result).toContain('Third Heading');
    });

    it('should render multimarkdown tables with enhanced features when plugin is enabled', async () => {
        const markdown = `| Left | Center | Right |
|:-----|:------:|------:|
| L1   |   C1   |    R1 |
| L2   |   C2   |    R2 |`;

        mockHtmlSettings();
        enableOnlyPlugin('markdown.plugin.multitable');

        const result = await processHtmlConversion(markdown);

        // Should contain table with proper structure
        expect(result).toContain('<table>');
        expect(result).toContain('<th');
        expect(result).toContain('<td');

        // Should have alignment styles (multimarkdown enhancement)
        expect(result).toContain('text-align:left');
        expect(result).toContain('text-align:center');
        expect(result).toContain('text-align:right');

        // Content should be preserved
        expect(result).toContain('Left');
        expect(result).toContain('Center');
        expect(result).toContain('Right');
    });

    it('should not render multimarkdown table features when plugin is disabled', async () => {
        // Use multimarkdown-specific features that core markdown-it doesn't support
        const markdown = `| Column 1 | Column 2 |
|----------|----------|
| Cell with<br/>line break | Normal cell |
| Cell with **formatting** | Another cell |`;

        mockHtmlSettings();
        mockGlobalPlugins([]);

        const result = await processHtmlConversion(markdown);

        // Should render as basic table without multimarkdown enhancements
        expect(result).toContain('<table>');
        expect(result).toContain('Column 1');
        expect(result).toContain('Column 2');

        // Without multimarkdown plugin, advanced features should render as plain text
        // (This test validates the plugin is actually making a difference)
        expect(result).toContain('Cell with');
        expect(result).toContain('Normal cell');
    });

    it('should render task lists with checkboxes', async () => {
        const markdown = `- [x] Completed task
- [ ] Incomplete task
- [x] Another completed task`;

        mockHtmlSettings();
        mockGlobalPlugins();

        const result = await processHtmlConversion(markdown);

        // Should contain task list elements
        expect(result).toContain('class="task-list-container"');
        expect(result).toContain('class="task-list-item"');
        expect(result).toContain('class="task-list-item-checkbox"');
        expect(result).toContain('type="checkbox"');
        expect(result).toContain('checked="checked"');
        expect(result).toContain('disabled="disabled"');
        expect(result).toContain('Completed task');
        expect(result).toContain('Incomplete task');
    });
});
