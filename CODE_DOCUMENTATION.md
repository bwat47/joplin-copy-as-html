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
- `src/logger.ts` – centralized logging utility.
- `src/constants.ts` / `src/types.ts` – shared configuration, string constants, and TypeScript contracts.
- `src/utils.ts` – validation helpers, toast messaging wrapper.
- `src/pluginUtils.ts` – resilient CommonJS markdown-it plugin loader utilities; shared by both renderers.
- `src/html/` – HTML renderer pipeline (`htmlRenderer.ts`, `htmlRenderer.test.ts`, `assetProcessor.ts`, `domPostProcess.ts`, `domPostProcess.test.ts`).
- `src/plainText/` – plain text pipeline (`plainTextRenderer.ts`, `plainTextRenderer.test.ts`, `plainTextCollector.ts`, `plainTextFormatter.ts`, `tokenRenderers.ts`, `markdownSetup.ts`).
- Tests live beside source (`*.test.ts`). `tests/` directory is unused.

## Architecture Summary

### Shared Flow

1. Load settings via `settings.ts` helpers.
2. Obtain current Markdown selection via Joplin API.
3. Run either the HTML or plain text pipeline.
4. Copy the result to the clipboard and show toast feedback. Errors surface as notifications and structured logs via `logger.ts`.

### HTML Pipeline (`html/htmlRenderer.ts`)

The HTML renderer leverages Joplin's native `renderMarkup` command to ensure the output matches the user's Joplin settings, followed by a rigorous DOM-based post-processing step.

1. **Rendering**: Call `joplin.commands.execute('renderMarkup', ...)` to convert Markdown to HTML.
2. **Post-Processing** (`html/domPostProcess.ts`):
    - **Sanitization**: Clean HTML using DOMPurify.
    - **Structure Cleanup**: Unwrap Joplin's `#rendered-md` container and remove duplicate `.joplin-source` elements (used for the Rich Text Editor).
    - **Resource Handling**: Replace broken resource placeholders with clear error messages.
    - **Link Cleanup**: Strip internal Joplin resource links (unless they contain images).
    - **Image Embedding**: Traverse the DOM to find images.
        - If `embedImages` is on: Convert local Joplin resources and (optionally) remote images to Base64.
        - If `embedImages` is off: Strip local Joplin images entirely.
    - **Formatting**: Wrap top-level images in paragraph tags.
    - **SVG Handling**: Rasterize SVG Data URIs to PNGs for broader compatibility.

### Plain Text Pipeline (`plainText/plainTextRenderer.ts`)

The Plain Text renderer maintains its own `markdown-it` instance to allow for precise control over token generation and formatting rules, independent of Joplin's rendering settings.

- `plainText/plainTextCollector.ts` walks the markdown-it token stream directly (no renderer hooks) and produces `PlainTextBlock[]` for paragraphs, headings, lists, tables, blockquotes, and code blocks.
- `plainText/tokenRenderers.ts` provides pure helpers for lists, tables, links, and blank-line rules used by the collector.
- `plainText/plainTextFormatter.ts` assembles the final string from blocks, applying spacing and user-selected preservation options.

### Notable Modules

- `settings.ts` – Centralizes all plugin settings registration and provides `loadHtmlSettings()` and `loadPlainTextSettings()` helpers that fetch and validate settings from Joplin.
- `logger.ts` – Centralized logging utility with `[copy-as-html]` prefix. Provides `debug()`, `info()`, `warn()`, and `error()` methods with configurable log levels (DEBUG=0, INFO=1, WARN=2, ERROR=3, NONE=4). Log level can be adjusted at runtime via dev console using `console.copyAsHtml.setLogLevel(level)` and `console.copyAsHtml.getLogLevel()`. Defaults to WARN level.
- `pluginUtils.ts` – Resolves CommonJS export patterns, wraps `md.use`, and logs plugin failures via `logger`.
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

## Design Rationale

- **RenderMarkup for HTML**: Using Joplin's native renderer (`renderMarkup`) ensures that the copied HTML faithfully represents the user's Joplin settings, reducing the maintenance burden of a separate markdown configuration.
- **markdown-it for Plain Text**: A dedicated `markdown-it` instance is retained for the plain text pipeline to provide the fine-grained control needed for custom text extraction and formatting rules.
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

- `html/htmlRenderer.test.ts` exercises HTML conversion, DOM sanitization, and image embedding flows.
- `html/assetProcessor.test.ts` tests resource embedding, remote image downloading, and base64 conversion.
- `html/domPostProcess.test.ts` tests DOM sanitization, link patching, image wrapping, and the `unwrapRenderedMd` logic.
- `plainText/plainTextRenderer.test.ts` covers integration scenarios for the plain text pipeline.
- `plainText/plainTextFormatter.test.ts` tests final text assembly, spacing, and preservation options.
- `plainText/tokenRenderers.test.ts` focuses on pure helpers (tables, list formatting, blank-line logic).
- `pluginUtils.test.ts` tests markdown-it plugin loading and error handling.
- `utils.test.ts` tests validation helpers and utility functions.
- Common fixtures live in `testHelpers.ts`; tests avoid real I/O via mocks.

## Dependencies

- Runtime: `markdown-it` plus plugins (`mark`, `ins`, `sup`, `sub`, `emoji`); `string-width` for alignment; `dompurify` for sanitization.
- Dev: TypeScript, Jest/ts-jest, ESLint, Prettier, Webpack, and the Joplin plugin tooling defined in `package.json`.
