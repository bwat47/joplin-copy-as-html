import { execFileSync } from 'node:child_process';
import { cp, mkdtemp, readdir, readFile, rm, stat } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { extract } from 'tar';

const templateApi = 'package/generators/app/templates/api';

/**
 * Runs npm with fixed arguments. Under `npm run`, npm_execpath points at npm's CLI script,
 * which avoids spawning npm.cmd through a shell on Windows.
 */
function npm(args, cwd) {
    const npmCli = process.env.npm_execpath;
    if (npmCli?.endsWith('.js')) {
        execFileSync(process.execPath, [npmCli, ...args], { cwd, stdio: 'pipe' });
    } else if (process.platform === 'win32') {
        throw new Error('Run this script with: npm run updateApi');
    } else {
        // eslint-disable-next-line sonarjs/no-os-command-from-path
        execFileSync('npm', args, { cwd, stdio: 'pipe' });
    }
}

/**
 * Replaces `<root>/api` with the API declarations from the latest generator-joplin package.
 * Nothing else in the project is touched. Returns the generator version used.
 */
export async function updateApi(root, packageSpec = 'generator-joplin@latest') {
    const temp = await mkdtemp(path.join(tmpdir(), 'joplin-api-'));
    try {
        npm(['pack', packageSpec, '--pack-destination', temp], temp);
        // The --json output shape differs between npm versions, so locate the tarball instead.
        const tarball = (await readdir(temp)).find((name) => name.endsWith('.tgz'));
        if (!tarball) throw new Error(`npm pack did not produce a tarball for ${packageSpec}`);
        await extract({ file: path.join(temp, tarball), cwd: temp, strict: true });
        const source = path.join(temp, templateApi);
        // Fail before deleting anything if the generator layout has changed.
        await stat(path.join(source, 'index.ts'));
        const { version } = JSON.parse(await readFile(path.join(temp, 'package/package.json'), 'utf8'));

        const destination = path.join(root, 'api');
        await rm(destination, { recursive: true, force: true });
        await cp(source, destination, { recursive: true });
        return version;
    } finally {
        await rm(temp, { recursive: true, force: true });
    }
}

if (process.argv[1] && path.resolve(process.argv[1]) === fileURLToPath(import.meta.url)) {
    const version = await updateApi(fileURLToPath(new URL('../', import.meta.url)));
    console.info(`Updated api/ from generator-joplin ${version}. Review with: git diff api/`);
}
