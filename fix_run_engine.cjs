const fs = require('fs');

let ts = fs.readFileSync('run-engine.ts', 'utf8');

const targetStatus = `export interface RunStatus {
  status: "idle" | "starting" | "running" | "completed" | "failed" | "stopped";
  command?: string;
  logs: string[];
  startTime?: number;
  pid?: number;
  runtime?: string;
  exitCode?: number;
  error?: string;
  testResults?: TestResults;
}`;

const replaceStatus = `export interface RunStatus {
  status: "idle" | "starting" | "running" | "completed" | "failed" | "stopped";
  command?: string;
  logs: string[];
  startTime?: number;
  pid?: number;
  runtime?: string;
  exitCode?: number;
  error?: string;
  testResults?: TestResults;
  port?: number;
}`;

ts = ts.replace(targetStatus, replaceStatus);

const targetAddLog = `  const addLog = (msg: string) => {
    status.logs.push(msg);
    if (status.logs.length > 2000) status.logs.shift(); // keep last 2000 lines
  };`;

const replaceAddLog = `  const addLog = (msg: string) => {
    status.logs.push(msg);
    if (status.logs.length > 2000) status.logs.shift(); // keep last 2000 lines
    
    // Auto-detect ports from output
    const portMatch = msg.match(/http:\\/\\/(?:localhost|127\\.0\\.0\\.1|0\\.0\\.0\\.0):(\\d+)/i);
    if (portMatch && !status.port) {
        status.port = parseInt(portMatch[1]);
    }
  };`;

ts = ts.replace(targetAddLog, replaceAddLog);

fs.writeFileSync('run-engine.ts', ts, 'utf8');
