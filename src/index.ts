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
 */

import joplin from 'api';
import { ToastType, MenuItemLocation, MenuItem } from 'api/types';
import { processHtmlConversion } from './html/htmlRenderer';
import { convertMarkdownToPlainText } from './plainText/plainTextRenderer';
import { logger } from './logger';
import { registerPluginSettings, loadHtmlSettings, loadPlainTextSettings } from './settings';
import { showToast } from './utils';

async function getMarkdownSelection(commandLabel: string): Promise<string | null> {
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

                    const htmlOptions = await loadHtmlSettings();
                    const html = await processHtmlConversion(selection, htmlOptions);

                    if (typeof joplin.clipboard.write === 'function') {
                        try {
                            const plainTextOptions = await loadPlainTextSettings();
                            const plainText = convertMarkdownToPlainText(selection, plainTextOptions);
                            await joplin.clipboard.write({ html, text: plainText });
                            await showToast('Copied selection as HTML (with plain text fallback)!', ToastType.Success);
                            return;
                        } catch (multiFormatError) {
                            logger.warn('clipboard.write failed, falling back:', multiFormatError);
                        }
                    }

                    await joplin.clipboard.writeHtml(html);
                    await showToast('Copied selection as HTML!', ToastType.Success);
                } catch (err) {
                    logger.error('Error:', err);
                    await showToast('Failed to copy as HTML: ' + (err?.message || err), ToastType.Error);
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

                    const plainTextOptions = await loadPlainTextSettings();
                    const plainText = convertMarkdownToPlainText(selection, plainTextOptions);
                    await joplin.clipboard.writeText(plainText);
                    await showToast('Copied selection as Plain Text!', ToastType.Success);
                } catch (err) {
                    logger.error('Error:', err);
                    await showToast('Failed to copy as Plain Text: ' + (err?.message || err), ToastType.Error);
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

        // Filter context menu to dynamically add our commands only when there's a valid text selection
        joplin.workspace.filterEditorContextMenu(async (contextMenu) => {
            logger.debug(
                'Context menu items:',
                contextMenu.items.map((item) => item.commandName)
            );

            // Check if there's a valid text selection in the markdown editor
            let hasValidSelection = false;
            try {
                // Try to get the current selection - this should only work in markdown editor
                const selection = await joplin.commands.execute('editor.execCommand', {
                    name: 'getSelection',
                });
                // Only show menu items if selection is a non-empty string
                hasValidSelection = typeof selection === 'string' && selection.length > 0;
                logger.debug('Has valid selection:', hasValidSelection);
            } catch {
                // If getSelection fails, we're likely not in markdown editor
                hasValidSelection = false;
                logger.debug('No valid selection - not adding context menu items');
            }

            // Only add our commands to the context menu if there's a valid selection
            if (hasValidSelection) {
                // Check if our commands are already in the menu to avoid duplicates
                const hasHtmlCommand = contextMenu.items.some((item) => item.commandName === 'copyAsHtml');
                const hasPlainTextCommand = contextMenu.items.some((item) => item.commandName === 'copyAsPlainText');

                if (!hasHtmlCommand) {
                    // Add separator before our items
                    const separator: MenuItem = { type: 'separator' };
                    contextMenu.items.push(separator);
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
