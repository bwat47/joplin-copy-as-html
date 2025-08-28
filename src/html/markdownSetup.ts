/* eslint-disable @typescript-eslint/no-require-imports */

/**
 * @fileoverview Markdown-it setup for HTML Renderer
 *
 * This module configures a markdown-it instance to match Joplin's settings.
 * It loads all necessary plugins conditionally based on global Joplin settings.
 *
 * @author bwat47
 * @since 1.0.0
 */

import MarkdownIt from 'markdown-it';
import { JOPLIN_SETTINGS, PLUGIN_DEFAULTS, HTML_CONSTANTS, LINK_RESOURCE_MATCHERS } from '../constants';
import { safeGetGlobalSetting } from '../utils';
import { safePluginUse, loadPluginsConditionally } from '../pluginUtils';

// Import plugins with try-catch for robustness
let markdownItMark: unknown;
let markdownItIns: unknown;
let markdownItSub: unknown;
let markdownItSup: unknown;
let markdownItAbbr: unknown;
let markdownItDeflist: unknown;
let markdownItEmoji: unknown;
let markdownItFootnote: unknown;
let markdownItMultimdTable: unknown;
let markdownItTocDoneRight: unknown;
let markdownItTaskLists: unknown;

try {
    markdownItMark = require('markdown-it-mark');
} catch (e) {
    console.warn('[copy-as-html] markdown-it-mark not available:', e);
}
try {
    markdownItIns = require('markdown-it-ins');
} catch (e) {
    console.warn('[copy-as-html] markdown-it-ins not available:', e);
}
try {
    markdownItSub = require('markdown-it-sub');
} catch (e) {
    console.warn('[copy-as-html] markdown-it-sub not available:', e);
}
try {
    markdownItSup = require('markdown-it-sup');
} catch (e) {
    console.warn('[copy-as-html] markdown-it-sup not available:', e);
}
try {
    markdownItAbbr = require('markdown-it-abbr');
} catch (e) {
    console.warn('[copy-as-html] markdown-it-abbr not available:', e);
}
try {
    markdownItDeflist = require('markdown-it-deflist');
} catch (e) {
    console.warn('[copy-as-html] markdown-it-deflist not available:', e);
}
try {
    markdownItEmoji = require('markdown-it-emoji');
} catch (e) {
    console.warn('[copy-as-html] markdown-it-emoji not available:', e);
}
try {
    markdownItFootnote = require('markdown-it-footnote');
} catch (e) {
    console.warn('[copy-as-html] markdown-it-footnote not available:', e);
}
try {
    markdownItMultimdTable = require('markdown-it-multimd-table');
} catch (e) {
    console.warn('[copy-as-html] markdown-it-multimd-table not available:', e);
}
try {
    markdownItTocDoneRight = require('markdown-it-toc-done-right');
} catch (e) {
    console.warn('[copy-as-html] markdown-it-toc-done-right not available:', e);
}
try {
    markdownItTaskLists = require('markdown-it-task-lists');
} catch (e) {
    console.warn('[copy-as-html] markdown-it-task-lists not available:', e);
}

/**
 * Creates and configures a markdown-it instance based on Joplin's global settings.
 * @returns A promise that resolves to a configured markdown-it instance.
 */
export async function createMarkdownItInstance(): Promise<MarkdownIt> {
    // Get Joplin global settings with safe fallbacks
    const [
        globalSubEnabled,
        globalSupEnabled,
        globalMarkEnabled,
        globalInsEnabled,
        globalSoftBreaksEnabled,
        globalTypographerEnabled,
        globalAbbrEnabled,
        globalDeflistEnabled,
        globalEmojiEnabled,
        globalFootnoteEnabled,
        globalMultimdTableEnabled,
        globalTocEnabled,
        globalLinkifyEnabled,
    ] = await Promise.all([
        safeGetGlobalSetting(JOPLIN_SETTINGS.SUB, true),
        safeGetGlobalSetting(JOPLIN_SETTINGS.SUP, true),
        safeGetGlobalSetting(JOPLIN_SETTINGS.MARK, true),
        safeGetGlobalSetting(JOPLIN_SETTINGS.INSERT, true),
        safeGetGlobalSetting(JOPLIN_SETTINGS.SOFT_BREAKS, false),
        safeGetGlobalSetting(JOPLIN_SETTINGS.TYPOGRAPHER, false),
        safeGetGlobalSetting(JOPLIN_SETTINGS.ABBR, true),
        safeGetGlobalSetting(JOPLIN_SETTINGS.DEFLIST, true),
        safeGetGlobalSetting(JOPLIN_SETTINGS.EMOJI, true),
        safeGetGlobalSetting(JOPLIN_SETTINGS.FOOTNOTE, true),
        safeGetGlobalSetting(JOPLIN_SETTINGS.MULTITABLE, true),
        safeGetGlobalSetting(JOPLIN_SETTINGS.TOC, true),
        safeGetGlobalSetting(JOPLIN_SETTINGS.LINKIFY, true),
    ]);

    const md = new MarkdownIt({
        html: true,
        linkify: !!globalLinkifyEnabled,
        breaks: !globalSoftBreaksEnabled,
        typographer: !!globalTypographerEnabled,
    });

    if (globalLinkifyEnabled) {
        md.linkify.set({
            fuzzyLink: false,
            fuzzyEmail: false,
            fuzzyIP: false,
        });
        md.linkify.add('http:', { validate: /^\/\/.*/ });
        md.linkify.add('https:', { validate: /^\/\/.*/ });
        md.linkify.add('mailto:', {
            validate:
                /^[a-zA-Z0-9.!#$%&'*+/=?^_`{|}~-]+@[a-zA-Z0-9](?:[a-zA-Z0-9-]{0,61}[a-zA-Z0-9])?(?:\.[a-zA-Z0-9](?:[a-zA-Z0-9-]{0,61}[a-zA-Z0-9])?)*/,
        });
    }

    loadPluginsConditionally(md, [
        { enabled: globalMarkEnabled, plugin: markdownItMark, name: 'markdown-it-mark' },
        { enabled: globalInsEnabled, plugin: markdownItIns, name: 'markdown-it-ins' },
        { enabled: globalSubEnabled, plugin: markdownItSub, name: 'markdown-it-sub' },
        { enabled: globalSupEnabled, plugin: markdownItSup, name: 'markdown-it-sup' },
        { enabled: globalAbbrEnabled, plugin: markdownItAbbr, name: 'markdown-it-abbr' },
        { enabled: globalDeflistEnabled, plugin: markdownItDeflist, name: 'markdown-it-deflist' },
        { enabled: globalFootnoteEnabled, plugin: markdownItFootnote, name: 'markdown-it-footnote' },
        { enabled: globalEmojiEnabled, plugin: markdownItEmoji, name: 'markdown-it-emoji' },
        {
            enabled: globalMultimdTableEnabled,
            plugin: markdownItMultimdTable,
            name: 'markdown-it-multimd-table',
            options: PLUGIN_DEFAULTS.MULTIMD_TABLE,
        },
        {
            enabled: globalTocEnabled,
            plugin: markdownItTocDoneRight,
            name: 'markdown-it-toc-done-right',
            options: {
                placeholder: HTML_CONSTANTS.TOC_PLACEHOLDER_PATTERN,
                slugify: (s: string) => s.trim().toLowerCase().replace(/\s+/g, '-'),
                containerId: HTML_CONSTANTS.TOC_CONTAINER_ID,
                listType: 'ul',
            },
        },
    ]);

    if (markdownItTaskLists) {
        safePluginUse(md, markdownItTaskLists, { enabled: true, lineNumber: false }, 'markdown-it-task-lists');
    }

    // Replicate Joplin's non-image resource link marker so later cleanup still works
    const defaultLinkOpen =
        md.renderer.rules.link_open || ((tokens, idx, _opts, _env, self) => self.renderToken(tokens, idx, _opts));
    md.renderer.rules.link_open = function (tokens, idx, opts, env, self) {
        const token = tokens[idx];
        const hrefIdx = token.attrIndex('href');
        if (hrefIdx >= 0) {
            const href = token.attrs![hrefIdx][1] || '';
            const m = LINK_RESOURCE_MATCHERS.map((rx) => href.match(rx)).find(Boolean);
            if (m) token.attrPush(['data-resource-id', m[1]]);
        }
        return defaultLinkOpen(tokens, idx, opts, env, self);
    };

    return md;
}
