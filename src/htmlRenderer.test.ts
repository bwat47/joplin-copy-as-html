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

import joplin from 'api';
import {
    extractImageDimensions,
    applyPreservedDimensions,
    processHtmlConversion,
    convertResourceToBase64,
} from './htmlRenderer';
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

// Image Dimension Handling - Component Tests

describe('extractImageDimensions', () => {
    test.each([
        [
            'width only',
            '<img src=":/abcdef1234567890abcdef1234567890" width="100"/>',
            { width: '100', height: undefined },
        ],
        [
            'height only',
            '<img src=":/abcdef1234567890abcdef1234567890" height="200"/>',
            { width: undefined, height: '200' },
        ],
        [
            'both attributes',
            '<img src=":/abcdef1234567890abcdef1234567890" width="100" height="200"/>',
            { width: '100', height: '200' },
        ],
    ])('should extract %s from img tags', (_description, input, expected) => {
        const { dimensions } = extractImageDimensions(input, true);

        expect(dimensions.size).toBe(1);
        const dimension = dimensions.values().next().value;
        expect(dimension.width).toBe(expected.width);
        expect(dimension.height).toBe(expected.height);
        expect(dimension.resourceId).toBe('abcdef1234567890abcdef1234567890');
    });

    it('should create no dimensions for images without width/height', () => {
        const markdown = '<img src=":/abcdef1234567890abcdef1234567890"/>';
        const { dimensions } = extractImageDimensions(markdown, true);

        expect(dimensions.size).toBe(0);
    });

    it('should transform img tags to markdown with dimension keys', () => {
        const resourceId = 'a1b2c3d4e5f6a1b2c3d4e5f6a1b2c3d4';
        const markdown = `<img src=":/${resourceId}" width="100" height="200"/>`;
        const { processedMarkdown } = extractImageDimensions(markdown, true);

        expect(processedMarkdown).toContain(`![DIMENSION_0](:/${resourceId})`);
    });

    it('should strip all image tags when embedImages is false', () => {
        const markdown = 'Here is an image: <img src=":/xyz..." width="100">';
        const { processedMarkdown, dimensions } = extractImageDimensions(markdown, false);

        expect(processedMarkdown).toBe('Here is an image: ');
        expect(dimensions.size).toBe(0);
    });

    it('should not process images in code blocks', () => {
        const markdown = '```\n<img src=":/abc123" width="100"/>\n```';
        const { processedMarkdown } = extractImageDimensions(markdown, true);

        // Should remain unchanged since it's in a code block
        expect(processedMarkdown).toContain('<img src=":/abc123" width="100"/>');
    });

    it('should handle multiple images with incremented dimension keys', () => {
        const markdown =
            '<img src=":/abcdef1234567890abcdef1234567890" width="100"/><img src=":/fedcba0987654321fedcba0987654321" height="200"/>';
        const { processedMarkdown, dimensions } = extractImageDimensions(markdown, true);

        expect(dimensions.size).toBe(2);
        expect(processedMarkdown).toContain('![DIMENSION_0](:');
        expect(processedMarkdown).toContain('![DIMENSION_1](:');
    });
});

describe('applyPreservedDimensions', () => {
    it('should apply width and height to matching img tags', () => {
        const html = '<img src=":/abc123" alt="DIMENSION_0">';
        const dimensions = new Map([['DIMENSION_0', { width: '100', height: '200', resourceId: 'abc123' }]]);

        const result = applyPreservedDimensions(html, dimensions);

        expect(result).toContain('width="100"');
        expect(result).toContain('height="200"');
        expect(result).toContain('alt=""'); // Should clean up the marker
    });

    it('should apply only width when height is undefined', () => {
        const html = '<img src=":/abc123" alt="DIMENSION_0">';
        const dimensions = new Map([['DIMENSION_0', { width: '100', height: undefined, resourceId: 'abc123' }]]);

        const result = applyPreservedDimensions(html, dimensions);

        expect(result).toContain('width="100"');
        expect(result).not.toContain('height=');
    });

    it('should apply only height when width is undefined', () => {
        const html = '<img src=":/abc123" alt="DIMENSION_0">';
        const dimensions = new Map([['DIMENSION_0', { width: undefined, height: '200', resourceId: 'abc123' }]]);

        const result = applyPreservedDimensions(html, dimensions);

        expect(result).toContain('height="200"');
        expect(result).not.toContain('width=');
    });

    it('should handle multiple dimension keys in HTML', () => {
        const html = '<img src=":/abc123" alt="DIMENSION_0"><img src=":/def456" alt="DIMENSION_1">';
        const dimensions = new Map([
            ['DIMENSION_0', { width: '100', height: undefined, resourceId: 'abc123' }],
            ['DIMENSION_1', { width: undefined, height: '200', resourceId: 'def456' }],
        ]);

        const result = applyPreservedDimensions(html, dimensions);

        expect(result).toContain('width="100"');
        expect(result).toContain('height="200"');
    });

    it('should return unchanged HTML when no dimensions match', () => {
        const html = '<img src=":/abc123" alt="some-other-alt">';
        const dimensions = new Map([['DIMENSION_0', { width: '100', height: '200', resourceId: 'abc123' }]]);

        const result = applyPreservedDimensions(html, dimensions);

        expect(result).toBe(html); // Should be unchanged
    });
});

// Integration test to ensure components work together
describe('Image Dimension Integration', () => {
    it('should extract and apply dimensions in full pipeline', () => {
        const resourceId = 'a1b2c3d4e5f6a1b2c3d4e5f6a1b2c3d4';
        const markdown = `<img src=":/${resourceId}" width="100" height="200"/>`;

        // Extract dimensions
        const { processedMarkdown, dimensions } = extractImageDimensions(markdown, true);
        expect(processedMarkdown).toContain(`![DIMENSION_0](:/${resourceId})`);

        // Simulate rendered HTML from markdown processor
        const renderedHtml = `<img src=":/${resourceId}" alt="DIMENSION_0">`;

        // Apply preserved dimensions
        const finalHtml = applyPreservedDimensions(renderedHtml, dimensions);

        expect(finalHtml).toContain('width="100"');
        expect(finalHtml).toContain('height="200"');
        expect(finalHtml).not.toContain('alt="DIMENSION_0"');
    });
});

// Resource base64 conversion tests

describe('convertResourceToBase64', () => {
    it('should correctly convert a valid image resource to a base64 string', async () => {
        const resourceId = 'a1b2c3d4e5f6a1b2c3d4e5f6a1b2c3d4';
        const mockResource = { id: resourceId, mime: 'image/png' };
        const mockFile = { body: Buffer.from('fake-image-data') };

        // Set up the mock return values for the joplin.data.get calls
        (joplin.data.get as jest.Mock)
            .mockResolvedValueOnce(mockResource) // First call gets resource metadata
            .mockResolvedValueOnce(mockFile); // Second call gets the file body

        const result = await convertResourceToBase64(resourceId);

        expect(result).toBe('data:image/png;base64,ZmFrZS1pbWFnZS1kYXRh'); // "fake-image-data" in base64
        expect(joplin.data.get).toHaveBeenCalledWith(['resources', resourceId], { fields: ['id', 'mime'] });
        expect(joplin.data.get).toHaveBeenCalledWith(['resources', resourceId, 'file']);
    });

    it('should return an error span if the resource is not an image', async () => {
        const resourceId = 'a1b2c3d4e5f6a1b2c3d4e5f6a1b2c3d4';
        const mockResource = { id: resourceId, mime: 'application/pdf' };

        (joplin.data.get as jest.Mock).mockResolvedValueOnce(mockResource);

        const result = await convertResourceToBase64(resourceId);
        expect(result).toContain('is not an image');
    });

    it('should return an error span for an invalid resource ID', async () => {
        const result = await convertResourceToBase64('invalid-id');
        expect(result).toContain('is not a valid Joplin resource ID');
        // Ensure the API was not even called
        expect(joplin.data.get).not.toHaveBeenCalled();
    });
});

// HTML conversion tests

describe('processHtmlConversion', () => {
    it('should process a simple markdown string without images', async () => {
        // Mock the settings the function will ask for
        mockHtmlSettings({ embedImages: false, exportFullHtml: false });
        mockGlobalPlugins([]);

        const markdown = '## Hello World';
        const result = await processHtmlConversion(markdown);

        // The result should be a clean HTML fragment
        expect(result.trim()).toBe('<h2>Hello World</h2>');
    });

    it('should embed an image when embedImages is true', async () => {
        const resourceId = genResourceId();
        const markdown = `![my image](:/${resourceId})`;

        mockHtmlSettings({ embedImages: true, exportFullHtml: false });
        mockGlobalPlugins([]);
        mockImageResource(resourceId, 'image/jpeg', 'fake-jpeg-data');

        const result = await processHtmlConversion(markdown);

        expect(result).toContain('<img src="data:image/jpeg;base64,');
        expect(result).toContain('alt="my image"');
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
        expect(result).toContain('test@example.com');
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

    it('should render multimarkdown tables with alignment when multimd-table plugin is enabled', async () => {
        const markdown = `| Left | Center | Right |
|:-----|:------:|------:|
| L1   |   C1   |    R1 |
| L2   |   C2   |    R2 |`;

        mockHtmlSettings();
        enableOnlyPlugin('markdown.plugin.multitable');

        const result = await processHtmlConversion(markdown);
        // Should contain table with alignment styles
        expect(result).toContain('<table>');
        expect(result).toContain('<th');
        expect(result).toContain('<td');
        expect(result).toContain('text-align:left');
        expect(result).toContain('text-align:center');
        expect(result).toContain('text-align:right');
        expect(result).toContain('Left');
        expect(result).toContain('Center');
        expect(result).toContain('Right');
    });

    it('should render basic tables when multimd-table plugin is disabled', async () => {
        const markdown = `| Left | Center | Right |
|:-----|:------:|------:|
| L1   |   C1   |    R1 |
| L2   |   C2   |    R2 |`;

        mockHtmlSettings();
        mockGlobalPlugins([]);

        const result = await processHtmlConversion(markdown);
        // Should still render as a table with basic alignment (core markdown-it feature)
        expect(result).toContain('<table>');
        expect(result).toContain('Left');
        expect(result).toContain('Center');
        expect(result).toContain('Right');
        // Basic alignment is still supported by core markdown-it
        expect(result).toContain('text-align:left');
        expect(result).toContain('text-align:center');
        expect(result).toContain('text-align:right');
    });
});
