const fs = require('fs');
let file = fs.readFileSync('file-generator.ts', 'utf8');

file = file.replace(/rawPrompt\.match\(\/\(\\d\+\)\\s\*\(\\\?:slide\\\|page\\\|ppt\)\/i\) \|\| rawPrompt\.match\(\/\(\\\?:create\\\|make\\\|generate\\\|with\)\\s\*\(\\\?:a\\\|an\)\?\\s\*\(\\d\+\)\/i\)/g, "rawPrompt.match(/(\\d+)[\\s-]*(?:slide|page|ppt)/i) || rawPrompt.match(/(?:create|make|generate|with)[\\s]*(?:a|an|the)?[\\s]*(\\d+)/i)");

fs.writeFileSync('file-generator.ts', file, 'utf8');
