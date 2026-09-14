const fs = require('fs');
let code = fs.readFileSync('server.ts', 'utf8');

const target1 = `          await streamGeminiWithResilience({
            apiKey,
            modelName: modelConfig.modelName,
            contents: geminiContents,
            systemInstruction,
            onChunk: (chunkText) => {
              if (chunkText) sendSSE({ content: chunkText, intent: "CODE_EXPLANATION" });
            },
          });`;

const replacement1 = `          await streamGeminiWithResilience({
            apiKey,
            modelName: modelConfig.modelName,
            contents: geminiContents,
            systemInstruction,
            abortSignal: abortController?.signal,
            onChunk: (chunkText) => {
              if (chunkText) sendSSE({ content: chunkText, intent: "CODE_EXPLANATION" });
            },
          });`;

const target2 = `          const resOpenAi = await fetch(\`\${baseUrl.replace(/\\/$/, "")}/chat/completions\`, {
            method: "POST",
            headers,
            body: JSON.stringify({
              model: modelConfig.modelName || "gpt-3.5-turbo",
              messages: [{ role: "system", content: systemInstruction }, ...openAiContents],
              stream: true
            })
          });`;

const replacement2 = `          const resOpenAi = await fetch(\`\${baseUrl.replace(/\\/$/, "")}/chat/completions\`, {
            method: "POST",
            headers,
            body: JSON.stringify({
              model: modelConfig.modelName || "gpt-3.5-turbo",
              messages: [{ role: "system", content: systemInstruction }, ...openAiContents],
              stream: true
            }),
            signal: abortController?.signal
          });`;

code = code.split(target1).join(replacement1);
code = code.split(target2).join(replacement2);
fs.writeFileSync('server.ts', code);
