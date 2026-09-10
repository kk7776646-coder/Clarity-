const fs = require('fs');
let code = fs.readFileSync('server.ts', 'utf8');

const createRoute = `
  app.post("/api/projects", async (req, res) => {
    const user = resolveUser(req) || initialUser;
    const { name } = req.body || {};
    if (!name) return res.status(400).json({ error: "Name is required" });
    
    const pid = "proj_" + Math.random().toString(36).substr(2, 9);
    const pItem = {
      id: pid,
      user_id: user.id,
      name,
      description: "",
      project_type: "other",
      primary_language: "text",
      created_at: Date.now(),
      updated_at: Date.now(),
      status: "ready",
      source: "upload"
    };
    
    projects.set(pid, pItem);
    
    // Save to DB
    try {
      dbCreateProject({
        id: pid,
        name,
        created_at: pItem.created_at,
        updated_at: pItem.updated_at,
        metadata: JSON.stringify({ user_id: user.id })
      });
      // Also create folder
      createProjectFolderOnDisk(pid, "/");
    } catch (e) {
      console.error(e);
    }
    
    res.json(pItem);
  });
`;

if (!code.includes('app.post("/api/projects"')) {
  // insert before app.delete("/api/projects/:pid"
  code = code.replace(/  app\.delete\("\/api\/projects\/:pid",/g, createRoute + '\n  app.delete("/api/projects/:pid",');
  fs.writeFileSync('server.ts', code);
}
