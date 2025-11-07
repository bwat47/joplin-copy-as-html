# Joplin Copy as HTML Plugin

## Overview

- Provides two commands: copy the current Markdown selection as portable HTML or as formatted plain text.
- Built for reliable pasting into editors, email clients, and other applications; embeds resources as needed while keeping output predictable.

## Build & Tooling

- Target Node LTS (18+) and npm 9+.
- Key scripts: `npm run dist` (build `.jpl`), `npm test` (Jest), `npm run lint`, `npm run format`, `npm run updateVersion`.
- Bundled with Webpack; tests run through Jest + ts-jest.

## Repository Layout (selected)

- `src/index.ts` – plugin entry point: registers commands, clipboard flow, context menu filtering.
- `src/settings.ts` – centralizes plugin settings registration and loading with validation helpers.
- `src/logger.ts` – centralized logging utility with debug toggle support.
- `src/constants.ts` / `src/types.ts` – shared configuration, string constants, and TypeScript contracts.
- `src/utils.ts` – validation helpers, error formatting, timeout wrappers.
- `src/pluginUtils.ts` – resilient CommonJS markdown-it plugin loader utilities; shared by both renderers.
- `src/esmPluginLoader.ts` – Wrappers to handle dynamic import of ESM-only packages.
- `src/html/` – HTML renderer pipeline (`htmlRenderer.ts`, `assetProcessor.ts`, `domPostProcess.ts`, `markdownSetup.ts`).
- `src/plainText/` – plain text pipeline (`plainTextCollector.ts`, `plainTextFormatter.ts`, `tokenRenderers.ts`, `markdownSetup.ts`).
- Tests live beside source (`*.test.ts`). `tests/` directory is unused.

## Architecture Summary

### Shared Flow

1. Load settings via `settings.ts` helpers and configure debug logging via `logger.ts`.
2. Obtain current Markdown selection via Joplin API.
3. Build a markdown-it instance configured by `pluginUtils.ts` and `esmPluginLoader.ts` to reflect Joplin's plugin settings.
4. Run either the HTML or plain text pipeline.
5. Copy the result to the clipboard and show toast feedback. Errors surface as notifications and structured logs via `logger.ts`.

### HTML Pipeline (`htmlRenderer.ts`)

- Pre-scan tokens to find image sources (`tokenImageCollector.ts`).
- Build an embed map in `assetProcessor.ts`: resolve Joplin resources, optionally fetch remote images, and convert to base64.
- Sanitize and normalize the document in `domPostProcess.ts` with DOMPurify: patch internal links, wrap lone `<img>` elements, and apply embed map updates for all images (both markdown-rendered and raw HTML).

### Plain Text Pipeline (`plainTextCollector.ts`)

- `plainText/plainTextCollector.ts` walks the markdown-it token stream directly (no renderer hooks) and produces `PlainTextBlock[]` for paragraphs, headings, lists, tables, blockquotes, and code blocks.
- `plainText/tokenRenderers.ts` provides pure helpers for lists, tables, links, and blank-line rules used by the collector.
- `plainText/plainTextFormatter.ts` assembles the final string from blocks, applying spacing and user-selected preservation options.

### Notable Modules

- `settings.ts` – Centralizes all plugin settings registration and provides `loadHtmlSettings()`, `loadPlainTextSettings()`, and `loadDebugSetting()` helpers that fetch and validate settings from Joplin.
- `logger.ts` – Centralized logging utility with `[copy-as-html]` prefix. Provides `debug()`, `info()`, `warn()`, and `error()` methods. Debug logging is conditionally enabled via `setDebug()` based on user settings.
- `pluginUtils.ts` – Resolves CommonJS export patterns, wraps `md.use`, and logs plugin failures via `logger`.
- `esmPluginLoader.ts` – Loads ESM-only markdown-it plugins in a CommonJS environment. Handles dynamic imports and caching for markdown-it-github-alerts and @mdit/plugin-tasklist.
- `utils.ts` – Houses option validation shared across pipelines.
- `defaultStylesheet.ts` – Injected when `exportFullHtml` is enabled to produce a complete HTML document with minimal css styling.
- `testHelpers.ts` – Fixtures and mocks for renderer tests.

## Settings

All settings are registered in `settings.ts` via `registerPluginSettings()`. Settings are loaded and validated through dedicated helper functions.

### HTML

- `embedImages` (default `true`): replace Joplin resources with base64 data URIs; disable to strip Joplin images only.
- `downloadRemoteImages` (default `false`): with `embedImages` enabled, fetch remote HTTP(S) images and embed them.
- `embedSvgAsPng` (default `true`): rasterize embedded SVGs to PNG to improve compatibility with SVG-averse applications.
- `exportFullHtml` (default `false`): wrap output in a minimal HTML document with bundled (or user supplied) CSS.

### Plain Text

All default to `false` unless noted.

- Preservation toggles: `preserveSuperscript`, `preserveSubscript`, `preserveEmphasis`, `preserveBold`, `preserveHeading`, `preserveStrikethrough`, `preserveHorizontalRule`, `preserveMark`, `preserveInsert`.
- `displayEmojis` (default `true`): convert `:emoji:` syntax to Unicode.
- `hyperlinkBehavior`: emit external links as `title`, `url`, or `markdown`.
- `indentType`: choose list indentation via spaces or tabs.

### Debug

- `debug` (default `false`): enable verbose logging for plugin loading, context menu detection, and other diagnostic information via `logger.ts`.

## Design Rationale

- **markdown-it** is used instead of `@joplin/renderer` for full control over plugin selection, consistent behavior between HTML and plain text, and future extensibility.
- **DOM-based post-processing** provides reliable sanitization, nested HTML handling, and portability for embedded images.
- **Separation of concerns** keeps orchestrators thin and the heavy lifting in small, testable modules. Settings registration is isolated in `settings.ts`, logging is centralized in `logger.ts`.
- **Conservative defaults** favor clean output; advanced preservation is opt-in.
- **Error reporting**: failed operations display errors in the toast UI, with structured logging via `logger.ts` for debugging while continuing where possible.

## Extension Points

1. Add an output format: create `src/<format>/` with its own `markdownSetup.ts`, renderer, and formatter; reuse `pluginUtils.ts`, `logger.ts`, and utilities.
2. Introduce new settings: add to `SETTINGS` constants, register in `settings.ts`, extend `types.ts`, validate in `utils.ts`, and create/update loader functions in `settings.ts`.
3. Support additional resource schemes: augment `assetProcessor.ts` (no changes required in pure renderers).
4. Enhance plain text rules: adjust `plainText/plainTextCollector.ts` (and supporting helpers in `tokenRenderers.ts`) and update corresponding tests.

## Testing Strategy

- `htmlRenderer.test.ts` exercises HTML conversion, DOM sanitization, and image embedding flows.
- `plainTextRenderer.test.ts` covers integration scenarios for the plain text pipeline.
- `plainText/tokenRenderers.test.ts` focuses on pure helpers (tables, list formatting, blank-line logic).
- Common fixtures live in `testHelpers.ts`; tests avoid real I/O via mocks.

## Dependencies

- Runtime: `markdown-it` plus plugins (`mark`, `ins`, `sup`, `sub`, `abbr`, `deflist`, `emoji`, `footnote`, `multimd-table`, `toc-done-right`, `anchor`, `task-lists`); `string-width` for alignment; `dompurify` for sanitization.
- Dev: TypeScript, Jest/ts-jest, ESLint, Prettier, Webpack, and the Joplin plugin tooling defined in `package.json`.
