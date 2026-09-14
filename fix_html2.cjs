const fs = require('fs');
let file = fs.readFileSync('project-diagnostics.ts', 'utf8');

file = file.replace(
  /correction: \`Replace <\/\$\{tag\}> with <\/\$\{last.tag\}>\.\`,\s*currentCode: lineStr,/g,
  "correction: `Replace </${tag}> with </${last.tag}>.`,\n              suggestedCode: lineStr.replace(`</${tag}>`, `</${last.tag}>`),\n              currentCode: lineStr,"
);

file = file.replace(
  /correction: \`Remove <\/\$\{tag\}> or add opening tag\.\`,\s*currentCode: lineStr,/g,
  "correction: `Remove </${tag}> or add opening tag.`,\n            suggestedCode: lineStr.replace(`</${tag}>`, ``),\n            currentCode: lineStr,"
);

fs.writeFileSync('project-diagnostics.ts', file, 'utf8');
console.log("Replaced using regex.");
