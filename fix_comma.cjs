const fs = require('fs');

let js = fs.readFileSync('js/ui/chat.js', 'utf8');

js = js.replace('  }\n\n  _renderMessage(msg) {', '  },\n\n  _renderMessage(msg) {');
fs.writeFileSync('js/ui/chat.js', js, 'utf8');
console.log("Fixed comma");
