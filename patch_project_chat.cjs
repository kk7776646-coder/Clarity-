const fs = require('fs');
let code = fs.readFileSync('server.ts', 'utf8');

const projectChatRoute = `
  app.post("/api/projects/:pid/chat", async (req, res) => {
    const pid = req.params.pid;
    const user = resolveUser(req) || initialUser;
    const proj = projects.get(pid);
    if (!proj) return res.status(404).json({ error: "Project not found", type: "not_found" });
    
    const { message } = req.body || {};
    const textMsg = String(message || "").trim();
    if (!textMsg) {
      return res.status(400).json({ error: "Message is required", type: "invalid_request" });
    }

    res.setHeader("Content-Type", "text/event-stream");
    res.setHeader("Cache-Control", "no-cache");
    res.setHeader("Connection", "keep-alive");
    const sendSSE = (payload: any) => {
      res.write(\`data: \${JSON.stringify(payload)}\\n\\n\`);
    };

    let assistantResponse = "";
    try {
      let generatedArtifacts: GeneratedArtifact[] = [];
      const hasGenIntent = /(create|generate|make|build|export|modify|fix|refactor|add|write|code).*(\\.\\w+|python|javascript|typescript|html|css|java|cpp|c\\+\\+|c#|csharp|php|sql|json|yaml|yml|md|markdown|jupyter|notebook|word|document|docx|excel|xlsx|spreadsheet|presentation|pptx|powerpoint|pdf|csv|diagram|architecture|file|component|feature|report|program|app|application|script|code|website|page)/i.test(textMsg);
      
      let analysis = projectAnalyses.get(pid);
      const extracted = Array.from(files.values())
        .filter((f) => f.project_id === pid)
        .map((f) => ({
          path: f.filename,
          name: path.basename(f.filename),
          extension: path.extname(f.filename).toLowerCase(),
          size: f.size,
          isBinary: f.file_type === "binary",
          content: f.content,
          lineCount: f.content ? f.content.split(/\\r?\\n/).length : 0,
        }));
        
      if (!analysis) {
        analysis = analyzeProject(proj.name, pid, extracted as any);
        projectAnalyses.set(pid, analysis);
      }
      
      if (hasGenIntent) {
        try {
          const genResult = await executeGeneration({
            prompt: textMsg,
            projectId: pid,
            userId: proj.user_id,
            analysis,
            files: extracted as any,
            geminiClient: getGeminiClient(),
          });
          if (genResult.success && genResult.artifacts.length > 0) {
            for (const art of genResult.artifacts) {
              projectArtifacts.set(art.id, art);
            }
            generatedArtifacts = genResult.artifacts;
            sendSSE({ type: "artifacts", artifacts: genResult.artifacts });
            const planMsg = \`\\n\\n\${genResult.message}\`;
            assistantResponse += planMsg;
            sendSSE({ content: planMsg });
          } else {
             // Just plain chat with AI if no artifacts generated?
             // Since this is project chat, let's just do a basic chat if no artifacts generated
             sendSSE({ content: "I analyzed your request, but could not generate the specific artifacts. " + genResult.message });
          }
        } catch (genErr: any) {
          console.warn("Generation error in chat:", genErr);
          sendSSE({ content: \`\\n\\n[Generation Error: \${formatApiError(genErr)}]\` });
        }
      } else {
         // Standard project conversational chat using GoogleGenAI
         const ai = getGeminiClient();
         if (!ai) throw new Error("AI client not available.");
         const chatRes = await ai.models.generateContentStream({
            model: "gemini-3.6-flash",
            contents: [{ role: "user", parts: [{ text: textMsg }] }],
            config: {
               systemInstruction: "You are Clarity, an AI assistant analyzing a project.",
            }
         });
         for await (const chunk of chatRes) {
            if (chunk.text) {
               sendSSE({ content: chunk.text });
            }
         }
      }
      sendSSE({ done: true, artifacts: generatedArtifacts });
      res.end();
    } catch (err: any) {
      console.error("Project chat error:", err);
      sendSSE({ content: \`\\n\\n[Error generating response: \${formatApiError(err)}]\`, done: true });
      res.end();
    }
  });
`;

// Clean up the regenerate route that swallowed the old code
const regexToRemove = /let generatedArtifacts: GeneratedArtifact\[\] = \[\];[\s\S]*?res\.end\(\);\n    \} catch \(err: any\) \{\n      console\.error\("Project chat error:", err\);\n      sendSSE\(\{ content: `\\n\\n\[Error generating response: \$\{err\?\.message \|\| "Unknown error"\}\]`, done: true \}\);\n      res\.end\(\);\n    \}/;

if (regexToRemove.test(code)) {
   code = code.replace(regexToRemove, 'res.end();\n    } catch (err: any) {\n      console.error("Chat regeneration error:", err);\n      sendSSE({ error: { message: formatApiError(err) || "Failed to regenerate AI response", type: "chat_error" } });\n      res.end();\n    }');
}

// Add projectChatRoute after regenerate route
if (!code.includes('app.post("/api/projects/:pid/chat"')) {
   code = code.replace(/  app\.post\("\/api\/projects\/:pid\/generate",/g, projectChatRoute + '\n  app.post("/api/projects/:pid/generate",');
   fs.writeFileSync('server.ts', code);
}
