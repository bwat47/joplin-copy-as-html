/**
 * @fileoverview Type Definitions - Interfaces and types for plugin data structures
 *
 * Defines TypeScript interfaces for all data structures used across the plugin:
 *
 * - Configuration interfaces (HtmlOptions, PlainTextOptions)
 * - Joplin API types (JoplinResource, JoplinFileData)
 *
 * These types provide compile-time safety and serve as documentation for the
 * expected structure of data flowing through the plugin's processing pipeline.
 */

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
    preserveStrikethrough: boolean;
    preserveHorizontalRule: boolean;
    preserveMark: boolean;
    preserveInsert: boolean;
    displayEmojis: boolean;
    hyperlinkBehavior: 'title' | 'url' | 'markdown';
    indentType: 'spaces' | 'tabs';
    listSpacing: 'tight' | 'loose';
    preserveTablePipes: boolean;
}

export interface JoplinResource {
    id: string;
    mime: string;
}

export interface JoplinFileData {
    body?: Buffer | Uint8Array;
}
