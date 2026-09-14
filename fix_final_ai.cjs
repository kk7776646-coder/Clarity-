const fs = require('fs');

let file = fs.readFileSync('server.ts', 'utf8');

const regexToRemove = /try \{\s+const resp = await generateGeminiWithResilience.*?console\.error\(e\);\s+\}/s;

const newCode = `try {
      const resp = await generateGeminiWithResilience(sys, user);
      if (resp && resp.text) {
         let fixed = resp.text.trim();
         if (fixed.startsWith("\`\`\`")) {
            fixed = fixed.replace(/^\`\`\`[a-z]*\\n/, "").replace(/\\n\`\`\`$/, "");
         }
         return res.json({ fixedContent: fixed });
      }
    } catch (e) {
      console.error(e);
    }`;

file = file.replace(regexToRemove, newCode);
fs.writeFileSync('server.ts', file, 'utf8');
console.log("Success");
