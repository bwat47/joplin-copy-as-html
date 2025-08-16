export const SETTINGS = {
	EMBED_IMAGES: 'embedImages',
	PRESERVE_SUPERSCRIPT: 'preserveSuperscript',
	PRESERVE_SUBSCRIPT: 'preserveSubscript',
	PRESERVE_EMPHASIS: 'preserveEmphasis',
	PRESERVE_BOLD: 'preserveBold',
	PRESERVE_HEADING: 'preserveHeading',
	HYPERLINK_BEHAVIOR: 'hyperlinkBehavior',
};

// Regex patterns for Joplin resource and image handling
export const REGEX_PATTERNS = {
	CODE_BLOCKS: /(```[\s\S]*?```|`[^`\n]*`)/g,
	HTML_IMG: /<img[^>]*>/gi,
	MARKDOWN_IMG: /!\[[^\]]*\]\(:\/{1,2}[a-f0-9]{32}\)/gi,
	HTML_IMG_WITH_RESOURCE: /<img([^>]*src=["']:\/{1,2}([a-f0-9]{32})["'][^>]*)>/gi,
	IMG_TAG_WITH_RESOURCE: /<img[^>]*src=["']:?\/{1,2}([^"'>]+)["'][^>]*>/gi,
};

// Constants for timeouts, formatting, and dimension keys
export const CONSTANTS = {
    BASE64_TIMEOUT_MS: 5000,
    MIN_COLUMN_WIDTH: 3,
    DIMENSION_KEY_PREFIX: 'DIMENSION_'
};