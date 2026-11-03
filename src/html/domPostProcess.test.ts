import type { Mock } from 'vitest';

import * as assetProcessor from './assetProcessor';
import { postProcessHtml, type PostProcessOptions } from './domPostProcess';

vi.mock('./assetProcessor');

const mockConvertResource = assetProcessor.convertResourceToBase64 as Mock;

const defaultOpts: PostProcessOptions = { embedImages: true, downloadRemoteImages: false, embedSvgAsPng: true };
const noSvgConversion: PostProcessOptions = { ...defaultOpts, embedSvgAsPng: false };

// Matches renderMarkup output for a mermaid code block, including the source kept for the Rich Text Editor
const mermaidHtml = (source: string) =>
    `<div class="joplin-editable"><pre class="joplin-source" data-joplin-language="mermaid">${source}</pre><pre class="mermaid">${source}</pre></div>`;

describe('domPostProcess', () => {
    beforeEach(() => {
        mockConvertResource.mockResolvedValue('data:image/png;base64,LOCAL');
    });

    it('sanitizes the input', async () => {
        const out = await postProcessHtml('<p onclick="alert(1)">Text</p><script>alert(1)</script>', defaultOpts);
        expect(out).toBe('<p>Text</p>');
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

    it('disables checkbox inputs (read-only)', async () => {
        const html = `
            <ul>
                <li><input type="checkbox" checked> Task 1</li>
                <li><input type="checkbox"> Task 2</li>
            </ul>`;
        const out = await postProcessHtml(html, defaultOpts);

        // Should have added disabled attribute
        expect(out).toMatch(/<input[^>]*type="checkbox"[^>]*disabled(="disabled")?[^>]*>/);
        // Count occurrences
        const disabledCount = (out.match(/disabled/g) || []).length;
        expect(disabledCount).toBeGreaterThanOrEqual(2);
    });

    it('wraps top-level raw HTML images in separate paragraph blocks', async () => {
        const html = '<img src="https://x/a.png" alt="a">\n\n<img src="https://x/b.png" alt="b">';
        const out = await postProcessHtml(html, { ...noSvgConversion, embedImages: false });
        // Should wrap each top-level <img> in its own <p>
        expect(out).toMatch(/<p>\s*<img[^>]*src="https:\/\/x\/a\.png"[^>]*>\s*<\/p>/);
        expect(out).toMatch(/<p>\s*<img[^>]*src="https:\/\/x\/b\.png"[^>]*>\s*<\/p>/);
    });

    describe('image options', () => {
        it('embeds Joplin resources when embedImages is true', async () => {
            const out = await postProcessHtml('<img data-resource-id="12345" src=":/12345">', noSvgConversion);

            expect(mockConvertResource).toHaveBeenCalledWith('12345');
            expect(out).toBe('<p><img data-resource-id="12345" src="data:image/png;base64,LOCAL"></p>');
        });

        it('removes Joplin resources when embedImages is false', async () => {
            const out = await postProcessHtml('<img data-resource-id="123" src=":/123">', {
                ...noSvgConversion,
                embedImages: false,
            });

            expect(mockConvertResource).not.toHaveBeenCalled();
            expect(out).toBe('');
        });

        it('leaves SVG images when embedSvgAsPng is false', async () => {
            const src = 'data:image/svg+xml;charset=utf-8,%3Csvg%3E%3C%2Fsvg%3E';
            const out = await postProcessHtml(`<p><img src="${src}"></p>`, noSvgConversion);

            expect(out).toBe(`<p><img src="${src}"></p>`);
        });
    });

    describe('rich content', () => {
        // Rich content is rendered to images that the later steps wrap at the top level
        it.each([
            [
                'math',
                '<div class="joplin-editable"><pre class="joplin-source" hidden>x^2</pre><span class="katex-display"><span class="katex">rendered</span></span></div>',
            ],
            [
                'ABC notation',
                '<div class="joplin-editable joplin-abc-notation"><pre class="joplin-source" hidden data-abc-options="{}">X:1\nK: G\nGABc|</pre><pre class="joplin-abc-notation-rendered">X:1\nK: G\nGABc|</pre></div>',
            ],
            ['Mermaid', mermaidHtml('graph TD;\n    A--&gt;B;')],
        ])('renders %s to a top-level SVG image', async (_name, html) => {
            const out = await postProcessHtml(html, noSvgConversion);

            expect(out).toMatch(/^<p[^>]*><img src="data:image\/svg\+xml;charset=utf-8,[^"]+"[^>]*><\/p>$/);
        });

        it('keeps a Mermaid diagram that fails to render as a code block without its source', async () => {
            const out = await postProcessHtml(mermaidHtml('notADiagram\n    A--&gt;B;'), noSvgConversion);

            expect(out).toBe(
                '<div class="joplin-editable"><pre class="mermaid">notADiagram\n    A--&gt;B;</pre></div>'
            );
        });
    });
});
