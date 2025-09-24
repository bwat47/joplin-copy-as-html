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
        'node_modules/(?!(string-width|strip-ansi|ansi-regex|emoji-regex|get-east-asian-width|markdown-it-github-alerts)/)',
    ],

    moduleFileExtensions: ['ts', 'js', 'json', 'node'],
    roots: ['<rootDir>/src'],

    // Map joplin api alias
    moduleNameMapper: {
        '^api$': '<rootDir>/api',
    },
};
