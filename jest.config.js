// jest.config.js
module.exports = {
    preset: 'ts-jest',
    testEnvironment: 'jsdom',
    clearMocks: true,
    coverageDirectory: 'coverage',

    // Use ts-jest for TS, and babel-jest for JS (including ESM from node_modules)
    transform: {
        '^.+\\.ts$': 'ts-jest',
        '^.+\\.(mjs|cjs|js)$': 'babel-jest',
    },

    // This tells Jest to NOT ignore transformation for the problematic packages.
    transformIgnorePatterns: [
        'node_modules/(?!(string-width|strip-ansi|ansi-regex|emoji-regex|get-east-asian-width|unified|remark-[^/]+|mdast-[^/]+|micromark[^/]*|decode-named-character-reference|devlop|bail|is-plain-obj|trough|vfile[^/]*|unist-[^/]+|property-information|space-separated-tokens|comma-separated-tokens|hast-[^/]+|html-[^/]+|zwitch|ccount|character-entities[^/]*|escape-string-regexp|markdown-table|trim-lines|longest-streak|node-emoji|emoticon)/)',
    ],

    moduleFileExtensions: ['ts', 'js', 'json', 'node'],
    roots: ['<rootDir>/src'],

    // Map joplin api alias
    moduleNameMapper: {
        '^api$': '<rootDir>/api',
        '^api/types$': '<rootDir>/api/types',
    },

    // Setup file to run before all tests (centralizes API mocks)
    setupFilesAfterEnv: ['<rootDir>/src/jestSetup.ts'],
};
