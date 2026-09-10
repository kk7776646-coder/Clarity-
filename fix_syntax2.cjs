const fs = require('fs');
let code = fs.readFileSync('server.ts', 'utf8');

code = code.replace(/      const modelConfig = models.get\(activeModelId\);/g, "    try {\n      const modelConfig = models.get(activeModelId);");

fs.writeFileSync('server.ts', code);
