/**
 * @fileoverview Centralized logger with configurable log levels.
 *
 * Provides consistent prefixing for all plugin logs and exposes runtime
 * controls via the browser console for dynamic log level adjustment.
 *
 * modified from: https://github.com/cipherswami/joplin-plugin-quick-note/blob/main/src/logger.ts
 */

const PREFIX = '[copy-as-html]';

/**
 * Log level enumeration.
 * Lower values indicate greater verbosity.
 */
export enum LogLevel {
    DEBUG = 0,
    INFO = 1,
    WARN = 2,
    ERROR = 3,
    NONE = 4,
}

class Logger {
    private level: LogLevel;

    constructor(
        private prefix: string,
        initialLevel: LogLevel = LogLevel.INFO
    ) {
        this.level = initialLevel;
    }

    setLevel(level: LogLevel): void {
        this.level = level;
        const levelName = LogLevel[level];
        console.info(`${this.prefix} Log level set to: ${levelName} (${level})`);
    }

    getLevel(): LogLevel {
        const levelName = LogLevel[this.level];
        console.info(`${this.prefix} Current log level: ${levelName} (${this.level})`);
        return this.level;
    }

    debug(message: string, ...args: unknown[]): void {
        if (this.level <= LogLevel.DEBUG) {
            console.debug(this.prefix, message, ...args);
        }
    }

    info(message: string, ...args: unknown[]): void {
        if (this.level <= LogLevel.INFO) {
            console.info(this.prefix, message, ...args);
        }
    }

    warn(message: string, ...args: unknown[]): void {
        if (this.level <= LogLevel.WARN) {
            console.warn(this.prefix, message, ...args);
        }
    }

    error(message: string, ...args: unknown[]): void {
        if (this.level <= LogLevel.ERROR) {
            console.error(this.prefix, message, ...args);
        }
    }
}

function createLogger(prefix: string, initialLevel?: LogLevel): Logger {
    const loggerInstance = new Logger(prefix, initialLevel);

    // Expose logger controls to browser console for runtime debugging
    if (typeof window !== 'undefined') {
        (window as unknown as { joplinLogger: unknown }).joplinLogger = {
            setLevel: (level: LogLevel) => loggerInstance.setLevel(level),
            getLevel: () => loggerInstance.getLevel(),
            LogLevel, // Export enum for convenience
        };
    }

    return loggerInstance;
}

export const logger = createLogger(PREFIX, LogLevel.WARN);
