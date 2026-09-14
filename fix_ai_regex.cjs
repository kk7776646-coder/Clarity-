const fs = require('fs');
let file = fs.readFileSync('server.ts', 'utf8');

file = file.replace(/fixed = fixed.replace\(\/\^\`\`\`\[a-z\]\*\/\, \"\"\).replace\(\/\`\`\`\$\/, \"\"\);/, `fixed = fixed.replace(/^\\\`\\\`\\\`[a-z]*\\n/, "").replace(/\\n\\\`\\\`\\\`$/, "");`);

fs.writeFileSync('server.ts', file, 'utf8');
console.log("Success replacing regex");
