const fs = require('fs');
let js = fs.readFileSync('js/ui/composer.js', 'utf8');

js = js.replace('const input = container.querySelector("#composerInput");\\n    const fileInput', 'const fileInput');
js = js.replace('    const input = container.querySelector("#composerInput");\\n    const fileInput', '    const fileInput');
js = js.replace(/const input = container\.querySelector\("#composerInput"\);\s+const fileInput/g, 'const fileInput');

fs.writeFileSync('js/ui/composer.js', js, 'utf8');
console.log("Fixed composer.js");
