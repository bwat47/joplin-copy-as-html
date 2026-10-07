/**
 * @fileoverview Settings registration and loading for Copy as HTML plugin
 *
 * Centralizes all plugin settings definitions and provides helper functions
 * to register settings with Joplin and load validated configuration values.
 */

import joplin from 'api';
import { SettingItemType } from 'api/types';
import { DEFAULT_HTML_OPTIONS, DEFAULT_PLAIN_TEXT_OPTIONS, SETTINGS } from './constants';
import { validatePlainTextSettings, validateHtmlSettings } from './utils';
import type { PlainTextOptions, HtmlOptions } from './types';

const SECTION_ID = 'copyAsHtml';

/**
 * Registers the plugin settings section and all individual settings.
 */
export async function registerPluginSettings(): Promise<void> {
    await joplin.settings.registerSection(SECTION_ID, {
        label: 'Copy as HTML',
        iconName: 'fas fa-copy',
    });

    await joplin.settings.registerSettings({
        [SETTINGS.EMBED_IMAGES]: {
            value: DEFAULT_HTML_OPTIONS.embedImages,
            type: SettingItemType.Bool,
            section: SECTION_ID,
            public: true,
            label: 'Embed images as base64',
            description: 'If enabled, images in selection will be embedded as base64 in HTML output.',
        },
        [SETTINGS.EXPORT_FULL_HTML]: {
            value: DEFAULT_HTML_OPTIONS.exportFullHtml,
            type: SettingItemType.Bool,
            section: SECTION_ID,
            public: true,
            label: 'Export as full HTML document',
            description:
                'If enabled, exported HTML will be a full document with your custom stylesheet (copy-as-html-user.css in your profile folder).',
        },
        [SETTINGS.DOWNLOAD_REMOTE_IMAGES]: {
            value: DEFAULT_HTML_OPTIONS.downloadRemoteImages,
            type: SettingItemType.Bool,
            section: SECTION_ID,
            public: true,
            label: 'Download and embed remote images',
            description:
                'If enabled (along with "Embed images as base64"), remote HTTP/HTTPS images will be downloaded and embedded as base64. If un-checked, the resulting document may contain links to external resources.',
        },
        [SETTINGS.EMBED_SVG_AS_PNG]: {
            value: DEFAULT_HTML_OPTIONS.embedSvgAsPng,
            type: SettingItemType.Bool,
            section: SECTION_ID,
            public: true,
            label: 'Convert SVG images to PNG',
            description:
                'If enabled, embedded SVG images will be rasterized as PNG to improve compatibility with applications that cannot display inline SVG.',
        },
        [SETTINGS.PRESERVE_SUPERSCRIPT]: {
            value: DEFAULT_PLAIN_TEXT_OPTIONS.preserveSuperscript,
            type: SettingItemType.Bool,
            section: SECTION_ID,
            public: true,
            advanced: true,
            label: 'Preserve superscript markers',
            description: 'If enabled, superscript markers will be preserved in plain text output.',
        },
        [SETTINGS.PRESERVE_SUBSCRIPT]: {
            value: DEFAULT_PLAIN_TEXT_OPTIONS.preserveSubscript,
            type: SettingItemType.Bool,
            section: SECTION_ID,
            public: true,
            advanced: true,
            label: 'Preserve subscript markers',
            description: 'If enabled, subscript markers will be preserved in plain text output.',
        },
        [SETTINGS.PRESERVE_EMPHASIS]: {
            value: DEFAULT_PLAIN_TEXT_OPTIONS.preserveEmphasis,
            type: SettingItemType.Bool,
            section: SECTION_ID,
            public: true,
            advanced: true,
            label: 'Preserve emphasis markers',
            description: 'If enabled, emphasis markers will be preserved in plain text output.',
        },
        [SETTINGS.PRESERVE_BOLD]: {
            value: DEFAULT_PLAIN_TEXT_OPTIONS.preserveBold,
            type: SettingItemType.Bool,
            section: SECTION_ID,
            public: true,
            advanced: true,
            label: 'Preserve bold markers',
            description: 'If enabled, bold markers will be preserved in plain text output.',
        },
        [SETTINGS.PRESERVE_HEADING]: {
            value: DEFAULT_PLAIN_TEXT_OPTIONS.preserveHeading,
            type: SettingItemType.Bool,
            section: SECTION_ID,
            public: true,
            advanced: true,
            label: 'Preserve heading markers',
            description: 'If enabled, heading markers will be preserved in plain text output.',
        },
        [SETTINGS.PRESERVE_QUOTE_MARKERS]: {
            value: DEFAULT_PLAIN_TEXT_OPTIONS.preserveQuoteMarkers,
            type: SettingItemType.Bool,
            section: SECTION_ID,
            public: true,
            advanced: true,
            label: 'Preserve quote markers',
            description: 'If enabled, blockquote markers will be preserved in plain text output.',
        },
        [SETTINGS.PRESERVE_STRIKETHROUGH]: {
            value: DEFAULT_PLAIN_TEXT_OPTIONS.preserveStrikethrough,
            type: SettingItemType.Bool,
            section: SECTION_ID,
            public: true,
            advanced: true,
            label: 'Preserve strikethrough markers',
            description: 'If enabled, strikethrough markers will be preserved in plain text output.',
        },
        [SETTINGS.PRESERVE_HORIZONTAL_RULE]: {
            value: DEFAULT_PLAIN_TEXT_OPTIONS.preserveHorizontalRule,
            type: SettingItemType.Bool,
            section: SECTION_ID,
            public: true,
            advanced: true,
            label: 'Preserve horizontal rules',
            description: 'If enabled, horizontal rules will be preserved in plain text output.',
        },
        [SETTINGS.PRESERVE_MARK]: {
            value: DEFAULT_PLAIN_TEXT_OPTIONS.preserveMark,
            type: SettingItemType.Bool,
            section: SECTION_ID,
            public: true,
            advanced: true,
            label: 'Preserve highlight markers',
            description: 'If enabled, highlight markers will be preserved in plain text output.',
        },
        [SETTINGS.PRESERVE_INSERT]: {
            value: DEFAULT_PLAIN_TEXT_OPTIONS.preserveInsert,
            type: SettingItemType.Bool,
            section: SECTION_ID,
            public: true,
            advanced: true,
            label: 'Preserve insert markers',
            description: 'If enabled, insert markers will be preserved in plain text output.',
        },
        [SETTINGS.PRESERVE_CODE_BACKTICKS]: {
            value: DEFAULT_PLAIN_TEXT_OPTIONS.preserveCodeBackticks,
            type: SettingItemType.Bool,
            section: SECTION_ID,
            public: true,
            advanced: true,
            label: 'Preserve code backticks',
            description: 'If enabled, inline code and code block backticks will be preserved in plain text output.',
        },
        [SETTINGS.HYPERLINK_BEHAVIOR]: {
            value: DEFAULT_PLAIN_TEXT_OPTIONS.hyperlinkBehavior,
            type: SettingItemType.String,
            isEnum: true,
            options: {
                title: 'Link Title',
                url: 'Link URL',
                markdown: 'Markdown Format',
            },
            section: SECTION_ID,
            public: true,
            label: 'Plain text hyperlink behavior',
            description: 'How external HTTP/HTTPS links should appear in plain text output.',
        },
        [SETTINGS.INDENT_TYPE]: {
            value: DEFAULT_PLAIN_TEXT_OPTIONS.indentType,
            type: SettingItemType.String,
            isEnum: true,
            options: {
                spaces: '4 Spaces',
                tabs: 'Tabs',
            },
            section: SECTION_ID,
            public: true,
            label: 'List indentation type',
            description: 'How nested lists should be indented in plain text output.',
        },
        [SETTINGS.LIST_SPACING]: {
            value: DEFAULT_PLAIN_TEXT_OPTIONS.listSpacing,
            type: SettingItemType.String,
            isEnum: true,
            options: {
                tight: 'Tight',
                loose: 'Loose',
            },
            section: SECTION_ID,
            public: true,
            label: 'List spacing',
            description: 'Whether plain text lists should include blank lines between list items.',
        },
        [SETTINGS.DISPLAY_EMOJIS]: {
            value: DEFAULT_PLAIN_TEXT_OPTIONS.displayEmojis,
            type: SettingItemType.Bool,
            section: SECTION_ID,
            public: true,
            label: 'Display emojis',
            description: 'If enabled, emojis will be displayed in the plain text output.',
        },
        [SETTINGS.PRESERVE_TABLE_PIPES]: {
            value: DEFAULT_PLAIN_TEXT_OPTIONS.preserveTablePipes,
            type: SettingItemType.Bool,
            section: SECTION_ID,
            public: true,
            label: 'Preserve table pipes',
            description: 'If enabled, markdown pipe separators will be preserved in plain text output.',
        },
    });
}

/**
 * Setting keys read when loading HTML conversion options.
 * Keys match the corresponding `HtmlOptions` property names, so the raw record
 * returned by `joplin.settings.values()` can be handed straight to the validator.
 */
const HTML_SETTING_KEYS = [
    SETTINGS.EMBED_IMAGES,
    SETTINGS.EXPORT_FULL_HTML,
    SETTINGS.DOWNLOAD_REMOTE_IMAGES,
    SETTINGS.EMBED_SVG_AS_PNG,
];

/**
 * Setting keys read when loading plain text conversion options.
 * Keys match the corresponding `PlainTextOptions` property names.
 */
const PLAIN_TEXT_SETTING_KEYS = [
    SETTINGS.PRESERVE_SUPERSCRIPT,
    SETTINGS.PRESERVE_SUBSCRIPT,
    SETTINGS.PRESERVE_EMPHASIS,
    SETTINGS.PRESERVE_BOLD,
    SETTINGS.PRESERVE_HEADING,
    SETTINGS.PRESERVE_QUOTE_MARKERS,
    SETTINGS.PRESERVE_STRIKETHROUGH,
    SETTINGS.PRESERVE_HORIZONTAL_RULE,
    SETTINGS.PRESERVE_MARK,
    SETTINGS.PRESERVE_INSERT,
    SETTINGS.PRESERVE_CODE_BACKTICKS,
    SETTINGS.DISPLAY_EMOJIS,
    SETTINGS.HYPERLINK_BEHAVIOR,
    SETTINGS.INDENT_TYPE,
    SETTINGS.LIST_SPACING,
    SETTINGS.PRESERVE_TABLE_PIPES,
];

/**
 * Loads and validates HTML conversion settings from Joplin.
 *
 * Uses `values()` rather than repeated `value()` calls: each `value()` is a
 * separate round trip across the plugin bridge, and Joplin's API documentation
 * recommends `values()` for bulk reads.
 * @returns Validated HTML options object.
 */
export async function loadHtmlSettings(): Promise<HtmlOptions> {
    return validateHtmlSettings(await joplin.settings.values(HTML_SETTING_KEYS));
}

/**
 * Loads and validates plain text conversion settings from Joplin.
 * @returns Validated plain text options object.
 */
export async function loadPlainTextSettings(): Promise<PlainTextOptions> {
    return validatePlainTextSettings(await joplin.settings.values(PLAIN_TEXT_SETTING_KEYS));
}
