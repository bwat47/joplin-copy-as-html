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
import { extractImageDimensions, applyPreservedDimensions, convertResourceToBase64 } from './assetProcessor';
import { resetAllJoplinMocks } from '../testHelpers';

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
        expect(dimension.originalAlt).toBe('');
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

        // Should create two dimension entries
        expect(dimensions.size).toBe(2);

        // Should contain both placeholders in the processed markdown
        expect(processedMarkdown).toContain('![DIMENSION_0](:');
        expect(processedMarkdown).toContain('![DIMENSION_1](:');
    });

    it('should preserve original alt text in dimensions map', () => {
        const markdown = '<img src=":/abcdef1234567890abcdef1234567890" alt="My Image" width="100" height="200"/>';
        const { processedMarkdown, dimensions } = extractImageDimensions(markdown, true);

        expect(dimensions.size).toBe(1);
        const dimension = dimensions.values().next().value;
        expect(dimension.originalAlt).toBe('My Image');
        expect(processedMarkdown).toContain('![DIMENSION_0](:');
    });

    it('should handle empty alt text', () => {
        const markdown = '<img src=":/abcdef1234567890abcdef1234567890" alt="" width="100"/>';
        const { dimensions } = extractImageDimensions(markdown, true);

        const dimension = dimensions.values().next().value;
        expect(dimension.originalAlt).toBe('');
    });

    it('should handle missing alt attribute', () => {
        const markdown = '<img src=":/abcdef1234567890abcdef1234567890" width="100"/>';
        const { dimensions } = extractImageDimensions(markdown, true);

        const dimension = dimensions.values().next().value;
        expect(dimension.originalAlt).toBe('');
    });

    it('should preserve alt text even when no dimensions to preserve', () => {
        const markdown = '<img src=":/abcdef1234567890abcdef1234567890" alt="Important Image">';
        const { processedMarkdown } = extractImageDimensions(markdown, true);

        // Should preserve alt text in markdown format when no dimensions
        expect(processedMarkdown).toContain('![Important Image](:');
        expect(processedMarkdown).not.toContain('![](:');
    });
});

describe('applyPreservedDimensions', () => {
    it('should apply width and height to matching img tags', () => {
        const html = '<img src=":/abc123" alt="DIMENSION_0">';
        const dimensions = new Map([
            ['DIMENSION_0', { width: '100', height: '200', resourceId: 'abc123', originalAlt: '' }],
        ]);

        const result = applyPreservedDimensions(html, dimensions);

        expect(result).toContain('width="100"');
        expect(result).toContain('height="200"');
        expect(result).toContain('alt=""'); // Should use empty original alt
    });

    it('should apply only width when height is undefined', () => {
        const html = '<img src=":/abc123" alt="DIMENSION_0">';
        const dimensions = new Map([
            ['DIMENSION_0', { width: '100', height: undefined, resourceId: 'abc123', originalAlt: '' }],
        ]);

        const result = applyPreservedDimensions(html, dimensions);

        expect(result).toContain('width="100"');
        expect(result).not.toContain('height=');
        expect(result).toContain('alt=""'); // Should use empty original alt
    });

    it('should apply only height when width is undefined', () => {
        const html = '<img src=":/abc123" alt="DIMENSION_0">';
        const dimensions = new Map([
            ['DIMENSION_0', { width: undefined, height: '200', resourceId: 'abc123', originalAlt: '' }],
        ]);

        const result = applyPreservedDimensions(html, dimensions);

        expect(result).toContain('height="200"');
        expect(result).not.toContain('width=');
        expect(result).toContain('alt=""'); // Should use empty original alt
    });

    it('should handle multiple dimension keys in HTML', () => {
        const html = '<img src=":/abc123" alt="DIMENSION_0"><img src=":/def456" alt="DIMENSION_1">';
        const dimensions = new Map([
            ['DIMENSION_0', { width: '100', height: undefined, resourceId: 'abc123', originalAlt: '' }],
            ['DIMENSION_1', { width: undefined, height: '200', resourceId: 'def456', originalAlt: '' }],
        ]);

        const result = applyPreservedDimensions(html, dimensions);

        expect(result).toContain('width="100"');
        expect(result).toContain('height="200"');
    });

    it('should return unchanged HTML when no dimensions match', () => {
        const html = '<img src=":/abc123" alt="some-other-alt">';
        const dimensions = new Map([
            ['DIMENSION_0', { width: '100', height: '200', resourceId: 'abc123', originalAlt: '' }],
        ]);

        const result = applyPreservedDimensions(html, dimensions);

        expect(result).toBe(html); // Should be unchanged
    });

    it('should restore original alt text when applying dimensions', () => {
        const html = '<img src=":/abc123" alt="DIMENSION_0">';
        const dimensions = new Map([
            [
                'DIMENSION_0',
                {
                    width: '100',
                    height: '200',
                    resourceId: 'abc123',
                    originalAlt: 'My Important Image',
                },
            ],
        ]);

        const result = applyPreservedDimensions(html, dimensions);

        expect(result).toContain('width="100"');
        expect(result).toContain('height="200"');
        expect(result).toContain('alt="My Important Image"');
        expect(result).not.toContain('alt="DIMENSION_0"');
    });

    it('should handle original alt text with special characters', () => {
        const html = '<img src=":/abc123" alt="DIMENSION_0">';
        const dimensions = new Map([
            [
                'DIMENSION_0',
                {
                    width: '100',
                    resourceId: 'abc123',
                    originalAlt: 'Image with "quotes" & ampersands',
                    height: undefined,
                },
            ],
        ]);

        const result = applyPreservedDimensions(html, dimensions);

        expect(result).toContain('width="100"');
        // Quotes should be encoded, standalone & becomes &amp;
        expect(result).toContain('alt="Image with &quot;quotes&quot; &amp; ampersands"');
        expect(result).not.toContain('DIMENSION_0');
    });

    it('escapes HTML significant characters in original alt', () => {
        const html = '<img src=":/abc123" alt="DIMENSION_0">';
        const dimensions = new Map([
            [
                'DIMENSION_0',
                {
                    width: undefined,
                    height: undefined,
                    resourceId: 'abc123',
                    originalAlt: '5 < 6 & 7 > 3',
                },
            ],
        ]);
        const result = applyPreservedDimensions(html, dimensions);
        expect(result).toContain('alt="5 &lt; 6 &amp; 7 &gt; 3"');
    });

    it('does not double-encode existing entities in alt', () => {
        const html = '<img src=":/abc123" alt="DIMENSION_0">';
        const dimensions = new Map([
            [
                'DIMENSION_0',
                {
                    width: undefined,
                    height: undefined,
                    resourceId: 'abc123',
                    originalAlt: 'Already &lt; encoded &amp; entity',
                },
            ],
        ]);
        const result = applyPreservedDimensions(html, dimensions);
        // &lt; and &amp; should remain exactly once
        expect(result.match(/&lt;/g)?.length).toBe(1);
        expect(result.match(/&amp;/g)?.length).toBe(1); // original &amp; only
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
        expect(finalHtml).toContain('alt=""'); // Empty original alt
        expect(finalHtml).not.toContain('DIMENSION_0');
    });

    it('should extract and apply dimensions with alt text preservation in full pipeline', () => {
        const resourceId = 'a1b2c3d4e5f6a1b2c3d4e5f6a1b2c3d4';
        const markdown = `<img src=":/${resourceId}" alt="Test Chart" width="100" height="200"/>`;

        // Extract dimensions
        const { processedMarkdown, dimensions } = extractImageDimensions(markdown, true);
        expect(processedMarkdown).toContain(`![DIMENSION_0](:/${resourceId})`);

        // Verify alt text is preserved in dimensions
        const dimension = dimensions.get('DIMENSION_0');
        expect(dimension?.originalAlt).toBe('Test Chart');

        // Simulate rendered HTML from markdown processor
        const renderedHtml = `<img src=":/${resourceId}" alt="DIMENSION_0">`;

        // Apply preserved dimensions
        const finalHtml = applyPreservedDimensions(renderedHtml, dimensions);

        expect(finalHtml).toContain('width="100"');
        expect(finalHtml).toContain('height="200"');
        expect(finalHtml).toContain('alt="Test Chart"');
        expect(finalHtml).not.toContain('DIMENSION_0');
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

// Remote Image Processing Tests
describe('Remote Image Processing', () => {
    describe('extractImageDimensions with remote images', () => {
        it('should process remote images when downloadRemoteImages is enabled', () => {
            const markdown = '<img src="https://example.com/image.jpg" width="100" height="200" alt="Test Image">';
            
            const { processedMarkdown, remoteImages } = extractImageDimensions(markdown, true, true);
            
            expect(processedMarkdown).toContain('![REMOTE_0](https://example.com/image.jpg)');
            expect(remoteImages.size).toBe(1);
            
            const remoteImageData = remoteImages.get('REMOTE_0');
            expect(remoteImageData).toBeDefined();
            expect(remoteImageData?.originalUrl).toBe('https://example.com/image.jpg');
            expect(remoteImageData?.dimensions?.width).toBe('100');
            expect(remoteImageData?.dimensions?.height).toBe('200');
            expect(remoteImageData?.dimensions?.originalAlt).toBe('Test Image');
        });

        it('should not process remote images when downloadRemoteImages is disabled', () => {
            const markdown = '<img src="https://example.com/image.jpg" width="100" height="200">';
            
            const { processedMarkdown, remoteImages } = extractImageDimensions(markdown, true, false);
            
            expect(processedMarkdown).toBe(markdown); // Unchanged
            expect(remoteImages.size).toBe(0);
        });

        it('should not process remote images when embedImages is disabled', () => {
            const markdown = '<img src="https://example.com/image.jpg" width="100" height="200">';
            
            const { processedMarkdown, remoteImages } = extractImageDimensions(markdown, false, true);
            
            expect(processedMarkdown).toBe(''); // Images removed
            expect(remoteImages.size).toBe(0);
        });

        it('should handle multiple remote images', () => {
            const markdown = '<img src="https://example.com/image1.jpg" width="100">\n<img src="https://example.com/image2.png" height="200">';
            
            const { processedMarkdown, remoteImages } = extractImageDimensions(markdown, true, true);
            
            expect(remoteImages.size).toBe(2);
            expect(processedMarkdown).toContain('![REMOTE_0](https://example.com/image1.jpg)');
            expect(processedMarkdown).toContain('![REMOTE_1](https://example.com/image2.png)');
        });

        it('should handle remote images mixed with Joplin resources', () => {
            const resourceId = 'a1b2c3d4e5f6a1b2c3d4e5f6a1b2c3d4';
            const markdown = `<img src=":/${resourceId}" width="100">\n<img src="https://example.com/image.jpg" height="200">`;
            
            const { processedMarkdown, dimensions, remoteImages } = extractImageDimensions(markdown, true, true);
            
            expect(dimensions.size).toBe(1); // Joplin resource
            expect(remoteImages.size).toBe(1); // Remote image
            expect(processedMarkdown).toContain(`![DIMENSION_0](:/${resourceId})`);
            expect(processedMarkdown).toContain('![REMOTE_1](https://example.com/image.jpg)');
        });

        it('should skip remote images in code blocks', () => {
            const markdown = `Regular text
\`\`\`html
<img src="https://example.com/code-block-image.jpg">
\`\`\`
<img src="https://example.com/regular-image.jpg">`;
            
            const { processedMarkdown, remoteImages } = extractImageDimensions(markdown, true, true);
            
            expect(remoteImages.size).toBe(1); // Only the regular image, not the code block one
            expect(processedMarkdown).toContain('![REMOTE_0](https://example.com/regular-image.jpg)');
            expect(processedMarkdown).toContain('<img src="https://example.com/code-block-image.jpg">'); // Code block unchanged
        });

        it('should handle Markdown syntax remote images', () => {
            const markdown = '![home-top-img](https://raw.githubusercontent.com/laurent22/joplin/dev/Assets/WebsiteAssets/images/home-top-img.png)';
            
            const { processedMarkdown, remoteImages } = extractImageDimensions(markdown, true, true);
            
            expect(remoteImages.size).toBe(1);
            const [placeholder, remoteImageData] = Array.from(remoteImages.entries())[0];
            expect(placeholder).toBe('REMOTE_0');
            expect(remoteImageData.originalUrl).toBe('https://raw.githubusercontent.com/laurent22/joplin/dev/Assets/WebsiteAssets/images/home-top-img.png');
            expect(remoteImageData.dimensions?.originalAlt).toBe('home-top-img');
            expect(processedMarkdown).toBe('![REMOTE_0](https://raw.githubusercontent.com/laurent22/joplin/dev/Assets/WebsiteAssets/images/home-top-img.png)');
        });

        it('should handle mixed HTML and Markdown remote images', () => {
            const markdown = `<img src="https://example.com/html.jpg" width="100">
![markdown-image](https://example.com/markdown.jpg)`;
            
            const { processedMarkdown, remoteImages } = extractImageDimensions(markdown, true, true);
            
            expect(remoteImages.size).toBe(2);
            // Markdown is processed first, so it gets REMOTE_0, HTML gets REMOTE_1
            expect(processedMarkdown).toContain('![REMOTE_1](https://example.com/html.jpg)');
            expect(processedMarkdown).toContain('![REMOTE_0](https://example.com/markdown.jpg)');
        });

        it('should preserve alt text from Markdown remote images', () => {
            const markdown = '![My Cool Image](https://example.com/image.png)';
            
            const { remoteImages } = extractImageDimensions(markdown, true, true);
            
            const remoteImageData = Array.from(remoteImages.values())[0];
            expect(remoteImageData.dimensions?.originalAlt).toBe('My Cool Image');
        });

        it('should skip Markdown remote images in code blocks', () => {
            const markdown = `Regular text
\`\`\`markdown
![code-image](https://example.com/code.jpg)
\`\`\`
![regular-image](https://example.com/regular.jpg)`;
            
            const { processedMarkdown, remoteImages } = extractImageDimensions(markdown, true, true);
            
            expect(remoteImages.size).toBe(1); // Only the regular image
            expect(processedMarkdown).toContain('![REMOTE_0](https://example.com/regular.jpg)');
            expect(processedMarkdown).toContain('![code-image](https://example.com/code.jpg)'); // Code block unchanged
        });
    });

    describe('remote image dimension preservation', () => {
        it('should preserve dimensions for remote images', () => {
            // Simulate the full flow: extract -> render -> apply dimensions
            const markdown = '<img src="https://example.com/image.jpg" width="64" height="32" alt="test">';
            
            // Extract remote images and dimensions
            const { remoteImages } = extractImageDimensions(markdown, true, true);
            
            // Simulate what markdown-it would produce
            const renderedHtml = '<p><img src="https://example.com/image.jpg" alt="REMOTE_0"></p>';
            
            // Apply dimensions for remote images
            const finalHtml = applyPreservedDimensions(renderedHtml, new Map(), remoteImages);
            
            expect(finalHtml).toContain('width="64"');
            expect(finalHtml).toContain('height="32"');
            expect(finalHtml).toContain('alt="test"');
            expect(finalHtml).not.toContain('REMOTE_0');
        });
    });
});
