const fs = require('fs');
let ts = fs.readFileSync('server.ts', 'utf8');

// The earlier regex didn't replace the imports at the top
const oldImportLine = 'import { executeCommand, stopProject, getRunStatus, sendInput } from "./run-engine";';
if (ts.includes(oldImportLine)) {
    ts = ts.replace(oldImportLine, 'import { syncProjectFiles, createTerminalSession, startTerminalSession, stopTerminalSession, sendInputToSession, getProjectSessions, activeSessions } from "./run-engine";');
    fs.writeFileSync('server.ts', ts, 'utf8');
    console.log("Imports fixed");
} else {
    // Just replace whatever run-engine import exists
    ts = ts.replace(/import\s+{.*}\s+from\s+"(?:.\/)?run-engine";/, 'import { syncProjectFiles, createTerminalSession, startTerminalSession, stopTerminalSession, sendInputToSession, getProjectSessions, activeSessions } from "./run-engine";');
    fs.writeFileSync('server.ts', ts, 'utf8');
    console.log("Generic Imports fixed");
}
