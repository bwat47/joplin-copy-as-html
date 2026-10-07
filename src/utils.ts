/**
 * @fileoverview Utility Functions - Settings validation, error messages, and toasts
 *
 * Contains validation functions that ensure user settings conform to expected
 * types and provide sensible defaults for invalid values, plus small shared
 * helpers for extracting error messages and showing toast notifications.
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
import { CONSTANTS, DEFAULT_HTML_OPTIONS, DEFAULT_PLAIN_TEXT_OPTIONS } from './constants';

export function validatePlainTextSettings(settings: unknown): PlainTextOptions {
    const s = (settings || {}) as Partial<PlainTextOptions>;
    const d = DEFAULT_PLAIN_TEXT_OPTIONS;
    return {
        preserveSuperscript: validateBooleanSetting(s.preserveSuperscript, d.preserveSuperscript),
        preserveSubscript: validateBooleanSetting(s.preserveSubscript, d.preserveSubscript),
        preserveEmphasis: validateBooleanSetting(s.preserveEmphasis, d.preserveEmphasis),
        preserveBold: validateBooleanSetting(s.preserveBold, d.preserveBold),
        preserveHeading: validateBooleanSetting(s.preserveHeading, d.preserveHeading),
        preserveQuoteMarkers: validateBooleanSetting(s.preserveQuoteMarkers, d.preserveQuoteMarkers),
        preserveStrikethrough: validateBooleanSetting(s.preserveStrikethrough, d.preserveStrikethrough),
        preserveHorizontalRule: validateBooleanSetting(s.preserveHorizontalRule, d.preserveHorizontalRule),
        preserveMark: validateBooleanSetting(s.preserveMark, d.preserveMark),
        preserveInsert: validateBooleanSetting(s.preserveInsert, d.preserveInsert),
        preserveCodeBackticks: validateBooleanSetting(s.preserveCodeBackticks, d.preserveCodeBackticks),
        displayEmojis: validateBooleanSetting(s.displayEmojis, d.displayEmojis),
        hyperlinkBehavior: validateEnumSetting(s.hyperlinkBehavior, ['title', 'url', 'markdown'], d.hyperlinkBehavior),
        indentType: validateEnumSetting(s.indentType, ['spaces', 'tabs'], d.indentType),
        listSpacing: validateEnumSetting(s.listSpacing, ['tight', 'loose'], d.listSpacing),
        preserveTablePipes: validateBooleanSetting(s.preserveTablePipes, d.preserveTablePipes),
    };
}

export function validateHtmlSettings(settings: unknown): HtmlOptions {
    const s = (settings || {}) as Partial<HtmlOptions>;
    const d = DEFAULT_HTML_OPTIONS;
    return {
        embedImages: validateBooleanSetting(s.embedImages, d.embedImages),
        exportFullHtml: validateBooleanSetting(s.exportFullHtml, d.exportFullHtml),
        downloadRemoteImages: validateBooleanSetting(s.downloadRemoteImages, d.downloadRemoteImages),
        embedSvgAsPng: validateBooleanSetting(s.embedSvgAsPng, d.embedSvgAsPng),
    };
}

export function validateBooleanSetting(setting: unknown, defaultValue: boolean): boolean {
    return typeof setting === 'boolean' ? setting : defaultValue;
}

/**
 * Returns `setting` if it is one of the `allowed` values, otherwise `defaultValue`.
 */
function validateEnumSetting<T extends string>(setting: unknown, allowed: readonly T[], defaultValue: T): T {
    return allowed.some((value) => value === setting) ? (setting as T) : defaultValue;
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
): Promise<void> {
    try {
        await joplin.views.dialogs.showToast({ message, type, duration });
    } catch (err) {
        logger.warn('Failed to show toast', err);
    }
}
