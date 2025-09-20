/**
 * @fileoverview Type Definitions - Interfaces and types for plugin data structures
 *
 * Defines TypeScript interfaces for all data structures used across the plugin:
 *
 * - Configuration interfaces (HtmlOptions, PlainTextOptions)
 * - Processing data structures (ImageDimensions, TableData, ListItem)
 * - Joplin API types (JoplinResource, JoplinFileData)
 * - Internal processing types (PluginConfig)
 *
 * These types provide compile-time safety and serve as documentation for the
 * expected structure of data flowing through the plugin's processing pipeline.
 *
 * @author bwat47
 * @since 1.0.16
 */

export interface ImageDimensions {
    width?: string;
    height?: string;
    resourceId?: string;
    originalAlt?: string;
}

export interface HtmlOptions {
    embedImages: boolean;
    exportFullHtml: boolean;
    downloadRemoteImages: boolean;
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
    /** Allows forcing the legacy plain text renderer despite the block pipeline default. */
    useLegacyRenderer?: boolean;
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

export interface RemoteImageData {
    originalUrl: string;
    placeholder: string;
    dimensions?: ImageDimensions;
}
