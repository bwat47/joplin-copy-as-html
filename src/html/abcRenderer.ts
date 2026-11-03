import { renderAbc, type AbcVisualParams } from 'abcjs';

import { logger } from '../logger';
import { svgToDataUri } from './domHelpers';

/**
 * Renders ABC music notation to SVG images.
 * renderMarkup leaves each tune as source in a `.joplin-abc-notation` wrapper,
 * since Joplin renders them client-side in the viewer. The wrapper's
 * `.joplin-source` element holds the abcjs options as JSON in `data-abc-options`,
 * so this must run before those are removed.
 * abcjs measures text in the live document, so tunes are rendered into a hidden
 * container attached to the plugin's own document rather than the sanitized one.
 * Notation that abcjs cannot render stays as a code block.
 * @param root - Content root to process
 */
export function renderAbcNotation(root: HTMLElement): void {
    const editables = root.querySelectorAll('.joplin-abc-notation');
    if (editables.length === 0) return;

    const container = document.createElement('div');
    container.style.cssText = 'position: absolute; left: -10000px; top: 0; visibility: hidden;';
    document.body.appendChild(container);
    try {
        editables.forEach((editable) => {
            const rendered = editable.querySelector('.joplin-abc-notation-rendered');
            if (!rendered) return;

            let svg: SVGSVGElement | null;
            try {
                const optionsJson = editable.querySelector('.joplin-source')?.getAttribute('data-abc-options');
                const options = optionsJson ? (JSON.parse(optionsJson) as AbcVisualParams) : {};
                // Responsive output has no fixed size, which images need
                delete options.responsive;
                // Export the whole score in one image, including every music system.
                options.oneSvgPerLine = false;
                container.replaceChildren();
                renderAbc(container, rendered.textContent, options);
                svg = container.querySelector('svg');
                if (svg) normalizeAbcSvgSize(svg);
            } catch (err) {
                logger.warn('ABC notation could not be rendered', err);
                return;
            }
            if (!svg) return;

            const img = root.ownerDocument.createElement('img');
            img.setAttribute('src', svgToDataUri(new XMLSerializer().serializeToString(svg)));
            img.setAttribute('alt', svg.getAttribute('aria-label') ?? 'Sheet music');
            editable.replaceWith(img);
        });
    } finally {
        container.remove();
    }
}

/** Moves abcjs's CSS scale into the SVG viewport for standalone image sizing. */
function normalizeAbcSvgSize(svg: SVGSVGElement): void {
    // abcjs emits a uniform transform such as "scale(0.5,0.5)" for scaled scores.
    const match = /^scale\(([^,]+),([^)]+)\)$/.exec(svg.style.transform);
    if (!match) return;
    const scale = Number(match[1]);
    if (!Number.isFinite(scale) || scale <= 0 || scale !== Number(match[2])) return;

    const width = Number(svg.getAttribute('width'));
    const height = Number(svg.getAttribute('height'));
    // Below 1x, abcjs puts the scaled dimensions on the parent div instead.
    const displayWidth = width * Math.min(scale, 1);
    const displayHeight = height * Math.min(scale, 1);
    svg.setAttribute('width', String(displayWidth));
    svg.setAttribute('height', String(displayHeight));
    svg.setAttribute('viewBox', `0 0 ${displayWidth / scale} ${displayHeight / scale}`);
    svg.style.removeProperty('transform');
    svg.style.removeProperty('-webkit-transform');
    svg.style.removeProperty('-ms-transform');
}
