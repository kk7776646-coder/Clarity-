const fs = require('fs');
let code = fs.readFileSync('server.ts', 'utf8');

code = code.replace(
/  app\.get\("\/api\/projects", \(req, res\) => \{\n    const user = resolveUser\(req\) \|\| initialUser;\n    let userProjects = Array\.from\(projects\.values\(\)\)\.filter\(\(p\) => p\.user_id === user\.id\);\n    if \(userProjects\.length === 0\) \{\n      const id = \`proj_\${Date.now()}\`;\n      const defaultProj: ProjectItem = \{\n        id,\n        user_id: user.id,\n        name: "Default Workspace",\n        description: "Your default project workspace",\n        created_at: Date.now\(\),\n        updated_at: Date.now\(\),\n      \};\n      projects.set\(id, defaultProj\);\n      userProjects = \[defaultProj\];\n    \}\n    res\.json\(\{ projects: userProjects \}\);\n  \}\);/,
`  app.get("/api/projects", (req, res) => {
    console.log("HELLO FROM PROJECTS ROUTE");
    const user = resolveUser(req) || initialUser;
    let userProjects = Array.from(projects.values()).filter((p) => p.user_id === user.id);
    if (userProjects.length === 0) {
      console.log("CREATING DEFAULT PROJECT");
      const id = \`proj_\${Date.now()}\`;
      const defaultProj: ProjectItem = {
        id,
        user_id: user.id,
        name: "Default Workspace",
        description: "Your default project workspace",
        created_at: Date.now(),
        updated_at: Date.now(),
      };
      projects.set(id, defaultProj);
      userProjects = [defaultProj];
    }
    console.log("RETURNING:", userProjects);
    res.json({ projects: userProjects });
  });`
);
fs.writeFileSync('server.ts', code);
console.log("Patched test route");
