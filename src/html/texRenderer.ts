import { MathJaxMhchemFontExtension } from '@mathjax/mathjax-mhchem-font-extension/js/svg.js';
import { MathJaxTexFont } from '@mathjax/mathjax-tex-font/js/svg.js';
import { LiteElement } from '@mathjax/src/js/adaptors/lite/Element.js';
import { liteAdaptor, type LiteAdaptor } from '@mathjax/src/js/adaptors/liteAdaptor.js';
import type { MathDocument } from '@mathjax/src/js/core/MathDocument.js';
import { RegisterHTMLHandler } from '@mathjax/src/js/handlers/html.js';
import { TeX } from '@mathjax/src/js/input/tex.js';

import '@mathjax/src/js/input/tex/ams/AmsConfiguration.js';
import '@mathjax/src/js/input/tex/base/BaseConfiguration.js';
import '@mathjax/src/js/input/tex/boldsymbol/BoldsymbolConfiguration.js';
import '@mathjax/src/js/input/tex/cancel/CancelConfiguration.js';
import '@mathjax/src/js/input/tex/color/ColorConfiguration.js';
import '@mathjax/src/js/input/tex/mhchem/MhchemConfiguration.js';
import '@mathjax/src/js/input/tex/newcommand/NewcommandConfiguration.js';

import { mathjax } from '@mathjax/src/js/mathjax.js';
import { SVG } from '@mathjax/src/js/output/svg.js';

// MathJax measures in units of 1/1000 em. KaTeX renders math at 1.21x the
// surrounding text, which is about 18px at typical 15px body text.
const EM_PX = 18;
const UNITS_PER_EM = 1000;

export interface TexSvg {
    svg: string;
    width: number;
    height: number;
    /** Offset of the image's bottom edge from the text baseline, in px */
    verticalAlign: number;
}

interface Converter {
    adaptor: LiteAdaptor;
    doc: MathDocument<unknown, unknown, unknown>;
    ex: number;
}

let converter: Converter | null = null;

/**
 * Creates the MathJax document on first use.
 * Uses the TeX font, which has the same glyph style as KaTeX and needs no
 * dynamically loaded font files, so it works inside the bundled plugin.
 */
function getConverter(): Converter {
    if (converter) return converter;

    MathJaxTexFont.addExtension(MathJaxMhchemFontExtension);
    const adaptor = liteAdaptor();
    RegisterHTMLHandler(adaptor);
    // fontCache 'none' draws every glyph as a path, so the SVG needs no fonts or shared <defs>
    const outputJax = new SVG({ fontData: MathJaxTexFont, fontCache: 'none', linebreaks: { inline: false } });
    const doc = mathjax.document('', {
        InputJax: new TeX({
            packages: ['base', 'ams', 'newcommand', 'boldsymbol', 'color', 'cancel', 'mhchem'],
            // Throw instead of rendering the error as red math, so callers can fall back to the source
            formatError: (_jax: unknown, err: Error) => {
                throw err;
            },
        }),
        OutputJax: outputJax,
    });
    // Match conversion metrics to the final pixel size so responsive SVG transforms
    // and the fixed viewport use the same scale.
    converter = { adaptor, doc, ex: EM_PX * outputJax.font.params.x_height };
    return converter;
}

/**
 * Parses a MathJax dimension in ex units.
 * @example exValue('-2.159ex') returns -2.159
 */
function exValue(value: string | undefined): number {
    const trimmed = value?.trim() ?? '';
    const number = Number(trimmed.slice(0, -2));
    if (trimmed.length <= 2 || !trimmed.endsWith('ex') || !Number.isFinite(number)) {
        throw new Error(`Unexpected MathJax dimension: ${value}`);
    }
    return number;
}

/**
 * Renders TeX to a standalone SVG sized in px.
 * @param tex - TeX source without delimiters
 * @param display - Whether to render as display (block) math
 * @returns SVG markup and its size and baseline offset in px
 * @throws Error when the TeX is invalid or uses unsupported commands
 */
export function renderTexToSvg(tex: string, display: boolean): TexSvg {
    const { adaptor, doc, ex } = getConverter();
    const container = doc.convert(tex, { display, em: EM_PX, ex }) as LiteElement;
    const svg = adaptor.firstChild(container);
    if (!(svg instanceof LiteElement) || svg.kind !== 'svg') throw new Error('MathJax did not return an SVG');

    // LiteAdaptor types attribute values as any
    const attribute = (name: string): string => {
        const value: unknown = adaptor.getAttribute(svg, name);
        return typeof value === 'string' ? value : '';
    };

    // MathJax sizes the SVG in ex; derive px from the viewBox (in 1/1000 em) instead
    const responsiveViewBox = attribute('data-mjx-viewBox');
    const [, , viewBoxWidth = 0, viewBoxHeight = 0] = (attribute('viewBox') || responsiveViewBox)
        .split(/\s+/)
        .map(Number);
    if (!viewBoxWidth || !viewBoxHeight) throw new Error('MathJax rendered empty math');
    const unitsPerEx = viewBoxHeight / exValue(attribute('height'));
    // Matches the vertical-align in MathJax's style attribute, e.g. "vertical-align: -0.025ex;"
    const verticalAlignEx = exValue(/vertical-align:\s*([^;]+)/.exec(attribute('style'))?.[1]);

    const toPx = (units: number) => Math.round((units / UNITS_PER_EM) * EM_PX * 100) / 100;
    const width = toPx(viewBoxWidth);
    const height = toPx(viewBoxHeight);
    if (responsiveViewBox) {
        // Tagged equations use a responsive viewport with transforms already in px.
        // Freeze that viewport at its natural size, preserving the equation and tag layout.
        adaptor.setAttribute(svg, 'viewBox', `0 0 ${width} ${height}`);
        adaptor.removeAttribute(svg, 'data-mjx-viewBox');
        // MathJax normally supplies this through its external stylesheet. Its nested
        // equation/tag viewports are only one unit wide, so their glyphs must overflow.
        for (const nested of adaptor.tags(svg, 'svg')) {
            adaptor.setAttribute(nested, 'overflow', 'visible');
        }
    }
    adaptor.setAttribute(svg, 'width', String(width));
    adaptor.setAttribute(svg, 'height', String(height));
    adaptor.removeAttribute(svg, 'style');

    return { svg: adaptor.serializeXML(svg), width, height, verticalAlign: toPx(verticalAlignEx * unitsPerEx) };
}
