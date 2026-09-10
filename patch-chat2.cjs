const fs = require('fs');
let code = fs.readFileSync('server.ts', 'utf8');

// Replace lines 788 to 849
const lines = code.split('\n');

const newTryBlock = `    try {
      const model = models.get(activeModelId) || models.get("clarity-gemini");
      if (!model) {
        throw new Error("Configured model not found.");
      }

      if (model.provider === "gemini") {
        const apiKey = model.apiKey || process.env.GEMINI_API_KEY || process.env.GOOGLE_API_KEY;
        if (!apiKey) {
          throw new Error("GEMINI_API_KEY is not configured for this model.");
        }
        const gemini = new GoogleGenAI({ apiKey });
        
        const history = existingMsgs.slice(-10).map((m) => ({
          role: m.role === "assistant" ? "model" : "user",
          parts: [{ text: m.content }],
        }));

        const responseStream = await gemini.models.generateContentStream({
          model: model.modelName || "gemini-2.5-flash",
          contents: [
            ...history,
            {
              role: "user",
              parts: [{ text: promptWithContext }],
            },
          ],
          config: {
            systemInstruction: "You are Clarity, an intelligent AI assistant grounded in the user's personal and organizational knowledge. You provide crisp, well-structured, clear, and actionable answers with code blocks and formatting where appropriate.",
          },
        });

        for await (const chunk of responseStream) {
          const chunkText = chunk.text || "";
          if (chunkText) {
            assistantText += chunkText;
            sendSSE({ content: chunkText });
          }
        }
      } else {
        // Custom OpenAI-compatible endpoints
        if (!model.baseUrl) {
          throw new Error("Base URL is required for custom models.");
        }
        
        const headers = { "Content-Type": "application/json", "Authorization": "" };
        if (model.apiKey) headers["Authorization"] = \`Bearer \${model.apiKey}\`;
        else delete headers["Authorization"];

        const messagesPayload = existingMsgs.slice(-10).map((m) => ({
          role: m.role === "assistant" ? "assistant" : "user",
          content: m.content
        }));
        
        messagesPayload.push({ role: "user", content: promptWithContext });
        
        const payload = {
          model: model.modelName,
          messages: [
            { role: "system", content: "You are Clarity, an intelligent AI assistant grounded in the user's personal and organizational knowledge." },
            ...messagesPayload
          ],
          stream: true,
          temperature: model.defaultTemperature,
          top_p: model.defaultTopP
        };

        const resFetch = await fetch(model.baseUrl + "/chat/completions", {
          method: "POST",
          headers,
          body: JSON.stringify(payload)
        });

        if (!resFetch.ok) {
          const errBody = await resFetch.text();
          throw new Error(\`Provider HTTP \${resFetch.status}: \${errBody}\`);
        }

        if (resFetch.body) {
          const reader = resFetch.body.getReader();
          const decoder = new TextDecoder("utf-8");
          let buffer = "";
          while (true) {
            const { done, value } = await reader.read();
            if (done) break;
            buffer += decoder.decode(value, { stream: true });
            const streamLines = buffer.split("\\n");
            buffer = streamLines.pop() || "";
            for (const line of streamLines) {
              if (line.startsWith("data: ")) {
                const dataStr = line.slice(6).trim();
                if (dataStr === "[DONE]") continue;
                if (dataStr) {
                  try {
                    const data = JSON.parse(dataStr);
                    const content = data.choices?.[0]?.delta?.content;
                    if (content) {
                      assistantText += content;
                      sendSSE({ content });
                    }
                  } catch (e) {}
                }
              }
            }
          }
        }
      }
    } catch (err: any) {
      console.error("Chat streaming error:", err);
      sendSSE({ error: err.message || "An error occurred during response generation." });
    }`;

// Find start and end indices of the try block
let startIndex = -1;
let endIndex = -1;

for (let i = 0; i < lines.length; i++) {
  if (lines[i].includes("try {") && lines[i+1]?.includes("const gemini = getGeminiClient();")) {
    startIndex = i;
  }
  if (startIndex !== -1 && lines[i].includes("} catch (err: any) {")) {
    endIndex = i + 3; // include catch block
    break;
  }
}

if (startIndex !== -1 && endIndex !== -1) {
  const newLines = [
    ...lines.slice(0, startIndex),
    newTryBlock,
    ...lines.slice(endIndex)
  ];
  
  let newCode = newLines.join('\\n');
  
  // Replace the string normalization logic
  newCode = newCode.replace(
    'const textMsg = String(message || "").trim();',
    `let textMsg = "";
    if (typeof message === "string") {
      textMsg = message.trim();
    } else if (Array.isArray(message)) {
      textMsg = message.map((m) => m.text || m.content || JSON.stringify(m)).join("\\n").trim();
    } else if (message && typeof message === "object") {
      textMsg = String(message.text || message.content || JSON.stringify(message)).trim();
    } else {
      textMsg = String(message || "").trim();
    }`
  );
  
  fs.writeFileSync('server.ts', newCode);
  console.log("Patched successfully");
} else {
  console.log("Could not find block boundaries", startIndex, endIndex);
}
