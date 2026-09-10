const fs = require('fs');
let code = fs.readFileSync('server.ts', 'utf8');

// Replace require
code = code.replace(/const \{ GoogleGenAI \} = require\("@google\/genai"\);/g, "");

// Replace existingMsgs in regenerate
// In POST /regenerate, existingMsgs is used but not defined.
// We'll replace it with a newly fetched array.
code = code.replace(
  /let expectedRole = "user";\s*for \(const m of existingMsgs\.slice\(-10\)\) \{/g,
  `let expectedRole = "user";
      const existingMsgsForRegen = Array.from(messages.values())
        .filter((m) => m.conversation_id === cid)
        .sort((a, b) => a.created_at - b.created_at);
      for (const m of existingMsgsForRegen.slice(-10)) {`
);

fs.writeFileSync('server.ts', code);
