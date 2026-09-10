const fs = require('fs');
let code = fs.readFileSync('server.ts', 'utf8');
code = code.replace(
`        deleteFileKnowledge(pid, f.filename);
      }
      deleteProjectKnowledge(pid);
      }
      return res.json({ deleted: true, id: pid });`,
`        deleteFileKnowledge(pid, f.filename);
      }
      deleteProjectKnowledge(pid);
      return res.json({ deleted: true, id: pid });`
);
fs.writeFileSync('server.ts', code);
