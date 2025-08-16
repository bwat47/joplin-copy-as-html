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
import {
    extractImageDimensions,
    applyPreservedDimensions,
    convertResourceToBase64,
    replaceAsync
} from './htmlRenderer';
import { renderPlainText } from './plainTextRenderer';

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
                // Get selected markdown
				let selection = await joplin.commands.execute('editor.execCommand', { name: 'getSelection' });
				if (!selection) {
					await joplin.views.dialogs.showToast({ message: 'No text selected.', type: ToastType.Info });
					return;
				}

				// Get Joplin global settings
				const globalSubEnabled = await joplin.settings.globalValue('markdown.plugin.sub');
				const globalSupEnabled = await joplin.settings.globalValue('markdown.plugin.sup');
				const globalMarkEnabled = await joplin.settings.globalValue('markdown.plugin.mark');
				const globalSoftBreaksEnabled = await joplin.settings.globalValue('markdown.plugin.softbreaks');
				const embedImages = await joplin.settings.value(SETTINGS.EMBED_IMAGES);

				// Handle soft breaks
				if (!globalSoftBreaksEnabled) {
					selection = selection.replace(/([^\n])\n(?!\n)/g, '$1  \n');
				}

				// Extract and preserve image dimensions from HTML img tags
				const { processedMarkdown, dimensions } = extractImageDimensions(selection, embedImages);

				// Create renderer with plugin options
				const { MarkupToHtml, MarkupLanguage } = require('@joplin/renderer');
				let pluginOptions: PluginOptions = {};
				if (!globalSubEnabled) pluginOptions.sub = { enabled: false };
				if (!globalSupEnabled) pluginOptions.sup = { enabled: false };
				if (!globalMarkEnabled) pluginOptions.mark = { enabled: false };

				const markupToHtml = new MarkupToHtml({ pluginOptions });
				
				// Render processed markdown to HTML using MarkupLanguage.Markdown
				const renderOptions = {};
				const theme = {};
				const renderResult = await markupToHtml.render(MarkupLanguage.Markdown, processedMarkdown, theme, renderOptions);
				let html = renderResult.html;

				// Apply preserved dimensions to the rendered HTML
				if (embedImages) {
					html = applyPreservedDimensions(html, dimensions);
				}

				// If embedding images, convert Joplin resource URLs to base64
				if (embedImages) {
					// Replace src attribute for Joplin resource images with base64 data
					html = await replaceAsync(html, REGEX_PATTERNS.IMG_TAG_WITH_RESOURCE, async (match: string, id: string) => {
						if (!id) return match;
						// If the ID is not 32 characters, treat as invalid and show error span
						if (id.length !== JOPLIN_RESOURCE_ID_LENGTH) {
							return `<span style="color: red;">Resource ID “:/${id}” could not be found</span>`;
						}
						const base64Result = await convertResourceToBase64(id);
						if (base64Result.startsWith('data:image')) {
							// Replace just the src attribute
							return match.replace(/src=["'][^"']+["']/, `src="${base64Result}"`);
						} else {
							// Replace the entire <img> tag with the error span
							return base64Result;
						}
					});

					// Replace fallback [Image: :/resourceId] text with actual base64 image
					const fallbackRegex = /\[Image: :\/{1,2}([a-f0-9]{32})\]/gi;
					html = await replaceAsync(html, fallbackRegex, async (match: string, id: string) => {
						if (!id) return match;
						
						const base64Result = await convertResourceToBase64(id);
						if (base64Result.startsWith('data:image')) {
							return `<img src="${base64Result}" alt="" />`;
						} else {
							// Error case - return error span
							return base64Result;
						}
					});
				}

				// Extract the final HTML using jsdom
				let fragment = html.trim();
				try {
					const dom = new JSDOM(html);
					const renderedMd = dom.window.document.querySelector('#rendered-md');
					if (renderedMd) {
						// Remove all <pre class="joplin-source"> blocks
						const sourceBlocks = renderedMd.querySelectorAll('pre.joplin-source');
						sourceBlocks.forEach((el: any) => el.remove());
						fragment = renderedMd.innerHTML.trim();
					} else {
						fragment = html.trim();
					}
				} catch (err) {
					console.error('[copy-as-html] jsdom extraction error:', err);
				}

				// Copy to clipboard with error handling
				try {
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
                // Get selected markdown
                const selection = await joplin.commands.execute('editor.execCommand', { name: 'getSelection' });
                if (!selection) {
                    await joplin.views.dialogs.showToast({ message: 'No text selected.', type: ToastType.Info });
                    return;
                }

                // Get preservation settings
                const preserveSuperscript = await joplin.settings.value(SETTINGS.PRESERVE_SUPERSCRIPT);
                const preserveSubscript = await joplin.settings.value(SETTINGS.PRESERVE_SUBSCRIPT);
                const preserveEmphasis = await joplin.settings.value(SETTINGS.PRESERVE_EMPHASIS);
                const preserveBold = await joplin.settings.value(SETTINGS.PRESERVE_BOLD);
                const preserveHeading = await joplin.settings.value(SETTINGS.PRESERVE_HEADING);
                const hyperlinkBehavior = await joplin.settings.value(SETTINGS.HYPERLINK_BEHAVIOR) as 'title' | 'url' | 'markdown';

                // Use markdown-it to parse and render plain text
                const md = new MarkdownIt();
                const tokens = md.parse(selection, {});

                let plainText = renderPlainText(tokens, null, 0, {
                    preserveHeading,
                    preserveEmphasis,
                    preserveBold,
                    preserveSuperscript,
                    preserveSubscript,
                    hyperlinkBehavior
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