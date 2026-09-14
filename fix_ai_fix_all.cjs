const fs = require('fs');
let file = fs.readFileSync('server.ts', 'utf8');

const targetStr = `  app.post("/api/projects/:pid/diagnostics/ai-fix", async (req, res) => {
    const pid = req.params.pid;
    const { path, line, issueId, issueMessage, issueExplanation } = req.body || {};`;

const replaceStr = `  app.post("/api/projects/:pid/diagnostics/ai-fix", async (req, res) => {
    const pid = req.params.pid;
    const { path, line, issueId, issueMessage, issueExplanation, fixAll } = req.body || {};`;

file = file.replace(targetStr, replaceStr);

const targetStr2 = `    const sys = "You are a senior developer fixing a specific code issue. Return ONLY the fully fixed file content. Do not include markdown codeblocks (\`\`\`) wrapping the file, just the raw content. Do not explain anything.";
    const user = \`File: \${path}
Line: \${line}
Issue: \${issueMessage}
Explanation: \${issueExplanation}

Current Content:
\${target.content || ""}

Fix the issue and output the complete fixed file content:\`;`;

const replaceStr2 = `    const sys = "You are a senior developer fixing code issues. Return ONLY the fully fixed file content. Do not include markdown codeblocks (\`\`\`) wrapping the file, just the raw content. Do not explain anything.";
    
    let user = "";
    if (fixAll) {
       const allIssues = issues.map((iss, idx) => \`\${idx+1}. Line \${iss.line}: \${iss.message} - \${iss.explanation}\`).join("\\n");
       user = \`File: \${path}
Issues to fix:
\${allIssues}

Current Content:
\${target.content || ""}

Fix all these issues and output the complete fixed file content:\`;
    } else {
       user = \`File: \${path}
Line: \${line}
Issue: \${issueMessage}
Explanation: \${issueExplanation}

Current Content:
\${target.content || ""}

Fix the issue and output the complete fixed file content:\`;
    }`;

file = file.replace(targetStr2, replaceStr2);
fs.writeFileSync('server.ts', file, 'utf8');
console.log("Success updating fixAll backend.");
