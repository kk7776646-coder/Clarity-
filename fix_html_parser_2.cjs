const fs = require('fs');
let file = fs.readFileSync('project-diagnostics.ts', 'utf8');

// We see duplicated code. Let's just find where `// 5. CSS Analysis` is and cut from there.
const cssStart = file.indexOf('// 5. CSS Analysis');
const htmlStart = file.indexOf('function analyzeHtml(targetFile');

if (htmlStart > -1 && cssStart > -1) {
   const beforeHtml = file.substring(0, htmlStart);
   const cssPart = file.substring(file.indexOf('// ---------------------------------------------------------------------------', htmlStart + 10));
   // Wait, we can just replace everything between htmlStart and cssPart with our clean version.
   
   const cleanHtml = `function analyzeHtml(targetFile: string, content: string, lines: string[], issues: DiagnosticIssue[]) {
  const openTags: Array<{ tag: string; line: number }> = [];
  const voidTags = new Set(["area", "base", "br", "col", "embed", "hr", "img", "input", "link", "meta", "param", "source", "track", "wbr", "!doctype"]);

  let cleaned = content.replace(/<!--[\\s\\S]*?-->/g, m => m.replace(/[^\\n]/g, ' '));
  cleaned = cleaned.replace(/<script\\b[^>]*>[\\s\\S]*?<\\/script>/gi, m => m.replace(/[^\\n]/g, ' '));
  cleaned = cleaned.replace(/<style\\b[^>]*>[\\s\\S]*?<\\/style>/gi, m => m.replace(/[^\\n]/g, ' '));
  
  const cleanLines = cleaned.split(/\\r?\\n/);
  const tagRegex = /<\\/?([a-zA-Z0-9\\-]+)(?:\\s+(?:[^>"]|"[^"]*"|'[^']*')*)?(\\/?)>/g;
  
  for (let i = 0; i < cleanLines.length; i++) {
    const lineStr = cleanLines[i];
    const origLineStr = lines[i];
    let match: RegExpExecArray | null;

    while ((match = tagRegex.exec(lineStr)) !== null) {
      const full = match[0];
      const tag = match[1].toLowerCase();
      if (tag.startsWith("!") || tag.startsWith("?")) continue;

      const isSelfClosing = match[2] === "/" || voidTags.has(tag) || full.endsWith("/>");
      const isClosing = full.startsWith("</");

      if (isClosing) {
        if (openTags.length === 0) {
          issues.push({
            id: \`html_unmatched_\${i + 1}_\${match.index}\`,
            file: targetFile,
            line: i + 1,
            column: match.index + 1,
            type: "WARNING",
            severity: "warning",
            message: \`Unexpected closing tag </\${tag}>\`,
            explanation: \`Closing tag </\${tag}> has no corresponding opening tag.\`,
            correction: \`Remove </\${tag}> or add opening tag.\`,
            suggestedCode: origLineStr.replace(\`</\${tag}>\`, \`\`),
            currentCode: origLineStr,
          });
        } else {
          let foundIdx = -1;
          for(let j=openTags.length-1; j>=0; j--) {
             if (openTags[j].tag === tag) {
                foundIdx = j;
                break;
             }
          }
          if (foundIdx !== -1) {
             openTags.splice(foundIdx, openTags.length - foundIdx);
          } else {
            const last = openTags.pop()!;
            issues.push({
              id: \`html_mismatch_\${i + 1}_\${match.index}\`,
              file: targetFile,
              line: i + 1,
              column: match.index + 1,
              type: "WARNING",
              severity: "warning",
              message: \`Mismatched tag: expected </\${last.tag}> but found </\${tag}>\`,
              explanation: \`The tag <\${last.tag}> opened on line \${last.line} was closed with </\${tag}>.\`,
              correction: \`Replace </\${tag}> with </\${last.tag}>.\`,
              suggestedCode: origLineStr.replace(\`</\${tag}>\`, \`</\${last.tag}>\`),
              currentCode: origLineStr,
            });
          }
        }
      } else if (!isSelfClosing) {
        openTags.push({ tag, line: i + 1 });
      }
    }
  }
}
`;

   fs.writeFileSync('project-diagnostics.ts', beforeHtml + cleanHtml + cssPart.substring(cssPart.indexOf('// 5. CSS Analysis') - 78), 'utf8');
   console.log("Success replacing correctly");
}
