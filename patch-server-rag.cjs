const fs = require('fs');
let code = fs.readFileSync('server.ts', 'utf8');

const importStr = `import { indexProject, updateFileKnowledge, deleteFileKnowledge, getProjectKnowledge } from "./knowledge-engine.js";`;
code = code.replace(`import { executeCopilotTurn } from "./copilot-engine";`, `import { executeCopilotTurn } from "./copilot-engine.js";\n` + importStr);

// In refreshProjectIntelligence
const targetRefresh = `    return analysis;
  }

  // --- API ROUTES ---`;
const newRefresh = `    indexProject(projectId, proj.name, extracted, analysis);
    return analysis;
  }

  // --- API ROUTES ---`;
code = code.replace(targetRefresh, newRefresh);

// Expose knowledge endpoints
const endpoints = `
  // Knowledge Engine Status
  app.get("/api/projects/:pid/knowledge", (req, res) => {
    const pk = getProjectKnowledge(req.params.pid);
    if (!pk) {
      return res.json({ status: "Not Indexed", stats: { files: 0, chunks: 0 } });
    }
    let chunks = 0;
    for (const f of pk.files.values()) chunks += f.chunks.length;
    res.json({
      status: pk.indexingState,
      stats: {
        files: pk.files.size,
        chunks
      }
    });
  });

  // Reindex Project Manually
  app.post("/api/projects/:pid/knowledge/reindex", (req, res) => {
    refreshProjectIntelligence(req.params.pid);
    res.json({ ok: true, message: "Reindexed successfully" });
  });
`;
code = code.replace(`  // Export Entire Project as ZIP`, endpoints + `\n  // Export Entire Project as ZIP`);

// Replace file changes to update knowledge incrementally
code = code.replace(
  `const classification = classifyFile(cleanPath);`,
  `const classification = classifyFile(cleanPath);` // Find all instances
);
// We will rely on refreshProjectIntelligence being called, or we just manually patch POST, PUT, DELETE for incremental updates
// Actually, file creation, update, and delete currently rely on manual refreshing for the analysis anyway, but we can hook into them.
// Let's hook into DELETE
code = code.replace(
  `files.delete(fid);`,
  `files.delete(fid);\n        deleteFileKnowledge(pid, cleanPath);`
);

fs.writeFileSync('server.ts', code);
console.log("Patched server.ts with RAG endpoints");
