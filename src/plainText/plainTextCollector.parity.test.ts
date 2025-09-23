import MarkdownIt from 'markdown-it';
import { convertMarkdownToPlainText } from '../plainTextRenderer';
import { collectPlainTextBlocks } from './plainTextCollector';
import { PlainTextBlockFormatter } from './plainTextFormatter';
import type { PlainTextOptions } from '../types';

describe('plainTextCollector parity', () => {
    const md = new MarkdownIt({ html: false, breaks: true });
    const options = {} as unknown as PlainTextOptions; // rely on defaults/undefined = false

    const cases: Array<{ name: string; md: string }> = [
        { name: 'paragraphs', md: 'Hello\n\nWorld' },
        { name: 'heading + text', md: '# Title\nBody line' },
        { name: 'blockquote', md: '> Quote line\n>\n> Second' },
        { name: 'bullet list', md: '- a\n- b\n  - c' },
        { name: 'ordered list start', md: '3. a\n4. b' },
        { name: 'code fence', md: '```\ncode\n```' },
        { name: 'links', md: '[text](https://example.com "ex") and <https://example.com>' },
        { name: 'emphasis', md: '*em* **strong** ~~del~~' },
        { name: 'hr', md: 'above\n\n---\n\nbelow' },
    ];

    test.each(cases)('collector matches renderer for $name', ({ md: markdown }) => {
        const currentOutput = convertMarkdownToPlainText(markdown, options);

        const blocks = collectPlainTextBlocks(md, markdown, options);
        const formatted = new PlainTextBlockFormatter(options).format(blocks);

        expect(formatted).toEqual(currentOutput);
    });
});
