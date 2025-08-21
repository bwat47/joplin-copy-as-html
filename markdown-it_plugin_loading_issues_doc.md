# Markdown-it Plugin Loading Issues & Solutions

## Overview

During the development of the Joplin Copy as HTML plugin, we encountered several challenging issues when attempting to add additional markdown-it plugins to match Joplin's markdown rendering capabilities. This document details the problems, root causes, and the comprehensive solutions implemented.

## Background

The goal was to add support for these markdown-it plugins to respect Joplin's settings:
- `markdown-it-abbr` (abbreviations)
- `markdown-it-deflist` (definition lists) 
- `markdown-it-emoji` (emoji syntax like `:smile:`)
- `markdown-it-footnote` (footnotes)
- `markdown-it-multimd-table` (advanced tables)
- `markdown-it-toc-done-right` (table of contents `[[toc]]` support)

## Issues Encountered

### 1. Function Application Errors

**Symptoms:**
- `HTML: e.apply is not a function` 
- `HTML: M is not a function`
- Errors in PlainTextRenderer even when no changes were made to it

**Root Cause:**
Different markdown-it plugins use various export patterns and module formats:
- Some export as ES modules with `.default` property
- Some export as CommonJS functions directly
- Some export as objects with nested function properties
- Some have multiple export patterns (like `markdown-it-emoji` with `{bare, full, light}`)

**Example of the Problem:**
```javascript
// This failed because plugin might be an object, not a function
md.use(markdownItEmoji); // Error: e.apply is not a function

// The actual structure was:
markdownItEmoji = {
  bare: function() {...},
  full: function() {...}, 
  light: function() {...}
}
```

### 2. Unknown Joplin Setting Keys

**Symptoms:**
- `Failed to copy as HTML: Unknown key: markdown.plugin.multimdtable`
- Plugins not respecting Joplin's enable/disable settings

**Root Cause:**
Incorrect assumption about Joplin's internal setting key names. The actual setting keys didn't match our guessed patterns.

**Example:**
```javascript
// We tried:
await joplin.settings.globalValue('markdown.plugin.multimdtable')
await joplin.settings.globalValue('markdown.plugin.multimd-table') 
await joplin.settings.globalValue('markdown.plugin.table')

// The actual key was:
await joplin.settings.globalValue('markdown.plugin.multitable')
```

### 3. Module Import Conflicts

**Symptoms:**
- Changes to htmlRenderer.ts causing errors in plainTextRenderer.ts
- Cross-contamination between the two renderers

**Root Cause:**
Both renderers were importing the same markdown-it plugins, causing module resolution conflicts in the Joplin plugin environment.

### 4. Plugin Object Structure Variations

**Symptoms:**
- `Plugin object found but no callable function: Object`
- Some plugins loading, others failing silently

**Root Cause:**
Plugins had vastly different export structures:
- Function exports: `module.exports = function(md, options) {...}`
- Object exports: `module.exports = { plugin: function(md, options) {...} }`
- Multi-function exports: `module.exports = { bare: fn1, full: fn2, light: fn3 }`
- ES module exports: `export default function(md, options) {...}`

## Solutions Implemented

### 1. Enhanced Safe Plugin Loading

We created a comprehensive `safePluginUse` function that handles multiple plugin export patterns:

```javascript
function safePluginUse(md: MarkdownIt, plugin: any, options?: any, pluginName: string = 'unknown'): boolean {
    if (!plugin) {
        console.warn(`[copy-as-html] Plugin ${pluginName} is null or undefined`);
        return false;
    }
    
    try {
        let pluginFunc = null;
        
        // Try different plugin formats
        if (typeof plugin === 'function') {
            pluginFunc = plugin;
        } else if (plugin && typeof plugin.default === 'function') {
            pluginFunc = plugin.default;
        } else if (plugin && plugin.plugin && typeof plugin.plugin === 'function') {
            pluginFunc = plugin.plugin;
        } else if (plugin && typeof plugin === 'object') {
            // Handle object-based plugins with multiple strategies
            if (typeof plugin.markdownit === 'function') {
                pluginFunc = plugin.markdownit;
            } else if (typeof plugin.render === 'function') {
                pluginFunc = plugin.render;
            } else if (typeof plugin.parse === 'function') {
                pluginFunc = plugin.parse;
            } else if (plugin.full && typeof plugin.full === 'function') {
                // Special handling for markdown-it-emoji
                pluginFunc = plugin.full;
            } else if (plugin.light && typeof plugin.light === 'function') {
                pluginFunc = plugin.light;
            } else if (plugin.bare && typeof plugin.bare === 'function') {
                pluginFunc = plugin.bare;
            } else {
                // Auto-detect single functions or prioritize common patterns
                const funcKeys = Object.keys(plugin).filter(key => typeof plugin[key] === 'function');
                if (funcKeys.length === 1) {
                    pluginFunc = plugin[funcKeys[0]];
                } else if (funcKeys.length > 1) {
                    // Prioritize known patterns
                    if (funcKeys.includes('full')) {
                        pluginFunc = plugin.full;
                    } else if (funcKeys.includes('default')) {
                        pluginFunc = plugin.default;
                    } else {
                        pluginFunc = plugin[funcKeys[0]];
                    }
                }
            }
        }
        
        if (!pluginFunc) {
            console.warn(`[copy-as-html] Could not find callable plugin function for ${pluginName}`);
            return false;
        }
        
        md.use(pluginFunc, options);
        return true;
    } catch (err) {
        console.error(`[copy-as-html] Error loading markdown-it plugin ${pluginName}:`, err);
        return false;
    }
}
```

### 2. Safe Global Setting Retrieval

We implemented graceful handling for unknown setting keys:

```javascript
async function safeGetGlobalSetting(key: string, defaultValue: boolean = false): Promise<boolean> {
    try {
        const value = await joplin.settings.globalValue(key);
        return !!value;
    } catch (err) {
        console.warn(`[copy-as-html] Global setting '${key}' not found, using default:`, defaultValue);
        return defaultValue;
    }
}
```

### 3. Centralized Setting Keys

We moved all Joplin setting keys to a constants file to eliminate magic strings:

```javascript
export const JOPLIN_SETTINGS = {
    SUB: 'markdown.plugin.sub',
    SUP: 'markdown.plugin.sup',
    MARK: 'markdown.plugin.mark',
    INSERT: 'markdown.plugin.insert',
    SOFT_BREAKS: 'markdown.plugin.softbreaks',
    TYPOGRAPHER: 'markdown.plugin.typographer',
    ABBR: 'markdown.plugin.abbr',
    DEFLIST: 'markdown.plugin.deflist',
    EMOJI: 'markdown.plugin.emoji',
    FOOTNOTE: 'markdown.plugin.footnote',
    MULTITABLE: 'markdown.plugin.multitable', // Correct key found through testing
    TOC: 'markdown.plugin.toc',
    LINKIFY: 'markdown.plugin.linkify',
} as const;
```

### 4. Isolated Plugin Imports

We used try-catch blocks around all plugin imports to prevent conflicts:

```javascript
let markdownItAbbr: any;
let markdownItDeflist: any;
let markdownItEmoji: any;
// ... etc

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
// ... etc
```

### 5. Conditional Plugin Loading System

We created a clean, declarative system for loading plugins:

```javascript
interface PluginConfig {
    enabled: boolean;
    plugin: any;
    name: string;
    options?: any;
}

function loadPluginsConditionally(md: MarkdownIt, plugins: PluginConfig[]) {
    plugins.forEach(({ enabled, plugin, name, options }) => {
        if (enabled && plugin) {
            safePluginUse(md, plugin, options, name);
        }
    });
}

// Usage:
loadPluginsConditionally(md, [
    { enabled: globalMarkEnabled, plugin: markdownItMark, name: 'markdown-it-mark' },
    { enabled: globalEmojiEnabled, plugin: markdownItEmoji, name: 'markdown-it-emoji' },
    {
        enabled: globalMultimdTableEnabled,
        plugin: markdownItMultimdTable,
        name: 'markdown-it-multimd-table',
        options: {
            multiline: true,
            rowspan: true,
            headerless: true,
            multibody: true,
        }
    },
    // ... etc
]);
```

### 6. Shared Plugin Utilities (Code Refactoring)

**Challenge:** After implementing the complex plugin loading logic in both `htmlRenderer.ts` and `plainTextRenderer.ts`, we had significant code duplication (~200 lines) of the intricate `safePluginUse` function.

**Solution:** We extracted the plugin loading utilities into a shared module `pluginUtils.ts`:

```typescript
// src/pluginUtils.ts
import MarkdownIt = require('markdown-it');

export function safePluginUse(
    md: MarkdownIt, 
    plugin: any, 
    options?: any, 
    pluginName: string = 'unknown'
): boolean {
    // ... (complete safePluginUse implementation)
}

export interface PluginConfig {
    enabled: boolean;
    plugin: any;
    name: string;
    options?: any;
}

export function loadPluginsConditionally(md: MarkdownIt, plugins: PluginConfig[]) {
    plugins.forEach(({ enabled, plugin, name, options }) => {
        if (enabled && plugin) {
            safePluginUse(md, plugin, options, name);
        }
    });
}
```

**Benefits of Shared Utilities:**
- **Reduced Duplication**: Eliminated ~200 lines of duplicated complex plugin loading code
- **Single Source of Truth**: Plugin loading logic centralized for easier maintenance
- **Consistent Behavior**: Both renderers use identical plugin loading mechanisms
- **Safer Updates**: Bug fixes and improvements only need to be made once
- **Preserved Separation**: Each renderer still maintains its own plugin configuration and settings

**Implementation:**
- `htmlRenderer.ts`: Imports and uses shared utilities, maintains Joplin global settings integration
- `plainTextRenderer.ts`: Imports and uses shared utilities, maintains custom settings for plain text output
- Both renderers retain their distinct plugin configurations and requirements

This refactoring maintained the hard-won stability of the plugin loading system while eliminating code duplication and improving maintainability.

## Specific Plugin Challenges & Solutions

### Markdown-it-emoji

**Challenge:** Exported as `{bare, full, light}` object, not a function.

**Solution:** Enhanced `safePluginUse` to detect and prioritize the `full` function for complete emoji support.

### Markdown-it-multimd-table

**Challenge:** Unknown setting key and hardcoded enable state.

**Solution:** Found correct key `markdown.plugin.multitable` through testing and GitHub PR research.

### Markdown-it-toc-done-right

**Challenge:** TOC appearing even when disabled in Joplin.

**Solution:** Proper integration with `markdown.plugin.toc` setting and correct placeholder configuration.

### Linkify Setting

**Challenge:** Hardcoded `linkify: true` in MarkdownIt config.

**Solution:** Updated to use `linkify: !!globalLinkifyEnabled` to respect Joplin's setting.

## Key Learnings

### 1. Plugin Export Pattern Diversity
Different npm packages use vastly different export patterns. A robust plugin loader must handle:
- Direct function exports
- Object exports with nested functions
- ES module vs CommonJS differences
- Multi-function exports for different feature sets

### 2. Setting Key Discovery
Joplin's internal setting keys don't always match expected patterns. Finding correct keys required:
- GitHub source code investigation
- Trial and error testing
- Console debugging with unknown key error handling

### 3. Module Isolation
In plugin environments, shared module imports can cause conflicts. Solutions include:
- Separate try-catch blocks for each import
- Defensive programming with existence checks
- Graceful degradation when modules aren't available

### 4. Debugging Strategy
Comprehensive logging was crucial for identifying issues:
- Success/failure logging for each plugin
- Object structure inspection for failed plugins
- Clear error messages with context

### 5. Code Reuse and Maintainability
Complex, battle-tested code should be shared when possible:
- Extract intricate functions into shared utilities
- Maintain separation of concerns between different use cases
- Preserve existing behavior while reducing duplication
- Centralize critical logic for easier maintenance and debugging

## Final Architecture Benefits

The final solution provides:

1. **Resilient Plugin Loading**: Never crashes due to plugin issues
2. **Comprehensive Compatibility**: Handles all major plugin export patterns
3. **Setting Accuracy**: Correctly respects all Joplin markdown settings
4. **Maintainable Code**: Clean, declarative plugin configuration with shared utilities
5. **Excellent Debugging**: Clear error messages and logging
6. **Future-Proof**: Easy to add new plugins with minimal code
7. **DRY Principle**: Eliminated code duplication while preserving functionality
8. **Consistent Behavior**: Both renderers use the same robust plugin loading mechanism