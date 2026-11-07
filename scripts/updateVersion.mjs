import { readFile, writeFile } from 'node:fs/promises';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

import { readProject } from './packagePlugin.mjs';

export async function updateVersion(root) {
    const { packageJson, manifest } = await readProject(root);
    const lockPath = path.join(root, 'package-lock.json');
    const lock = JSON.parse(await readFile(lockPath, 'utf8'));
    if (!/^\d+\.\d+\.\d+$/.test(packageJson.version)) {
        throw new Error('updateVersion requires a version in major.minor.patch format.');
    }
    const [major, minor, patch] = packageJson.version.split('.').map(Number);
    const version = `${major}.${minor}.${patch + 1}`;
    packageJson.version = version;
    manifest.version = version;
    lock.version = version;
    lock.packages[''].version = version;

    for (const [filename, content] of [
        ['package.json', packageJson],
        ['src/manifest.json', manifest],
        ['package-lock.json', lock],
    ]) {
        await writeFile(path.join(root, filename), `${JSON.stringify(content, null, 4)}\n`);
    }
}

if (process.argv[1] && path.resolve(process.argv[1]) === fileURLToPath(import.meta.url)) {
    await updateVersion(fileURLToPath(new URL('../', import.meta.url)));
}
