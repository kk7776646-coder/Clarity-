
function formatApiError(err: any): string {
  let msg = formatApiError(err) || "An unknown error occurred";
  try {
    if (msg.includes('{"error"')) {
      const startIdx = msg.indexOf('{');
      const endIdx = msg.lastIndexOf('}');
      if (startIdx !== -1 && endIdx !== -1) {
        const jsonStr = msg.substring(startIdx, endIdx + 1);
        const parsed = JSON.parse(jsonStr);
        if (parsed.error && parsed.error.message) {
          let innerMsg = parsed.error.message;
          try {
             const innerParsed = JSON.parse(innerMsg);
             if (innerParsed.error && innerParsed.error.message) {
               msg = innerParsed.error.message;
             } else {
               msg = innerMsg;
             }
          } catch(e2) {
             msg = innerMsg;
          }
        }
      }
    }
  } catch (e) {}
  if (msg.includes("429") || msg.includes("Quota exceeded") || msg.includes("RESOURCE_EXHAUSTED")) {
     return "You have exceeded your API quota or rate limit. " + msg;
  }
  return msg;
}
import { GoogleGenAI } from "@google/genai";
import { ExtractedFile, ProjectAnalysis } from "./project-analyzer";
import { getRunStatus } from "./run-engine.js";
import { searchKnowledge, assembleContext, getProjectKnowledge } from "./knowledge-engine.js";

export interface CopilotRequest {
  prompt: string;
  projectId: string;
  userId: string;
  conversationId?: string;
  analysis: ProjectAnalysis;
  files: ExtractedFile[];
  geminiClient: GoogleGenAI | null;
  onStreamContent?: (content: string) => void;
  onStreamEvent?: (event: any) => void;
}

export function retrieveRelevantFiles(prompt: string, files: ExtractedFile[], limit = 5): ExtractedFile[] {
  const q = prompt.toLowerCase();
  
  const scored = files.map(f => {
    let score = 0;
    const nameLower = f.name.toLowerCase();
    const pathLower = f.path.toLowerCase();
    const isBinary = f.isBinary;
    if (isBinary) return { file: f, score: -1 };

    if (nameLower.includes(q)) score += 100;
    if (pathLower.includes(q)) score += 50;
    
    const keywords = q.split(/[\s,.-_?]+/);
    for (const kw of keywords) {
      if (kw.length < 3) continue;
      if (nameLower.includes(kw)) score += 20;
      if (pathLower.includes(kw)) score += 10;
      if (f.content && f.content.toLowerCase().includes(kw)) score += 1;
    }
    
    return { file: f, score };
  });
  
  scored.sort((a, b) => b.score - a.score);
  return scored.filter(s => s.score > 0).slice(0, limit).map(s => s.file);
}

export async function executeCopilotTurn(req: CopilotRequest): Promise<{ success: boolean; message?: string }> {
  const { prompt, analysis, files, geminiClient, onStreamContent, onStreamEvent } = req;
  
  if (!geminiClient) {
    if (onStreamContent) onStreamContent("AI provider is not configured. Please configure your API key.");
    return { success: false, message: "No AI provider" };
  }

  const qLower = prompt.toLowerCase();
  const relevantFiles = retrieveRelevantFiles(prompt, req.files, 5);
  
  // 1. Intelligent Retrieval

  const pk = getProjectKnowledge(req.projectId);
  const searchResults = searchKnowledge(req.projectId, prompt, 15);
  const searchContextStr = searchResults.length > 0 ? assembleContext(searchResults, analysis.architecture) : "No relevant code chunks found.";


  // Build context
  let projectGrounding = `=== PROJECT CONTEXT ===
Project Name: ${analysis.projectName}
Type: ${analysis.projectType}
Primary Language: ${analysis.primaryLanguage}
Languages: ${analysis.languages.map(l => `${l.name} (${l.percentage}%)`).join(", ")}
Frameworks: ${analysis.frameworks.join(", ")}
Architecture: ${analysis.architecture.summary}
API Endpoints: ${analysis.apiIntelligence.endpoints.length} endpoints detected.
Database: ${analysis.databaseIntelligence.description}
Security Findings: ${analysis.securityAnalysis.findings.length} findings.

`;

  
  const issuesList = analysis.architecture.advisor?.issues || [];
  if (issuesList.length > 0) {
    projectGrounding += `
Architecture Issues:
`;
    for (const issue of issuesList) {
       projectGrounding += `- [${issue.severity.toUpperCase()}] ${issue.title} (Location: ${issue.sourceFile || issue.targetFile || 'Unknown'})
  Summary: ${issue.summary}
`;
    }
  }
  const brokenList = analysis.architecture.brokenReferences || [];
  if (brokenList.length > 0) {
    projectGrounding += `
Broken Import References:
`;
    for (const broken of brokenList) {
       projectGrounding += `- ${broken.fromFile}:${broken.line} tries to import '${broken.target}' which does not exist.
`;
    }
  }


  const runStatus = getRunStatus(req.projectId);
  if (runStatus && runStatus.status !== "idle") {
    projectGrounding += `
=== RECENT RUNTIME STATUS ===
State: ${runStatus.status}
Command: ${runStatus.command || "N/A"}
Runtime: ${runStatus.runtime || "N/A"}
Exit Code: ${runStatus.exitCode !== undefined ? runStatus.exitCode : "N/A"}
Error: ${runStatus.error || "None"}
Last 50 Log Lines:
${(runStatus.logs || []).slice(-50).join("")}
`;
  }

  if (relevantFiles.length > 0) {

    projectGrounding += `=== RELEVANT FILES RETRIEVED ===\n`;
    for (const rf of relevantFiles) {
      projectGrounding += `\n[File: ${rf.path}]\n\`\`\`${rf.extension}\n${rf.content?.substring(0, 5000) || ""}\n\`\`\`\n`;
    }
  }

  const systemInstruction = `You are Clarity AI Project Copilot. You are an expert AI agent assisting a developer with their project.
Your goal is to answer questions using strictly the provided project context and retrieved files.
Follow these strict rules:
1. Always base your answers on actual project evidence.
2. If citing a file, use the format 📄 path/to/file.ext or 📄 path/to/file.ext:line_number. Make file paths exact matches to the provided context.
3. Classify claims when uncertain (e.g., CONFIRMED, LIKELY, POTENTIAL, UNRESOLVED).
4. Do not hallucinate files or connections.
5. If the user provides a stack trace, automatically detect the file, line, and function, map it to the exact project files, and explain the root cause. If a referenced file no longer exists, state that clearly.
6. If the user asks to "Understand my project", give a structured breakdown of the project architecture and flow.
7. If the user asks to modify code, produce a code change plan. For code modifications, output your plan, and output the proposed changes using this exact JSON block format at the very end of your response:
\`\`\`json
{
  "type": "code_change",
  "files": [
    { "path": "path/to/file.ext", "content": "NEW_FULL_CONTENT_HERE" }
  ]
}
\`\`\`
8. Format your response cleanly using Markdown.
9. The project ID is ${req.projectId}. You must preserve strict project isolation. Do NOT discuss any other projects.
10. If you don't have enough evidence, explicitly state: "Not enough project evidence to confirm this."
`;

  try {
    const responseStream = await geminiClient.models.generateContentStream({
      model: "gemini-3.6-flash", // or whatever model is appropriate
      contents: [
        {
          role: "user",
          parts: [{ text: `${projectGrounding}\n\nUser Question: ${prompt}` }],
        },
      ],
      config: {
        systemInstruction,
      },
    });

    for await (const chunk of responseStream) {
      const chunkText = chunk.text || "";
      if (chunkText && onStreamContent) {
        onStreamContent(chunkText);
      }
    }
    return { success: true };
  } catch (err: any) {
    console.error("Copilot AI error:", err);
    if (onStreamContent) onStreamContent(`\n\n[Copilot Error: ${formatApiError(err)}]`);
    return { success: false, message: formatApiError(err) };
  }
}
