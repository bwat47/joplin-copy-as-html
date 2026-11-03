import { render as renderMermaid } from 'pele';

import { logger } from '../logger';
import { svgToDataUri } from './domHelpers';

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
            svg = renderMermaid(pre.textContent).svg;
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
