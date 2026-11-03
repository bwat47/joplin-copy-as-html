/**
 * Creates a content root for testing a single DOM transform.
 * Like the sanitized root in the pipeline, it is the `<body>` of a separate
 * document, so its elements are connected but not part of the test document.
 * @param html - HTML to place in the root
 */
export function createRoot(html: string): HTMLElement {
    const root = document.implementation.createHTMLDocument('').body;
    root.innerHTML = html;
    return root;
}

/**
 * Decodes the SVG markup of each SVG data URI image in `html`.
 * @param html - HTML containing `<img>` elements with SVG data URI sources
 */
export function decodeSvgImages(html: string): string[] {
    return Array.from(new DOMParser().parseFromString(html, 'text/html').querySelectorAll('img')).map((img) =>
        decodeURIComponent(img.getAttribute('src')?.split(',')[1] ?? '')
    );
}
