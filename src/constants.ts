export const SETTINGS = {
	EMBED_IMAGES: 'embedImages',
	EXPORT_FULL_HTML: 'exportFullHtml',
	JOPLIN_RESOURCE_LINK_BEHAVIOR: 'joplinResourceLinkBehavior',
	PRESERVE_SUPERSCRIPT: 'preserveSuperscript',
	PRESERVE_SUBSCRIPT: 'preserveSubScript',
	PRESERVE_EMPHASIS: 'preserveEmphasis',
	PRESERVE_BOLD: 'preserveBold',
	PRESERVE_HEADING: 'preserveHeading',
	PRESERVE_MARK: 'preserveMark',
	PRESERVE_INSERT: 'preserveInsert',
	PRESERVE_STRIKETHROUGH: 'preserveStrikethrough',
	HYPERLINK_BEHAVIOR: 'hyperlinkBehavior',
};

// Regex patterns for Joplin resource and image handling
export const REGEX_PATTERNS = {
	CODE_BLOCKS: /(```[\s\S]*?```|`[^`\n]*`)/g,
	HTML_IMG: /<img[^>]*>/gi,
	MARKDOWN_IMG: /!\[[^\]]*\]\(:\/{1,2}[a-f0-9]{32}\)/gi,
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
    MIN_COLUMN_WIDTH: 3,
    DIMENSION_KEY_PREFIX: 'DIMENSION_'
};