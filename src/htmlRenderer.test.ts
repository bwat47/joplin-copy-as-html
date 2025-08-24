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

// Clear mocks before each test to ensure a clean slate
beforeEach(() => {
    (joplin.data.get as jest.Mock).mockClear();
    (joplin.settings.value as jest.Mock).mockClear();
    (joplin.settings.globalValue as jest.Mock).mockClear();
});

// Add this describe block to src/htmlRenderer.test.ts

describe('Image Dimension Handling', () => {
    it('should extract and apply width and height attributes', () => {
        const resourceId = 'a1b2c3d4e5f6a1b2c3d4e5f6a1b2c3d4';
        const markdown = `<img src=":/${resourceId}" width="100" height="200"/>`;
        const { processedMarkdown, dimensions } = extractImageDimensions(markdown, true);

        // Check that the markdown was correctly transformed
        expect(processedMarkdown).toContain(`!\[DIMENSION_0\](:/${resourceId})`);

        const renderedHtml = `<img src=":/${resourceId}" alt="DIMENSION_0">`;
        const finalHtml = applyPreservedDimensions(renderedHtml, dimensions);

        expect(finalHtml).toContain('width="100"');
        expect(finalHtml).toContain('height="200"');
        expect(finalHtml).not.toContain('alt="DIMENSION_0"'); // Ensure the placeholder is removed
    });

    it('should strip all image tags when embedImages is false', () => {
        const markdown = 'Here is an image: <img src=":/xyz..." width="100">';
        const { processedMarkdown, dimensions } = extractImageDimensions(markdown, false);

        expect(processedMarkdown).toBe('Here is an image: ');
        expect(dimensions.size).toBe(0);
    });
});

// Add this describe block to src/htmlRenderer.test.ts

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

// Add this describe block to the end of src/htmlRenderer.test.ts

describe('processHtmlConversion', () => {
    it('should process a simple markdown string without images', async () => {
        // Mock the settings the function will ask for
        (joplin.settings.value as jest.Mock).mockResolvedValue(false); // embedImages = false
        (joplin.settings.globalValue as jest.Mock).mockResolvedValue(false); // Mock any global markdown settings

        const markdown = '## Hello World';
        const result = await processHtmlConversion(markdown);

        // The result should be a clean HTML fragment
        expect(result.trim()).toBe('<h2>Hello World</h2>');
    });

    it('should embed an image when embedImages is true', async () => {
        const resourceId = 'a1b2c3d4e5f6a1b2c3d4e5f6a1b2c3d4';
        const markdown = `![my image](:/${resourceId})`;

        // Mock the settings
        (joplin.settings.value as jest.Mock)
            .mockResolvedValueOnce(true) // embedImages = true
            .mockResolvedValueOnce(false); // exportFullHtml = false
        (joplin.settings.globalValue as jest.Mock).mockResolvedValue(false);

        // Mock the data API calls for the image
        const mockResource = { id: resourceId, mime: 'image/jpeg' };
        const mockFile = { body: Buffer.from('fake-jpeg-data') };
        (joplin.data.get as jest.Mock).mockResolvedValueOnce(mockResource).mockResolvedValueOnce(mockFile);

        const result = await processHtmlConversion(markdown);

        expect(result).toContain('<img src="data:image/jpeg;base64,');
        expect(result).toContain('alt="my image"');
    });
});
