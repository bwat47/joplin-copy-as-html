import joplin from 'api';
import * as fs from 'fs/promises';
import * as path from 'path';
import { defaultStylesheet } from '../defaultStylesheet';
import { logger } from '../logger';

/**
 * Loads the user stylesheet from the profile directory if present; otherwise returns
 * the bundled default stylesheet. Used when exporting full HTML documents.
 */
export async function getUserStylesheet(): Promise<string> {
    const values: unknown[] = await joplin.settings.globalValues(['profileDir']);
    const [profileDir] = values;
    if (typeof profileDir !== 'string' || !profileDir) {
        return defaultStylesheet;
    }
    const cssPath = path.join(profileDir, 'copy-as-html-user.css');
    try {
        return await fs.readFile(cssPath, 'utf8');
    } catch (err) {
        // A missing file is the normal case; anything else (e.g. permissions, file locks) is worth surfacing
        if ((err as NodeJS.ErrnoException)?.code !== 'ENOENT') {
            logger.warn(`Failed to read user stylesheet ${cssPath}, using default stylesheet:`, err);
        }
        return defaultStylesheet;
    }
}
