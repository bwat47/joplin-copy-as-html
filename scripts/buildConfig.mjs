import path from 'node:path';
import { fileURLToPath } from 'node:url';

export const root = fileURLToPath(new URL('../', import.meta.url));

/** @type {import('esbuild').BuildOptions} */
export const buildOptions = {
    absWorkingDir: root,
    entryPoints: ['src/index.ts'],
    outfile: 'dist/index.js',
    bundle: true,
    platform: 'node',
    format: 'cjs',
    target: 'es2020',
    minify: true,
    // JSDOM is an optional MathJax dependency; the plugin uses liteAdaptor.
    external: ['jsdom'],
    alias: {
        api: path.join(root, 'api'),
        // MathJax imports its default font even when given explicit fontData.
        // Reuse our TeX font instead of bundling the unused NewCM font.
        '#default-font': path.join(root, 'node_modules/@mathjax/mathjax-tex-font/mjs'),
    },
    plugins: [
        {
            // Rewrite Node built-in imports to their bare names, e.g. node:path -> path,
            // matching the previous Webpack build for Joplin's plugin runtime.
            name: 'strip-node-prefix',
            setup(pluginBuild) {
                pluginBuild.onResolve({ filter: /^node:/ }, (args) => ({
                    path: args.path.slice('node:'.length),
                    external: true,
                }));
            },
        },
    ],
    logLevel: 'info',
};
