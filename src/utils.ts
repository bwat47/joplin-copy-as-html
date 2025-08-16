import { PlainTextOptions } from './types';

export function validatePlainTextSettings(settings: any): PlainTextOptions {
    return {
        preserveSuperscript: Boolean(settings.preserveSuperscript),
        preserveSubscript: Boolean(settings.preserveSubscript),
        preserveEmphasis: Boolean(settings.preserveEmphasis),
        preserveBold: Boolean(settings.preserveBold),
        preserveHeading: Boolean(settings.preserveHeading),
        hyperlinkBehavior: ['title', 'url', 'markdown'].includes(settings.hyperlinkBehavior)
            ? settings.hyperlinkBehavior
            : 'title',
    };
}

export function validateEmbedImagesSetting(setting: any): boolean {
    return Boolean(setting);
}