# Joplin Copy as HTML

This plugin allows you to copy selected text in the markdown editor as either HTML or plaintext (with markdown formatting characters removed).

The primary use case is copying text from Joplin and pasting formatted text into other apps that support HTML formatting (e.g. pasting text into an Outlook email).

## Copy as HTML

"Copy selection as HTML" is provided as a right click context menu option and as a keyboard shortcut (ctrl + shift + c by default).

This will populate the clipboard's text/html category with the HTML formatted text.

> [!important]
> By design, the plugin only copies an HTML fragment including the basic semantic HTML markup (i.e. it won't include any of the Joplin theme styling). This is for maximum compatibility with pasting into other apps, so you don't see issues such as Joplin's background color being pasted- you'll just get the formatted text (bold, italics, formatted lists, etc...).

### Embed images as base64

By default, the plugin will embed any images as base64 in the text/html output, allowing you paste text + images into external applications. However, this can be disabled in the plugin's settings.

## Copy as Plain Text

"Copy selection as Plain Text" is provided as a right click context menu option and as a keyboard shortcut (ctrl + alt + c by default).

This will strip the markdown formatting characters from the raw markdown (except for numbered/unordered list markers) and populate it as text/plain in the clipboard, for scenarios where you need to paste into an app that supports neither HTML formatting or markdown.

> [!NOTE]
> I originally wanted to implement a single action that populated both the text/html and the text/plain clipboard categories (allowing you to seamlessly paste as rich text or plain text), but this currently doesn't seem possible to due limitations with joplin's clipboard API. The joplin clipboard API doesn't appear to allow writing both text/html and text/plain, you only get one or the other (if I'm wrong about this, please let me know!)
