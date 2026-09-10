const fs = require('fs');
let code = fs.readFileSync('server.ts', 'utf8');

const getRoute = `
  app.get("/api/projects", (req, res) => {
    const user = resolveUser(req) || initialUser;
    const userProjects = Array.from(projects.values()).filter(p => p.user_id === user.id);
    res.json(userProjects);
  });
`;

if (!code.includes('app.get("/api/projects"')) {
  code = code.replace(/  app\.post\("\/api\/projects",/g, getRoute + '\n  app.post("/api/projects",');
  fs.writeFileSync('server.ts', code);
}
