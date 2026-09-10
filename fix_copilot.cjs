const fs = require('fs');
let code = fs.readFileSync('copilot-engine.ts', 'utf8');

const targetStr = `  const qLower = prompt.toLowerCase();
  
  // 1. Intelligent Retrieval`;

const replacement = `  const qLower = prompt.toLowerCase();
  const relevantFiles = retrieveRelevantFiles(prompt, req.files, 5);
  
  // 1. Intelligent Retrieval`;

code = code.replace(targetStr, replacement);
fs.writeFileSync('copilot-engine.ts', code);
console.log("Patched copilot-engine");
