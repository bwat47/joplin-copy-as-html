import { cp, mkdir, rm } from 'node:fs/promises';
import path from 'node:path';
import { build } from 'esbuild';

import { buildOptions, root, TYPESCRIPT_SOURCE_PATTERN } from './buildConfig.mjs';
import { packagePlugin, readProject } from './packagePlugin.mjs';

const dist = path.join(root, 'dist');
const publish = path.join(root, 'publish');
const { manifest } = await readProject(root);

// Only these fixed, project-local output directories are removed.
await rm(dist, { recursive: true, force: true });
await rm(publish, { recursive: true, force: true });
await mkdir(dist, { recursive: true });

// Copy first so a JavaScript source asset cannot overwrite the compiled bundle.
await cp(path.join(root, 'src'), dist, {
    recursive: true,
    filter: (source) => !TYPESCRIPT_SOURCE_PATTERN.test(source),
});

await build(buildOptions);

await packagePlugin(root, manifest);
