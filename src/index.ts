import joplin from 'api';
import { SettingItemType, ToastType, MenuItemLocation } from 'api/types';
import * as MarkdownIt from 'markdown-it';
import Token from 'markdown-it/lib/token';
import { JSDOM } from 'jsdom';

// Import from your new files
import { SETTINGS } from './constants';
import { REGEX_PATTERNS } from './constants';
import { JOPLIN_RESOURCE_ID_LENGTH } from './constants';
import { PluginOptions, PlainTextOptions } from './types';
import { processHtmlConversion } from './htmlRenderer';
import { renderPlainText } from './plainTextRenderer';
import { validatePlainTextSettings, validateEmbedImagesSetting } from './utils';

joplin.plugins.register({
	onStart: async function() {
		// Register plugin settings
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
			[SETTINGS.PRESERVE_SUPERSCRIPT]: {
				value: false,
				type: SettingItemType.Bool,
				section: 'copyAsHtml',
				public: true,
				label: 'Preserve superscript characters (^TEST^)',
				description: 'If enabled, ^TEST^ will remain ^TEST^ in plain text output.',
			},
			[SETTINGS.PRESERVE_SUBSCRIPT]: {
				value: false,
				type: SettingItemType.Bool,
				section: 'copyAsHtml',
				public: true,
				label: 'Preserve subscript characters (~TEST~)',
				description: 'If enabled, ~TEST~ will remain ~TEST~ in plain text output.',
			},
			[SETTINGS.PRESERVE_EMPHASIS]: {
				value: false,
				type: SettingItemType.Bool,
				section: 'copyAsHtml',
				public: true,
				label: 'Preserve emphasis characters (*TEST* or _TEST_)',
				description: 'If enabled, *TEST* or _TEST_ will remain as-is in plain text output.',
			},
			[SETTINGS.PRESERVE_BOLD]: {
				value: false,
				type: SettingItemType.Bool,
				section: 'copyAsHtml',
				public: true,
				label: 'Preserve bold characters (**TEST** or __TEST__)',
				description: 'If enabled, **TEST** or __TEST__ will remain as-is in plain text output.',
			},
			[SETTINGS.PRESERVE_HEADING]: {
				value: false,
				type: SettingItemType.Bool,
				section: 'copyAsHtml',
				public: true,
				label: 'Preserve heading characters (## TEST)',
				description: 'If enabled, ## TEST will remain as-is in plain text output.',
			},
			[SETTINGS.HYPERLINK_BEHAVIOR]: {
				value: 'title',
				type: SettingItemType.String,
				isEnum: true,
				options: {
					'title': 'Link Title',
					'url': 'Link URL', 
					'markdown': 'Markdown Format'
				},
				section: 'copyAsHtml',
				public: true,
				label: 'Plain text hyperlink behavior',
				description: 'How external HTTP/HTTPS links should appear in plain text output.',
			},
		});

		// Register main HTML copy command
		await joplin.commands.register({
            name: 'copyAsHtml',
            label: 'Copy selection as HTML',
            iconName: 'fas fa-copy',
            when: 'markdownEditorVisible',
            execute: async () => {
                const selection = await joplin.commands.execute('editor.execCommand', { name: 'getSelection' });
                if (!selection) {
                    await joplin.views.dialogs.showToast({ message: 'No text selected.', type: ToastType.Info });
                    return;
                }
                try {
                    const fragment = await processHtmlConversion(selection);
                    await joplin.clipboard.writeHtml(fragment);
                    await joplin.views.dialogs.showToast({ message: 'Copied selection as HTML!', type: ToastType.Success });
                } catch (err) {
                    console.error('[copy-as-html] Clipboard writeHtml error:', err);
                    await joplin.views.dialogs.showToast({ message: 'Failed to copy as HTML: ' + (err?.message || err), type: ToastType.Error });
                }
            },
        });

		// Register keyboard shortcut for HTML copy
		await joplin.views.menuItems.create('copyAsHtmlShortcut', 'copyAsHtml', MenuItemLocation.EditorContextMenu, {
			accelerator: 'Ctrl+Shift+C',
		});

		// Register plain text copy command
		await joplin.commands.register({
            name: 'copyAsPlainText',
            label: 'Copy selection as Plain Text',
            iconName: 'fas fa-copy',
            when: 'markdownEditorVisible',
            execute: async () => {
                // Gather settings
                const plainTextSettings = {
                    preserveSuperscript: await joplin.settings.value(SETTINGS.PRESERVE_SUPERSCRIPT),
                    preserveSubscript: await joplin.settings.value(SETTINGS.PRESERVE_SUBSCRIPT),
                    preserveEmphasis: await joplin.settings.value(SETTINGS.PRESERVE_EMPHASIS),
                    preserveBold: await joplin.settings.value(SETTINGS.PRESERVE_BOLD),
                    preserveHeading: await joplin.settings.value(SETTINGS.PRESERVE_HEADING),
                    hyperlinkBehavior: await joplin.settings.value(SETTINGS.HYPERLINK_BEHAVIOR),
                };
                const plainTextOptions = validatePlainTextSettings(plainTextSettings);

                // Get selected markdown
                const selection = await joplin.commands.execute('editor.execCommand', { name: 'getSelection' });
                if (!selection) {
                    await joplin.views.dialogs.showToast({ message: 'No text selected.', type: ToastType.Info });
                    return;
                }

                // Use markdown-it to parse and render plain text
                const md = new MarkdownIt();
                const tokens = md.parse(selection, {});

                let plainText = renderPlainText(tokens, null, 0, {
                    ...plainTextOptions
                });

				// Copy to clipboard as plain text with error handling
				try {
					await joplin.clipboard.writeText(plainText);
					await joplin.views.dialogs.showToast({ message: 'Copied selection as Plain Text!', type: ToastType.Success });
				} catch (err) {
					console.error('[copy-as-html] Clipboard writeText error:', err);
					await joplin.views.dialogs.showToast({ message: 'Failed to copy as Plain Text: ' + (err?.message || err), type: ToastType.Error });
				}
            },
        });

		// Register keyboard shortcut for plain text copy
		await joplin.views.menuItems.create('copyAsPlainTextShortcut', 'copyAsPlainText', MenuItemLocation.EditorContextMenu, {
			accelerator: 'Ctrl+Alt+C',
		});
	},
});