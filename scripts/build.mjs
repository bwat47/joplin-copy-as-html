import { cp, mkdir, rm } from 'node:fs/promises';
import path from 'node:path';
import { build } from 'esbuild';

import { buildOptions, root } from './buildConfig.mjs';
import { packagePlugin, readProject } from './packagePlugin.mjs';

const dist = path.join(root, 'dist');
const publish = path.join(root, 'publish');
const { manifest } = await readProject(root);

// Only these fixed, project-local output directories are removed.
await rm(dist, { recursive: true, force: true });
await rm(publish, { recursive: true, force: true });
await mkdir(dist, { recursive: true });

await build(buildOptions);

// Match the generator's runtime asset copying, excluding TypeScript sources.
await cp(path.join(root, 'src'), dist, {
    recursive: true,
    // For example, skip renderer.ts and renderer.test.ts; retain manifest.json.
    filter: (source) => !/\.tsx?$/.test(source),
});

await packagePlugin(root, manifest);
