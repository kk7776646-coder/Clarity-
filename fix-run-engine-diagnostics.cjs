const fs = require('fs');
let ts = fs.readFileSync('run-engine.ts', 'utf8');

const targetLogsStart = `const addLog = (msg: string) => {`;
const targetLogsEnd = `};`;

const blockStart = ts.indexOf(targetLogsStart);
const blockEnd = ts.indexOf(targetLogsEnd, blockStart);

if (blockStart > -1 && blockEnd > -1) {
    const slice = ts.substring(blockStart, blockEnd + targetLogsEnd.length);
    
    // We are adding basic diagnostics parsing to the session object
    if (!ts.includes('diagnostics: any[]')) {
        ts = ts.replace('port?: number;', 'port?: number;\n    diagnostics?: {file: string, line: number, message: string}[];');
    }
    
    const newLogsBlock = `const addLog = (msg: string) => {
        session.logs.push(msg);
        if (session.logs.length > 5000) session.logs.shift(); // Max 5000 lines
        
        // Auto-detect ports
        const portMatch = msg.match(/(?:http:\\/\\/(?:localhost|127\\.0\\.0\\.1|0\\.0\\.0\\.0):(\\d+)|Port\\s+(\\d+)|Listening on\\s+.*?:(\\d+)|Local:\\s+http:\\/\\/localhost:(\\d+))/i);
        if (portMatch && !session.port) {
            session.port = parseInt(portMatch[1] || portMatch[2] || portMatch[3] || portMatch[4]);
        }
        
        // Basic diagnostics parsing (Error: /path/to/file.ts:24:5)
        const errMatch = msg.match(/([a-zA-Z0-9_\\-\\.\\/]+):(\\d+):(\\d+)\\s*-\\s*error/i) || 
                         msg.match(/Error:.*\\n\\s*at.*?\\((.*?):(\\d+):(\\d+)\\)/);
        if (errMatch) {
            if (!session.diagnostics) session.diagnostics = [];
            session.diagnostics.push({
                file: errMatch[1],
                line: parseInt(errMatch[2]),
                message: msg.substring(0, 100).trim() + "..."
            });
        }
    };`;
    
    ts = ts.replace(slice, newLogsBlock);
    fs.writeFileSync('run-engine.ts', ts, 'utf8');
    console.log("Diagnostics parsing added to run-engine");
}
