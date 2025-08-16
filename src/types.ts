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
}

export interface PlainTextOptions {
    preserveHeading: boolean;
    preserveEmphasis: boolean;
    preserveBold: boolean;
    preserveSuperscript: boolean;
    preserveSubscript: boolean;
	hyperlinkBehavior: 'title' | 'url' | 'markdown';
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