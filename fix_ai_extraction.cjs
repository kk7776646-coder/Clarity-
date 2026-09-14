const fs = require('fs');

let file = fs.readFileSync('project-routes.ts', 'utf8');

const oldRegexCode = `        if (aiText.startsWith("\`\`\`")) {
          aiText = aiText.replace(/^\`\`\`[a-zA-Z0-9_-]*\\n?/, "").replace(/\\n?\`\`\`$/, "");
        }`;

const newRegexCode = `        const match = aiText.match(/\`\`\`(?:[a-zA-Z0-9_\\-]+)?\\n([\\s\\S]*?)\`\`\`/);
        if (match) {
          aiText = match[1].trim();
        } else {
          // If no markdown block, sometimes they just return the code.
          aiText = aiText.trim();
        }`;

file = file.replace(oldRegexCode, newRegexCode);

const badFallback = `} else if (issue.correction && issue.line && issue.line <= lines.length) {
          lines[issue.line - 1] = issue.correction;
          fixedCount++;
        }`;

// Remove the bad fallback completely
file = file.replace(badFallback, '}');

fs.writeFileSync('project-routes.ts', file, 'utf8');
console.log("Fixed project-routes.ts");
