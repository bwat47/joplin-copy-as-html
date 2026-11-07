// Flat config (ESM). Adds typed linting, Node + Vitest globals, and project rule tweaks.

import js from '@eslint/js';
import { defineConfig } from 'eslint/config';
import tseslint from 'typescript-eslint';
import vitest from '@vitest/eslint-plugin';
import sonarjs from 'eslint-plugin-sonarjs';
import tsdoc from 'eslint-plugin-tsdoc';
import prettier from 'eslint-config-prettier';
import globals from 'globals';

export default defineConfig([
    {
        ignores: ['api/**', 'dist/**', '.prettierrc.js'],
    },

    js.configs.recommended,
    sonarjs.configs.recommended,

    {
        files: ['scripts/*.mjs'],
        languageOptions: { globals: globals.node },
    },

    // Project TypeScript sources
    {
        files: ['**/*.{ts,tsx,mts,cts}'],
        extends: [tseslint.configs.recommendedTypeChecked],
        plugins: {
            tsdoc,
        },
        languageOptions: {
            parserOptions: {
                projectService: true,
                tsconfigRootDir: import.meta.dirname,
            },
            globals: {
                ...globals.node,
            },
        },
        rules: {
            'tsdoc/syntax': 'error',
            'sonarjs/dompurify-unsafe-config': 'off',
            '@typescript-eslint/consistent-type-imports': ['error', { fixStyle: 'inline-type-imports' }],
            '@typescript-eslint/consistent-type-exports': ['error', { fixMixedExportsWithInlineTypeSpecifier: true }],
            // Use `import type { A }` rather than `import { type A }` when every specifier is a type
            '@typescript-eslint/no-import-type-side-effects': 'error',
            '@typescript-eslint/no-inferrable-types': 'error',
            '@typescript-eslint/no-unnecessary-condition': [
                'error',
                { allowConstantLoopConditions: 'only-allowed-literals' },
            ],
            '@typescript-eslint/explicit-module-boundary-types': 'error',
            eqeqeq: ['error', 'always', { null: 'ignore' }],
        },
    },

    // Test + test support
    {
        files: [
            '**/*.test.{ts,tsx,js}',
            '**/*.spec.{ts,tsx,js}',
            '**/__tests__/**/*.{ts,tsx,js}',
            'src/testHelpers.ts',
        ],
        plugins: {
            vitest,
        },
        languageOptions: {
            globals: {
                ...globals.node,
                ...globals.vitest,
            },
        },
        rules: {
            '@typescript-eslint/unbound-method': 'off',
            'vitest/unbound-method': 'error',
        },
    },

    // Prettier compatibility
    prettier,
]);
