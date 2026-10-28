import joplin from 'api';
import * as fs from 'fs/promises';
import * as path from 'path';
import { defaultStylesheet } from '../defaultStylesheet';
import { logger } from '../logger';
import { getUserStylesheet } from './stylesheet';

vi.mock('fs/promises', () => ({ readFile: vi.fn() }));

describe('getUserStylesheet', () => {
    it('loads the stylesheet from the profile returned by globalValues', async () => {
        vi.mocked(joplin.settings.globalValues).mockResolvedValue(['/profile']);
        vi.mocked(fs.readFile).mockResolvedValue('body { color: red; }');

        expect(await getUserStylesheet()).toBe('body { color: red; }');
        expect(joplin.settings.globalValues).toHaveBeenCalledWith(['profileDir']);
        expect(fs.readFile).toHaveBeenCalledWith(path.join('/profile', 'copy-as-html-user.css'), 'utf8');
    });

    it.each([undefined, '', 42])('uses the default stylesheet for an invalid profile: %s', async (profileDir) => {
        vi.mocked(joplin.settings.globalValues).mockResolvedValue([profileDir]);

        expect(await getUserStylesheet()).toBe(defaultStylesheet);
        expect(fs.readFile).not.toHaveBeenCalled();
    });

    it('silently uses the default stylesheet when the user stylesheet does not exist', async () => {
        vi.mocked(joplin.settings.globalValues).mockResolvedValue(['/profile']);
        vi.mocked(fs.readFile).mockRejectedValue(Object.assign(new Error('File not found'), { code: 'ENOENT' }));
        const warn = vi.spyOn(logger, 'warn').mockImplementation(() => {});

        expect(await getUserStylesheet()).toBe(defaultStylesheet);
        expect(warn).not.toHaveBeenCalled();
    });

    it('warns and uses the default stylesheet when the user stylesheet cannot be read', async () => {
        vi.mocked(joplin.settings.globalValues).mockResolvedValue(['/profile']);
        const error = Object.assign(new Error('Permission denied'), { code: 'EACCES' });
        vi.mocked(fs.readFile).mockRejectedValue(error);
        const warn = vi.spyOn(logger, 'warn').mockImplementation(() => {});

        expect(await getUserStylesheet()).toBe(defaultStylesheet);
        expect(warn).toHaveBeenCalledWith(expect.stringContaining('copy-as-html-user.css'), error);
    });
});
