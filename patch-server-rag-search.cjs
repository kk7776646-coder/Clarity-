const fs = require('fs');
let code = fs.readFileSync('server.ts', 'utf8');

const searchEndpoint = `
  // Knowledge Search (Debugger)
  app.get("/api/projects/:pid/knowledge/search", (req, res) => {
    const q = (req.query.q || "").toString();
    const { searchKnowledge } = require('./knowledge-engine.js');
    const results = searchKnowledge(req.params.pid, q, 10);
    
    res.json({
      ok: true,
      results: results.map(r => ({
        file: r.chunk.relativePath,
        lines: \`\${r.chunk.startLine}-\${r.chunk.endLine}\`,
        score: r.score,
        reason: r.reason,
        content: r.chunk.content
      }))
    });
  });
`;
code = code.replace(`  // Reindex Project Manually`, searchEndpoint + `\n  // Reindex Project Manually`);

fs.writeFileSync('server.ts', code);
console.log("Patched server.ts with search API");
