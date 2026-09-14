const fs = require('fs');

let ts = fs.readFileSync('run-engine.ts', 'utf8');

const targetExport = `export function stopProject(projectId: string): RunStatus {`;

const replaceExport = `export function sendInput(projectId: string, input: string) {
  const active = activeRuns.get(projectId);
  if (active && active.process.stdin) {
    active.process.stdin.write(input + "\\n");
  }
}

export function stopProject(projectId: string): RunStatus {`;

ts = ts.replace(targetExport, replaceExport);

fs.writeFileSync('run-engine.ts', ts, 'utf8');

let srv = fs.readFileSync('server.ts', 'utf8');

const srvTarget = `import { executeCommand, stopProject, getRunStatus } from "./run-engine.js";`;
const srvReplace = `import { executeCommand, stopProject, getRunStatus, sendInput } from "./run-engine.js";`;

srv = srv.replace(srvTarget, srvReplace);

const srvRouteTarget = `  app.post("/api/projects/:pid/run/stop", (req, res) => {`;
const srvRouteReplace = `  app.post("/api/projects/:pid/run/input", (req, res) => {
    const pid = req.params.pid;
    if (req.body.input) sendInput(pid, req.body.input);
    res.json({ ok: true });
  });

  app.post("/api/projects/:pid/run/stop", (req, res) => {`;

srv = srv.replace(srvRouteTarget, srvRouteReplace);

fs.writeFileSync('server.ts', srv, 'utf8');
