const fs = require('fs');
let code = fs.readFileSync('js/lib/markdown.js', 'utf8');

const regex = /return '<pre class="code-block"><div class="code-block__header"><code' \+ langClass \+ '>' \+ highlighted \+ "<\/code>" \+ copyBtn \+ "<\/div><\/pre>";/;

code = code.replace(regex, 
`var header = '<div class="code-block__header"><span class="code-lang">' + escapeHtml(lang || "text") + '</span><div style="display:flex;gap:4px;">' + copyBtn + '</div></div>';
    var body = '<div class="code-block__body" style="max-height: 50vh; overflow-y: auto; overflow-x: auto;"><code' + langClass + '>' + highlighted + "</code></div>";
    return '<div class="code-block">' + header + body + "</div>";`);

fs.writeFileSync('js/lib/markdown.js', code);
