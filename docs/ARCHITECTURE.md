# Joplin Copy as HTML Plugin

## Overview

- Provides two commands: copy the current Markdown selection as portable HTML or as formatted plain text.
- Built for reliable pasting into editors, email clients, and other applications; embeds resources as needed while keeping output predictable.

## Build & Tooling

- Key scripts: `npm run dist` (build `.jpl`), `npm test` (Vitest), `npm run lint`, `npm run format`, `npm run updateVersion`.
- Bundled with esbuild after a separate TypeScript check; application tests run through Vitest.
- The shared `@bwat47/joplin-plugin-scripts` package builds and copies runtime assets, validates metadata, and creates the `.jpl` and publish information. Plugin-specific esbuild options live in `plugin.config.json`. See [Building the plugin](BUILDING.md).

## Repository Layout

- `src/index.ts` – plugin entry point: registers commands, clipboard flow, context menu filtering.
- `src/settings.ts` – centralizes plugin settings registration and loading with validation helpers.
- `src/logger.ts` – centralized logging utility.
- `src/constants.ts` / `src/types.ts` – shared configuration, string constants, and TypeScript contracts.
- `src/utils.ts` – validation helpers, toast messaging wrapper.
- `src/html/` – HTML renderer pipeline:
    - `htmlRenderer.ts` – entry point: calls `renderMarkup`, runs post-processing, optionally wraps a full document.
    - `domPostProcess.ts` – post-processing orchestrator (the only place that knows transform order) plus small Joplin markup cleanups.
    - `sanitizer.ts` – DOMPurify allowlist and hooks.
    - `mathRenderer.ts`, `abcRenderer.ts`, `mermaidRenderer.ts` – replace math, ABC notation, and Mermaid blocks with SVG data URI images.
    - `texRenderer.ts` – pure TeX to SVG conversion with MathJax, used by `mathRenderer.ts`. Uses MathJax's TeX font, which has no dynamically loaded font files; `plugin.config.json` points MathJax's `#default-font` import at the same font so the unused default font isn't bundled.
    - `imageProcessor.ts` – image embedding and stripping, broken resource placeholders, SVG to PNG rasterization.
    - `assetProcessor.ts` – loads Joplin resources and remote images as base64 data URIs.
    - `domHelpers.ts` – helpers shared by the transforms.
    - `stylesheet.ts` – stylesheet for full HTML exports.
- `src/plainText/` – plain text pipeline (`plainTextRenderer.ts`, `plainTextRenderer.test.ts`).
- Tests live beside source (`*.test.ts`). `tests/` directory is unused.

## Architecture Summary

### Shared Flow

1. Load settings via `settings.ts` helpers.
2. Obtain current Markdown selection via Joplin API.
3. Run either the HTML or plain text pipeline.
4. Copy the result to the clipboard and show toast feedback. Errors surface as notifications and structured logs via `logger.ts`.

### HTML Pipeline (`html/htmlRenderer.ts`)

The HTML renderer leverages Joplin's native `renderMarkup` command to ensure the output matches the user's Joplin settings, followed by a DOM-based post-processing step.

1. **Rendering**: Call `joplin.commands.execute('renderMarkup', ...)` to convert Markdown to HTML.
2. **Post-Processing** (`html/domPostProcess.ts`), in order:
    - **Sanitization** (`html/sanitizer.ts`): Clean HTML using DOMPurify.
    - **Math** (`html/mathRenderer.ts`): `renderMarkup` outputs KaTeX HTML, which only displays correctly with KaTeX's stylesheet and fonts. Read the TeX source from each `.joplin-editable` wrapper's `.joplin-source` element, render it with MathJax (`html/texRenderer.ts`), and replace the wrapper with an SVG data URI image. Display math is centered; inline math is aligned to the text baseline. Math that fails to render becomes its source as code. Runs before the `.joplin-source` cleanup.
    - **ABC Notation** (`html/abcRenderer.ts`): `renderMarkup` leaves tunes as source in a `.joplin-abc-notation` wrapper (Joplin renders them client-side in the viewer). Render each with `abcjs`, using the options JSON in the `.joplin-source` element's `data-abc-options` attribute minus `responsive`, and replace the wrapper with an SVG data URI image. Force `oneSvgPerLine` off so each image contains the complete score. abcjs measures text with `getBBox`, so it renders into a hidden container in the plugin's live document rather than the sanitized one. Notation that fails to render stays as a code block. Runs before the `.joplin-source` cleanup.
    - **Mermaid Diagrams** (`html/mermaidRenderer.ts`): `renderMarkup` leaves diagrams as `pre.mermaid` source (Joplin renders them client-side in the viewer). Render each with `pele` and replace its `.joplin-editable` wrapper with an SVG data URI image. `$$...$$` in labels is typeset through pele's `math` option with the same MathJax renderer as note math (`html/texRenderer.ts`), at the label's font size; label math MathJax can't render shows its TeX source. Diagrams that fail to render stay as code blocks.
    - **Structure Cleanup**: Remove duplicate `.joplin-source` elements (used for the Rich Text Editor).
    - **Resource Handling** (`html/imageProcessor.ts`): Replace broken resource placeholders with clear error messages.
    - **Alert Markers**: Strip GitHub alert markers (e.g. `[!note]`) from blockquotes, keeping any title text.
    - **Link Cleanup**: Strip internal Joplin resource links (unless they contain images).
    - **Checkboxes**: Disable task list checkboxes.
    - **Image Embedding** (`html/imageProcessor.ts`): Traverse the DOM to find images.
        - If `embedImages` is on: Convert local Joplin resources and (optionally) remote images to Base64.
        - If `embedImages` is off: Strip local Joplin images entirely.
    - **Formatting**: Wrap top-level images in paragraph tags.
    - **SVG Handling** (`html/imageProcessor.ts`): Rasterize SVG Data URIs to PNGs for broader compatibility.

### Plain Text Pipeline (`plainText/plainTextRenderer.ts`)

The Plain Text renderer maintains its own remark processor to parse Markdown to mdast, independent of Joplin's rendering settings.

- `plainText/plainTextRenderer.ts` parses with `remark-parse` and syntax plugins for GFM, emoji, mark, insert, superscript, and subscript.
- The renderer walks mdast nodes directly with separate block and inline rendering paths.
- Lists, tables, links, code, HTML text extraction, and preservation toggles are handled in the AST renderer.

## Settings

All settings are registered in `settings.ts` via `registerPluginSettings()`. Settings are loaded and validated through dedicated helper functions.

### HTML

- `embedImages` (default `true`): replace Joplin resources with base64 data URIs; disable to strip Joplin images only.
- `downloadRemoteImages` (default `false`): with `embedImages` enabled, fetch remote HTTP(S) images and embed them.
- `embedSvgAsPng` (default `true`): rasterize embedded SVGs to PNG to improve compatibility with SVG-averse applications.
- `exportFullHtml` (default `false`): wrap output in a minimal HTML document with bundled (or user supplied) CSS.

### Plain Text

All default to `false` unless noted.

- Preservation toggles: `preserveSuperscript`, `preserveSubscript`, `preserveEmphasis`, `preserveBold`, `preserveHeading`, `preserveQuoteMarkers`, `preserveStrikethrough`, `preserveHorizontalRule`, `preserveMark`, `preserveInsert`, `preserveCodeBackticks`, `preserveTablePipes`.
- `displayEmojis` (default `true`): convert `:emoji:` syntax to Unicode when enabled; leave shortcodes unchanged when disabled.
- `hyperlinkBehavior`: emit external links as `title`, `url`, or `markdown`.
- `indentType`: choose list indentation via spaces or tabs.
- `listSpacing`: choose tight or loose list item spacing.

## Testing Strategy

- `html/htmlRenderer.test.ts` exercises HTML conversion, DOM sanitization, and image embedding flows.
- `html/assetProcessor.test.ts` tests resource embedding, remote image downloading, and base64 conversion.
- `html/stylesheet.ts` loads custom CSS for full HTML exports, falling back to the bundled stylesheet; `html/stylesheet.test.ts` covers loading and fallback behavior.
- `html/domPostProcess.test.ts` tests the full post-processing pipeline: Joplin markup cleanup, image wrapping, option handling, and that rich content ends up as top-level images.
- `html/sanitizer.test.ts` tests the DOMPurify allowlist.
- `html/mathRenderer.test.ts`, `html/abcRenderer.test.ts`, and `html/mermaidRenderer.test.ts` test each rich content transform on its own.
- `html/imageProcessor.test.ts` tests image embedding, stripping, broken resource placeholders, and SVG to PNG rasterization.
- `testUtils/dom.ts` provides shared helpers for testing single DOM transforms.
- `html/texRenderer.test.ts` tests TeX to SVG conversion.
- `plainText/plainTextRenderer.test.ts` covers integration scenarios for the plain text pipeline.
- `utils.test.ts` tests validation helpers and utility functions.
- `testUtils/vitestSetup.ts` mocks the Joplin API and resets all mocks before each test; tests avoid real I/O via mocks.

## Dependencies

- Runtime: remark/unified plus plugins (`gfm`, `emoji`, `flexible-markers`, `ins`, `supersub`); `string-width` for alignment; `dompurify` for sanitization; MathJax (`@mathjax/src` with the TeX and mhchem font packages) for math, `abcjs` for ABC notation, and `pele` for Mermaid diagrams.
- Dev: TypeScript, Vitest, ESLint, Prettier, esbuild, and tar packaging defined in `package.json`.
