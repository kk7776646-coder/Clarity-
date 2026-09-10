const fs = require('fs');
let code = fs.readFileSync('server.ts', 'utf8');

// We want to replace the try { const gemini = getGeminiClient(); ... } block in BOTH POST /messages and POST /regenerate

function buildReplacement(assistantMsgIdVar) {
  return `
    try {
      const modelConfig = models.get(activeModelId);
      if (!modelConfig) {
        throw new Error(\`Model configuration for '\${activeModelId}' not found.\`);
      }

      // Build conversation history
      const existingMsgs = Array.from(messages.values()).filter((m) => m.conversation_id === cid);
      const history = [];
      let expectedRole = "user";
      for (const m of existingMsgs.slice(-10)) {
        const role = m.role === "assistant" ? "model" : "user";
        if (role === expectedRole && m.content?.trim()) {
          history.push({ role, parts: [{ text: m.content }] });
          expectedRole = expectedRole === "user" ? "model" : "user";
        }
      }
      if (history.length > 0 && history[history.length - 1].role === "user") {
        history.pop();
      }

      if (modelConfig.provider === "gemini") {
        const apiKey = modelConfig.apiKey || process.env.GEMINI_API_KEY || process.env.GOOGLE_API_KEY;
        if (!apiKey) throw new Error("Gemini API key is missing.");
        
        const { GoogleGenAI } = require("@google/genai");
        const ai = new GoogleGenAI({ apiKey });
        const responseStream = await ai.models.generateContentStream({
          model: modelConfig.modelName || "gemini-3.6-flash",
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
        // OpenAI compatible endpoint
        const baseUrl = modelConfig.baseUrl;
        if (!baseUrl) throw new Error("Base URL is missing for this model.");
        
        const openAiHistory = history.map(h => ({
          role: h.role === "model" ? "assistant" : "user",
          content: h.parts[0].text
        }));
        openAiHistory.push({ role: "user", content: promptWithContext });

        const headers = { "Content-Type": "application/json" };
        if (modelConfig.apiKey) headers["Authorization"] = \`Bearer \${modelConfig.apiKey}\`;
        
        const reqBody = {
          model: modelConfig.modelName || "gpt-3.5-turbo",
          messages: [
            { role: "system", content: "You are Clarity, an intelligent AI assistant grounded in the user's personal and organizational knowledge." },
            ...openAiHistory
          ],
          stream: true
        };
        
        const response = await fetch(\`\${baseUrl.replace(/\\/$/, "")}/chat/completions\`, {
          method: "POST",
          headers,
          body: JSON.stringify(reqBody)
        });
        
        if (!response.ok) {
           throw new Error(\`HTTP \${response.status}: \${await response.text()}\`);
        }
        
        if (response.body) {
           const reader = response.body.getReader();
           const decoder = new TextDecoder();
           let buffer = "";
           while (true) {
             const { done, value } = await reader.read();
             if (done) break;
             buffer += decoder.decode(value, { stream: true });
             const lines = buffer.split("\\n");
             buffer = lines.pop() || "";
             for (const line of lines) {
               if (line.startsWith("data: ") && line !== "data: [DONE]") {
                 try {
                   const parsed = JSON.parse(line.slice(6));
                   const token = parsed.choices?.[0]?.delta?.content || "";
                   if (token) {
                     assistantText += token;
                     sendSSE({ content: token });
                   }
                 } catch (e) {}
               }
             }
           }
        }
      }
    } catch (providerErr) {
      console.error("Provider API stream error:", providerErr);
      const errDetail = providerErr?.message || "Unknown error occurred";
      const displayErr = \`\\n\\n⚠️ **Model Error (\${activeModelId})**: \${errDetail}\\n\\nPlease check your prompt or model configuration.\`;
      assistantText = displayErr;
      sendSSE({ content: displayErr });
    }`;
}

const origRegex = /try \{\s*const gemini = getGeminiClient\(\);\s*if \(gemini\) \{[\s\S]*?\} else \{\s*\/\/\s*Fallback intelligent generator[\s\S]*?\}\s*\}\s*\} catch \(geminiErr: any\) \{\s*console\.error\("Gemini API stream error:", geminiErr\);\s*const errDetail = geminiErr\?\.message \|\| "Unknown error occurred";\s*const displayErr = [^;]+;\s*assistantText = displayErr;\s*sendSSE\(\{ content: displayErr \}\);\s*\}\s*\} else \{[\s\S]*?\}\s*\}/g;

code = code.replace(origRegex, buildReplacement());
fs.writeFileSync('server.ts', code);
