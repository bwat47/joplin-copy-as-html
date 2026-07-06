## Project architecture overview

CODE_DOCUMENTATION.md

## Build, Test, and Development Commands

- `npm run dist` Build plugin and create archive at `publish/*.jpl`.
- `npm test` Run tests.
- `npm run lint` Lint TypeScript with ESLint.
- `npm run lint:fix` Auto-fix lint issues.
- `npm run format` Format code with Prettier.
- `npm run knip` Find unused dependencies, exports and files.
- `npm run updateVersion` Sync plugin version metadata.

## Design Principles

- **Simple over complex:** prefer focused, single-responsibility modules.
- **One clear way**: Avoid multiple competing approaches.
- **Separation of concerns**: Each module handles one aspect.

## Coding Style & Naming Conventions

- **Language**: TypeScript with strict settings; 4-space indentation; semicolons required.
- **Filenames**: `camelCase.ts` for modules; tests mirror names: `module.test.ts`.
- **Exports**: Prefer explicit types and narrow public exports.
- **Style enforcement**: Run `npm run format` before commits or if you encounter formatting errors from prettier.
- **Documentation**: Use JSDoc for complex functions; document regex patterns with examples.

## Log messages

- Use `src\logger.ts` wrapper
