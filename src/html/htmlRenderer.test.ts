import { processHtmlConversion } from './htmlRenderer';
import joplin from 'api';
import { mockHtmlSettings } from '../testHelpers';
import * as domPostProcess from './domPostProcess';
import * as assetProcessor from './assetProcessor';

jest.mock('./domPostProcess');
jest.mock('./assetProcessor');

const mockPostProcessHtml = domPostProcess.postProcessHtml as jest.Mock;
const mockGetUserStylesheet = assetProcessor.getUserStylesheet as jest.Mock;

describe('processHtmlConversion', () => {
    beforeEach(() => {
        jest.clearAllMocks();
        mockPostProcessHtml.mockImplementation((html) => Promise.resolve(html));
        mockGetUserStylesheet.mockResolvedValue('body { color: red; }');
        (joplin.commands.execute as jest.Mock).mockResolvedValue({ html: '<p>Mocked Render</p>' });
    });

    it('calls renderMarkup and returns processed HTML', async () => {
        mockHtmlSettings({ embedImages: false });
        const result = await processHtmlConversion('markdown');

        expect(joplin.commands.execute).toHaveBeenCalledWith('renderMarkup', 1, 'markdown');
        expect(mockPostProcessHtml).toHaveBeenCalledWith(
            '<p>Mocked Render</p>',
            expect.objectContaining({
                embedImages: false,
            })
        );
        expect(result).toBe('<p>Mocked Render</p>');
    });

    it('handles renderMarkup returning a string (fallback)', async () => {
        (joplin.commands.execute as jest.Mock).mockResolvedValue('<p>String Render</p>');
        mockHtmlSettings();

        const result = await processHtmlConversion('md');
        expect(result).toBe('<p>String Render</p>');
    });

    it('passes correct options to postProcessHtml', async () => {
        mockHtmlSettings({
            embedImages: true,
            embedSvgAsPng: false, // downloadRemoteImages is usually dependent on settings
        });
        // We aren't mocking downloadRemoteImages in settings helpers completely in this scope unless we check usage
        // But let's check what it passes

        await processHtmlConversion('md');

        expect(mockPostProcessHtml).toHaveBeenCalledWith(expect.any(String), {
            embedImages: true,
            downloadRemoteImages: false, // Default from mockHtmlSettings if not specified
            convertSvgToPng: false,
        });
    });

    it('wraps content in full HTML when exportFullHtml is true', async () => {
        mockHtmlSettings({ exportFullHtml: true });
        const result = await processHtmlConversion('md');

        expect(mockGetUserStylesheet).toHaveBeenCalled();
        expect(result).toContain('<!DOCTYPE html>');
        expect(result).toContain('body { color: red; }');
        expect(result).toContain('<p>Mocked Render</p>');
    });

    it('does not wrap content when exportFullHtml is false', async () => {
        mockHtmlSettings({ exportFullHtml: false });
        const result = await processHtmlConversion('md');

        expect(result).not.toContain('<!DOCTYPE html>');
        expect(result).toBe('<p>Mocked Render</p>');
    });

    it('handles empty renderMarkup result', async () => {
        (joplin.commands.execute as jest.Mock).mockResolvedValue(null);
        const result = await processHtmlConversion('md');
        expect(result).toBe('');
    });
});
