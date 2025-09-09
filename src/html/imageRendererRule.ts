/**
 * @fileoverview Image renderer rule installer
 *
 * Installs a markdown-it renderer rule for `image` tokens that:
 * - Swaps `src` with a prebuilt map value when available (embedding)
 * - Optionally strips Joplin resource images when embedding is disabled
 */

import type MarkdownIt from 'markdown-it';
import { LINK_RESOURCE_MATCHERS } from '../constants';
import type { HtmlOptions } from '../types';

function isJoplinResourceUrl(src: string): boolean {
    return LINK_RESOURCE_MATCHERS.some((rx) => rx.test(src));
}

export function installImageSwapRule(
    md: MarkdownIt,
    imageSrcMap: Map<string, string>,
    options: HtmlOptions
): void {
    const defaultImage =
        md.renderer.rules.image || ((tokens, idx, _opts, _env, self) => self.renderToken(tokens, idx, _opts));

    md.renderer.rules.image = function (tokens, idx, opts, env, self) {
        const token = tokens[idx];
        const srcIdx = token.attrIndex('src');
        const src = srcIdx >= 0 ? token.attrs![srcIdx][1] : '';

        // If embedding is disabled and this is a Joplin resource, strip the image entirely
        if (!options.embedImages && src && isJoplinResourceUrl(src)) {
            return '';
        }

        // Swap to embedded data URI when available in the map
        const mapped = src ? imageSrcMap.get(src) : undefined;
        if (mapped && mapped.startsWith('data:image/')) {
            if (srcIdx >= 0) token.attrs![srcIdx][1] = mapped;
            else token.attrPush(['src', mapped]);
        }

        return defaultImage(tokens, idx, opts, env, self);
    };
}

