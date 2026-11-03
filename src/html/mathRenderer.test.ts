import { createRoot } from './domTestUtils';
import { renderMath } from './mathRenderer';

// Match renderMarkup output for KaTeX math, with the KaTeX HTML trimmed
const displayMath = (tex: string) =>
    `<div class="joplin-editable"><pre class="joplin-source" hidden data-joplin-language="katex" data-joplin-source-open="$$&#10;" data-joplin-source-close="&#10;$$&#10;">${tex}</pre><span class="katex-display"><span class="katex"><span class="katex-html" aria-hidden="true">rendered</span></span></span></div>`;
const inlineMath = (tex: string) =>
    `<p>Before <span class="joplin-editable"><span class="joplin-source" hidden data-joplin-language="katex" data-joplin-source-open="$" data-joplin-source-close="$">${tex}</span><span class="katex"><span class="katex-html" aria-hidden="true">rendered</span></span></span> after</p>`;

function render(html: string): string {
    const root = createRoot(html);
    renderMath(root);
    return root.innerHTML;
}

describe('renderMath', () => {
    it('replaces display math with a centered SVG image', () => {
        const out = render(displayMath('f(x) = \\int_{-\\infty}^\\infty x\\,dx'));

        expect(out).not.toContain('katex');
        expect(out).not.toContain('joplin-source');
        expect(out).toMatch(
            /^<p style="text-align: center;"><img src="data:image\/svg\+xml;charset=utf-8,[^"]+" alt="f\(x\) = \\int_\{-\\infty\}\^\\infty x\\,dx" width="[\d.]+" height="[\d.]+" style="vertical-align: -[\d.]+px;"><\/p>$/
        );
    });

    it('replaces inline math with an image in the surrounding text', () => {
        const out = render(inlineMath('x^2'));

        expect(out).toMatch(/^<p>Before <img src="data:image\/svg\+xml;[^"]+" alt="x\^2"[^>]*> after<\/p>$/);
    });

    it('renders tagged display math instead of falling back to source', () => {
        const tex = String.raw`E = mc^2 \tag{1}`;
        const out = render(displayMath(tex));
        const root = new DOMParser().parseFromString(out, 'text/html');
        const img = root.querySelector('p > img');

        expect(img?.getAttribute('alt')).toBe(tex);
        expect(img?.getAttribute('src')).toMatch(/^data:image\/svg\+xml;/);
        expect(root.querySelector('pre, code, .katex, .joplin-source')).toBeNull();
    });

    it.each([
        ['display', displayMath('\\notAMacro{x}'), '<pre><code>$$\n\\notAMacro{x}\n$$</code></pre>'],
        ['inline', inlineMath('x^{2'), '<p>Before <code>$x^{2$</code> after</p>'],
    ])('replaces %s math that cannot be rendered with its source', (_name, html, expected) => {
        expect(render(html)).toBe(expected);
    });
});
