const fs = require('fs');
let file = fs.readFileSync('js/pages/project.js', 'utf8');

file = file.replace(/color:#e4e4e7;/g, 'color:var(--ink);');
file = file.replace(/color:#a1a1aa;/g, 'color:var(--ink-muted);');
file = file.replace(/color:#71717a;/g, 'color:var(--ink-faint);');

fs.writeFileSync('js/pages/project.js', file, 'utf8');
