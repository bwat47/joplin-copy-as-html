import type { Mock } from 'vitest';

import joplin from 'api';
import type { HtmlOptions } from '../types';
import * as domPostProcess from './domPostProcess';
import { processHtmlConversion } from './htmlRenderer';
import * as stylesheet from './stylesheet';

vi.mock('./domPostProcess');
vi.mock('./stylesheet');

const mockPostProcessHtml = domPostProcess.postProcessHtml as Mock;
const mockGetUserStylesheet = stylesheet.getUserStylesheet as Mock;

function htmlOptions(overrides: Partial<HtmlOptions> = {}): HtmlOptions {
    return {
        embedImages: false,
        exportFullHtml: false,
        downloadRemoteImages: false,
        embedSvgAsPng: true,
        ...overrides,
    };
}

describe('processHtmlConversion', () => {
    beforeEach(() => {
        mockPostProcessHtml.mockImplementation((html) => Promise.resolve(html));
        mockGetUserStylesheet.mockResolvedValue('body { color: red; }');
        (joplin.commands.execute as Mock).mockResolvedValue({ html: '<p>Mocked Render</p>' });
    });

    it('calls renderMarkup and returns processed HTML', async () => {
        const result = await processHtmlConversion('markdown', htmlOptions());

        expect(joplin.commands.execute).toHaveBeenCalledWith('renderMarkup', 1, 'markdown', null, { bodyOnly: true });
        expect(mockPostProcessHtml).toHaveBeenCalledWith(
            '<p>Mocked Render</p>',
            expect.objectContaining({
                embedImages: false,
            })
        );
        expect(result).toBe('<p>Mocked Render</p>');
    });

    it('passes the HTML options through to postProcessHtml', async () => {
        const options = htmlOptions({ embedImages: true, embedSvgAsPng: false });
        await processHtmlConversion('md', options);

        expect(mockPostProcessHtml).toHaveBeenCalledWith(expect.any(String), options);
    });

    it('wraps content in full HTML when exportFullHtml is true', async () => {
        const result = await processHtmlConversion('md', htmlOptions({ exportFullHtml: true }));

        expect(mockGetUserStylesheet).toHaveBeenCalled();
        expect(result).toContain('<!DOCTYPE html>');
        expect(result).toContain('body { color: red; }');
        expect(result).toContain('<p>Mocked Render</p>');
    });

    it('does not wrap content when exportFullHtml is false', async () => {
        const result = await processHtmlConversion('md', htmlOptions());

        expect(result).not.toContain('<!DOCTYPE html>');
        expect(result).toBe('<p>Mocked Render</p>');
    });

    it.each([null, undefined, {}, { html: null }, { html: 42 }, 'invalid'])(
        'handles invalid renderMarkup result: %s',
        async (rendered) => {
            (joplin.commands.execute as Mock).mockResolvedValue(rendered);
            const result = await processHtmlConversion('md', htmlOptions());
            expect(result).toBe('');
        }
    );
});
