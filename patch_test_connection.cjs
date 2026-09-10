const fs = require('fs');
let code = fs.readFileSync('server.ts', 'utf8');

const target = `  app.post("/api/models/test", async (req, res) => {
    const body = req.body || {};
    const mid = String(body.id || "").trim();
    const m = models.get(mid) || body;
    const provider = String(m.provider || "").toLowerCase();
    if (provider === "gemini") {
      const gemini = getGeminiClient();
      if (gemini || m.apiKey) {
        return res.json({ ok: true, message: "Gemini connection successful" });
      }
      return res.json({ ok: true, message: "Gemini provider verified" });
    }
    // Generic check
    return res.json({ ok: true, message: "Connection verified" });
  });`;

const replacement = `  app.post("/api/models/test", async (req, res) => {
    const body = req.body || {};
    const mid = String(body.id || "").trim();
    const m = models.get(mid) || body;
    const provider = String(m.provider || "").toLowerCase();
    
    if (provider === "gemini") {
      try {
        const apiKey = m.apiKey || process.env.GEMINI_API_KEY || process.env.GOOGLE_API_KEY;
        if (!apiKey) return res.status(400).json({ error: "API Key required for Gemini." });
        const ai = new GoogleGenAI({ apiKey });
        const testModel = m.modelName || "gemini-3.6-flash";
        await ai.models.generateContent({ model: testModel, contents: "test" });
        return res.json({ ok: true, message: "Gemini connection successful" });
      } catch (err: any) {
        return res.status(400).json({ error: \`Connection failed: \${err.message}\` });
      }
    }
    
    try {
      const baseUrl = m.baseUrl;
      if (!baseUrl) return res.status(400).json({ error: "Base URL is required." });
      const headers: Record<string, string> = { "Content-Type": "application/json" };
      if (m.apiKey) headers["Authorization"] = \`Bearer \${m.apiKey}\`;
      const response = await fetch(\`\${baseUrl.replace(/\\/$/, "")}/models\`, { method: "GET", headers });
      if (!response.ok) {
         throw new Error(\`HTTP \${response.status}: \${await response.text()}\`);
      }
      return res.json({ ok: true, message: "Connection verified successfully." });
    } catch (err: any) {
      return res.status(400).json({ error: \`Connection failed: \${err.message}\` });
    }
  });`;

code = code.replace(target, replacement);
fs.writeFileSync('server.ts', code);
