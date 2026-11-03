import { renderTexToSvg } from './texRenderer';

describe('renderTexToSvg', () => {
    it('renders inline math as a standalone SVG sized in px', () => {
        const result = renderTexToSvg('x^2', false);

        expect(result.svg).toMatch(/^<svg[^>]*xmlns="http:\/\/www\.w3\.org\/2000\/svg"/);
        expect(result.svg).toContain(`width="${result.width}"`);
        expect(result.svg).toContain(`height="${result.height}"`);
        expect(result.svg).not.toContain('ex"');
        expect(result.svg).not.toContain('style=');
        expect(result.width).toBeGreaterThan(0);
        expect(result.height).toBeGreaterThan(0);
    });

    it('draws glyphs as paths without shared font definitions', () => {
        const { svg } = renderTexToSvg(String.raw`\int_{-\infty}^\infty \hat f(\xi)\,d\xi`, true);

        expect(svg).toContain('<path');
        expect(svg).not.toContain('<use');
        expect(svg).not.toContain('<text');
    });

    it('returns a baseline offset below zero for math with descenders', () => {
        expect(renderTexToSvg(String.raw`\int_0^1 f(x)\,dx`, true).verticalAlign).toBeLessThan(0);
    });

    it.each([
        ['mhchem', String.raw`\ce{H2O + CO2 -> H2CO3}`],
        ['ams environments', String.raw`\begin{pmatrix} a & b \\ c & d \end{pmatrix}`],
        ['color and cancel', String.raw`\textcolor{red}{y} + \cancel{x}`],
        ['blackboard and calligraphic letters', String.raw`\mathbb{R} \mathcal{L} \mathfrak{g}`],
    ])('renders %s', (_name, tex) => {
        expect(renderTexToSvg(tex, true).svg).toContain('<path');
    });

    it.each([
        ['undefined macros', String.raw`\notAMacro{x}`],
        ['syntax errors', 'x^{2'],
    ])('throws for %s', (_name, tex) => {
        expect(() => renderTexToSvg(tex, false)).toThrow();
    });
});
