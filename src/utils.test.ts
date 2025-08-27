// src/utils.test.ts
jest.mock('api', () => ({
    settings: {
        value: jest.fn(),
        globalValue: jest.fn(),
    },
    data: {
        get: jest.fn(),
    },
}));

import { validateBooleanSetting, validateHtmlSettings, validatePlainTextSettings } from './utils';

describe('validateBooleanSetting', () => {
    it('should return the boolean value if it is a boolean', () => {
        expect(validateBooleanSetting(true)).toBe(true);
        expect(validateBooleanSetting(false)).toBe(false);
    });

    it('should return the default value if the setting is not a boolean', () => {
        // Test with default fallback (false)
        expect(validateBooleanSetting(undefined)).toBe(false);
        expect(validateBooleanSetting(null)).toBe(false);
        expect(validateBooleanSetting('true')).toBe(false);
        expect(validateBooleanSetting(1)).toBe(false);
        expect(validateBooleanSetting({})).toBe(false);
    });

    it('should return the provided default value for non-boolean types', () => {
        // Test with a specified default value (true)
        expect(validateBooleanSetting(undefined, true)).toBe(true);
        expect(validateBooleanSetting(null, true)).toBe(true);
        expect(validateBooleanSetting('false', true)).toBe(true);
    });
});

describe('validatePlainTextSettings', () => {
    it('should return default values for invalid settings', () => {
        const invalidSettings = {
            preserveSuperscript: 'yes', // not a boolean
            hyperlinkBehavior: 'invalidOption',
            indentType: 123, // not a string
        };

        const validated = validatePlainTextSettings(invalidSettings);

        expect(validated.preserveSuperscript).toBe(false);
        expect(validated.hyperlinkBehavior).toBe('title');
        expect(validated.indentType).toBe('spaces');
    });

    it('should return default values for undefined or null settings', () => {
        const validatedUndefined = validatePlainTextSettings(undefined);
        expect(validatedUndefined.preserveSuperscript).toBe(false);
        expect(validatedUndefined.hyperlinkBehavior).toBe('title');
        expect(validatedUndefined.indentType).toBe('spaces');
        expect(validatedUndefined.displayEmojis).toBe(true);

        const validatedNull = validatePlainTextSettings(null);
        expect(validatedNull.preserveSuperscript).toBe(false);
        expect(validatedNull.hyperlinkBehavior).toBe('title');
        expect(validatedNull.indentType).toBe('spaces');
        expect(validatedNull.displayEmojis).toBe(true);
    });
});

describe('validateHtmlSettings', () => {
    it('should return default values for undefined or null settings', () => {
        expect(validateHtmlSettings(undefined)).toEqual({
            embedImages: true,
            exportFullHtml: false,
        });
        expect(validateHtmlSettings(null)).toEqual({
            embedImages: true,
            exportFullHtml: false,
        });
    });

    it('should return the correct values for valid settings', () => {
        const settings = {
            embedImages: false,
            exportFullHtml: true,
        };
        expect(validateHtmlSettings(settings)).toEqual({
            embedImages: false,
            exportFullHtml: true,
        });
    });

    it('should return default values for invalid setting types', () => {
        const settings = {
            embedImages: 'true',
            exportFullHtml: 1,
        };
        expect(validateHtmlSettings(settings)).toEqual({
            embedImages: true,
            exportFullHtml: false,
        });
    });

    it('should handle partial settings objects', () => {
        const settings1 = {
            embedImages: false,
        };
        expect(validateHtmlSettings(settings1)).toEqual({
            embedImages: false,
            exportFullHtml: false,
        });

        const settings2 = {
            exportFullHtml: true,
        };
        expect(validateHtmlSettings(settings2)).toEqual({
            embedImages: true,
            exportFullHtml: true,
        });
    });
});
