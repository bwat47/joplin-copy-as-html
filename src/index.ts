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
import { getErrorMessage, showToast } from './utils';

const COPY_AS_HTML_COMMAND = { name: 'copyAsHtml', label: 'Copy selection as HTML' };
const COPY_AS_PLAIN_TEXT_COMMAND = { name: 'copyAsPlainText', label: 'Copy selection as Plain Text' };

/**
 * Reads the current editor selection.
 * @returns The selected text (possibly empty), or null when not in the Markdown editor.
 */
async function readEditorSelection(): Promise<string | null> {
    try {
        const selection: unknown = await joplin.commands.execute('editor.execCommand', { name: 'getSelection' });
        return typeof selection === 'string' ? selection : null;
    } catch {
        // getSelection is only available in the Markdown editor
        return null;
    }
}

async function getMarkdownSelection(commandLabel: string): Promise<string | null> {
    const selection = await readEditorSelection();
    if (selection === null) {
        await showToast(`${commandLabel}: This command only works in the Markdown editor.`);
        return null;
    }
    if (!selection) {
        await showToast('No text selected.');
        return null;
    }
    return selection;
}

async function copySelectionAsHtml(): Promise<void> {
    try {
        const selection = await getMarkdownSelection('Copy as HTML');
        if (!selection) return;

        const htmlOptions = await loadHtmlSettings();
        const html = await processHtmlConversion(selection, htmlOptions);

        const plainTextOptions = await loadPlainTextSettings();
        const plainText = convertMarkdownToPlainText(selection, plainTextOptions);
        await joplin.clipboard.write({ html, text: plainText });
        await showToast('Copied selection as HTML (with plain text fallback)!', ToastType.Success);
    } catch (err) {
        logger.error('Error:', err);
        await showToast('Failed to copy as HTML: ' + getErrorMessage(err), ToastType.Error);
    }
}

async function copySelectionAsPlainText(): Promise<void> {
    try {
        const selection = await getMarkdownSelection('Copy as Plain Text');
        if (!selection) return;

        const plainTextOptions = await loadPlainTextSettings();
        const plainText = convertMarkdownToPlainText(selection, plainTextOptions);
        await joplin.clipboard.writeText(plainText);
        await showToast('Copied selection as Plain Text!', ToastType.Success);
    } catch (err) {
        logger.error('Error:', err);
        await showToast('Failed to copy as Plain Text: ' + getErrorMessage(err), ToastType.Error);
    }
}

async function registerCopyCommands(): Promise<void> {
    // Register main HTML copy command FIRST to avoid keyboard shortcut bug
    await joplin.commands.register({
        ...COPY_AS_HTML_COMMAND,
        iconName: 'fas fa-copy',
        execute: copySelectionAsHtml,
    });

    // Register plain text copy command
    await joplin.commands.register({
        ...COPY_AS_PLAIN_TEXT_COMMAND,
        iconName: 'fas fa-copy',
        execute: copySelectionAsPlainText,
    });
}

async function registerKeyboardShortcuts(): Promise<void> {
    // Register keyboard shortcut for HTML copy (Edit menu as fallback)
    await joplin.views.menuItems.create('copyAsHtmlShortcut', COPY_AS_HTML_COMMAND.name, MenuItemLocation.Edit, {
        accelerator: 'Ctrl+Shift+C',
    });

    // Register keyboard shortcut for plain text copy (Edit menu as fallback)
    await joplin.views.menuItems.create(
        'copyAsPlainTextShortcut',
        COPY_AS_PLAIN_TEXT_COMMAND.name,
        MenuItemLocation.Edit,
        {
            accelerator: 'Ctrl+Alt+C',
        }
    );
}

function registerEditorContextMenu(): void {
    // Filter context menu to dynamically add our commands only when there's a valid text selection
    joplin.workspace.filterEditorContextMenu(async (contextMenu) => {
        logger.debug(
            'Context menu items:',
            contextMenu.items.map((item) => item.commandName)
        );

        // Only show menu items for a non-empty selection in the Markdown editor
        const hasValidSelection = !!(await readEditorSelection());
        logger.debug('Has valid selection:', hasValidSelection);

        // Only add our commands to the context menu if there's a valid selection
        if (hasValidSelection) {
            // Skip commands already in the menu to avoid duplicates
            const itemsToAdd: MenuItem[] = [COPY_AS_HTML_COMMAND, COPY_AS_PLAIN_TEXT_COMMAND]
                .filter((command) => !contextMenu.items.some((item) => item.commandName === command.name))
                .map((command) => ({ commandName: command.name, label: command.label }));

            if (itemsToAdd.length > 0) {
                contextMenu.items.push({ type: 'separator' });
                contextMenu.items.push(...itemsToAdd);
            }

            logger.debug('Added context menu items, total:', contextMenu.items.length);
        }

        return contextMenu;
    });
}

void joplin.plugins.register({
    onStart: async function () {
        // Commands must precede settings; HTML must be registered first.
        await registerCopyCommands();
        await registerPluginSettings();
        await registerKeyboardShortcuts();
        registerEditorContextMenu();
    },
});
