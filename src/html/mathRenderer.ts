import { logger } from '../logger';
import { svgToDataUri } from './domHelpers';
import { renderTexToSvg } from './texRenderer';

/**
 * Renders KaTeX math to SVG images.
 * renderMarkup outputs KaTeX HTML, which needs KaTeX's stylesheet and fonts to
 * display correctly. Each `.joplin-editable` wrapper also holds the TeX source in
 * a `.joplin-source` element, so this must run before those are removed.
 * Math that MathJax cannot render is replaced with its source as code.
 * @param root - Content root to process
 */
export function renderMath(root: HTMLElement): void {
    root.querySelectorAll('.joplin-editable').forEach((editable) => {
        if (!editable.querySelector('.katex')) return;
        const tex = editable.querySelector('.joplin-source')?.textContent ?? '';
        const display = !!editable.querySelector('.katex-display');
        const doc = root.ownerDocument;

        let replacement: HTMLElement;
        try {
            const { svg, width, height, verticalAlign } = renderTexToSvg(tex, display);
            const img = doc.createElement('img');
            img.setAttribute('src', svgToDataUri(svg));
            img.setAttribute('alt', tex);
            img.setAttribute('width', String(width));
            img.setAttribute('height', String(height));
            img.style.verticalAlign = `${verticalAlign}px`;
            if (display) {
                replacement = doc.createElement('p');
                replacement.style.textAlign = 'center';
                replacement.appendChild(img);
            } else {
                replacement = img;
            }
        } catch (err) {
            logger.warn('Math could not be rendered', err);
            const code = doc.createElement('code');
            code.textContent = display ? `$$\n${tex}\n$$` : `$${tex}$`;
            if (display) {
                replacement = doc.createElement('pre');
                replacement.appendChild(code);
            } else {
                replacement = code;
            }
        }
        editable.replaceWith(replacement);
    });
}
