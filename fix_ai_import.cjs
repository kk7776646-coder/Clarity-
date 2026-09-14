const fs = require('fs');
let file = fs.readFileSync('server.ts', 'utf8');

file = file.replace('const { generateGeminiWithResilience } = await import("./gemini-resilience.js");', '');
fs.writeFileSync('server.ts', file, 'utf8');
