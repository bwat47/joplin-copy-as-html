import type MarkdownIt from 'markdown-it';

// ESM Plugin Cache and Loaders
type ESMPlugin = (md: MarkdownIt, options?: unknown) => void;
type ESMImporter = () => Promise<unknown>;

interface CacheEntry {
    plugin: ESMPlugin | null;
    promise?: Promise<ESMPlugin | null>;
}

const esmPluginCache = new Map<string, CacheEntry>();
const esmImporters: Record<string, ESMImporter> = {
    // Keep explicit mapping so Webpack can statically include these modules in the bundle.
    'markdown-it-github-alerts': () =>
        import(/* webpackChunkName: "markdown-it-github-alerts" */ 'markdown-it-github-alerts'),
};

export function registerESMPlugin(packageName: string, importer: ESMImporter): void {
    esmImporters[packageName] = importer;
}

export async function loadESMPlugin(packageName: string, exportName: string = 'default'): Promise<ESMPlugin | null> {
    const cacheKey = `${packageName}:${exportName}`;
    const cached = esmPluginCache.get(cacheKey);

    if (cached && !cached.promise) {
        return cached.plugin;
    }

    if (cached && cached.promise) {
        return cached.promise;
    }

    const importer = esmImporters[packageName];
    if (!importer) {
        console.warn(`[copy-as-html] No importer registered for ESM plugin ${packageName}`);
        return null;
    }

    const importPromise = (async (): Promise<ESMPlugin | null> => {
        try {
            const module = await importer();
            const moduleNamespace = module as Record<string, unknown>;
            const exportCandidate = moduleNamespace[exportName] ?? moduleNamespace.default ?? module;

            if (typeof exportCandidate !== 'function') {
                console.warn(`[copy-as-html] ESM plugin ${packageName}.${exportName} is not a function`);
                return null;
            }

            return exportCandidate as ESMPlugin;
        } catch (error) {
            console.warn(`[copy-as-html] Failed to load ESM plugin ${packageName}:`, error);
            return null;
        }
    })();

    esmPluginCache.set(cacheKey, { plugin: null, promise: importPromise });
    const plugin = await importPromise;
    esmPluginCache.set(cacheKey, { plugin });

    return plugin;
}

// Convenience functions for specific plugins
// If you encounter a factory pattern, handle it explicitly
export async function getGithubAlertsPlugin(): Promise<ESMPlugin | null> {
    return loadESMPlugin('markdown-it-github-alerts', 'default');
}

export function clearESMPluginCache(): void {
    esmPluginCache.clear();
}
