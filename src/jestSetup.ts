// Jest setup file - automatically loaded before all tests
// Centralizes the Joplin API mock that was previously duplicated across test files

import { resetAllJoplinMocks, mockGlobalPlugins } from './testHelpers';

jest.mock('api', () => ({
    __esModule: true,
    default: {
        data: {
            get: jest.fn(),
        },
        settings: {
            value: jest.fn(),
            globalValue: jest.fn(),
        },
    },
}));

beforeEach(() => {
    resetAllJoplinMocks();
    mockGlobalPlugins([]);
});
