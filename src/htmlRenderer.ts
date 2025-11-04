/**
 * @fileoverview HTML Renderer - Converts markdown to clean, portable HTML
 *
 * This module orchestrates the conversion of Joplin markdown to portable HTML.
 * It uses several sub-modules to handle specific parts of the process:
 * - markdownSetup: Configures markdown-it with Joplin-compatible plugins.
 * - tokenImageCollector: Pre-scans tokens to collect image URLs outside code.
 * - assetProcessor: Builds a URL→dataURI map (with validation) and loads stylesheet.
 * - domPostProcess: Cleans the final HTML using DOMParser and DOMPurify, embeds images.
 *
 * @author bwat47
 * @since 1.0.16
 */

import { HtmlOptions } from './types';
import { loadHtmlSettings } from './settings';
import { createMarkdownItInstance } from './html/markdownSetup';
import { getUserStylesheet, buildImageEmbedMap } from './html/assetProcessor';
import { collectImageUrls } from './html/tokenImageCollector';
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
        options = await loadHtmlSettings();
    }
    const htmlOptions = options;

    // 2. Create and configure markdown-it instance
    const md = await createMarkdownItInstance();

    // 3. Token pre-scan to collect image URLs (markdown images + raw HTML <img>)
    const urls = collectImageUrls(md, selection);

    // 4. Async fetch/convert up front to build the embed map
    const imageSrcMap = await buildImageEmbedMap(urls, {
        embedImages: htmlOptions.embedImages,
        downloadRemoteImages: htmlOptions.downloadRemoteImages,
    });

    // 5. Render synchronously
    let html = md.render(selection);

    // 6. DOM pass: sanitize, normalize, and handle all <img> via imageSrcMap
    html = postProcessHtml(html, { imageSrcMap, stripJoplinImages: !htmlOptions.embedImages });

    let fragment = html.trim();

    // 7. Optionally wrap in a full HTML document
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
