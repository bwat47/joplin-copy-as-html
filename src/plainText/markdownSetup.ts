/* eslint-disable @typescript-eslint/no-require-imports */

/**
 * @fileoverview Markdown-it setup for Plain Text Renderer
 *
 * This module configures a markdown-it instance for plain text conversion.
 *
 * @author bwat47
 * @since 1.1.8
 */

import MarkdownIt from 'markdown-it';
import { safePluginUse, safeRequire } from '../pluginUtils';

// Use safe imports to prevent conflicts
const markdownItMark = safeRequire(() => require('markdown-it-mark'), 'markdown-it-mark', '[copy-as-plain-text]');
const markdownItIns = safeRequire(() => require('markdown-it-ins'), 'markdown-it-ins', '[copy-as-plain-text]');
const markdownItEmoji = safeRequire(() => require('markdown-it-emoji'), 'markdown-it-emoji', '[copy-as-plain-text]');
const markdownItSub = safeRequire(() => require('markdown-it-sub'), 'markdown-it-sub', '[copy-as-plain-text]');
const markdownItSup = safeRequire(() => require('markdown-it-sup'), 'markdown-it-sup', '[copy-as-plain-text]');

/**
 * Creates and configures a markdown-it instance for plain text rendering.
 * @param debug - Enable debug logging for plugin loading
 * @returns A configured markdown-it instance.
 */
export function createMarkdownItInstance(debug: boolean = false): MarkdownIt {
    const md = new MarkdownIt();

    // Use safe plugin loading to prevent conflicts
    if (markdownItMark) safePluginUse(md, markdownItMark, undefined, 'markdown-it-mark', debug);
    if (markdownItIns) safePluginUse(md, markdownItIns, undefined, 'markdown-it-ins', debug);
    if (markdownItEmoji) safePluginUse(md, markdownItEmoji, undefined, 'markdown-it-emoji', debug);
    if (markdownItSub) safePluginUse(md, markdownItSub, undefined, 'markdown-it-sub', debug);
    if (markdownItSup) safePluginUse(md, markdownItSup, undefined, 'markdown-it-sup', debug);

    return md;
}
