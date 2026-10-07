import joplin from 'api';
import type { Mock } from 'vitest';

// NOTE: The joplin API mock (vi.mock('api', ...)) is centralized in src/vitestSetup.ts
// and automatically applied to all test files via Vitest's setupFiles configuration.

// Helper to reset all mocked Joplin APIs.
export function resetAllJoplinMocks(): void {
    (joplin.data.get as Mock).mockReset();
    (joplin.settings.values as Mock).mockReset();
    (joplin.settings.globalValues as Mock).mockReset();
    (joplin.commands.execute as Mock).mockReset();
    (joplin.commands.register as Mock).mockReset();
    (joplin.clipboard.writeText as Mock).mockReset();
    (joplin.clipboard.write as Mock).mockReset();
    (joplin.views.menuItems.create as Mock).mockReset();
    (joplin.views.dialogs.showToast as Mock).mockReset();
    (joplin.workspace.filterEditorContextMenu as Mock).mockReset();
}
