const fs = require('fs');
let code = fs.readFileSync('server.ts', 'utf8');

const target1 = `        const contents = [
          ...history,
          {
            role: "user",
            parts: [{ text: promptWithContext }],
          },
        ];

        const streamRes = await streamGeminiWithResilience({
          apiKey,
          modelName: modelConfig.modelName,
          contents,
          systemInstruction: sysInstruction,
          onChunk: (text) => {
            assistantText += text;
            sendSSE({ content: text });
          },
        });`;

const replacement1 = `        const contents = [
          ...history,
          {
            role: "user",
            parts: [{ text: promptWithContext }],
          },
        ];

        const streamRes = await streamGeminiWithResilience({
          apiKey,
          modelName: modelConfig.modelName,
          contents,
          systemInstruction: sysInstruction,
          abortSignal: abortController?.signal,
          onChunk: (text) => {
            assistantText += text;
            sendSSE({ content: text });
          },
        });`;

const target2 = `        const response = await fetch(\`\${baseUrl.replace(/\\/$/, "")}/chat/completions\`, {
          method: "POST",
          headers,
          body: JSON.stringify(reqBody)
        });`;

const replacement2 = `        const response = await fetch(\`\${baseUrl.replace(/\\/$/, "")}/chat/completions\`, {
          method: "POST",
          headers,
          body: JSON.stringify(reqBody),
          signal: abortController?.signal
        });`;

code = code.split(target1).join(replacement1);
code = code.split(target2).join(replacement2);
fs.writeFileSync('server.ts', code);
