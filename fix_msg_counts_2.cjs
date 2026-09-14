const fs = require('fs');

// Fix server.ts
let serverFile = fs.readFileSync('server.ts', 'utf8');
serverFile = serverFile.replace(
  /m\.role === 'user' \|\| m\.role === 'model'/g,
  `m.role === 'user' || m.role === 'assistant'`
);
fs.writeFileSync('server.ts', serverFile, 'utf8');

// Fix db.ts
let dbFile = fs.readFileSync('db.ts', 'utf8');
dbFile = dbFile.replace(
  /role IN \('user', 'model'\)/g,
  `role IN ('user', 'assistant')`
);
fs.writeFileSync('db.ts', dbFile, 'utf8');

console.log("Success fixing msg counts 2");
