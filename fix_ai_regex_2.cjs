const fs = require('fs');
let file = fs.readFileSync('server.ts', 'utf8');

const target = 'if (fixed.startsWith("```")) {\n            fixed = fixed.replace(/^```[a-z]*/, "").replace(/```$/, "");\n         }';
const replacement = 'if (fixed.startsWith("```")) {\n            fixed = fixed.replace(/^```[a-z]*\\n/, "").replace(/\\n```$/, "");\n         }';

if (file.includes('fixed.replace(/^```[a-z]*/, "").replace(/```$/, "");')) {
  file = file.replace('fixed.replace(/^```[a-z]*/, "").replace(/```$/, "");', 'fixed.replace(/^```[a-z]*\\n/, "").replace(/\\n```$/, "");');
  fs.writeFileSync('server.ts', file, 'utf8');
  console.log("Success replacing regex exactly");
} else if (file.includes('fixed.replace(/^```[a-z]*\n')) {
   file = file.replace('fixed.replace(/^```[a-z]*\n', 'fixed.replace(/^```[a-z]*\\n/, "").replace(/\\n```$/, "");\n//');
   fs.writeFileSync('server.ts', file, 'utf8');
} else {
  console.log("Could not find exact match. Writing manually");
  
  // Let's just fix the specific line
  const lines = file.split('\n');
  for (let i = 0; i < lines.length; i++) {
     if (lines[i].includes('fixed.replace(/^```[a-z]*')) {
        lines[i] = '            fixed = fixed.replace(/^```[a-z]*\\n/, "").replace(/\\n```$/, "");';
     }
  }
  fs.writeFileSync('server.ts', lines.join('\n'), 'utf8');
}
