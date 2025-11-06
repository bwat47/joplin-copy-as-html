/**
 * @fileoverview Loads ESM-only markdown-it plugins in a CommonJS environment.
 * Handles dynamic imports and caching for markdown-it-github-alerts and @mdit/plugin-tasklist.
 */

import type MarkdownIt from 'markdown-it';
import { logger } from './logger';

type ESMPlugin = (md: MarkdownIt, options?: unknown) => void;

let githubAlertsCache: ESMPlugin | null = null;
let taskListCache: ESMPlugin | null = null;

export async function getGithubAlertsPlugin(): Promise<ESMPlugin | null> {
    if (!githubAlertsCache) {
        try {
            const module = await import('markdown-it-github-alerts');
            githubAlertsCache = module.default;
        } catch (error) {
            logger.error('Failed to load markdown-it-github-alerts', error);
            return null;
        }
    }
    return githubAlertsCache;
}

export async function getTaskListPlugin(): Promise<ESMPlugin | null> {
    if (!taskListCache) {
        try {
            const module = await import('@mdit/plugin-tasklist');
            taskListCache = module.tasklist;
        } catch (error) {
            logger.error('Failed to load @mdit/plugin-tasklist', error);
            return null;
        }
    }
    return taskListCache;
}

export function clearESMPluginCache(): void {
    githubAlertsCache = null;
    taskListCache = null;
}
