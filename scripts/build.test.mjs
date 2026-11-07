import assert from 'node:assert/strict';
import childProcess from 'node:child_process';
import { createHash } from 'node:crypto';
import { mkdir, mkdtemp, readdir, readFile, rm, writeFile } from 'node:fs/promises';
import { createRequire, isBuiltin, syncBuiltinESMExports } from 'node:module';
import { tmpdir } from 'node:os';
import path from 'node:path';
import test from 'node:test';
import { runInNewContext } from 'node:vm';
import { build } from 'esbuild';
import { list } from 'tar';

import { buildOptions, root } from './buildConfig.mjs';
import { packagePlugin, readProject, VALID_CATEGORIES } from './packagePlugin.mjs';
import { compareGeneratorLists, replaceApi } from './updateApi.mjs';
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

test('packages the runtime files at archive root without dotfiles, with matching publish metadata', async (t) => {
    const { directory, manifest } = await fixture(t);
    await mkdir(path.join(directory, 'dist/assets'));
    await mkdir(path.join(directory, 'dist/empty'));
    await writeFile(path.join(directory, 'dist/assets/example.css'), 'body {}');
    await writeFile(path.join(directory, 'dist/assets/.DS_Store'), 'finder metadata');
    await mkdir(path.join(directory, 'dist/.cache'));
    await writeFile(path.join(directory, 'dist/.cache/state.json'), '{}');
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

test('records the main branch for a detached HEAD in publish metadata', async (t) => {
    const { directory, manifest } = await fixture(t);
    const commit = 'a'.repeat(40);
    t.mock.method(childProcess, 'execFileSync', (command, args) => {
        assert.equal(command, 'git');
        return Buffer.from(args.includes('--abbrev-ref') ? 'HEAD\n' : `${commit}\n`);
    });
    syncBuiltinESMExports();
    t.after(() => {
        t.mock.restoreAll();
        syncBuiltinESMExports();
    });
    await packagePlugin(directory, manifest);
    const info = JSON.parse(await readFile(path.join(directory, 'publish/test.copyashtml.json'), 'utf8'));
    assert.equal(info._publish_commit, `main:${commit}`);
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

test('version bumps change only the version in hand-formatted package.json and manifest', async (t) => {
    const { directory } = await fixture(t);
    const manifestText = (version) =>
        `{\n    "manifest_version": 1,\n    "id": "test.copyashtml",\n    "version": "${version}",\n` +
        `    "categories": ["productivity", "editor"],\n    "promo_tile": {\n        "src": "promo.png"\n    }\n}\n`;
    const packageText = (version) =>
        `{\n    "name": "joplin-plugin-test",\n    "version": "${version}",\n` +
        `    "keywords": [\n        "joplin-plugin"\n    ],\n    "devDependencies": { "dep": "1.2.3" }\n}\n`;
    await writeFile(path.join(directory, 'src/manifest.json'), manifestText('1.2.3'));
    await writeFile(path.join(directory, 'package.json'), packageText('1.2.3'));
    await writeFile(
        path.join(directory, 'package-lock.json'),
        JSON.stringify({ version: '1.2.3', packages: { '': { version: '1.2.3' } } })
    );
    await updateVersion(directory);
    assert.equal(await readFile(path.join(directory, 'src/manifest.json'), 'utf8'), manifestText('1.2.4'));
    assert.equal(await readFile(path.join(directory, 'package.json'), 'utf8'), packageText('1.2.4'));
});

test('version bumps write nothing when a version entry is ambiguous', async (t) => {
    const { directory, manifest } = await fixture(t);
    const ambiguousManifest = JSON.stringify({ ...manifest, nested: { version: '1.2.3' } });
    await writeFile(path.join(directory, 'src/manifest.json'), ambiguousManifest);
    const lockText = JSON.stringify({ version: '1.2.3', packages: { '': { version: '1.2.3' } } });
    await writeFile(path.join(directory, 'package-lock.json'), lockText);
    const packageText = await readFile(path.join(directory, 'package.json'), 'utf8');
    await assert.rejects(updateVersion(directory), /Expected one "version"/);
    assert.equal(await readFile(path.join(directory, 'package.json'), 'utf8'), packageText);
    assert.equal(await readFile(path.join(directory, 'src/manifest.json'), 'utf8'), ambiguousManifest);
    assert.equal(await readFile(path.join(directory, 'package-lock.json'), 'utf8'), lockText);
});

test('version bumps explain a lockfile without a root entry or out of sync, and write nothing', async (t) => {
    const { directory } = await fixture(t);
    const lockPath = path.join(directory, 'package-lock.json');
    const packageText = await readFile(path.join(directory, 'package.json'), 'utf8');
    for (const [lock, message] of [
        [{ version: '1.2.3' }, /no root package entry/],
        [{ version: '1.2.3', packages: { '': { version: '1.0.0' } } }, /do not match package\.json/],
        [{ version: '1.0.0', packages: { '': { version: '1.2.3' } } }, /do not match package\.json/],
    ]) {
        await writeFile(lockPath, JSON.stringify(lock));
        await assert.rejects(updateVersion(directory), message);
        assert.equal(await readFile(lockPath, 'utf8'), JSON.stringify(lock));
        assert.equal(await readFile(path.join(directory, 'package.json'), 'utf8'), packageText);
    }
});

async function apiFixture(t) {
    const directory = await mkdtemp(path.join(tmpdir(), 'copy-as-html-api-'));
    t.after(() => rm(directory, { recursive: true, force: true }));
    await mkdir(path.join(directory, 'api'));
    await writeFile(path.join(directory, 'api/index.ts'), 'old');
    await writeFile(path.join(directory, 'api/Stale.d.ts'), 'stale');
    return directory;
}

/** Builds the category declaration used by generator-joplin's webpack.config.js. */
function generatorWebpackConfig(categories) {
    const entries = categories.map((name) => `{'name':'${name}'}`).join(',');
    return `const allPossibleCategories = [${entries}];`;
}

test('reports no generator category warnings when the lists match', () => {
    assert.deepEqual(compareGeneratorLists(generatorWebpackConfig([...VALID_CATEGORIES])), []);
});

test('warns when generator categories differ or cannot be found', () => {
    const categories = [...VALID_CATEGORIES].filter((category) => category !== 'themes').concat('new category');
    const warnings = compareGeneratorLists(generatorWebpackConfig(categories));
    assert.equal(warnings.length, 1);
    assert.match(warnings[0], /plugin categories.*missing new category; not in generator themes.*VALID_CATEGORIES/);
    const missing = compareGeneratorLists('module.exports = {};');
    assert.equal(missing.length, 1);
    assert.match(missing[0], /Could not find.*plugin categories.*manually/);
});

test('replaces api/ with the generator copy and leaves no staging directories', async (t) => {
    const directory = await apiFixture(t);
    const source = path.join(directory, 'generator-api');
    await mkdir(path.join(source, 'types'), { recursive: true });
    await writeFile(path.join(source, 'index.ts'), 'new');
    await writeFile(path.join(source, 'types/index.ts'), 'types');
    await replaceApi(directory, source);
    assert.deepEqual((await readdir(path.join(directory, 'api'))).sort(), ['index.ts', 'types']);
    assert.equal(await readFile(path.join(directory, 'api/index.ts'), 'utf8'), 'new');
    assert.deepEqual((await readdir(directory)).sort(), ['api', 'generator-api']);
});

test('leaves api/ unchanged when the generator API is missing or cannot be copied', async (t) => {
    const directory = await apiFixture(t);
    await assert.rejects(replaceApi(directory, path.join(directory, 'missing')), { code: 'ENOENT' });
    const source = path.join(directory, 'generator-api');
    await mkdir(source);
    await writeFile(path.join(source, 'index.ts'), 'new');
    // Fail after part of the new API has been written to staging.
    const failingCopy = async (from, to) => {
        await writeFile(path.join(to, 'index.ts'), 'partial');
        throw new Error('copy failed');
    };
    await assert.rejects(replaceApi(directory, source, failingCopy), /copy failed/);
    assert.deepEqual((await readdir(path.join(directory, 'api'))).sort(), ['Stale.d.ts', 'index.ts']);
    assert.equal(await readFile(path.join(directory, 'api/index.ts'), 'utf8'), 'old');
    assert.deepEqual((await readdir(directory)).sort(), ['api', 'generator-api']);
});
