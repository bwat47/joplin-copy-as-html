import { PlainTextOptions } from './types';

export function validatePlainTextSettings(settings: unknown): PlainTextOptions {
    const s = settings as Partial<PlainTextOptions>;
    return {
        preserveSuperscript: typeof s.preserveSuperscript === 'boolean'
            ? s.preserveSuperscript
            : false,
        preserveSubscript: typeof s.preserveSubscript === 'boolean'
            ? s.preserveSubscript
            : false,
        preserveEmphasis: typeof s.preserveEmphasis === 'boolean'
            ? s.preserveEmphasis
            : false,
        preserveBold: typeof s.preserveBold === 'boolean'
            ? s.preserveBold
            : false,
        preserveHeading: typeof s.preserveHeading === 'boolean'
            ? s.preserveHeading
            : false,
        preserveStrikethrough: typeof s.preserveStrikethrough === 'boolean'
            ? s.preserveStrikethrough
            : false,
        preserveHorizontalRule: typeof s.preserveHorizontalRule === 'boolean'
            ? s.preserveHorizontalRule
            : false,
        preserveMark: typeof s.preserveMark === 'boolean'
            ? s.preserveMark
            : false,
        preserveInsert: typeof s.preserveInsert === 'boolean'
            ? s.preserveInsert
            : false,
        hyperlinkBehavior: ['title', 'url', 'markdown'].includes(String(s.hyperlinkBehavior))
            ? String(s.hyperlinkBehavior) as 'title' | 'url' | 'markdown'
            : 'title',
    };
}

export function validateEmbedImagesSetting(setting: unknown): boolean {
    return typeof setting === 'boolean' ? setting : false;
}

export function validateExportFullHtmlSetting(setting: unknown): boolean {
    return typeof setting === 'boolean' ? setting : false;
}