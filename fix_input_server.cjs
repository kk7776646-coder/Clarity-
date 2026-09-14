const fs = require('fs');

let srv = fs.readFileSync('server.ts', 'utf8');

const srvRouteTarget = `  app.post("/api/projects/:pid/stop", (req, res) => {`;
const srvRouteReplace = `  app.post("/api/projects/:pid/run/input", (req, res) => {
    const pid = req.params.pid;
    if (req.body.input) sendInput(pid, req.body.input);
    res.json({ ok: true });
  });

  app.post("/api/projects/:pid/stop", (req, res) => {`;

srv = srv.replace(srvRouteTarget, srvRouteReplace);
fs.writeFileSync('server.ts', srv, 'utf8');
