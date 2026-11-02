import joplin from 'api';
import type { PlainTextOptions, HtmlOptions } from './types';
import { logger } from './logger';
import { ToastType } from 'api/types';
import { DEFAULT_HTML_OPTIONS, DEFAULT_PLAIN_TEXT_OPTIONS } from './constants';

/**
 * Builds plain text options from saved settings, replacing missing or invalid
 * values with the corresponding defaults without coercing their types.
 */
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

/**
 * Builds HTML options from saved settings, replacing missing or non-boolean
 * values with the corresponding defaults.
 */
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
 * @param message - The message to display
 * @param type - The type of toast (Info, Success, Error), defaults to Info
 * @param duration - Duration in milliseconds, defaults to 3 seconds
 */
export async function showToast(message: string, type: ToastType = ToastType.Info, duration = 3000): Promise<void> {
    try {
        await joplin.views.dialogs.showToast({ message, type, duration });
    } catch (err) {
        logger.warn('Failed to show toast', err);
    }
}
