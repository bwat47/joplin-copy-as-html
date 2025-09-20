import * as fs from 'fs';
import * as path from 'path';
import { renderPlainTextWithBlocks } from './plainTextRenderer';
import { createMarkdownItInstance } from './markdownSetup';
import { renderPlainText } from './tokenRenderers';
import type { PlainTextOptions } from '../types';

describe('PlainTextRenderer (blocks pipeline)', () => {
    const baseOptions: PlainTextOptions = {
        preserveSuperscript: false,
        preserveSubscript: false,
        preserveEmphasis: false,
        preserveBold: false,
        preserveHeading: false,
        preserveStrikethrough: false,
        preserveHorizontalRule: false,
        preserveMark: false,
        preserveInsert: false,
        displayEmojis: true,
        hyperlinkBehavior: 'title',
        indentType: 'spaces',
    };

    it('matches legacy renderer output for headings and paragraphs', () => {
        const markdown = `# Heading text\n\nFirst paragraph line one.\nSecond line.\n\nAnother paragraph.`;
        const md = createMarkdownItInstance();
        const tokens = md.parse(markdown, {});

        const legacy = renderPlainText(tokens, null, 0, baseOptions).trimEnd();
        const nextGen = renderPlainTextWithBlocks(markdown, baseOptions);

        expect(nextGen.trimEnd()).toBe(legacy);
    });

    it('respects heading preservation option', () => {
        const markdown = `### Preserved heading\n\nParagraph under heading.`;
        const options: PlainTextOptions = { ...baseOptions, preserveHeading: true };
        const md = createMarkdownItInstance();
        const tokens = md.parse(markdown, {});

        const legacy = renderPlainText(tokens, null, 0, options).trimEnd();
        const nextGen = renderPlainTextWithBlocks(markdown, options);

        expect(nextGen.trimEnd()).toBe(legacy);
    });

    it('matches legacy renderer output for unordered lists', () => {
        const markdown = `- Item one\n- Item two\n\nParagraph after list.`;
        const md = createMarkdownItInstance();
        const tokens = md.parse(markdown, {});

        const legacy = renderPlainText(tokens, null, 0, baseOptions).trimEnd();
        const nextGen = renderPlainTextWithBlocks(markdown, baseOptions);

        expect(nextGen.trimEnd()).toBe(legacy);
    });

    it('matches legacy renderer output for tables', () => {
        const markdown = `| A | B |\n|---|---|\n| 1 | 2 |`;
        const md = createMarkdownItInstance();
        const tokens = md.parse(markdown, {});

        const legacy = renderPlainText(tokens, null, 0, baseOptions).trimEnd();
        const nextGen = renderPlainTextWithBlocks(markdown, baseOptions);

        expect(nextGen.trimEnd()).toBe(legacy);
    });

    it('matches legacy renderer for nested lists', () => {
        const markdown = `- Item one\n  - Nested A\n  - Nested B\n- Item two`;
        const md = createMarkdownItInstance();
        const tokens = md.parse(markdown, {});

        const legacy = renderPlainText(tokens, null, 0, baseOptions).trimEnd();
        const nextGen = renderPlainTextWithBlocks(markdown, baseOptions);

        expect(nextGen.trimEnd()).toBe(legacy);
    });

    it('matches legacy renderer for tables inside list items', () => {
        const markdown = `- List intro:\n\n  | Col 1 | Col 2 |\n  |-------|-------|\n  | A     | B     |\n\n- Conclusion item`;
        const md = createMarkdownItInstance();
        const tokens = md.parse(markdown, {});

        const legacy = renderPlainText(tokens, null, 0, baseOptions).trimEnd();
        const nextGen = renderPlainTextWithBlocks(markdown, baseOptions);

        expect(nextGen.trimEnd()).toBe(legacy);
    });

    it('matches legacy renderer for sequential ordered and bullet lists', () => {
        const markdown = `1. ABC\n2. DEF\n3. CCC\n\n- CCC\n- DDD\n- EEE`;
        const md = createMarkdownItInstance();
        const tokens = md.parse(markdown, {});

        const legacy = renderPlainText(tokens, null, 0, baseOptions).trimEnd();
        const nextGen = renderPlainTextWithBlocks(markdown, baseOptions);
        expect(nextGen.trimEnd()).toBe(legacy);
    });

    it('matches legacy renderer for blockquotes', () => {
        const markdown = `> Quoted text\n\n> continues here.`;
        const md = createMarkdownItInstance();
        const tokens = md.parse(markdown, {});

        const legacy = renderPlainText(tokens, null, 0, baseOptions).trimEnd();
        const nextGen = renderPlainTextWithBlocks(markdown, baseOptions);
        expect(nextGen).toBe(legacy);
    });

    it('matches legacy renderer for fenced code blocks', () => {
        const markdown = '```js\nconst x = 1;\nconsole.log(x);\n```';
        const md = createMarkdownItInstance();
        const tokens = md.parse(markdown, {});

        const legacy = renderPlainText(tokens, null, 0, baseOptions).trimEnd();
        const nextGen = renderPlainTextWithBlocks(markdown, baseOptions);

        expect(nextGen).toBe(legacy);
    });

    it('matches legacy renderer for hyperlink behavior "url"', () => {
        const markdown = '[Joplin](https://joplinapp.org)';
        const options: PlainTextOptions = { ...baseOptions, hyperlinkBehavior: 'url' };
        const md = createMarkdownItInstance();
        const tokens = md.parse(markdown, {});

        const legacy = renderPlainText(tokens, null, 0, options).trimEnd();
        const nextGen = renderPlainTextWithBlocks(markdown, options);

        expect(nextGen).toBe(legacy);
    });

    it('matches legacy renderer for preserved emphasis and bold', () => {
        const markdown = '*italic* and **bold**';
        const options: PlainTextOptions = { ...baseOptions, preserveEmphasis: true, preserveBold: true };
        const md = createMarkdownItInstance();
        const tokens = md.parse(markdown, {});

        const legacy = renderPlainText(tokens, null, 0, options).trimEnd();
        const nextGen = renderPlainTextWithBlocks(markdown, options);

        expect(nextGen).toBe(legacy);
    });

    it('matches legacy renderer for footnote references and definitions', () => {
        const markdown = `Reference [^note]\n\n[^note]: definition text`;
        const md = createMarkdownItInstance();
        const tokens = md.parse(markdown, {});

        const legacy = renderPlainText(tokens, null, 0, baseOptions).trimEnd();
        const nextGen = renderPlainTextWithBlocks(markdown, baseOptions);

        expect(nextGen).toBe(legacy);
    });

    it('matches legacy renderer for the repository README document', () => {
        const markdown = fs.readFileSync(path.resolve(__dirname, '../../README.md'), 'utf8');
        const md = createMarkdownItInstance();
        const tokens = md.parse(markdown, {});

        const legacy = renderPlainText(tokens, null, 0, baseOptions);
        const nextGen = renderPlainTextWithBlocks(markdown, baseOptions);

        expect(nextGen.trimEnd()).toBe(legacy.trimEnd());
    });
});
