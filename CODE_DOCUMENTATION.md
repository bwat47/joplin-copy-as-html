# Joplin Copy as HTML Plugin: Code Documentation

## Overview
This plugin allows users to copy selected markdown from the Joplin editor as HTML (with minimal styling and embedded images) or as plain text. It provides two commands:
- **Copy as HTML**: Converts markdown to HTML, embeds images as base64, and copies to clipboard.
- **Copy as Plain Text**: Converts markdown to plain text, preserving code blocks and inline code, and copies to clipboard.

## Main Features and Design Choices
- **Minimal HTML Styling**: Uses Joplin's renderer with minimal theme, and extracts only the rendered HTML fragment for clean output.
- **Image Embedding**: Optionally embeds Joplin resource images as base64 data URLs in the HTML output.
- **Global Markdown Settings**: Honors Joplin's global settings for subscript, superscript, and mark syntax.
- **Clipboard API**: Uses Joplin's clipboard API to write both HTML and plain text formats.
- **Error Handling**: Gracefully handles missing resources by inserting a placeholder message instead of failing.
**Plain Text Output**: Uses a custom markdown-it based renderer for robust plain text extraction. Removes images and links, preserves line breaks, paragraph spacing, indentation and list leaders. Offers settings to preserve specific markdown features (superscript, subscript, emphasis, bold, heading) in plain text output. All preservation options default to off for clean plain text.
- **User Feedback**: Uses toast notifications for success and info messages.
- **Context Menu Integration**: Adds commands to the markdown editor context menu with keyboard shortcuts.

## File-by-File Documentation

### src/index.ts
This is the main entry point for the plugin. It registers settings, commands, and menu items.

#### Settings Registration
- Registers a section and a setting (`embedImages`) to control whether images are embedded as base64 in HTML output. Other settings are: `PRESERVE_SUPERSCRIPT`, `PRESERVE_SUBSCRIPT`, `PRESERVE_EMPHASIS`, `PRESERVE_BOLD`, `PRESERVE_HEADING` which control the markdown characters that are preserved in the plain text output.

#### Command: copyAsHtml
- Gets the selected markdown from the editor.
- If nothing is selected, shows an info toast.
- Reads Joplin's global markdown settings to configure the renderer.
- Converts markdown to HTML using `@joplin/renderer`.
- If image embedding is enabled, replaces Joplin resource image links with base64 data URLs. If a resource is missing, inserts a red italic placeholder message.
- Uses `jsdom` to extract the inner HTML fragment from the rendered output, removing Joplin source blocks.
- Copies the cleaned HTML fragment to the clipboard and shows a success toast.

#### Command: copyAsPlainText
- Gets the selected markdown from the editor.
- If nothing is selected, shows an info toast.
- Uses markdown-it to parse and recursively render plain text from the selected markdown.
- Removes all images and markdown image embeds from the output.
- Preserves line breaks, paragraph spacing, and list leaders for readable plain text.
- Honors user settings to optionally preserve superscript (^TEST^), subscript (~TEST~), emphasis (*TEST* or _TEST_), bold (**TEST** or __TEST__), and heading (## TEST) markdown in plain text output.
- All preservation options default to off for clean plain text.
- Copies the result to the clipboard and shows a success toast.

#### Menu Items
- Adds both commands to the markdown editor context menu with keyboard shortcuts (`Ctrl+Shift+C` for HTML, `Ctrl+Alt+C` for plain text).

#### Helper Functions
- `replaceAsync`: Utility for performing asynchronous regex replacements (used for image embedding).

### src/manifest.json
Defines plugin metadata and settings.

### webpack.config.js
Standard Joplin plugin build config. No custom logic relevant to plugin features.

### Error Handling and User Experience
- All user-facing errors (e.g., no selection, missing resources) are handled with toast notifications for a smooth experience.
- The plugin never fails silently or throws unhandled errors to the user.

## Why These Approaches?
-  **Minimal HTML Extraction**: Using Joplin's renderer and extracting only the rendered fragment ensures compatibility with webmail and other rich text editors, avoiding excess styling and wrapper tags.
-  **Base64 Image Embedding**: Embedding images as base64 ensures portability and compatibility when pasting into other apps.
-  **Graceful Error Handling**: Replacing missing resources with a visible placeholder prevents silent failures and makes issues clear to the user.
-  **Plain Text Robustness**: The markdown-it based renderer ensures technical content, list leaders, and paragraph structure are preserved in plain text output. User settings allow optional preservation of markdown features for more control over output.
-  **Global Settings Compliance**: Respecting Joplin's global markdown settings ensures the plugin behaves consistently with the user's preferences.
-  **Async Regex Replacement**: The `replaceAsync` helper is necessary for embedding images, since resource fetching is asynchronous.
- **Toast Notifications**: Using toasts for feedback is less disruptive than modal dialogs and fits Joplin's UX conventions.

## Code Comments Review
- The code is already well-commented for each major logic block and helper function.
- Comments explain why global settings are read, why hard breaks are forced, and why placeholders are used for code blocks.
- Error handling comments clarify what happens when resources are missing.
- If you want even more detailed inline comments, let me know which areas to expand!

---
This documentation file can be updated as the plugin evolves. For further details or deeper technical explanations, just ask!
