import type { Mock } from 'vitest';

import * as assetProcessor from './assetProcessor';
import { postProcessHtml } from './domPostProcess';

// Mock the assetProcessor module
vi.mock('./assetProcessor');

const mockConvertResource = assetProcessor.convertResourceToBase64 as Mock;
const mockDownloadRemote = assetProcessor.downloadRemoteImageAsBase64 as Mock;

const defaultOpts = { embedImages: true, downloadRemoteImages: false, convertSvgToPng: true };

describe('domPostProcess', () => {
    beforeEach(() => {
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

    it('removes Joplin resources by data-resource-id when embedImages is false', async () => {
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

    it('strips tags and attributes outside the allowlist', async () => {
        const html = `
            <p onclick="alert(1)">Text</p>
            <img src="x.png" onerror="alert(1)" onload="alert(1)">
            <script>alert(1)</script>
            <iframe src="https://example.com"></iframe>
            <object data="x"></object>
            <embed src="x">
            <form><p>Form content</p></form>
        `;
        const out = await postProcessHtml(html, defaultOpts);
        expect(out).not.toMatch(/<(script|iframe|object|embed|form)\b/);
        expect(out).not.toMatch(/\bon(click|error|load)=/);
        expect(out).toContain('<p>Text</p>');
        expect(out).toContain('Form content');
    });

    it('keeps aria and role attributes', async () => {
        const html = '<span role="note" aria-label="Label" aria-hidden="true">Text</span>';
        const out = await postProcessHtml(html, defaultOpts);
        expect(out).toContain('role="note"');
        expect(out).toContain('aria-label="Label"');
        expect(out).toContain('aria-hidden="true"');
    });

    it('removes joplin-source elements (duplicate code block content)', async () => {
        const html = `
            <div class="joplin-source">raw code</div>
            <pre><code>highlighted code</code></pre>
        `;
        const out = await postProcessHtml(html, defaultOpts);
        expect(out).not.toContain('joplin-source');
        expect(out).not.toContain('raw code');
        expect(out).toContain('highlighted code');
    });

    it.each([
        ['body', '<body class="joplin-source"><p>Visible content</p></body>'],
        ['html', '<html class="joplin-source"><body><p>Visible content</p></body></html>'],
        ['head', '<head class="joplin-source"></head><p>Visible content</p>'],
    ])('ignores attributes the input sets on the document <%s> element', async (_tag, html) => {
        const out = await postProcessHtml(html, defaultOpts);
        expect(out).toBe('<p>Visible content</p>');
    });

    it('replaces Joplin broken resource spans with error message', async () => {
        const html = `
            <span class="not-loaded-resource" data-resource-id="c188011f98504be1b60bb72ccd7c2cea">
                <img src="data:image/png;base64," width="1700" height="1536">
            </span>`;

        const out = await postProcessHtml(html, defaultOpts);

        expect(out).toContain('Image failed to load');
        expect(out).not.toContain('<img');
        expect(out).not.toContain('not-loaded-resource');
    });

    it('continues to clean Joplin resource anchors', async () => {
        const html = '<p><a href=":/0123456789abcdef0123456789abcdef">Resource</a></p>';
        const out = await postProcessHtml(html, defaultOpts);
        // Anchor should be replaced by its text content
        expect(out).not.toContain('<a ');
        expect(out).toContain('Resource');
    });

    it.each([
        [
            'removes marker-only GitHub alert syntax from blockquotes',
            '<blockquote><p>[!note]<br>Test abc</p></blockquote>',
            '<blockquote><p>Test abc</p></blockquote>',
            '[!note]',
        ],
        [
            'keeps GitHub alert titles as blockquote content',
            '<blockquote><p>[!note] title<br>Test abc</p></blockquote>',
            '<blockquote><p>title<br>Test abc</p></blockquote>',
            '[!note]',
        ],
        [
            'removes extended GitHub alert types from blockquotes',
            '<blockquote><p>[!example] Extended title<br>Test abc</p></blockquote>',
            '<blockquote><p>Extended title<br>Test abc</p></blockquote>',
            '[!example]',
        ],
    ])('%s', async (_name, html, expectedHtml, removedMarker) => {
        const out = await postProcessHtml(html, defaultOpts);

        expect(out).toContain(expectedHtml);
        expect(out).not.toContain(removedMarker);
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
            public onload: ((this: FakeImage, ev: Event) => unknown) | null = null;
            public onerror: ((this: FakeImage, ev: Event) => unknown) | null = null;
            public naturalWidth = 24;
            public naturalHeight = 24;
            set src(value: string) {
                if (!value.startsWith('data:image/svg+xml')) {
                    if (this.onerror) {
                        this.onerror.call(this, new Event('error'));
                    }
                    return;
                }
                queueMicrotask(() => {
                    if (this.onload) {
                        this.onload.call(this, new Event('load'));
                    }
                });
            }
        }

        (globalThis as unknown as { Image: typeof Image }).Image = FakeImage as unknown as typeof Image;

        const originalCreateElement = document.createElement.bind(document);
        const createElementSpy = vi.spyOn(document, 'createElement').mockImplementation(function (
            this: Document,
            tagName: string,
            options?: ElementCreationOptions
        ) {
            const element = originalCreateElement(tagName, options);
            if (tagName.toLowerCase() === 'canvas') {
                const canvas = element as unknown as HTMLCanvasElement;
                (canvas as unknown as { getContext: () => unknown }).getContext = vi.fn().mockReturnValue({
                    drawImage: vi.fn(),
                });
                (canvas as unknown as { toDataURL: () => string }).toDataURL = vi
                    .fn()
                    .mockReturnValue('data:image/png;base64,TESTPNG');
                return canvas;
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

    describe('mermaid diagrams', () => {
        // Matches renderMarkup output for a mermaid code block
        const mermaidHtml = (source: string) =>
            `<h2>Diagram</h2><div class="joplin-editable"><pre class="mermaid">${source}</pre></div>`;
        const opts = { embedImages: true, downloadRemoteImages: false, convertSvgToPng: false };

        it('replaces the diagram block with a top-level SVG image', async () => {
            const out = await postProcessHtml(mermaidHtml('graph TD;\n    A--&gt;B;\n    A--&gt;C;'), opts);

            expect(out).not.toContain('class="mermaid"');
            expect(out).not.toContain('joplin-editable');
            expect(out).toMatch(/<p><img src="data:image\/svg\+xml;charset=utf-8,[^"]+" alt="Mermaid diagram"><\/p>/);

            const src = new DOMParser().parseFromString(out, 'text/html').querySelector('img')?.getAttribute('src');
            const svg = decodeURIComponent(src?.split(',')[1] ?? '');
            expect(svg).toMatch(/^<svg[^>]*class="pele pele-flowchart"/);
            expect(svg).toContain('data-id="L_A_B_0"');
        });

        it('leaves the source as a code block when the diagram cannot be rendered', async () => {
            const out = await postProcessHtml(mermaidHtml('notADiagram\n    A--&gt;B;'), opts);

            expect(out).toContain('<pre class="mermaid">notADiagram\n    A--&gt;B;</pre>');
            expect(out).not.toContain('<img');
        });
    });

    describe('math', () => {
        // Match renderMarkup output for KaTeX math, with the KaTeX HTML trimmed
        const displayMath = (tex: string) =>
            `<div class="joplin-editable"><pre class="joplin-source" hidden data-joplin-language="katex" data-joplin-source-open="$$&#10;" data-joplin-source-close="&#10;$$&#10;">${tex}</pre><span class="katex-display"><span class="katex"><span class="katex-html" aria-hidden="true">rendered</span></span></span></div>`;
        const inlineMath = (tex: string) =>
            `<p>Before <span class="joplin-editable"><span class="joplin-source" hidden data-joplin-language="katex" data-joplin-source-open="$" data-joplin-source-close="$">${tex}</span><span class="katex"><span class="katex-html" aria-hidden="true">rendered</span></span></span> after</p>`;
        const opts = { embedImages: true, downloadRemoteImages: false, convertSvgToPng: false };

        it('replaces display math with a centered SVG image', async () => {
            const out = await postProcessHtml(displayMath('f(x) = \\int_{-\\infty}^\\infty x\\,dx'), opts);

            expect(out).not.toContain('katex');
            expect(out).not.toContain('joplin-source');
            expect(out).toMatch(
                /^<p style="text-align: center;"><img src="data:image\/svg\+xml;charset=utf-8,[^"]+" alt="f\(x\) = \\int_\{-\\infty\}\^\\infty x\\,dx" width="[\d.]+" height="[\d.]+" style="vertical-align: -[\d.]+px;"><\/p>$/
            );
        });

        it('replaces inline math with an image in the surrounding text', async () => {
            const out = await postProcessHtml(inlineMath('x^2'), opts);

            expect(out).toMatch(/^<p>Before <img src="data:image\/svg\+xml;[^"]+" alt="x\^2"[^>]*> after<\/p>$/);
        });

        it('renders tagged display math instead of falling back to source', async () => {
            const tex = String.raw`E = mc^2 \tag{1}`;
            const out = await postProcessHtml(displayMath(tex), opts);
            const root = new DOMParser().parseFromString(out, 'text/html');
            const img = root.querySelector('p > img');

            expect(img?.getAttribute('alt')).toBe(tex);
            expect(img?.getAttribute('src')).toMatch(/^data:image\/svg\+xml;/);
            expect(root.querySelector('pre, code, .katex, .joplin-source')).toBeNull();
        });

        it.each([
            ['display', displayMath('\\notAMacro{x}'), '<pre><code>$$\n\\notAMacro{x}\n$$</code></pre>'],
            ['inline', inlineMath('x^{2'), '<p>Before <code>$x^{2$</code> after</p>'],
        ])('replaces %s math that cannot be rendered with its source', async (_name, html, expected) => {
            const out = await postProcessHtml(html, opts);

            expect(out).toBe(expected);
        });
    });

    it('disables checkbox inputs (read-only)', async () => {
        const html = `
            <ul>
                <li><input type="checkbox" checked> Task 1</li>
                <li><input type="checkbox"> Task 2</li>
            </ul>`;
        const out = await postProcessHtml(html, defaultOpts);

        // Should have added disabled attribute
        expect(out).toMatch(/<input[^>]*type="checkbox"[^>]*disabled(="disabled")?[^>]*>/);
        expect(out).toContain('disabled');
        // Count occurrences
        const disabledCount = (out.match(/disabled/g) || []).length;
        expect(disabledCount).toBeGreaterThanOrEqual(2);
    });
});
