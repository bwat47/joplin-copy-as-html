import joplin from 'api';
import { SettingItemType, ToastType, MenuItemLocation } from 'api/types';

// Import from your new files
import { SETTINGS } from './constants';
import { processHtmlConversion } from './htmlRenderer';
import { convertMarkdownToPlainText } from './plainTextRenderer';
import { validatePlainTextSettings, validateHtmlSettings } from './utils';

joplin.plugins.register({
	onStart: async function() {
		// Register main HTML copy command FIRST to avoid keyboard shortcut bug
		await joplin.commands.register({
            name: 'copyAsHtml',
            label: 'Copy selection as HTML',
            iconName: 'fas fa-copy',
            when: 'markdownEditorVisible',
            execute: async () => {
                try {
                    const selection = await joplin.commands.execute('editor.execCommand', { name: 'getSelection' });
                    if (!selection) {
                        await joplin.views.dialogs.showToast({ message: 'No text selected.', type: ToastType.Info });
                        return;
                    }
                    
                    // Gather and validate HTML settings
                    const htmlSettings = {
                        embedImages: await joplin.settings.value(SETTINGS.EMBED_IMAGES),
                        exportFullHtml: await joplin.settings.value(SETTINGS.EXPORT_FULL_HTML),
                    };
                    const htmlOptions = validateHtmlSettings(htmlSettings);

                    const html = await processHtmlConversion(selection, htmlOptions);
                    await joplin.clipboard.writeHtml(html);
                    await joplin.views.dialogs.showToast({ message: 'Copied selection as HTML!', type: ToastType.Success });
                } catch (err) {
                    console.error('[copy-as-html] Error:', err);
                    await joplin.views.dialogs.showToast({ message: 'Failed to copy as HTML: ' + (err?.message || err), type: ToastType.Error });
                }
            },
        });

		// Register plain text copy command
		await joplin.commands.register({
            name: 'copyAsPlainText',
            label: 'Copy selection as Plain Text',
            iconName: 'fas fa-copy',
            when: 'markdownEditorVisible',
            execute: async () => {
                try {
                    // Gather settings
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
                    };
                    const plainTextOptions = validatePlainTextSettings(plainTextSettings);

                    // Get selected markdown
                    const selection = await joplin.commands.execute('editor.execCommand', { name: 'getSelection' });
                    if (!selection) {
                        await joplin.views.dialogs.showToast({ message: 'No text selected.', type: ToastType.Info });
                        return;
                    }

                    const plainText = convertMarkdownToPlainText(selection, plainTextOptions);
                    await joplin.clipboard.writeText(plainText);
                    await joplin.views.dialogs.showToast({ message: 'Copied selection as Plain Text!', type: ToastType.Success });
                } catch (err) {
                    console.error('[copy-as-html] Error:', err);
                    await joplin.views.dialogs.showToast({ message: 'Failed to copy as Plain Text: ' + (err?.message || err), type: ToastType.Error });
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
				description: 'If enabled, exported HTML will be a full document with your custom stylesheet (copy-as-html-user.css in your profile folder).',
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
			[SETTINGS.PRESERVE_STRIKETHROUGH]: {
				value: false,
				type: SettingItemType.Bool,
				section: 'copyAsHtml',
				public: true,
				label: 'Preserve strikethrough characters (~~TEST~~)',
				description: 'If enabled, ~~TEST~~ will remain as-is in plain text output.',
			},
			[SETTINGS.PRESERVE_HORIZONTAL_RULE]: {
				value: false,
				type: SettingItemType.Bool,
				section: 'copyAsHtml',
				public: true,
				label: 'Preserve horizontal rule (---)',
				description: 'If enabled, horizontal rules will be preserved as --- in plain text output.',
			},
			[SETTINGS.PRESERVE_MARK]: {
				value: false,
				type: SettingItemType.Bool,
				section: 'copyAsHtml',
				public: true,
				label: 'Preserve highlight characters (==TEST==)',
				description: 'If enabled, ==TEST== will remain as-is in plain text output.',
			},
			[SETTINGS.PRESERVE_INSERT]: {
				value: false,
				type: SettingItemType.Bool,
				section: 'copyAsHtml',
				public: true,
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

		// Register keyboard shortcut for HTML copy
		await joplin.views.menuItems.create('copyAsHtmlShortcut', 'copyAsHtml', MenuItemLocation.EditorContextMenu, {
			accelerator: 'Ctrl+Shift+C',
		});

		// Register keyboard shortcut for plain text copy
		await joplin.views.menuItems.create('copyAsPlainTextShortcut', 'copyAsPlainText', MenuItemLocation.EditorContextMenu, {
			accelerator: 'Ctrl+Alt+C',
		});
	},
});