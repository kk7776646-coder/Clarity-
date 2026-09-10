const fs = require('fs');
let code = fs.readFileSync('server.ts', 'utf8');

const targetImport = `import { indexProject, updateFileKnowledge, deleteFileKnowledge, getProjectKnowledge } from "./knowledge-engine.js";`;
const newImport = `import { indexProject, updateFileKnowledge, deleteFileKnowledge, getProjectKnowledge, searchKnowledge } from "./knowledge-engine.js";`;
code = code.replace(targetImport, newImport);

const badRequire = `    const { searchKnowledge } = require('./knowledge-engine.js');`;
code = code.replace(badRequire, ``);

fs.writeFileSync('server.ts', code);
console.log("Fixed import in server.ts");
