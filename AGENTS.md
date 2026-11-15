## Project architecture overview

docs/ARCHITECTURE.md

## Build, Test, and Development Commands

- `npm run dist` Build plugin and create archive at `publish/*.jpl`.
- `npm test` Run tests.
- `npm run typecheck` Check TypeScript without producing output.
- `npm run lint` Lint TypeScript sources and tests with Oxlint, then run the fallow dead-code and complexity checks.
- `npm run lint:dead-code` Find unused files, exports, and dependencies with fallow (`.fallowrc.json`).
- `npm run lint:complexity` Check cognitive/cyclomatic complexity limits with fallow (`health` in `.fallowrc.json`).
- `npm run lint:fix` Auto-fix lint issues.
- `npm run format` Format code with Oxfmt.
- `npm run format:check` Check formatting without writing files.
- `npm run updateVersion` Sync plugin version metadata.

## Design Principles

- **Simple over complex:** prefer focused, single-responsibility modules.
- **One clear way**: Avoid multiple competing approaches.
- **Separation of concerns**: Each module handles one aspect.

## Coding Style & Naming Conventions

- **Language**: TypeScript with strict settings; 4-space indentation; semicolons required.
- **Filenames**: `camelCase.ts` for modules; tests mirror names: `module.test.ts`.
- **Module boundaries**: Add explicit return types to exported functions and public methods of exported classes. Prefer named exported types for non-trivial object shapes. Let TypeScript infer local implementation details, and avoid redundant primitive annotations.
- **Style enforcement**: Run `npm run format` before commits or if you encounter formatting errors from oxfmt.
- **Documentation**: Use JSDoc for complex functions; document regex patterns with examples.

## Line endings

- All text files use LF. If you must fall back to a Python script for file editing, write LF explicitly
  (Python: `open(path, 'w', newline='\n')` or `write_text(..., newline='\n')`).
- Don't manually repair incidental CRLF changes. Git normalizes text to LF when staging; Oxfmt also normalizes files when formatting.

## Log messages

- Use `src\logger.ts` wrapper

## Git

- Use conventional commit format for commit messages. Only use "fix" for bugfixes.
- Never run git commit proactively; always wait for explicit user consent.
- GitHub credentials are stored in the OS keyring. If `gh auth status` fails inside the sandbox, retry it with escalated permissions before asking me to authenticate.
