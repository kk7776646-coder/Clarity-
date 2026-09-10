const fs = require('fs');
const code = fs.readFileSync('server.ts', 'utf8');

const missingPart = `  // Regenerate endpoint
  app.post("/api/conversations/:cid/regenerate", async (req, res) => {
    const cid = req.params.cid;
    const conv = conversations.get(cid);
    if (!conv) return res.status(404).json({ error: "Conversation not found", type: "not_found" });

    // Find last user message
    const convMsgs = Array.from(messages.values())
      .filter((m) => m.conversation_id === cid)
      .sort((a, b) => a.created_at - b.created_at);

    // Remove last assistant message if exists
    if (convMsgs.length > 0 && convMsgs[convMsgs.length - 1].role === "assistant") {
      const lastAss = convMsgs.pop()!;
      messages.delete(lastAss.id);
    }
`;

const newCode = code.replace(
  /    const lastUser = convMsgs\.reverse\(\)\.find\(\(m\) => m\.role === "user"\);/,
  missingPart + '    const lastUser = convMsgs.reverse().find((m) => m.role === "user");'
);

fs.writeFileSync('server.ts', newCode);
console.log("Restored regenerate endpoint");
