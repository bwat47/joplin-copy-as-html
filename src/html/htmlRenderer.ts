import joplin from 'api';
import { logger } from '../logger';
import type { HtmlOptions } from '../types';
import { hasProperty } from '../utils';
import { postProcessHtml } from './domPostProcess';
import { getUserStylesheet } from './stylesheet';

// Joplin markup types (matching internal enum)
const MarkupLanguage = {
    Markdown: 1,
    Html: 2,
};

/**
 * Renders Markdown through Joplin's `renderMarkup` command (requires Joplin 3.2+),
 * then sanitizes the HTML and processes images according to the supplied options.
 * Full document exports include the user stylesheet or the bundled default.
 * @param selection - The markdown string selected by the user.
 * @param options - HTML processing options, including embedImages and exportFullHtml settings.
 * @returns A promise that resolves to the final HTML string (either a fragment or a full document).
 */
export async function processHtmlConversion(selection: string, options: HtmlOptions): Promise<string> {
    logger.debug('Rendering markup via Joplin command...');

    // 1. Use Joplin's built-in renderMarkup command (requires Joplin 3.2+)
    // Returns an object: { html: string, pluginAssets: [], ... }
    const rendered: unknown = await joplin.commands.execute(
        'renderMarkup',
        MarkupLanguage.Markdown,
        selection,
        null, // rendererOptions (unused)
        { bodyOnly: true } // renderOptions
    );
    const rawHtml = hasProperty(rendered, 'html') && typeof rendered.html === 'string' ? rendered.html : '';

    if (!rawHtml) {
        logger.warn('renderMarkup returned empty result');
    }

    // 2. DOM pass: sanitize, normalize, and handle all processing (images, links, etc.)
    const html = await postProcessHtml(rawHtml, options);

    let fragment = html.trim();

    // 3. Optionally wrap in a full HTML document
    if (options.exportFullHtml) {
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
