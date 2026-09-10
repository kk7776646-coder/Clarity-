const fs = require('fs');
let code = fs.readFileSync('server.ts', 'utf8');

const replacement = `
    projects.delete(pid);
    for (const [id, f] of files.entries()) {
      if (f.project_id === pid) {
        files.delete(id);
      }
    }
`;

code = code.replace(/    projects\.delete\(pid\);\n    projectFiles\.delete\(pid\);/g, replacement);
fs.writeFileSync('server.ts', code);
