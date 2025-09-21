/**
 * @fileoverview Plain Text Renderer - Converts markdown to formatted plain text
 *
 * This module orchestrates the conversion of markdown to plain text.
 * It uses sub-modules to handle the details of the conversion process:
 * - markdownSetup: Configures the markdown-it parser.
 * - renderer.ts: hooks into markdown-it to stream semantic blocks (paragraphs, lists, tables, code, etc.).
 * - tokenRenderers.ts: contains the pure helpers for list indentation, table alignment (`string-width` aware), hyperlink handling, and blank-line rules.
 * - plainTextFormatter.ts: assembles the final string, applying spacing and user-selected preservation options.
 *
 * @author bwat47
 * @since 1.0.16
 */

import { PlainTextOptions } from './types';
import { createMarkdownItInstance } from './plainText/markdownSetup';
import { PlainTextRenderer } from './plainText/renderer';

/**
 * Converts markdown to plain text using the provided options.
 * @param markdown The markdown string to convert.
 * @param options The plain text rendering options.
 * @param debug Enable debug logging for plugin loading.
 * @returns The resulting plain text string.
 */
export function convertMarkdownToPlainText(
    markdown: string,
    options: PlainTextOptions,
    debug: boolean = false
): string {
    const md = createMarkdownItInstance(debug);
    const renderer = new PlainTextRenderer(md, options);
    return renderer.render(markdown);
}
