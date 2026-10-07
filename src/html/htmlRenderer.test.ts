import { processHtmlConversion } from './htmlRenderer';
import joplin from 'api';
import type { Mock } from 'vitest';
import type { HtmlOptions } from '../types';
import * as domPostProcess from './domPostProcess';
import * as assetProcessor from './assetProcessor';

vi.mock('./domPostProcess');
vi.mock('./assetProcessor');

const mockPostProcessHtml = domPostProcess.postProcessHtml as Mock;
const mockGetUserStylesheet = assetProcessor.getUserStylesheet as Mock;

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

    it('passes correct options to postProcessHtml', async () => {
        await processHtmlConversion('md', htmlOptions({ embedImages: true, embedSvgAsPng: false }));

        expect(mockPostProcessHtml).toHaveBeenCalledWith(expect.any(String), {
            embedImages: true,
            downloadRemoteImages: false,
            convertSvgToPng: false,
        });
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

    it('handles empty renderMarkup result', async () => {
        (joplin.commands.execute as Mock).mockResolvedValue(null);
        const result = await processHtmlConversion('md', htmlOptions());
        expect(result).toBe('');
    });
});
