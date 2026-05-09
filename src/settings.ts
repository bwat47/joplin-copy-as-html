/**
 * @fileoverview Settings registration and loading for Copy as HTML plugin
 *
 * Centralizes all plugin settings definitions and provides helper functions
 * to register settings with Joplin and load validated configuration values.
 */

import joplin from 'api';
import { SettingItemType } from 'api/types';
import { SETTINGS } from './constants';
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
            value: true,
            type: SettingItemType.Bool,
            section: SECTION_ID,
            public: true,
            label: 'Embed images as base64',
            description: 'If enabled, images in selection will be embedded as base64 in HTML output.',
        },
        [SETTINGS.EXPORT_FULL_HTML]: {
            value: false,
            type: SettingItemType.Bool,
            section: SECTION_ID,
            public: true,
            label: 'Export as full HTML document',
            description:
                'If enabled, exported HTML will be a full document with your custom stylesheet (copy-as-html-user.css in your profile folder).',
        },
        [SETTINGS.DOWNLOAD_REMOTE_IMAGES]: {
            value: false,
            type: SettingItemType.Bool,
            section: SECTION_ID,
            public: true,
            label: 'Download and embed remote images',
            description:
                'If enabled (along with "Embed images as base64"), remote HTTP/HTTPS images will be downloaded and embedded as base64. If un-checked, the resulting document may contain links to external resources.',
        },
        [SETTINGS.EMBED_SVG_AS_PNG]: {
            value: true,
            type: SettingItemType.Bool,
            section: SECTION_ID,
            public: true,
            advanced: false,
            label: 'Convert SVG images to PNG',
            description:
                'If enabled, embedded SVG images will be rasterized as PNG to improve compatibility with applications that cannot display inline SVG.',
        },
        [SETTINGS.PRESERVE_SUPERSCRIPT]: {
            value: false,
            type: SettingItemType.Bool,
            section: SECTION_ID,
            public: true,
            advanced: true,
            label: 'Preserve superscript markers',
            description: 'If enabled, superscript markers will be preserved in plain text output.',
        },
        [SETTINGS.PRESERVE_SUBSCRIPT]: {
            value: false,
            type: SettingItemType.Bool,
            section: SECTION_ID,
            public: true,
            advanced: true,
            label: 'Preserve subscript markers',
            description: 'If enabled, subscript markers will be preserved in plain text output.',
        },
        [SETTINGS.PRESERVE_EMPHASIS]: {
            value: false,
            type: SettingItemType.Bool,
            section: SECTION_ID,
            public: true,
            advanced: true,
            label: 'Preserve emphasis markers',
            description: 'If enabled, emphasis markers will be preserved in plain text output.',
        },
        [SETTINGS.PRESERVE_BOLD]: {
            value: false,
            type: SettingItemType.Bool,
            section: SECTION_ID,
            public: true,
            advanced: true,
            label: 'Preserve bold markers',
            description: 'If enabled, bold markers will be preserved in plain text output.',
        },
        [SETTINGS.PRESERVE_HEADING]: {
            value: false,
            type: SettingItemType.Bool,
            section: SECTION_ID,
            public: true,
            advanced: true,
            label: 'Preserve heading markers',
            description: 'If enabled, heading markers will be preserved in plain text output.',
        },
        [SETTINGS.PRESERVE_STRIKETHROUGH]: {
            value: false,
            type: SettingItemType.Bool,
            section: SECTION_ID,
            public: true,
            advanced: true,
            label: 'Preserve strikethrough markers',
            description: 'If enabled, strikethrough markers will be preserved in plain text output.',
        },
        [SETTINGS.PRESERVE_HORIZONTAL_RULE]: {
            value: false,
            type: SettingItemType.Bool,
            section: SECTION_ID,
            public: true,
            advanced: true,
            label: 'Preserve horizontal rules',
            description: 'If enabled, horizontal rules will be preserved in plain text output.',
        },
        [SETTINGS.PRESERVE_MARK]: {
            value: false,
            type: SettingItemType.Bool,
            section: SECTION_ID,
            public: true,
            advanced: true,
            label: 'Preserve highlight markers',
            description: 'If enabled, highlight markers will be preserved in plain text output.',
        },
        [SETTINGS.PRESERVE_INSERT]: {
            value: false,
            type: SettingItemType.Bool,
            section: SECTION_ID,
            public: true,
            advanced: true,
            label: 'Preserve insert markers',
            description: 'If enabled, insert markers will be preserved in plain text output.',
        },
        [SETTINGS.PRESERVE_CODE_BACKTICKS]: {
            value: false,
            type: SettingItemType.Bool,
            section: SECTION_ID,
            public: true,
            advanced: true,
            label: 'Preserve code backticks',
            description: 'If enabled, inline code and code block backticks will be preserved in plain text output.',
        },
        [SETTINGS.HYPERLINK_BEHAVIOR]: {
            value: 'title',
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
            value: 'spaces',
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
            value: 'loose',
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
            value: true,
            type: SettingItemType.Bool,
            section: SECTION_ID,
            public: true,
            label: 'Display emojis',
            description: 'If enabled, emojis will be displayed in the plain text output.',
        },
        [SETTINGS.PRESERVE_TABLE_PIPES]: {
            value: false,
            type: SettingItemType.Bool,
            section: SECTION_ID,
            public: true,
            label: 'Preserve table pipes',
            description: 'If enabled, markdown pipe separators will be preserved in plain text output.',
        },
    });
}

/**
 * Loads and validates HTML conversion settings from Joplin.
 * @returns Validated HTML options object.
 */
export async function loadHtmlSettings(): Promise<HtmlOptions> {
    const htmlSettings = {
        embedImages: await joplin.settings.value(SETTINGS.EMBED_IMAGES),
        exportFullHtml: await joplin.settings.value(SETTINGS.EXPORT_FULL_HTML),
        downloadRemoteImages: await joplin.settings.value(SETTINGS.DOWNLOAD_REMOTE_IMAGES),
        embedSvgAsPng: await joplin.settings.value(SETTINGS.EMBED_SVG_AS_PNG),
    };
    return validateHtmlSettings(htmlSettings);
}

/**
 * Loads and validates plain text conversion settings from Joplin.
 * @returns Validated plain text options object.
 */
export async function loadPlainTextSettings(): Promise<PlainTextOptions> {
    const plainTextSettings = {
        preserveSuperscript: await joplin.settings.value(SETTINGS.PRESERVE_SUPERSCRIPT),
        preserveSubscript: await joplin.settings.value(SETTINGS.PRESERVE_SUBSCRIPT),
        preserveEmphasis: await joplin.settings.value(SETTINGS.PRESERVE_EMPHASIS),
        preserveBold: await joplin.settings.value(SETTINGS.PRESERVE_BOLD),
        preserveHeading: await joplin.settings.value(SETTINGS.PRESERVE_HEADING),
        preserveStrikethrough: await joplin.settings.value(SETTINGS.PRESERVE_STRIKETHROUGH),
        preserveHorizontalRule: await joplin.settings.value(SETTINGS.PRESERVE_HORIZONTAL_RULE),
        preserveMark: await joplin.settings.value(SETTINGS.PRESERVE_MARK),
        preserveInsert: await joplin.settings.value(SETTINGS.PRESERVE_INSERT),
        preserveCodeBackticks: await joplin.settings.value(SETTINGS.PRESERVE_CODE_BACKTICKS),
        displayEmojis: await joplin.settings.value(SETTINGS.DISPLAY_EMOJIS),
        hyperlinkBehavior: await joplin.settings.value(SETTINGS.HYPERLINK_BEHAVIOR),
        indentType: await joplin.settings.value(SETTINGS.INDENT_TYPE),
        listSpacing: await joplin.settings.value(SETTINGS.LIST_SPACING),
        preserveTablePipes: await joplin.settings.value(SETTINGS.PRESERVE_TABLE_PIPES),
    };
    return validatePlainTextSettings(plainTextSettings);
}
