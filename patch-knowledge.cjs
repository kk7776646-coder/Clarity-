const fs = require('fs');

let ke = fs.readFileSync('knowledge-engine.ts', 'utf8');
if (!ke.includes('deleteProjectKnowledge')) {
  ke += `\nexport function deleteProjectKnowledge(projectId: string) {
  knowledgeStore.delete(projectId);
}\n`;
  fs.writeFileSync('knowledge-engine.ts', ke);
}

let server = fs.readFileSync('server.ts', 'utf8');
if (server.includes('deleteFileKnowledge(pid, cleanPath);') && server.includes('app.delete("/api/projects/:pid"')) {
  server = server.replace(
    /if \(f\.project_id === pid\) files\.delete\(fid\);\s*deleteFileKnowledge\(pid, cleanPath\);/,
    "if (f.project_id === pid) files.delete(fid);\n      }\n      deleteProjectKnowledge(pid);"
  );
  server = server.replace(
    'deleteFileKnowledge, getProjectKnowledge, searchKnowledge } from "./knowledge-engine.js";',
    'deleteFileKnowledge, getProjectKnowledge, searchKnowledge, deleteProjectKnowledge } from "./knowledge-engine.js";'
  );
  fs.writeFileSync('server.ts', server);
}
console.log("Patched deleteProjectKnowledge");
