export const defaultStylesheet = `
body, input {
  font-family: Arial, Helvetica, sans-serif;
}

code, kbd, pre {
  font-family: "Courier New", Courier, monospace;
  background-color: #f5f5f5;
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

th, td {
  border: 1px solid #eee;
  padding: 0.5em;
}

blockquote {
  border-left: 3px solid #ccc;  /* left border typical for blockquotes */
  margin: 1.5em 0 1.5em 0.4em;
  padding-left: 0.5em;
}

hr {
  border: none;
  border-top: 1px solid #ccc;
  margin: 1em 0;
}

h1, h2, h3, h4, h5, h6 {
  margin-top: 1em;
  margin-bottom: 0.5em;
}

ul, ol {
  margin-top: 1em;
  margin-bottom: 1em;
}

ul > li, ol > li {
  margin-bottom: 0.5em;
}

ul ul, ol ol, ul li > ul, ol li > ol {
  margin-top: 0.5em;
  margin-bottom: 0.5em;
}

/* Joplin checkboxes */
li.md-checkbox {
    list-style: none; /* remove bullet point. */
    padding-left: 0;
    margin-left: 0;
}

/* The checkbox and its label are treated as inline blocks. */
li.md-checkbox input[type="checkbox"],
li.md-checkbox label {
    display: inline-block;
    vertical-align: middle; /* This is the key for alignment. */
}

/* Add space to the right of the checkbox. */
li.md-checkbox input[type="checkbox"] {
    margin-right: 0.5em;
}
`;