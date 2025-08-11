# Joplin Copy as HTML

> [!important]
> My coding knowledge is currently very limited. This plugin was created entirely with AI tools, and I may be limited in my ability to fix any issues.

This plugin allows you to copy selected text in the markdown editor as either HTML or plaintext (with markdown formatting characters removed).

The primary use case is copying text from Joplin and pasting formatted text into other apps that support HTML formatting (e.g. pasting text into an Outlook email).

## Copy as HTML

"Copy selection as HTML" is provided as a right click context menu option and as a keyboard shortcut (ctrl + shift + c by default).

This will populate the clipboard's text/html category with the HTML formatted text.

> [!important]
> By design, the plugin only copies an HTML fragment including the basic semantic HTML markup (i.e. it won't include any of the Joplin theme styling). This is for maximum compatibility with pasting into other apps, so you don't see issues such as Joplin's background color being pasted- you'll just get the formatted text (bold, italics, formatted lists, etc...).

### Embed images as base64

By default, the plugin will embed any images as base64 in the text/html output, allowing you paste text + images into external applications. However, this can be disabled in the plugin's settings.

This should work with both markdown image embeds and the html img src embeds that you get when resizing images via joplin's rich text editor.

### Optional markdown syntax

The plugin will adhere to Joplin's settings for whether or not to render:

- Soft Breaks
- ^sup^
- ~sub~
- ==mark==

## Copy as Plain Text

"Copy selection as Plain Text" is provided as a right click context menu option and as a keyboard shortcut (ctrl + alt + c by default).

This will strip the markdown formatting characters from the raw markdown (except for numbered/unordered list markers) and populate it as text/plain in the clipboard, for scenarios where you need to paste into an app that supports neither HTML formatting or markdown.

As of version 1.0.8, the following options are provided to maintain specific markdown formatting in the plain text output:

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

## Known Issues

- The context menu options appear in the rich text editor's context menu (but aren't functional, the plugin is only intended for the markdown editor).

- For Joplin images that have img src tags with width and/or height defined, the image sizes are not retained in the text/html (so they will be pasted at original size). I haven't been able to fix this (the size attributes always seemed to get stripped from the rendered html).

## Misc

> [!NOTE]
> I originally wanted to implement a single action that populated both the text/html and the text/plain clipboard categories (allowing you to seamlessly paste as rich text or plain text), but this currently doesn't seem possible due limitations with joplin's clipboard API. The joplin clipboard API doesn't appear to allow writing both text/html and text/plain at the same time... you only get one or the other (if I'm wrong about this, please let me know!)
