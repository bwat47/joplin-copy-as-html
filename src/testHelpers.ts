import joplin from 'api';
import { SETTINGS } from './constants'; // Uses real keys so mocks stay in sync

// NOTE: The joplin API mock (jest.mock('api', ...)) is centralized in src/jestSetup.ts
// and automatically applied to all test files via Jest's setupFilesAfterEnv configuration.

// Helper to reset all mocked Joplin APIs.
export function resetAllJoplinMocks(): void {
    (joplin.data.get as jest.Mock).mockReset();
    (joplin.settings.value as jest.Mock).mockReset();
    (joplin.settings.globalValue as jest.Mock).mockReset();
}

// Mock plugin settings queried via joplin.settings.value(), key-based (order independent).
// Uses SETTINGS.EMBED_IMAGES / SETTINGS.EXPORT_FULL_HTML so renaming constants won’t break tests.
export function mockHtmlSettings(opts: { embedImages?: boolean; exportFullHtml?: boolean; embedSvgAsPng?: boolean } = {}): void {
    const { embedImages = false, exportFullHtml = false, embedSvgAsPng = true } = opts;
    const embedKey = SETTINGS.EMBED_IMAGES;
    const fullKey = SETTINGS.EXPORT_FULL_HTML;
    const svgKey = SETTINGS.EMBED_SVG_AS_PNG;

    (joplin.settings.value as jest.Mock).mockImplementation((key: string) => {
        if (key === embedKey) return Promise.resolve(embedImages);
        if (key === fullKey) return Promise.resolve(exportFullHtml);
        if (key === svgKey) return Promise.resolve(embedSvgAsPng);
        return Promise.resolve(false);
    });
}

// Mock global markdown plugin enable flags.
// Pass the exact Joplin setting keys you want “true”.
export function mockGlobalPlugins(enabledKeys: string[] = []): void {
    const enabled = new Set(enabledKeys);
    (joplin.settings.globalValue as jest.Mock).mockImplementation((key: string) => {
        return Promise.resolve(enabled.has(key));
    });
}

// Convenience for enabling a single plugin key.
export function enableOnlyPlugin(key: string): void {
    mockGlobalPlugins([key]);
}

// Mock an image resource + file body for convertResourceToBase64()/embedding pipeline.
export function mockImageResource(resourceId: string, mime: string, body: string | Buffer): void {
    const buf = Buffer.isBuffer(body) ? body : Buffer.from(body);
    (joplin.data.get as jest.Mock).mockResolvedValueOnce({ id: resourceId, mime }).mockResolvedValueOnce({ body: buf });
}

// Generate a pseudo resource id (32 hex chars).
export function genResourceId(): string {
    return Array.from({ length: 32 }, () => Math.floor(Math.random() * 16).toString(16)).join('');
}
