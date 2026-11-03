// Shared helpers for the DOM transforms in the post-processing pipeline.
// Transforms take the content root rather than its Document and query only its
// descendants. Stray <html>/<head>/<body> tags in the input merge their attributes
// onto the document's structural elements, so those must never be matched.

/**
 * Checks whether an element sits inside a code block or inline code, where
 * images are shown as written and must not be modified.
 * @param element - Element to check
 */
export function isInsideCode(element: Element): boolean {
    return !!element.closest('pre, code');
}

/**
 * Encodes SVG markup as a data URI.
 * @param svg - SVG markup
 */
export function svgToDataUri(svg: string): string {
    return `data:image/svg+xml;charset=utf-8,${encodeURIComponent(svg)}`;
}
