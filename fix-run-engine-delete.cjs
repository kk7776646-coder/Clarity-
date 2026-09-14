const fs = require('fs');
let ts = fs.readFileSync('server.ts', 'utf8');

// The api endpoint for stop uses /api/terminals/:tid/stop, but if a user clicks close, we might want to also delete it
// Let's modify the stop endpoint to optionally delete, or just add a delete endpoint
const stopEndpoint = `  app.post("/api/terminals/:tid/stop", (req, res) => {
    try {
      const session = stopTerminalSession(req.params.tid);
      res.json({ ...session, process: undefined });
    } catch (err: any) {
      res.status(404).json({ error: err.message });
    }
  });`;

if (ts.includes(stopEndpoint)) {
    const newStopEndpoint = `  app.post("/api/terminals/:tid/stop", (req, res) => {
    try {
      const session = stopTerminalSession(req.params.tid);
      // Clean up from memory if explicitly requested (e.g., closing tab)
      if (req.query.delete === 'true') {
          activeSessions.delete(req.params.tid);
      }
      res.json({ ...session, process: undefined });
    } catch (err: any) {
      res.status(404).json({ error: err.message });
    }
  });`;
    
    ts = ts.replace(stopEndpoint, newStopEndpoint);
    fs.writeFileSync('server.ts', ts, 'utf8');
    console.log("Stop endpoint updated with delete flag");
}
