import { PlainTextOptions } from './types';

export function validatePlainTextSettings(settings: unknown): PlainTextOptions {
    const s = settings as Record<string, unknown>;
    return {
        preserveSuperscript: Boolean(s.preserveSuperscript),
        preserveSubscript: Boolean(s.preserveSubscript),
        preserveEmphasis: Boolean(s.preserveEmphasis),
        preserveBold: Boolean(s.preserveBold),
        preserveHeading: Boolean(s.preserveHeading),
        hyperlinkBehavior: ['title', 'url', 'markdown'].includes(String(s.hyperlinkBehavior))
            ? String(s.hyperlinkBehavior) as 'title' | 'url' | 'markdown'
            : 'title',
    };
}

export function validateEmbedImagesSetting(setting: unknown): boolean {
    return Boolean(setting);
}