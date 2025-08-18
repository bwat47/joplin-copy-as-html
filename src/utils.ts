import { PlainTextOptions } from './types';

export function validatePlainTextSettings(settings: unknown): PlainTextOptions {
    const s = settings as Record<string, unknown>;
    return {
        preserveSuperscript: Boolean(s.preserveSuperscript),
        preserveSubscript: Boolean(s.preserveSubscript),
        preserveEmphasis: Boolean(s.preserveEmphasis),
        preserveBold: Boolean(s.preserveBold),
        preserveHeading: Boolean(s.preserveHeading),
        preserveMark: Boolean(s.preserveMark),
        preserveInsert: Boolean(s.preserveInsert),
        hyperlinkBehavior: ['title', 'url', 'markdown'].includes(String(s.hyperlinkBehavior))
            ? String(s.hyperlinkBehavior) as 'title' | 'url' | 'markdown'
            : 'title',
    };
}

export function validateEmbedImagesSetting(setting: unknown): boolean {
    return Boolean(setting);
}

export function validateExportFullHtmlSetting(setting: unknown): boolean {
    return typeof setting === 'boolean';
}