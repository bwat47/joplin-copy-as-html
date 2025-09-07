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
import { safePluginUse } from '../pluginUtils';

// Use safe imports to prevent conflicts
let markdownItMark: unknown;
let markdownItIns: unknown;
let markdownItEmoji: unknown;
let markdownItSub: unknown;
let markdownItSup: unknown;

try {
    markdownItMark = require('markdown-it-mark');
} catch (e) {
    console.warn('[copy-as-plain-text] markdown-it-mark not available:', e);
}

try {
    markdownItIns = require('markdown-it-ins');
} catch (e) {
    console.warn('[copy-as-plain-text] markdown-it-ins not available:', e);
}

try {
    markdownItEmoji = require('markdown-it-emoji');
} catch (e) {
    console.warn('[copy-as-plain-text] markdown-it-emoji not available:', e);
}

try {
    markdownItSub = require('markdown-it-sub');
} catch (e) {
    console.warn('[copy-as-plain-text] markdown-it-sub not available:', e);
}

try {
    markdownItSup = require('markdown-it-sup');
} catch (e) {
    console.warn('[copy-as-plain-text] markdown-it-sup not available:', e);
}

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
