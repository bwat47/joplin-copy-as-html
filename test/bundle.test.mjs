import assert from 'node:assert/strict';
import { createRequire, isBuiltin } from 'node:module';
import path from 'node:path';
import test from 'node:test';
import { fileURLToPath } from 'node:url';
import { runInNewContext } from 'node:vm';
import { createBuildOptions, readPluginConfig } from '@bwat47/joplin-plugin-scripts';
import { build } from 'esbuild';

const require = createRequire(import.meta.url);
const root = fileURLToPath(new URL('../', import.meta.url));
// plugin.config.json keeps JSDOM external and points MathJax's #default-font at the TeX font.
const { mainBuildOptions } = await readPluginConfig(root);
const buildOptions = createBuildOptions(root, mainBuildOptions);

test('the production bundle registers with Joplin without requiring external packages', async () => {
    const result = await build({ ...buildOptions, write: false, metafile: true, logLevel: 'silent' });
    let registered = false;
    // Execute only the bundle just built from this repository, with a restricted require.
    // eslint-disable-next-line sonarjs/code-eval
    runInNewContext(result.outputFiles[0].text, {
        joplin: {
            plugins: {
                register: (plugin) => {
                    registered = typeof plugin.onStart === 'function';
                },
            },
        },
        console,
        setTimeout,
        clearTimeout,
        TextEncoder,
        TextDecoder,
        URL,
        URLSearchParams,
        require: (name) => {
            if (name.startsWith('node:')) throw new Error(`Unexpected node: prefix: ${name}`);
            if (isBuiltin(name)) return require(name);
            throw new Error(`Unexpected runtime dependency: ${name}`);
        },
    });
    assert.equal(registered, true);
    const inputs = Object.keys(result.metafile.inputs);
    assert.ok(inputs.some((input) => input.includes('mathjax-tex-font')));
    assert.ok(!inputs.some((input) => input.includes('mathjax-newcm-font') || input.includes('node_modules/jsdom/')));
});

test('bundled MathJax renders TeX and chemistry without font loading or JSDOM', async () => {
    const result = await build({
        ...buildOptions,
        entryPoints: [path.join(root, 'src/html/texRenderer.ts')],
        write: false,
        logLevel: 'silent',
    });
    const module = { exports: {} };
    // Execute our freshly built renderer to exercise bundling and minification, not external code.
    // eslint-disable-next-line sonarjs/code-eval
    runInNewContext(result.outputFiles[0].text, {
        module,
        exports: module.exports,
        require: (name) => {
            throw new Error(`Unexpected runtime dependency: ${name}`);
        },
    });
    for (const tex of ['x^2 + y^2 = z^2', '\\frac{1}{2}', '\\ce{H2O}']) {
        const result = module.exports.renderTexToSvg(tex, true);
        assert.match(result.svg, /<svg/);
        assert.match(result.svg, /<path/);
        assert.ok(result.width > 0 && result.height > 0);
    }
});
