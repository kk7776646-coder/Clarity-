const fs = require('fs');
let code = fs.readFileSync('project-diagnostics.ts', 'utf8');

code = code.replace(/const errMsg = String\(err\.message \|\| ""\);/g, 'const errMsg = String(formatApiError(err) || "");');

fs.writeFileSync('project-diagnostics.ts', code);
