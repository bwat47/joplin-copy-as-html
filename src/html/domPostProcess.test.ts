import { postProcessHtml } from './domPostProcess';
import * as assetProcessor from './assetProcessor';

// Mock the assetProcessor module
jest.mock('./assetProcessor');

const mockConvertResource = assetProcessor.convertResourceToBase64 as jest.Mock;
const mockDownloadRemote = assetProcessor.downloadRemoteImageAsBase64 as jest.Mock;

describe('domPostProcess', () => {
    beforeEach(() => {
        jest.clearAllMocks();
        // Default mocks
        mockConvertResource.mockResolvedValue('data:image/png;base64,LOCAL');
        mockDownloadRemote.mockResolvedValue('data:image/png;base64,REMOTE');
    });

    it('embeds local Joplin resources when embedImages is true', async () => {
        const html = '<img data-resource-id="12345" src=":/12345" alt="local">';
        const out = await postProcessHtml(html, {
            embedImages: true,
            downloadRemoteImages: false,
            convertSvgToPng: false,
        });

        expect(mockConvertResource).toHaveBeenCalledWith('12345');
        expect(out).toContain('src="data:image/png;base64,LOCAL"');
    });

    it('embeds remote images when downloadRemoteImages is true', async () => {
        const html = '<img src="https://example.com/img.png" alt="remote">';
        const out = await postProcessHtml(html, {
            embedImages: true,
            downloadRemoteImages: true,
            convertSvgToPng: false,
        });

        expect(mockDownloadRemote).toHaveBeenCalledWith('https://example.com/img.png');
        expect(out).toContain('src="data:image/png;base64,REMOTE"');
    });

    it('does NOT embed remote images when downloadRemoteImages is false', async () => {
        const html = '<img src="https://example.com/img.png" alt="remote">';
        const out = await postProcessHtml(html, {
            embedImages: true,
            downloadRemoteImages: false,
            convertSvgToPng: false,
        });

        expect(mockDownloadRemote).not.toHaveBeenCalled();
        expect(out).toContain('src="https://example.com/img.png"');
    });

    it('replaces failed local images with error message', async () => {
        mockConvertResource.mockResolvedValue(null);
        const html = '<img data-resource-id="fail" src=":/fail">';

        const out = await postProcessHtml(html, {
            embedImages: true,
            downloadRemoteImages: false,
            convertSvgToPng: false,
        });

        expect(out).toContain('Image failed to load');
        expect(out).not.toContain('<img');
    });

    it('removes Joplin resources when embedImages is false', async () => {
        const html = '<img data-resource-id="123" src=":/123">';
        const out = await postProcessHtml(html, {
            embedImages: false,
            downloadRemoteImages: false,
            convertSvgToPng: false,
        });

        expect(out).not.toContain('<img');
        expect(out).not.toContain(':/123');
    });

    it('removes Joplin resources with data-resource-id even if src does not look like a joplin resource (embedImages=false)', async () => {
        // simulating renderMarkup output where src might be processed or missing, but data-resource-id is present
        const html = '<img data-resource-id="ab62d971ef62435ca8e3f9e709ce1255" alt="roadmap" class="jop-noMdConv">';
        const out = await postProcessHtml(html, {
            embedImages: false,
            downloadRemoteImages: false,
            convertSvgToPng: false,
        });

        expect(out).not.toContain('<img');
        expect(out).not.toContain('ab62d971ef62435ca8e3f9e709ce1255');
    });

    it('removes joplin-source elements (duplicate code block content)', async () => {
        const html = `
            <div class="joplin-source">raw code</div>
            <pre><code>highlighted code</code></pre>
        `;
        const out = await postProcessHtml(html);
        expect(out).not.toContain('joplin-source');
        expect(out).not.toContain('raw code');
        expect(out).toContain('highlighted code');
    });

    it('continues to clean Joplin resource anchors', async () => {
        const html = '<p><a href=":/0123456789abcdef0123456789abcdef">Resource</a></p>';
        const out = await postProcessHtml(html);
        // Anchor should be replaced by its text content
        expect(out).not.toContain('<a ');
        expect(out).toContain('Resource');
    });

    it('wraps top-level raw HTML images in separate paragraph blocks', async () => {
        const html = '<img src="https://x/a.png" alt="a">\n\n<img src="https://x/b.png" alt="b">';
        const out = await postProcessHtml(html, {
            embedImages: false,
            downloadRemoteImages: false,
            convertSvgToPng: false,
        });
        // Should wrap each top-level <img> in its own <p>
        expect(out).toMatch(/<p>\s*<img[^>]*src="https:\/\/x\/a\.png"[^>]*>\s*<\/p>/);
        expect(out).toMatch(/<p>\s*<img[^>]*src="https:\/\/x\/b\.png"[^>]*>\s*<\/p>/);
    });

    it('converts SVG image sources to PNG data URIs when enabled', async () => {
        const originalImage = (globalThis as { Image?: typeof Image }).Image;
        class FakeImage {
            public onload: ((this: GlobalEventHandlers, ev: Event) => unknown) | null = null;
            public onerror: ((this: GlobalEventHandlers, ev: Event) => unknown) | null = null;
            public naturalWidth = 24;
            public naturalHeight = 24;
            set src(value: string) {
                if (!value.startsWith('data:image/svg+xml')) {
                    if (this.onerror) {
                        this.onerror.call(this, new Event('error'));
                    }
                    return;
                }
                Promise.resolve().then(() => {
                    if (this.onload) {
                        this.onload.call(this, new Event('load'));
                    }
                });
            }
        }

        (globalThis as unknown as { Image: typeof Image }).Image = FakeImage as unknown as typeof Image;

        const originalCreateElement = document.createElement.bind(document);
        const createElementSpy = jest.spyOn(document, 'createElement').mockImplementation(function (
            this: Document,
            tagName: string,
            options?: ElementCreationOptions
        ) {
            const element = originalCreateElement(tagName, options) as HTMLElement;
            if (tagName.toLowerCase() === 'canvas') {
                const canvas = element as unknown as HTMLCanvasElement;
                (canvas as unknown as { getContext: () => unknown }).getContext = jest.fn().mockReturnValue({
                    clearRect: jest.fn(),
                    drawImage: jest.fn(),
                });
                (canvas as unknown as { toDataURL: () => string }).toDataURL = jest
                    .fn()
                    .mockReturnValue('data:image/png;base64,TESTPNG');
                return canvas as unknown as HTMLElement;
            }
            return element;
        });

        const svgMarkup = '<svg xmlns="http://www.w3.org/2000/svg" width="24" height="24"></svg>';
        const svgBase64 = Buffer.from(svgMarkup, 'utf8').toString('base64');
        const html = `<p><img src="data:image/svg+xml;base64,${svgBase64}" alt="icon"></p>`;

        try {
            const out = await postProcessHtml(html, {
                embedImages: true, // Needed to trigger processing loop
                downloadRemoteImages: false,
                convertSvgToPng: true,
            });
            expect(out).toContain('data:image/png;base64,TESTPNG');
            expect(out).not.toContain('image/svg+xml');
        } finally {
            createElementSpy.mockRestore();
            if (originalImage) {
                (globalThis as unknown as { Image: typeof Image }).Image = originalImage;
            } else {
                delete (globalThis as unknown as { Image?: typeof Image }).Image;
            }
        }
    });
});
