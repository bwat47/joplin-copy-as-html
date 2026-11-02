/**
 * Baseline styles for full HTML exports, including tables, lists, and task checkboxes.
 * Used when the profile directory has no readable `copy-as-html-user.css` override.
 */
export const defaultStylesheet = `
body,
input {
	font-family: Aptos, Calibri, Arial, 'Helvetica Neue', Helvetica, 'Liberation Sans', sans-serif;
}

code,
kbd,
pre {
	font-family: 'Aptos Mono', 'Cascadia Mono', 'Consolas', 'Source Code Pro', Menlo, Monaco, 'Liberation Mono', monospace;
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
	border-left: 4px solid #d0d7de;
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
li.joplin-checkbox {
	list-style: none;
	/* remove bullet point. */
	padding-left: 0;
	margin-left: 0;
}

/* Joplin wraps checkbox inputs in a div */
.checkbox-wrapper {
	display: inline-flex;
	align-items: baseline;
}

.checkbox-wrapper input[type="checkbox"] {
	margin-right: 0.5em;
	pointer-events: none;
}

/* Table wrapper handling */
.joplin-table-wrapper {
	overflow-x: auto;
	margin-bottom: 1em;
}
`;
