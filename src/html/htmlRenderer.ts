/**
 * @fileoverview HTML Renderer - Converts markdown to clean, portable HTML
 *
 * This module orchestrates the conversion of Joplin markdown to portable HTML.
 * It uses Joplin's built-in `renderMarkup` command (available in Joplin 3.2+)
 * and post-processes the result to handle sanitization and image embedding.
 */

import joplin from 'api';
import { HtmlOptions } from '../types';
import { loadHtmlSettings } from '../settings';
import { getUserStylesheet } from './assetProcessor';
import { postProcessHtml } from './domPostProcess';
import { logger } from '../logger';

// Joplin markup types (matching internal enum)
const MarkupLanguage = {
    Markdown: 1,
    Html: 2,
};

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

    logger.debug('Rendering markup via Joplin command...');

    // 2. Use Joplin's built-in renderMarkup command (requires Joplin 3.2+)
    // Returns an object: { html: string, pluginAssets: [], ... }
    const rendered = (await joplin.commands.execute('renderMarkup', MarkupLanguage.Markdown, selection)) as {
        html?: string;
    };
    const rawHtml = rendered?.html ?? '';

    if (!rawHtml) {
        logger.warn('renderMarkup returned empty result');
    }

    // 3. DOM pass: sanitize, normalize, and handle all processing (images, links, etc.)
    const html = await postProcessHtml(rawHtml, {
        embedImages: htmlOptions.embedImages,
        downloadRemoteImages: htmlOptions.downloadRemoteImages,
        convertSvgToPng: htmlOptions.embedSvgAsPng,
    });

    let fragment = html.trim();

    // 4. Optionally wrap in a full HTML document
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
