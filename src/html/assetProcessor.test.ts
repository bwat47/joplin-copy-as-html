// Hoist Joplin API mock
jest.mock('api', () => ({
    __esModule: true,
    default: {
        data: { get: jest.fn() },
        settings: { value: jest.fn(), globalValue: jest.fn() },
    },
}));

import joplin from 'api';
import { buildImageEmbedMap } from './assetProcessor';
import { genResourceId, resetAllJoplinMocks, mockGlobalPlugins } from '../testHelpers';

beforeEach(() => {
    resetAllJoplinMocks();
    mockGlobalPlugins([]);
    jest.restoreAllMocks();
});

describe('assetProcessor buildImageEmbedMap', () => {
    it('should deduplicate Joplin resource fetches by resource id', async () => {
        const id = genResourceId();
        const urls = new Set<string>([`:/${id}`, `:/${id}#anchor`, `joplin://resource/${id}`, `:/${id}?query=param`]);

        // Mock Joplin API for a single resource fetch (2 calls: metadata + file)
        (joplin.data.get as jest.Mock)
            .mockResolvedValueOnce({ id, mime: 'image/png' })
            .mockResolvedValueOnce({ body: Buffer.from('data') });

        const map = await buildImageEmbedMap(urls, { embedImages: true, downloadRemoteImages: false });

        // Only one resource (id) should have been fetched: exactly 2 calls (meta + file)
        expect((joplin.data.get as jest.Mock).mock.calls.length).toBe(2);

        // All URL variants should be populated in the output map
        expect(map.size).toBe(urls.size);
        for (const u of urls) expect(map.has(u)).toBe(true);
    });
});
