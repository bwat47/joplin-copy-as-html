# Joplin Copy as HTML

> [!important]
> My coding knowledge is currently very limited. This plugin was created entirely with AI tools, and I may be limited in my ability to fix any issues.

This plugin allows you to copy selected text in the markdown editor as either HTML or plain text (with markdown formatting characters removed).

The primary use case is copying text from Joplin and pasting formatted text into other apps that support HTML formatting (e.g. pasting text into an Outlook email). A plain text fallback is provided for scenarios where you need to paste text into an application that supports neither HTML formatting nor markdown.

## Copy as HTML

"Copy selection as HTML" is provided as a right click context menu option and as a keyboard shortcut (ctrl + shift + c by default).

This will populate the clipboard's text/html category with the HTML formatted text.

> [!note]
> By design, the plugin only copies an HTML fragment including the basic semantic HTML markup (i.e. it won't include any of the Joplin theme styling). This is for maximum compatibility with pasting into other apps, so you don't see issues such as Joplin's background color being pasted- you'll just get the formatted text (bold, italics, formatted lists, etc...).

### Embed images as base64

By default, the plugin will embed any images as base64 in the text/html output, allowing you paste text + images into external applications. However, this can be disabled in the plugin's settings.

This should work with both markdown image embeds and the html `<img>` embeds that you get when resizing images via joplin's rich text editor.

### Optional markdown syntax

The plugin will adhere to Joplin's settings for whether or not to render:

- Soft Breaks
- `^sup^`
- `~sub~`
- `==mark==`

## Copy as Plain Text

"Copy selection as Plain Text" is provided as a right click context menu option and as a keyboard shortcut (ctrl + alt + c by default).

This will strip markdown formatting characters, backslash escapes, and image embeds (e.g. `![](:/22cce3a8c2244493877c66c9e3259274)` or `<img src=":/5bb1066cec6f4c849cefc28ba7b0fc1e">`) from the source markdown and populate it as text/plain in the clipboard, for scenarios where you need to paste into an app that supports neither HTML formatting or markdown.

List leaders and nested list indentation will be maintained (these are normally lost when copying from the markdown viewer or rich text editor).

The following options are provided to preserve specific markdown formatting in the text/plain output:

- Preserve superscript characters `(^TEST^)`
If enabled, `^TEST^` will remain `^TEST^` in plain text output.

- Preserve subscript characters `(~TEST~)`
If enabled, `~TEST~` will remain `~TEST~` in plain text output.

- Preserve emphasis characters `(*TEST* or _TEST_)`
If enabled, `*TEST*` or `_TEST_` will remain as-is in plain text output.

- Preserve bold characters `(**TEST** or __TEST__)`
If enabled, `**TEST*`* or `__TEST__` will remain as-is in plain text output.

- Preserve heading characters `(## TEST)`
If enabled, `## TEST` will remain as-is in plain text output.

- Preserve highlight characters `(==TEST==)`
If enabled, `==TEST==` will remain as-is in plain text output.

- Preserve insert characters `(++TEST++)`
If enabled, `++TEST++` will remain as-is in plain text output.

As of version 1.0.15, the following options are provided for external hyperlinks (only impacts markdown links containing http/https URL):

- Title - Displays link title only (default).

- URL - Displays link URL only.

- Markdown Format - Displays full markdown link formatting with title and URL.

## Known Issues

- The context menu options appear in the rich text editor's context menu (but aren't functional, the plugin is only intended for the markdown editor).

## Misc

> [!NOTE]
> I originally wanted to implement a single action that populated both the text/html and the text/plain clipboard categories (allowing you to seamlessly paste as rich text or plain text), but this currently doesn't seem possible due limitations with joplin's clipboard API. The joplin clipboard API doesn't appear to allow writing both text/html and text/plain at the same time... you only get one or the other (if I'm wrong about this, please let me know!)
