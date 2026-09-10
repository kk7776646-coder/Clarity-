const fs = require('fs');
let code = fs.readFileSync('server.ts', 'utf8');

code = code.replace(/deleteProjectAnalysis\(pid\);/g, 'dbDeleteProjectAnalysis(pid);');
fs.writeFileSync('server.ts', code);
