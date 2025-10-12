/**
 * @fileoverview Main plugin entry point for Joplin Copy as HTML
 *
 * Registers commands and settings for copying markdown selections as HTML or plain text.
 * Provides two main features:
 * - Copy as HTML: Converts markdown to clean HTML with embedded images
 * - Copy as Plain Text: Strips markdown formatting while preserving structure
 *
 * The plugin respects Joplin's global markdown settings and provides additional
 * customization options for plain text output formatting.
 *
 * @author bwat47
 * @since 1.0.0
 */

import joplin from 'api';
import { SettingItemType, ToastType, MenuItemLocation } from 'api/types';
import { SETTINGS } from './constants';
import { processHtmlConversion } from './htmlRenderer';
import { convertMarkdownToPlainText } from './plainTextRenderer';
import { validatePlainTextSettings, validateHtmlSettings } from './utils';

async function getMarkdownSelection(commandLabel: string): Promise<string | null> {
    const showToast = async (message: string, type: ToastType = ToastType.Info) => {
        await joplin.views.dialogs.showToast({ message, type });
    };

    try {
        const selection = await joplin.commands.execute('editor.execCommand', { name: 'getSelection' });
        if (typeof selection !== 'string') {
            await showToast(`${commandLabel}: This command only works in the Markdown editor.`);
            return null;
        }
        if (!selection.length) {
            await showToast('No text selected.');
            return null;
        }
        return selection;
    } catch {
        await showToast(`${commandLabel}: This command only works in the Markdown editor.`);
        return null;
    }
}

async function resolvePlainTextRenderingConfig() {
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
        displayEmojis: await joplin.settings.value(SETTINGS.DISPLAY_EMOJIS),
        hyperlinkBehavior: await joplin.settings.value(SETTINGS.HYPERLINK_BEHAVIOR),
        indentType: await joplin.settings.value(SETTINGS.INDENT_TYPE),
    };
    const plainTextOptions = validatePlainTextSettings(plainTextSettings);

    let debug = false;
    try {
        debug = await joplin.settings.value(SETTINGS.DEBUG);
    } catch {
        // ignore - use default false
    }

    return { plainTextOptions, debug };
}

joplin.plugins.register({
    onStart: async function () {
        // Register main HTML copy command FIRST to avoid keyboard shortcut bug
        await joplin.commands.register({
            name: 'copyAsHtml',
            label: 'Copy selection as HTML',
            iconName: 'fas fa-copy',
            execute: async () => {
                try {
                    const selection = await getMarkdownSelection('Copy as HTML');
                    if (!selection) return;

                    // Gather and validate HTML settings
                    const htmlSettings = {
                        embedImages: await joplin.settings.value(SETTINGS.EMBED_IMAGES),
                        exportFullHtml: await joplin.settings.value(SETTINGS.EXPORT_FULL_HTML),
                        downloadRemoteImages: await joplin.settings.value(SETTINGS.DOWNLOAD_REMOTE_IMAGES),
                    };
                    const htmlOptions = validateHtmlSettings(htmlSettings);

                    const html = await processHtmlConversion(selection, htmlOptions);

                    if (typeof joplin.clipboard.write === 'function') {
                        try {
                            const { plainTextOptions, debug } = await resolvePlainTextRenderingConfig();
                            const plainText = convertMarkdownToPlainText(selection, plainTextOptions, debug);
                            await joplin.clipboard.write({ html, text: plainText });
                            await joplin.views.dialogs.showToast({
                                message: 'Copied selection as HTML (with plain text fallback)!',
                                type: ToastType.Success,
                            });
                            return;
                        } catch (multiFormatError) {
                            console.warn('[copy-as-html] clipboard.write failed, falling back:', multiFormatError);
                        }
                    }

                    await joplin.clipboard.writeHtml(html);
                    await joplin.views.dialogs.showToast({
                        message: 'Copied selection as HTML!',
                        type: ToastType.Success,
                    });
                } catch (err) {
                    console.error('[copy-as-html] Error:', err);
                    await joplin.views.dialogs.showToast({
                        message: 'Failed to copy as HTML: ' + (err?.message || err),
                        type: ToastType.Error,
                    });
                }
            },
        });

        // Register plain text copy command
        await joplin.commands.register({
            name: 'copyAsPlainText',
            label: 'Copy selection as Plain Text',
            iconName: 'fas fa-copy',
            execute: async () => {
                try {
                    const selection = await getMarkdownSelection('Copy as Plain Text');
                    if (!selection) return;

                    const { plainTextOptions, debug } = await resolvePlainTextRenderingConfig();
                    const plainText = convertMarkdownToPlainText(selection, plainTextOptions, debug);
                    await joplin.clipboard.writeText(plainText);
                    await joplin.views.dialogs.showToast({
                        message: 'Copied selection as Plain Text!',
                        type: ToastType.Success,
                    });
                } catch (err) {
                    console.error('[copy-as-html] Error:', err);
                    await joplin.views.dialogs.showToast({
                        message: 'Failed to copy as Plain Text: ' + (err?.message || err),
                        type: ToastType.Error,
                    });
                }
            },
        });

        // Register plugin settings AFTER commands
        await joplin.settings.registerSection('copyAsHtml', {
            label: 'Copy as HTML',
            iconName: 'fas fa-copy',
        });

        await joplin.settings.registerSettings({
            [SETTINGS.EMBED_IMAGES]: {
                value: true,
                type: SettingItemType.Bool,
                section: 'copyAsHtml',
                public: true,
                label: 'Embed images as base64',
                description: 'If enabled, images in selection will be embedded as base64 in HTML output.',
            },
            [SETTINGS.EXPORT_FULL_HTML]: {
                value: false,
                type: SettingItemType.Bool,
                section: 'copyAsHtml',
                public: true,
                label: 'Export as full HTML document',
                description:
                    'If enabled, exported HTML will be a full document with your custom stylesheet (copy-as-html-user.css in your profile folder).',
            },
            [SETTINGS.DOWNLOAD_REMOTE_IMAGES]: {
                value: false,
                type: SettingItemType.Bool,
                section: 'copyAsHtml',
                public: true,
                label: 'Download and embed remote images',
                description:
                    'If enabled (along with "Embed images as base64"), remote HTTP/HTTPS images will be downloaded and embedded as base64. If un-checked, the resulting document may contain links to external resources.',
            },
            [SETTINGS.PRESERVE_SUPERSCRIPT]: {
                value: false,
                type: SettingItemType.Bool,
                section: 'copyAsHtml',
                public: true,
                advanced: true,
                label: 'Preserve superscript characters (^TEST^)',
                description: 'If enabled, ^TEST^ will remain ^TEST^ in plain text output.',
            },
            [SETTINGS.PRESERVE_SUBSCRIPT]: {
                value: false,
                type: SettingItemType.Bool,
                section: 'copyAsHtml',
                public: true,
                advanced: true,
                label: 'Preserve subscript characters (~TEST~)',
                description: 'If enabled, ~TEST~ will remain ~TEST~ in plain text output.',
            },
            [SETTINGS.PRESERVE_EMPHASIS]: {
                value: false,
                type: SettingItemType.Bool,
                section: 'copyAsHtml',
                public: true,
                advanced: true,
                label: 'Preserve emphasis characters (*TEST* or _TEST_)',
                description: 'If enabled, *TEST* or _TEST_ will remain as-is in plain text output.',
            },
            [SETTINGS.PRESERVE_BOLD]: {
                value: false,
                type: SettingItemType.Bool,
                section: 'copyAsHtml',
                public: true,
                advanced: true,
                label: 'Preserve bold characters (**TEST** or __TEST__)',
                description: 'If enabled, **TEST** or __TEST__ will remain as-is in plain text output.',
            },
            [SETTINGS.PRESERVE_HEADING]: {
                value: false,
                type: SettingItemType.Bool,
                section: 'copyAsHtml',
                public: true,
                advanced: true,
                label: 'Preserve heading characters (## TEST)',
                description: 'If enabled, ## TEST will remain as-is in plain text output.',
            },
            [SETTINGS.PRESERVE_STRIKETHROUGH]: {
                value: false,
                type: SettingItemType.Bool,
                section: 'copyAsHtml',
                public: true,
                advanced: true,
                label: 'Preserve strikethrough characters (~~TEST~~)',
                description: 'If enabled, ~~TEST~~ will remain as-is in plain text output.',
            },
            [SETTINGS.PRESERVE_HORIZONTAL_RULE]: {
                value: false,
                type: SettingItemType.Bool,
                section: 'copyAsHtml',
                public: true,
                advanced: true,
                label: 'Preserve horizontal rule (---)',
                description: 'If enabled, horizontal rules will be preserved as --- in plain text output.',
            },
            [SETTINGS.PRESERVE_MARK]: {
                value: false,
                type: SettingItemType.Bool,
                section: 'copyAsHtml',
                public: true,
                advanced: true,
                label: 'Preserve highlight characters (==TEST==)',
                description: 'If enabled, ==TEST== will remain as-is in plain text output.',
            },
            [SETTINGS.PRESERVE_INSERT]: {
                value: false,
                type: SettingItemType.Bool,
                section: 'copyAsHtml',
                public: true,
                advanced: true,
                label: 'Preserve insert characters (++TEST++)',
                description: 'If enabled, ++TEST++ will remain as-is in plain text output.',
            },
            [SETTINGS.DISPLAY_EMOJIS]: {
                value: true,
                type: SettingItemType.Bool,
                section: 'copyAsHtml',
                public: true,
                label: 'Display emojis',
                description: 'If enabled, emojis will be displayed in the plain text output.',
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
                section: 'copyAsHtml',
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
                section: 'copyAsHtml',
                public: true,
                label: 'List indentation type',
                description: 'How nested lists should be indented in plain text output.',
            },
            [SETTINGS.DEBUG]: {
                value: false,
                type: SettingItemType.Bool,
                section: 'copyAsHtml',
                public: true,
                advanced: true,
                label: 'Enable debug logging',
                description:
                    'If enabled, plugin will output additional diagnostic logs (markdown-it plugin loading, context menu detection, etc.).',
            },
        });

        // Note: We'll register context menu items dynamically through the filter
        // to avoid showing them in rich text editor where they don't work

        // Register keyboard shortcut for HTML copy (Edit menu as fallback)
        await joplin.views.menuItems.create('copyAsHtmlShortcut', 'copyAsHtml', MenuItemLocation.Edit, {
            accelerator: 'Ctrl+Shift+C',
        });

        // Register keyboard shortcut for plain text copy (Edit menu as fallback)
        await joplin.views.menuItems.create('copyAsPlainTextShortcut', 'copyAsPlainText', MenuItemLocation.Edit, {
            accelerator: 'Ctrl+Alt+C',
        });

        // Filter context menu to dynamically add our commands only in markdown editor
        joplin.workspace.filterEditorContextMenu(async (contextMenu) => {
            let debug = false;
            try {
                debug = await joplin.settings.value(SETTINGS.DEBUG);
            } catch {
                // ignore
            }

            if (debug) {
                // Debug: log what we see in the context menu
                console.log(
                    '[copy-as-html] Context menu items:',
                    contextMenu.items.map((item) => item.commandName)
                );
            }

            // Simple approach: try to execute a markdown-specific command
            // If it succeeds, we're in the markdown editor
            let isMarkdownEditor = false;
            try {
                // Try to get the cursor position - this should only work in markdown editor
                await joplin.commands.execute('editor.execCommand', {
                    name: 'getCursor',
                });
                isMarkdownEditor = true;
                if (debug) console.log('[copy-as-html] Detected markdown editor - adding context menu items');
            } catch {
                // If getCursor fails, we're likely in rich text editor
                isMarkdownEditor = false;
                if (debug) console.log('[copy-as-html] Detected rich text editor - not adding context menu items');
            }

            // Only add our commands to the context menu if we're in markdown editor
            if (isMarkdownEditor) {
                // Check if our commands are already in the menu to avoid duplicates
                const hasHtmlCommand = contextMenu.items.some((item) => item.commandName === 'copyAsHtml');
                const hasPlainTextCommand = contextMenu.items.some((item) => item.commandName === 'copyAsPlainText');

                if (!hasHtmlCommand) {
                    contextMenu.items.push({
                        commandName: 'copyAsHtml',
                        label: 'Copy selection as HTML',
                        accelerator: 'Ctrl+Shift+C',
                    });
                }

                if (!hasPlainTextCommand) {
                    contextMenu.items.push({
                        commandName: 'copyAsPlainText',
                        label: 'Copy selection as Plain Text',
                        accelerator: 'Ctrl+Alt+C',
                    });
                }

                if (debug) console.log('[copy-as-html] Added context menu items, total:', contextMenu.items.length);
            }

            return contextMenu;
        });
    },
});
