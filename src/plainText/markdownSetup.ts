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
const markdownItMark = safeRequire(() => require('markdown-it-mark'), 'markdown-it-mark');
const markdownItIns = safeRequire(() => require('markdown-it-ins'), 'markdown-it-ins');
const markdownItEmoji = safeRequire(() => require('markdown-it-emoji'), 'markdown-it-emoji');
const markdownItSub = safeRequire(() => require('markdown-it-sub'), 'markdown-it-sub');
const markdownItSup = safeRequire(() => require('markdown-it-sup'), 'markdown-it-sup');

/**
 * Creates and configures a markdown-it instance for plain text rendering.
 * @returns A configured markdown-it instance.
 */
export function createMarkdownItInstance(): MarkdownIt {
    const md = new MarkdownIt();

    // Use safe plugin loading to prevent conflicts
    if (markdownItMark) safePluginUse(md, markdownItMark, undefined, 'markdown-it-mark');
    if (markdownItIns) safePluginUse(md, markdownItIns, undefined, 'markdown-it-ins');
    if (markdownItEmoji) safePluginUse(md, markdownItEmoji, undefined, 'markdown-it-emoji');
    if (markdownItSub) safePluginUse(md, markdownItSub, undefined, 'markdown-it-sub');
    if (markdownItSup) safePluginUse(md, markdownItSup, undefined, 'markdown-it-sup');

    return md;
}
