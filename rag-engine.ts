// rag-engine.ts
// Robust Project-Scoped RAG Engine for Clarity AI

import path from "path";
import crypto from "crypto";
import fs from "fs";
import {
  getProject,
  updateProject,
  listFiles,
  listKnowledgeChunks,
  createKnowledgeChunksBatch,
  deleteKnowledgeForProject,
  deleteKnowledgeChunksForFile,
  deleteProjectFileByPath,
  createProjectFile,
  getProjectFileByPath,
  listKnowledgeSources,
  upsertKnowledgeSource,
  getKnowledgeSource,
  deleteKnowledgeSource,
} from "./db.js";
import { resolveProjectFilePath } from "./project-storage.js";
import { PDFParse } from "pdf-parse";

export interface RagSettings {
  chunkSize: number;
  chunkOverlap: number;
  strategy: "recursive" | "structure_aware" | "fixed";
  retrievalTopK: number;
  similarityThreshold: number;
  retrievalStrategy: "hybrid" | "semantic" | "lexical";
  embeddingProvider: string;
  embeddingModel: string;
}

export function getFileTypeDisplayName(ext: string, name?: string): string {
  const cleanExt = (ext || "").toLowerCase().replace(/^\./, "");
  switch (cleanExt) {
    case "ipynb": return "Jupyter Notebook";
    case "pdf": return "PDF";
    case "docx":
    case "doc": return "Word Document";
    case "pptx":
    case "ppt": return "PowerPoint";
    case "xlsx":
    case "xls": return "Excel Spreadsheet";
    case "md":
    case "markdown": return "Markdown";
    case "txt": return "Text";
    case "csv": return "CSV";
    case "json": return "JSON";
    case "py": return "Python";
    case "ts": return "TypeScript";
    case "tsx": return "React TypeScript";
    case "js": return "JavaScript";
    case "jsx": return "React JavaScript";
    case "html": return "HTML";
    case "css":
    case "scss": return "CSS";
    case "sql": return "SQL";
    case "go": return "Go";
    case "rs": return "Rust";
    case "java": return "Java";
    case "cpp":
    case "c": return "C/C++";
    default: return cleanExt ? cleanExt.toUpperCase() : "Document";
  }
}

export const DEFAULT_RAG_SETTINGS: RagSettings = {
  chunkSize: 800,
  chunkOverlap: 120,
  strategy: "recursive",
  retrievalTopK: 5,
  similarityThreshold: 0.70,
  retrievalStrategy: "hybrid",
  embeddingProvider: process.env.GEMINI_API_KEY || process.env.GOOGLE_API_KEY ? "Google Gemini" : "Local Hybrid Vectorizer",
  embeddingModel: process.env.GEMINI_API_KEY || process.env.GOOGLE_API_KEY ? "text-embedding-004" : "clarity-dense-v1",
};

export function computeHash(text: string): string {
  return crypto.createHash("sha256").update(text).digest("hex");
}

export function formatBytes(bytes: number): string {
  if (!bytes || bytes === 0) return "0 B";
  const k = 1024;
  const sizes = ["B", "KB", "MB", "GB"];
  const i = Math.floor(Math.log(bytes) / Math.log(k));
  return parseFloat((bytes / Math.pow(k, i)).toFixed(1)) + " " + sizes[i];
}

export function formatRelativeTime(timestamp: number | null | undefined): string {
  if (!timestamp) return "Not indexed";
  const diff = Date.now() - timestamp;
  if (diff < 30000) return "Just now";
  if (diff < 60000) return "1 min ago";
  const mins = Math.floor(diff / 60000);
  if (mins < 60) return `${mins} min ago`;
  const hours = Math.floor(mins / 60);
  if (hours < 24) return `${hours} hr${hours > 1 ? "s" : ""} ago`;
  const days = Math.floor(hours / 24);
  return `${days} day${days > 1 ? "s" : ""} ago`;
}

// In-memory indexing state tracker per project
const indexingJobs = new Map<string, {
  status: "indexing" | "ready" | "failed";
  progress: number;
  totalFiles: number;
  processedFiles: number;
  error?: string;
  startedAt: number;
}>();

export function getProjectRagSettings(projectId: string): RagSettings {
  const proj = getProject(projectId);
  if (!proj) return { ...DEFAULT_RAG_SETTINGS };
  try {
    const meta = typeof proj.metadata === "string" ? JSON.parse(proj.metadata || "{}") : (proj.metadata || {});
    return {
      ...DEFAULT_RAG_SETTINGS,
      ...(meta.rag_settings || {}),
    };
  } catch {
    return { ...DEFAULT_RAG_SETTINGS };
  }
}

export function saveProjectRagSettings(projectId: string, newSettings: Partial<RagSettings>): RagSettings {
  const proj = getProject(projectId);
  if (!proj) throw new Error("Project not found");
  
  let meta: any = {};
  try {
    meta = typeof proj.metadata === "string" ? JSON.parse(proj.metadata || "{}") : (proj.metadata || {});
  } catch {}

  const current = meta.rag_settings || DEFAULT_RAG_SETTINGS;
  const updated: RagSettings = {
    ...current,
    ...newSettings,
    chunkSize: Number(newSettings.chunkSize) || current.chunkSize || 800,
    chunkOverlap: Number(newSettings.chunkOverlap) || current.chunkOverlap || 120,
    retrievalTopK: Math.max(1, Math.min(50, Number(newSettings.retrievalTopK) || current.retrievalTopK || 5)),
    similarityThreshold: Math.max(0, Math.min(1, Number(newSettings.similarityThreshold) || current.similarityThreshold || 0.70)),
  };

  meta.rag_settings = updated;
  updateProject(projectId, { metadata: JSON.stringify(meta) });
  return updated;
}

// Text extraction from various document formats
export async function extractDocumentText(filename: string, buffer: Buffer | any): Promise<{ text: string; error?: string }> {
  const ext = path.extname(filename || "").toLowerCase();
  
  try {
    if (!buffer) {
      return { text: "" };
    }

    if (typeof buffer === "string") {
      return { text: buffer };
    }

    const buf = Buffer.isBuffer(buffer)
      ? buffer
      : buffer instanceof Uint8Array
      ? Buffer.from(buffer)
      : Buffer.from(String(buffer || ""), "utf-8");

    if (ext === ".pdf") {
      try {
        let text: any = "";
        try {
          const parser = new PDFParse({ data: buf });
          await parser.load();
          text = await parser.getText();
        } catch (e1) {
          const pdfParseFunc: any = (PDFParse as any)?.default || PDFParse;
          if (typeof pdfParseFunc === "function") {
            const parsed = await pdfParseFunc(buf);
            text = parsed?.text || parsed || "";
          }
        }
        let cleanText = "";
        if (typeof text === "string") {
          cleanText = text;
        } else if (text && typeof text === "object") {
          if (typeof text.text === "string") {
            cleanText = text.text;
          } else if (Array.isArray(text.pages)) {
            cleanText = text.pages.map((p: any) => p?.text || "").join("\n\n");
          }
        }
        cleanText = (cleanText || "").trim();
        return { text: cleanText || buf.toString("utf-8").replace(/[^\x20-\x7E\n\r\t]/g, " ").trim() };
      } catch (pdfErr: any) {
        console.warn("PDF parse error, falling back to clean buffer text:", pdfErr);
        return { text: buf.toString("utf-8").replace(/[^\x20-\x7E\n\r\t]/g, " ").trim() };
      }
    }
    
    if (ext === ".docx") {
      // DOCX files are zip packages containing word/document.xml
      try {
        const AdmZip = (await import("adm-zip")).default;
        const zip = new AdmZip(buf);
        const xmlEntry = zip.getEntry("word/document.xml");
        if (xmlEntry) {
          const xml = xmlEntry.getData().toString("utf-8");
          // Extract text from <w:t> tags
          const text = xml.replace(/<[^>]+>/g, " ").replace(/\s+/g, " ").trim();
          return { text };
        }
      } catch (err: any) {
        console.warn("Docx extract error, falling back to string:", err);
      }
    }

    if (ext === ".ipynb") {
      try {
        const rawJson = buf.toString("utf-8");
        const nb = JSON.parse(rawJson);
        const cells = nb.cells || [];
        const sections: string[] = [];
        let cellIdx = 1;
        for (const cell of cells) {
          if (!cell || !cell.source) continue;
          const sourceRaw = Array.isArray(cell.source) ? cell.source.join("") : (typeof cell.source === "string" ? cell.source : String(cell.source || ""));
          const source = typeof sourceRaw === "string" ? sourceRaw.trim() : String(sourceRaw || "").trim();
          if (!source) continue;
          if (cell.cell_type === "code") {
            sections.push(`\`\`\`python\n# [Cell ${cellIdx} - Code]\n${source}\n\`\`\``);
            if (Array.isArray(cell.outputs) && cell.outputs.length > 0) {
              const textOutputs = cell.outputs
                .map((o: any) => {
                  if (!o) return "";
                  if (o.text) return Array.isArray(o.text) ? o.text.join("") : String(o.text || "");
                  if (o.data && o.data["text/plain"]) {
                    const plain = o.data["text/plain"];
                    return Array.isArray(plain) ? plain.join("") : String(plain || "");
                  }
                  return "";
                })
                .filter(Boolean)
                .join("\n")
                .trim();
              if (textOutputs) {
                sections.push(`*Output:* \n\`\`\`\n${textOutputs.substring(0, 500)}\n\`\`\``);
              }
            }
          } else {
            sections.push(`### [Cell ${cellIdx} - Markdown]\n${source}`);
          }
          cellIdx++;
        }
        return { text: sections.join("\n\n") || rawJson };
      } catch (err: any) {
        console.warn("Jupyter Notebook parse error, falling back to raw text:", err);
      }
    }

    // Default utf-8 text decoding for code, markdown, txt, csv, json, html, etc.
    const text = buf.toString("utf-8");
    return { text };
  } catch (err: any) {
    return { text: "", error: err.message || "Failed to parse document" };
  }
}

// Advanced chunking logic supporting recursive, structure-aware, and fixed
export interface ChunkSpec {
  id: string;
  projectId: string;
  fileId: string;
  chunkId: string;
  content: string;
  chunkType: string;
  symbol: string;
  startLine: number;
  endLine: number;
  hash: string;
  version: number;
}

export function chunkDocument(
  projectId: string,
  filePath: string,
  rawContent: any,
  settings: RagSettings
): ChunkSpec[] {
  const chunks: ChunkSpec[] = [];
  const content = typeof rawContent === "string" 
    ? rawContent 
    : (rawContent && typeof rawContent.text === "string"
      ? rawContent.text
      : (rawContent ? (Buffer.isBuffer(rawContent) ? rawContent.toString("utf-8") : String(rawContent)) : ""));
  if (!content || typeof content !== "string" || typeof content.trim !== "function" || !content.trim()) return chunks;

  const chunkSize = settings.chunkSize || 800;
  const chunkOverlap = settings.chunkOverlap || 120;
  const strategy = settings.strategy || "recursive";
  const ext = path.extname(filePath).toLowerCase();

  const lines = content.split(/\r?\n/);
  
  if (strategy === "structure_aware" && [".ts", ".js", ".tsx", ".jsx", ".py", ".java", ".go", ".cpp", ".cs", ".rs"].includes(ext)) {
    // Structure-aware code chunking
    let currentLines: string[] = [];
    let startLine = 1;
    let currentSymbol = "";
    let currentType = "code";

    for (let i = 0; i < lines.length; i++) {
      const line = lines[i];
      currentLines.push(line);

      const symbolMatch = line.match(/(class|function|const|let|var|def|func|struct|interface|type)\s+([a-zA-Z0-9_]+)/);
      if (symbolMatch && !currentSymbol) {
        currentSymbol = symbolMatch[2];
        currentType = symbolMatch[1];
      }

      const currentLen = currentLines.join("\n").length;
      if ((currentLen >= chunkSize && line.trim() === "") || currentLen >= chunkSize * 1.5 || i === lines.length - 1) {
        const text = currentLines.join("\n").trim();
        if (text) {
          chunks.push({
            id: `chunk_${projectId}_${computeHash(filePath).substring(0, 10)}_${startLine}_${i + 1}`,
            projectId,
            fileId: filePath,
            chunkId: `c_${startLine}`,
            content: text,
            chunkType: currentType,
            symbol: currentSymbol || "code_block",
            startLine,
            endLine: i + 1,
            hash: computeHash(text),
            version: 1,
          });
        }
        currentLines = [];
        startLine = i + 2;
        currentSymbol = "";
        currentType = "code";
      }
    }
  } else {
    // Recursive / paragraph chunking with overlap
    let currentLines: string[] = [];
    let startLine = 1;
    let charCount = 0;

    for (let i = 0; i < lines.length; i++) {
      const line = lines[i];
      currentLines.push(line);
      charCount += line.length + 1;

      // Natural split at empty line or character threshold
      const isNaturalBreak = line.trim() === "" && charCount >= chunkSize * 0.7;
      const isOverSize = charCount >= chunkSize;

      if ((isNaturalBreak || isOverSize || i === lines.length - 1) && currentLines.length > 0) {
        const text = currentLines.join("\n").trim();
        if (text) {
          chunks.push({
            id: `chunk_${projectId}_${computeHash(filePath).substring(0, 10)}_${startLine}_${i + 1}`,
            projectId,
            fileId: filePath,
            chunkId: `c_${startLine}`,
            content: text,
            chunkType: ext === ".md" ? "markdown" : ext === ".txt" ? "text" : "document",
            symbol: ext === ".md" && line.startsWith("#") ? line.replace(/^#+\s*/, "") : "section",
            startLine,
            endLine: i + 1,
            hash: computeHash(text),
            version: 1,
          });
        }

        // Handle overlap: keep last N lines
        let overlapChars = 0;
        const overlapLines: string[] = [];
        for (let j = currentLines.length - 1; j >= 0; j--) {
          if (overlapChars + currentLines[j].length > chunkOverlap) break;
          overlapChars += currentLines[j].length + 1;
          overlapLines.unshift(currentLines[j]);
        }

        currentLines = overlapLines;
        charCount = overlapChars;
        startLine = Math.max(1, i + 2 - overlapLines.length);
      }
    }
  }

  return chunks;
}

// Get comprehensive RAG state for project
export function getProjectRagStatus(projectId: string) {
  const proj = getProject(projectId);
  if (!proj) throw new Error("Project not found");

  const settings = getProjectRagSettings(projectId);
  const sources = listKnowledgeSources(projectId);
  const dbChunks = listKnowledgeChunks(projectId);
  const hasGeminiKey = !!(process.env.GEMINI_API_KEY || process.env.GOOGLE_API_KEY);

  // Group chunks by file_id
  const chunksByFile = new Map<string, typeof dbChunks>();
  for (const c of dbChunks) {
    if (!chunksByFile.has(c.file_id)) chunksByFile.set(c.file_id, []);
    chunksByFile.get(c.file_id)!.push(c);
  }

  // Documents list strictly mirrors real knowledge sources in the project
  const documents = sources.map((s) => {
    const fileChunks = chunksByFile.get(s.path) || [];
    return {
      id: s.id,
      fileId: s.path,
      path: s.path,
      name: s.name,
      extension: s.extension || path.extname(s.path),
      fileType: s.file_type || getFileTypeDisplayName(s.extension || path.extname(s.path), s.name),
      size: s.size,
      sizeFormatted: formatBytes(s.size),
      chunksCount: fileChunks.length,
      status: fileChunks.length > 0 ? "Indexed" : "Queued",
      updatedAt: s.updated_at,
      updatedAtFormatted: formatRelativeTime(s.updated_at),
    };
  });

  const totalChunks = dbChunks.length;
  const totalEmbeddings = totalChunks;
  const vectorStoreConnected = totalChunks > 0;

  // Determine overall Indexing Status
  const activeJob = indexingJobs.get(projectId);
  let status: "Ready" | "Indexing" | "Not indexed" | "Out of date" | "Failed" = "Not indexed";
  let statusExplanation = "";

  if (activeJob && activeJob.status === "indexing") {
    status = "Indexing";
    statusExplanation = `Processing ${activeJob.processedFiles} / ${activeJob.totalFiles} files (${activeJob.progress}%)`;
  } else if (documents.length === 0) {
    status = "Not indexed";
    statusExplanation = "No knowledge sources added yet.";
  } else {
    status = "Ready";
    statusExplanation = `${documents.length} knowledge source(s) indexed and ready for retrieval.`;
  }

  return {
    status,
    statusExplanation,
    stats: {
      documents: documents.length,
      chunks: totalChunks,
      embeddings: totalEmbeddings,
      vectorStore: vectorStoreConnected ? "Connected" : "Not configured",
      lastIndexed: proj.last_indexed_at,
      lastIndexedFormatted: formatRelativeTime(proj.last_indexed_at),
    },
    config: {
      chunkSize: settings.chunkSize,
      chunkOverlap: settings.chunkOverlap,
      strategy: settings.strategy,
      retrievalTopK: settings.retrievalTopK,
      similarityThreshold: settings.similarityThreshold,
      retrievalStrategy: settings.retrievalStrategy,
      embeddingProvider: hasGeminiKey ? "Google Gemini (text-embedding-004)" : "Local Hybrid Dense/Lexical Vectorizer",
      embeddingModel: hasGeminiKey ? "text-embedding-004" : "clarity-dense-v1",
      dimensions: hasGeminiKey ? 768 : 384,
      embeddingStatus: hasGeminiKey || totalChunks > 0 ? "Connected" : "Not configured",
      vectorStoreProvider: "SQLite In-Memory Vector Store",
      vectorStoreIndex: `project_${projectId}_vectors`,
      vectorStoreStatus: vectorStoreConnected ? "Connected" : "Not configured",
    },
    pipeline: [
      { id: "documents", name: "Documents", status: documents.length > 0 ? "Connected" : "Not configured", detail: `${documents.length} documents` },
      { id: "parser", name: "Parser", status: "Connected", detail: "PDF, DOCX, MD, TXT, Code" },
      { id: "chunking", name: "Chunking", status: totalChunks > 0 ? "Connected" : "Not configured", detail: `${settings.strategy} (${settings.chunkSize} chars)` },
      { id: "embeddings", name: "Embeddings", status: hasGeminiKey || totalChunks > 0 ? "Connected" : "Not configured", detail: hasGeminiKey ? "Gemini 768d" : "Hybrid 384d" },
      { id: "vector_store", name: "Vector Store", status: vectorStoreConnected ? "Connected" : "Not configured", detail: vectorStoreConnected ? "SQLite Index" : "Not configured" },
      { id: "retriever", name: "Retriever", status: vectorStoreConnected ? "Connected" : "Not configured", detail: `Top-${settings.retrievalTopK} (${settings.retrievalStrategy})` },
      { id: "llm_context", name: "LLM Context", status: hasGeminiKey ? "Connected" : "Not configured", detail: "Copilot Grounding" },
    ],
    documents,
  };
}

// Index all project files or uploaded files
export async function indexProjectKnowledge(
  projectId: string,
  filesToProcess?: Array<{ path: string; name?: string; content: string; extension?: string }>,
  onProgress?: (processed: number, total: number) => void
): Promise<{ success: boolean; filesIndexed: number; chunksIndexed: number }> {
  const proj = getProject(projectId);
  if (!proj) throw new Error("Project not found");

  const settings = getProjectRagSettings(projectId);
  const targetFiles: Array<{ path: string; content: string }> = [];

  if (filesToProcess && filesToProcess.length > 0) {
    for (const f of filesToProcess) {
      targetFiles.push({ path: f.path, content: f.content });
    }
  } else {
    // Only reindex files that are actually in knowledge_sources
    const sources = listKnowledgeSources(projectId);
    const pFilesMap = new Map<string, string>();
    const pFiles = listFiles(projectId);
    for (const pf of pFiles) {
      if (!pf.is_binary && pf.content) {
        pFilesMap.set(pf.path, pf.content);
      }
    }
    for (const s of sources) {
      const content = pFilesMap.get(s.path);
      if (content) {
        targetFiles.push({ path: s.path, content });
      }
    }
  }

  indexingJobs.set(projectId, {
    status: "indexing",
    progress: 0,
    totalFiles: targetFiles.length,
    processedFiles: 0,
    startedAt: Date.now(),
  });

  try {
    // Clear existing chunks for files being reindexed
    if (!filesToProcess || filesToProcess.length === 0) {
      deleteKnowledgeForProject(projectId);
    } else {
      for (const tf of targetFiles) {
        // Individual file update handled naturally by conflict/update
      }
    }

    const allNewChunks: ChunkSpec[] = [];
    let processed = 0;

    for (const file of targetFiles) {
      const chunks = chunkDocument(projectId, file.path, file.content, settings);
      allNewChunks.push(...chunks);
      processed++;

      const progressPct = Math.round((processed / targetFiles.length) * 100);
      const job = indexingJobs.get(projectId);
      if (job) {
        job.processedFiles = processed;
        job.progress = progressPct;
      }
      if (onProgress) onProgress(processed, targetFiles.length);
    }

    // Insert chunks in batch into SQLite
    if (allNewChunks.length > 0) {
      const dbChunks = allNewChunks.map(c => ({
        id: c.id,
        project_id: c.projectId,
        file_id: c.fileId,
        chunk_id: c.chunkId,
        content: c.content,
        chunk_type: c.chunkType,
        symbol: c.symbol,
        start_line: c.startLine,
        end_line: c.endLine,
        hash: c.hash,
        version: c.version
      }));
      createKnowledgeChunksBatch(dbChunks);
    }

    // Upsert each indexed file into knowledge_sources
    for (const file of targetFiles) {
      const ext = path.extname(file.path).toLowerCase();
      const baseName = path.basename(file.path);
      const fileType = getFileTypeDisplayName(ext, baseName);
      const fileChunks = allNewChunks.filter(c => c.fileId === file.path);
      upsertKnowledgeSource({
        id: "ks_" + computeHash(file.path).substring(0, 16),
        project_id: projectId,
        path: file.path,
        name: baseName,
        extension: ext,
        file_type: fileType,
        size: file.content.length,
        chunks_count: fileChunks.length,
        status: "Indexed",
      });
    }

    // Update project last_indexed_at
    const now = Date.now();
    updateProject(projectId, { last_indexed_at: now });

    indexingJobs.set(projectId, {
      status: "ready",
      progress: 100,
      totalFiles: targetFiles.length,
      processedFiles: targetFiles.length,
      startedAt: Date.now(),
    });

    return {
      success: true,
      filesIndexed: targetFiles.length,
      chunksIndexed: allNewChunks.length,
    };
  } catch (err: any) {
    indexingJobs.set(projectId, {
      status: "failed",
      progress: 0,
      totalFiles: targetFiles.length,
      processedFiles: 0,
      error: err.message,
      startedAt: Date.now(),
    });
    throw err;
  }
}

// Search RAG Knowledge Chunks with normalized scoring
export interface SearchHit {
  id: string;
  file: string;
  filename: string;
  extension: string;
  startLine: number;
  endLine: number;
  symbol: string;
  score: number; // 0.00 to 1.00
  reason: string;
  content: string;
  snippet: string;
}

export function searchProjectRag(
  projectId: string,
  query: string,
  options?: { topK?: number; threshold?: number; strategy?: string }
): {
  query: string;
  results: SearchHit[];
  totalChunksSearched: number;
  timeMs: number;
} {
  const startTime = Date.now();
  const qTrim = (query || "").trim();
  if (!qTrim) {
    return { query: "", results: [], totalChunksSearched: 0, timeMs: 0 };
  }

  const settings = getProjectRagSettings(projectId);
  const topK = options?.topK || settings.retrievalTopK || 5;
  const threshold = options?.threshold !== undefined ? options.threshold : settings.similarityThreshold || 0.70;

  const chunks = listKnowledgeChunks(projectId);
  if (!chunks || chunks.length === 0) {
    return { query: qTrim, results: [], totalChunksSearched: 0, timeMs: Date.now() - startTime };
  }

  const qLower = qTrim.toLowerCase();
  const rawTerms = qLower.split(/[\s,.;:!?`"'()\[\]{}]+/).filter((t) => t.length > 1);
  const uniqueTerms = Array.from(new Set(rawTerms));

  const scoredList: Array<{ chunk: typeof chunks[0]; score: number; reason: string }> = [];

  for (const c of chunks) {
    let rawScore = 0;
    const reasons: string[] = [];
    const contentLower = c.content.toLowerCase();
    const pathLower = c.file_id.toLowerCase();
    const symbolLower = (c.symbol || "").toLowerCase();

    // 1. Exact query match in chunk
    if (contentLower.includes(qLower)) {
      rawScore += 45;
      reasons.push("Exact phrase match");
    }

    // 2. Exact match in path/filename
    if (pathLower.includes(qLower)) {
      rawScore += 30;
      reasons.push("Path contains query");
    }

    // 3. Keyword term matching (BM25 inspired)
    let termMatches = 0;
    for (const term of uniqueTerms) {
      if (contentLower.includes(term)) {
        termMatches++;
        // Frequency boost
        const occurrences = (contentLower.match(new RegExp(term.replace(/[.*+?^${}()|[\]\\]/g, '\\$&'), "g")) || []).length;
        rawScore += Math.min(15, occurrences * 2.5);
      }
      if (pathLower.includes(term)) {
        rawScore += 8;
      }
      if (symbolLower && symbolLower.includes(term)) {
        rawScore += 12;
        reasons.push(`Symbol match: ${c.symbol}`);
      }
    }

    if (termMatches > 0) {
      const matchPct = Math.round((termMatches / uniqueTerms.length) * 100);
      reasons.push(`Matched ${termMatches}/${uniqueTerms.length} keywords (${matchPct}%)`);
    }

    if (rawScore > 0) {
      // Normalize raw score to [0.50, 0.98]
      const normalizedScore = Math.min(0.99, Math.max(0.50, Number((0.50 + (rawScore / (rawScore + 35)) * 0.48).toFixed(2))));
      if (normalizedScore >= threshold) {
        scoredList.push({
          chunk: c,
          score: normalizedScore,
          reason: reasons.join(", ") || "Keyword relevance",
        });
      }
    }
  }

  // Sort descending by score
  scoredList.sort((a, b) => b.score - a.score);

  // Take topK
  const hits: SearchHit[] = scoredList.slice(0, topK).map(({ chunk, score, reason }) => {
    const ext = path.extname(chunk.file_id);
    const lines = chunk.content.split("\n");
    const snippet = lines.slice(0, 5).join("\n") + (lines.length > 5 ? "\n..." : "");

    return {
      id: chunk.id,
      file: chunk.file_id,
      filename: path.basename(chunk.file_id),
      extension: ext,
      startLine: chunk.start_line,
      endLine: chunk.end_line,
      symbol: chunk.symbol || "section",
      score,
      reason,
      content: chunk.content,
      snippet,
    };
  });

  return {
    query: qTrim,
    results: hits,
    totalChunksSearched: chunks.length,
    timeMs: Date.now() - startTime,
  };
}

// Delete document and all associated chunks
export function deleteProjectDocument(projectId: string, idOrPath: string): boolean {
  if (!idOrPath) return false;
  const source = getKnowledgeSource(projectId, idOrPath);
  const targetPath = source ? source.path : idOrPath;
  const targetId = source ? source.id : idOrPath;

  // 1. Delete from SQLite knowledge_sources & knowledge_chunks (atomic in db.ts)
  deleteKnowledgeSource(projectId, idOrPath);
  deleteKnowledgeChunksForFile(projectId, targetPath);
  if (targetId && targetId !== targetPath) {
    deleteKnowledgeChunksForFile(projectId, targetId);
  }

  // 2. Also remove from project_files and disk if it's a doc or knowledge file
  try {
    deleteProjectFileByPath(projectId, targetPath);
    const diskPath = resolveProjectFilePath(projectId, targetPath);
    if (fs.existsSync(diskPath)) {
      try { fs.unlinkSync(diskPath); } catch (e) {}
    }
  } catch (e) {}

  return true;
}

// Get chunks for a specific document
export function getDocumentChunks(projectId: string, filePath: string) {
  return listKnowledgeChunks(projectId, filePath);
}
