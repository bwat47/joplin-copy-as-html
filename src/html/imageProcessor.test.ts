import type { Mock } from 'vitest';

import { createRoot } from '../testUtils/dom';
import * as assetProcessor from './assetProcessor';
import {
    convertSvgImagesToPng,
    embedImagesInDom,
    replaceBrokenResourceSpans,
    stripJoplinImages,
} from './imageProcessor';

vi.mock('./assetProcessor');

const mockConvertResource = assetProcessor.convertResourceToBase64 as Mock;
const mockDownloadRemote = assetProcessor.downloadRemoteImageAsBase64 as Mock;

describe('imageProcessor', () => {
    beforeEach(() => {
        mockConvertResource.mockResolvedValue('data:image/png;base64,LOCAL');
        mockDownloadRemote.mockResolvedValue('data:image/png;base64,REMOTE');
    });

    describe('embedImagesInDom', () => {
        async function embed(html: string, downloadRemoteImages: boolean): Promise<string> {
            const root = createRoot(html);
            await embedImagesInDom(root, downloadRemoteImages);
            return root.innerHTML;
        }

        it('embeds local Joplin resources', async () => {
            const out = await embed('<img data-resource-id="12345" src=":/12345" alt="local">', false);

            expect(mockConvertResource).toHaveBeenCalledWith('12345');
            expect(out).toContain('src="data:image/png;base64,LOCAL"');
        });

        it('embeds remote images when downloadRemoteImages is true', async () => {
            const out = await embed('<img src="https://example.com/img.png" alt="remote">', true);

            expect(mockDownloadRemote).toHaveBeenCalledWith('https://example.com/img.png');
            expect(out).toContain('src="data:image/png;base64,REMOTE"');
        });

        it('does NOT embed remote images when downloadRemoteImages is false', async () => {
            const out = await embed('<img src="https://example.com/img.png" alt="remote">', false);

            expect(mockDownloadRemote).not.toHaveBeenCalled();
            expect(out).toContain('src="https://example.com/img.png"');
        });

        it('replaces failed local images with error message', async () => {
            mockConvertResource.mockResolvedValue(null);
            const out = await embed('<img data-resource-id="fail" src=":/fail">', false);

            expect(out).toContain('Image failed to load');
            expect(out).not.toContain('<img');
        });
    });

    describe('stripJoplinImages', () => {
        it.each([
            ['src', '<img data-resource-id="123" src=":/123">', ':/123'],
            // renderMarkup output where src might be processed or missing, but data-resource-id is present
            [
                'data-resource-id',
                '<img data-resource-id="ab62d971ef62435ca8e3f9e709ce1255" alt="roadmap" class="jop-noMdConv">',
                'ab62d971ef62435ca8e3f9e709ce1255',
            ],
        ])('removes Joplin resources by %s', (_name, html, removed) => {
            const root = createRoot(html);
            stripJoplinImages(root);

            expect(root.innerHTML).not.toContain('<img');
            expect(root.innerHTML).not.toContain(removed);
        });
    });

    it('replaces Joplin broken resource spans with error message', () => {
        const root = createRoot(`
            <span class="not-loaded-resource" data-resource-id="c188011f98504be1b60bb72ccd7c2cea">
                <img src="data:image/png;base64," width="1700" height="1536">
            </span>`);
        replaceBrokenResourceSpans(root);

        expect(root.innerHTML).toContain('Image failed to load');
        expect(root.innerHTML).not.toContain('<img');
        expect(root.innerHTML).not.toContain('not-loaded-resource');
    });

    it('converts SVG image sources to PNG data URIs', async () => {
        const originalImage = (globalThis as { Image?: typeof Image }).Image;
        class FakeImage {
            public onload: ((this: FakeImage, ev: Event) => unknown) | null = null;
            public onerror: ((this: FakeImage, ev: Event) => unknown) | null = null;
            public naturalWidth = 24;
            public naturalHeight = 24;
            set src(value: string) {
                if (!value.startsWith('data:image/svg+xml')) {
                    if (this.onerror) {
                        this.onerror.call(this, new Event('error'));
                    }
                    return;
                }
                queueMicrotask(() => {
                    if (this.onload) {
                        this.onload.call(this, new Event('load'));
                    }
                });
            }
        }

        (globalThis as unknown as { Image: typeof Image }).Image = FakeImage as unknown as typeof Image;

        const originalCreateElement = document.createElement.bind(document);
        const createElementSpy = vi.spyOn(document, 'createElement').mockImplementation(function (
            this: Document,
            tagName: string,
            options?: ElementCreationOptions
        ) {
            const element = originalCreateElement(tagName, options);
            if (tagName.toLowerCase() === 'canvas') {
                const canvas = element as unknown as HTMLCanvasElement;
                (canvas as unknown as { getContext: () => unknown }).getContext = vi.fn().mockReturnValue({
                    drawImage: vi.fn(),
                });
                (canvas as unknown as { toDataURL: () => string }).toDataURL = vi
                    .fn()
                    .mockReturnValue('data:image/png;base64,TESTPNG');
                return canvas;
            }
            return element;
        });

        const svgMarkup = '<svg xmlns="http://www.w3.org/2000/svg" width="24" height="24"></svg>';
        const svgBase64 = Buffer.from(svgMarkup, 'utf8').toString('base64');
        const root = createRoot(`<p><img src="data:image/svg+xml;base64,${svgBase64}" alt="icon"></p>`);

        try {
            await convertSvgImagesToPng(root);
            expect(root.innerHTML).toContain('data:image/png;base64,TESTPNG');
            expect(root.innerHTML).not.toContain('image/svg+xml');
        } finally {
            createElementSpy.mockRestore();
            if (originalImage) {
                (globalThis as unknown as { Image: typeof Image }).Image = originalImage;
            } else {
                delete (globalThis as unknown as { Image?: typeof Image }).Image;
            }
        }
    });
});
