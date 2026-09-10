const fs = require('fs');

let code = fs.readFileSync('server.ts', 'utf8');

// 1. Fix message extraction
code = code.replace(
`    const textMsg = String(message || "").trim();`,
`    let textMsg = "";
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

// 2. Rewrite AI streaming block
const oldTryBlock = `    try {
      const gemini = getGeminiClient();
      if (gemini) {
        // Build conversation history for Gemini
        const history = existingMsgs.slice(-10).map((m) => ({
          role: m.role === "assistant" ? "model" : "user",
          parts: [{ text: m.content }],
        }));

        try {
          const responseStream = await gemini.models.generateContentStream({
            model: "gemini-2.5-flash",
            contents: [
              ...history,
              {
                role: "user",
                parts: [{ text: promptWithContext }],
              },
            ],
            config: {
              systemInstruction:
                "You are Clarity, an intelligent AI assistant grounded in the user's personal and organizational knowledge. You provide crisp, well-structured, clear, and actionable answers with code blocks and formatting where appropriate.",
            },
          });

          for await (const chunk of responseStream) {
            const chunkText = chunk.text || "";
            if (chunkText) {
              assistantText += chunkText;
              sendSSE({ content: chunkText });
            }
          }
        } catch (geminiErr: any) {
          console.warn("Gemini stream warning, using fallback response:", geminiErr?.message);
          const fallbackText = \`I am **Clarity**, your AI knowledge assistant.\\n\\nI have processed your query: *"**\${textMsg}**"*\\n\\nYour knowledge workspace is connected. Upload documents (PDF, DOCX, Code, CSV) via the **Knowledge Base** tab to provide rich context for answers.\`;
          assistantText = fallbackText;
          sendSSE({ content: fallbackText });
        }
      } else {
        // Fallback intelligent generator if GEMINI_API_KEY is not configured
        const fallbackChunks = [
          \`I am **Clarity**, your AI knowledge assistant. \`,
          \`I've received your query: *"\`,
          textMsg.length > 50 ? textMsg.substring(0, 50) + "..." : textMsg,
          \`"*\\n\\n\`,
          \`Here are key insights:\\n\\n\`,
          \`- **Knowledge Grounding**: You can upload documents (PDF, DOCX, CSV, Markdown, Code) via the **Knowledge Base** tab to provide custom context for answers.\\n\`,
          \`- **Multi-Model Support**: Clarity supports Google Gemini, OpenAI GPT-4o, Anthropic Claude, Groq, and custom OpenAI-compatible endpoints.\\n\`,
          \`- **Code & Projects**: You can inspect codebases, analyze architecture, and run project indexing in the **Projects** workspace.\\n\\n\`,
          \`To enable live AI generation with real models, configure your \\\`GEMINI_API_KEY\\\` in your environment settings.\`,
        ];
        for (const chunk of fallbackChunks) {
          assistantText += chunk;
          sendSSE({ content: chunk });
          await new Promise((r) => setTimeout(r, 60));
        }
      }
    } catch (err: any) {
      console.error("Chat streaming error:", err);
      sendSSE({ error: err.message || "An error occurred during response generation." });
    }`;

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
            const lines = buffer.split("\\n");
            buffer = lines.pop() || "";
            for (const line of lines) {
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

const oldIndex = code.indexOf(oldTryBlock);
if (oldIndex !== -1) {
    code = code.substring(0, oldIndex) + newTryBlock + code.substring(oldIndex + oldTryBlock.length);
    fs.writeFileSync('server.ts', code);
    console.log("Successfully patched chat logic.");
} else {
    console.error("Could not find oldTryBlock. The exact text did not match.");
}
