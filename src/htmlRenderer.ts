/**
 * @fileoverview HTML Renderer - Converts markdown to clean, portable HTML
 *
 * This module orchestrates the conversion of Joplin markdown to portable HTML.
 * It uses several sub-modules to handle specific parts of the process:
 * - markdownSetup: Configures markdown-it with Joplin-compatible plugins.
 * - assetProcessor: Handles image embedding, dimension preservation, and stylesheets.
 * - domPostProcess: Cleans the final HTML using DOMParser.
 *
 * @author bwat47
 * @since 1.0.16
 */

import joplin from 'api';
import { SETTINGS } from './constants';
import { HtmlOptions } from './types';
import { validateHtmlSettings } from './utils';
import { createMarkdownItInstance } from './html/markdownSetup';
import {
    extractImageDimensions,
    applyPreservedDimensions,
    processEmbeddedImages,
    getUserStylesheet,
} from './html/assetProcessor';
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
    const htmlOptions =
        options ||
        validateHtmlSettings({
            embedImages: await joplin.settings.value(SETTINGS.EMBED_IMAGES),
            exportFullHtml: await joplin.settings.value(SETTINGS.EXPORT_FULL_HTML),
        });

    // 2. Pre-process markdown for assets (e.g., image dimensions)
    const { processedMarkdown, dimensions } = extractImageDimensions(selection, htmlOptions.embedImages);

    // 3. Create and configure markdown-it instance
    let debug = false;
    try {
        debug = await joplin.settings.value(SETTINGS.DEBUG);
    } catch {
        // ignore if setting unavailable (tests)
    }
    const md = await createMarkdownItInstance({ debug });
    let html = md.render(processedMarkdown);

    // 4. Post-process HTML for assets
    if (htmlOptions.embedImages) {
        // Re-apply preserved dimensions from HTML <img> tags
        html = applyPreservedDimensions(html, dimensions);
        // Embed Joplin resource images as base64
        html = await processEmbeddedImages(html, htmlOptions.embedImages);
    }

    // 5. Use DOMParser for advanced transformations
    html = postProcessHtml(html); // handles link cleaning, etc.

    let fragment = html.trim();

    // 6. Optionally wrap in a full HTML document
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
