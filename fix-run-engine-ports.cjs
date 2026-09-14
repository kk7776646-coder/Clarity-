const fs = require('fs');
let ts = fs.readFileSync('run-engine.ts', 'utf8');

// We want to make port detection slightly more robust and clean up the process on deletion.
const portDetectionStr = `const portMatch = msg.match(/(?:http:\\/\\/(?:localhost|127\\.0\\.0\\.1|0\\.0\\.0\\.0):(\\d+)|Port\\s+(\\d+)|Listening on\\s+.*?:(\\d+))/i);`;

if (ts.includes(portDetectionStr)) {
    const newPortDetectionStr = `const portMatch = msg.match(/(?:http:\\/\\/(?:localhost|127\\.0\\.0\\.1|0\\.0\\.0\\.0):(\\d+)|Port\\s+(\\d+)|Listening on\\s+.*?:(\\d+)|Local:\\s+http:\\/\\/localhost:(\\d+))/i);
        if (portMatch && !session.port) {
            session.port = parseInt(portMatch[1] || portMatch[2] || portMatch[3] || portMatch[4]);
        }`;
    
    // We also need to add the extraction for group 4
    
    const blockStart = ts.indexOf('// Auto-detect ports');
    const blockEnd = ts.indexOf('};', blockStart);
    
    if (blockStart > -1 && blockEnd > -1) {
        const slice = ts.substring(blockStart, blockEnd);
        ts = ts.replace(slice, `// Auto-detect ports
        const portMatch = msg.match(/(?:http:\\/\\/(?:localhost|127\\.0\\.0\\.1|0\\.0\\.0\\.0):(\\d+)|Port\\s+(\\d+)|Listening on\\s+.*?:(\\d+)|Local:\\s+http:\\/\\/localhost:(\\d+))/i);
        if (portMatch && !session.port) {
            session.port = parseInt(portMatch[1] || portMatch[2] || portMatch[3] || portMatch[4]);
        }
    `);
        fs.writeFileSync('run-engine.ts', ts, 'utf8');
        console.log("Port detection expanded");
    }
}
