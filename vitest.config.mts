import { defineConfig } from 'vitest/config';

export default defineConfig({
    resolve: {
        tsconfigPaths: true,
    },
    test: {
        coverage: {
            reportsDirectory: 'coverage',
        },
        environment: 'jsdom',
        globals: true,
        include: ['src/**/*.test.ts'],
        setupFiles: ['src/testUtils/vitestSetup.ts'],
    },
});
