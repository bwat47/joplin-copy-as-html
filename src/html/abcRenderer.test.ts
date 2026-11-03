import { createRoot, decodeSvgImages } from '../testUtils/dom';
import { renderAbcNotation } from './abcRenderer';

// Matches renderMarkup output for an abc code block
const abcHtml = (source: string, options = '{}') =>
    `<h2>Tune</h2><div class="joplin-editable joplin-abc-notation"><pre class="joplin-source" hidden data-abc-options="${options}" data-joplin-language="abc">${source}</pre><pre class="joplin-rendered joplin-abc-notation-rendered">${source}</pre></div>`;
const tune = "X:1\nT: Cooley's\nM: 4/4\nL: 1/8\nK: G\n|:D2|EB{c}BA B2 EB|";

function render(html: string): string {
    const root = createRoot(html);
    renderAbcNotation(root);
    return root.innerHTML;
}

describe('renderAbcNotation', () => {
    it('replaces the tune block with an SVG image', () => {
        const out = render(abcHtml(tune));

        expect(out).not.toContain('joplin-abc-notation');
        expect(out).not.toContain('joplin-source');
        expect(out).toMatch(
            /^<h2>Tune<\/h2><img src="data:image\/svg\+xml;charset=utf-8,[^"]+" alt="Sheet Music for &quot;Cooley's&quot;">$/
        );

        const [svg] = decodeSvgImages(out);
        expect(svg).toMatch(
            /^<svg xmlns="http:\/\/www\.w3\.org\/2000\/svg"[^>]* width="\d+(\.\d+)?" height="\d+(\.\d+)?"/
        );
        expect(document.body.children).toHaveLength(0);
    });

    it('applies abcjs options but keeps a fixed size', () => {
        const out = render(abcHtml(tune, '{&quot;staffwidth&quot;:300,&quot;responsive&quot;:&quot;resize&quot;}'));

        const [svg] = decodeSvgImages(out);
        expect(svg).toMatch(/^<svg[^>]* width="330"/);
    });

    it('leaves the source as a code block when the options are invalid', () => {
        const out = render(abcHtml(tune, 'not json'));

        expect(out).toContain('<pre class="joplin-rendered joplin-abc-notation-rendered">X:1');
        expect(out).not.toContain('<img');
        expect(document.body.children).toHaveLength(0);
    });

    it('keeps the complete score when oneSvgPerLine is requested', () => {
        const source = `${tune}\nGABc d2 cB|`;
        const normal = decodeSvgImages(render(abcHtml(source)));
        const split = decodeSvgImages(render(abcHtml(source, '{&quot;oneSvgPerLine&quot;:true}')));

        expect(split).toHaveLength(1);
        expect(split).toEqual(normal);
        expect(document.body.children).toHaveLength(0);
    });

    it.each([
        ['smaller', tune, '{&quot;scale&quot;:0.5}', 0.5, 770],
        ['larger', tune, '{&quot;scale&quot;:2}', 2, 770],
        ['custom width', tune, '{&quot;scale&quot;:0.5,&quot;staffwidth&quot;:300}', 0.5, 330],
        ['ABC scale directive', tune.replace('K: G', '%%scale 0.5\nK: G'), '{}', 0.5, 770],
    ])(
        'exports %s scores with scaled dimensions and an untransformed viewport',
        (_name, source, options, scale, expectedWidth) => {
            const [markup] = decodeSvgImages(render(abcHtml(source, options)));
            const svg = new DOMParser().parseFromString(markup ?? '', 'image/svg+xml').documentElement;
            const width = Number(svg.getAttribute('width'));
            const height = Number(svg.getAttribute('height'));
            const viewBox = svg.getAttribute('viewBox')?.split(' ').map(Number);

            expect(width).toBeCloseTo(expectedWidth);
            expect(height).toBeGreaterThan(0);
            expect(viewBox?.[2]).toBeCloseTo(width / scale);
            expect(viewBox?.[3]).toBeCloseTo(height / scale);
            expect(svg.getAttribute('style')).not.toMatch(/(?:^|;)\s*(?:-webkit-|-ms-)?transform:/);
            expect(svg.querySelectorAll('path').length).toBeGreaterThan(0);
            expect(document.body.children).toHaveLength(0);
        }
    );
});
