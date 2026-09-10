import { spawn, ChildProcess } from "child_process";
import fs from "fs";
import path from "path";
import os from "os";


export interface TestResults {
  total: number;
  passed: number;
  failed: number;
  skipped: number;
  duration?: string;
}

export interface RunStatus {
  testResults?: TestResults;
  status: "idle" | "starting" | "running" | "failed" | "completed" | "stopped";
  pid?: number;
  port?: number;
  command?: string;
  exitCode?: number | null;
  logs: string[];
  startTime?: number;
  error?: string;
  runtime?: string;
}

const activeRuns = new Map<string, { process: ChildProcess; status: RunStatus }>();
const RUN_DIR = path.join(os.tmpdir(), "clarity_run");

if (!fs.existsSync(RUN_DIR)) {
  fs.mkdirSync(RUN_DIR, { recursive: true });
}

export function detectRuntimeConfig(files: any[]) {
  const fileNames = files.map(f => f.filename.toLowerCase());
  let runtime = "Unknown";
  let runCommand = "";
  let buildCommand = "";
  let testCommand = "";

  if (fileNames.includes("package.json")) {
    runtime = "Node.js";
    const pkgStr = files.find(f => f.filename.toLowerCase() === "package.json")?.content || "{}";
    try {
      const pkg = JSON.parse(pkgStr);
      if (pkg.scripts?.start) runCommand = "npm start";
      else if (pkg.scripts?.dev) runCommand = "npm run dev";
      else runCommand = "node index.js";

      if (pkg.scripts?.build) buildCommand = "npm run build";
      if (pkg.scripts?.test) testCommand = "npm test";
    } catch {
      runCommand = "npm start";
    }
  } else if (fileNames.includes("requirements.txt") || fileNames.includes("main.py") || fileNames.includes("app.py")) {
    runtime = "Python";
    const entry = fileNames.includes("main.py") ? "main.py" : fileNames.includes("app.py") ? "app.py" : "server.py";
    runCommand = `python3 ${entry}`;
    testCommand = "pytest";
  } else if (fileNames.includes("go.mod") || fileNames.includes("main.go")) {
    runtime = "Go";
    runCommand = "go run .";
    buildCommand = "go build .";
    testCommand = "go test ./...";
  }

  return { runtime, runCommand, buildCommand, testCommand };
}


function parseTestResults(logs: string[]): TestResults | undefined {
  const fullOutput = logs.join("");
  const res: TestResults = { total: 0, passed: 0, failed: 0, skipped: 0 };
  let found = false;

  // Jest / Mocha
  const jestMatch = fullOutput.match(/Tests:\s+(\d+)\s+failed,\s+(\d+)\s+passed,\s+(\d+)\s+total/);
  if (jestMatch) {
    res.failed = parseInt(jestMatch[1]);
    res.passed = parseInt(jestMatch[2]);
    res.total = parseInt(jestMatch[3]);
    found = true;
  }
  
  // Pytest
  const pyMatch = fullOutput.match(/===\s+(\d+)\s+passed,\s+(\d+)\s+failed.*in\s+([\d.]+s)\s+===/);
  if (pyMatch) {
    res.passed = parseInt(pyMatch[1]);
    res.failed = parseInt(pyMatch[2]);
    res.total = res.passed + res.failed;
    res.duration = pyMatch[3];
    found = true;
  }

  // Generic fallback if not matched but we see "passing" / "failing"
  if (!found) {
    const passMatch = fullOutput.match(/(\d+)\s+passing/);
    const failMatch = fullOutput.match(/(\d+)\s+failing/);
    if (passMatch || failMatch) {
      res.passed = passMatch ? parseInt(passMatch[1]) : 0;
      res.failed = failMatch ? parseInt(failMatch[1]) : 0;
      res.total = res.passed + res.failed;
      found = true;
    }
  }

  return found ? res : undefined;
}

function writeProjectToDisk(projectId: string, files: any[]): string {
  const projDir = path.join(RUN_DIR, projectId);
  if (fs.existsSync(projDir)) {
    fs.rmSync(projDir, { recursive: true, force: true });
  }
  fs.mkdirSync(projDir, { recursive: true });

  for (const file of files) {
    if (!file.filename) continue;
    const filePath = path.join(projDir, file.filename);
    const dir = path.dirname(filePath);
    if (!fs.existsSync(dir)) fs.mkdirSync(dir, { recursive: true });
    
    if (file.buffer) {
      fs.writeFileSync(filePath, file.buffer);
    } else if (file.content !== undefined) {
      fs.writeFileSync(filePath, file.content, "utf8");
    }
  }
  return projDir;
}

export async function executeCommand(
  projectId: string, 
  files: any[], 
  commandType: "run" | "build" | "test",
  customCommand?: string
): Promise<RunStatus> {
  const existing = activeRuns.get(projectId);
  if (existing) {
    if (existing.status.status === "running" || existing.status.status === "starting") {
      if (commandType === "run") {
        throw new Error("Project is already running. Please stop it first.");
      } else {
        // Stop current to build/test? Or just reject?
        throw new Error(`Cannot ${commandType} while project is running.`);
      }
    }
  }

  const projDir = writeProjectToDisk(projectId, files);
  const config = detectRuntimeConfig(files);
  
  let cmd = customCommand;
  if (!cmd) {
    if (commandType === "run") cmd = config.runCommand;
    else if (commandType === "build") cmd = config.buildCommand;
    else if (commandType === "test") cmd = config.testCommand;
  }

  if (!cmd) {
    throw new Error(`No ${commandType} command detected for runtime: ${config.runtime}`);
  }

  const status: RunStatus = {
    status: "starting",
    command: cmd,
    logs: [],
    startTime: Date.now(),
    runtime: config.runtime
  };

  const addLog = (msg: string) => {
    status.logs.push(msg);
    if (status.logs.length > 2000) status.logs.shift(); // keep last 2000 lines
  };

  addLog(`$ ${cmd}\n`);

  // Detect dependencies installation
  if (config.runtime === "Node.js" && fs.existsSync(path.join(projDir, "package.json"))) {
    addLog("Installing dependencies (npm install)...");
    // Synchronous install for simplicity or run as part of the command? 
    // We will just chain the command for simplicity in this sandbox
    if (!cmd.includes("npm install")) {
       cmd = `npm install --no-audit --no-fund && ${cmd}`;
    }
  } else if (config.runtime === "Python" && fs.existsSync(path.join(projDir, "requirements.txt"))) {
    addLog("Installing dependencies (pip install -r requirements.txt)...");
    if (!cmd.includes("pip install")) {
       cmd = `pip3 install -r requirements.txt && ${cmd}`;
    }
  }

  const proc = spawn(cmd, {
    cwd: projDir,
    shell: true,
    env: { ...process.env, PORT: "3001" }, // run projects on 3001 internally if needed
  });

  status.pid = proc.pid;
  status.status = commandType === "run" ? "running" : "starting";
  
  activeRuns.set(projectId, { process: proc, status });

  proc.stdout.on("data", (data) => {
    const str = data.toString();
    addLog(str);
  });

  proc.stderr.on("data", (data) => {
    const str = data.toString();
    addLog(str);
  });

  proc.on("close", (code) => {
    status.status = code === 0 ? "completed" : "failed";
    if (commandType === "test") {
      status.testResults = parseTestResults(status.logs);
    }
    status.exitCode = code;
    if (code !== 0) {
      status.error = `Process exited with code ${code}`;
    }
    addLog(`\n[Process terminated with code ${code}]`);
  });

  proc.on("error", (err) => {
    status.status = "failed";
    status.error = err.message;
    addLog(`\n[Execution Error: ${err.message}]`);
  });

  // Timeout logic (e.g. 5 mins max run)
  if (commandType !== "run") {
    setTimeout(() => {
      if (status.status === "starting" || status.status === "running") {
        proc.kill("SIGKILL");
        status.status = "failed";
        status.error = "Timeout exceeded (5m)";
        addLog(`\n[Timeout exceeded (5m)]`);
      }
    }, 5 * 60 * 1000);
  }

  return status;
}

export function stopProject(projectId: string): RunStatus {
  const active = activeRuns.get(projectId);
  if (!active) {
    return { status: "idle", logs: [] };
  }
  
  active.process.kill("SIGKILL");
  active.status.status = "stopped";
  active.status.logs.push("\n[Process stopped by user]");
  return active.status;
}

export function getRunStatus(projectId: string): RunStatus {
  const active = activeRuns.get(projectId);
  if (!active) {
    return { status: "idle", logs: [] };
  }
  return active.status;
}
