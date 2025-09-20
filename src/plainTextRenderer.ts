/**
 * @fileoverview Plain Text Renderer - Converts markdown to formatted plain text
 *
 * This module orchestrates the conversion of markdown to plain text.
 * It uses sub-modules to handle the details of the conversion process:
 * - markdownSetup: Configures the markdown-it parser.
 * - tokenRenderers: Renders the parsed tokens to a plain text string.
 *
 * @author bwat47
 * @since 1.0.16
 */

import { PlainTextOptions } from './types';
import { createMarkdownItInstance } from './plainText/markdownSetup';
import { PlainTextRenderer } from './plainText/plainTextRenderer';
import { renderPlainText } from './plainText/tokenRenderers';

/**
 * Converts markdown to plain text using the provided options.
 * @param markdown The markdown string to convert.
 * @param options The plain text rendering options.
 * @param debug Enable debug logging for plugin loading.
 * @returns The resulting plain text string.
 */
export function convertMarkdownToPlainText(markdown: string, options: PlainTextOptions, debug: boolean = false): string {
    const md = createMarkdownItInstance(debug);
    const tokens = md.parse(markdown, {});
    return renderPlainText(tokens, null, 0, options);
}

/**
 * Experimental block-based renderer variant.
 */
export function convertMarkdownToPlainTextWithBlocks(
    markdown: string,
    options: PlainTextOptions,
    debug: boolean = false
): string {
    const md = createMarkdownItInstance(debug);
    const renderer = new PlainTextRenderer(md, options);
    return renderer.render(markdown);
}
