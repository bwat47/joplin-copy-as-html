/**
 * @fileoverview HTML Renderer - Converts markdown to clean, portable HTML
 *
 * This module orchestrates the conversion of Joplin markdown to portable HTML.
 * It uses several sub-modules to handle specific parts of the process:
 * - markdownSetup: Configures markdown-it with Joplin-compatible plugins.
 * - imagePreProcessor: Performs all async image work up front (Joplin resources and remote),
 *   skipping code segments and operating only on image contexts; preserves titles/attrs.
 * - assetProcessor: Converts Joplin resources to base64 (with validation) and loads stylesheet.
 * - domPostProcess: Cleans the final HTML using DOMParser and DOMPurify.
 *
 * @author bwat47
 * @since 1.0.16
 */

import joplin from 'api';
import { SETTINGS } from './constants';
import { HtmlOptions } from './types';
import { validateHtmlSettings } from './utils';
import { createMarkdownItInstance } from './html/markdownSetup';
import { getUserStylesheet, buildImageEmbedMap } from './html/assetProcessor';
import { collectImageUrls } from './html/tokenImageCollector';
import { installImageSwapRule } from './html/imageRendererRule';
import { postProcessHtml } from './html/domPostProcess';

/**
 * Converts a markdown selection to processed HTML.
 * This includes embedding images as base64, preserving image dimensions,
 * and cleaning the final HTML for portability.
 * @param selection The markdown string selected by the user.
 * @param options HTML processing options, including embedImages and exportFullHtml settings.
 * @returns A promise that resolves to the final HTML string (either a fragment or a full document).
 */
export async function processHtmlConversion(selection: string, options?: HtmlOptions): Promise<string> {
    // 1. Get settings if not provided
    if (!options) {
        const embedImages = await joplin.settings.value(SETTINGS.EMBED_IMAGES);
        const exportFullHtml = await joplin.settings.value(SETTINGS.EXPORT_FULL_HTML);
        const downloadRemoteImages = await joplin.settings.value(SETTINGS.DOWNLOAD_REMOTE_IMAGES);

        options = validateHtmlSettings({
            embedImages,
            exportFullHtml,
            downloadRemoteImages,
        });
    }
    const htmlOptions = options;

    // 2. Create and configure markdown-it instance
    let debug = false;
    try {
        debug = await joplin.settings.value(SETTINGS.DEBUG);
    } catch {
        // ignore if setting unavailable (tests)
    }
    const md = await createMarkdownItInstance({ debug });

    // 3. Token pre-scan to collect image URLs (markdown images + raw HTML <img>)
    const urls = collectImageUrls(md, selection);

    // 4. Async fetch/convert up front to build the embed map
    const imageSrcMap = await buildImageEmbedMap(urls, {
        embedImages: htmlOptions.embedImages,
        downloadRemoteImages: htmlOptions.downloadRemoteImages,
    });

    // 5. Install renderer rule for markdown image tokens
    installImageSwapRule(md, imageSrcMap, htmlOptions);

    // 6. Render synchronously
    let html = md.render(selection);

    // 7. DOM pass for raw HTML <img> (and anchor cleanup, sanitization)
    html = postProcessHtml(html, { imageSrcMap, stripJoplinImages: !htmlOptions.embedImages });

    let fragment = html.trim();

    // 8. Optionally wrap in a full HTML document
    if (htmlOptions.exportFullHtml) {
        const stylesheet = await getUserStylesheet();
        fragment = `<!DOCTYPE html>
<html>
<head>
<meta charset="UTF-8">
<style type="text/css">
${stylesheet}
</style>
</head>
<body>
${fragment}
</body>
</html>`;
    }

    return fragment;
}
