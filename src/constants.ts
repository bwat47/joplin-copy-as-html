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
 * @since 1.0.16
 */

export const SETTINGS = {
    EMBED_IMAGES: 'embedImages',
    EXPORT_FULL_HTML: 'exportFullHtml',
    DOWNLOAD_REMOTE_IMAGES: 'downloadRemoteImages',
    PRESERVE_SUPERSCRIPT: 'preserveSuperscript',
    PRESERVE_SUBSCRIPT: 'preserveSubscript',
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
    DEBUG: 'debug',
};

// Regex patterns for Joplin resource and image handling
export const REGEX_PATTERNS = {
    // Matches fenced code blocks, inline code, and indented code blocks.
    // Fenced blocks support 3+ backticks or tildes and require the same fence length to close.
    // - Example (fenced): ```js\ncode\n``` or ~~~txt\ncode\n~~~
    //   Also supports longer fences to allow literal shorter fences inside.
    // - Example (inline): `code`
    // - Example (indented): 4-space or tab-indented lines
    // The 'm' flag is crucial for `^` to match the start of each line for indented blocks.
    // Implementation detail: uses a numbered backreference (\\3) for broad compatibility
    // with older JS targets. Group 3 captures the opening fence and is reused to match the
    // closing fence of equal length and type.
    CODE_BLOCKS: /((^|[\r\n])((?:```+|~~~+))[^\r\n]*[\r\n][\s\S]*?[\r\n]\3(?=\s|$)|`[^`\n]*`|^(?: {4}|\t).+)/gm,
    // HTML <img> with Joplin resource src
    // - Captures: (1) 32-char hex resource id
    // - Example: <img src=":/0123abcd...ef" alt="x">
    HTML_IMG_JOPLIN_SRC: /<img[^>]*src=["']:\/{1,2}([a-f0-9]{32})["'][^>]*>/gi,
    // Markdown image with Joplin resource target and optional title
    // - Captures: (1) alt, (2) 32-char hex resource id, (3) optional title ("title" | 'title' | (title))
    // - Examples:
    //   ![alt](:/0123abcd...ef)
    //   ![alt](:/0123abcd...ef "title")
    //   ![alt](:/0123abcd...ef 'title')
    //   ![alt](:/0123abcd...ef (title))
    MD_IMG_JOPLIN_WITH_TITLE: /!\[([^\]]*)\]\(\s*(?:<)?:\/{1}([a-f0-9]{32})(?:>)?(?:\s+(".*?"|'.*?'|\(.*?\)))?\s*\)/gi,
    // HTML <img> with remote http(s) src
    // - Captures: (1) URL
    // - Example: <img src="https://host/path.png" alt="x">
    HTML_IMG_REMOTE_SRC: /<img[^>]*src=["'](https?:[^"']+)["'][^>]*>/gi,
    // Markdown image with remote http(s) target and optional title
    // - Captures: (1) alt, (2) URL, (3) optional title ("title" | 'title' | (title))
    // - Examples:
    //   ![alt](https://host/p.png)
    //   ![alt](<https://host/p.png> "title")
    MD_IMG_REMOTE_WITH_TITLE: /!\[([^\]]*)\]\(\s*(?:<)?(https?:[^\s)]+)(?:>)?(?:\s+(".*?"|'.*?'|\(.*?\)))?\s*\)/gi,
};

// Constants for timeouts, formatting, and dimension keys
export const CONSTANTS = {
    BASE64_TIMEOUT_MS: 5000,
    MAX_IMAGE_SIZE_BYTES: 10 * 1024 * 1024, // 10MB limit
    MAX_IMAGE_SIZE_WARNING: 5 * 1024 * 1024, // 5MB warning threshold
    JOPLIN_RESOURCE_ID_LENGTH: 32,
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
    SUB: '~', // subscript
    SUP: '^', // superscript
} as const;

// Regex patterns for footnote references and definitions
export const PLAIN_TEXT_REGEX = {
    FOOTNOTE_REF: /\[\^([^\]]+)\]/g,
    FOOTNOTE_DEF: /\[\^([^\]]+)\]:/g,
} as const;
