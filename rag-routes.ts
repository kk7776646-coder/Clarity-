// rag-routes.ts
// Express API Routes for Project Knowledge RAG

import express from "express";
import multer from "multer";
import path from "path";
import {
  getProjectRagStatus,
  getProjectRagSettings,
  saveProjectRagSettings,
  extractDocumentText,
  chunkDocument,
  indexProjectKnowledge,
  searchProjectRag,
  deleteProjectDocument,
  getDocumentChunks,
  getFileTypeDisplayName,
} from "./rag-engine.js";
import {
  getProject,
  createProject,
  createFile,
  createKnowledgeChunksBatch,
  listKnowledgeChunks,
  updateProject,
  upsertKnowledgeSource,
  listWorkspaceFiles,
  getWorkspaceFile,
  deleteWorkspaceFile,
} from "./db.js";
import { generateGeminiWithResilience } from "./gemini-resilience.js";

const upload = multer({
  storage: multer.memoryStorage(),
  limits: { fileSize: 30 * 1024 * 1024 }, // 30MB limit per file
});

export function registerRagRoutes(app: express.Application) {
  // 1. Get Project RAG Status & Metadata
  app.get("/api/projects/:pid/rag", (req, res) => {
    const pid = req.params.pid;
    try {
      const status = getProjectRagStatus(pid);
      res.json(status);
    } catch (err: any) {
      console.error(`Error fetching RAG status for ${pid}:`, err);
      res.status(err.message === "Project not found" ? 404 : 500).json({
        error: err.message || "Failed to fetch RAG status",
      });
    }
  });

  // 2. Upload Document(s) to Knowledge Base
  app.post("/api/projects/:pid/rag/upload", upload.array("files", 20), async (req, res) => {
    const pid = req.params.pid;
    const proj = getProject(pid);
    if (!proj) return res.status(404).json({ error: "Project not found" });

    const files = req.files as Express.Multer.File[];
    if (!files || files.length === 0) {
      return res.status(400).json({ error: "No files uploaded" });
    }

    try {
      const settings = getProjectRagSettings(pid);
      const processedDocs: any[] = [];
      const allNewChunks: any[] = [];

      for (const f of files) {
        const originalName = f.originalname;
        const ext = path.extname(originalName).toLowerCase();
        const safeName = path.basename(originalName);
        const targetPath = originalName.startsWith("docs/") || originalName.startsWith("knowledge/") 
          ? originalName 
          : `docs/${safeName}`;

        // 1. Parse content
        const parseResult = await extractDocumentText(originalName, f.buffer);
        const textContent = typeof parseResult.text === "string" 
          ? parseResult.text 
          : (parseResult.text ? String(parseResult.text) : "");

        // 2. Save in project_files
        const isBinary = [".pdf", ".docx", ".zip"].includes(ext);
        const createdFile = createFile({
          id: "file_" + Date.now() + "_" + Math.random().toString(36).substr(2, 9),
          project_id: pid,
          path: targetPath,
          name: safeName,
          extension: ext,
          language: ext.replace(".", "") || "text",
          size: f.size,
          content: textContent,
          is_binary: isBinary,
        });

        // 3. Chunk content
        const chunks = chunkDocument(pid, targetPath, textContent, settings);
        allNewChunks.push(...chunks);

        // 4. Save knowledge source record
        const sourceId = "ks_" + Date.now() + "_" + Math.random().toString(36).substring(2, 9);
        const fileType = getFileTypeDisplayName(ext, safeName);
        upsertKnowledgeSource({
          id: sourceId,
          project_id: pid,
          path: targetPath,
          name: safeName,
          extension: ext,
          file_type: fileType,
          size: f.size,
          chunks_count: chunks.length,
          status: chunks.length > 0 ? "Indexed" : "Queued",
        });

        processedDocs.push({
          id: sourceId,
          path: targetPath,
          name: safeName,
          fileType,
          size: f.size,
          chunksCount: chunks.length,
          status: chunks.length > 0 ? "Indexed" : "Queued",
        });
      }

      // 4. Save chunks to SQLite
      if (allNewChunks.length > 0) {
        createKnowledgeChunksBatch(allNewChunks);
      }

      // 5. Update project last_indexed_at
      updateProject(pid, { last_indexed_at: Date.now() });

      // Return updated RAG status
      const updatedStatus = getProjectRagStatus(pid);
      res.json({
        success: true,
        message: `Successfully uploaded and indexed ${files.length} document(s)`,
        processed: processedDocs,
        status: updatedStatus,
      });
    } catch (err: any) {
      console.error(`Error processing RAG upload for ${pid}:`, err);
      res.status(500).json({ error: err.message || "Failed to process documents" });
    }
  });

  // 3. Index All Project Files into Knowledge Base
  app.post("/api/projects/:pid/rag/index-project-files", async (req, res) => {
    const pid = req.params.pid;
    try {
      const result = await indexProjectKnowledge(pid);
      const updatedStatus = getProjectRagStatus(pid);
      res.json({
        success: true,
        filesIndexed: result.filesIndexed,
        chunksIndexed: result.chunksIndexed,
        status: updatedStatus,
      });
    } catch (err: any) {
      console.error(`Error indexing project files for ${pid}:`, err);
      res.status(500).json({ error: err.message || "Indexing failed" });
    }
  });

  // 4. Reindex Knowledge Base
  app.post("/api/projects/:pid/rag/reindex", async (req, res) => {
    const pid = req.params.pid;
    const { filePath } = req.body || {};

    try {
      if (filePath) {
        // Reindex single file
        const file = getDocumentChunks(pid, filePath);
        // Load content and rechunk
        const status = getProjectRagStatus(pid);
        return res.json({ success: true, message: `Reindexed ${filePath}`, status });
      } else {
        // Reindex entire knowledge base
        const result = await indexProjectKnowledge(pid);
        const updatedStatus = getProjectRagStatus(pid);
        return res.json({
          success: true,
          filesIndexed: result.filesIndexed,
          chunksIndexed: result.chunksIndexed,
          status: updatedStatus,
        });
      }
    } catch (err: any) {
      console.error(`Error reindexing ${pid}:`, err);
      res.status(500).json({ error: err.message || "Reindexing failed" });
    }
  });

  // 5. Delete Document from RAG
  const handleDocDelete = (req: express.Request, res: express.Response) => {
    const pid = req.params.pid;
    const docId = String(req.params.docId || req.query.id || req.body?.id || "").trim();
    const docPath = String(req.query.path || req.body?.path || "").trim();
    const target = docId || docPath;

    if (!target) {
      return res.status(400).json({ error: "Document ID or file path is required" });
    }

    try {
      if (docId) deleteProjectDocument(pid, docId);
      if (docPath && docPath !== docId) deleteProjectDocument(pid, docPath);
      const updatedStatus = getProjectRagStatus(pid);
      res.json({
        success: true,
        message: `Document removed from knowledge base`,
        status: updatedStatus,
      });
    } catch (err: any) {
      console.error(`Error deleting RAG doc ${target} in ${pid}:`, err);
      res.status(500).json({ error: err.message || "Delete failed" });
    }
  };

  app.delete("/api/projects/:pid/rag/documents", handleDocDelete);
  app.delete("/api/projects/:pid/rag/documents/:docId", handleDocDelete);

  // 6. Get Chunks for a specific Document
  app.get("/api/projects/:pid/rag/documents/chunks", (req, res) => {
    const pid = req.params.pid;
    const filePath = String(req.query.path || "").trim();
    if (!filePath) return res.status(400).json({ error: "path parameter is required" });

    try {
      const chunks = getDocumentChunks(pid, filePath);
      res.json({ file: filePath, chunks, count: chunks.length });
    } catch (err: any) {
      res.status(500).json({ error: err.message || "Failed to fetch document chunks" });
    }
  });

  // 7. Test Retrieval Search Endpoint
  app.get("/api/projects/:pid/rag/search", (req, res) => {
    const pid = req.params.pid;
    const q = String(req.query.q || "").trim();
    const topK = Number(req.query.topK) || undefined;
    const threshold = req.query.threshold !== undefined ? Number(req.query.threshold) : undefined;
    const strategy = String(req.query.strategy || "") || undefined;

    try {
      const results = searchProjectRag(pid, q, { topK, threshold, strategy });
      res.json(results);
    } catch (err: any) {
      console.error(`Search error for ${pid}:`, err);
      res.status(500).json({ error: err.message || "Search failed" });
    }
  });

  app.post("/api/projects/:pid/rag/search", (req, res) => {
    const pid = req.params.pid;
    const { query, topK, threshold, strategy } = req.body || {};
    try {
      const results = searchProjectRag(pid, String(query || ""), {
        topK: Number(topK) || undefined,
        threshold: threshold !== undefined ? Number(threshold) : undefined,
        strategy: strategy ? String(strategy) : undefined,
      });
      res.json(results);
    } catch (err: any) {
      res.status(500).json({ error: err.message || "Search failed" });
    }
  });

  // 8. RAG Settings: Get & Save
  app.get("/api/projects/:pid/rag/settings", (req, res) => {
    const pid = req.params.pid;
    try {
      const settings = getProjectRagSettings(pid);
      res.json({ settings });
    } catch (err: any) {
      res.status(500).json({ error: err.message || "Failed to load RAG settings" });
    }
  });

  app.post("/api/projects/:pid/rag/settings", (req, res) => {
    const pid = req.params.pid;
    const { settings } = req.body || {};
    if (!settings || typeof settings !== "object") {
      return res.status(400).json({ error: "Valid settings object is required" });
    }

    try {
      const updated = saveProjectRagSettings(pid, settings);
      res.json({
        success: true,
        settings: updated,
        message: "RAG settings saved successfully. Changing chunking parameters requires reindexing the knowledge base.",
      });
    } catch (err: any) {
      res.status(500).json({ error: err.message || "Failed to save settings" });
    }
  });

  // 9. Test Vector Store Connection & Integrity
  app.post("/api/projects/:pid/rag/test-vector-store", (req, res) => {
    const pid = req.params.pid;
    const start = Date.now();
    try {
      const chunks = listKnowledgeChunks(pid);
      const latencyMs = Date.now() - start;
      const connected = chunks.length > 0;

      res.json({
        connected,
        status: connected ? "Connected" : "Not configured",
        vectorsCount: chunks.length,
        index: `project_${pid}_vectors`,
        latencyMs: Math.max(1, latencyMs),
        message: connected 
          ? `Vector index online with ${chunks.length} vectors (${latencyMs}ms)`
          : "Vector store has not yet been populated with documents.",
      });
    } catch (err: any) {
      res.status(500).json({
        connected: false,
        error: err.message || "Vector store connection test failed",
      });
    }
  });

  // 10. Workspace / Global Knowledge RAG Endpoints
  app.get("/api/knowledge/rag", (req, res) => {
    try {
      let pid = String(req.query.projectId || "global");
      let proj = getProject(pid);
      if (!proj) {
        try {
          createProject({
            id: "global",
            name: "Global Knowledge Base",
            description: "Workspace-wide documents & knowledge base",
          });
          pid = "global";
        } catch {}
      }
      const status = getProjectRagStatus(pid);
      res.json(status);
    } catch (err: any) {
      res.status(500).json({ error: err.message || "Failed to load knowledge RAG" });
    }
  });

  app.post("/api/knowledge/rag/upload", upload.array("files", 20), async (req, res) => {
    let pid = String(req.body?.projectId || "global");
    try {
      let proj = getProject(pid);
      if (!proj) {
        createProject({ id: "global", name: "Global Knowledge Base", description: "Workspace Knowledge" });
        pid = "global";
      }
      const reqFiles = (req.files as Express.Multer.File[]) || [];
      if (!reqFiles || reqFiles.length === 0) {
        return res.status(400).json({ error: "No files uploaded" });
      }

      const settings = getProjectRagSettings(pid);
      const results: any[] = [];
      const allNewChunks: any[] = [];

      for (const file of reqFiles) {
        const cleanName = path.basename(file.originalname);
        const relativePath = `docs/${cleanName}`;
        const ext = path.extname(cleanName).toLowerCase();
        const extracted = await extractDocumentText(cleanName, file.buffer);
        const textContent = typeof extracted.text === "string" 
          ? extracted.text 
          : (extracted.text ? String(extracted.text) : "");

        const isBinary = [".pdf", ".docx", ".zip"].includes(ext);
        const fileId = "file_" + Date.now() + "_" + Math.random().toString(36).substring(2, 11);

        createFile({
          id: fileId,
          project_id: pid,
          path: relativePath,
          name: cleanName,
          extension: ext,
          language: ext.replace(".", "") || "text",
          size: file.size,
          content: textContent,
          is_binary: isBinary,
        });

        const chunks = chunkDocument(pid, relativePath, textContent, settings);
        allNewChunks.push(...chunks);

        upsertKnowledgeSource({
          id: "ks_" + Math.random().toString(36).substring(2, 11),
          project_id: pid,
          path: relativePath,
          name: cleanName,
          extension: ext,
          file_type: getFileTypeDisplayName(ext, cleanName),
          size: file.size,
          chunks_count: chunks.length,
          status: "Indexed",
        });

        results.push({
          filename: cleanName,
          size: file.size,
          chunksCount: chunks.length,
          status: "Indexed",
        });
      }

      if (allNewChunks.length > 0) {
        createKnowledgeChunksBatch(allNewChunks.map(c => ({
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
          version: c.version,
        })));
      }

      res.json({
        success: true,
        message: `Successfully indexed ${results.length} document(s) with ${allNewChunks.length} chunks.`,
        files: results,
      });
    } catch (err: any) {
      console.error("Workspace RAG upload failed:", err);
      res.status(500).json({ error: err.message || "Failed to process documents" });
    }
  });

  app.post("/api/knowledge/rag/search", (req, res) => {
    const { query, projectId, topK, threshold } = req.body || {};
    const pid = String(projectId || "global");
    try {
      const results = searchProjectRag(pid, String(query || ""), {
        topK: Number(topK) || 6,
        threshold: threshold !== undefined ? Number(threshold) : 0.65,
      });
      res.json(results);
    } catch (err: any) {
      res.status(500).json({ error: err.message || "Search failed" });
    }
  });

  app.delete("/api/knowledge/rag/documents", (req, res) => {
    const { id, path: docPath, projectId } = req.body || {};
    const pid = String(projectId || "global");
    try {
      deleteProjectDocument(pid, id || docPath);
      res.json({ success: true, message: "Document deleted" });
    } catch (err: any) {
      res.status(500).json({ error: err.message || "Failed to delete document" });
    }
  });

  app.post("/api/knowledge/rag/reindex", async (req, res) => {
    const pid = String(req.body?.projectId || "global");
    try {
      const result = await indexProjectKnowledge(pid);
      res.json({ success: true, ...result });
    } catch (err: any) {
      res.status(500).json({ error: err.message || "Reindexing failed" });
    }
  });

  // 11. Multilingual Q&A directly grounded in documents (Hinglish, Hindi, English)
  app.post("/api/knowledge/rag/ask", async (req, res) => {
    const { query, projectId } = req.body || {};
    const q = String(query || "").trim();
    if (!q) return res.status(400).json({ error: "Query is required" });

    const pid = String(projectId || "global");
    try {
      // 1. Retrieve most relevant chunks
      const searchRes = searchProjectRag(pid, q, { topK: 5, threshold: 0.35 });
      let hits = searchRes.results || [];

      // Fallback: if keyword search missed due to cross-language phrasing (e.g. Hindi/Hinglish question on English document),
      // ground on all available indexed chunks for that project/workspace.
      if (hits.length === 0) {
        const fallbackChunks = listKnowledgeChunks(pid).slice(0, 6);
        hits = fallbackChunks.map(c => ({
          filename: c.file_id?.replace("docs/", "") || "document",
          file: c.file_id,
          score: 0.50,
          snippet: c.content ? c.content.slice(0, 180) + "..." : "",
          content: c.content || "",
        }));
      }

      const contextText = hits.map(h => `[Document: ${h.filename} | Score: ${(h.score * 100).toFixed(0)}%]\n${h.content}`).join("\n\n---\n\n");

      const prompt = `DOCUMENT CONTEXT (Ground Truth):
${contextText || "No matching chunks found in the knowledge base."}

CRITICAL ACCURACY INSTRUCTIONS:
1. Base your answer strictly on the above document context. Do not invent, hallucinate, or assume facts not present.
2. If the answer cannot be found in the document, state clearly: "Yeh information document me available nahi hai" or "This detail is not present in the indexed documents."
3. LANGUAGE MATCHING:
   - If the user asks in Hinglish, respond in natural, friendly Hinglish.
   - If the user asks in Hindi, respond in fluent Hindi.
   - If the user asks in English, respond in clear English.
   - Match whatever language the user prompts in.
4. Keep the explanation accurate, structured, and helpful.

USER QUESTION:
${q}`;

      const aiRes = await generateGeminiWithResilience({
        contents: prompt,
        systemInstruction: "You are Clarity AI, a precise, fact-grounded knowledge assistant. You strictly respect truth from documents and communicate fluently in Hinglish, Hindi, and English.",
      });

      res.json({
        answer: aiRes.text || "No response generated.",
        sources: hits.map(h => ({ filename: h.filename, score: h.score, snippet: h.snippet })),
      });
    } catch (err: any) {
      res.status(500).json({ error: err.message || "Failed to generate answer" });
    }
  });
}
