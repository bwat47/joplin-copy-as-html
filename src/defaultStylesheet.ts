/**
 * @fileoverview Default CSS Stylesheet - Baseline styling for HTML export
 *
 * Provides minimal, clean CSS styling for HTML documents exported by the plugin.
 *
 * The stylesheet aims for:
 * - Cross-application compatibility (works in email clients, word processors)
 * - Readable typography with proper spacing
 * - Consistent table and list formatting
 * - Support for Joplin's task list checkboxes
 *
 * Used when "Export as full HTML document" is enabled and no custom stylesheet
 * (copy-as-html-user.css) is found in the user's profile directory.
 *
 * Users can override this by creating their own copy-as-html-user.css file.
 *
 * @author bwat47
 * @since 1.1.0
 */

export const defaultStylesheet = `
body,
input {
	font-family: Aptos, Calibri, Arial, 'Helvetica Neue', Helvetica, 'Liberation Sans', sans-serif;
}

code,
kbd,
pre {
	font-family: 'Aptos Mono', 'Cascadia Code', 'Consolas', 'Source Code Pro', Menlo, Monaco, 'Liberation Mono', monospace;
}

pre {
	padding: 0.5em;
}

p {
	margin-top: 1em;
	margin-bottom: 1em;
}

table {
	border-collapse: collapse;
	border: 1px solid #ccc;
}

th,
td {
	border: 1px solid #eee;
	padding: 0.5em;
}

blockquote {
	border-left: 3px solid #ccc;
	/* left border typical for blockquotes */
	margin: 1.5em 0 1.5em 0.4em;
	padding-left: 0.5em;
}

hr {
	border: none;
	border-top: 1px solid #ccc;
	margin: 1em 0;
}

h1,
h2,
h3,
h4,
h5,
h6 {
	margin-top: 1em;
	margin-bottom: 0.5em;
}

ul,
ol {
	margin-top: 1em;
	margin-bottom: 1em;
}

ul>li,
ol>li {
	margin-bottom: 0.5em;
}

ul ul,
ol ol,
ul li>ul,
ol li>ol {
	margin-top: 0.5em;
	margin-bottom: 0.5em;
}

/* Joplin checkboxes */
li.md-checkbox,
li.task-list-item {
	list-style: none;
	/* remove bullet point. */
	padding-left: 0;
	margin-left: 0;

}

/* The checkbox and its label are treated as inline blocks. */
li.md-checkbox input[type="checkbox"],
li.md-checkbox label,
li.task-list-item input[type="checkbox"],
li.task-list-item label {
	display: inline-block;
	vertical-align: middle;
	/* This is the key for alignment. */
}

/* Add space to the right of the checkbox. */
li.md-checkbox input[type="checkbox"],
li.task-list-item input[type="checkbox"] {
	margin-right: 0.5em;
}
`;
