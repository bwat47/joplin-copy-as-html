import joplin from 'api';
import { SettingItemType } from 'api/types';
const removeMarkdown = require('remove-markdown');


const SETTINGS = {
	EMBED_IMAGES: 'embedImages',
	FORCE_HARD_BREAKS: 'forceHardBreaks',
};

const DEFAULTS = {
	[SETTINGS.EMBED_IMAGES]: true,
	[SETTINGS.FORCE_HARD_BREAKS]: true,
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
				value: true, // Default to true
				type: SettingItemType.Bool, // Use the enum here
				section: 'copyAsHtml',
				public: true,
				label: 'Embed images as base64',
				description: 'If enabled, images in selection will be embedded as base64.',
			},
			[SETTINGS.FORCE_HARD_BREAKS]: {
				value: true,
				type: SettingItemType.Bool,
				section: 'copyAsHtml',
				public: true,
				label: 'Force hard breaks',
				description: 'If enabled, single newlines in markdown will be rendered as hard breaks (HTML <br>).',
			},
		});

		// Register command
		await joplin.commands.register({
			name: 'copyAsHtml',
			label: 'Copy selection as HTML',
			iconName: 'fas fa-copy',
			when: 'markdownEditorVisible',
			execute: async () => {

				// Get selected markdown
				let selection = await joplin.commands.execute('editor.execCommand', { name: 'getSelection' });
				if (!selection) {
					await joplin.views.dialogs.showMessageBox('No text selected.');
					return;
				}

				const forceHardBreaks = await joplin.settings.value(SETTINGS.FORCE_HARD_BREAKS);
				if (forceHardBreaks) {
					// Preprocess: convert soft breaks (single newlines within paragraphs) to hard breaks (two spaces + newline)
					// Only convert single newlines that are not surrounded by empty lines
					selection = selection.replace(/([^\n])\n(?!\n)/g, '$1  \n');
				}

				const embedImages = await joplin.settings.value(SETTINGS.EMBED_IMAGES);

				// Convert markdown to HTML
				const { MdToHtml } = await import('@joplin/renderer');
				const ResourceModel = {
					isResourceUrl: (url) => typeof url === 'string' && url.startsWith(':/'),
					urlToId: (url) => url.replace(':/', ''),
					filename: () => '',
					isSupportedImageMimeType: (mime) => mime && mime.startsWith('image/'),
				};
				const mdToHtml = new MdToHtml({ ResourceModel });
				const renderOptions = {};
				const theme = {};
				const output = await mdToHtml.render(selection, theme, renderOptions);
				let html = output.html;

				// Embed images as base64 if enabled
				if (embedImages) {
					// Replace src attribute for Joplin resource images with base64 data
					const srcRegex = /(<img[^>]*src=["'])(:\/([a-zA-Z0-9]+))(["'][^>]*>)/g;
					html = await replaceAsync(html, srcRegex, async (match, pre, src, id, post) => {
						if (!id) return match;
						const resource = await joplin.data.get(['resources', id], { fields: ['id', 'mime'] });
						if (!resource || !resource.mime.startsWith('image/')) {
							console.warn('Resource not found or not an image:', id, resource);
							return match;
						}
						let imgDataUrl = '';
						try {
							const fileObj = await joplin.data.get(['resources', id, 'file']);
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
							imgDataUrl = `data:${resource.mime};base64,${base64}`;

						} catch (err) {
							console.error('[copy-as-html] Error embedding image:', id, err);
						}
						if (!imgDataUrl || !imgDataUrl.startsWith('data:image')) {
							console.warn('[copy-as-html] No valid dataUrl for image:', id, imgDataUrl);
							return `${pre}about:blank${post}`;
						}
						return `${pre}${imgDataUrl}${post}`;
					});

					// Replace fallback [Image: :/resourceId] text with actual base64 image
					const fallbackRegex = /\[Image: :\/([a-zA-Z0-9]+)\]/g;
					html = await replaceAsync(html, fallbackRegex, async (match, id) => {
						if (!id) return match;
						const resource = await joplin.data.get(['resources', id], { fields: ['id', 'mime'] });
						if (!resource || !resource.mime.startsWith('image/')) {
							console.warn('Resource not found or not an image (fallback):', id, resource);
							return match;
						}
						let imgDataUrl = '';
						try {
							const fileObj = await joplin.data.get(['resources', id, 'file']);
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
							imgDataUrl = `data:${resource.mime};base64,${base64}`;

						} catch (err) {
							console.error('[copy-as-html] Error embedding image (fallback):', id, err);
						}
						if (!imgDataUrl || !imgDataUrl.startsWith('data:image')) {
							console.warn('[copy-as-html] No valid dataUrl for image (fallback):', id, imgDataUrl);
							return `<img src="about:blank" alt="" />`;
						}
						return `<img src="${imgDataUrl}" alt="" />`;
					});
				}

				// Use jsdom to robustly extract the inner HTML of <div id="rendered-md">
				const { JSDOM } = require('jsdom');
				let fragment = html.trim();
				try {
					const dom = new JSDOM(html);
					const renderedMd = dom.window.document.querySelector('#rendered-md');
					if (renderedMd) {
						// Remove all <pre class="joplin-source"> blocks
						const sourceBlocks = renderedMd.querySelectorAll('pre.joplin-source');
						sourceBlocks.forEach(el => el.remove());
						fragment = renderedMd.innerHTML.trim();
					} else {
						fragment = html.trim();
					}

				} catch (err) {
					console.error('[copy-as-html] jsdom extraction error:', err);
				}

				// Pass the cleaned fragment directly to the clipboard as HTML
				await joplin.clipboard.writeHtml(fragment);
				await joplin.views.dialogs.showToast({ message: 'Copied selection as HTML!' });

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
			when: 'markdownEditorVisible',
			execute: async () => {
				const selection = await joplin.commands.execute('editor.execCommand', { name: 'getSelection' });
				if (!selection) {
					await joplin.views.dialogs.showMessageBox('No text selected.');
					return;
				}
				// Use remove-markdown to convert markdown to plain text, preserving list leaders
				// Preserve code blocks and inline code by replacing them with robust placeholders
				let codeBlocks = [];
				let inlineCodes = [];
				let text = selection;

				// Use unique placeholder strings
				function makePlaceholder(type, idx) {
					return `@@JOPLIN_${type}_${idx}@@`;
				}

				// Extract code blocks (```...```) and preserve full block including backticks
				text = text.replace(/```[\s\S]*?```/g, (match) => {
					const placeholder = makePlaceholder('CODEBLOCK', codeBlocks.length);
					codeBlocks.push(match);
					return placeholder;
				});

				// Extract inline code (`...`) and preserve full match including backticks
				text = text.replace(/`[^`]+`/g, (match) => {
					const placeholder = makePlaceholder('INLINECODE', inlineCodes.length);
					inlineCodes.push(match);
					return placeholder;
				});

				// Remove markdown from the rest
				let plainText = removeMarkdown(text, { stripListLeaders: false });

				// Restore code blocks
				codeBlocks.forEach((code, idx) => {
					const placeholder = makePlaceholder('CODEBLOCK', idx);
					plainText = plainText.replace(new RegExp(placeholder, 'g'), code);
				});
				// Restore inline code
				inlineCodes.forEach((code, idx) => {
					const placeholder = makePlaceholder('INLINECODE', idx);
					plainText = plainText.replace(new RegExp(placeholder, 'g'), code);
				});

				// Split into segments: code blocks, inline code, and normal text using a combined regex
				const combinedRegex = /```[\s\S]*?```|`[^`]+`/g;
				let segments = [];
				let lastIndex = 0;
				plainText.replace(combinedRegex, (match, offset) => {
					if (offset > lastIndex) {
						segments.push({ type: 'text', value: plainText.slice(lastIndex, offset) });
					}
					segments.push({ type: 'code', value: match });
					lastIndex = offset + match.length;
					return match;
				});
				if (lastIndex < plainText.length) {
					segments.push({ type: 'text', value: plainText.slice(lastIndex) });
				}
				// Apply unescaping only to non-code segments
				const unescape = s => s
					.replace(/\\/g, '\\')      // double backslash to single
					.replace(/\\([^\w])/g, '$1'); // remove backslash before any non-word character
				const result = segments.map(seg => seg.type === 'text' ? unescape(seg.value) : seg.value).join('');
				// Remove backticks from code segments
				const stripCodeTicks = seg => {
					// Code block: starts and ends with triple backticks
					if (/^```[\s\S]*```$/.test(seg)) {
						// Remove leading/trailing triple backticks and newlines
						return seg.replace(/^```\n?/, '').replace(/\n?```$/, '');
					}
					// Inline code: starts and ends with single backtick
					if (/^`[^`]+`$/.test(seg)) {
						return seg.slice(1, -1);
					}
					return seg;
				};
				const finalResult = segments.map(seg => seg.type === 'text' ? unescape(seg.value) : stripCodeTicks(seg.value)).join('');
				await joplin.clipboard.writeText(finalResult);
				await joplin.views.dialogs.showToast({ message: 'Copied selection as Plain Text!' });
			},
		});
		await joplin.views.menuItems.create('copyAsPlainTextShortcut', 'copyAsPlainText', MenuItemLocation.EditorContextMenu, {
			accelerator: 'Ctrl+Alt+C',
		});
	},
});
