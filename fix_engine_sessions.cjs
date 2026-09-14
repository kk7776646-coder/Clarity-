const fs = require('fs');
let ts = fs.readFileSync('run-engine.ts', 'utf8');

// activeRuns is a map of projectId -> RunStatus wrapper. We want projectId -> Map<sessionId, RunStatus wrapper>
// Actually, let's just make it activeRuns = new Map<string, { process: any, status: RunStatus }>()
// where the key is \`\${projectId}_\${sessionId}\`.

let oldMap = `const activeRuns = new Map<string, { process: any, status: RunStatus }>();`;
let newMap = `const activeRuns = new Map<string, { process: any, status: RunStatus }>();`;
// Wait, that's the same. We just need to change how it's keyed.
