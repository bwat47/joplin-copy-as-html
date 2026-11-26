// src/utils.test.ts
import { DEFAULT_HTML_OPTIONS, DEFAULT_PLAIN_TEXT_OPTIONS } from './constants';
import { hasProperty, validateHtmlSettings, validatePlainTextSettings } from './utils';

describe('validatePlainTextSettings', () => {
    it('should return default values for invalid settings', () => {
        const invalidSettings = {
            preserveSuperscript: 'yes', // not a boolean
            hyperlinkBehavior: 'invalidOption',
            indentType: 123, // not a string
            listSpacing: 'wide',
            preserveTablePipes: 'yes',
            preserveCodeBackticks: 'yes',
            preserveQuoteMarkers: 'yes',
        };

        const validated = validatePlainTextSettings(invalidSettings);

        expect(validated.preserveSuperscript).toBe(false);
        expect(validated.hyperlinkBehavior).toBe('title');
        expect(validated.indentType).toBe('spaces');
        expect(validated.listSpacing).toBe('loose');
        expect(validated.preserveTablePipes).toBe(false);
        expect(validated.preserveCodeBackticks).toBe(false);
        expect(validated.preserveQuoteMarkers).toBe(false);
    });

    it('should return default values for undefined or null settings', () => {
        const validatedUndefined = validatePlainTextSettings(undefined);
        expect(validatedUndefined.preserveSuperscript).toBe(false);
        expect(validatedUndefined.hyperlinkBehavior).toBe('title');
        expect(validatedUndefined.indentType).toBe('spaces');
        expect(validatedUndefined.listSpacing).toBe('loose');
        expect(validatedUndefined.displayEmojis).toBe(true);
        expect(validatedUndefined.preserveTablePipes).toBe(false);
        expect(validatedUndefined.preserveCodeBackticks).toBe(false);
        expect(validatedUndefined.preserveQuoteMarkers).toBe(false);

        const validatedNull = validatePlainTextSettings(null);
        expect(validatedNull.preserveSuperscript).toBe(false);
        expect(validatedNull.hyperlinkBehavior).toBe('title');
        expect(validatedNull.indentType).toBe('spaces');
        expect(validatedNull.listSpacing).toBe('loose');
        expect(validatedNull.displayEmojis).toBe(true);
        expect(validatedNull.preserveTablePipes).toBe(false);
        expect(validatedNull.preserveCodeBackticks).toBe(false);
        expect(validatedNull.preserveQuoteMarkers).toBe(false);
    });

    it.each(['invalid', 42, true])('should return default values for non-object settings: %s', (settings) => {
        expect(validatePlainTextSettings(settings)).toEqual(DEFAULT_PLAIN_TEXT_OPTIONS);
    });
});

describe('validateHtmlSettings', () => {
    it('should return default values for undefined or null settings', () => {
        expect(validateHtmlSettings(undefined)).toEqual({
            embedImages: true,
            exportFullHtml: false,
            downloadRemoteImages: false,
            embedSvgAsPng: true,
            pngScale: 2,
        });
        expect(validateHtmlSettings(null)).toEqual({
            embedImages: true,
            exportFullHtml: false,
            downloadRemoteImages: false,
            embedSvgAsPng: true,
            pngScale: 2,
        });
    });

    it('should return the correct values for valid settings', () => {
        const settings = {
            embedImages: false,
            exportFullHtml: true,
            downloadRemoteImages: true,
            embedSvgAsPng: true,
            pngScale: 4,
        };
        expect(validateHtmlSettings(settings)).toEqual({
            embedImages: false,
            exportFullHtml: true,
            downloadRemoteImages: true,
            embedSvgAsPng: true,
            pngScale: 4,
        });
    });

    it.each([1, 2, 3, 4] as const)('should accept valid pngScale %d', (pngScale) => {
        expect(validateHtmlSettings({ pngScale }).pngScale).toBe(pngScale);
    });

    it.each([0, 5, -1, 2.5, '2', '3', null, undefined, Number.NaN])(
        'should fall back to default pngScale for invalid value: %s',
        (pngScale) => {
            expect(validateHtmlSettings({ pngScale }).pngScale).toBe(2);
        }
    );

    it('should return default values for invalid setting types', () => {
        const settings = {
            embedImages: 'true',
            exportFullHtml: 1,
            downloadRemoteImages: 'yes',
            embedSvgAsPng: 'y',
            pngScale: '4',
        };
        expect(validateHtmlSettings(settings)).toEqual({
            embedImages: true,
            exportFullHtml: false,
            downloadRemoteImages: false,
            embedSvgAsPng: true,
            pngScale: 2,
        });
    });

    it('should handle partial settings objects', () => {
        const settings1 = {
            embedImages: false,
        };
        expect(validateHtmlSettings(settings1)).toEqual({
            embedImages: false,
            exportFullHtml: false,
            downloadRemoteImages: false,
            embedSvgAsPng: true,
            pngScale: 2,
        });

        const settings2 = {
            exportFullHtml: true,
            pngScale: 3,
        };
        expect(validateHtmlSettings(settings2)).toEqual({
            embedImages: true,
            exportFullHtml: true,
            downloadRemoteImages: false,
            embedSvgAsPng: true,
            pngScale: 3,
        });
    });

    it.each(['invalid', 42, true])('should return default values for non-object settings: %s', (settings) => {
        expect(validateHtmlSettings(settings)).toEqual(DEFAULT_HTML_OPTIONS);
    });
});

describe('hasProperty', () => {
    it('returns true for objects that have the key', () => {
        expect(hasProperty({ code: 'ENOENT' }, 'code')).toBe(true);
        expect(hasProperty({ code: undefined }, 'code')).toBe(true);
        expect(hasProperty(new Error('x'), 'message')).toBe(true);
    });

    it.each([null, undefined, 'code', 42, {}, { other: 1 }])('returns false for %s', (value) => {
        expect(hasProperty(value, 'code')).toBe(false);
    });
});
