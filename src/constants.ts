/**
 * @fileoverview Configuration Constants - Centralized plugin settings and patterns
 *
 * Contains all configuration constants, regex patterns, and magic numbers used
 * throughout the plugin. Organized into logical groups:
 *
 * - SETTINGS: Plugin-specific setting keys for user preferences
 * - REGEX_PATTERNS: Compiled patterns for markdown and HTML parsing
 * - CONSTANTS: Processing limits, timeouts, and formatting values
 * - JOPLIN_SETTINGS: Global Joplin markdown plugin setting keys
 *
 * Centralizing constants here improves maintainability and makes the codebase
 * more self-documenting by giving context to numeric values and string patterns.
 *
 * @author bwat47
 * @since 1.0.0
 */

export const SETTINGS = {
    EMBED_IMAGES: 'embedImages',
    EXPORT_FULL_HTML: 'exportFullHtml',
    JOPLIN_RESOURCE_LINK_BEHAVIOR: 'joplinResourceLinkBehavior',
    PRESERVE_SUPERSCRIPT: 'preserveSuperscript',
    PRESERVE_SUBSCRIPT: 'preserveSubScript',
    PRESERVE_EMPHASIS: 'preserveEmphasis',
    PRESERVE_BOLD: 'preserveBold',
    PRESERVE_HEADING: 'preserveHeading',
    PRESERVE_STRIKETHROUGH: 'preserveStrikethrough',
    PRESERVE_HORIZONTAL_RULE: 'preserveHorizontalRule',
    PRESERVE_MARK: 'preserveMark',
    PRESERVE_INSERT: 'preserveInsert',
    DISPLAY_EMOJIS: 'displayEmojis',
    HYPERLINK_BEHAVIOR: 'hyperlinkBehavior',
    INDENT_TYPE: 'indentType',
};

// Regex patterns for Joplin resource and image handling
export const REGEX_PATTERNS = {
    CODE_BLOCKS: /(```[\s\S]*?```|`[^`\n]*`)/g,
    HTML_IMG: /<img[^>]*>/gi,
    MARKDOWN_IMG: /!\[[^\]]*\]\(:\/[^)]+\)/gi,
    // Matches HTML <img> tags with a Joplin resource ID in the src attribute.
    // Group 1: All attributes up to the resource ID
    // Group 2: The 32-character Joplin resource ID
    HTML_IMG_WITH_RESOURCE: /<img([^>]*src=["']:\/{1,2}([a-f0-9]{32})["'][^>]*)>/gi,
    // Matches HTML <img> tags with any resource ID (not just 32 chars).
    // Group 1: The resource ID (any non-quote, non-angle-bracket sequence)
    IMG_TAG_WITH_RESOURCE: /<img[^>]*src=["']:?\/{1,2}([^"'>]+)["'][^>]*>/gi,
};

// Constants for timeouts, formatting, and dimension keys
export const CONSTANTS = {
    BASE64_TIMEOUT_MS: 5000,
    MAX_IMAGE_SIZE_BYTES: 10 * 1024 * 1024, // 10MB limit
    MAX_IMAGE_SIZE_WARNING: 5 * 1024 * 1024, // 5MB warning threshold
    JOPLIN_RESOURCE_ID_LENGTH: 32,
    DIMENSION_KEY_PREFIX: 'DIMENSION_',
};

// Joplin global markdown plugin setting keys
export const JOPLIN_SETTINGS = {
    SUB: 'markdown.plugin.sub',
    SUP: 'markdown.plugin.sup',
    MARK: 'markdown.plugin.mark',
    INSERT: 'markdown.plugin.insert',
    SOFT_BREAKS: 'markdown.plugin.softbreaks',
    TYPOGRAPHER: 'markdown.plugin.typographer',
    ABBR: 'markdown.plugin.abbr',
    DEFLIST: 'markdown.plugin.deflist',
    EMOJI: 'markdown.plugin.emoji',
    FOOTNOTE: 'markdown.plugin.footnote',
    MULTITABLE: 'markdown.plugin.multitable',
    TOC: 'markdown.plugin.toc',
    LINKIFY: 'markdown.plugin.linkify',
} as const;

// HTML / rendering related constants
export const HTML_CONSTANTS = {
    ERROR_COLOR: 'red',
    TOC_PLACEHOLDER_PATTERN: '\\[\\[toc\\]\\]',
    TOC_CONTAINER_ID: 'toc',
} as const;

// Default options for selected markdown-it plugins
export const PLUGIN_DEFAULTS = {
    MULTIMD_TABLE: {
        multiline: true,
        rowspan: true,
        headerless: true,
        multibody: true,
    },
} as const;

// Regex matchers for Joplin resource links (used in renderer cleanup)
export const LINK_RESOURCE_MATCHERS: RegExp[] = [
    /^:\/([a-f0-9]{32})(?:$|[/?#])/i,
    /^joplin:\/\/resource\/([a-f0-9]{32})(?:$|[/?#])/i,
];

// Style sanitization patterns (security hardening)
export const SANITIZE_STYLE_PATTERNS: RegExp[] = [
    /javascript\s*:/gi,
    /expression\s*\(/gi,
    /@import[^;]*;?/gi,
    /url\s*\(\s*["']?javascript:/gi,
    /behavior\s*:/gi,
    /<script[^>]*>[\s\S]*?<\/script>/gi,
];

// Plain text renderer specific (values not already in CONSTANTS)
export const PLAIN_TEXT_CONSTANTS = {
    ORDERED_LIST_START: 1,
    BULLET_PREFIX: '- ',
    ORDERED_SUFFIX: '. ',
    LIST_ITEM_TRAILING_BLANK_LINE: true,
    HEADING_PREFIX_CHAR: '#',
    HORIZONTAL_RULE_MARKER: '---',
    CODE_FENCE_MARKER: '```',
    MAX_PARAGRAPH_NEWLINES: 2,
    MIN_COLUMN_WIDTH: 3,
    SPACES_PER_INDENT: 4,
    TABLE_CELL_PADDING: 2,
} as const;

// Inline markdown markers used when preserving formatting (centralized to avoid magic strings)
export const INLINE_MARKERS = {
    MARK: '==', // highlight
    INSERT: '++', // inserted / underline
    STRIKETHROUGH: '~~', // strike
} as const;

// Regex patterns for footnote references and definitions
export const PLAIN_TEXT_REGEX = {
    FOOTNOTE_REF: /\[\^([^\]]+)\]/g,
    FOOTNOTE_DEF: /\[\^([^\]]+)\]:/g,
} as const;
