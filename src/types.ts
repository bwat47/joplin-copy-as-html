export interface ImageDimensions {
    width?: string;
    height?: string;
    style?: string;
    resourceId?: string;
}

export interface MarkdownSegment {
    type: 'text' | 'code';
    content: string;
}

export interface PluginOptions {
    sub?: { enabled: boolean };
    sup?: { enabled: boolean };
    mark?: { enabled: boolean };
    insert?: { enabled: boolean };
}

export interface HtmlOptions {
    embedImages: boolean;
    exportFullHtml: boolean;
}

export interface PlainTextOptions {
    preserveSuperscript: boolean;
    preserveSubscript: boolean;
    preserveEmphasis: boolean;
    preserveBold: boolean;
    preserveHeading: boolean;
    preserveStrikethrough: boolean;
    preserveHorizontalRule: boolean;
    preserveMark: boolean;
    preserveInsert: boolean;
    displayEmojis: boolean;
    hyperlinkBehavior: 'title' | 'url' | 'markdown';
    indentType: 'spaces' | 'tabs';
}

export interface TableRow {
    cells: string[];
    isHeader: boolean;
}

export interface TableData {
    rows: TableRow[];
}

export interface ListItem {
    content: string;
    ordered: boolean;
    index?: number;
    indentLevel: number;
}

export interface JoplinResource {
    id: string;
    mime: string;
}

export interface JoplinFileData {
    body?: Buffer | Uint8Array;
    data?: Buffer | Uint8Array;
    content?: Buffer | Uint8Array;
}

export interface PluginConfig {
    enabled: boolean;
    plugin: any;
    name: string;
    options?: any;
 }