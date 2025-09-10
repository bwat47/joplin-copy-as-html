# Joplin Copy as HTML Plugin: Code Documentation

## Project Structure

```
copy-as-html/
├─ package.json                          # NPM metadata and build scripts
├─ plugin.config.json                    # Joplin plugin tooling config
├─ CODE_DOCUMENTATION.md                 # This documentation
├─ README.md                             # User-facing overview (if present)
├─ LICENSE.txt                           # License
├─ eslint.config.mjs                     # ESLint configuration
├─ jest.config.js                        # Jest test configuration
├─ tsconfig.json                         # TypeScript compiler configuration
├─ webpack.config.js                     # Webpack bundler configuration
├─ GENERATOR_DOC.md                      # Notes from plugin generator
├─ markdown-it_plugin_loading_issues_doc.md # Historical investigation notes
├─ api/                                  # Joplin runtime type declaration shims
│  ├─ *.d.ts                             # (Multiple) Joplin API type definition files
│  └─ noteListType.ts/.d.ts              # Shared enum & types
├─ images/                               # Icons & promo assets
│  ├─ icon.svg / *.png                   # Icons at various resolutions
├─ prompts/                              # Prompt engineering / auxiliary content (if used)
├─ publish/                              # Build artifacts (.jpl + manifest JSON)
│  ├─ com.bwat47.copyashtml.jpl          # Packaged plugin (output of dist)
│  └─ com.bwat47.copyashtml.json         # Packaged manifest metadata
├─ src/
│  ├─ manifest.json                      # Joplin plugin manifest
│  ├─ index.ts                           # Plugin entry: registers commands & settings
│  ├─ constants.ts                       # Shared constants, regex patterns, grouped configs
│  ├─ types.ts                           # Shared interfaces & option types
│  ├─ utils.ts                           # Validation & small shared helpers
│  ├─ utils.test.ts                      # Unit tests for utils helpers
│  ├─ pluginUtils.ts                     # Robust markdown-it plugin loader utilities
│  ├─ pluginUtils.test.ts                # Tests for plugin loading logic
│  ├─ defaultStylesheet.ts               # Default CSS for full HTML export
│  ├─ htmlRenderer.ts                    # High-level HTML conversion orchestrator
│  ├─ htmlRenderer.test.ts               # Integration tests for HTML rendering
│  ├─ plainTextRenderer.ts               # High-level plain text conversion orchestrator
│  ├─ plainTextRenderer.test.ts          # Integration tests for plain text rendering
│  ├─ testHelpers.ts                     # Shared test utilities / fixtures
│  ├─ html/
│  │  ├─ tokenImageCollector.ts          # Collect image URLs from tokens and raw HTML fragments
│  │  ├─ imageRendererRule.ts            # Renderer rule to swap image src (markdown images) using prebuilt map
│  │  ├─ assetProcessor.ts               # Resource conversion (to base64) + stylesheet loader
│  │  ├─ domPostProcess.ts               # Sanitize HTML, Joplin internal link cleanup, swap image src (html images)
│  │  ├─ markdownSetup.ts                # markdown-it instance + plugin loading (HTML path)
│  └─ plainText/
│     ├─ tokenRenderers.ts               # Core token → text rendering logic (tables, lists, links, inline)
│     ├─ tokenRenderers.test.ts          # Unit tests for token renderers (tables, blank lines, etc.)
│     ├─ markdownSetup.ts                # markdown-it instance + plugin loading (plain text path)
├─ dist/                                 # (Git-ignored) compiled plugin output when built
└─ node_modules/                         # Installed dependencies
```

## Overview

This plugin enables users to copy selected markdown from the Joplin editor in two formats:

- **Copy as HTML**: Converts markdown to clean HTML with embedded images and minimal styling
- **Copy as Plain Text**: Converts markdown to human-readable plain text with customizable formatting preservation

The plugin is designed for seamless integration with external applications like email clients, word processors, and other text editors.

## Building and Running

The plugin is written in TypeScript and uses Webpack for bundling. The project uses `npm` for package management. The following commands are available in `package.json`:

- **`npm run dist`**: Builds the plugin and creates a `.jpl` (Joplin Plugin) file in the `publish/` directory. This is the main build command.
- **`npm run prepare`**: This command is an alias for `npm run dist`.
- **`npm run updateVersion`**: Increases the version number in `package.json` and `src/manifest.json`.
- **`npm run update`**: Updates the Joplin plugin generator.
- **`npm run lint`**: Lints the TypeScript source files using ESLint.
- **`npm run lint:fix`**: Lints the TypeScript source files and automatically fixes issues.
- **`npm run format`**: Formats the TypeScript source files using Prettier.

To build the plugin, run the following command:

```bash
npm run dist
```

This will generate a `.jpl` file in the `publish/` directory, which can be installed in Joplin.

## Development Conventions

- **Language**: The project is written in TypeScript.
- **Formatting**: The project uses Prettier for code formatting. The configuration is in `.prettierrc.js`.
- **Linting**: The project uses ESLint for linting. The configuration is in `eslint.config.mjs`.
- **Bundling**: The project uses Webpack for bundling. The configuration is in `webpack.config.js`.
- **Plugin Manifest**: The plugin manifest is located at `src/manifest.json`.
- **Main Entry Point**: The main entry point of the plugin is `src/index.ts`.
- **Source Code**: The source code is located in the `src/` directory.

## Main Features and Design Choices

### HTML Output Features

- **Clean HTML Generation**: Uses markdown-it with Joplin-compatible plugin configuration to produce semantic HTML
- **Plugin Compatibility**: Respects all Joplin global markdown plugin settings through sophisticated plugin loading
- **Image Embedding**: Optionally converts Joplin resource images and remote HTTP/HTTPS images to base64 data URLs for portability
- **Image Attributes**: HTML `<img>` attributes are preserved naturally; markdown images do not include width/height
- **Resource Loading Optimization**: Timeout protection for resource/network operations
- **Link Cleaning**: Converts Joplin resource links to plain text for external compatibility

### Plain Text Output Features

- **Robust Markdown Parsing**: Uses markdown-it with custom plugins for comprehensive markdown support
- **Selective Format Preservation**: Configurable preservation of markdown characters (bold, italic, headings, etc.)
- **Table Formatting**: Converts markdown tables to aligned plain text with proper spacing using string-width calculations
- **List Handling**: Preserves list structure with proper indentation and numbering
- **External Link Processing**: Configurable behavior for HTTP/HTTPS links (title, URL, or markdown format)
- **Code Block Preservation**: Maintains code blocks and inline code in plain text output

### User Experience

- **Toast Notifications**: Non-intrusive feedback for all operations
- **Context Menu Integration**: Commands accessible via right-click with keyboard shortcuts
- **Graceful Error Handling**: Missing resources display as red error messages instead of breaking
- **No Selection Fallback**: Informative messages when no text is selected

## Architecture and File Structure

### Core Files

#### `src/constants.ts`

Centralized configuration and parsing helpers:

- **SETTINGS**: String constants for all plugin settings to prevent typos
- **CONSTANTS**: Timeout values and formatting constants
- **JOPLIN_SETTINGS**: Global Joplin markdown plugin setting keys for compatibility
- **LINK_RESOURCE_MATCHERS**: Regex matchers to detect Joplin resource URLs

#### `src/types.ts`

TypeScript interfaces for type safety:

- **PlainTextOptions**: Configuration for plain text formatting preservation
- **JoplinResource/JoplinFileData**: Interfaces for Joplin API data structures
- **TableData/ListItem**: Structures for plain text table and list formatting

#### `src/utils.ts`

Validation and utility functions:

- **validatePlainTextSettings**: Type-safe validation of user settings with fallbacks
- **validateHtmlSettings**: Boolean validation for HTML processing options

#### `src/pluginUtils.ts`

Shared utilities for safe markdown-it plugin loading:

**Key Functions:**

- **`safePluginUse`**: Handles diverse plugin export patterns (function, object, multi-variant)
- **`loadPluginsConditionally`**: Declarative plugin configuration with enable/disable logic

**Plugin Export Patterns Supported:**

- Direct function exports: `module.exports = function(md) {...}`
- Object exports: `module.exports = {plugin: function(md) {...}}`
- Multi-function exports: `module.exports = {bare: fn1, full: fn2, light: fn3}`
- ES module exports: `export default function(md) {...}`

**Why This Exists:**
Originally developed to solve plugin loading conflicts between HTML and plain text renderers. The detection logic handles the diversity of npm package export patterns, with special handling for plugins like markdown-it-emoji that export multiple variants.

### Feature Modules

#### `src/htmlRenderer.ts` (Orchestrator)

Now a thin coordination layer. It:

1. Builds a configured markdown-it instance with `html/markdownSetup.ts`.
2. Pre-scans tokens to collect image URLs via `html/tokenImageCollector.ts`, then builds a URL→dataURI map in `html/assetProcessor.ts`.
3. Installs the image renderer rule (`html/imageRendererRule.ts`) and renders markdown → HTML.
4. Runs DOM cleanup and sanitization via `html/domPostProcess.ts`, which also rewrites raw HTML <img> using the same map.

Key benefit: HTML-specific responsibilities moved out of a monolith into focused modules, improving testability and isolating side-effects (filesystem, Joplin API calls).

#### `src/html/assetProcessor.ts`

Responsibilities:

- Joplin resource conversion to base64 (`convertResourceToBase64`) with MIME/type/size validation
- Remote image download to base64 (`downloadRemoteImageAsBase64`) with Content-Type validation
- Timeout-safe resource fetch (`withTimeout`)
- User stylesheet resolution with fallback to bundled default (`getUserStylesheet`)

Notes:

- Image embedding decisions are driven by a token pre-scan and a prebuilt URL→dataURI map
- Runtime shape guard (`isMinimalJoplinResource`) avoids crashes on malformed metadata

#### `src/html/domPostProcess.ts`

Responsibilities:

- HTML sanitization with DOMpurify.
- DOM parsing of rendered document.
- Find internal joplin links and render title text only.
- Image embedding (swap src with base64 image) for html images (markdown images handled in `html/imageRendererRule.ts`).
- Wrap top level HTML images in paragraphs (display one image per line consistent with markdown images).

#### `src/html/markdownSetup.ts`

Responsibilities:

- Constructs markdown-it instance for HTML path using shared plugin loader.
- Mirrors Joplin global markdown plugin settings.

#### `src/plainTextRenderer.ts` (Orchestrator)

Coordinates:

1. markdown-it construction (`plainText/markdownSetup.ts`).
2. Token tree → text rendering (`plainText/tokenRenderers.ts`).
3. Returns collapsed/plain output respecting user preservation settings.

#### `src/plainText/tokenRenderers.ts`

Core pure rendering logic:

- Table parsing / width calculation / aligned formatting.
- List extraction & indentation (tab or space driven by settings).
- Link handling (stack-based; supports title / URL / markdown modes).
- Inline formatting preservation (bold/italic/etc.) governed by options.
- Footnote reference / definition normalization.
- Blank line collapsing outside code fences.

Refactor Notes:

- Removed unused `options` parameter from `handleLinkToken` (behavior unchanged; option-dependent logic lives in `handleTextToken` and `handleLinkCloseToken`).

#### `src/plainText/markdownSetup.ts`

Responsibilities:

- Builds markdown-it with appropriate plugin set for plain text path.
- Gracefully skips optional plugins (e.g., `markdown-it-mark`) with warning only.

#### Test Layout Update

- `plainTextRenderer.test.ts`: High-level integration behavior (lists, links, code blocks, footnotes, emoji, plugin availability, formatting preservation).
- `plainText/tokenRenderers.test.ts`: Unit tests for pure helper/token rendering functions (tables, unescape, blank line collapsing).
- `htmlRenderer.test.ts`: High-level integration behavior (HTML conversion, image embedding, adherence to Joplin markdown settings).
- HTML renderer integration tests live in `htmlRenderer.test.ts`. Optional unit tests can cover the token collector and image rule if needed.

#### Legacy Monolith Decomposition Rationale

Previous single-file renderers mixed:

- Parsing configuration
- Token traversal
- Asset IO / filesystem access
- Resource fetching & timeout control

The split isolates pure logic (easier unit testing & reasoning) from side-effectful code (API calls, DOM operations), enabling:

- More granular tests (fast, no heavy mocks for pure functions).
- Lower cognitive load when modifying a concern (e.g., adding a new inline preservation option touches only `tokenRenderers.ts`).
- Safer future extensions.

#### `src/index.ts`

Plugin registration and command implementation:

**Settings Registration:**

- Comprehensive settings with descriptions and default values
- Boolean settings for markdown preservation options
- Enum settings for hyperlink behavior and indentation type

**Command Implementation:**

- **copyAsHtml**: Selection → HTML processing → clipboard → user feedback
- **copyAsPlainText**: Selection → plain text processing → clipboard → user feedback
- Consistent error handling with toast notifications
- Context menu integration with keyboard shortcuts (Ctrl+Shift+C, Ctrl+Alt+C)

**Dynamic Context Menu Registration:**

To avoid showing actions that only work in the Markdown editor inside the Rich Text editor, the plugin does not statically declare context menu items. Instead it uses `joplin.workspace.filterEditorContextMenu` each time the editor context menu is about to be shown:

1. Inside the filter callback we perform a lightweight capability probe by attempting a markdown‑only command (`editor.execCommand` with `getCursor`).
2. If the probe succeeds we treat the active pane as the Markdown editor and append our menu entries if they are not already present (guard prevents duplicates when Joplin reuses the existing array between invocations).
3. If the probe throws, we assume Rich Text editor and return the menu unchanged (commands stay hidden, preventing user confusion and no‑op toasts).
4. Keyboard shortcuts are still registered globally (Edit menu items act as fallback) so power users can trigger commands without the context menu when in the correct editor.

Benefits:

- Zero clutter in Rich Text editor.
- No reliance on brittle editor type heuristics—capability probe is future‑proof.
- Duplicate menu entries avoided via presence check before push.

Error handling: Any exception during probing is swallowed (treated as Rich Text) to keep the UI responsive.

## Technical Implementation Details

### Plugin Loading Architecture

#### Challenge

Different markdown-it plugins use incompatible export patterns, causing loading failures and conflicts between HTML and plain text renderers. The npm ecosystem has evolved with different module systems, resulting in:

- CommonJS function exports
- ES6 default exports
- Object wrappers with nested functions
- Multi-variant exports (like emoji plugins with `{bare, full, light}`)

#### Solution

Created `pluginUtils.ts` with robust detection logic that handles all known patterns:

1. **Pattern Detection**: Systematic checking of export types
2. **Fallback Logic**: Auto-detection when patterns don't match
3. **Error Recovery**: Graceful handling of malformed plugins
4. **Debugging Support**: Clear logging for troubleshooting

#### Benefits

- **Zero Plugin Failures**: Graceful fallback for any export pattern
- **Code Reuse**: Eliminates 200+ lines of duplicated plugin loading code
- **Maintainability**: Single place to update plugin loading logic
- **Consistency**: Both renderers use identical plugin loading behavior

### Image Handling Strategy

All async image work happens before rendering, driven by a token pre-scan. Rendering then stays synchronous. Raw HTML images are normalized in a DOM pass.

#### Pipeline Overview

1. Token pre-scan (pure)

- Parse markdown with markdown-it and collect image URLs from:
    - `image` tokens (markdown images; parser excludes code by design)
    - `html_inline` / `html_block` fragments (raw HTML `<img>`)

2. Build embed map (async)

- `buildImageEmbedMap(urls, { embedImages, downloadRemoteImages })`:
    - Dedup Joplin resources by ID (covers `:/id`, `:/id#…`, `:/id?…`, `joplin://resource/id`).
    - Convert each unique resource ID once via `convertResourceToBase64`.
    - Optionally fetch unique remote HTTP(S) images via `downloadRemoteImageAsBase64`.
    - Map each original URL to either a `data:image/*;base64,…` or a small error `<span>`.

3. Renderer rule (markdown images)

- Install a custom `image` render rule that:
    - If `embedImages=false` and the `src` is a Joplin resource → strip the image.
    - If a map entry exists and is a data URI → replace `src` and delegate to default renderer.
    - If a map entry exists and is an error span → output the error HTML instead of an `<img>`.

4. DOM pass (raw HTML `<img>` + cleanup)

- Sanitize once with DOMPurify (hook installed once per module load).
- Clean non-image Joplin resource anchors to plain text.
- For raw HTML `<img>`:
    - If `embedImages=false` and `src` is a Joplin resource → remove the image.
    - If a map entry is a data URI → replace `src`.
    - If a map entry is an error span → replace the `<img>` with the error HTML (type-safe replace).
- Normalize top-level `<img>` by wrapping each direct `<body>` child `<img>` in its own `<p>` block for consistent line behavior with markdown images.

Notes

- No re-sanitization occurs after DOM rewriting; only plugin-generated HTML is injected post-sanitize.
- Width/height attributes on raw HTML images are preserved; markdown images reflect markdown-it defaults.

### Resource Loading Enhancements

- **Timeout Protection**: Timeouts with proper cleanup prevent memory leaks from hanging timers (Joplin resource fetch: 5s; remote downloads: 10s)
- **Simple Request Deduplication**: Prevents multiple simultaneous requests for the same resource within a single operation
- **Graceful Error Recovery**: Individual resource failures don't break entire operations
- **Memory Management**: Automatic cleanup of timeout handles and request map

### Error Handling Philosophy

- **Graceful Degradation**: Operations continue even when individual resources fail
- **User Visibility**: Errors are displayed as red text in output rather than hidden
- **Logging**: Console logging for debugging while maintaining user experience
- **Timeout Protection**: Resource fetching has timeout limits with proper cleanup to prevent memory leaks

### Performance Considerations

- **Concurrent Fetching**: Pre-processor embeds Joplin resources and remote images concurrently with `Promise.all()`
- **Timeout Protection**: `withTimeout` ensures timely failure & cleanup for network/IO
- **Plugin Loading Optimization**: Centralized logic avoids duplicated setup cost
- **String Width Calculations**: Unicode-aware table alignment via `string-width` (pure & test-isolated)

## Configuration and Settings

### HTML-Specific Settings

- **embedImages** (default: true): When true, pre-processor embeds Joplin resource images; when false, it strips only Joplin resource images
- **downloadRemoteImages** (default: false): When enabled (with embedImages), downloads and embeds remote HTTP/HTTPS images as base64
- **exportFullHtml** (default: false): Wraps output as complete HTML document with custom CSS

### Plain Text Settings

All preservation settings default to `false` for clean plain text output:

- **preserveSuperscript**: Maintains `^text^` in output
- **preserveSubscript**: Maintains `~text~` in output
- **preserveEmphasis**: Maintains `*text*` or `_text_` in output
- **preserveBold**: Maintains `**text**` or `__text__` in output
- **preserveHeading**: Maintains `## text` in output
- **preserveStrikethrough**: Maintains `~~text~~` in output
- **preserveHorizontalRule**: Maintains `---` in output
- **preserveMark**: Maintains `==text==` in output (requires markdown-it-mark)
- **preserveInsert**: Maintains `++text++` in output (requires markdown-it-ins)
- **displayEmojis**: Converts `:emoji:` syntax to unicode characters
- **hyperlinkBehavior**: Controls external link output ('title', 'url', 'markdown')
- **indentType**: Controls list indentation ('spaces', 'tabs')

## Why These Design Choices?

### markdown-it over @joplin/renderer

- **Full Control**: Complete control over plugin loading and configuration
- **Joplin Compatibility**: Can closer match Joplin's markdown processing behavior (joplin-renderer limited which plugins we could enable/disable).
- **Extensibility**: Easy to add new markdown features as needed
- **Consistency**: Same parsing engine for both HTML and plain text output

### DOM Parsing for HTML Post-Processing

- **Reliability**: Regex parsing of HTML proved unreliable for nested structures
- **Maintainability**: DOM queries are more readable and robust than complex regex
- **Future-Proofing**: Adapts better to changes in markdown-it's HTML structure
- **Security**: HTML sanitization with DOMPurify.

### Base64 Image Embedding

- **Portability**: Embedded images work in any application that supports HTML
- **Self-Contained**: No dependency on Joplin resources when pasting elsewhere
- **Email Compatibility**: Works well with email clients and web interfaces

### Modular Architecture

- **Testability**: Pure functions can be unit tested independently
- **Maintainability**: Clear separation of concerns makes debugging easier
- **Reusability**: Components can be used independently or extended

### Conservative Plain Text Defaults

- **Clean Output**: All preservation options off by default ensures readable plain text
- **User Control**: Users can selectively enable markdown preservation as needed
- **Compatibility**: Clean plain text works in any text editor or system

### Comprehensive Error Handling

- **User Experience**: Never fails silently; always provides feedback
- **Debugging**: Console logging helps with troubleshooting
- **Robustness**: Handles edge cases like missing resources, network timeouts, and malformed plugins

### Extension Points

Modular structure simplifies targeted enhancements:

1. **New Output Formats**: Add a new directory (e.g., `src/rtf/`) with its own `markdownSetup` & token renderers, plus a thin orchestrator.
2. **Additional Settings**: Extend types in `types.ts`, validate in `utils.ts`, thread through orchestrators and pure modules as needed.
3. **Custom Plain Text Rules**: Add token handlers / helpers in `plainText/tokenRenderers.ts` (pure, unit-test-friendly).
4. **Additional Resource Types**: Extend `assetProcessor` with MIME branching; stats map can be added without touching pure renderers.
5. **Plugin Support**: Add config to `markdownSetup.ts` files; loader logic already handles varied export signatures.

## Dependencies

### Runtime Dependencies

- **markdown-it**: Extensible markdown parser and renderer (replaces @joplin/renderer)
- **markdown-it-mark**: Plugin for `==highlight==` syntax
- **markdown-it-ins**: Plugin for `++insert++` syntax
- **markdown-it-sub**: Plugin for subscript syntax
- **markdown-it-sup**: Plugin for superscript syntax
- **markdown-it-abbr**: Plugin for abbreviation syntax
- **markdown-it-deflist**: Plugin for definition lists
- **markdown-it-emoji**: Plugin for emoji syntax like `:smile:`
- **markdown-it-footnote**: Plugin for footnote syntax
- **markdown-it-multimd-table**: Plugin for advanced table features
- **markdown-it-toc-done-right**: Plugin for table of contents
- **markdown-it-anchor**: Plugin for heading anchors (used with TOC)
- **markdown-it-task-lists**: Plugin for checkbox lists
- **string-width**: Accurate string width calculation for table formatting

### Development Dependencies

- Standard Joplin plugin build tools and TypeScript compiler
