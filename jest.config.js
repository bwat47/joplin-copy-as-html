// jest.config.js
module.exports = {
    preset: 'ts-jest',
    testEnvironment: 'node',
    clearMocks: true,
    coverageDirectory: 'coverage',

    // This is the key change. We tell ts-jest to transform both .ts and .js files.
    transform: {
        '^.+\\.(ts|js)$': 'ts-jest',
    },

    // This tells Jest to NOT ignore transformation for the problematic packages.
    transformIgnorePatterns: [
        'node_modules/(?!(string-width|strip-ansi|ansi-regex|emoji-regex|get-east-asian-width)/)',
    ],

    moduleFileExtensions: ['ts', 'js', 'json', 'node'],
    roots: ['<rootDir>/src'],

    // Map joplin api alias
    moduleNameMapper: {
        '^api$': '<rootDir>/api',
    },
};
