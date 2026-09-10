const fs = require('fs');
let code = fs.readFileSync('copilot-engine.ts', 'utf8');

const targetImport = `import { ExtractedFile, ProjectAnalysis } from "./project-analyzer";\nimport { getRunStatus } from "./run-engine.js";`;
const newImport = `import { ExtractedFile, ProjectAnalysis } from "./project-analyzer";\nimport { getRunStatus } from "./run-engine.js";\nimport { searchKnowledge, assembleContext, getProjectKnowledge } from "./knowledge-engine.js";`;
code = code.replace(targetImport, newImport);

// Replace retrieveRelevantFiles
const oldRetrieve = `export function retrieveRelevantFiles(prompt: string, files: ExtractedFile[], limit = 5): ExtractedFile[] {
  const q = prompt.toLowerCase();
  
  const scored = files.map(f => {
    let score = 0;
    const nameLower = f.name.toLowerCase();
    const pathLower = f.path.toLowerCase();
    const isBinary = f.isBinary;
    if (isBinary) return { file: f, score: -1 };
    if (nameLower.includes(q)) score += 100;
    if (pathLower.includes(q)) score += 50;
    
    const keywords = q.split(/[\\s,.-_?]+/);
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
}`;
code = code.replace(oldRetrieve, "");

const oldRetrievalCall = `  let relevantFiles = retrieveRelevantFiles(prompt, files, 5);`;
const newRetrievalCall = `
  const pk = getProjectKnowledge(req.projectId);
  const searchResults = searchKnowledge(req.projectId, prompt, 15);
  const searchContextStr = searchResults.length > 0 ? assembleContext(searchResults, analysis.architecture) : "No relevant code chunks found.";
`;
code = code.replace(oldRetrievalCall, newRetrievalCall);

const oldRelevantFilesBlock = `  if (relevantFiles.length > 0) {
    projectGrounding += \`=== RELEVANT FILES RETRIEVED ===\\n\`;
    for (const rf of relevantFiles) {
      projectGrounding += \`\\n[File: \${rf.path}]\\n\\\`\\\`\\\`\${rf.extension}\\n\${rf.content?.substring(0, 5000) || ""}\\n\\\`\\\`\\\`\\n\`;
    }
  }`;

const newRelevantFilesBlock = `
  if (searchResults.length > 0) {
    projectGrounding += \`\\n\${searchContextStr}\\n\`;
    
    // Send event so UI can render "Knowledge Inspector" style info
    if (onStreamEvent) {
       onStreamEvent({
         type: 'retrieval_metadata',
         data: searchResults.map(r => ({
           file: r.chunk.relativePath,
           lines: \`\${r.chunk.startLine}-\${r.chunk.endLine}\`,
           score: r.score,
           reason: r.reason
         }))
       });
    }
  }
`;

code = code.replace(oldRelevantFilesBlock, newRelevantFilesBlock);

fs.writeFileSync('copilot-engine.ts', code);
console.log("Patched copilot-engine.ts for RAG integration");
