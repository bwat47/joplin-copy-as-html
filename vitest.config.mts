import { defineConfig } from 'vitest/config';
import { fileURLToPath } from 'node:url';

export default defineConfig({
    resolve: {
        alias: {
            api: fileURLToPath(new URL('./api', import.meta.url)),
        },
    },
    test: {
        clearMocks: true,
        coverage: {
            reportsDirectory: 'coverage',
        },
        environment: 'jsdom',
        globals: true,
        include: ['src/**/*.test.ts'],
        setupFiles: ['src/vitestSetup.ts'],
    },
});
