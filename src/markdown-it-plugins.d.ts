// Type declarations for markdown-it plugins without bundled types
declare module 'markdown-it-mark' {
    import MarkdownIt from 'markdown-it';
    const plugin: MarkdownIt.PluginSimple;
    export default plugin;
}

declare module 'markdown-it-ins' {
    import MarkdownIt from 'markdown-it';
    const plugin: MarkdownIt.PluginSimple;
    export default plugin;
}

declare module 'markdown-it-sub' {
    import MarkdownIt from 'markdown-it';
    const plugin: MarkdownIt.PluginSimple;
    export default plugin;
}

declare module 'markdown-it-sup' {
    import MarkdownIt from 'markdown-it';
    const plugin: MarkdownIt.PluginSimple;
    export default plugin;
}

declare module 'markdown-it-emoji' {
    import MarkdownIt from 'markdown-it';
    export const bare: MarkdownIt.PluginSimple;
    export const full: MarkdownIt.PluginSimple;
    export const light: MarkdownIt.PluginSimple;
}
