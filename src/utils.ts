/**
 * @fileoverview Utility Functions - Input validation and settings processing
 *
 * Contains validation functions that ensure user settings conform to expected
 * types and provide sensible defaults for invalid values.
 *
 * The validation functions are defensive programming - they handle cases where:
 * - Settings are corrupted or have unexpected types
 * - User modifies settings files manually with invalid values
 * - Plugin receives malformed data from Joplin's settings API
 *
 * Each validator provides type-safe defaults ensuring the plugin never crashes
 * due to configuration issues.
 *
 * @author bwat47
 * @since 1.0.16
 */

import joplin from 'api';
import { PlainTextOptions, HtmlOptions } from './types';
import { logger } from './logger';

export function validatePlainTextSettings(settings: unknown): PlainTextOptions {
    const s = (settings || {}) as Partial<PlainTextOptions>;
    return {
        preserveSuperscript: validateBooleanSetting(s.preserveSuperscript),
        preserveSubscript: validateBooleanSetting(s.preserveSubscript),
        preserveEmphasis: validateBooleanSetting(s.preserveEmphasis),
        preserveBold: validateBooleanSetting(s.preserveBold),
        preserveHeading: validateBooleanSetting(s.preserveHeading),
        preserveStrikethrough: validateBooleanSetting(s.preserveStrikethrough),
        preserveHorizontalRule: validateBooleanSetting(s.preserveHorizontalRule),
        preserveMark: validateBooleanSetting(s.preserveMark),
        preserveInsert: validateBooleanSetting(s.preserveInsert),
        displayEmojis: validateBooleanSetting(s.displayEmojis, true), // Default to true
        // Only accept a string value and one of the allowed options.
        hyperlinkBehavior:
            typeof s.hyperlinkBehavior === 'string' && ['title', 'url', 'markdown'].includes(s.hyperlinkBehavior)
                ? (s.hyperlinkBehavior as 'title' | 'url' | 'markdown')
                : 'title',
        indentType:
            typeof s.indentType === 'string' && ['spaces', 'tabs'].includes(s.indentType)
                ? (s.indentType as 'spaces' | 'tabs')
                : 'spaces',
    };
}

export function validateHtmlSettings(settings: unknown): HtmlOptions {
    const s = (settings || {}) as Partial<HtmlOptions>;
    return {
        embedImages: validateBooleanSetting(s.embedImages, true),
        exportFullHtml: validateBooleanSetting(s.exportFullHtml, false),
        downloadRemoteImages: validateBooleanSetting(s.downloadRemoteImages, false),
        embedSvgAsPng: validateBooleanSetting(s.embedSvgAsPng, false),
    };
}

export function validateBooleanSetting(setting: unknown, defaultValue: boolean = false): boolean {
    return typeof setting === 'boolean' ? setting : defaultValue;
}

/**
 * Safe function to get global setting value with fallback.
 * Handles cases where Joplin settings might not be available or throw errors.
 * @param key The global setting key to retrieve
 * @param defaultValue The fallback value if setting is not found
 * @returns Promise resolving to the setting value or default
 */
export async function safeGetGlobalSetting(key: string, defaultValue: boolean = false): Promise<boolean> {
    try {
        const value = await joplin.settings.globalValue(key);
        return !!value;
    } catch {
        logger.warn(`Global setting '${key}' not found, using default:`, defaultValue);
        return defaultValue;
    }
}
