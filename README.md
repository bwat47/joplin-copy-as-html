# Joplin Copy as HTML

> [!important]
> My coding knowledge is currently very limited. This plugin was created entirely with AI tools, and I may be limited in my ability to fix any issues.

This plugin allows you to copy selected text in the markdown editor as either HTML or structured plain text.

The primary use case is copying text from Joplin and pasting formatted text into other apps that support HTML formatting (e.g. pasting text into an Outlook email). A plain text fallback is provided for scenarios where you need to paste text into an application that supports neither HTML formatting nor markdown.

![copy-as-html-gif](https://github.com/user-attachments/assets/a46ef4fe-b54a-485d-81ca-62700fecf022)

## Copy as HTML

"Copy selection as HTML" is provided as a right click context menu option and as a keyboard shortcut (ctrl + shift + c by default).

This will populate the clipboard's text/html category with the HTML formatted text.

> [!NOTE]
> In Joplin 3.5.4 and newer, it will populate both text/html and text/plain (allowing you to paste either formatted or plain text).

### Embed images as base64

By default, the plugin will embed any images as base64 in the text/html output, allowing you paste text + images into external applications. However, this can be disabled in the plugin's settings.

This will work with both markdown image embeds and the html `<img>` embeds that you get when resizing images via joplin's rich text editor.

### Download and embed remote images as base64

If you enable this option (along with "Embed images as base64"), remote image embeds will be downloaded and embedded as base64 (making the images viewable without internet access).

### Export as fragment or full HTML document

When you copy text from Joplin's markdown viewer (or export the note to HTML), there is a lot of styling applied which can sometimes cause issues pasting text into other editors (e.g. if you copy from the markdown viewer, your joplin theme's background color may be pasted).

#### HTML Fragment

By default, the plugin will populate the clipboard with an HTML fragment, e.g:

```html
<html>
    <body>
        <!--StartFragment-->
        <h2>Test Heading</h2>
        <p>Test paragraph 1</p>
        <p>Test paragraph 2</p>
        <!--EndFragment-->
    </body>
</html>
```

This is similar to what you get when copying from Joplin's TinyMCE rich text editor (semantic markup, no css styling). Any styling will be determined by the application you're pasting the text into.

#### Full HTML Document

Optionally, you can enable the setting "Export as full HTML document".

This will wrap the HTML fragment in a full HTML document with CSS styling. A default (minimal) css [stylesheet](https://github.com/bwat47/joplin-copy-as-html/blob/main/src/defaultStylesheet.ts) is provided. The default stylesheet is only used if no custom stylesheet is provided and the "Export as full HTML document" setting is enabled.

To use your own stylesheet, create a file called `copy-as-html-user.css` in your Joplin profile directory. To locate your Joplin profile directory, open Joplin and click Help | Open profile directory.

### Optional markdown syntax

The plugin will adhere to Joplin's settings for whether or not to render:

- Soft Breaks
- Typographer
- Linkify
- ==mark==
- Footnotes
- Table of Contents
- ~sub~
- ^sup^
- Deflist
- Abbreviation
- Markdown Emoji
- ++Insert++
- Multimarkdown Table

> [!note]
> Mermaid/Math are not supported, they will render as plain text.

### Freehand Drawing/Excalidraw/Drawio

These plugins embed the drawings as joplin image resources (svg), and the plugin will embed them as base64 as it does other images.

SVG images may have compatibility issues with certain editors/email clients, so by default the plugin will convert svg images to png when embedding images, however this can be disabled in the plugin settings.

## Copy as Plain Text

"Copy selection as Plain Text" is provided as a right click context menu option and as a keyboard shortcut (ctrl + alt + c by default).

This command parses the selected Markdown and renders it as paste-friendly plain text. By default it removes all markdown formatting markers and image embeds, while preserving document structure such as paragraphs, list leaders, nested list indentation, tables (optimized for plain text readability), footnotes, and link text.

### Customizing plain text output

The following options are provided to preserve specific markdown formatting markers in the `text/plain` output when desired:

- Preserve superscript markers

- Preserve subscript markers

- Preserve emphasis markers

- Preserve bold markers

- Preserve heading markers

- Preserve strikethrough markers

- Preserve horizontal rules

- Preserve highlight markers

- Preserve insert markers

- Preserve table pipes

The following options are provided for external hyperlinks (only affects markdown links with `http`/`https` URLs):

- Title - Displays link title only (default).

- URL - Displays link URL only.

- Markdown Format - Displays full markdown link formatting with title and URL.

The following options are provided for indentation style:

- Tabs
- (4) Spaces (default)

The following options are provided for list spacing:

- Tight - No blank lines between list items (default).
- Loose - Adds blank lines between list items.

### Markdown emoji

Copy as Plain Text supports markdown emoji shortcodes, so emoji such as :white_check_mark: can be rendered as Unicode in the plain text output. This can be disabled via the Display emojis setting.

## Known Issues

- The plugin's keyboard shortcuts sometimes don't work on cold start of Joplin, can be fixed by toggling editors or going to Tools | Options | Keyboard Shortcuts and back.
