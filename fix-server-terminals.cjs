const fs = require('fs');

let ts = fs.readFileSync('server.ts', 'utf8');

const oldRunEngineImports = `import { executeCommand, sendInput, stopProject, getRunStatus } from "./run-engine";`;
const newRunEngineImports = `import { syncProjectFiles, createTerminalSession, startTerminalSession, stopTerminalSession, sendInputToSession, getProjectSessions, activeSessions } from "./run-engine";`;

ts = ts.replace(oldRunEngineImports, newRunEngineImports);

// Replace existing run/test logic with terminal session logic
const oldEndpointsStart = `  // -------------------------------------------------------------------------
  // RUN & TEST ENGINE ENDPOINTS
  // -------------------------------------------------------------------------`;

const oldEndpointsEnd = `  // Project analysis versions & runs`;

const newEndpoints = `  // -------------------------------------------------------------------------
  // VS CODE STYLE TERMINAL & RUN ENDPOINTS
  // -------------------------------------------------------------------------
  app.post("/api/projects/:pid/terminals", (req, res) => {
    try {
      const pid = req.params.pid;
      const { command, title } = req.body;
      
      const dbFiles = dbListFiles(pid);
      const projFiles = dbFiles.map(f => ({ filename: f.path, content: f.content, project_id: f.project_id }));
      syncProjectFiles(pid, projFiles);

      const session = createTerminalSession(pid, command || "bash", title || "Terminal");
      startTerminalSession(session.id);
      
      res.json(session);
    } catch (err: any) {
      res.status(400).json({ error: err.message });
    }
  });

  app.get("/api/projects/:pid/terminals", (req, res) => {
    const pid = req.params.pid;
    const sessions = getProjectSessions(pid);
    // don't send raw process object
    const cleanSessions = sessions.map(s => ({ ...s, process: undefined }));
    res.json(cleanSessions);
  });

  app.post("/api/terminals/:tid/stop", (req, res) => {
    try {
      const session = stopTerminalSession(req.params.tid);
      res.json({ ...session, process: undefined });
    } catch (err: any) {
      res.status(404).json({ error: err.message });
    }
  });
  
  app.post("/api/terminals/:tid/restart", (req, res) => {
    try {
      stopTerminalSession(req.params.tid);
      const session = startTerminalSession(req.params.tid);
      res.json({ ...session, process: undefined });
    } catch (err: any) {
      res.status(404).json({ error: err.message });
    }
  });

  app.post("/api/terminals/:tid/input", (req, res) => {
    try {
      if (req.body.input) sendInputToSession(req.params.tid, req.body.input);
      res.json({ ok: true });
    } catch (err: any) {
      res.status(404).json({ error: err.message });
    }
  });

  // Legacy fallback for run buttons
  app.post("/api/projects/:pid/run", (req, res) => {
      const pid = req.params.pid;
      const dbFiles = dbListFiles(pid);
      const projFiles = dbFiles.map(f => ({ filename: f.path, content: f.content, project_id: f.project_id }));
      syncProjectFiles(pid, projFiles);
      
      let cmd = req.body?.command || "npm run dev";
      const session = createTerminalSession(pid, cmd, "Run Project");
      startTerminalSession(session.id);
      res.json({ ...session, process: undefined });
  });
  
  app.get("/api/projects/:pid/run/status", (req, res) => {
      const pid = req.params.pid;
      const sessions = getProjectSessions(pid);
      if (sessions.length > 0) {
          res.json({ ...sessions[sessions.length-1], process: undefined });
      } else {
          res.json({ status: "idle", logs: [] });
      }
  });
  
  app.post("/api/projects/:pid/stop", (req, res) => {
      const pid = req.params.pid;
      const sessions = getProjectSessions(pid);
      for (const s of sessions) {
          if (s.status === "running" || s.status === "starting") stopTerminalSession(s.id);
      }
      res.json({ ok: true });
  });

`;

const tsStart = ts.substring(0, ts.indexOf(oldEndpointsStart));
const tsEnd = ts.substring(ts.indexOf(oldEndpointsEnd));

fs.writeFileSync('server.ts', tsStart + newEndpoints + tsEnd, 'utf8');
console.log("Updated server.ts endpoints");
