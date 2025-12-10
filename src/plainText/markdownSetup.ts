/**
 * @fileoverview Markdown-it setup for Plain Text Renderer
 *
 * This module configures a markdown-it instance for plain text conversion.
 */

import MarkdownIt from 'markdown-it';
import markdownItMark from 'markdown-it-mark';
import markdownItIns from 'markdown-it-ins';
import markdownItSub from 'markdown-it-sub';
import markdownItSup from 'markdown-it-sup';
import { full as markdownItEmoji } from 'markdown-it-emoji';

/**
 * Creates and configures a markdown-it instance for plain text rendering.
 * @returns A configured markdown-it instance.
 */
export function createMarkdownItInstance(): MarkdownIt {
    const md = new MarkdownIt({ html: true });

    md.use(markdownItMark);
    md.use(markdownItIns);
    md.use(markdownItEmoji);
    md.use(markdownItSub);
    md.use(markdownItSup);

    return md;
}
