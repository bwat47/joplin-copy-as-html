// Vitest setup file - automatically loaded before all tests
// Mocks the Joplin API for every test file and resets all mocks before each test

vi.mock('api', () => ({
    __esModule: true,
    default: {
        data: {
            get: vi.fn(),
        },
        settings: {
            values: vi.fn(),
            globalValues: vi.fn(),
        },
        commands: {
            execute: vi.fn(),
            register: vi.fn(),
        },
        clipboard: {
            writeText: vi.fn(),
            write: vi.fn(),
        },
        views: {
            menuItems: {
                create: vi.fn(),
            },
            dialogs: {
                showToast: vi.fn(),
            },
        },
        workspace: {
            filterEditorContextMenu: vi.fn(),
        },
    },
}));

beforeEach(() => {
    vi.resetAllMocks();
});
