/* eslint-disable @typescript-eslint/no-require-imports */

/**
 * @fileoverview Markdown-it setup for HTML Renderer
 *
 * This module configures a markdown-it instance to match Joplin's settings.
 * It loads all necessary plugins conditionally based on global Joplin settings.
 *
 * @author bwat47
 * @since 1.1.8
 */

import MarkdownIt from 'markdown-it';
import { JOPLIN_SETTINGS, PLUGIN_DEFAULTS, HTML_CONSTANTS, LINK_RESOURCE_MATCHERS } from '../constants';
import { safeGetGlobalSetting } from '../utils';
import { safePluginUse, loadPluginsConditionally, safeRequire } from '../pluginUtils';
import { getGithubAlertsPlugin } from '../esmPluginLoader';

// Import plugins with shared helper for robustness
const markdownItMark = safeRequire(() => require('markdown-it-mark'), 'markdown-it-mark', '[copy-as-html]');
const markdownItIns = safeRequire(() => require('markdown-it-ins'), 'markdown-it-ins', '[copy-as-html]');
const markdownItSub = safeRequire(() => require('markdown-it-sub'), 'markdown-it-sub', '[copy-as-html]');
const markdownItSup = safeRequire(() => require('markdown-it-sup'), 'markdown-it-sup', '[copy-as-html]');
const markdownItAbbr = safeRequire(() => require('markdown-it-abbr'), 'markdown-it-abbr', '[copy-as-html]');
const markdownItDeflist = safeRequire(() => require('markdown-it-deflist'), 'markdown-it-deflist', '[copy-as-html]');
const markdownItEmoji = safeRequire(() => require('markdown-it-emoji'), 'markdown-it-emoji', '[copy-as-html]');
const markdownItFootnote = safeRequire(() => require('markdown-it-footnote'), 'markdown-it-footnote', '[copy-as-html]');
const markdownItMultimdTable = safeRequire(
    () => require('markdown-it-multimd-table'),
    'markdown-it-multimd-table',
    '[copy-as-html]'
);
const markdownItTocDoneRight = safeRequire(
    () => require('markdown-it-toc-done-right'),
    'markdown-it-toc-done-right',
    '[copy-as-html]'
);
const markdownItAnchor = safeRequire(() => require('markdown-it-anchor'), 'markdown-it-anchor', '[copy-as-html]');
const markdownItTaskLists = safeRequire(
    () => require('markdown-it-task-lists'),
    'markdown-it-task-lists',
    '[copy-as-html]'
);

/**
 * Creates and configures a markdown-it instance based on Joplin's global settings.
 * @returns A promise that resolves to a configured markdown-it instance.
 */
export interface MarkdownItFactoryOptions {
    debug?: boolean;
}

export async function createMarkdownItInstance(opts: MarkdownItFactoryOptions = {}): Promise<MarkdownIt> {
    const { debug = false } = opts;
    const markdownItGithubAlerts = await getGithubAlertsPlugin();
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

    // Render with a local markdown-it instance for full control
    const md = new MarkdownIt({
        html: true,
        linkify: !!globalLinkifyEnabled,
        // Invert the soft breaks setting:
        // Joplin's "Enable soft breaks" means "do NOT insert <br> for single newlines".
        // markdown-it's `breaks: true` option DOES insert <br> tags.
        // So, we invert the Joplin setting to get the correct markdown-it behavior.
        breaks: !globalSoftBreaksEnabled,
        typographer: !!globalTypographerEnabled,
    });

    // Configure linkify to only handle HTTP/HTTPS URLs and mailto (matching Joplin's behavior)
    if (globalLinkifyEnabled) {
        // Disable all fuzzy behaviors.
        md.linkify.set({
            fuzzyLink: false, // Disable fuzzy linking (URLs without protocol)
            fuzzyEmail: false, // Disable automatic email detection (we'll use explicit mailto:)
            fuzzyIP: false, // Disable IP address linking
        });
    }

    // Load plugins conditionally based on Joplin's global settings
    loadPluginsConditionally(
        md,
        [
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
                plugin: markdownItAnchor,
                name: 'markdown-it-anchor',
                options: {
                    permalink: false, // Don't add permalink symbols for clean HTML output
                    permalinkSymbol: '',
                    permalinkBefore: false,
                },
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
        ],
        debug
    );

    // Add task list support (checkboxes) - always enabled since it's core Joplin functionality
    if (markdownItTaskLists) {
        safePluginUse(md, markdownItTaskLists, { enabled: true, lineNumber: false }, 'markdown-it-task-lists', debug);
    }

    // GitHub alert blocks (e.g. > [!note]) - always enable if available; harmless if syntax unused
    if (markdownItGithubAlerts) {
        const loaded = safePluginUse(
            md,
            markdownItGithubAlerts,
            { matchCaseSensitive: false, icons: {} }, // disable inline SVG icons for better email client compatibility
            'markdown-it-github-alerts',
            debug
        );
        if (!loaded) {
            if (debug) console.warn('[copy-as-html] Failed to load markdown-it-github-alerts via safePluginUse');
        } else if (debug) {
            console.log('[copy-as-html] markdown-it-github-alerts plugin registered');
        }
    }

    // Replicate Joplin's non-image resource link marker so later cleanup still works
    const defaultLinkOpen =
        md.renderer.rules.link_open || ((tokens, idx, _opts, _env, self) => self.renderToken(tokens, idx, _opts));
    md.renderer.rules.link_open = function (tokens, idx, opts, env, self) {
        const token = tokens[idx];
        const hrefIdx = token.attrIndex('href');
        if (hrefIdx >= 0) {
            const href = token.attrs![hrefIdx][1] || '';
            // Match :/id, :/id#..., :/id?..., and joplin://resource/id variants
            const m = LINK_RESOURCE_MATCHERS.map((rx) => href.match(rx)).find(Boolean);
            if (m) token.attrPush(['data-resource-id', m[1]]);
        }
        return defaultLinkOpen(tokens, idx, opts, env, self);
    };

    return md;
}
