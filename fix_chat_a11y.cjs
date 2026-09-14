const fs = require('fs');
let file = fs.readFileSync('js/pages/project.js', 'utf8');

file = file.replace(/id="exportChatMenuBtn" title="Export chat">/g, 'id="exportChatMenuBtn" title="Export chat" aria-label="Export chat" tabindex="0">');
fs.writeFileSync('js/pages/project.js', file, 'utf8');
