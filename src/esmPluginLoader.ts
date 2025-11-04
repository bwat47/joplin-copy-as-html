import type MarkdownIt from 'markdown-it';
import { logger } from './logger';

// ESM Plugin Cache and Loaders
type ESMPlugin = (md: MarkdownIt, options?: unknown) => void;
type ESMImporter = () => Promise<unknown>;

const esmPluginCache = new Map<string, Promise<ESMPlugin | null>>();
const esmImporters: Record<string, ESMImporter> = {
    // Keep explicit mapping so Webpack can statically include these modules in the bundle.
    'markdown-it-github-alerts': () =>
        import(/* webpackChunkName: "markdown-it-github-alerts" */ 'markdown-it-github-alerts'),
    '@mdit/plugin-tasklist': () => import(/* webpackChunkName: "mdit-plugin-tasklist" */ '@mdit/plugin-tasklist'),
};

export function registerESMPlugin(packageName: string, importer: ESMImporter): void {
    esmImporters[packageName] = importer;
}

async function tryDynamicImportFallback(packageName: string): Promise<Record<string, unknown> | null> {
    try {
        const dynamicImport = new Function('specifier', 'return import(specifier);') as (
            specifier: string
        ) => Promise<unknown>;
        return (await dynamicImport(packageName)) as Record<string, unknown>;
    } catch (fallbackError) {
        logger.warn(`Dynamic import fallback failed for ${packageName}:`, fallbackError);
        return null;
    }
}

export async function loadESMPlugin(packageName: string, exportName: string = 'default'): Promise<ESMPlugin | null> {
    const cacheKey = `${packageName}:${exportName}`;
    const cached = esmPluginCache.get(cacheKey);
    if (cached) {
        return cached;
    }

    const importer = esmImporters[packageName];
    if (!importer) {
        logger.warn(`No importer registered for ESM plugin ${packageName}`);
        return null;
    }

    const importPromise: Promise<ESMPlugin | null> = (async (): Promise<ESMPlugin | null> => {
        let moduleNamespace: Record<string, unknown>;
        try {
            moduleNamespace = (await importer()) as Record<string, unknown>;
        } catch (error) {
            if ((error as { code?: string })?.code !== 'ERR_REQUIRE_ESM') {
                logger.warn(`Failed to load ESM plugin ${packageName}:`, error);
                return null;
            }
            const fallbackModule = await tryDynamicImportFallback(packageName);
            if (!fallbackModule) {
                return null;
            }
            moduleNamespace = fallbackModule;
        }

        const exportCandidate = moduleNamespace[exportName] ?? moduleNamespace.default ?? moduleNamespace;

        if (typeof exportCandidate !== 'function') {
            logger.warn(`ESM plugin ${packageName}.${exportName} is not a function`);
            return null;
        }

        return exportCandidate as ESMPlugin;
    })();

    esmPluginCache.set(cacheKey, importPromise);

    return importPromise;
}

// Convenience functions for specific plugins
// If you encounter a factory pattern, handle it explicitly
export async function getGithubAlertsPlugin(): Promise<ESMPlugin | null> {
    return loadESMPlugin('markdown-it-github-alerts', 'default');
}

export async function getTaskListPlugin(): Promise<ESMPlugin | null> {
    return loadESMPlugin('@mdit/plugin-tasklist', 'tasklist');
}

export function clearESMPluginCache(): void {
    esmPluginCache.clear();
}
