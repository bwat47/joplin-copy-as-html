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
 */

import joplin from 'api';
import { PlainTextOptions, HtmlOptions } from './types';
import { logger } from './logger';
import { ToastType } from 'api/types';
import { CONSTANTS } from './constants';

export function validatePlainTextSettings(settings: unknown): PlainTextOptions {
    const s = (settings || {}) as Partial<PlainTextOptions>;
    return {
        preserveSuperscript: validateBooleanSetting(s.preserveSuperscript),
        preserveSubscript: validateBooleanSetting(s.preserveSubscript),
        preserveEmphasis: validateBooleanSetting(s.preserveEmphasis),
        preserveBold: validateBooleanSetting(s.preserveBold),
        preserveHeading: validateBooleanSetting(s.preserveHeading),
        preserveQuoteMarkers: validateBooleanSetting(s.preserveQuoteMarkers),
        preserveStrikethrough: validateBooleanSetting(s.preserveStrikethrough),
        preserveHorizontalRule: validateBooleanSetting(s.preserveHorizontalRule),
        preserveMark: validateBooleanSetting(s.preserveMark),
        preserveInsert: validateBooleanSetting(s.preserveInsert),
        preserveCodeBackticks: validateBooleanSetting(s.preserveCodeBackticks),
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
        listSpacing:
            typeof s.listSpacing === 'string' && ['tight', 'loose'].includes(s.listSpacing)
                ? (s.listSpacing as 'tight' | 'loose')
                : 'tight',
        preserveTablePipes: validateBooleanSetting(s.preserveTablePipes),
    };
}

export function validateHtmlSettings(settings: unknown): HtmlOptions {
    const s = (settings || {}) as Partial<HtmlOptions>;
    return {
        embedImages: validateBooleanSetting(s.embedImages, true),
        exportFullHtml: validateBooleanSetting(s.exportFullHtml, false),
        downloadRemoteImages: validateBooleanSetting(s.downloadRemoteImages, false),
        embedSvgAsPng: validateBooleanSetting(s.embedSvgAsPng, true),
    };
}

export function validateBooleanSetting(setting: unknown, defaultValue: boolean = false): boolean {
    return typeof setting === 'boolean' ? setting : defaultValue;
}

/**
 * Safely extracts a readable message from an unknown error value.
 */
export function getErrorMessage(error: unknown): string {
    return error instanceof Error ? error.message : String(error);
}

/**
 * Displays a toast notification in Joplin.
 * Wraps the Joplin API to provide error handling and consistent defaults.
 * @param message The message to display
 * @param type The type of toast (Info, Success, Error), defaults to Info
 * @param duration Duration in milliseconds, defaults to constant value
 */
export async function showToast(
    message: string,
    type: ToastType = ToastType.Info,
    duration = CONSTANTS.TOAST_DURATION
) {
    try {
        await joplin.views.dialogs.showToast({ message, type, duration });
    } catch (err) {
        logger.warn('Failed to show toast', err);
    }
}
