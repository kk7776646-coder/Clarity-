const fs = require('fs');
let file = fs.readFileSync('project-diagnostics.ts', 'utf8');

const target = file.substring(file.indexOf('// ---------------------------------------------------------------------------'), file.length);

const correctCss = `// ---------------------------------------------------------------------------
// 5. CSS Analysis
// ---------------------------------------------------------------------------
function analyzeCss(targetFile: string, content: string, lines: string[], issues: DiagnosticIssue[]) {
  let openBraces = 0;
  for (let i = 0; i < lines.length; i++) {
    const lineStr = lines[i];
    for (const ch of lineStr) {
      if (ch === "{") openBraces++;
      else if (ch === "}") openBraces--;
    }
  }
  if (openBraces !== 0) {
    issues.push({
      id: "css_unbalanced_braces",
      file: targetFile,
      line: lines.length,
      column: 1,
      type: "CONFIRMED ERROR",
      severity: "error",
      message: \`CSS Parse Error: \${openBraces > 0 ? "Missing closing brace '}'" : "Extra closing brace '}'"}\`,
      explanation: "CSS rulesets must have balanced opening and closing braces '{' and '}'.",
      correction: openBraces > 0 ? "Add closing brace '}' at end of file" : "Remove extra closing brace",
      currentCode: lines[lines.length - 1] || "",
    });
  }
}`;

const htmlStart = file.indexOf('function analyzeHtml(targetFile');
if (htmlStart > -1) {
  // Let's just find the end of analyzeHtml
  const cssIdx = file.indexOf('// 5. CSS Analysis');
  if (cssIdx > -1) {
     const beforeCss = file.substring(0, cssIdx - 79);
     fs.writeFileSync('project-diagnostics.ts', beforeCss + '\\n' + correctCss, 'utf8');
     console.log("Success");
  }
}

