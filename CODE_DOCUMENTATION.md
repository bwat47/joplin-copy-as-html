# Joplin Copy as HTML Plugin: Code Documentation

## Project Structure

```
copy-as-html/
├─ manifest.json                # Joplin plugin manifest
├─ package.json                 # NPM metadata and build scripts
├─ CODE_DOCUMENTATION.md        # This documentation
├─ README.md                    # User-facing overview (if present)
├─ src/
│  ├─ index.ts                  # Plugin entry: registers commands & settings
│  ├─ constants.ts              # Shared constants, regex patterns, grouped configs
│  ├─ types.ts                  # TypeScript interfaces & option types
│  ├─ utils.ts                  # Validation & small shared helpers
│  ├─ pluginUtils.ts            # markdown-it plugin loading utilities
│  ├─ htmlRenderer.ts           # HTML conversion pipeline
│  ├─ plainTextRenderer.ts      # Plain text conversion pipeline
│  ├─ defaultStylesheet.ts      # Default CSS for full HTML export
│  └─ (possible future modules) # e.g. additional format renderers
├─ dist/                        # Compiled plugin output (build artifact)
└─ node_modules/                # Installed dependencies
```

## Overview

This plugin enables users to copy selected markdown from the Joplin editor in two formats:

- **Copy as HTML**: Converts markdown to clean HTML with embedded images and minimal styling
- **Copy as Plain Text**: Converts markdown to human-readable plain text with customizable formatting preservation

The plugin is designed for seamless integration with external applications like email clients, word processors, and other text editors.

## Building and Running

The plugin is written in TypeScript and uses Webpack for bundling. The project uses `npm` for package management. The following commands are available in `package.json`:

*   **`npm run dist`**: Builds the plugin and creates a `.jpl` (Joplin Plugin) file in the `publish/` directory. This is the main build command.
*   **`npm run prepare`**: This command is an alias for `npm run dist`.
*   **`npm run updateVersion`**: Increases the version number in `package.json` and `src/manifest.json`.
*   **`npm run update`**: Updates the Joplin plugin generator.
*   **`npm run lint`**: Lints the TypeScript source files using ESLint.
*   **`npm run lint:fix`**: Lints the TypeScript source files and automatically fixes issues.
*   **`npm run format`**: Formats the TypeScript source files using Prettier.

To build the plugin, run the following command:

```bash
npm run dist
```

This will generate a `.jpl` file in the `publish/` directory, which can be installed in Joplin.

## Development Conventions

*   **Language**: The project is written in TypeScript.
*   **Formatting**: The project uses Prettier for code formatting. The configuration is in `.prettierrc.js`.
*   **Linting**: The project uses ESLint for linting. The configuration is in `.eslintrc.js`.
*   **Bundling**: The project uses Webpack for bundling. The configuration is in `webpack.config.js`.
*   **Plugin Manifest**: The plugin manifest is located at `src/manifest.json`.
*   **Main Entry Point**: The main entry point of the plugin is `src/index.ts`.
*   **Source Code**: The source code is located in the `src/` directory.

## Main Features and Design Choices

### HTML Output Features

- **Clean HTML Generation**: Uses markdown-it with Joplin-compatible plugin configuration to produce semantic HTML
- **Plugin Compatibility**: Respects all Joplin global markdown plugin settings through sophisticated plugin loading
- **Image Embedding**: Optionally converts Joplin resource images to base64 data URLs for portability
- **Dimension Preservation**: Maintains original image dimensions (width, height, style) from HTML `<img>` tags through markdown-it pipeline
- **Resource Loading Optimization**: Timeout protection and request deduplication prevent API overwhelm
- **Fragment Extraction**: Uses JSDOM to extract clean HTML fragments, removing Joplin-specific wrapper elements
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

Centralized configuration and regex patterns:

- **SETTINGS**: String constants for all plugin settings to prevent typos
- **REGEX_PATTERNS**: Documented regex patterns for Joplin resource handling and image processing
- **CONSTANTS**: Timeout values, formatting constants, and dimension key prefixes
- **JOPLIN_SETTINGS**: Global Joplin markdown plugin setting keys for compatibility

#### `src/types.ts`

TypeScript interfaces for type safety:

- **PlainTextOptions**: Configuration for plain text formatting preservation
- **ImageDimensions**: Structure for preserving HTML image attributes
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
Originally developed to solve plugin loading conflicts between HTML and plain text renderers. The complex detection logic handles the diversity of npm package export patterns, with special handling for plugins like markdown-it-emoji that export multiple variants.

### Feature Modules

#### `src/htmlRenderer.ts`

Complete HTML processing pipeline:

**Key Functions:**

- **`extractImageDimensions`**: Preserves image dimensions while converting HTML `<img>` tags to markdown
- **`applyPreservedDimensions`**: Restores preserved dimensions to rendered HTML `<img>` tags
- **`convertResourceToBase64`**: Async conversion of Joplin resources to base64 data URLs with timeout handling
- **`getResourceWithDedupe`**: Simple deduplication to prevent duplicate requests within a single operation
- **`withTimeout`**: Ensures proper cleanup of timeout timers to prevent memory leaks
- **`processHtmlConversion`**: Main orchestrator that coordinates the entire HTML conversion process

**Processing Flow:**

1. Read Joplin global markdown settings using safe fallbacks
2. Configure markdown-it instance to match Joplin's behavior exactly
3. Extract and preserve image dimensions from HTML tags
4. Load markdown-it plugins conditionally based on Joplin settings
5. Render markdown to HTML using configured markdown-it instance
6. Re-apply preserved image dimensions to rendered HTML
7. Convert resource URLs to base64 with simple deduplication (if enabled)
8. Extract clean HTML fragment using JSDOM
9. Remove Joplin-specific elements and convert resource links to text

#### `src/plainTextRenderer.ts`

Comprehensive plain text conversion system:

**Core Functions:**

- **`renderPlainText`**: Main recursive token processor with formatting options
- **`convertMarkdownToPlainText`**: Entry point that initializes markdown-it and processes tokens
- **`parseTableTokens`/`formatTable`**: Table processing with aligned columns and headers using string-width
- **`parseListTokens`/`formatList`**: List processing with proper indentation and numbering
- **`handleLinkToken`/`handleLinkCloseToken`**: External link processing with configurable output
- **`extractBlockTokens`**: Safe token extraction for nested structures

**Token Processing:**

- Recursive processing of markdown-it token trees
- Context-aware formatting (respects code blocks, preserves structure)
- Block-level element spacing management
- Selective markdown preservation based on user settings

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

The plugin uses a sophisticated multi-step process for image handling:

1. **Dimension Extraction**: Parse HTML `<img>` tags and extract width/height/style attributes
2. **Markdown Conversion**: Convert `<img>` tags to markdown with dimension keys as alt text
3. **markdown-it Rendering**: Process through markdown-it with Joplin-compatible plugins
4. **Dimension Restoration**: Use the dimension keys to restore original attributes
5. **Base64 Conversion**: Replace Joplin resource URLs with base64 data (with simple deduplication)

This approach ensures compatibility with markdown-it while preserving user-defined image dimensions from Joplin's rich text editor.

### Resource Loading Enhancements

- **Timeout Protection**: 5-second timeout with proper cleanup prevents memory leaks from hanging timers
- **Simple Request Deduplication**: Prevents multiple simultaneous requests for the same resource within a single operation
- **Graceful Error Recovery**: Individual resource failures don't break entire operations
- **Memory Management**: Automatic cleanup of timeout handles and request map

### Error Handling Philosophy

- **Graceful Degradation**: Operations continue even when individual resources fail
- **User Visibility**: Errors are displayed as red text in output rather than hidden
- **Logging**: Console logging for debugging while maintaining user experience
- **Timeout Protection**: Resource fetching has timeout limits with proper cleanup to prevent memory leaks
- **Simple Deduplication**: Prevents duplicate requests for the same resource within a single operation

### Performance Considerations

- **Simple Request Deduplication**: Prevents duplicate API calls for the same resource within a single operation
- **Timeout Protection**: 5-second timeout prevents hanging operations
- **Memory-Safe Processing**: Proper cleanup of timers and request map
- **Concurrent Processing**: Uses `Promise.all()` for parallel resource fetching
- **Plugin Loading Optimization**: Shared plugin utilities eliminate code duplication
- **String Width Calculations**: Accurate table column alignment using unicode-aware width calculation

## Configuration and Settings

### HTML-Specific Settings

- **embedImages** (default: true): Controls base64 image embedding in HTML output
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

### JSDOM for HTML Processing

- **Reliability**: Regex parsing of HTML proved unreliable for nested structures
- **Maintainability**: DOM queries are more readable and robust than complex regex
- **Future-Proofing**: Adapts better to changes in markdown-it's HTML structure

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

## Extension Points

The plugin's modular design makes it easy to extend:

1. **New Output Formats**: Add new renderer modules following the same pattern
2. **Additional Settings**: Extend the settings interfaces and validation functions
3. **Custom Processing**: Add new token processors to the plain text renderer
4. **Resource Types**: Extend resource handling beyond images
5. **New Plugins**: Add support for additional markdown-it plugins using the shared plugin utilities

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
- **markdown-it-task-lists**: Plugin for checkbox lists
- **jsdom**: DOM manipulation for HTML fragment extraction
- **string-width**: Accurate string width calculation for table formatting

### Development Dependencies

- Standard Joplin plugin build tools and TypeScript compiler

---

This documentation reflects the current implementation and architectural decisions. The modular architecture, sophisticated plugin loading system, and comprehensive error handling make the plugin robust and maintainable for future development. The plugin loading utilities and resource management improvements represent significant technical contributions that could benefit the broader Joplin plugin ecosystem.
