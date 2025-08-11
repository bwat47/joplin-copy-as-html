import joplin from 'api';
import { SettingItemType, ToastType } from 'api/types';




const SETTINGS = {
	EMBED_IMAGES: 'embedImages',
	PRESERVE_SUPERSCRIPT: 'preserveSuperscript',
	PRESERVE_SUBSCRIPT: 'preserveSubscript',
	PRESERVE_EMPHASIS: 'preserveEmphasis',
	PRESERVE_BOLD: 'preserveBold',
	PRESERVE_HEADING: 'preserveHeading',
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
					await joplin.views.dialogs.showToast({ message: 'No text selected.', type: ToastType.Info });
					return;
				}


				// Use Joplin global settings for subscript, superscript, and soft breaks rendering
			const globalSubEnabled = await joplin.settings.globalValue('markdown.plugin.sub');
			const globalSupEnabled = await joplin.settings.globalValue('markdown.plugin.sup');
			const globalMarkEnabled = await joplin.settings.globalValue('markdown.plugin.mark');
			const globalSoftBreaksEnabled = await joplin.settings.globalValue('markdown.plugin.softbreaks');
				const embedImages = await joplin.settings.value(SETTINGS.EMBED_IMAGES);

				// If soft breaks are disabled, force hard breaks by converting single newlines to two spaces + newline
				if (!globalSoftBreaksEnabled) {
					selection = selection.replace(/([^\n])\n(?!\n)/g, '$1  \n');
				}

				// Convert markdown to HTML
				const { MdToHtml } = await import('@joplin/renderer');
				const ResourceModel = {
					isResourceUrl: (url) => typeof url === 'string' && url.startsWith(':/'),
					urlToId: (url) => url.replace(':/', ''),
					filename: () => '',
					isSupportedImageMimeType: (mime) => mime && mime.startsWith('image/'),
				};
			// Build pluginOptions to disable sub/sup plugins if needed
	let pluginOptions: any = {};
	if (!globalSubEnabled) pluginOptions.sub = { enabled: false };
	if (!globalSupEnabled) pluginOptions.sup = { enabled: false };
	if (!globalMarkEnabled) pluginOptions.mark = { enabled: false };
	const mdToHtml = new MdToHtml({ ResourceModel, pluginOptions });
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
						let resource;
						try {
							resource = await joplin.data.get(['resources', id], { fields: ['id', 'mime'] });
						} catch (err) {
							// Resource not found
							return `<span style="color: red; font-style: italic;">Resource ID “:/${id}” could not be found.</span>`;
						}
						if (!resource || !resource.mime.startsWith('image/')) {
							return `<span style="color: red; font-style: italic;">Resource ID “:/${id}” could not be found.</span>`;
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
							// File fetch failed
							return `<span style="color: red; font-style: italic;">Resource ID “:/${id}” could not be found.</span>`;
						}
						if (!imgDataUrl || !imgDataUrl.startsWith('data:image')) {
							return `<span style="color: red; font-style: italic;">Resource ID “:/${id}” could not be found.</span>`;
						}
						return `${pre}${imgDataUrl}${post}`;
					});

					// Replace fallback [Image: :/resourceId] text with actual base64 image
					const fallbackRegex = /\[Image: :\/([a-zA-Z0-9]+)\]/g;
					html = await replaceAsync(html, fallbackRegex, async (match, id) => {
						if (!id) return match;
						let resource;
						try {
							resource = await joplin.data.get(['resources', id], { fields: ['id', 'mime'] });
						} catch (err) {
							// Resource not found
							return `<span style="color: red; font-style: italic;">Resource ID “:/${id}” could not be found.</span>`;
						}
						if (!resource || !resource.mime.startsWith('image/')) {
							return `<span style="color: red; font-style: italic;">Resource ID “:/${id}” could not be found.</span>`;
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
							// File fetch failed
							return `<span style="color: red; font-style: italic;">Resource ID “:/${id}” could not be found.</span>`;
						}
						if (!imgDataUrl || !imgDataUrl.startsWith('data:image')) {
							return `<span style="color: red; font-style: italic;">Resource ID “:/${id}” could not be found.</span>`;
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
				await joplin.views.dialogs.showToast({ message: 'Copied selection as HTML!', type: ToastType.Success });

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
					await joplin.views.dialogs.showToast({ message: 'No text selected.', type: ToastType.Info });
					return;
				}

				// Get preservation settings
				const preserveSuperscript = await joplin.settings.value(SETTINGS.PRESERVE_SUPERSCRIPT);
				const preserveSubscript = await joplin.settings.value(SETTINGS.PRESERVE_SUBSCRIPT);
				const preserveEmphasis = await joplin.settings.value(SETTINGS.PRESERVE_EMPHASIS);
				const preserveBold = await joplin.settings.value(SETTINGS.PRESERVE_BOLD);
				const preserveHeading = await joplin.settings.value(SETTINGS.PRESERVE_HEADING);

				// Use markdown-it to parse and render plain text
				const MarkdownIt = require('markdown-it');
				const md = new MarkdownIt();
				const tokens = md.parse(selection, {});

				// Helper: Remove backslash escapes
				function unescape(text) {
					return text.replace(/\\([*_~^`#])/g, '$1');
				}


				// Recursively process tokens for plain text extraction
				function renderPlainText(tokens, listContext = null) {
					let result = '';
					let orderedIndex = listContext && listContext.type === 'ordered' ? listContext.index : 1;
					for (let i = 0; i < tokens.length; i++) {
						const t = tokens[i];
						if (t.type === 'fence' || t.type === 'code_block') {
							result += t.content;
							// Add paragraph break if next token is paragraph/text/inline/code block/inline code
							const next = tokens[i+1];
							if (next && (
								next.type === 'paragraph_open' ||
								next.type === 'inline' ||
								next.type === 'text' ||
								next.type === 'fence' ||
								next.type === 'code_block' ||
								next.type === 'code_inline')) {
								result += '\n\n';
							}
						} else if (t.type === 'code_inline') {
							result += t.content;
							// Do NOT add paragraph break after inline code
						} else if (t.type === 'inline' && t.children) {
							result += renderPlainText(t.children, listContext);
						} else if (t.type === 'heading_open') {
							if (preserveHeading) {
								result += '#'.repeat(parseInt(t.tag[1])) + ' ';
							}
						} else if (t.type === 'heading_close') {
							result += '\n\n';
						} else if (t.type === 'bullet_list_open') {
							// Enter bullet list context
							let subTokens = [];
							let depth = 1;
							for (let j = i + 1; j < tokens.length; j++) {
								if (tokens[j].type === 'bullet_list_open') depth++;
								if (tokens[j].type === 'bullet_list_close') depth--;
								if (depth === 0) break;
								subTokens.push(tokens[j]);
							}
							result += renderPlainText(subTokens, { type: 'bullet' });
							// Skip processed tokens
							i += subTokens.length;
						} else if (t.type === 'ordered_list_open') {
							// Enter ordered list context
							let subTokens = [];
							let depth = 1;
							let start = t.attrs && t.attrs.find(a => a[0] === 'start') ? parseInt(t.attrs.find(a => a[0] === 'start')[1]) : 1;
							let idx = start;
							for (let j = i + 1; j < tokens.length; j++) {
								if (tokens[j].type === 'ordered_list_open') depth++;
								if (tokens[j].type === 'ordered_list_close') depth--;
								if (depth === 0) break;
								// Mark each list_item_open with its index
								if (tokens[j].type === 'list_item_open') tokens[j].orderedIndex = idx++;
								subTokens.push(tokens[j]);
							}
							result += renderPlainText(subTokens, { type: 'ordered' });
							i += subTokens.length;
						} else if (t.type === 'list_item_open') {
							if (listContext && listContext.type === 'ordered') {
								// Use the index for ordered lists
								let idx = t.orderedIndex || orderedIndex;
								result += idx + '. ';
								orderedIndex = idx + 1;
							} else {
								result += '- ';
							}
						} else if (t.type === 'em_open') {
							if (preserveEmphasis) result += t.markup;
						} else if (t.type === 'em_close') {
							if (preserveEmphasis) result += t.markup;
						} else if (t.type === 'strong_open') {
							if (preserveBold) result += t.markup;
						} else if (t.type === 'strong_close') {
							if (preserveBold) result += t.markup;
						} else if (t.type === 'text') {
							let txt = t.content;
							if (preserveSuperscript) {
								txt = txt.replace(/\^([^\^]+)\^/g, '^$1^');
							} else {
								txt = txt.replace(/\^([^\^]+)\^/g, '$1');
							}
							if (preserveSubscript) {
								txt = txt.replace(/~([^~]+)~/g, '~$1~');
							} else {
								txt = txt.replace(/~([^~]+)~/g, '$1');
							}
							txt = unescape(txt);
							txt = txt.replace(/\u00A0|&nbsp;/g, '');
							result += txt;
						} else if (t.type === 'softbreak' || t.type === 'hardbreak') {
							result += '\n';
						} else if (t.type === 'paragraph_close') {
							result += '\n\n';
						}
					}
					return result;
				}

				let plainText = renderPlainText(tokens);
				// Remove HTML <img> tags
				plainText = plainText.replace(/<img[^>]*>/gi, '');
				// Remove markdown image embeds ![](:/resourceId)
				plainText = plainText.replace(/!\[[^\]]*\]\(:\/[a-zA-Z0-9]+\)/g, '');
				// Collapse 3+ consecutive newlines to 2
				plainText = plainText.replace(/\n{3,}/g, '\n\n');
				// Debug: Show extracted plain text in a toast (truncate if long)
				// await joplin.views.dialogs.showToast({ message: 'Extracted: ' + (plainText.length > 100 ? plainText.slice(0, 100) + '...' : plainText), type: ToastType.Info });
				if (!plainText.trim()) {
					await joplin.clipboard.writeText(selection);
				} else {
					await joplin.clipboard.writeText(plainText);
				}
				await joplin.views.dialogs.showToast({ message: 'Copied selection as Plain Text!', type: ToastType.Success });
			},
		});
		await joplin.views.menuItems.create('copyAsPlainTextShortcut', 'copyAsPlainText', MenuItemLocation.EditorContextMenu, {
			accelerator: 'Ctrl+Alt+C',
		});
	},
});
