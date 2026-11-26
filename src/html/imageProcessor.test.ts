import type { Mock } from 'vitest';

import { createRoot } from '../testUtils/dom';
import type { PngScale } from '../types';
import * as assetProcessor from './assetProcessor';
import {
    convertSvgImagesToPng,
    embedImagesInDom,
    fitPngScale,
    replaceBrokenResourceSpans,
    stripJoplinImages,
} from './imageProcessor';

vi.mock('./assetProcessor');

const mockConvertResource = assetProcessor.convertResourceToBase64 as Mock;
const mockDownloadRemote = assetProcessor.downloadRemoteImageAsBase64 as Mock;

async function embed(html: string, downloadRemoteImages: boolean): Promise<string> {
    const root = createRoot(html);
    await embedImagesInDom(root, downloadRemoteImages);
    return root.innerHTML;
}

describe('imageProcessor', () => {
    beforeEach(() => {
        mockConvertResource.mockResolvedValue('data:image/png;base64,LOCAL');
        mockDownloadRemote.mockResolvedValue('data:image/png;base64,REMOTE');
    });

    describe('embedImagesInDom', () => {
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

    describe('fitPngScale', () => {
        it('keeps the requested scale for ordinary images', () => {
            expect(fitPngScale(800, 600, 4)).toBe(4);
        });

        it('lowers the scale to stay within the side limit', () => {
            expect(fitPngScale(8192, 100, 4)).toBe(2);
            expect(fitPngScale(100, 8192, 4)).toBe(2);
        });

        it('lowers the scale to stay within the pixel-area limit', () => {
            const scale = fitPngScale(4096, 4096, 4);
            expect(scale).toBe(2);
            expect(4096 * scale * 4096 * scale).toBeLessThanOrEqual(8192 * 8192);
        });

        it('returns requested scale when dimensions are non-positive', () => {
            expect(fitPngScale(0, 100, 3)).toBe(3);
            expect(fitPngScale(100, 0, 3)).toBe(3);
        });
    });

    describe('convertSvgImagesToPng', () => {
        interface CanvasMockOptions {
            naturalWidth?: number;
            naturalHeight?: number;
            failImageLoad?: boolean;
            contextAvailable?: boolean;
            toDataUrlResult?: string | (() => string);
        }

        function mockRasterEnvironment(opts: CanvasMockOptions = {}) {
            const {
                naturalWidth = 24,
                naturalHeight = 24,
                failImageLoad = false,
                contextAvailable = true,
                toDataUrlResult = 'data:image/png;base64,TESTPNG',
            } = opts;

            const originalImage = (globalThis as { Image?: typeof Image }).Image;
            class FakeImage extends EventTarget {
                public naturalWidth = naturalWidth;
                public naturalHeight = naturalHeight;
                set src(value: string) {
                    if (failImageLoad || !value.startsWith('data:image/svg+xml')) {
                        queueMicrotask(() => {
                            this.dispatchEvent(new Event('error'));
                        });
                        return;
                    }
                    queueMicrotask(() => {
                        this.dispatchEvent(new Event('load'));
                    });
                }
            }

            (globalThis as unknown as { Image: typeof Image }).Image = FakeImage as unknown as typeof Image;

            const canvases: HTMLCanvasElement[] = [];
            const drawImage = vi.fn();
            const toDataURL = vi.fn().mockImplementation(() => {
                return typeof toDataUrlResult === 'function' ? toDataUrlResult() : toDataUrlResult;
            });

            const originalCreateElement = document.createElement.bind(document);
            const createElementSpy = vi.spyOn(document, 'createElement').mockImplementation(function (
                this: Document,
                tagName: string,
                options?: ElementCreationOptions
            ) {
                const element = originalCreateElement(tagName, options);
                if (tagName.toLowerCase() === 'canvas') {
                    const canvas = element as unknown as HTMLCanvasElement;
                    (canvas as unknown as { getContext: () => unknown }).getContext = vi
                        .fn()
                        .mockReturnValue(contextAvailable ? { drawImage } : null);
                    (canvas as unknown as { toDataURL: () => string }).toDataURL = toDataURL;
                    canvases.push(canvas);
                    return canvas;
                }
                return element;
            });

            return {
                canvases,
                drawImage,
                toDataURL,
                restore() {
                    createElementSpy.mockRestore();
                    if (originalImage) {
                        (globalThis as unknown as { Image: typeof Image }).Image = originalImage;
                    } else {
                        delete (globalThis as unknown as { Image?: typeof Image }).Image;
                    }
                },
            };
        }

        const svgMarkup = '<svg xmlns="http://www.w3.org/2000/svg" width="24" height="24"></svg>';
        const svgSrc = `data:image/svg+xml;base64,${Buffer.from(svgMarkup, 'utf8').toString('base64')}`;

        it('converts SVG image sources to PNG data URIs at default 2x scale', async () => {
            const env = mockRasterEnvironment({ naturalWidth: 24, naturalHeight: 12 });
            const root = createRoot(`<p><img src="${svgSrc}" alt="icon"></p>`);

            try {
                await convertSvgImagesToPng(root);
                const img = root.querySelector('img');
                expect(img?.getAttribute('src')).toBe('data:image/png;base64,TESTPNG');
                expect(img?.getAttribute('width')).toBe('24');
                expect(img?.getAttribute('height')).toBe('12');
                expect(env.canvases[0]?.width).toBe(48);
                expect(env.canvases[0]?.height).toBe(24);
                expect(env.drawImage).toHaveBeenCalledWith(expect.anything(), 0, 0, 48, 24);
            } finally {
                env.restore();
            }
        });

        it.each([1, 2, 3, 4] as PngScale[])(
            'rasterizes at %dx scale while keeping unscaled display dimensions',
            async (scale) => {
                const env = mockRasterEnvironment({ naturalWidth: 40, naturalHeight: 20 });
                const root = createRoot(`<p><img src="${svgSrc}" alt="icon"></p>`);

                try {
                    await convertSvgImagesToPng(root, scale);
                    const img = root.querySelector('img');
                    expect(img?.getAttribute('src')).toBe('data:image/png;base64,TESTPNG');
                    expect(img?.getAttribute('width')).toBe('40');
                    expect(img?.getAttribute('height')).toBe('20');
                    expect(env.canvases[0]?.width).toBe(40 * scale);
                    expect(env.canvases[0]?.height).toBe(20 * scale);
                    expect(env.drawImage).toHaveBeenCalledWith(expect.anything(), 0, 0, 40 * scale, 20 * scale);
                } finally {
                    env.restore();
                }
            }
        );

        it('reduces scale per image to fit canvas limits while preserving display size and aspect ratio', async () => {
            const env = mockRasterEnvironment({ naturalWidth: 8192, naturalHeight: 100 });
            const root = createRoot(`<p><img src="${svgSrc}" alt="wide"></p>`);

            try {
                await convertSvgImagesToPng(root, 4);
                const img = root.querySelector('img');
                expect(img?.getAttribute('src')).toBe('data:image/png;base64,TESTPNG');
                expect(img?.getAttribute('width')).toBe('8192');
                expect(img?.getAttribute('height')).toBe('100');
                expect(env.canvases[0]?.width).toBe(16_384);
                expect(env.canvases[0]?.height).toBe(200);
            } finally {
                env.restore();
            }
        });

        it('keeps the integer canvas dimensions within the pixel-area limit', async () => {
            const env = mockRasterEnvironment({ naturalWidth: 2500, naturalHeight: 3500 });
            const root = createRoot(`<p><img src="${svgSrc}"></p>`);

            try {
                await convertSvgImagesToPng(root, 4);

                expect(env.canvases[0]).toMatchObject({ width: 6923, height: 9692 });
            } finally {
                env.restore();
            }
        });

        it.each(['data:,', '', 'data:image/png;base64,', 'data:image/jpeg;base64,ABC'])(
            'keeps the original SVG when canvas encoding returns invalid PNG URL: %j',
            async (badUrl) => {
                const env = mockRasterEnvironment({ toDataUrlResult: badUrl });
                const root = createRoot(`<p><img src="${svgSrc}" alt="icon"></p>`);

                try {
                    await convertSvgImagesToPng(root, 4);
                    const img = root.querySelector('img');
                    expect(img?.getAttribute('src')).toBe(svgSrc);
                    expect(img?.hasAttribute('width')).toBe(false);
                    expect(img?.hasAttribute('height')).toBe(false);
                } finally {
                    env.restore();
                }
            }
        );

        it('keeps the original SVG when image loading fails or canvas encoding throws', async () => {
            const envLoadFail = mockRasterEnvironment({ failImageLoad: true });
            const root1 = createRoot(`<p><img src="${svgSrc}" alt="icon"></p>`);
            try {
                await convertSvgImagesToPng(root1, 3);
                expect(root1.querySelector('img')?.getAttribute('src')).toBe(svgSrc);
            } finally {
                envLoadFail.restore();
            }

            const envThrow = mockRasterEnvironment({
                toDataUrlResult: () => {
                    throw new Error('Canvas encoding failed');
                },
            });
            const root2 = createRoot(`<p><img src="${svgSrc}" alt="icon"></p>`);
            try {
                await convertSvgImagesToPng(root2, 3);
                expect(root2.querySelector('img')?.getAttribute('src')).toBe(svgSrc);
            } finally {
                envThrow.restore();
            }
        });
    });
});
