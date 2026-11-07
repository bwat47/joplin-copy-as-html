# Building the plugin

Install dependencies with `npm ci`, then run `npm run dist`. The build first
checks TypeScript with `tsc --noEmit`, then bundles `src/index.ts` with esbuild
and packages the result. Build tools are plain Node ESM scripts so they need no
separate compilation step.

- `dist/index.js`: minified CommonJS bundle targeting ES2020 for Joplin.
- `dist/manifest.json` and other non-TypeScript files from `src/`: runtime assets.
- `publish/com.bwat47.copyashtml.jpl`: portable tar archive of `dist/`, with files
  at the archive root.
- `publish/com.bwat47.copyashtml.json`: manifest plus the archive SHA-256 hash and
  Git branch/commit. Git information is empty when building outside a Git checkout.

`scripts/buildConfig.mjs` holds bundler settings. The local `api` shim preserves
Joplin's injected API object. The MathJax default-font alias points at our TeX font
to avoid bundling the unused NewCM font. JSDOM is excluded because math uses the
lite adaptor. Dependencies used at runtime are bundled; Node built-ins remain
external, with any `node:` prefix stripped (`node:path` becomes `path`) to match the
previous Webpack build. No extra content scripts or webview entry points are currently needed.

`scripts/packagePlugin.mjs` validates versions, categories, package naming, and
screenshots, then creates the archive and publish metadata. Build and packaging
errors fail the command. Each build clears `dist/` and `publish/` first.

Run `npm run updateVersion` to increment the patch version in `package.json`,
`src/manifest.json`, and `package-lock.json` together. Existing package and manifest
versions must match before running this command or building.

The project no longer uses the generator's Webpack configuration or `npm run update`.
Review Joplin API or manifest changes explicitly rather than regenerating the build
scaffolding. The local `api/` directory remains the source of API declarations.

Run `npm run updateApi` to replace `api/` with the declarations from the latest
`generator-joplin` package on npm. It downloads the package to a temporary
directory, touches nothing outside `api/`, and prints the generator version used.
Review the result with `git diff api/` and run `npm run typecheck`.

## Verification

- `npm test`: application tests plus packaging and bundled-runtime smoke tests.
- `npm run typecheck`: TypeScript checking without producing output.
- `npm run lint`: checks application sources and build scripts.
- `npm run knip`: unused dependency, export, and file checks.
- `npm run dist`: complete build and archive generation.

Before releasing, install the `.jpl` in a Joplin development profile and copy both
plain text and HTML containing math, chemistry, ABC notation, Mermaid diagrams,
and images. The automated bundle checks do not replace an installed-plugin check.
