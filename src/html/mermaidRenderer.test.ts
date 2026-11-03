import { createRoot, decodeSvgImages } from '../testUtils/dom';
import { renderMermaidDiagrams } from './mermaidRenderer';

// Matches renderMarkup output for a mermaid code block
const mermaidHtml = (source: string) =>
    `<h2>Diagram</h2><div class="joplin-editable"><pre class="mermaid">${source}</pre></div>`;

function render(html: string): string {
    const root = createRoot(html);
    renderMermaidDiagrams(root);
    return root.innerHTML;
}

describe('renderMermaidDiagrams', () => {
    it('replaces the diagram block with an SVG image', () => {
        const out = render(mermaidHtml('graph TD;\n    A--&gt;B;\n    A--&gt;C;'));

        expect(out).toMatch(
            /^<h2>Diagram<\/h2><img src="data:image\/svg\+xml;charset=utf-8,[^"]+" alt="Mermaid diagram">$/
        );

        const [svg] = decodeSvgImages(out);
        expect(svg).toMatch(/^<svg[^>]*class="pele pele-flowchart"/);
        expect(svg).toContain('data-id="L_A_B_0"');
    });

    it('leaves the source as a code block when the diagram cannot be rendered', () => {
        const out = render(mermaidHtml('notADiagram\n    A--&gt;B;'));

        expect(out).toContain('<pre class="mermaid">notADiagram\n    A--&gt;B;</pre>');
        expect(out).not.toContain('<img');
    });
});
