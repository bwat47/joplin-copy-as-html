// src/pluginUtils.test.ts
import { safePluginUse, loadPluginsConditionally, PluginConfig } from './pluginUtils';
import MarkdownIt from 'markdown-it';
import { logger } from './logger';

// Mock markdown-it instance
const createMockMd = () => {
    const md = new MarkdownIt();
    // This mock implementation will execute the plugin, which is what the real `use` does.
    md.use = jest.fn().mockImplementation((plugin, options) => {
        plugin(md, options);
    });
    return md;
};

// Mock Plugins
const simplePlugin = jest.fn();
const esModulePlugin = { default: jest.fn() };
const objectPlugin = { plugin: jest.fn() };
const markdownitPlugin = { markdownit: jest.fn() };
const multiVariantPlugin = {
    bare: jest.fn(),
    light: jest.fn(),
    full: jest.fn(),
};
const singleFunctionPlugin = { myPlugin: jest.fn() };
const multiFunctionPlugin = {
    foo: jest.fn(),
    bar: jest.fn(),
};
const errorPlugin = () => {
    throw new Error('Plugin load error');
};

describe('safePluginUse', () => {
    let md: MarkdownIt;

    beforeEach(() => {
        md = createMockMd();
        jest.spyOn(logger, 'warn').mockImplementation(() => {});
        jest.spyOn(logger, 'error').mockImplementation(() => {});
        jest.spyOn(logger, 'debug').mockImplementation(() => {});
    });

    afterEach(() => {
        jest.restoreAllMocks();
        jest.clearAllMocks();
    });

    it('should load a simple function plugin', () => {
        safePluginUse(md, simplePlugin);
        expect(md.use).toHaveBeenCalledWith(simplePlugin, undefined);
        expect(simplePlugin).toHaveBeenCalled();
    });

    it('should load an ES module plugin', () => {
        safePluginUse(md, esModulePlugin);
        expect(md.use).toHaveBeenCalledWith(esModulePlugin.default, undefined);
        expect(esModulePlugin.default).toHaveBeenCalled();
    });

    it('should load an object-wrapped plugin', () => {
        safePluginUse(md, objectPlugin);
        expect(md.use).toHaveBeenCalledWith(objectPlugin.plugin, undefined);
        expect(objectPlugin.plugin).toHaveBeenCalled();
    });

    it('should load a markdownit property plugin', () => {
        safePluginUse(md, markdownitPlugin);
        expect(md.use).toHaveBeenCalledWith(markdownitPlugin.markdownit, undefined);
        expect(markdownitPlugin.markdownit).toHaveBeenCalled();
    });

    it('should load the "full" variant of a multi-variant plugin', () => {
        safePluginUse(md, multiVariantPlugin);
        expect(md.use).toHaveBeenCalledWith(multiVariantPlugin.full, undefined);
        expect(multiVariantPlugin.full).toHaveBeenCalled();
    });

    it('should load a plugin with a single function', () => {
        safePluginUse(md, singleFunctionPlugin);
        expect(md.use).toHaveBeenCalledWith(singleFunctionPlugin.myPlugin, undefined);
        expect(singleFunctionPlugin.myPlugin).toHaveBeenCalled();
    });

    it('should handle multi-function plugins by picking the first one as a fallback', () => {
        safePluginUse(md, multiFunctionPlugin);
        expect(md.use).toHaveBeenCalledWith(multiFunctionPlugin.foo, undefined);
        expect(multiFunctionPlugin.foo).toHaveBeenCalled();
    });

    it('should pass options to the plugin', () => {
        const options = { foo: 'bar' };
        safePluginUse(md, simplePlugin, options);
        expect(md.use).toHaveBeenCalledWith(simplePlugin, options);
        expect(simplePlugin).toHaveBeenCalledWith(expect.anything(), options);
    });

    it('should handle null and undefined plugins gracefully', () => {
        const resultNull = safePluginUse(md, null);
        expect(resultNull).toBe(false);
        expect(md.use).not.toHaveBeenCalled();

        const resultUndefined = safePluginUse(md, undefined);
        expect(resultUndefined).toBe(false);
        expect(md.use).not.toHaveBeenCalled();
    });

    it('should handle plugins that throw errors during loading', () => {
        const result = safePluginUse(md, errorPlugin);
        expect(result).toBe(false);
        expect(md.use).toHaveBeenCalledWith(errorPlugin, undefined);
        expect(logger.error).toHaveBeenCalledWith(
            expect.stringContaining('Error loading markdown-it plugin'),
            expect.any(Error)
        );
    });
});

describe('loadPluginsConditionally', () => {
    let md: MarkdownIt;

    beforeEach(() => {
        md = createMockMd();
        // Reset mocks for each test
        simplePlugin.mockClear();
        esModulePlugin.default.mockClear();
    });

    it('should load enabled plugins', () => {
        const plugins: PluginConfig[] = [
            { name: 'simple', plugin: simplePlugin, enabled: true },
            { name: 'es', plugin: esModulePlugin, enabled: true, options: { a: 1 } },
        ];
        loadPluginsConditionally(md, plugins);
        expect(md.use).toHaveBeenCalledTimes(2);
        expect(simplePlugin).toHaveBeenCalled();
        expect(esModulePlugin.default).toHaveBeenCalled();
    });

    it('should not load disabled plugins', () => {
        const plugins: PluginConfig[] = [
            { name: 'simple', plugin: simplePlugin, enabled: false },
            { name: 'es', plugin: esModulePlugin, enabled: true },
        ];
        loadPluginsConditionally(md, plugins);
        expect(md.use).toHaveBeenCalledTimes(1);
        expect(simplePlugin).not.toHaveBeenCalled();
        expect(esModulePlugin.default).toHaveBeenCalled();
    });

    it('should handle empty plugin list', () => {
        loadPluginsConditionally(md, []);
        expect(md.use).not.toHaveBeenCalled();
    });
});
