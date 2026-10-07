/**
 * @fileoverview Configuration Constants - Centralized plugin settings and patterns
 *
 * Contains all configuration constants, regex patterns, and magic numbers used
 * throughout the plugin.
 *
 */

import type { HtmlOptions, PlainTextOptions } from './types';

export const SETTINGS = {
    EMBED_IMAGES: 'embedImages',
    EXPORT_FULL_HTML: 'exportFullHtml',
    DOWNLOAD_REMOTE_IMAGES: 'downloadRemoteImages',
    EMBED_SVG_AS_PNG: 'embedSvgAsPng',
    PRESERVE_SUPERSCRIPT: 'preserveSuperscript',
    PRESERVE_SUBSCRIPT: 'preserveSubscript',
    PRESERVE_EMPHASIS: 'preserveEmphasis',
    PRESERVE_BOLD: 'preserveBold',
    PRESERVE_HEADING: 'preserveHeading',
    PRESERVE_QUOTE_MARKERS: 'preserveQuoteMarkers',
    PRESERVE_STRIKETHROUGH: 'preserveStrikethrough',
    PRESERVE_HORIZONTAL_RULE: 'preserveHorizontalRule',
    PRESERVE_MARK: 'preserveMark',
    PRESERVE_INSERT: 'preserveInsert',
    PRESERVE_CODE_BACKTICKS: 'preserveCodeBackticks',
    DISPLAY_EMOJIS: 'displayEmojis',
    HYPERLINK_BEHAVIOR: 'hyperlinkBehavior',
    INDENT_TYPE: 'indentType',
    LIST_SPACING: 'listSpacing',
    PRESERVE_TABLE_PIPES: 'preserveTablePipes',
};

/** Default HTML conversion options, used when registering settings and as validation fallbacks. */
export const DEFAULT_HTML_OPTIONS: HtmlOptions = {
    embedImages: true,
    exportFullHtml: false,
    downloadRemoteImages: false,
    embedSvgAsPng: true,
};

/** Default plain text conversion options, used when registering settings and as validation fallbacks. */
export const DEFAULT_PLAIN_TEXT_OPTIONS: PlainTextOptions = {
    preserveSuperscript: false,
    preserveSubscript: false,
    preserveEmphasis: false,
    preserveBold: false,
    preserveHeading: false,
    preserveQuoteMarkers: false,
    preserveStrikethrough: false,
    preserveHorizontalRule: false,
    preserveMark: false,
    preserveInsert: false,
    preserveCodeBackticks: false,
    displayEmojis: true,
    hyperlinkBehavior: 'title',
    indentType: 'spaces',
    listSpacing: 'loose',
    preserveTablePipes: false,
};

// Asset processing limits and UI timing
export const CONSTANTS = {
    BASE64_TIMEOUT_MS: 5000, //5s
    REMOTE_TIMEOUT_MS: 10000, //10s
    MAX_IMAGE_SIZE_BYTES: 25 * 1024 * 1024, // 25MB limit
    MAX_IMAGE_SIZE_WARNING: 15 * 1024 * 1024, // 15MB warning threshold
    // Generic User-Agent for remote image fetches to improve compatibility
    // while avoiding detailed browser impersonation.
    REMOTE_IMAGE_USER_AGENT: 'Mozilla/5.0',
    TOAST_DURATION: 3000,
};

// HTML / rendering related constants
export const HTML_CONSTANTS = {
    ERROR_COLOR: 'red',
    IMAGE_LOAD_ERROR: 'Image failed to load',
} as const;

export const RESOURCE_ID_REGEX = /^[a-f0-9]{32}$/i;

// Matches a GitHub/Joplin alert marker only at the start of blockquote content.
export const GITHUB_ALERT_MARKER_REGEX = /^\s*\[![^\]\r\n]+\](?:[ \t]*\r?\n|[ \t]*)/i;
