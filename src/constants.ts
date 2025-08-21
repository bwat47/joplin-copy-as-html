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
    MIN_COLUMN_WIDTH: 3,
    DIMENSION_KEY_PREFIX: 'DIMENSION_'
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