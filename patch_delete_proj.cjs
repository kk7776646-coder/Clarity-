const fs = require('fs');
let code = fs.readFileSync('server.ts', 'utf8');

const target = `    // 2. Clear in-memory project caches
    projects.delete(pid);
    projectAnalyses.delete(pid);`;

const replacement = `    // 2. Clear in-memory project caches
    projects.delete(pid);
    projectAnalyses.delete(pid);

    // 2b. Delete associated conversations and messages from memory
    const convsToDelete = new Set<string>();
    for (const [cid, c] of conversations.entries()) {
      if (c.project_id === pid) {
        conversations.delete(cid);
        convsToDelete.add(cid);
      }
    }
    for (const [mid, m] of messages.entries()) {
      if (convsToDelete.has(m.conversation_id)) {
        messages.delete(mid);
      }
    }`;

code = code.replace(target, replacement);
fs.writeFileSync('server.ts', code);
