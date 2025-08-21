// src/pluginUtils.ts
import MarkdownIt = require('markdown-it');

/**
 * Safe plugin loader that handles potential import issues.
 * This is the complex function that was hard to get right,
 * so we share it to avoid duplicating the logic.
 */
export function safePluginUse(
    md: MarkdownIt, 
    plugin: any, 
    options?: any, 
    pluginName: string = 'unknown'
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
        } else if (plugin && typeof plugin.default === 'function') {
            pluginFunc = plugin.default;
        } else if (plugin && plugin.plugin && typeof plugin.plugin === 'function') {
            pluginFunc = plugin.plugin;
        } else if (plugin && typeof plugin === 'object') {
            // For object plugins, look for common export patterns
            if (typeof plugin.markdownit === 'function') {
                pluginFunc = plugin.markdownit;
            } else if (typeof plugin.render === 'function') {
                pluginFunc = plugin.render;
            } else if (typeof plugin.parse === 'function') {
                pluginFunc = plugin.parse;
            } else if (plugin.full && typeof plugin.full === 'function') {
                // For markdown-it-emoji which exports {bare, full, light}
                pluginFunc = plugin.full;
            } else if (plugin.light && typeof plugin.light === 'function') {
                // Alternative emoji option
                pluginFunc = plugin.light;
            } else if (plugin.bare && typeof plugin.bare === 'function') {
                // Another emoji option
                pluginFunc = plugin.bare;
            } else {
                // Try to find any function in the object
                const funcKeys = Object.keys(plugin).filter(key => typeof plugin[key] === 'function');
                if (funcKeys.length === 1) {
                    pluginFunc = plugin[funcKeys[0]];
                } else if (funcKeys.length > 1) {
                    // If multiple functions, log them for debugging
                    console.warn(`[copy-as-html] Plugin ${pluginName} has multiple functions:`, funcKeys);
                    // For multi-function plugins, try common patterns first
                    if (funcKeys.includes('full')) {
                        pluginFunc = plugin.full;
                    } else if (funcKeys.includes('default')) {
                        pluginFunc = plugin.default;
                    } else {
                        // Use the first available function
                        pluginFunc = plugin[funcKeys[0]];
                    }
                } else {
                    console.warn(`[copy-as-html] Plugin ${pluginName} object found but no callable function. Available keys:`, Object.keys(plugin));
                    console.warn(`[copy-as-html] Plugin ${pluginName} object:`, plugin);
                    return false;
                }
            }
        }
        
        if (!pluginFunc) {
            console.warn(`[copy-as-html] Could not find callable plugin function for ${pluginName} in:`, Object.keys(plugin || {}));
            return false;
        }
        
        // Try to use the plugin
        md.use(pluginFunc, options);
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
    plugin: any;
    name: string;
    options?: any;
}

/**
 * Loads plugins conditionally based on configuration
 */
export function loadPluginsConditionally(md: MarkdownIt, plugins: PluginConfig[]) {
    plugins.forEach(({ enabled, plugin, name, options }) => {
        if (enabled && plugin) {
            safePluginUse(md, plugin, options, name);
        }
    });
}