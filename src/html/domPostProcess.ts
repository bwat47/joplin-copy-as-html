/**
 * @fileoverview DOM Post-processor for HTML Renderer
 *
 * This module handles all post-processing of the rendered HTML using DOMParser.
 * This includes:
 * - Cleaning up Joplin-specific resource links
 * - Future DOM transformations
 *
 * @author bwat47
 * @since 1.1.8
 */

/**
 * Post-processes the HTML using DOMParser to perform clean-up operations.
 * @param html The HTML string to process.
 * @returns The processed HTML string.
 */
export function postProcessHtml(html: string): string {
    // Check if we have any Joplin resource links to process
    const hasJoplinLinks = /(?:data-resource-id|href=["']?(?::|joplin:\/\/resource\/))/.test(html);
    if (!hasJoplinLinks) {
        return html; // Skip DOM processing if no Joplin links
    }

    const ParserCtor = (globalThis as unknown as { DOMParser?: { new (): DOMParser } }).DOMParser;
    if (!ParserCtor) return html;

    const parser = new ParserCtor();
    const doc = parser.parseFromString(`<body>${html}</body>`, 'text/html');

    // Clean up non-image Joplin resource links to be just their text content.
    // This handles links created by Joplin's rich text editor and markdown links.
    doc.querySelectorAll('a[data-resource-id], a[href^=":/"], a[href^="joplin://resource/"]').forEach((link) => {
        // Don't modify links that contain images
        if (link.querySelector('img')) {
            return;
        }
        const textContent = link.textContent?.trim() || 'Resource';
        const textNode = doc.createTextNode(textContent);
        link.parentNode?.replaceChild(textNode, link);
    });

    return doc.body.innerHTML;
}
