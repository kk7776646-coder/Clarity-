const fs = require('fs');
// Very naive way to evaluate the script.
let code = fs.readFileSync('js/lib/markdown.js', 'utf8');
// We can extract `renderMarkdown` out of the IIFE.
code = code.replace('(function () {', 'global.testMode = true;');
code += `
function mockOptions() { return {}; }
const html = window.Clarity.markdown.render("Here is a table:\\n| A | B |\\n|---|---|\\n| 1 | 2 |\\n\\nAfter table.");
console.log(html);
`;
fs.writeFileSync('test-md2.js', code);
