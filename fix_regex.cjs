const fs = require('fs');
let file = fs.readFileSync('file-generator.ts', 'utf8');

const target1 = `rawPrompt.match(/(\\d+)\\s*(?:slide|page|ppt)/i)`;
const replacement1 = `rawPrompt.match(/(\\d+)[\\s-]*(?:slide|page|ppt)/i)`;

file = file.replace(new RegExp(target1.replace(/[.*+?^\${}()|[\\]\\\\]/g, '\\\\$&'), 'g'), replacement1);

fs.writeFileSync('file-generator.ts', file, 'utf8');
console.log("Updated regex.");
