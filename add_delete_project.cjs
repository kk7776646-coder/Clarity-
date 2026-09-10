const fs = require('fs');
let code = fs.readFileSync('server.ts', 'utf8');

const deleteRoute = `
  app.delete("/api/projects/:pid", (req, res) => {
    const pid = req.params.pid;
    const user = resolveUser(req) || initialUser;
    
    const proj = projects.get(pid);
    if (!proj) return res.status(404).json({ error: "Project not found" });
    if (proj.user_id !== user.id) return res.status(403).json({ error: "Forbidden" });
    
    // In-memory cleanup
    projects.delete(pid);
    projectFiles.delete(pid);
    
    for (const [id, c] of conversations.entries()) {
      if (c.project_id === pid) {
        conversations.delete(id);
      }
    }
    for (const [id, m] of messages.entries()) {
      if (m.project_id === pid) {
        messages.delete(id);
      }
    }
    
    // Database cleanup
    try {
      dbDeleteProject(pid);
      deleteProjectKnowledge(pid);
      deleteProjectAnalysis(pid);
      deleteProjectStorage(pid); // disk storage
    } catch (e) {
      console.error("Error cleaning up project from DB:", e);
    }
    
    return res.json({ deleted: true, pid });
  });
`;

if (!code.includes('app.delete("/api/projects/:pid"')) {
  code = code.replace(/app\.post\("\/api\/projects\/:pid\/generate", async \(req, res\) => \{/, deleteRoute + '\n  app.post("/api/projects/:pid/generate", async (req, res) => {');
  fs.writeFileSync('server.ts', code);
}
