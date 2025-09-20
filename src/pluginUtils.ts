/* eslint-disable @typescript-eslint/no-require-imports */

/**
 * @fileoverview Plugin Loading Utilities - Safe markdown-it plugin management
 *
 * Provides robust loading of markdown-it plugins that handles diverse export patterns.
 *
 * The challenge: Different npm packages export plugins in various ways:
 * - Direct function exports: `module.exports = function(md) {...}`
 * - Object exports: `module.exports = {plugin: function(md) {...}}`
 * - Multi-function exports: `module.exports = {bare: fn1, full: fn2, light: fn3}`
 * - ES module exports: `export default function(md) {...}`
 *
 * This module automatically detects and handles all these patterns, with special
 * logic for complex plugins like markdown-it-emoji that export multiple variants.
 *
 * Originally developed to solve plugin loading conflicts between HTML and plain text
 * renderers, now shared to eliminate code duplication and ensure consistency.
 *
 * @author bwat47
 * @since 1.1.0
 */

import MarkdownIt = require('markdown-it');

type MarkdownItPlugin = (md: MarkdownIt, options?: unknown) => void;

interface PluginDetectionStrategy {
    name: string;
    test: (plugin: unknown) => boolean;
    extract: (plugin: unknown, ctx: { pluginName: string; debug: boolean }) => MarkdownItPlugin | undefined;
}

function isObject(plugin: unknown): plugin is Record<string, unknown> {
    return typeof plugin === 'object' && plugin !== null;
}

function hasCallableProperty(plugin: unknown, key: string): plugin is Record<string, unknown> {
    return isObject(plugin) && typeof plugin[key] === 'function';
}

function collectFunctionKeys(plugin: Record<string, unknown>): string[] {
    return Object.keys(plugin).filter((key) => typeof plugin[key] === 'function');
}

function selectPreferredFunction(
    plugin: Record<string, unknown>,
    keys: string[]
): [MarkdownItPlugin | undefined, string | undefined] {
    const priority = ['full', 'default'];
    for (const preferred of priority) {
        if (keys.includes(preferred)) {
            return [plugin[preferred] as MarkdownItPlugin, preferred];
        }
    }
    const fallbackKey = keys[0];
    return [plugin[fallbackKey] as MarkdownItPlugin, fallbackKey];
}

/**
 * Plugin detection strategies in priority order.
 *
 * Order matters:
 * 1. Direct functions (most common, fastest check)
 * 2. Known property names (common patterns)
 * 3. Generic object inspection (catch-all)
 *
 * Later strategies are only tried if earlier ones fail.
 */

const strategies: PluginDetectionStrategy[] = [
    {
        name: 'direct-function',
        test: (plugin) => typeof plugin === 'function',
        extract: (plugin) => plugin as MarkdownItPlugin,
    },
    {
        name: 'es-module-default',
        test: (plugin) => hasCallableProperty(plugin, 'default'),
        extract: (plugin) => (plugin as { default: unknown }).default as MarkdownItPlugin,
    },
    {
        name: 'plugin-property',
        test: (plugin) => hasCallableProperty(plugin, 'plugin'),
        extract: (plugin) => (plugin as { plugin: unknown }).plugin as MarkdownItPlugin,
    },
    {
        name: 'markdownit-property',
        test: (plugin) => hasCallableProperty(plugin, 'markdownit'),
        extract: (plugin) => (plugin as { markdownit: unknown }).markdownit as MarkdownItPlugin,
    },
    {
        name: 'render-property',
        test: (plugin) => hasCallableProperty(plugin, 'render'),
        extract: (plugin) => (plugin as { render: unknown }).render as MarkdownItPlugin,
    },
    {
        name: 'parse-property',
        test: (plugin) => hasCallableProperty(plugin, 'parse'),
        extract: (plugin) => (plugin as { parse: unknown }).parse as MarkdownItPlugin,
    },
    {
        name: 'full-property',
        test: (plugin) => hasCallableProperty(plugin, 'full'),
        extract: (plugin) => (plugin as { full: unknown }).full as MarkdownItPlugin,
    },
    {
        name: 'light-property',
        test: (plugin) => hasCallableProperty(plugin, 'light'),
        extract: (plugin) => (plugin as { light: unknown }).light as MarkdownItPlugin,
    },
    {
        name: 'bare-property',
        test: (plugin) => hasCallableProperty(plugin, 'bare'),
        extract: (plugin) => (plugin as { bare: unknown }).bare as MarkdownItPlugin,
    },
    {
        name: 'single-function-object',
        test: (plugin) => {
            if (!isObject(plugin)) return false;
            const funcKeys = collectFunctionKeys(plugin);
            return funcKeys.length === 1;
        },
        extract: (plugin) => {
            const objectPlugin = plugin as Record<string, unknown>;
            const funcKeys = collectFunctionKeys(objectPlugin);
            if (!funcKeys.length) return undefined;
            const key = funcKeys[0];
            return objectPlugin[key] as MarkdownItPlugin;
        },
    },
    {
        name: 'multi-function-object',
        test: (plugin) => {
            if (!isObject(plugin)) return false;
            const funcKeys = collectFunctionKeys(plugin);
            return funcKeys.length > 1;
        },
        extract: (plugin, ctx) => {
            const objectPlugin = plugin as Record<string, unknown>;
            const funcKeys = collectFunctionKeys(objectPlugin);
            if (!funcKeys.length) return undefined;
            if (ctx.debug) {
                console.log(`[copy-as-html] Plugin ${ctx.pluginName} has multiple functions:`, funcKeys);
            }
            const [selected, key] = selectPreferredFunction(objectPlugin, funcKeys);
            if (ctx.debug && key) {
                console.log(`[copy-as-html] Plugin ${ctx.pluginName} selected function: ${key}`);
            }
            return selected;
        },
    },
];

/**
 * Safely require a module and emit a consistent warning when it cannot be loaded.
 */
export function safeRequire<T>(factory: () => T, moduleId: string, logPrefix: string): T | undefined {
    try {
        return factory();
    } catch (error) {
        console.warn(`${logPrefix} ${moduleId} not available:`, error);
        return undefined;
    }
}

/**
 * Safe plugin loader that handles potential import issues.
 * This is the complex function that was hard to get right,
 * so we share it to avoid duplicating the logic.
 */
export function safePluginUse(
    md: MarkdownIt,
    plugin: unknown,
    options?: unknown,
    pluginName: string = 'unknown',
    debug: boolean = false
): boolean {
    if (!plugin) {
        console.warn(`[copy-as-html] Plugin ${pluginName} is null or undefined`);
        return false;
    }

    try {
        let pluginFunc: MarkdownItPlugin | undefined;
        for (const strategy of strategies) {
            if (!strategy.test(plugin)) {
                continue;
            }
            pluginFunc = strategy.extract(plugin, { pluginName, debug });
            if (pluginFunc) {
                if (debug) {
                    console.log(`[copy-as-html] Plugin ${pluginName} matched strategy: ${strategy.name}`);
                }
                break;
            }
        }

        if (!pluginFunc) {
            if (isObject(plugin)) {
                const availableKeys = Object.keys(plugin);
                if (availableKeys.length) {
                    console.warn(
                        `[copy-as-html] Plugin ${pluginName} object found but no callable function. Available keys:`,
                        availableKeys
                    );
                }
                console.warn(`[copy-as-html] Plugin ${pluginName} object:`, plugin);
            } else {
                console.warn(
                    `[copy-as-html] Could not find callable plugin function for ${pluginName} in:`,
                    Object.keys(plugin || {})
                );
            }
            return false;
        }

        md.use(pluginFunc, options);
        if (debug) {
            console.log(`[copy-as-html] Successfully loaded plugin: ${pluginName}`);
        }
        return true;
    } catch (err) {
        console.error(`[copy-as-html] Error loading markdown-it plugin ${pluginName}:`, err);
        console.error(`[copy-as-html] Plugin ${pluginName} object:`, plugin);
        return false;
    }
}

/**
 * Helper interface for plugin configuration
 */
export interface PluginConfig {
    enabled: boolean;
    plugin: unknown;
    name: string;
    options?: unknown;
}

/**
 * Loads plugins conditionally based on configuration
 */
export function loadPluginsConditionally(md: MarkdownIt, plugins: PluginConfig[], debug: boolean = false) {
    plugins.forEach(({ enabled, plugin, name, options }) => {
        if (enabled && plugin) {
            safePluginUse(md, plugin, options, name, debug);
        } else if (enabled && !plugin) {
            if (debug) {
                console.log(`[copy-as-html] Plugin ${name} is enabled but not available (skipped)`);
            }
        } else if (debug) {
            console.log(`[copy-as-html] Plugin ${name} is disabled (skipped)`);
        }
    });
}
