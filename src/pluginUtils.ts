/* eslint-disable @typescript-eslint/no-require-imports */

/**
 * @fileoverview Plugin Loading Utilities - Safe markdown-it plugin management
 *
 * Resolves CommonJS plugin exports into a callable markdown-it plugin function.
 *
 * The markdown-it plugins that we use have various different export patterns:
 * 1. Direct function export (most plugins)
 * 2. ESM-style { default: fn } (markdown-it-anchor)
 * 3. Multiple named exports (markdown-it-emoji: bare/full/light)
 *
 * @author bwat47
 * @since 1.1.0
 */

import MarkdownIt = require('markdown-it');
import { logger } from './logger';

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
    const priority = ['full', 'default', 'plugin'];
    for (const preferred of priority) {
        if (keys.includes(preferred)) {
            return [plugin[preferred] as MarkdownItPlugin, preferred];
        }
    }
    const fallbackKey = keys[0];
    return [plugin[fallbackKey] as MarkdownItPlugin, fallbackKey];
}

function resolveCommonJsPlugin(plugin: unknown, pluginName: string): MarkdownItPlugin | undefined {
    if (typeof plugin === 'function') {
        return plugin as MarkdownItPlugin;
    }

    if (!isObject(plugin)) {
        return undefined;
    }

    const funcKeys = collectFunctionKeys(plugin);
    if (funcKeys.length === 0) {
        return undefined;
    }

    if (funcKeys.length === 1) {
        const key = funcKeys[0];
        logger.debug(`Plugin ${pluginName} using export: ${key}`);
        return plugin[key] as MarkdownItPlugin;
    }

    logger.debug(`Plugin ${pluginName} has multiple function exports:`, funcKeys);
    const [selected, key] = selectPreferredFunction(plugin, funcKeys);
    if (key) {
        logger.debug(`Plugin ${pluginName} preferred function export: ${key}`);
    }
    return selected;
}

/**
 * Safely require a module and emit a consistent warning when it cannot be loaded.
 */
export function safeRequire<T>(factory: () => T, moduleId: string): T | undefined {
    try {
        return factory();
    } catch (error) {
        logger.warn(`Module ${moduleId} not available:`, error);
        return undefined;
    }
}

/**
 * Safe plugin loader that handles potential import issues.
 */
export function safePluginUse(
    md: MarkdownIt,
    plugin: unknown,
    options?: unknown,
    pluginName: string = 'unknown'
): boolean {
    if (!plugin) {
        logger.warn(`Plugin ${pluginName} is null or undefined`);
        return false;
    }

    try {
        const pluginFunc = resolveCommonJsPlugin(plugin, pluginName);
        if (!pluginFunc) {
            if (isObject(plugin)) {
                const availableKeys = Object.keys(plugin);
                if (availableKeys.length) {
                    logger.warn(
                        `Plugin ${pluginName} object found but no callable function. Available keys:`,
                        availableKeys
                    );
                }
                logger.warn(`Plugin ${pluginName} object:`, plugin);
            } else {
                logger.warn(`Could not find callable plugin function for ${pluginName}. Received:`, plugin);
            }
            return false;
        }

        md.use(pluginFunc, options);
        logger.debug(`Successfully loaded plugin: ${pluginName}`);
        return true;
    } catch (err) {
        logger.error(`Error loading markdown-it plugin ${pluginName}:`, err);
        logger.error(`Plugin ${pluginName} object:`, plugin);
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
export function loadPluginsConditionally(md: MarkdownIt, plugins: PluginConfig[]) {
    plugins.forEach(({ enabled, plugin, name, options }) => {
        if (enabled && plugin) {
            safePluginUse(md, plugin, options, name);
        } else if (enabled && !plugin) {
            logger.debug(`Plugin ${name} is enabled but not available (skipped)`);
        } else {
            logger.debug(`Plugin ${name} is disabled (skipped)`);
        }
    });
}
