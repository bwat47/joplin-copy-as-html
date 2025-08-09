import joplin from 'api';
import { SettingItemType } from 'api/types';
const removeMarkdown = require('remove-markdown');


const SETTINGS = {
	EMBED_IMAGES: 'embedImages',
};

const DEFAULTS = {
	[SETTINGS.EMBED_IMAGES]: true,
};

joplin.plugins.register({
	onStart: async function() {
		// Register settings
		await joplin.settings.registerSection('copyAsHtml', {
			label: 'Copy as HTML',
			iconName: 'fas fa-copy',
		});
		await joplin.settings.registerSettings({
			[SETTINGS.EMBED_IMAGES]: {
				value: true,
				type: SettingItemType.Bool, // Use the enum here
				section: 'copyAsHtml',
				public: true,
				label: 'Embed images as base64',
				description: 'If enabled, images in selection will be embedded as base64.',
			},
		});

		// Register command
		await joplin.commands.register({
			name: 'copyAsHtml',
			label: 'Copy selection as HTML',
			iconName: 'fas fa-copy',
			execute: async () => {

				// Get selected markdown
				const selection = await joplin.commands.execute('editor.execCommand', { name: 'getSelection' });
				if (!selection) {
					await joplin.views.dialogs.showMessageBox('No text selected.');
					return;
				}

				// Get user settings
				const embedImages = await joplin.settings.value(SETTINGS.EMBED_IMAGES);

				// Convert markdown to HTML

				const { MdToHtml } = await import('@joplin/renderer');
				// Minimal ResourceModel stub to prevent isResourceUrl error
				const ResourceModel = {
					isResourceUrl: (url) => typeof url === 'string' && url.startsWith(':/'),
					urlToId: (url) => url.replace(':/', ''),
					filename: () => '',
					isSupportedImageMimeType: (mime) => mime && mime.startsWith('image/'),
				};
				const mdToHtml = new MdToHtml({ ResourceModel });
				const renderOptions = {};
				const minimalTheme = {};
				const output = await mdToHtml.render(selection, minimalTheme, renderOptions);
				let html = output.html;

				// Embed images as base64 if enabled
				if (embedImages) {
					// Replace src attribute for Joplin resource images with base64 data
					const srcRegex = /(<img[^>]*src=["'])(:\/([a-zA-Z0-9]+))(["'][^>]*>)/g;
					html = await replaceAsync(html, srcRegex, async (match, pre, src, id, post) => {
						if (!id) return match;
						// Get resource info
						const resource = await joplin.data.get(['resources', id], { fields: ['id', 'mime'] });
						if (!resource || !resource.mime.startsWith('image/')) {
							console.warn('Resource not found or not an image:', id, resource);
							return match;
						}
						// Get image as base64 from resource file
						let dataUrl = '';
						try {
							console.log('[copy-as-html] Embedding image resource:', id);
							const fileObj = await joplin.data.get(['resources', id, 'file']);
							console.log('[copy-as-html] fileObj:', fileObj);
							let fileBuffer;
							if (fileObj && fileObj.body) {
								fileBuffer = fileObj.body;
							} else if (fileObj && fileObj.data) {
								fileBuffer = fileObj.data;
							} else if (fileObj && fileObj.content) {
								fileBuffer = fileObj.content;
							} else {
								fileBuffer = fileObj;
							}
							const base64 = Buffer.from(fileBuffer).toString('base64');
							dataUrl = `data:${resource.mime};base64,${base64}`;
							console.log('[copy-as-html] dataUrl:', dataUrl ? dataUrl.substring(0, 100) : dataUrl);
						} catch (err) {
							console.error('[copy-as-html] Error embedding image:', id, err);
						}
						if (!dataUrl || !dataUrl.startsWith('data:image')) {
							console.warn('[copy-as-html] No valid dataUrl for image:', id, dataUrl);
							return `${pre}about:blank${post}`;
						}
						// Replace src with base64 data
						return `${pre}${dataUrl}${post}`;
					});

					// Replace fallback [Image: :/resourceId] text with actual base64 image
					const fallbackRegex = /\[Image: :\/([a-zA-Z0-9]+)\]/g;
					html = await replaceAsync(html, fallbackRegex, async (match, id) => {
						if (!id) return match;
						// Get resource info
						const resource = await joplin.data.get(['resources', id], { fields: ['id', 'mime'] });
						if (!resource || !resource.mime.startsWith('image/')) {
							console.warn('Resource not found or not an image (fallback):', id, resource);
							return match;
						}
						let dataUrl = '';
						try {
							console.log('[copy-as-html] Embedding image resource (fallback):', id);
							const fileObj = await joplin.data.get(['resources', id, 'file']);
							console.log('[copy-as-html] fileObj (fallback):', fileObj);
							let fileBuffer;
							if (fileObj && fileObj.body) {
								fileBuffer = fileObj.body;
							} else if (fileObj && fileObj.data) {
								fileBuffer = fileObj.data;
							} else if (fileObj && fileObj.content) {
								fileBuffer = fileObj.content;
							} else {
								fileBuffer = fileObj;
							}
							const base64 = Buffer.from(fileBuffer).toString('base64');
							dataUrl = `data:${resource.mime};base64,${base64}`;
							console.log('[copy-as-html] dataUrl (fallback):', dataUrl ? dataUrl.substring(0, 100) : dataUrl);
						} catch (err) {
							console.error('[copy-as-html] Error embedding image (fallback):', id, err);
						}
						if (!dataUrl || !dataUrl.startsWith('data:image')) {
							console.warn('[copy-as-html] No valid dataUrl for image (fallback):', id, dataUrl);
							return `<img src="about:blank" alt="" />`;
						}
						// Insert a minimal img tag
						return `<img src="${dataUrl}" alt="" />`;
					});
				}



				// Extract only the inner HTML of <div id="rendered-md">
				let htmlContent = html.trim();
				const match = htmlContent.match(/<div id="rendered-md"[^>]*>([\s\S]*?)<\/div>/i);
				let fragment = match ? match[1].trim() : htmlContent;

				// Pass the extracted fragment directly to the clipboard as HTML
				await joplin.clipboard.writeHtml(fragment);
				await joplin.views.dialogs.showMessageBox('Copied selection as HTML!');

				// Helper: async replace for regex
				async function replaceAsync(str, regex, asyncFn) {
					const promises = [];
					str.replace(regex, (match, ...args) => {
						promises.push(asyncFn(match, ...args));
						return match;
					});
					const data = await Promise.all(promises);
					return str.replace(regex, () => data.shift());
				}
			},
		});

		// Register keyboard shortcut
		// Use MenuItemLocation from types
		const { MenuItemLocation } = await import('api/types');
		await joplin.views.menuItems.create('copyAsHtmlShortcut', 'copyAsHtml', MenuItemLocation.EditorContextMenu, {
			accelerator: 'Ctrl+Shift+C',
		});

		// Register plain text copy command and menu item
		await joplin.commands.register({
			name: 'copyAsPlainText',
			label: 'Copy selection as Plain Text',
			iconName: 'fas fa-copy',
			execute: async () => {
				const selection = await joplin.commands.execute('editor.execCommand', { name: 'getSelection' });
				if (!selection) {
					await joplin.views.dialogs.showMessageBox('No text selected.');
					return;
				}
				// Use remove-markdown to convert markdown to plain text, preserving list leaders
				const plainText = removeMarkdown(selection, { stripListLeaders: false });
				await joplin.clipboard.writeText(plainText);
				await joplin.views.dialogs.showMessageBox('Copied selection as Plain Text!');
			},
		});
		await joplin.views.menuItems.create('copyAsPlainTextShortcut', 'copyAsPlainText', MenuItemLocation.EditorContextMenu, {
			accelerator: 'Ctrl+Alt+C',
		});
	},
});
