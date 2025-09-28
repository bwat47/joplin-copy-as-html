/* eslint-disable @typescript-eslint/no-require-imports */

/**
 * @fileoverview Plugin Loading Utilities - Safe markdown-it plugin management
 *
 * Provides robust loading of CommonJS markdown-it plugins that handle diverse export patterns.
 *
 * The challenge: Different npm packages export plugins in various ways:
 * - Direct function exports: `module.exports = function(md) {...}`
 * - Object exports: `module.exports = {plugin: function(md) {...}}`
 * - Multi-function exports: `module.exports = {bare: fn1, full: fn2, light: fn3}`
 *
 * This module automatically detects and handles these CommonJS patterns, with special
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

function isObject(plugin: unknown): plugin is Record<string, unknown> {
    return typeof plugin === 'object' && plugin !== null;
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

function resolveCommonJsPlugin(
    plugin: unknown,
    pluginName: string,
    debug: boolean
): MarkdownItPlugin | undefined {
    if (typeof plugin === 'function') {
        return plugin as MarkdownItPlugin;
    }

    if (!isObject(plugin)) {
        return undefined;
    }

    const commonKeys = ['default', 'plugin'];
    for (const key of commonKeys) {
        const candidate = plugin[key];
        if (typeof candidate === 'function') {
            if (debug) {
                console.log(`[copy-as-html] Plugin ${pluginName} selected property: ${key}`);
            }
            return candidate as MarkdownItPlugin;
        }
    }

    const funcKeys = collectFunctionKeys(plugin);
    if (funcKeys.length === 0) {
        return undefined;
    }

    if (funcKeys.length === 1) {
        const key = funcKeys[0];
        if (debug) {
            console.log(`[copy-as-html] Plugin ${pluginName} using sole function export: ${key}`);
        }
        return plugin[key] as MarkdownItPlugin;
    }

    if (debug) {
        console.log(`[copy-as-html] Plugin ${pluginName} has multiple function exports:`, funcKeys);
    }
    const [selected, key] = selectPreferredFunction(plugin, funcKeys);
    if (debug && key) {
        console.log(`[copy-as-html] Plugin ${pluginName} preferred function export: ${key}`);
    }
    return selected;
}

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
        const pluginFunc = resolveCommonJsPlugin(plugin, pluginName, debug);
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
                console.warn(`[copy-as-html] Could not find callable plugin function for ${pluginName}. Received:`, plugin);
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
