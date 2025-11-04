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
import { ToastType, MenuItemLocation } from 'api/types';
import { processHtmlConversion } from './htmlRenderer';
import { convertMarkdownToPlainText } from './plainTextRenderer';
import { logger } from './logger';
import { registerPluginSettings, loadHtmlSettings, loadPlainTextSettings, loadDebugSetting } from './settings';

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

                    const debugEnabled = await loadDebugSetting();
                    logger.setDebug(debugEnabled);

                    const htmlOptions = await loadHtmlSettings();
                    const html = await processHtmlConversion(selection, htmlOptions);

                    if (typeof joplin.clipboard.write === 'function') {
                        try {
                            const plainTextOptions = await loadPlainTextSettings();
                            const plainText = convertMarkdownToPlainText(selection, plainTextOptions);
                            await joplin.clipboard.write({ html, text: plainText });
                            await joplin.views.dialogs.showToast({
                                message: 'Copied selection as HTML (with plain text fallback)!',
                                type: ToastType.Success,
                            });
                            return;
                        } catch (multiFormatError) {
                            logger.warn('clipboard.write failed, falling back:', multiFormatError);
                        }
                    }

                    await joplin.clipboard.writeHtml(html);
                    await joplin.views.dialogs.showToast({
                        message: 'Copied selection as HTML!',
                        type: ToastType.Success,
                    });
                } catch (err) {
                    logger.error('Error:', err);
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

                    const debugEnabled = await loadDebugSetting();
                    logger.setDebug(debugEnabled);

                    const plainTextOptions = await loadPlainTextSettings();
                    const plainText = convertMarkdownToPlainText(selection, plainTextOptions);
                    await joplin.clipboard.writeText(plainText);
                    await joplin.views.dialogs.showToast({
                        message: 'Copied selection as Plain Text!',
                        type: ToastType.Success,
                    });
                } catch (err) {
                    logger.error('Error:', err);
                    await joplin.views.dialogs.showToast({
                        message: 'Failed to copy as Plain Text: ' + (err?.message || err),
                        type: ToastType.Error,
                    });
                }
            },
        });

        // Register plugin settings AFTER commands
        await registerPluginSettings();

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
            const debugEnabled = await loadDebugSetting();
            logger.setDebug(debugEnabled);

            logger.debug(
                'Context menu items:',
                contextMenu.items.map((item) => item.commandName)
            );

            // Simple approach: try to execute a markdown-specific command
            // If it succeeds, we're in the markdown editor
            let isMarkdownEditor = false;
            try {
                // Try to get the cursor position - this should only work in markdown editor
                await joplin.commands.execute('editor.execCommand', {
                    name: 'getCursor',
                });
                isMarkdownEditor = true;
                logger.debug('Detected markdown editor - adding context menu items');
            } catch {
                // If getCursor fails, we're likely in rich text editor
                isMarkdownEditor = false;
                logger.debug('Detected rich text editor - not adding context menu items');
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

                logger.debug('Added context menu items, total:', contextMenu.items.length);
            }

            return contextMenu;
        });
    },
});
