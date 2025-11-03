import { postProcessHtml } from './domPostProcess';

describe('domPostProcess', () => {
    it('rewrites raw HTML <img> src from map', () => {
        const html = '<p>before <img src="https://x/a.png" alt="a"> after</p>';
        const map = new Map<string, string | null>([['https://x/a.png', 'data:image/png;base64,QUJD']]);
        const out = postProcessHtml(html, { imageSrcMap: map });
        expect(out).toContain('src="data:image/png;base64,QUJD"');
        expect(out).not.toContain('https://x/a.png');
    });

    it('replaces raw HTML <img> with fallback message when mapping fails', () => {
        const html = '<p>before <img src="https://x/b.png" alt="b"> after</p>';
        const map = new Map<string, string | null>([['https://x/b.png', '<span>ignored</span>']]);
        const out = postProcessHtml(html, { imageSrcMap: map });
        expect(out).toContain('Image failed to load');
        expect(out).not.toContain('<img');
        expect(out).not.toContain('https://x/b.png');
    });

    it('replaces raw HTML <img> with fallback when mapping resolves to null', () => {
        const html = '<p>before <img src="https://x/s.png" alt="s"> after</p>';
        const map = new Map<string, string | null>([['https://x/s.png', null]]);
        const out = postProcessHtml(html, { imageSrcMap: map });
        expect(out).toContain('Image failed to load');
        expect(out).not.toContain('<img');
        expect(out).not.toContain('https://x/s.png');
    });

    it('does not touch images inside pre/code', () => {
        const html = '<pre><code>&lt;img src="https://x/c.png"&gt;</code></pre>';
        const map = new Map<string, string>([['https://x/c.png', 'data:image/png;base64,Zm9v']]);
        const out = postProcessHtml(html, { imageSrcMap: map });
        // The raw <img> is inside code, so remains as text; ensure original URL still present
        expect(out).toContain('https://x/c.png');
    });

    it('continues to clean Joplin resource anchors', () => {
        const html = '<p><a href=":/0123456789abcdef0123456789abcdef">Resource</a></p>';
        const out = postProcessHtml(html);
        // Anchor should be replaced by its text content
        expect(out).not.toContain('<a ');
        expect(out).toContain('Resource');
    });

    it('wraps top-level raw HTML images in separate paragraph blocks', () => {
        const html = '<img src="https://x/a.png" alt="a">\n\n<img src="https://x/b.png" alt="b">';
        const out = postProcessHtml(html);
        // Should wrap each top-level <img> in its own <p>
        expect(out).toMatch(/<p>\s*<img[^>]*src="https:\/\/x\/a\.png"[^>]*>\s*<\/p>/);
        expect(out).toMatch(/<p>\s*<img[^>]*src="https:\/\/x\/b\.png"[^>]*>\s*<\/p>/);
        // Should not insert <br> between them since each is in its own paragraph
        expect(out).not.toMatch(/<br\s*\/>|<br>/i);
    });
});
