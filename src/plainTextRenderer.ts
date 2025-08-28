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
import { renderPlainText } from './plainText/tokenRenderers';

/**
 * Converts markdown to plain text using the provided options.
 * @param markdown The markdown string to convert.
 * @param options The plain text rendering options.
 * @returns The resulting plain text string.
 */
export function convertMarkdownToPlainText(markdown: string, options: PlainTextOptions): string {
    const md = createMarkdownItInstance();
    const tokens = md.parse(markdown, {});
    return renderPlainText(tokens, null, 0, options);
}
