# Joplin Copy as HTML Plugin: Code Documentation

## Overview
This plugin enables users to copy selected markdown from the Joplin editor in two formats:
- **Copy as HTML**: Converts markdown to clean HTML with embedded images and minimal styling
- **Copy as Plain Text**: Converts markdown to human-readable plain text with customizable formatting preservation

The plugin is designed for seamless integration with external applications like email clients, word processors, and other text editors.

## Main Features and Design Choices

### HTML Output Features
- **Clean HTML Generation**: Uses Joplin's `@joplin/renderer` with minimal theme to produce semantic HTML
- **Image Embedding**: Optionally converts Joplin resource images to base64 data URLs for portability
- **Dimension Preservation**: Maintains original image dimensions (width, height, style) from HTML `<img>` tags
- **Global Settings Compliance**: Honors Joplin's markdown plugin settings (subscript, superscript, mark)
- **Fragment Extraction**: Uses JSDOM to extract clean HTML fragments, removing Joplin-specific wrapper elements
- **Link Cleaning**: Removes Joplin-specific onclick attributes from links for external compatibility

### Plain Text Output Features
- **Robust Markdown Parsing**: Uses markdown-it with custom plugins for comprehensive markdown support
- **Selective Format Preservation**: Configurable preservation of markdown characters (bold, italic, headings, etc.)
- **Table Formatting**: Converts markdown tables to aligned plain text with proper spacing
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

#### `src/types.ts`
TypeScript interfaces for type safety:
- **PlainTextOptions**: Configuration for plain text formatting preservation
- **ImageDimensions**: Structure for preserving HTML image attributes
- **JoplinResource/JoplinFileData**: Interfaces for Joplin API data structures
- **TableData/ListItem**: Structures for plain text table and list formatting

#### `src/utils.ts`
Validation and utility functions:
- **validatePlainTextSettings**: Type-safe validation of user settings with fallbacks
- **validateEmbedImagesSetting**: Boolean validation for image embedding setting

### Feature Modules

#### `src/htmlRenderer.ts`
Complete HTML processing pipeline:

**Key Functions:**
- **`extractImageDimensions`**: Preserves image dimensions while converting HTML `<img>` tags to markdown
- **`applyPreservedDimensions`**: Restores preserved dimensions to rendered HTML `<img>` tags
- **`convertResourceToBase64`**: Async conversion of Joplin resources to base64 data URLs with timeout handling
- **`processHtmlConversion`**: Main orchestrator that coordinates the entire HTML conversion process

**Processing Flow:**
1. Read Joplin global markdown settings
2. Handle soft breaks based on global settings
3. Extract and preserve image dimensions from HTML tags
4. Render markdown to HTML using Joplin's renderer
5. Re-apply preserved image dimensions
6. Convert resource URLs to base64 (if enabled)
7. Extract clean HTML fragment using JSDOM
8. Remove Joplin-specific elements and attributes

#### `src/plainTextRenderer.ts`
Comprehensive plain text conversion system:

**Core Functions:**
- **`renderPlainText`**: Main recursive token processor with formatting options
- **`convertMarkdownToPlainText`**: Entry point that initializes markdown-it and processes tokens
- **`parseTableTokens`/`formatTable`**: Table processing with aligned columns and headers
- **`parseListTokens`/`formatList`**: List processing with proper indentation and numbering
- **`handleLinkToken`/`handleLinkCloseToken`**: External link processing with configurable output

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
- Enum setting for hyperlink behavior in plain text

**Command Implementation:**
- **copyAsHtml**: Selection → HTML processing → clipboard → user feedback
- **copyAsPlainText**: Selection → plain text processing → clipboard → user feedback
- Consistent error handling with toast notifications
- Context menu integration with keyboard shortcuts

## Technical Implementation Details

### Image Handling Strategy
The plugin uses a sophisticated multi-step process for image handling:

1. **Dimension Extraction**: Parse HTML `<img>` tags and extract width/height/style attributes
2. **Markdown Conversion**: Convert `<img>` tags to markdown with dimension keys as alt text
3. **HTML Rendering**: Let Joplin render the markdown normally
4. **Dimension Restoration**: Use the dimension keys to restore original attributes
5. **Base64 Conversion**: Replace Joplin resource URLs with base64 data

This approach ensures compatibility with Joplin's renderer while preserving user-defined image dimensions.

### Error Handling Philosophy
- **Graceful Degradation**: Operations continue even when individual resources fail
- **User Visibility**: Errors are displayed as red text in output rather than hidden
- **Logging**: Console logging for debugging while maintaining user experience
- **Timeout Protection**: Resource fetching has timeout limits to prevent hanging

### Performance Considerations
- **Async Resource Processing**: Uses `Promise.all()` for concurrent resource fetching
- **Timeout Handling**: 5-second timeout for resource operations to prevent blocking
- **Memory Management**: Processes resources individually rather than loading all at once - **Not yet implemented**
- **Regex Optimization**: Pre-compiled regex patterns stored in constants **Not yet implemented**

## Configuration and Settings

### HTML-Specific Settings
- **embedImages** (default: true): Controls base64 image embedding in HTML output

### Plain Text Settings
All preservation settings default to `false` for clean plain text output:
- **preserveSuperscript**: Maintains `^text^` in output
- **preserveSubscript**: Maintains `~text~` in output  
- **preserveEmphasis**: Maintains `*text*` or `_text_` in output
- **preserveBold**: Maintains `**text**` or `__text__` in output
- **preserveHeading**: Maintains `## text` in output
- **preserveMark**: Maintains `==text==` in output (requires markdown-it-mark)
- **preserveInsert**: Maintains `++text++` in output (requires markdown-it-ins)
- **hyperlinkBehavior**: Controls external link output ('title', 'url', 'markdown')

## Why These Design Choices?

### JSDOM for HTML Processing
- **Reliability**: Regex parsing of HTML proved unreliable for nested structures
- **Maintainability**: DOM queries are more readable and robust than complex regex
- **Future-Proofing**: Adapts better to changes in Joplin's HTML structure

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
- **Robustness**: Handles edge cases like missing resources or network timeouts

## Extension Points

The plugin's modular design makes it easy to extend:

1. **New Output Formats**: Add new renderer modules following the same pattern
2. **Additional Settings**: Extend the settings interfaces and validation functions
3. **Custom Processing**: Add new token processors to the plain text renderer
4. **Resource Types**: Extend resource handling beyond images

## Dependencies

### Runtime Dependencies
- **@joplin/renderer**: Joplin's markdown rendering engine
- **markdown-it**: Extensible markdown parser for plain text processing
- **markdown-it-mark**: Plugin for `==highlight==` syntax
- **markdown-it-ins**: Plugin for `++insert++` syntax
- **jsdom**: DOM manipulation for HTML fragment extraction

### Development Dependencies
- Standard Joplin plugin build tools and TypeScript compiler

---

This documentation reflects the current implementation and can be updated as the plugin evolves. The modular architecture and comprehensive error handling make the plugin robust and maintainable for future development.