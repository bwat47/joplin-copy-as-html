# Repository Guidelines

## Project Structure & Module Organization

- `src/` TypeScript sources for the Joplin plugin.
    - `html/` HTML rendering, asset processing, DOM post-processing.
    - `plainText/` Plain-text token renderers and markdown setup.
    - `manifest.json` Plugin manifest; keep in sync when adding features.
- `tests` live alongside sources as `*.test.ts` files.
- `publish/` Build artifacts (`*.jpl`) created by the dist task.
- `webpack.config.js` Build pipeline; `jest.config.js` test setup.

## Build, Test, and Development Commands

- `npm test` Run Jest test suite.
- `npm run dist` Build plugin and create archive at `publish/*.jpl`.
- `npm run lint` Lint TypeScript with ESLint.
- `npm run lint:fix` Auto-fix lint issues.
- `npm run format` Format code with Prettier.
- `npm run updateVersion` Sync plugin version metadata.

Use Node LTS (18+) and npm 9+ for consistency.

## Design Principles

- Simple over complex; one clear way to do things.
- Separation of concerns: keep modules focused; extract growing code.
- Keep `index.ts` lean (plugin registration, command binding only).
- Centralize constants in `src/constants.ts` and types in `src/types.ts`.
- Prefer fixing root causes; add minimal, targeted logging when debugging.

## Coding Style & Naming Conventions

- Language: TypeScript; 4-space indentation; semicolons enforced.
- Prefer explicit types and narrow public exports.
- Filenames: `camelCase.ts` for modules; tests mirror names: `module.test.ts`.
- Run `npm run lint` and `npm run format` before pushing.
- Style config: `eslint.config.mjs`, `.prettierrc.js`, `tsconfig.json`.
- Use JSDoc on complex functions and document non-trivial regex.

## TypeScript & Error Handling

- Avoid `any`; prefer `unknown` then narrow. Use unions/generics where helpful.
- Use explicit return types for exported functions; let inference handle locals.
- Fail fast with clear errors; don’t swallow exceptions.
- Log with a consistent prefix, e.g., `[copy-as-html]`.

## Settings & Constants

- Define setting keys as string constants in `constants.ts`; provide sane defaults.
- Validate settings via dedicated helpers; keep `manifest.json` in sync and documented.

## Testing Guidelines

- Framework: Jest with `ts-jest`/`jsdom` where needed.
- Place tests next to source: `src/<area>/<name>.test.ts`.
- Keep tests deterministic; mock I/O and Joplin APIs.
- Run `npm test` locally; new features should include tests.

## Commit & Pull Request Guidelines

- Commits: clear, present-tense messages (e.g., "Add HTML fragment sanitizer").
    - Scope small, one topic per commit; reference issues when applicable.
- PRs: include description, motivation, screenshots (for rendering changes), and
  steps to validate (commands and sample input). Update `README.md` if UX changes.

## Security & Configuration Tips

- Sanitize any generated HTML; changes to HTML rendering must keep DOMPurify in place.
- Avoid bundling unused dependencies; check `webpack.config.js` and `package.json`.
- Do not commit secrets or external URLs; use fixtures in tests.
