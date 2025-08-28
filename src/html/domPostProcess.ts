/**
 * @fileoverview DOM Post-processor for HTML Renderer
 *
 * This module handles all post-processing of the rendered HTML using JSDOM.
 * This includes:
 * - Cleaning up Joplin-specific resource links
 * - Future DOM transformations
 *
 * @author bwat47
 * @since 1.0.0
 */

/**
 * Post-processes the HTML using JSDOM to perform clean-up operations.
 * @param document The JSDOM document object to process.
 */
export function postProcessHtml(document: Document): void {
    // Clean up non-image Joplin resource links to be just their text content.
    // This handles links created by Joplin's rich text editor and markdown links.
    document.querySelectorAll('a[data-resource-id], a[href^=":/"], a[href^="joplin://resource/"]').forEach((link) => {
        // Don't modify links that contain images
        if (link.querySelector('img')) {
            return;
        }
        const textContent = link.textContent?.trim() || 'Resource';
        const textNode = document.createTextNode(textContent);
        link.parentNode?.replaceChild(textNode, link);
    });
}
