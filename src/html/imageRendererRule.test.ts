// Hoist Joplin API mock
jest.mock('api', () => ({
    __esModule: true,
    default: {
        data: { get: jest.fn() },
        settings: { value: jest.fn(), globalValue: jest.fn() },
    },
}));

import { createMarkdownItInstance } from './markdownSetup';
import { installImageSwapRule } from './imageRendererRule';
import { resetAllJoplinMocks, mockGlobalPlugins, genResourceId } from '../testHelpers';
import type { HtmlOptions } from '../types';

beforeEach(() => {
    resetAllJoplinMocks();
    mockGlobalPlugins([]);
});

describe('imageRendererRule', () => {
    function baseOptions(p: Partial<HtmlOptions>): HtmlOptions {
        return {
            embedImages: true,
            exportFullHtml: false,
            downloadRemoteImages: false,
            ...p,
        };
    }

    it('swaps src when mapped to data URI', async () => {
        const md = await createMarkdownItInstance();
        const url = 'https://host/img.png';
        const map = new Map<string, string>([[url, 'data:image/png;base64,Zm9v']]);
        installImageSwapRule(md, map, baseOptions({}));

        const html = md.render(`![alt](${url})`);
        expect(html).toContain('src="data:image/png;base64,Zm9v"');
        expect(html).not.toContain(url);
    });

    it('returns error span when mapped to error HTML', async () => {
        const md = await createMarkdownItInstance();
        const url = 'https://host/missing.png';
        const error = '<span style="color:red">Remote image download failed</span>';
        const map = new Map<string, string>([[url, error]]);
        installImageSwapRule(md, map, baseOptions({}));

        const html = md.render(`![alt](${url})`);
        expect(html).toContain(error);
        expect(html).not.toContain('<img');
    });

    it('strips Joplin resource images when embedImages=false', async () => {
        const md = await createMarkdownItInstance();
        const id = genResourceId();
        const map = new Map<string, string>();
        installImageSwapRule(md, map, baseOptions({ embedImages: false }));

        const html = md.render(`![alt](:/${id})`);
        // Should not render an <img> tag nor the resource reference
        expect(html).not.toContain('<img');
        expect(html).not.toContain(`:/${id}`);
    });
});
