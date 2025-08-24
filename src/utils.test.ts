// src/utils.test.ts
import { validateBooleanSetting } from './utils';
import { validatePlainTextSettings } from './utils';

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
});
