const fs = require('fs');
let code = fs.readFileSync('file-generator.ts', 'utf8');

// Fix paragraph formatting
code = code.replace(/new Paragraph\(\{ text: (.*?), italics: true(.*?)\}\)/g, 'new Paragraph({ children: [new TextRun({ text: $1, italics: true })]$2})');
code = code.replace(/new Paragraph\(\{ text: (.*?), bold: true(.*?)\}\)/g, 'new Paragraph({ children: [new TextRun({ text: $1, bold: true })]$2})');
code = code.replace(/new Paragraph\(\{\s*text: (.*?),\s*bold: true,\s*spacing: (.*?)\s*\}\)/g, 'new Paragraph({ children: [new TextRun({ text: $1, bold: true })], spacing: $2 })');

// Fix f.severity === "HIGH"
code = code.replace(/f\.severity === "HIGH"/g, 'f.severity === "CONFIRMED"');

// Fix analysis.dependencies.forEach
code = code.replace(/analysis\.dependencies\.forEach/g, 'analysis.dependencies.packages.forEach');

// Oh wait, let's fix the specific spacing one:
code = code.replace(/new Paragraph\(\{\n\s*text: \`Overall Security Score(.*?)\`,\n\s*bold: true,\n\s*spacing: (.*?)\n\s*\}\)/g, 
  'new Paragraph({\n            children: [new TextRun({ text: `Overall Security Score$1`, bold: true })],\n            spacing: $2\n          })');


fs.writeFileSync('file-generator.ts', code);
console.log("Patched file-generator");
