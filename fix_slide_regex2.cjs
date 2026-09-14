const fs = require('fs');
let file = fs.readFileSync('file-generator.ts', 'utf8');

const targetStr = "rawPrompt.match(/(\\d+)\\s*(?:slide|page|ppt)/i) || rawPrompt.match(/(?:create|make|generate|with)\\s*(?:a|an)?\\s*(\\d+)/i)";
const replaceStr = "rawPrompt.match(/(\\d+)[\\s-]*(?:slide|page|ppt)/i) || rawPrompt.match(/(?:create|make|generate|with)[\\s]*(?:a|an|the)?[\\s]*(\\d+)/i)";

file = file.split(targetStr).join(replaceStr);

fs.writeFileSync('file-generator.ts', file, 'utf8');
