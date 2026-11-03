import { sanitizeToRoot } from './sanitizer';

const sanitize = (html: string) => sanitizeToRoot(html)?.innerHTML ?? '';

describe('sanitizeToRoot', () => {
    it('strips tags and attributes outside the allowlist', () => {
        const html = `
            <p onclick="alert(1)">Text</p>
            <img src="x.png" onerror="alert(1)" onload="alert(1)">
            <script>alert(1)</script>
            <iframe src="https://example.com"></iframe>
            <object data="x"></object>
            <embed src="x">
            <form><p>Form content</p></form>
        `;
        const out = sanitize(html);
        expect(out).not.toMatch(/<(script|iframe|object|embed|form)\b/);
        expect(out).not.toMatch(/\bon(click|error|load)=/);
        expect(out).toContain('<p>Text</p>');
        expect(out).toContain('Form content');
    });

    it('keeps aria and role attributes', () => {
        const out = sanitize('<span role="note" aria-label="Label" aria-hidden="true">Text</span>');
        expect(out).toContain('role="note"');
        expect(out).toContain('aria-label="Label"');
        expect(out).toContain('aria-hidden="true"');
    });
});
