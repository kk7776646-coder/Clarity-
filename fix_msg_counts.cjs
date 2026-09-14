const fs = require('fs');

// Fix server.ts
let serverFile = fs.readFileSync('server.ts', 'utf8');
serverFile = serverFile.replace(
  /for \(const m of messages\.values\(\)\) \{\n\s*if \(m\.conversation_id\) \{\n\s*const cur = msgCounts\.get\(m\.conversation_id\) \|\| 0;\n\s*msgCounts\.set\(m\.conversation_id, cur \+ 1\);\n\s*\}\n\s*\}/,
  `for (const m of messages.values()) {
      if (m.conversation_id && (m.role === 'user' || m.role === 'model')) {
        const cur = msgCounts.get(m.conversation_id) || 0;
        msgCounts.set(m.conversation_id, cur + 1);
      }
    }`
);
fs.writeFileSync('server.ts', serverFile, 'utf8');

// Fix db.ts
let dbFile = fs.readFileSync('db.ts', 'utf8');
dbFile = dbFile.replace(
  /SELECT conversation_id, COUNT\(\*\) as count FROM messages GROUP BY conversation_id/,
  `SELECT conversation_id, COUNT(*) as count FROM messages WHERE role IN ('user', 'model') GROUP BY conversation_id`
);
fs.writeFileSync('db.ts', dbFile, 'utf8');

console.log("Success fixing msg counts");
