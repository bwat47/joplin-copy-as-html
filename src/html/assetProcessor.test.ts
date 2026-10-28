import joplin from 'api';
import { convertResourceToBase64, downloadRemoteImageAsBase64 } from './assetProcessor';

describe('convertResourceToBase64', () => {
    const id = '0123456789abcdef0123456789abcdef';

    function mockResource(metadata: Record<string, unknown>): void {
        vi.mocked(joplin.data.get).mockImplementation((path: string[]) =>
            Promise.resolve(path.includes('file') ? { body: Buffer.from('image bytes') } : { id, ...metadata })
        );
    }

    it.each([
        ['image/png', 'image/png'],
        ['IMAGE/SVG+XML; charset=utf-8', 'image/svg+xml'],
    ])('normalizes the stored MIME type %s', async (mime, expectedType) => {
        mockResource({ mime, size: 11 });

        expect(await convertResourceToBase64(id)).toBe(`data:${expectedType};base64,aW1hZ2UgYnl0ZXM=`);
    });

    it.each(['application/pdf', 'image/', 'image/png#x'])('rejects the stored MIME type %s', async (mime) => {
        mockResource({ mime, size: 11 });

        expect(await convertResourceToBase64(id)).toBeNull();
    });

    it('rejects a resource whose metadata size exceeds the limit without loading the file', async () => {
        mockResource({ mime: 'image/png', size: 26 * 1024 * 1024 });

        expect(await convertResourceToBase64(id)).toBeNull();
        expect(joplin.data.get).toHaveBeenCalledTimes(1);
    });

    it('returns null when the resource file does not load in time', async () => {
        vi.useFakeTimers();
        try {
            vi.mocked(joplin.data.get).mockImplementation((path: string[]) =>
                path.includes('file') ? new Promise(() => {}) : Promise.resolve({ id, mime: 'image/png', size: 11 })
            );

            const result = convertResourceToBase64(id);
            await vi.advanceTimersByTimeAsync(5000);

            expect(await result).toBeNull();
        } finally {
            vi.useRealTimers();
        }
    });

    it.each([undefined, -1])('allows a resource with unknown size %s', async (size) => {
        mockResource({ mime: 'image/png', size });

        expect(await convertResourceToBase64(id)).toBe('data:image/png;base64,aW1hZ2UgYnl0ZXM=');
    });
});

describe('downloadRemoteImageAsBase64 Content-Type handling', () => {
    const url = 'https://example.com/image';

    afterEach(() => {
        vi.unstubAllGlobals();
    });

    it.each([
        ['image/png', 'image/png'],
        ['image/svg+xml; charset=utf-8', 'image/svg+xml'],
        ['IMAGE/SVG+XML; CHARSET="utf-8"', 'image/svg+xml'],
        ['image/svg+xml; charset=utf-8; name="icon; small.svg"', 'image/svg+xml'],
        ['image/png; name="icon\\" (small),#%.png"', 'image/png'],
        ['image/vnd.microsoft.icon', 'image/vnd.microsoft.icon'],
    ])('normalizes %s without changing the image bytes', async (contentType, expectedType) => {
        vi.stubGlobal(
            'fetch',
            vi.fn().mockResolvedValue(new Response('image bytes', { headers: { 'Content-Type': contentType } }))
        );

        const result = await downloadRemoteImageAsBase64(url);

        expect(result).toBe(`data:${expectedType};base64,aW1hZ2UgYnl0ZXM=`);
    });

    it.each([null, '', 'text/html', 'image/', 'image', 'image/not valid', 'image/png, text/html', 'image/png#x'])(
        'rejects a missing, non-image, or malformed Content-Type: %s',
        async (contentType) => {
            const response = new Response('image bytes', {
                headers: contentType === null ? {} : { 'Content-Type': contentType },
            });
            const getReader = vi.spyOn(response.body!, 'getReader');
            const cancel = vi.spyOn(response.body!, 'cancel');
            vi.stubGlobal('fetch', vi.fn().mockResolvedValue(response));

            expect(await downloadRemoteImageAsBase64(url)).toBeNull();
            expect(getReader).not.toHaveBeenCalled();
            expect(cancel).toHaveBeenCalledOnce();
        }
    );

    it('ignores cancellation failures on a rejected response', async () => {
        const body = new ReadableStream({ start: (controller) => controller.error(new Error('stream failed')) });
        vi.stubGlobal(
            'fetch',
            vi.fn().mockResolvedValue(new Response(body, { headers: { 'Content-Type': 'text/html' } }))
        );
        const onUnhandled = vi.fn();
        process.on('unhandledRejection', onUnhandled);

        try {
            expect(await downloadRemoteImageAsBase64(url)).toBeNull();
            await new Promise((resolve) => setTimeout(resolve, 0));
            expect(onUnhandled).not.toHaveBeenCalled();
        } finally {
            process.off('unhandledRejection', onUnhandled);
        }
    });
});
