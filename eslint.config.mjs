// Flat config (ESM). Adds ignores, Node + Vitest globals, and TS-friendly rule tweaks.

import js from '@eslint/js';
import tsParser from '@typescript-eslint/parser';
import tsPlugin from '@typescript-eslint/eslint-plugin';
import sonarjs from 'eslint-plugin-sonarjs';
import prettier from 'eslint-config-prettier';
import globals from 'globals';

export default [
    {
        ignores: ['api/**', 'dist/**', 'webpack.config.js', 'webpack.config.override.js', '.prettierrc.js'],
    },

    js.configs.recommended,
    sonarjs.configs.recommended,

    // Project TS/JS sources
    {
        files: ['**/*.{ts,tsx,js}'],
        languageOptions: {
            parser: tsParser,
            ecmaVersion: 2020,
            sourceType: 'module',
            globals: {
                ...globals.node,
            },
        },
        plugins: {
            '@typescript-eslint': tsPlugin,
        },
        rules: {
            // Turn off rules TypeScript handles (prevents NodeJS / type-only false positives)
            'no-undef': 'off',
            ...tsPlugin.configs.recommended.rules,
            'sonarjs/dompurify-unsafe-config': 'off',
            '@typescript-eslint/no-inferrable-types': 'error',
            '@typescript-eslint/explicit-module-boundary-types': 'error',
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
        languageOptions: {
            globals: {
                ...globals.node,
                ...globals.vitest,
            },
        },
        rules: {},
    },

    // Prettier compatibility
    prettier,
];
