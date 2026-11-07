import assert from 'node:assert/strict';
import { createHash } from 'node:crypto';
import { mkdir, mkdtemp, readdir, readFile, rm, writeFile } from 'node:fs/promises';
import { createRequire, isBuiltin } from 'node:module';
import { tmpdir } from 'node:os';
import path from 'node:path';
import test from 'node:test';
import { runInNewContext } from 'node:vm';
import { build } from 'esbuild';
import { list } from 'tar';

import { buildOptions, root } from './buildConfig.mjs';
import { packagePlugin, readProject } from './packagePlugin.mjs';
import { updateVersion } from './updateVersion.mjs';

const require = createRequire(import.meta.url);

async function fixture(t) {
    const directory = await mkdtemp(path.join(tmpdir(), 'copy-as-html-build-'));
    t.after(() => rm(directory, { recursive: true, force: true }));
    await mkdir(path.join(directory, 'src'));
    await mkdir(path.join(directory, 'dist'));
    const manifest = { id: 'test.copyashtml', version: '1.2.3', categories: ['productivity'] };
    await writeFile(path.join(directory, 'src/manifest.json'), JSON.stringify(manifest));
    await writeFile(path.join(directory, 'dist/manifest.json'), JSON.stringify(manifest));
    await writeFile(path.join(directory, 'dist/index.js'), '/* bundled plugin */');
    await writeFile(
        path.join(directory, 'package.json'),
        JSON.stringify({
            name: 'joplin-plugin-test',
            version: '1.2.3',
            keywords: ['joplin-plugin'],
        })
    );
    return { directory, manifest };
}

test('packages the runtime files at archive root with matching publish metadata', async (t) => {
    const { directory, manifest } = await fixture(t);
    await mkdir(path.join(directory, 'dist/assets'));
    await mkdir(path.join(directory, 'dist/empty'));
    await writeFile(path.join(directory, 'dist/assets/example.css'), 'body {}');
    await packagePlugin(directory, manifest);
    const publish = path.join(directory, 'publish');
    assert.deepEqual((await readdir(publish)).sort(), ['test.copyashtml.jpl', 'test.copyashtml.json']);
    const archive = path.join(publish, 'test.copyashtml.jpl');
    const entries = [];
    await list({ file: archive, onReadEntry: (entry) => entries.push(entry.path) });
    assert.deepEqual(entries.sort(), ['assets/example.css', 'index.js', 'manifest.json']);
    const info = JSON.parse(await readFile(path.join(publish, 'test.copyashtml.json'), 'utf8'));
    const hash = createHash('sha256')
        .update(await readFile(archive))
        .digest('hex');
    assert.deepEqual(info, { ...manifest, _publish_hash: `sha256:${hash}`, _publish_commit: '' });
});

test('rejects incomplete builds and propagates archive write failures', async (t) => {
    const { directory, manifest } = await fixture(t);
    await rm(path.join(directory, 'dist/index.js'));
    await assert.rejects(packagePlugin(directory, manifest), { code: 'ENOENT' });
    await writeFile(path.join(directory, 'dist/index.js'), '/* plugin */');
    await writeFile(path.join(directory, 'publish'), 'blocks output directory');
    await assert.rejects(packagePlugin(directory, manifest));
});

test('validates manifest versions, categories, and local screenshots before building', async (t) => {
    const { directory, manifest } = await fixture(t);
    await readProject(directory);
    for (const [change, message] of [
        [{ version: '9.0.0' }, /versions must match/],
        [{ categories: ['unknown'] }, /categories/],
        [{ categories: ['editor', 'editor'] }, /categories/],
        [{ screenshots: [{}] }, /specify src/],
        [{ screenshots: [{ src: 'missing.png' }] }, /ENOENT/],
    ]) {
        await writeFile(path.join(directory, 'src/manifest.json'), JSON.stringify({ ...manifest, ...change }));
        await assert.rejects(readProject(directory), message);
    }
});

test('bumps package, manifest, and both lockfile versions together', async (t) => {
    const { directory } = await fixture(t);
    await writeFile(
        path.join(directory, 'package-lock.json'),
        JSON.stringify({
            version: '1.2.3',
            packages: { '': { version: '1.2.3' } },
        })
    );
    await updateVersion(directory);
    const { packageJson, manifest } = await readProject(directory);
    const lock = JSON.parse(await readFile(path.join(directory, 'package-lock.json'), 'utf8'));
    assert.equal(packageJson.version, '1.2.4');
    assert.equal(manifest.version, '1.2.4');
    assert.equal(lock.version, '1.2.4');
    assert.equal(lock.packages[''].version, '1.2.4');
});

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
