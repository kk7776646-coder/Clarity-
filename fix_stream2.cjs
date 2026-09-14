const fs = require('fs');
let code = fs.readFileSync('server.ts', 'utf8');

const target1 = `        try {
          await streamGeminiWithResilience({
            apiKey,
            modelName: modelConfig.modelName,
            contents,
            systemInstruction: "You are an intelligent AI code assistant integrated directly into an interactive development workspace.",
            onChunk: (text) => {
              assistantText += text;
              sendSSE({ content: text });
            },
          });
        } catch (e: any) {`;

const replacement1 = `        try {
          await streamGeminiWithResilience({
            apiKey,
            modelName: modelConfig.modelName,
            contents,
            systemInstruction: "You are an intelligent AI code assistant integrated directly into an interactive development workspace.",
            abortSignal: abortController?.signal,
            onChunk: (text) => {
              assistantText += text;
              sendSSE({ content: text });
            },
          });
        } catch (e: any) {`;

const target2 = `        const response = await fetch(\`\${baseUrl.replace(/\\/$/, "")}/chat/completions\`, {
          method: "POST",
          headers,
          body: JSON.stringify({
            model: modelConfig.modelName || "gpt-3.5-turbo",
            messages: [
              { role: "system", content: "You are an intelligent AI code assistant integrated directly into an interactive development workspace." },
              ...openAiHistory
            ],
            stream: true
          })
        });`;

const replacement2 = `        const response = await fetch(\`\${baseUrl.replace(/\\/$/, "")}/chat/completions\`, {
          method: "POST",
          headers,
          body: JSON.stringify({
            model: modelConfig.modelName || "gpt-3.5-turbo",
            messages: [
              { role: "system", content: "You are an intelligent AI code assistant integrated directly into an interactive development workspace." },
              ...openAiHistory
            ],
            stream: true
          }),
          signal: abortController?.signal
        });`;

code = code.split(target1).join(replacement1);
code = code.split(target2).join(replacement2);
fs.writeFileSync('server.ts', code);
