# Joplin Copy as HTML

Copy selected Markdown from Joplin as formatted HTML or readable plain text. Paste into apps such as Outlook and Gmail, with optional image embedding and customizable plain text output.

![Copying selected Markdown from Joplin and pasting it as formatted text](https://github.com/user-attachments/assets/a46ef4fe-b54a-485d-81ca-62700fecf022)

## Usage

1. Select text in Joplin's **Markdown editor**.
2. Right-click the selection or open the **Edit** menu and choose one of the commands below.
3. Paste into the destination app.

| Command                      | Default shortcut |
| ---------------------------- | ---------------- |
| Copy selection as HTML       | `Ctrl+Shift+C`   |
| Copy selection as Plain Text | `Ctrl+Alt+C`     |

**Copy selection as HTML** puts both formatted HTML and a plain text fallback on the clipboard. The destination app determines which format to use. **Copy selection as Plain Text** copies only plain text.

The [plain text options](#plain-text-options) apply to both the plain text command and the HTML command's fallback.

Configure the plugin in Joplin's settings under **Copy as HTML**.

## HTML options

### Images and drawings

Local Joplin images are embedded as base64 by default, allowing you to paste text and images together. Both Markdown images and HTML `<img>` tags are supported.

| Setting                          | Default | Behavior                                                                                                                                      |
| -------------------------------- | ------- | --------------------------------------------------------------------------------------------------------------------------------------------- |
| Embed images as base64           | On      | Embeds local Joplin images in the HTML. Turning this off removes local Joplin images from the output.                                         |
| Download and embed remote images | Off     | Downloads and embeds remote HTTP/HTTPS images when image embedding is enabled. Otherwise, remote images remain linked to their original URLs. |
| Convert SVG images to PNG        | On      | Converts embedded SVG images to PNG for compatibility with editors and email clients.                                                         |

Successfully embedded remote images can be viewed without internet access. If a download fails, the original image URL is retained.

Drawings from Freehand Drawing, Excalidraw, and Drawio are supported when stored as Joplin image resources (embedded like any other image resource).

### HTML fragment or full document

- **Default:** Copies an HTML fragment without an added stylesheet. The destination app determines its appearance.
- **Export as full HTML document:** Wraps the content in a full HTML document with the [bundled stylesheet](src/defaultStylesheet.ts) or your custom CSS.

To use custom CSS, create `copy-as-html-user.css` in your Joplin profile directory. Open **Help > Open profile directory** to locate it. The custom stylesheet replaces the bundled stylesheet and is used only when **Export as full HTML document** is enabled.

### Markdown rendering

HTML output follows Joplin's Markdown rendering settings, including options such as footnotes, highlighting, and tables.

<details>
<summary>Supported optional Markdown settings</summary>

- Soft Breaks
- Typographer
- Linkify
- Highlight (`==mark==`)
- Footnotes
- Table of Contents
- Subscript (`~sub~`)
- Superscript (`^sup^`)
- Deflist
- Abbreviation
- Markdown Emoji
- Insert (`++Insert++`)
- Multimarkdown Table

</details>

## Plain text options

Plain text output removes Markdown formatting markers and images while preserving paragraphs, list markers, nested list indentation, readable tables, footnotes, and link text. It parses Markdown independently of Joplin's HTML rendering settings.

| Setting                       | Default    | Options                                                                                                             |
| ----------------------------- | ---------- | ------------------------------------------------------------------------------------------------------------------- |
| Plain text hyperlink behavior | Link Title | Keep link text, show the URL, or preserve Markdown link formatting. Applies to Markdown links with HTTP/HTTPS URLs. |
| List indentation type         | 4 Spaces   | Indent nested lists with four spaces or tabs.                                                                       |
| List spacing                  | Loose      | Loose adds blank lines between list items; Tight omits them.                                                        |
| Display emojis                | On         | Converts emoji shortcodes such as `:white_check_mark:` to Unicode (✅).                                             |
| Preserve table pipes          | Off        | Retains Markdown pipe separators in tables.                                                                         |

You can also preserve superscript, subscript, emphasis, bold, heading, quote, strikethrough, highlight, and insert markers, horizontal rules, and code backticks. These options are off by default and appear when you enable **Show advanced settings** in the plugin's settings section.

## Limitations

- Commands work on selected text in the Markdown editor. They do not work in the rich text editor or Markdown viewer.
- Mermaid diagrams and math are not rendered; they are copied as plain text.
- HTML styling and embedded image support depend on the destination app.

> [!NOTE]
> This plugin was created entirely with AI tools.
