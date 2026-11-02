export interface HtmlOptions {
    embedImages: boolean;
    exportFullHtml: boolean;
    downloadRemoteImages: boolean;
    embedSvgAsPng: boolean;
}

export interface PlainTextOptions {
    preserveSuperscript: boolean;
    preserveSubscript: boolean;
    preserveEmphasis: boolean;
    preserveBold: boolean;
    preserveHeading: boolean;
    preserveQuoteMarkers: boolean;
    preserveStrikethrough: boolean;
    preserveHorizontalRule: boolean;
    preserveMark: boolean;
    preserveInsert: boolean;
    preserveCodeBackticks: boolean;
    displayEmojis: boolean;
    hyperlinkBehavior: 'title' | 'url' | 'markdown';
    indentType: 'spaces' | 'tabs';
    listSpacing: 'tight' | 'loose';
    preserveTablePipes: boolean;
}

export interface JoplinResource {
    id: string;
    mime: string;
    /** File size in bytes; may be missing or non-positive for legacy resources. */
    size?: number;
}
