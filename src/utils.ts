import { PlainTextOptions, HtmlOptions } from './types';

export function validatePlainTextSettings(settings: unknown): PlainTextOptions {
    const s = settings as Partial<PlainTextOptions>;
    return {
        preserveSuperscript: validateBooleanSetting(s.preserveSuperscript),
        preserveSubscript: validateBooleanSetting(s.preserveSubscript),
        preserveEmphasis: validateBooleanSetting(s.preserveEmphasis),
        preserveBold: validateBooleanSetting(s.preserveBold),
        preserveHeading: validateBooleanSetting(s.preserveHeading),
        preserveStrikethrough: validateBooleanSetting(s.preserveStrikethrough),
        preserveHorizontalRule: validateBooleanSetting(s.preserveHorizontalRule),
        preserveMark: validateBooleanSetting(s.preserveMark),
        preserveInsert: validateBooleanSetting(s.preserveInsert),
        // Only accept a string value and one of the allowed options.
        hyperlinkBehavior:
            typeof s.hyperlinkBehavior === 'string' && ['title', 'url', 'markdown'].includes(s.hyperlinkBehavior)
                ? (s.hyperlinkBehavior as 'title' | 'url' | 'markdown')
                : 'title',
    };
}

export function validateHtmlSettings(settings: unknown): HtmlOptions {
    const s = settings as Partial<HtmlOptions>;
    return {
        embedImages: validateBooleanSetting(s.embedImages, true),
        exportFullHtml: validateBooleanSetting(s.exportFullHtml, false),
    };
}

export function validateBooleanSetting(setting: unknown, defaultValue: boolean = false): boolean {
    return typeof setting === 'boolean' ? setting : defaultValue;
}