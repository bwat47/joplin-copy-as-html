import joplin from 'api';
import { SETTINGS } from './constants'; // Uses real keys so mocks stay in sync

// NOTE: The joplin API mock (jest.mock('api', ...)) is centralized in src/jestSetup.ts
// and automatically applied to all test files via Jest's setupFilesAfterEnv configuration.

// Helper to reset all mocked Joplin APIs.
export function resetAllJoplinMocks(): void {
    (joplin.data.get as jest.Mock).mockReset();
    (joplin.settings.value as jest.Mock).mockReset();
    (joplin.settings.globalValue as jest.Mock).mockReset();

    // Commands
    if (joplin.commands) {
        (joplin.commands.execute as jest.Mock).mockReset();
        (joplin.commands.register as jest.Mock).mockReset();
    }

    // Clipboard
    if (joplin.clipboard) {
        (joplin.clipboard.writeHtml as jest.Mock).mockReset();
        (joplin.clipboard.writeText as jest.Mock).mockReset();
        (joplin.clipboard.write as jest.Mock).mockReset();
    }

    // Views
    if (joplin.views) {
        (joplin.views.menuItems.create as jest.Mock).mockReset();
        (joplin.views.dialogs.showToast as jest.Mock).mockReset();
    }
}

// Mock plugin settings queried via joplin.settings.value(), key-based (order independent).
// Uses SETTINGS.EMBED_IMAGES / SETTINGS.EXPORT_FULL_HTML so renaming constants won’t break tests.
export function mockHtmlSettings(
    opts: { embedImages?: boolean; exportFullHtml?: boolean; embedSvgAsPng?: boolean } = {}
): void {
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
