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
        // Try different plugin formats
        let pluginFunc = null;

        if (typeof plugin === 'function') {
            pluginFunc = plugin;
        } else if (
            typeof plugin === 'object' &&
            plugin !== null &&
            'default' in plugin &&
            typeof (plugin as { default: unknown }).default === 'function'
        ) {
            pluginFunc = (plugin as { default: unknown }).default;
        } else if (
            typeof plugin === 'object' &&
            plugin !== null &&
            'plugin' in plugin &&
            typeof (plugin as { plugin: unknown }).plugin === 'function'
        ) {
            pluginFunc = (plugin as { plugin: unknown }).plugin;
        } else if (plugin && typeof plugin === 'object') {
            // For object plugins, look for common export patterns
            if ('markdownit' in plugin && typeof (plugin as { markdownit: unknown }).markdownit === 'function') {
                pluginFunc = (plugin as { markdownit: unknown }).markdownit;
            } else if ('render' in plugin && typeof (plugin as { render: unknown }).render === 'function') {
                pluginFunc = (plugin as { render: unknown }).render;
            } else if ('parse' in plugin && typeof (plugin as { parse: unknown }).parse === 'function') {
                pluginFunc = (plugin as { parse: unknown }).parse;
            } else if ('full' in plugin && typeof (plugin as { full: unknown }).full === 'function') {
                pluginFunc = (plugin as { full: unknown }).full;
            } else if ('light' in plugin && typeof (plugin as { light: unknown }).light === 'function') {
                pluginFunc = (plugin as { light: unknown }).light;
            } else if ('bare' in plugin && typeof (plugin as { bare: unknown }).bare === 'function') {
                pluginFunc = (plugin as { bare: unknown }).bare;
            } else {
                // Try to find any function in the object
                const funcKeys = Object.keys(plugin).filter(
                    (key) => typeof (plugin as Record<string, unknown>)[key] === 'function'
                );
                if (funcKeys.length === 1) {
                    pluginFunc = (plugin as Record<string, unknown>)[funcKeys[0]];
                } else if (funcKeys.length > 1) {
                    // If multiple functions, log them for debugging
                    if (debug) {
                        console.log(`[copy-as-html] Plugin ${pluginName} has multiple functions:`, funcKeys);
                    }
                    // For multi-function plugins, try common patterns first
                    if (funcKeys.includes('full')) {
                        pluginFunc = (plugin as Record<string, unknown>).full;
                    } else if (funcKeys.includes('default')) {
                        pluginFunc = (plugin as Record<string, unknown>).default;
                    } else {
                        // Use the first available function
                        pluginFunc = (plugin as Record<string, unknown>)[funcKeys[0]];
                    }
                } else {
                    console.warn(
                        `[copy-as-html] Plugin ${pluginName} object found but no callable function. Available keys:`,
                        Object.keys(plugin)
                    );
                    console.warn(`[copy-as-html] Plugin ${pluginName} object:`, plugin);
                    return false;
                }
            }
        }

        if (!pluginFunc) {
            console.warn(
                `[copy-as-html] Could not find callable plugin function for ${pluginName} in:`,
                Object.keys(plugin || {})
            );
            return false;
        }

        // Try to use the plugin
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
