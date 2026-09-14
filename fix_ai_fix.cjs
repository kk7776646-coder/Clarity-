const fs = require('fs');

let file = fs.readFileSync('server.ts', 'utf8');

const target = `  app.post("/api/projects/:pid/diagnostics/ai-fix", async (req, res) => {
    const pid = req.params.pid;
    const { path, line, issueId, issueMessage, issueExplanation } = req.body || {};
    
    // Quick mock of ai-fix logic: if there is a known issue, we can try to get it
    // But since it's just a fix request, let's just use Gemini to fix it.
    const projectFiles = Array.from(files.values()).filter(f => f.project_id === pid);
    const target = projectFiles.find(f => f.filename === path || f.filename.endsWith("/" + path));
    if (!target) return res.status(404).json({ error: "File not found" });

    // Since this is just a single issue fix, we can try applying the suggestedCode directly if available
    const issues = analyzeFileDiagnostics(path, target.content || "", projectFiles);
    const issue = issues.find(i => i.id === issueId);
    
    if (issue && issue.patchedContent) {
       return res.json({ fixedContent: issue.patchedContent });
    }
    
    // Otherwise fallback to Gemini (omitted here for simplicity, using suggestedCode if possible)
    if (issue && issue.suggestedCode && issue.diff) {
       const newContent = (target.content || "").replace(issue.diff.before, issue.diff.after);
       return res.json({ fixedContent: newContent });
    } else if (issue && issue.suggestedCode && issue.currentCode) {
       const newContent = (target.content || "").replace(issue.currentCode, issue.suggestedCode);
       return res.json({ fixedContent: newContent });
    }

    // Call Gemini (we mock it or use the real ai)
    // To avoid complex integration right now, we return failure to trigger toast if no diff
    return res.status(500).json({ error: "No automated fix available without Gemini" });
  });`;

const replacement = `  app.post("/api/projects/:pid/diagnostics/ai-fix", async (req, res) => {
    const pid = req.params.pid;
    const { path, line, issueId, issueMessage, issueExplanation } = req.body || {};
    
    const projectFiles = Array.from(files.values()).filter(f => f.project_id === pid);
    const target = projectFiles.find(f => f.filename === path || f.filename.endsWith("/" + path));
    if (!target) return res.status(404).json({ error: "File not found" });

    const issues = analyzeFileDiagnostics(path, target.content || "", projectFiles);
    const issue = issues.find(i => i.id === issueId);
    
    if (issue && issue.patchedContent) {
       return res.json({ fixedContent: issue.patchedContent });
    }
    
    if (issue && issue.suggestedCode && issue.diff) {
       const newContent = (target.content || "").replace(issue.diff.before, issue.diff.after);
       return res.json({ fixedContent: newContent });
    } else if (issue && issue.suggestedCode && issue.currentCode) {
       const newContent = (target.content || "").replace(issue.currentCode, issue.suggestedCode);
       return res.json({ fixedContent: newContent });
    }

    const sys = "You are a senior developer fixing a specific code issue. Return ONLY the fully fixed file content. Do not include markdown codeblocks (\`\`\`) wrapping the file, just the raw content. Do not explain anything.";
    const user = \`File: \${path}
Line: \${line}
Issue: \${issueMessage}
Explanation: \${issueExplanation}

Current Content:
\${target.content || ""}

Fix the issue and output the complete fixed file content:\`;
    
    try {
      const { generateGeminiWithResilience } = await import("./gemini-resilience.js");
      const resp = await generateGeminiWithResilience(sys, user);
      if (resp && resp.text) {
         let fixed = resp.text.trim();
         if (fixed.startsWith("\`\`\`")) {
            fixed = fixed.replace(/^\`\`\`[a-z]*\n/, "").replace(/\n\`\`\`$/, "");
         }
         return res.json({ fixedContent: fixed });
      }
    } catch (e) {
      console.error(e);
    }

    return res.status(500).json({ error: "No automated fix available without Gemini" });
  });`;

if (file.includes(target)) {
  file = file.replace(target, replacement);
  fs.writeFileSync('server.ts', file, 'utf8');
  console.log("Success updating ai-fix API");
} else {
  console.log("Target not found!");
}
