/**
 * @fileoverview Configuration Constants - Centralized plugin settings and patterns
 *
 * Contains all configuration constants, regex patterns, and magic numbers used
 * throughout the plugin.
 *
 */

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

// Timeouts used for asset processing
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

// Plain text renderer specific (values not already in CONSTANTS)
export const PLAIN_TEXT_CONSTANTS = {
    ORDERED_LIST_START: 1,
    BULLET_PREFIX: '- ',
    ORDERED_SUFFIX: '. ',
    HEADING_PREFIX_CHAR: '#',
    HORIZONTAL_RULE_MARKER: '---',
    MAX_PARAGRAPH_NEWLINES: 2,
    MIN_COLUMN_WIDTH: 3,
    SPACES_PER_INDENT: 4,
    TABLE_CELL_PADDING: 2,
    TABLE_PIPE: '|',
} as const;

// Regex patterns for plain-text footnote rendering
export const PLAIN_TEXT_REGEX = {
    FOOTNOTE_REF: /\[\^([^\]]+)\]/g,
} as const;
