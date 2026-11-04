import { render as renderMermaid, type MathMarkup } from 'pele';

import { logger } from '../logger';
import { svgToDataUri } from './domHelpers';
import { renderTexToSvg } from './texRenderer';

/**
 * Typesets `$$...$$` in diagram labels as self-contained MathJax SVG, which
 * pele nests directly in the diagram SVG. Returning null makes pele show the
 * TeX source instead.
 */
function renderLabelMath(tex: string, size: number): MathMarkup | null {
    try {
        const { svg, width, height } = renderTexToSvg(tex, true, size);
        return { svg, width, height };
    } catch (err) {
        logger.warn('Mermaid label math could not be rendered', err);
        return null;
    }
}

/**
 * Renders Mermaid diagrams to SVG images.
 * renderMarkup leaves diagrams as `<pre class="mermaid">` source inside a
 * `.joplin-editable` wrapper, since Joplin renders them client-side in the viewer.
 * Each diagram that pele can render replaces its wrapper with an SVG data URI
 * image; diagrams that fail to render stay as code blocks.
 * @param root - Content root to process
 */
export function renderMermaidDiagrams(root: HTMLElement): void {
    root.querySelectorAll('pre.mermaid').forEach((pre) => {
        let svg: string;
        try {
            svg = renderMermaid(pre.textContent, { math: renderLabelMath }).svg;
        } catch (err) {
            logger.warn('Mermaid diagram could not be rendered', err);
            return;
        }

        const img = root.ownerDocument.createElement('img');
        img.setAttribute('src', svgToDataUri(svg));
        img.setAttribute('alt', 'Mermaid diagram');
        (pre.closest('.joplin-editable') ?? pre).replaceWith(img);
    });
}
