import joplin from 'api';
import type { Mock } from 'vitest';
import { SETTINGS } from './constants'; // Uses real keys so mocks stay in sync

// NOTE: The joplin API mock (vi.mock('api', ...)) is centralized in src/vitestSetup.ts
// and automatically applied to all test files via Vitest's setupFiles configuration.

// Helper to reset all mocked Joplin APIs.
export function resetAllJoplinMocks(): void {
    (joplin.data.get as Mock).mockReset();
    (joplin.settings.value as Mock).mockReset();
    (joplin.settings.values as Mock).mockReset();
    (joplin.settings.globalValue as Mock).mockReset();

    // Commands
    if (joplin.commands) {
        (joplin.commands.execute as Mock).mockReset();
        (joplin.commands.register as Mock).mockReset();
    }

    // Clipboard
    if (joplin.clipboard) {
        (joplin.clipboard.writeHtml as Mock).mockReset();
        (joplin.clipboard.writeText as Mock).mockReset();
        (joplin.clipboard.write as Mock).mockReset();
    }

    // Views
    if (joplin.views) {
        (joplin.views.menuItems.create as Mock).mockReset();
        (joplin.views.dialogs.showToast as Mock).mockReset();
    }
}

// Mock plugin settings, key-based (order independent), for both joplin.settings.value()
// and joplin.settings.values(). Uses the SETTINGS constants so renaming keys won’t break tests.
function mockSettingValues(values: Record<string, unknown>): void {
    const lookup = (key: string) => (key in values ? values[key] : false);

    (joplin.settings.value as Mock).mockImplementation((key: string) => Promise.resolve(lookup(key)));

    (joplin.settings.values as Mock).mockImplementation((keys: string[] | string) => {
        const keyList = Array.isArray(keys) ? keys : [keys];
        const result: Record<string, unknown> = {};
        for (const key of keyList) result[key] = lookup(key);
        return Promise.resolve(result);
    });
}

export function mockHtmlSettings(
    opts: { embedImages?: boolean; exportFullHtml?: boolean; embedSvgAsPng?: boolean } = {}
): void {
    const { embedImages = false, exportFullHtml = false, embedSvgAsPng = true } = opts;

    mockSettingValues({
        [SETTINGS.EMBED_IMAGES]: embedImages,
        [SETTINGS.EXPORT_FULL_HTML]: exportFullHtml,
        [SETTINGS.EMBED_SVG_AS_PNG]: embedSvgAsPng,
    });
}
