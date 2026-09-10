const fs = require('fs');
let code = fs.readFileSync('file-generator.ts', 'utf8');

// Fix TextRun color
code = code.replace(/new Paragraph\(\{ children: \[new TextRun\(\{ text: (.*?), italics: true \}\)\], color: "666666", spacing: (.*?) \}\)/g, 'new Paragraph({ children: [new TextRun({ text: $1, italics: true, color: "666666" })], spacing: $2 })');

// Fix DependencyItem properties
code = code.replace(/d\.isDev \? "Development" : "Production"/g, 'd.category || "General"');
code = code.replace(/d\.sourceFile/g, 'd.filesUsing.join(", ")');

// Fix analysis.dependencies iteration
code = code.replace(/for \(const d of analysis\.dependencies\) \{/g, 'for (const d of analysis.dependencies.packages) {');
code = code.replace(/d\.isDev \? "TRUE" : "FALSE"/g, 'd.category === "dev" ? "TRUE" : "FALSE"');


fs.writeFileSync('file-generator.ts', code);
console.log("Patched file-generator deps");
