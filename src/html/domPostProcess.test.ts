import { postProcessHtml } from './domPostProcess';

describe('domPostProcess', () => {
    it('rewrites raw HTML <img> src from map', async () => {
        const html = '<p>before <img src="https://x/a.png" alt="a"> after</p>';
        const map = new Map<string, string | null>([['https://x/a.png', 'data:image/png;base64,QUJD']]);
        const out = await postProcessHtml(html, { imageSrcMap: map });
        expect(out).toContain('src="data:image/png;base64,QUJD"');
        expect(out).not.toContain('https://x/a.png');
    });

    it('replaces raw HTML <img> with fallback message when mapping fails', async () => {
        const html = '<p>before <img src="https://x/b.png" alt="b"> after</p>';
        const map = new Map<string, string | null>([['https://x/b.png', '<span>ignored</span>']]);
        const out = await postProcessHtml(html, { imageSrcMap: map });
        expect(out).toContain('Image failed to load');
        expect(out).not.toContain('<img');
        expect(out).not.toContain('https://x/b.png');
    });

    it('replaces raw HTML <img> with fallback when mapping resolves to null', async () => {
        const html = '<p>before <img src="https://x/s.png" alt="s"> after</p>';
        const map = new Map<string, string | null>([['https://x/s.png', null]]);
        const out = await postProcessHtml(html, { imageSrcMap: map });
        expect(out).toContain('Image failed to load');
        expect(out).not.toContain('<img');
        expect(out).not.toContain('https://x/s.png');
    });

    it('does not touch images inside pre/code', async () => {
        const html = '<pre><code>&lt;img src="https://x/c.png"&gt;</code></pre>';
        const map = new Map<string, string>([['https://x/c.png', 'data:image/png;base64,Zm9v']]);
        const out = await postProcessHtml(html, { imageSrcMap: map });
        // The raw <img> is inside code, so remains as text; ensure original URL still present
        expect(out).toContain('https://x/c.png');
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
        const out = await postProcessHtml(html);
        // Should wrap each top-level <img> in its own <p>
        expect(out).toMatch(/<p>\s*<img[^>]*src="https:\/\/x\/a\.png"[^>]*>\s*<\/p>/);
        expect(out).toMatch(/<p>\s*<img[^>]*src="https:\/\/x\/b\.png"[^>]*>\s*<\/p>/);
        // Should not insert <br> between them since each is in its own paragraph
        expect(out).not.toMatch(/<br\s*\/>|<br>/i);
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
            const out = await postProcessHtml(html, { convertSvgToPng: true });
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
