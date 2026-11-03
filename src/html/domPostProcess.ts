import { GITHUB_ALERT_MARKER_REGEX } from '../constants';
import { logger } from '../logger';
import type { HtmlOptions } from '../types';
import { renderAbcNotation } from './abcRenderer';
import {
    convertSvgImagesToPng,
    embedImagesInDom,
    replaceBrokenResourceSpans,
    stripJoplinImages,
} from './imageProcessor';
import { renderMath } from './mathRenderer';
import { renderMermaidDiagrams } from './mermaidRenderer';
import { sanitizeToRoot } from './sanitizer';

// ----------------------
// DOM Cleanup Helpers
// ----------------------
// Helpers take the content root rather than its Document and query only its
// descendants, so stray <html>/<head>/<body> attributes in the input are never matched.

/**
 * Removes non-image Joplin resource links and replaces them with their text content.
 * Links containing images are preserved.
 * @param root - Content root to process
 */
function stripJoplinLinks(root: HTMLElement): void {
    root.querySelectorAll('a[data-resource-id], a[href^=":/"], a[href^="joplin://resource/"]').forEach((link) => {
        // Don't modify links that contain images
        if (link.querySelector('img')) return;

        const text = link.textContent.trim() || 'Resource';
        link.replaceWith(root.ownerDocument.createTextNode(text));
    });
}

/**
 * Removes joplin-source elements that duplicate code block content.
 * renderMarkup includes both the raw source (for RTE round-tripping) and
 * the highlighted version - we only want the highlighted one.
 * @param root - Content root to process
 */
function removeJoplinSourceElements(root: HTMLElement): void {
    const sourceElements = root.querySelectorAll('.joplin-source');
    if (sourceElements.length > 0) {
        logger.debug(`Removing ${sourceElements.length} joplin-source elements`);
        sourceElements.forEach((el) => el.remove());
    }
}

/**
 * Disables all checkbox inputs to make them read-only in the exported HTML.
 * @param root - Content root to process
 */
function disableCheckboxes(root: HTMLElement): void {
    root.querySelectorAll('input[type="checkbox"]').forEach((checkbox) => {
        checkbox.setAttribute('disabled', 'disabled');
    });
}

/**
 * Wraps top-level images in paragraph tags for consistent formatting.
 * @param root - Content root to process
 */
function wrapTopLevelImages(root: HTMLElement): void {
    Array.from(root.children)
        .filter((el) => el.tagName === 'IMG')
        .forEach((img) => {
            const p = root.ownerDocument.createElement('p');
            img.replaceWith(p);
            p.appendChild(img);
        });
}

/**
 * Depth-first search for the first non-whitespace text node within `node`.
 * Used to locate the start of a blockquote's content (e.g. an alert marker),
 * skipping over wrapper elements and empty/whitespace-only text nodes.
 * @param node - Root node to search under.
 * @returns The first meaningful Text node, or null if none exists.
 */
function findFirstTextNode(node: Node): Text | null {
    for (const child of Array.from(node.childNodes)) {
        if (child.nodeType === 3 && child.textContent?.trim()) {
            return child as Text;
        }

        if (child.nodeType === 1) {
            const textNode = findFirstTextNode(child);
            if (textNode) return textNode;
        }
    }

    return null;
}

/**
 * Removes leading whitespace-only text nodes and `<br>` elements from `element`.
 * Run after stripping an alert marker so the residual blank line / line break it
 * left behind does not appear in the rendered blockquote.
 * @param element - Element whose leading empty nodes should be trimmed.
 */
function removeLeadingEmptyNodes(element: Element): void {
    while (element.firstChild) {
        const first = element.firstChild;
        const isEmptyText = first.nodeType === 3 && !first.textContent?.trim();
        const isLineBreak = first.nodeType === 1 && (first as Element).tagName === 'BR';

        if (!isEmptyText && !isLineBreak) break;

        first.remove();
    }
}

/**
 * Removes `element` when it is a now-empty `<p>` left behind by marker stripping.
 * Skips removal if the paragraph still holds visible text or embedded content
 * (images, inputs, tables, lists, or code) that has no text representation.
 * @param element - Candidate paragraph to remove.
 */
function removeIfEmptyParagraph(element: Element): void {
    if (element.tagName !== 'P') return;
    if (element.textContent.trim()) return;
    if (element.querySelector('img,input,table,ul,ol,pre,code')) return;

    element.remove();
}

/**
 * Strips a leading GitHub/Joplin alert marker (e.g. `[!note]`) from the start of
 * each blockquote's content, keeping any trailing title text. Cleans up the empty
 * text node and line break the marker leaves behind, and drops the wrapping
 * paragraph if it becomes empty.
 * @param root - Content root to process in place.
 */
function stripGithubAlertMarkers(root: HTMLElement): void {
    root.querySelectorAll('blockquote').forEach((blockquote) => {
        const firstText = findFirstTextNode(blockquote);
        if (!firstText?.textContent) return;

        const strippedText = firstText.textContent.replace(GITHUB_ALERT_MARKER_REGEX, '');
        if (strippedText === firstText.textContent) return;

        firstText.textContent = strippedText;

        const parentElement = firstText.parentElement;
        if (!parentElement) return;

        removeLeadingEmptyNodes(parentElement);
        removeIfEmptyParagraph(parentElement);
    });
}

// ----------------------
// Main Orchestrator
// ----------------------

/** The HTML options that affect post-processing. */
export type PostProcessOptions = Pick<HtmlOptions, 'embedImages' | 'downloadRemoteImages' | 'embedSvgAsPng'>;

/**
 * Post-processes rendered HTML with sanitization, resource cleanup, and image processing.
 * This is the only place that knows the order of the transforms; each transform
 * module documents what it needs to run before or after.
 *
 * @param html - Raw HTML string to process
 * @param opts - Processing configuration
 * @returns Sanitized and processed HTML string
 *
 * @remarks
 * Processing pipeline:
 * 1. Sanitize HTML with DOMPurify (removes scripts, dangerous attributes)
 * 2. Render KaTeX math, ABC notation, and Mermaid diagrams to SVG data URI images
 *    (math and ABC need the joplin-source elements)
 * 3. Remove duplicate joplin-source elements from code blocks
 * 4. Replace broken resource placeholders with error messages
 * 5. Strip GitHub alert markers from blockquote content
 * 6. Remove non-image Joplin resource links (:/... or joplin://resource/...)
 * 7. Disable checkbox inputs
 * 8. Strip Joplin images if embedding is disabled
 * 9. Embed images (local and remote) as base64 if enabled
 * 10. Wrap top-level images in paragraph tags for consistent formatting
 * 11. Convert SVG data URIs to PNG if enabled (requires Canvas API)
 */
export async function postProcessHtml(html: string, opts: PostProcessOptions): Promise<string> {
    const root = sanitizeToRoot(html);
    if (!root) return '';

    // Render rich content to images
    renderMath(root);
    renderAbcNotation(root);
    renderMermaidDiagrams(root);

    // Clean up Joplin-specific markup
    removeJoplinSourceElements(root);
    replaceBrokenResourceSpans(root);
    stripGithubAlertMarkers(root);
    stripJoplinLinks(root);
    disableCheckboxes(root);

    // Images
    if (!opts.embedImages) {
        stripJoplinImages(root);
    } else {
        await embedImagesInDom(root, opts.downloadRemoteImages);
    }

    wrapTopLevelImages(root);

    if (opts.embedSvgAsPng) {
        await convertSvgImagesToPng(root);
    }

    return root.innerHTML;
}
