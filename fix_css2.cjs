const fs = require('fs');
let file = fs.readFileSync('css/pages.css', 'utf8');

file = file.replace(/color:\s*#34d399;/g, 'color: var(--success);');
file = file.replace(/background:\s*rgba\(52,\s*211,\s*153,\s*0\.08\);/g, 'background: var(--success-soft);');

fs.writeFileSync('css/pages.css', file, 'utf8');
