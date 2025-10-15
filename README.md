# Joplin Copy as HTML

> [!important]
> My coding knowledge is currently very limited. This plugin was created entirely with AI tools, and I may be limited in my ability to fix any issues.

This plugin allows you to copy selected text in the markdown editor as either HTML or plain text (with markdown formatting characters removed).

The primary use case is copying text from Joplin and pasting formatted text into other apps that support HTML formatting (e.g. pasting text into an Outlook email). A plain text fallback is provided for scenarios where you need to paste text into an application that supports neither HTML formatting nor markdown.

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
> Mermaid/Math are not supported, they will render as plain text (code).

### Freehand Drawing/Excalidraw

These embed the drawings as joplin image resources (svg), and the plugin will embed them as base64 as it does other images. SVG images may have compatibility issues with certain editors (conversion to bitmap images is not currently supported).

#### Github Alerts

Github Alert syntax, (e.g. `>[!NOTE]`) is supported via the markdown-it-github-alerts plugin. In order for github alerts to be rendered nicely, you must be using the Full document mode with CSS styling targeting the .markdown-alert classes. The default [stylesheet](https://github.com/bwat47/joplin-copy-as-html/blob/main/src/defaultStylesheet.ts) contains styling for github alerts, example:

<img width="647" height="702" alt="image" src="https://github.com/user-attachments/assets/eb00e25d-5db4-4386-8d84-ec8ffb7f2540" />

## Copy as Plain Text

"Copy selection as Plain Text" is provided as a right click context menu option and as a keyboard shortcut (ctrl + alt + c by default).

This will strip markdown formatting characters, backslash escapes, and image embeds from the source markdown and populate it as text/plain in the clipboard, for scenarios where you need to paste into an app that supports neither HTML formatting or markdown.

List leaders and nested list indentation will be maintained (these are normally lost when copying from the markdown viewer or rich text editor).

### Customizing plain text output

The following options are provided to preserve specific markdown formatting in the text/plain output:

- Preserve superscript characters `(^TEST^)`

- Preserve subscript characters `(~TEST~)`

- Preserve emphasis characters `(*TEST* or _TEST_)`

- Preserve bold characters `(**TEST** or __TEST__)`

- Preserve heading characters `(## TEST)`

- Preserve strikethrough characters (`~~TEST~~`)

- Preserve horizontal rule (`---`)

- Preserve highlight characters `(==TEST==)`

- Preserve insert characters `(++TEST++)`

The following options are provided for external hyperlinks (only impacts markdown links containing http/https URL):

- Title - Displays link title only (default).

- URL - Displays link URL only.

- Markdown Format - Displays full markdown link formatting with title and URL.

The following options are provided for indentation style:

- Tabs
- (4) Spaces (default)

### Markdown emoji

Copy as Plain Text supports the markdown-it emoji plugin, so emoji such as :white_check_mark: will be displayed in the plain text output. This can be disabled if desired via the Display emojis setting.

## Known Issues

- The plugin's keyboard shortcuts sometimes don't work on cold start of Joplin, can be fixed by toggling editors or going to Tools | Options | Keyboard Shortcuts and back.
- When using the "Full Document" mode for custom css styling, the full HTML document will be nested under another `<html>`/`<body>` in the clipboard. I don't think there's a way to fix this without having access to electron clipboard API. Nested html/body (while not technically valid HTML) is the best solution I found (doesn't seem to cause issues pasting into other apps and is the same thing that the obsidian copy document as html plugin does).
