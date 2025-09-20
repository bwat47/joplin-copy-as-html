// Hoist Joplin API mock
jest.mock('api', () => ({
    __esModule: true,
    default: {
        data: { get: jest.fn() },
        settings: { value: jest.fn(), globalValue: jest.fn() },
    },
}));

import { collectImageUrls } from './tokenImageCollector';
import { createMarkdownItInstance } from './markdownSetup';
import { resetAllJoplinMocks, mockGlobalPlugins, genResourceId } from '../testHelpers';

beforeEach(() => {
    resetAllJoplinMocks();
    mockGlobalPlugins([]);
});

describe('tokenImageCollector', () => {
    it('collects URLs from markdown images', async () => {
        const md = await createMarkdownItInstance();
        const id = genResourceId();
        const markdown = `Image 1 ![a](https://example.com/a.png) and 2 ![b](:/${id})`;
        const urls = collectImageUrls(md, markdown);
        expect(urls.has('https://example.com/a.png')).toBe(true);
        expect(urls.has(`:/${id}`)).toBe(true);
    });

    it('ignores images inside code fences and inline code', async () => {
        const md = await createMarkdownItInstance();
        const id1 = genResourceId();
        const id2 = genResourceId();
        const markdown = [
            '![keep](https://host/keep.png)',
            `\`![ignore-inline](:/${id1})\``,
            '~~~',
            `![ignore-fenced](:/${id2})`,
            '<img src="https://host/ignore-raw-in-code.png">',
            '~~~',
        ].join('\n');
        const urls = collectImageUrls(md, markdown);
        expect(urls.has('https://host/keep.png')).toBe(true);
        expect(Array.from(urls).some((u) => u.includes('ignore'))).toBe(false);
    });

    it('picks up raw HTML <img> sources', async () => {
        const md = await createMarkdownItInstance();
        const markdown = 'Raw <img src="https://raw.example/img.jpg" alt="x"> here';
        const urls = collectImageUrls(md, markdown);
        expect(urls.has('https://raw.example/img.jpg')).toBe(true);
    });
});
