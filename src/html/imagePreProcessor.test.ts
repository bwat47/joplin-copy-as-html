// This mock will be hoisted to the top by Jest, applying to all tests in this file.
jest.mock('api', () => ({
    __esModule: true, // Helps Jest handle default exports correctly
    default: {
        data: { get: jest.fn() },
        settings: { value: jest.fn(), globalValue: jest.fn() },
    },
}));

import { preprocessImageResources } from './imagePreProcessor';
import { genResourceId, mockImageResource, resetAllJoplinMocks } from '../testHelpers';

beforeEach(() => {
    resetAllJoplinMocks();
});

describe('preprocessImageResources', () => {
    it('strips only Joplin resource images when embedImages=false', async () => {
        const id = genResourceId();
        const input = `Text <img src=":/${id}"> and ![alt](:/${id}) and <img src="https://e/x.jpg">`;
        const out = await preprocessImageResources(input, {
            embedImages: false,
            exportFullHtml: false,
            downloadRemoteImages: false,
        });
        expect(out).not.toContain(`:/${id}`);
        expect(out).toContain('<img src="https://e/x.jpg">');
    });

    it('embeds Joplin resource images and preserves alt (markdown)', async () => {
        const id = genResourceId();
        mockImageResource(id, 'image/png', 'fake-data');
        const input = `![my alt](:/${id})`;
        const out = await preprocessImageResources(input, {
            embedImages: true,
            exportFullHtml: false,
            downloadRemoteImages: false,
        });
        expect(out).toContain('![my alt](data:image/png;base64,');
    });

    it('embeds Joplin resource images in HTML <img> tags', async () => {
        const id = genResourceId();
        mockImageResource(id, 'image/jpeg', 'jpeg-bits');
        const input = `<img src=":/${id}" width="100" alt="x">`;
        const out = await preprocessImageResources(input, {
            embedImages: true,
            exportFullHtml: false,
            downloadRemoteImages: false,
        });
        expect(out).toMatch(/<img[^>]*src="data:image\/jpeg;base64,[^"]+"[^>]*>/);
        // attributes should remain present
        expect(out).toContain('width="100"');
        expect(out).toContain('alt="x"');
    });

    it('does not alter fenced code blocks', async () => {
        const id = genResourceId();
        const input = '```\n![x](:/' + id + ')\n<img src=":/' + id + '">\n```';
        const out = await preprocessImageResources(input, {
            embedImages: true,
            exportFullHtml: false,
            downloadRemoteImages: true,
        });
        expect(out).toContain(input);
    });
});

