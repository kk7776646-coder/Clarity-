import { registerProjectAndFileRoutes } from "./project-routes";
import {
  verifySupabaseConnection,
  ensureSupabaseBucketsExist,
  ensureSupabaseTablesExist,
  isSupabaseConfigured,
  getSupabaseAdmin,
} from "./supabase.js";
import { syncProjectFiles, createTerminalSession, startTerminalSession, stopTerminalSession, sendInputToSession, getProjectSessions, activeSessions, sanitizeSession, resolveProjectWorkspace, detectProject } from "./run-engine";
import httpProxy from "http-proxy";
import express from "express";
import cookieParser from "cookie-parser";
import cors from "cors";
import path from "path";
import fs from "fs";
import os from "os";
import crypto from "crypto";
import multer from "multer";
import { GoogleGenAI } from "@google/genai";
import {
  formatApiError,
  isRetryableError,
  streamGeminiWithResilience,
  generateGeminiWithResilience,
} from "./gemini-resilience.js";
import { extractZipSecurely, analyzeProject, ProjectAnalysis, ExtractedFile } from "./project-analyzer";
import { executeGeneration, GeneratedArtifact, detectGenerationIntent, generateDocxReport, generatePowerPointPresentation, generatePdfReport, generateExcelWorkbook } from "./file-generator";
import { renderSvgToPngBuffer, renderSvgToJpgBuffer, generateArchitectureDiagramSvg, generateWorkflowDiagramSvg } from "./visual-intelligence";
import { executeCopilotTurn } from "./copilot-engine.js";
import { indexProject, updateFileKnowledge, deleteFileKnowledge, getProjectKnowledge, searchKnowledge, deleteProjectKnowledge } from "./knowledge-engine.js";
import { registerRagRoutes } from "./rag-routes.js";
import { analyzeFileDiagnostics } from "./project-diagnostics";
import { storageManager } from "./storage-manager.js";
import AdmZip from "adm-zip";
import {
  initDatabaseSchema,
  createProject as dbCreateProject,
  dbGetModels,
  dbSaveModel,
  dbDeleteModel,
  dbSaveUser,
  dbGetUser,
  dbGetUserByEmail,
  dbListUsers,
  dbSaveSession,
  dbGetSession,
  dbDeleteSession,
  getProject as dbGetProject,
  listProjects as dbListProjects,
  updateProject as dbUpdateProject,
  deleteProject as dbDeleteProject,
  createFile as dbCreateFile,
  getFile as dbGetFile,
  getProjectFileByPath as dbGetProjectFileByPath,
  listFiles as dbListFiles,
  updateFile as dbUpdateFile,
  updateFileByPath as dbUpdateFileByPath,
  deleteFile as dbDeleteFile,
  deleteProjectFileByPath as dbDeleteProjectFileByPath,
  renameProjectFolderFiles as dbRenameProjectFolderFiles,
  deleteProjectFolderFiles as dbDeleteProjectFolderFiles,
  createArtifact as dbCreateArtifact,
  listArtifacts as dbListArtifacts,
  deleteArtifact as dbDeleteArtifact,
  createKnowledgeChunk as dbCreateKnowledgeChunk,
  deleteKnowledgeForProject as dbDeleteKnowledgeForProject,
  saveArchitecture as dbSaveArchitecture,
  getArchitecture as dbGetArchitecture,
  deleteArchitectureForProject as dbDeleteArchitectureForProject,
  saveDiagnostics as dbSaveDiagnostics,
  getDiagnostics as dbGetDiagnostics,
  deleteDiagnosticsForProject as dbDeleteDiagnosticsForProject,
  saveProjectAnalysis as dbSaveProjectAnalysis,
  getProjectAnalysis as dbGetProjectAnalysis,
  deleteProjectAnalysis as dbDeleteProjectAnalysis,
  saveGithubConnection as dbSaveGithubConnection,
  getGithubConnection as dbGetGithubConnection,
  saveConversation as dbSaveConversation,
  getConversation as dbGetConversation,
  listConversations as dbListConversations,
  deleteConversation as dbDeleteConversation,
  saveMessage as dbSaveMessage,
  listMessages as dbListMessages,
  deleteMessage as dbDeleteMessage,
  saveWorkspaceFile as dbSaveWorkspaceFile,
  getWorkspaceFile as dbGetWorkspaceFile,
  listWorkspaceFiles as dbListWorkspaceFiles,
  deleteWorkspaceFile as dbDeleteWorkspaceFile,
  parseMetadataSafely,
  countProjectFiles,
  getConversationMessageCounts,
  dbDeleteExpiredSessions,
  saveVisualAsset,
  listVisualAssets,
  getVisualAsset,
  deleteVisualAsset
} from "./db.js";
import { generateProjectImage } from "./image-service.js";
import {
  PROJECTS_DIR,
  validateProjectId,
  getProjectStorageDir,
  sanitizeProjectPath,
  resolveProjectFilePath,
  writeProjectFileToDisk,
  readProjectFileFromDisk,
  deleteProjectFileFromDisk,
  renameProjectFileOnDisk,
  createProjectFolderOnDisk,
  renameProjectFolderOnDisk,
  deleteProjectFolderOnDisk,
  deleteProjectStorage,
  listProjectDiskFiles,
  syncDiskFromDatabase,
} from "./project-storage.js";

const PORT = 3000;
const SESSION_COOKIE = "clarity_session";

// ---------------------------------------------------------------------------
// In-Memory Data Store (persists for container lifetime)
// ---------------------------------------------------------------------------
interface User {
  id: string;
  email: string;
  name: string;
  password?: string;
  active_model_id: string | null;
  created_at: number;
}

interface ModelItem {
  id: string;
  name: string;
  provider: string;
  baseUrl: string;
  apiKey: string;
  modelName: string;
  modelType: string;
  capabilities: {
    text: boolean;
    vision: boolean;
    imageGeneration: boolean;
    codeGeneration: boolean;
    fileAnalysis: boolean;
    streaming: boolean;
  };
  contextWindow: number;
  maxOutputTokens: number;
  defaultTemperature: number;
  defaultTopP: number;
  supportsStreaming: boolean;
  enabled: boolean;
  status: string;
  lastTestedAt?: number | null;
  lastError?: string | null;
  isUser: boolean;
}

interface MessageItem {
  id: string;
  conversation_id: string;
  role: "user" | "assistant" | "system";
  content: string;
  buffer?: Buffer;
  model_id: string | null;
  attachments?: any[];
  created_at: number;
}

interface ConversationItem {
  id: string;
  user_id: string;
  title: string;
  model_id: string;
  created_at: number;
  updated_at: number;
}

interface FileItem {
  id: string;
  user_id: string;
  conversation_id: string | null;
  project_id: string | null;
  filename: string;
  mime: string;
  size: number;
  file_type: string;
  content: string;
  uploaded_at: number;
  buffer?: Buffer;
}

export interface GitHubConfig {
  owner: string;
  repo: string;
  branch: string;
  lastSyncedAt: number;
  lastCommitSha?: string;
  status: "synced" | "syncing" | "error" | "changes_available";
  errorMessage?: string;
  token?: string;
}

interface ProjectItem {
  id: string;
  user_id: string;
  name: string;
  description: string;
  project_type?: string;
  primary_language?: string;
  file_count?: number;
  created_at: number;
  updated_at: number;
  source?: "upload" | "github";
  github?: GitHubConfig;
}

const projectAnalyses = new Map<string, ProjectAnalysis>();
const projectArtifacts = new Map<string, GeneratedArtifact>();

// Password hashing utilities using scrypt
export function hashPassword(password: string): string {
  const salt = crypto.randomBytes(16).toString("hex");
  const hash = crypto.scryptSync(password, salt, 64).toString("hex");
  return `${salt}:${hash}`;
}

export function verifyPassword(password: string, storedHash: string): boolean {
  if (!storedHash) return false;
  if (!storedHash.includes(":")) {
    return password === storedHash;
  }
  try {
    const [salt, key] = storedHash.split(":");
    const keyBuffer = Buffer.from(key, "hex");
    const derivedKey = crypto.scryptSync(password, salt, 64);
    return crypto.timingSafeEqual(keyBuffer, derivedKey);
  } catch {
    return false;
  }
}

export function classifyFile(filePath: string) {
  const ext = path.extname(filePath).toLowerCase();
  const isBinary = [
    ".png", ".jpg", ".jpeg", ".gif", ".webp", ".ico", ".pdf", ".zip",
    ".tar", ".gz", ".wasm", ".bin", ".exe", ".mp3", ".mp4", ".mov",
    ".woff", ".woff2", ".ttf", ".eot", ".svgz"
  ].includes(ext);

  const mimeMap: Record<string, string> = {
    ".html": "text/html",
    ".htm": "text/html",
    ".css": "text/css",
    ".js": "application/javascript",
    ".jsx": "application/javascript",
    ".ts": "application/typescript",
    ".tsx": "application/typescript",
    ".json": "application/json",
    ".md": "text/markdown",
    ".txt": "text/plain",
    ".svg": "image/svg+xml",
    ".png": "image/png",
    ".jpg": "image/jpeg",
    ".jpeg": "image/jpeg",
    ".gif": "image/gif",
    ".webp": "image/webp",
    ".ico": "image/x-icon",
    ".pdf": "application/pdf",
    ".zip": "application/zip",
    ".sql": "text/plain",
    ".py": "text/x-python",
    ".sh": "text/x-shellscript",
    ".yml": "text/yaml",
    ".yaml": "text/yaml",
  };

  return {
    isBinary,
    mime: mimeMap[ext] || (isBinary ? "application/octet-stream" : "text/plain"),
    language: ext.replace(".", "") || "text",
    extension: ext,
  };
}

// Seed initial user
const initialUser: User = {
  id: "user_default",
  email: "user@clarity.ai",
  name: "Clarity User",
  password: hashPassword("password123"),
  active_model_id: "",
  created_at: Date.now(),
};

const users = new Map<string, User>([[initialUser.id, initialUser]]);
const sessions = new Map<string, string>([["default_token", initialUser.id]]);

// Active models in memory (loaded from SQLite database)
const models = new Map<string, ModelItem>();

// Safe model resolver that matches ID, name, or returns active user-configured model (or null if none)
export function resolveModelConfig(requestedModelId?: string | null, userId?: string | null): ModelItem | null {
  if (requestedModelId) {
    // 1. Direct match by exact ID
    if (models.has(requestedModelId)) {
      return models.get(requestedModelId)!;
    }
    // 2. Case-insensitive match on ID, name, or modelName
    const norm = requestedModelId.toLowerCase().trim();
    for (const m of models.values()) {
      if (
        m.id.toLowerCase() === norm ||
        m.name.toLowerCase() === norm ||
        m.modelName.toLowerCase() === norm
      ) {
        return m;
      }
    }
  }

  // Check user active model
  if (userId && users.has(userId)) {
    const u = users.get(userId)!;
    if (u.active_model_id && models.has(u.active_model_id)) {
      return models.get(u.active_model_id)!;
    }
  }

  // Fallback: First enabled model configured by user
  const enabledModel = Array.from(models.values()).find((m) => m.enabled) || Array.from(models.values())[0];
  if (enabledModel) return enabledModel;

  return null;
}
const conversations = new Map<string, ConversationItem>();
const messages = new Map<string, MessageItem>();
const files = new Map<string, FileItem>();
const projects = new Map<string, ProjectItem>();

function refreshProjectIntelligence(pid: string): ProjectAnalysis | null {
  const proj = projects.get(pid);
  if (!proj) return null;
  const pFiles = Array.from(files.values()).filter((f) => f.project_id === pid);
  const extracted: ExtractedFile[] = pFiles.map((f) => ({
    path: f.filename,
    name: path.basename(f.filename),
    extension: path.extname(f.filename).toLowerCase(),
    size: f.size,
    isBinary: f.file_type === "binary",
    content: f.content,
    lineCount: f.content ? f.content.split(/\r?\n/).length : 0,
  }));
  const analysis = analyzeProject(proj.name, pid, extracted as any);
  projectAnalyses.set(pid, analysis);
  try {
    dbSaveProjectAnalysis(pid, analysis);
  } catch (e) {
    console.warn("Failed to persist project analysis to SQLite:", e);
  }
  return analysis;
}

// Seed an initial conversation
const initialConv: ConversationItem = {
  id: "conv_welcome",
  user_id: initialUser.id,
  title: "Welcome to Clarity",
  model_id: "clarity-gemini",
  created_at: Date.now() - 60000,
  updated_at: Date.now() - 60000,
};
conversations.set(initialConv.id, initialConv);

const welcomeMsg: MessageItem = {
  id: "msg_welcome",
  conversation_id: initialConv.id,
  role: "assistant",
  content:
    "Hello! I am **Clarity**, your AI-powered assistant. You can chat with me, upload knowledge documents to ground responses in your materials, explore code repositories with Projects, or configure custom AI models.\n\nHow can I help you today?",
  model_id: "clarity-gemini",
  created_at: Date.now() - 60000,
};
messages.set(welcomeMsg.id, welcomeMsg);

// Hydrate state from persistent SQLite database on boot
function hydrateFromDatabase() {
  try {
    initDatabaseSchema();
    const dbProjects = dbListProjects();
    for (const p of dbProjects) {
      const meta: any = parseMetadataSafely(p.metadata);
      const pFiles = dbListFiles(p.id);
      const effectiveCount = pFiles.length > 0 ? pFiles.length : (meta.file_count || countProjectFiles(p.id) || 0);
      const pItem: ProjectItem = {
        id: p.id,
        user_id: meta.user_id || initialUser.id,
        name: p.name,
        description: p.description || "",
        source: (p.source_type as any) || "upload",
        project_type: meta.project_type || undefined,
        primary_language: meta.primary_language || undefined,
        file_count: effectiveCount,
        created_at: p.created_at,
        updated_at: p.updated_at,
        github: meta.github || undefined,
      };
      projects.set(p.id, pItem);

      // Load files for project
      for (const f of pFiles) {
        files.set(f.id, {
          id: f.id,
          user_id: meta.user_id || initialUser.id,
          conversation_id: null,
          project_id: p.id,
          filename: f.path,
          mime: f.is_binary ? "application/octet-stream" : "text/plain",
          size: f.size,
          file_type: f.is_binary ? "binary" : "code",
          content: f.content,
          uploaded_at: Math.floor(f.created_at / 1000),
        });
      }
      // Ensure physical files on disk match SQLite database state
      try {
        syncDiskFromDatabase(p.id, pFiles);
      } catch (syncErr) {
        console.warn(`Failed to sync physical disk for project ${p.id}:`, syncErr);
      }

      // Load analysis if cached
      const an = dbGetProjectAnalysis(p.id);
      if (an) {
        projectAnalyses.set(p.id, an);
      }

      // Load artifacts
      const arts = dbListArtifacts(p.id);
      for (const a of arts) {
        projectArtifacts.set(a.id, {
          id: a.id,
          projectId: a.project_id,
          type: (a.artifact_type as any) || "markdown",
          name: a.name,
          title: a.name,
          data: a.content || "",
          path: a.path || undefined,
          createdAt: a.created_at,
          updatedAt: a.updated_at,
        } as any);
      }
    }

    // Load workspace files
    const wsFiles = dbListWorkspaceFiles(initialUser.id);
    for (const wf of wsFiles) {
      files.set(wf.id, {
        id: wf.id,
        user_id: wf.user_id,
        conversation_id: null,
        project_id: null,
        filename: wf.filename,
        mime: wf.mime,
        size: wf.size,
        file_type: wf.file_type,
        content: wf.content,
        uploaded_at: Math.floor(wf.uploaded_at / 1000),
      });
    }

    // Load models from SQLite
    const dbM = dbGetModels();
    for (const m of dbM) {
      if (
        m.id === "Gemini 3.5 Flash-Lite" ||
        m.name === "Gemini 3.5 Flash-Lite" ||
        m.model_name === "gemini-3.5-flash-lite"
      ) {
        try { dbDeleteModel(m.id); } catch {}
        continue;
      }
      let caps = {};
      if (m.capabilities) {
        try { caps = typeof m.capabilities === "string" ? JSON.parse(m.capabilities) : m.capabilities; } catch {}
      }
      models.set(m.id, {
        id: m.id,
        name: m.name,
        provider: m.provider,
        baseUrl: m.base_url,
        apiKey: m.api_key,
        modelName: m.model_name,
        modelType: m.model_type,
        capabilities: caps,
        contextWindow: m.context_window,
        maxOutputTokens: m.max_output_tokens,
        defaultTemperature: m.default_temperature,
        defaultTopP: m.default_top_p,
        supportsStreaming: Boolean(m.supports_streaming),
        enabled: Boolean(m.enabled),
        status: m.status,
        isUser: Boolean(m.is_user),
      });
    }

    // Ensure default Gemini model is seeded if database has no models
    // Load conversations & messages
    const convs = dbListConversations(initialUser.id);
    if (convs.length > 0) {
      conversations.clear();
      messages.clear();
      for (const c of convs) {
        conversations.set(c.id, {
          id: c.id,
          user_id: c.user_id,
          title: c.title,
          model_id: c.model_id || "clarity-gemini",
          created_at: c.created_at,
          updated_at: c.updated_at,
        });
        const msgs = dbListMessages(c.id);
        for (const m of msgs) {
          messages.set(m.id, {
            id: m.id,
            conversation_id: m.conversation_id,
            role: m.role,
            content: m.content,
            model_id: m.model_id || "clarity-gemini",
            attachments: m.attachments,
            created_at: m.created_at,
          });
        }
      }
    } else {
      dbSaveConversation(initialConv.id, initialConv.user_id, initialConv.title, initialConv.model_id);
      dbSaveMessage(welcomeMsg.id, welcomeMsg.conversation_id, welcomeMsg.role, welcomeMsg.content, welcomeMsg.model_id);
    }
    // Hydrate users
    const dbUsersList = dbListUsers();
    if (dbUsersList.length > 0) {
      for (const u of dbUsersList) {
        let activeModel = u.active_model_id;
        if (!activeModel || activeModel === "Gemini 3.5 Flash-Lite" || !models.has(activeModel)) {
          activeModel = "clarity-gemini";
          try { dbSaveUser({ ...u, active_model_id: activeModel }); } catch {}
        }
        users.set(u.id, {
          id: u.id,
          email: u.email,
          name: u.name,
          password: u.password || "",
          active_model_id: activeModel,
          created_at: u.created_at,
        });
      }
    } else {
      // Seed default user into SQLite database
      dbSaveUser(initialUser);
      const sessExp = Date.now() + 30 * 24 * 3600 * 1000;
      dbSaveSession("default_token", initialUser.id, sessExp);
    }

    // Clean up expired sessions in DB
    dbDeleteExpiredSessions();
    console.log(`[DB Hydration] Loaded ${projects.size} projects, ${files.size} files, ${models.size} models, ${conversations.size} conversations, ${users.size} users from SQLite.`);
  } catch (err) {
    console.error("Error hydrating from SQLite database:", err);
  }
}

hydrateFromDatabase();

// Helper for file type detection
function detectFileType(filename: string, mime: string): string {
  const ext = (filename.split(".").pop() || "").toLowerCase();
  if (["pdf", "doc", "docx", "txt", "md", "rtf", "odt"].includes(ext)) return "document";
  if (["jpg", "jpeg", "png", "gif", "svg", "webp", "bmp"].includes(ext)) return "image";
  if (["js", "jsx", "ts", "tsx", "py", "java", "c", "cpp", "cs", "go", "rs", "php", "rb", "html", "css", "json", "yaml", "yml", "sql", "sh"].includes(ext)) return "code";
  if (["csv", "xlsx", "xls"].includes(ext)) return "spreadsheet";
  if (["zip", "tar", "gz", "rar", "7z"].includes(ext)) return "archive";
  if (mime && mime.startsWith("image/")) return "image";
  return "document";
}

function publicModel(m: ModelItem) {
  const { apiKey, ...rest } = m;
  return {
    ...rest,
    hasApiKey: Boolean(apiKey),
    apiKeyMasked: apiKey ? "••••••••••••" : null,
  };
}

function publicUser(u: User) {
  return {
    id: u.id,
    email: u.email,
    name: u.name,
    active_model_id: u.active_model_id,
  };
}

// ---------------------------------------------------------------------------
// Multer setup for file uploads
// ---------------------------------------------------------------------------
const upload = multer({
  storage: multer.memoryStorage(),
  limits: { fileSize: 50 * 1024 * 1024 },
});

// ---------------------------------------------------------------------------
// Main Server Function
// ---------------------------------------------------------------------------
async function startServer() {
  const app = express();
  
  app.use((req, res, next) => {
    console.log(`[DEBUG] Request: ${req.method} ${req.url}`);
    next();
  });

  const allowedOrigins = [
    "https://clarity.kk7776646.workers.dev",
    "http://localhost:3000",
    "http://localhost:5173",
    "http://127.0.0.1:3000",
    "http://127.0.0.1:5173"
  ];

  app.use(cors({
    origin: (origin, callback) => {
      if (!origin || allowedOrigins.includes(origin) || origin.endsWith(".workers.dev") || origin.endsWith(".onrender.com")) {
        callback(null, true);
      } else {
        callback(null, true); // Permissive for production web access with credentials reflect
      }
    },
    credentials: true,
    allowedHeaders: ["Content-Type", "Authorization", "X-Requested-With", "Accept"],
    methods: ["GET", "POST", "PUT", "DELETE", "PATCH", "OPTIONS"]
  }));
  app.use(cookieParser());
  app.use(express.json({ limit: "50mb" }));
  app.use(express.urlencoded({ extended: true, limit: "50mb" }));

  // Request logger
  app.use((req, res, next) => {
    if (req.path.startsWith("/api/")) {
      console.log(`[API] ${req.method} ${req.path}`);
    }
    next();
  });

  // Auth resolver middleware
  function resolveUser(req: express.Request): User | null {
    let token = req.cookies?.[SESSION_COOKIE];
    if (!token && req.headers.authorization?.startsWith("Bearer ")) {
      token = req.headers.authorization.substring(7).trim();
    }
    if (token) {
      if (sessions.has(token)) {
        const uid = sessions.get(token)!;
        const u = users.get(uid);
        if (u) return u;
      }
      const dbSess = dbGetSession(token);
      if (dbSess) {
        sessions.set(token, dbSess.user_id);
        let u = users.get(dbSess.user_id);
        if (!u) {
          const dbU = dbGetUser(dbSess.user_id);
          if (dbU) {
            u = {
              id: dbU.id,
              email: dbU.email,
              name: dbU.name,
              password: dbU.password || "",
              active_model_id: dbU.active_model_id || "",
              created_at: dbU.created_at,
            };
            users.set(u.id, u);
          }
        }
        if (u) return u;
      }
    }
    // Fall back to initial user if default_token is in session or for seamless initial experience
    return initialUser;
  }

  // -------------------------------------------------------------------------
  // Health & Storage Management
  // -------------------------------------------------------------------------
  app.get("/api/health", async (_req, res) => {
    const supabaseHealth = isSupabaseConfigured() ? await verifySupabaseConnection() : { configured: false };
    res.json({
      status: "ok",
      service: "clarity",
      supabase: supabaseHealth,
    });
  });

  app.get("/api/supabase/status", async (_req, res) => {
    const health = await verifySupabaseConnection();
    res.json(health);
  });

  app.get("/api/storage/status", (_req, res) => {
    try {
      const breakdown = storageManager.getStorageBreakdown();
      const used = storageManager.getUsedStorage();
      const limit = storageManager.getStorageLimit();
      const available = storageManager.getAvailableStorage();
      const percent = storageManager.getUsagePercent();
      const quotaCheck = storageManager.checkQuota(0);

      res.json({
        root: storageManager.getStorageRoot(),
        limitBytes: limit,
        limitGB: Number((limit / (1024 * 1024 * 1024)).toFixed(2)),
        usedBytes: used,
        usedGB: Number((used / (1024 * 1024 * 1024)).toFixed(2)),
        availableBytes: available,
        availableGB: Number((available / (1024 * 1024 * 1024)).toFixed(2)),
        usagePercent: percent,
        status: quotaCheck.status,
        breakdown: {
          projectsGB: Number((breakdown.projectsBytes / (1024 * 1024 * 1024)).toFixed(3)),
          ragGB: Number((breakdown.ragBytes / (1024 * 1024 * 1024)).toFixed(3)),
          artifactsGB: Number((breakdown.artifactsBytes / (1024 * 1024 * 1024)).toFixed(3)),
          cacheGB: Number((breakdown.cacheBytes / (1024 * 1024 * 1024)).toFixed(3)),
          databaseGB: Number((breakdown.databaseBytes / (1024 * 1024 * 1024)).toFixed(3)),
        }
      });
    } catch (err: any) {
      res.status(500).json({ error: err.message || "Failed to get storage status" });
    }
  });

  app.post("/api/storage/limit", (req, res) => {
    const { limitGB } = req.body || {};
    const gb = Number(limitGB);
    if (!gb || gb <= 0 || gb > 1000) {
      return res.status(400).json({ error: "Invalid storage limit (must be between 1 and 1000 GB)" });
    }
    try {
      const bytes = gb * 1024 * 1024 * 1024;
      storageManager.setStorageLimit(bytes);
      res.json({ success: true, limitGB: gb, limitBytes: bytes });
    } catch (err: any) {
      res.status(500).json({ error: err.message || "Failed to update storage limit" });
    }
  });

  app.post("/api/storage/clear-cache", (_req, res) => {
    try {
      const cacheDir = path.join(storageManager.getStorageRoot(), "cache");
      if (fs.existsSync(cacheDir)) {
        fs.rmSync(cacheDir, { recursive: true, force: true });
        fs.mkdirSync(cacheDir, { recursive: true });
      }
      res.json({ success: true, message: "Cache cleared successfully" });
    } catch (err: any) {
      res.status(500).json({ error: err.message || "Failed to clear cache" });
    }
  });

  // -------------------------------------------------------------------------
  // Auth API
  // -------------------------------------------------------------------------
  app.get("/api/auth/me", (req, res) => {
    console.log("[API] Auth Me called, path:", req.path);
    const user = resolveUser(req);
    if (!user) {
      console.log("[API] Auth Me: User not resolved");
      return res.status(401).json({ user: null });
    }
    // Ensure default cookie is set if not already
    if (!req.cookies?.[SESSION_COOKIE]) {
      res.cookie(SESSION_COOKIE, "default_token", {
        httpOnly: true,
        sameSite: "lax",
        maxAge: 30 * 24 * 3600 * 1000,
        path: "/",
      });
    }
    res.json({ user: publicUser(user) });
  });

  app.post("/api/auth/signup", (req, res) => {
    const { email, password, name } = req.body || {};
    if (!email || !password) {
      return res.status(400).json({ error: "Email and password are required" });
    }
    const cleanEmail = String(email).trim().toLowerCase();
    if (!cleanEmail.includes("@") || String(password).length < 4) {
      return res.status(400).json({ error: "Please provide a valid email and a password of at least 4 characters" });
    }

    const existing = dbGetUserByEmail(cleanEmail) || Array.from(users.values()).find(u => u.email.toLowerCase() === cleanEmail);
    if (existing) {
      return res.status(409).json({ error: "An account with this email already exists" });
    }

    const id = `user_${Date.now()}`;
    const hashedPassword = hashPassword(String(password));
    const newUser: User = {
      id,
      email: cleanEmail,
      name: String(name || cleanEmail.split("@")[0]).trim(),
      password: hashedPassword,
      active_model_id: Array.from(models.keys())[0] || "",
      created_at: Date.now(),
    };

    dbSaveUser(newUser);
    users.set(id, newUser);

    const token = `sess_${Date.now()}_${crypto.randomBytes(16).toString("hex")}`;
    const expiresAt = Date.now() + 30 * 24 * 3600 * 1000;
    dbSaveSession(token, id, expiresAt);
    sessions.set(token, id);

    res.cookie(SESSION_COOKIE, token, {
      httpOnly: true,
      sameSite: "lax",
      maxAge: 30 * 24 * 3600 * 1000,
      path: "/",
    });
    res.status(201).json({ user: publicUser(newUser), token });
  });

  app.post("/api/auth/login", (req, res) => {
    const { email, password } = req.body || {};
    if (!email || !password) {
      return res.status(400).json({ error: "Email and password are required" });
    }
    const cleanEmail = String(email).trim().toLowerCase();

    let matched: User | null = null;
    for (const u of users.values()) {
      if (u.email.toLowerCase() === cleanEmail) {
        matched = u;
        break;
      }
    }
    if (!matched) {
      const dbU = dbGetUserByEmail(cleanEmail);
      if (dbU) {
        matched = {
          id: dbU.id,
          email: dbU.email,
          name: dbU.name,
          password: dbU.password || "",
          active_model_id: dbU.active_model_id || "",
          created_at: dbU.created_at,
        };
        users.set(matched.id, matched);
      }
    }

    if (!matched || !verifyPassword(String(password), matched.password)) {
      return res.status(401).json({ error: "Invalid email or password" });
    }

    const token = `sess_${Date.now()}_${crypto.randomBytes(16).toString("hex")}`;
    const expiresAt = Date.now() + 30 * 24 * 3600 * 1000;
    dbSaveSession(token, matched.id, expiresAt);
    sessions.set(token, matched.id);

    res.cookie(SESSION_COOKIE, token, {
      httpOnly: true,
      sameSite: "lax",
      maxAge: 30 * 24 * 3600 * 1000,
      path: "/",
    });
    res.json({ user: publicUser(matched), token });
  });

  app.post("/api/auth/logout", (req, res) => {
    const token = req.cookies?.[SESSION_COOKIE];
    if (token) {
      sessions.delete(token);
      dbDeleteSession(token);
    }
    res.clearCookie(SESSION_COOKIE, { path: "/" });
    res.json({ ok: true });
  });

  // -------------------------------------------------------------------------
  // Models API
  // -------------------------------------------------------------------------
  app.get("/api/models", (req, res) => {
    const user = resolveUser(req) || initialUser;
    
    // Refresh models map from SQLite database to guarantee consistency
    try {
      const dbM = dbGetModels();
      models.clear();
      for (const m of dbM) {
        if (
          m.id === "Gemini 3.5 Flash-Lite" ||
          m.name === "Gemini 3.5 Flash-Lite" ||
          m.model_name === "gemini-3.5-flash-lite"
        ) {
          try { dbDeleteModel(m.id); } catch {}
          continue;
        }
        let caps = {};
        if (m.capabilities) {
          try { caps = typeof m.capabilities === "string" ? JSON.parse(m.capabilities) : m.capabilities; } catch {}
        }
        models.set(m.id, {
          id: m.id,
          name: m.name,
          provider: m.provider,
          baseUrl: m.base_url,
          apiKey: m.api_key,
          modelName: m.model_name,
          modelType: m.model_type,
          capabilities: caps,
          contextWindow: m.context_window,
          maxOutputTokens: m.max_output_tokens,
          defaultTemperature: m.default_temperature,
          defaultTopP: m.default_top_p,
          supportsStreaming: Boolean(m.supports_streaming),
          enabled: Boolean(m.enabled),
          status: m.status,
          isUser: Boolean(m.is_user),
        });
      }
    } catch (e) {
      console.error("Failed to refresh models from DB:", e);
    }

    const resolvedActive = resolveModelConfig(user.active_model_id, user.id);
    const active = resolvedActive ? resolvedActive.id : "";
    if (user.active_model_id !== active) {
      user.active_model_id = active;
      try { dbSaveUser(user); } catch {}
    }
    
    const list = Array.from(models.values()).map((m) => {
      const pub = publicModel(m);
      return {
        ...pub,
        is_active: pub.id === active,
      };
    });
    res.json({ models: list, active });
  });

  app.post("/api/models", (req, res) => {
    const body = req.body || {};
    const id = String(body.id || `custom_${Date.now()}`).trim();
    if (models.has(id)) {
      return res.status(409).json({ error: `Model '${id}' already exists`, type: "duplicate_model" });
    }
    const newModel: ModelItem = {
      id,
      name: String(body.name || id).trim(),
      provider: String(body.provider || "custom").toLowerCase(),
      baseUrl: String(body.baseUrl || "").trim(),
      apiKey: String(body.apiKey || "").trim(),
      modelName: String(body.modelName || id).trim(),
      modelType: String(body.modelType || "text"),
      capabilities: {
        text: true,
        vision: Boolean(body.capabilities?.vision),
        imageGeneration: Boolean(body.capabilities?.imageGeneration),
        codeGeneration: true,
        fileAnalysis: true,
        streaming: body.capabilities?.streaming !== false,
      },
      contextWindow: Number(body.contextWindow || 16000),
      maxOutputTokens: Number(body.maxOutputTokens || 4096),
      defaultTemperature: Number(body.defaultTemperature || 0.7),
      defaultTopP: Number(body.defaultTopP || 1.0),
      supportsStreaming: body.supportsStreaming !== false,
      enabled: body.enabled !== false,
      status: "available",
      isUser: true,
    };
    models.set(id, newModel);
    try { dbSaveModel(newModel); } catch(err) { console.error(err); }
    res.status(201).json(publicModel(newModel));
  });

  app.get("/api/models/:id", (req, res) => {
    const m = models.get(req.params.id);
    if (!m) return res.status(404).json({ error: "Model not found", type: "model_not_found" });
    res.json(publicModel(m));
  });

  app.put("/api/models/:id", (req, res) => {
    const id = req.params.id;
    const existing = models.get(id);
    if (!existing) return res.status(404).json({ error: "Model not found", type: "model_not_found" });

    const body = req.body || {};
    const submittedKey = String(body.apiKey || "").trim();
    const keepOldKey = !submittedKey || submittedKey.includes("•");

    const updated: ModelItem = {
      ...existing,
      name: String(body.name || existing.name).trim(),
      provider: String(body.provider || existing.provider).toLowerCase(),
      baseUrl: String(body.baseUrl !== undefined ? body.baseUrl : existing.baseUrl).trim(),
      apiKey: keepOldKey ? existing.apiKey : submittedKey,
      modelName: String(body.modelName || existing.modelName).trim(),
      modelType: String(body.modelType || existing.modelType),
      capabilities: {
        ...existing.capabilities,
        ...(body.capabilities || {}),
      },
      contextWindow: Number(body.contextWindow || existing.contextWindow),
      maxOutputTokens: Number(body.maxOutputTokens || existing.maxOutputTokens),
      defaultTemperature: Number(body.defaultTemperature ?? existing.defaultTemperature),
      defaultTopP: Number(body.defaultTopP ?? existing.defaultTopP),
      supportsStreaming: body.supportsStreaming !== false,
      enabled: body.enabled !== false,
      status: "available",
    };
    models.set(id, updated);
    try { dbSaveModel(updated); } catch(err) { console.error(err); }
    res.json(publicModel(updated));
  });

  app.delete("/api/models/:id", (req, res) => {
    const id = req.params.id;
    if (models.has(id)) {
      models.delete(id);
      try {
        dbDeleteModel(id);
        for (const u of users.values()) {
          if (u.active_model_id === id) {
            u.active_model_id = Array.from(models.keys())[0] || "";
            dbSaveUser(u);
          }
        }
      } catch (err) {
        console.error("Error deleting model:", err);
      }
      return res.json({ deleted: true, id });
    }
    res.status(404).json({ error: "Model not found", type: "model_not_found" });
  });

  app.post("/api/models/:id/enable", (req, res) => {
    const id = req.params.id;
    const m = models.get(id);
    if (!m) return res.status(404).json({ error: "Model not found", type: "model_not_found" });
    m.enabled = Boolean(req.body?.enabled ?? true);
    res.json({ ok: true, enabled: m.enabled, model: publicModel(m) });
  });

  function getEffectiveBaseUrl(m: any): string {
    if (!m) return "";
    const provider = String(m.provider || "").toLowerCase();
    const modelName = String(m.modelName || "").toLowerCase();
    const id = String(m.id || "").toLowerCase();
    if ((provider === "z.ai" || provider === "z-ai" || provider === "z_ai") && (modelName === "glm-5.1" || id === "glm-5-1")) {
      return "https://api.z.ai/api/coding/paas/v4";
    }
    return String(m.baseUrl || "").trim();
  }

  app.post("/api/models/set-active", (req, res) => {
    const user = resolveUser(req) || initialUser;
    const { model_id } = req.body || {};
    if (!model_id || !models.has(model_id)) {
      return res.status(404).json({ error: `Model '${model_id}' not found`, type: "model_not_found" });
    }
    user.active_model_id = model_id;
    try { dbSaveUser(user); } catch {}
    res.json({ ok: true, active: model_id, model: publicModel(models.get(model_id)!) });
  });

  app.post("/api/models/test", async (req, res) => {
    const body = req.body || {};
    const mid = String(body.id || "").trim();
    const existing = models.get(mid);
    
    // Merge body onto existing (if any), preserving existing API key if body has empty or masked key
    const submittedKey = String(body.apiKey || "").trim();
    const keepOldKey = existing && (!submittedKey || submittedKey.includes("•"));
    
    const m = {
      ...body,
      apiKey: keepOldKey ? existing.apiKey : submittedKey,
    };
    const provider = String(m.provider || "").toLowerCase();
    
    if (provider === "gemini") {
      try {
        const apiKey = m.apiKey || process.env.GEMINI_API_KEY || process.env.GOOGLE_API_KEY;
        if (!apiKey) return res.status(400).json({ error: "API Key required for Gemini." });
        const testModel = m.modelName || "gemini-3.6-flash";
        const testRes = await generateGeminiWithResilience({
          apiKey,
          modelName: testModel,
          contents: [{ role: "user", parts: [{ text: "ping" }] }],
          timeoutMs: 6000,
        });
        return res.json({ ok: true, message: `Gemini connection verified using ${testRes.modelUsed}` });
      } catch (err: any) {
        return res.status(400).json({ error: `Connection failed: ${formatApiError(err)}` });
      }
    }
    
    try {
      const effectiveBaseUrl = getEffectiveBaseUrl(m);
      if (!effectiveBaseUrl) return res.status(400).json({ error: "Base URL is required." });
      const headers: Record<string, string> = { "Content-Type": "application/json" };
      if (m.apiKey) headers["Authorization"] = `Bearer ${m.apiKey}`;
      
      let response = await fetch(`${effectiveBaseUrl.replace(/\/$/, "")}/models`, { method: "GET", headers });
      if (!response.ok) {
        // Fallback: try a tiny chat completions request to verify API connection
        const testBody = {
          model: m.modelName || "gpt-3.5-turbo",
          messages: [{ role: "user", content: "ping" }],
          max_tokens: 5,
        };
        const fallbackRes = await fetch(`${effectiveBaseUrl.replace(/\/$/, "")}/chat/completions`, {
          method: "POST",
          headers,
          body: JSON.stringify(testBody)
        });
        if (!fallbackRes.ok) {
          throw new Error(`Models endpoint failed (${response.status}) and fallback completions failed: HTTP ${fallbackRes.status}: ${await fallbackRes.text()}`);
        }
      }
      return res.json({ ok: true, message: "Connection verified successfully." });
    } catch (err: any) {
      return res.status(400).json({ error: `Connection failed: ${err.message}` });
    }
  });

  app.get("/api/models/:id/capabilities", (req, res) => {
    const m = models.get(req.params.id);
    if (!m) return res.status(404).json({ error: "Model not found", type: "model_not_found" });
    res.json({ capabilities: m.capabilities });
  });

  // -------------------------------------------------------------------------
  // Conversations API
  // -------------------------------------------------------------------------
  app.get("/api/conversations", (req, res) => {
    const user = resolveUser(req) || initialUser;

    // Ensure all conversations from database are in memory
    try {
      const dbConvs = dbListConversations();
      for (const dc of dbConvs) {
        if (!conversations.has(dc.id)) {
          conversations.set(dc.id, {
            id: dc.id,
            user_id: dc.user_id,
            title: dc.title,
            model_id: dc.model_id,
            created_at: dc.created_at,
            updated_at: dc.updated_at,
            project_id: dc.project_id || undefined,
          });
        }
      }
    } catch {}

    // Compute message counts per conversation
    const msgCounts = getConversationMessageCounts();
    for (const m of messages.values()) {
      if (m.conversation_id && (m.role === 'user' || m.role === 'assistant')) {
        const cur = msgCounts.get(m.conversation_id) || 0;
        msgCounts.set(m.conversation_id, cur + 1);
      }
    }

    const list = Array.from(conversations.values())
      .filter((c) => c.user_id === user.id || !c.user_id || user.id === initialUser.id)
      .sort((a, b) => b.updated_at - a.updated_at)
      .map(c => ({
        ...c,
        message_count: msgCounts.get(c.id) || 0,
      }));
    res.json({ conversations: list });
  });

  app.post("/api/conversations", (req, res) => {
    const user = resolveUser(req) || initialUser;
    const body = req.body || {};
    const id = `conv_${Date.now()}_${Math.random().toString(36).substring(2, 7)}`;
    const title = String(body.title || "New Chat").trim();
    const model_id = body.model_id || user.active_model_id || Array.from(models.keys())[0] || "";

    const conv: ConversationItem = {
      id,
      user_id: user.id,
      title,
      model_id,
      created_at: Date.now(),
      updated_at: Date.now(),
    };
    conversations.set(id, conv);
    try {
      dbSaveConversation(id, user.id, title, model_id);
    } catch {}
    res.status(201).json({ id, title, model_id });
  });

  app.delete("/api/conversations", (req, res) => {
    const user = resolveUser(req) || initialUser;
    let count = 0;
    for (const [id, c] of conversations.entries()) {
      if (c.user_id === user.id) {
        conversations.delete(id);
        try { dbDeleteConversation(id); } catch {}
        count++;
      }
    }
    // Also remove related messages
    for (const [mid, m] of messages.entries()) {
      if (!conversations.has(m.conversation_id)) {
        messages.delete(mid);
        try { dbDeleteMessage(mid); } catch {}
      }
    }
    res.json({ deleted: count });
  });

  app.get("/api/conversations/:cid", (req, res) => {
    const cid = req.params.cid;
    let conv = conversations.get(cid);
    if (!conv) {
      try {
        const dbC = dbGetConversation(cid);
        if (dbC) {
          conv = {
            id: dbC.id,
            user_id: dbC.user_id,
            title: dbC.title,
            model_id: dbC.model_id,
            created_at: dbC.created_at,
            updated_at: dbC.updated_at,
            project_id: dbC.project_id || undefined,
          };
          conversations.set(cid, conv);
        }
      } catch {}
    }
    if (!conv) return res.status(404).json({ error: "Conversation not found", type: "not_found" });

    let convMessages = Array.from(messages.values())
      .filter((m) => m.conversation_id === cid)
      .sort((a, b) => a.created_at - b.created_at);

    if (convMessages.length === 0) {
      try {
        const dbMsgs = dbListMessages(cid);
        for (const dm of dbMsgs) {
          const mItem: MessageItem = {
            id: dm.id,
            conversation_id: dm.conversation_id,
            project_id: dm.project_id || null,
            role: dm.role as any,
            content: dm.content,
            model_id: dm.model_id,
            attachments: dm.attachments || [],
            created_at: dm.created_at,
          };
          messages.set(dm.id, mItem);
        }
        convMessages = Array.from(messages.values())
          .filter((m) => m.conversation_id === cid)
          .sort((a, b) => a.created_at - b.created_at);
      } catch {}
    }

    res.json({ conversation: conv, messages: convMessages });
  });

  app.delete("/api/conversations/:cid", (req, res) => {
    const cid = req.params.cid;
    if (!conversations.has(cid)) {
      return res.status(404).json({ error: "Conversation not found", type: "not_found" });
    }
    conversations.delete(cid);
    try {
      dbDeleteConversation(cid);
    } catch {}
    for (const [mid, m] of messages.entries()) {
      if (m.conversation_id === cid) {
        messages.delete(mid);
        try { dbDeleteMessage(mid); } catch {}
      }
    }
    res.json({ deleted: true });
  });

  app.patch("/api/conversations/:cid/title", (req, res) => {
    const cid = req.params.cid;
    const conv = conversations.get(cid);
    if (!conv) return res.status(404).json({ error: "Conversation not found", type: "not_found" });
    const title = String(req.body?.title || "").trim();
    if (!title) return res.status(400).json({ error: "Title required", type: "invalid_request" });
    conv.title = title;
    conv.updated_at = Date.now();
    try {
      dbSaveConversation(cid, conv.user_id, conv.title, conv.model_id);
    } catch {}
    res.json({ updated: true, title });
  });

  app.get("/api/conversations/:cid/messages", (req, res) => {
    const cid = req.params.cid;
    if (!conversations.has(cid)) {
      return res.status(404).json({ error: "Conversation not found", type: "not_found" });
    }
    const convMessages = Array.from(messages.values())
      .filter((m) => m.conversation_id === cid)
      .sort((a, b) => a.created_at - b.created_at);
    res.json({ messages: convMessages });
  });

  app.post("/api/conversations/:cid/messages/:msg_id/edit", (req, res) => {
    const { cid, msg_id } = req.params;
    const msg = messages.get(msg_id);
    if (!msg || msg.conversation_id !== cid) {
      return res.status(404).json({ error: "Message not found", type: "not_found" });
    }
    const content = req.body?.content;
    if (typeof content !== "string") {
      return res.status(400).json({ error: "content required", type: "invalid_request" });
    }
    msg.content = content;
    res.json({ updated: true, id: msg_id, content });
  });

  app.get("/api/conversations/:cid/files", (req, res) => {
    const cid = req.params.cid;
    const convFiles = Array.from(files.values()).filter((f) => f.conversation_id === cid);
    res.json({ files: convFiles });
  });

  function isGeneralGreeting(message: string): boolean {
    if (!message) return true;
    const clean = message.trim().toLowerCase().replace(/[^\w\s]/g, "");
    if (!clean) return true;
    const words = clean.split(/\s+/).filter(Boolean);

    const exactGreetings = new Set([
      "hi", "hello", "hey", "helo", "hlo", "hai", "hii", "hiii", "hy",
      "kaise ho", "kya haal hai", "kya haal", "good morning", "good afternoon", "good evening", "good night",
      "thanks", "thank you", "dhanyawad", "shukriya", "ok", "okay", "alright",
      "great", "awesome", "nice", "bye", "goodbye", "what can you do", "who are you",
      "help", "batao", "kya kar sakte ho", "tum kaun ho", "main clarity hoon",
      "namaste", "namaskar", "hello clarity", "hi clarity", "hey clarity"
    ]);

    if (exactGreetings.has(clean)) return true;
    if (words.length <= 3) {
      const smalltalkWords = [
        "hi", "hello", "hey", "hlo", "hai", "hii", "hy", "bro", "bhai", "sir",
        "clarity", "kaise", "ho", "kya", "karo", "kardo", "aaj", "help", "good",
        "morning", "evening", "afternoon", "night", "thanks", "ok", "okay"
      ];
      if (words.every((w) => smalltalkWords.includes(w))) return true;
    }
    return false;
  }

  function buildChatContext(params: {
    textMsg: string;
    cid: string;
    file_ids?: string[];
    project_id?: string;
  }): {
    knowledgeContext: string;
    promptWithContext: string;
    isGreeting: boolean;
  } {
    const isGreeting = isGeneralGreeting(params.textMsg);

    // Explicitly scope conversation data:
    // Clearing project and file IDs unless explicitly selected or uploaded for the specific session, ensuring 'hi' queries remain general.
    let knowledgeContext = "";

    if (!isGreeting) {
      // 1. Files explicitly selected or passed for this specific session
      if (Array.isArray(params.file_ids) && params.file_ids.length > 0) {
        for (const fid of params.file_ids) {
          const fileObj = files.get(fid) || dbGetWorkspaceFile(fid);
          if (fileObj && fileObj.content) {
            knowledgeContext += `\n\n=== ATTACHED DOCUMENT: "${fileObj.filename}" ===\n${fileObj.content.substring(0, 50000)}\n=== END OF "${fileObj.filename}" ===\n`;
          }
        }
      }

      // 2. Files explicitly uploaded for this specific conversation session
      const convFiles = Array.from(files.values()).filter((f) => f.conversation_id === params.cid);
      if (convFiles.length > 0) {
        for (const f of convFiles) {
          if (f.content && (!params.file_ids || !params.file_ids.includes(f.id))) {
            knowledgeContext += `\n\n=== ATTACHED DOCUMENT: "${f.filename}" ===\n${f.content.substring(0, 50000)}\n=== END OF "${f.filename}" ===\n`;
          }
        }
      }

      // 3. Project explicitly selected for this session
      if (params.project_id && (projectAnalyses.has(params.project_id) || dbGetProjectAnalysis(params.project_id))) {
        const pa = projectAnalyses.get(params.project_id) || dbGetProjectAnalysis(params.project_id)!;
        knowledgeContext += `\n\n[Active Project: ${pa.projectName} (${pa.projectType})]\n` +
          `Primary Language: ${pa.primaryLanguage}\n` +
          `Summary: ${pa.summary}\n` +
          `Architecture: ${pa.architecture?.summary || "N/A"}\n` +
          `Endpoints: ${(pa.apiIntelligence?.endpoints || []).map((e) => `${e.method} ${e.path} (${e.file})`).slice(0, 8).join(", ")}\n` +
          `Database: ${pa.databaseIntelligence?.description || "N/A"}`;
      }
    }

    let promptWithContext = params.textMsg;
    if (knowledgeContext && !isGreeting) {
      promptWithContext = `DOCUMENT & KNOWLEDGE CONTEXT (Ground Truth):
${knowledgeContext}

CRITICAL ACCURACY & LANGUAGE INSTRUCTIONS:
1. You have been provided with real document(s) above. Read them carefully and answer strictly based on their real text.
2. DO NOT fabricate or hallucinate any facts, numbers, experiment details, or fake results. If something is not in the provided document, explicitly state: "Yeh document me provide nahi kiya gaya hai" or "This detail is not present in the attached document."
3. MULTI-LANGUAGE MATCHING:
   - If user asks in Hinglish (e.g. "is experiment ka aim aur apparatus kya hai", "kya result aaya"), reply fluently in natural, easy-to-read Hinglish.
   - If user asks in Hindi (Devanagari script), reply in proper Hindi.
   - If user asks in English, reply in English.
   - Respond in whichever language the user writes.
4. Give structured, accurate, well-formatted markdown answers.

USER QUESTION:
${params.textMsg}`;
    }

    return { knowledgeContext, promptWithContext, isGreeting };
  }

  // -------------------------------------------------------------------------
  // Chat Streaming Endpoint (SSE)
  // -------------------------------------------------------------------------
  app.post("/api/conversations/:cid/chat", async (req, res) => {
    const cid = req.params.cid;
    let conv = conversations.get(cid);
    const user = resolveUser(req) || initialUser;

    if (!conv) {
      // Auto-create conversation if not exists
      conv = {
        id: cid,
        user_id: user.id,
        title: "New Chat",
        model_id: user.active_model_id || Array.from(models.keys())[0] || "",
        created_at: Date.now(),
        updated_at: Date.now(),
      };
      conversations.set(cid, conv);
      try {
        dbSaveConversation(cid, user.id, conv.title, conv.model_id);
      } catch {}
    }

    const { message, file_ids, project_id, model_id, think } = req.body || {};
    let textMsg = String(message || "").trim();
    if (!textMsg && Array.isArray(file_ids) && file_ids.length > 0) {
      textMsg = "Please review the attached file(s) and provide a helpful summary or answer any questions about them.";
    }
    if (!textMsg) {
      return res.status(400).json({ error: "Message is required", type: "invalid_request" });
    }

    // Prepare SSE stream
    res.setHeader("Content-Type", "text/event-stream");
    res.setHeader("Cache-Control", "no-cache");
    res.setHeader("Connection", "keep-alive");
    res.setHeader("X-Accel-Buffering", "no");

    const sendSSE = (payload: any) => {
      res.write(`data: ${JSON.stringify(payload)}\n\n`);
    };

    const modelConfig = resolveModelConfig(model_id || conv.model_id || user.active_model_id, user.id);
    if (!modelConfig) {
      sendSSE({
        error: {
          message: "No AI model is configured. Please navigate to Models in the navigation bar to add your model.",
          type: "no_model",
        },
      });
      return res.end();
    }
    let activeModelId = modelConfig.id;
    conv.model_id = activeModelId;
    conv.updated_at = Date.now();
    if (!user.active_model_id || !models.has(user.active_model_id)) {
      user.active_model_id = activeModelId;
      try { dbSaveUser(user); } catch {}
    }

    // If this is the first user message, update title based on text
    const existingMsgs = Array.from(messages.values()).filter((m) => m.conversation_id === cid);
    if (existingMsgs.length <= 1) {
      conv.title = textMsg.length > 36 ? textMsg.substring(0, 36) + "…" : textMsg;
    }
    try {
      dbSaveConversation(cid, user.id, conv.title, conv.model_id);
    } catch {}

    // Save user message
    const userMsgId = `msg_${Date.now()}_u`;
    messages.set(userMsgId, {
      id: userMsgId,
      conversation_id: cid,
      role: "user",
      content: textMsg,
      model_id: activeModelId,
      created_at: Date.now(),
    });
    try {
      dbSaveMessage(userMsgId, cid, "user", textMsg, activeModelId);
    } catch {}

    // Explicitly scope conversation context using buildChatContext
    const { knowledgeContext, promptWithContext, isGreeting } = buildChatContext({
      textMsg,
      cid,
      file_ids,
      project_id,
    });

    let assistantText = "";
    const assistantMsgId = `msg_${Date.now()}_a`;

    try {
      // Build conversation history
      const history = [];
      let expectedRole = "user";
      const existingMsgsForRegen = Array.from(messages.values())
        .filter((m) => m.conversation_id === cid)
        .sort((a, b) => a.created_at - b.created_at);
      for (const m of existingMsgsForRegen.slice(-10)) {
        const role = m.role === "assistant" ? "model" : "user";
        if (role === expectedRole && m.content?.trim()) {
          history.push({ role, parts: [{ text: m.content }] });
          expectedRole = expectedRole === "user" ? "model" : "user";
        }
      }
      if (history.length > 0 && history[history.length - 1].role === "user") {
        history.pop();
      }

      let sysInstruction = "You are Clarity, an intelligent, friendly AI assistant.\nYour goal is to provide crisp, well-structured, clear, and highly actionable answers with modern formatting.";

      if (isGreeting) {
        sysInstruction += "\n\nCRITICAL GREETING INSTRUCTION:\nThe user is starting a conversation with a greeting or smalltalk (e.g. 'hi', 'hello', 'kaise ho').\nRespond warmly, naturally, and concisely in the user's language (e.g. 'Hi! 👋 Kaise ho? Main Clarity hoon. Aaj main aapki kis cheez mein help kar sakti hoon?').\nDo NOT mention any files, documents, invoices, project names, or workspace items unless explicitly asked.";
      } else {
        sysInstruction += "\n\nCHAT UX GUIDELINES:\n1. **Be Human-Like and Conversational**: Avoid robotic phrases like \"Here is your requested output.\" or \"Below is the response.\"\n2. **Hinglish & Language Matching (CRITICAL)**: Always match the language used by the user. If the user asks in Hinglish, reply in natural Hinglish. If in English, reply in English. If in Hindi, reply in Hindi.\n3. **Visual Diagrams (Explicit Request Only)**: ONLY output a ```mermaid diagram if the user explicitly asks for a visual diagram, flowchart, pipeline, or architecture diagram.";
      }

      if (think) {
        sysInstruction += "\n\nCRITICAL THINKING MODE ACTIVE:\n" +
          "You MUST perform an incredibly deep, thorough, and analytical thinking process BEFORE writing your final answer.\n" +
          "You MUST format your entire thinking process inside a single collapsible HTML <details> block at the VERY BEGINNING of your response, structured EXACTLY like this:\n" +
          "<details class=\"thinking-process-details\" open>\n" +
          "<summary>Thinking Process</summary>\n" +
          "<div class=\"thinking-content\">\n" +
          "[Write your detailed step-by-step thinking process, architectural considerations, safety analysis, and edge cases here]\n" +
          "</div>\n" +
          "</details>\n\n" +
          "Make sure to close the details block correctly. Following the details block, provide your beautiful, structured final response to the user.";
      }

      if (modelConfig.provider === "gemini") {
        const apiKey = modelConfig.apiKey || process.env.GEMINI_API_KEY || process.env.GOOGLE_API_KEY;
        if (!apiKey) throw new Error("Gemini API key is missing. Please configure it in your model settings.");
        
        const contents = [
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
        });
        if (streamRes?.modelUsed) {
          activeModelId = streamRes.modelUsed;
        }
      } else {
        // OpenAI compatible endpoint
        const baseUrl = getEffectiveBaseUrl(modelConfig);
        if (!baseUrl) throw new Error("Base URL is missing for this model.");
        
        const openAiHistory = history.map(h => ({
          role: h.role === "model" ? "assistant" : "user",
          content: h.parts[0].text
        }));
        openAiHistory.push({ role: "user", content: promptWithContext });

        const headers = { "Content-Type": "application/json" };
        if (modelConfig.apiKey) headers["Authorization"] = `Bearer ${modelConfig.apiKey}`;
        
        const reqBody = {
          model: modelConfig.modelName || "gpt-3.5-turbo",
          messages: [
            { role: "system", content: sysInstruction },
            ...openAiHistory
          ],
          stream: true
        };
        
        const response = await fetch(`${baseUrl.replace(/\/$/, "")}/chat/completions`, {
          method: "POST",
          headers,
          body: JSON.stringify(reqBody)
        });
        
        if (!response.ok) {
           throw new Error(`HTTP ${response.status}: ${await response.text()}`);
        }
        
        if (response.body) {
           // We use a simple read loop. In standard node environments stream reading uses async iterators, but we can use chunk reading here.
           // Since Node 18 fetch is supported.
           const decoder = new TextDecoder("utf-8");
           for await (const chunk of response.body) {
             const decoded = decoder.decode(chunk, { stream: true });
             const lines = decoded.split("\n");
             for (const line of lines) {
               if (line.trim().startsWith("data: ") && !line.includes("[DONE]")) {
                 try {
                   const parsed = JSON.parse(line.trim().slice(6));
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

      // Save assistant message
      messages.set(assistantMsgId, {
        id: assistantMsgId,
        conversation_id: cid,
        role: "assistant",
        content: assistantText,
        model_id: activeModelId,
        created_at: Date.now(),
      });
      try {
        dbSaveMessage(assistantMsgId, cid, "assistant", assistantText, activeModelId);
      } catch {}

      sendSSE({
        done: true,
        message_id: assistantMsgId,
        model_id: activeModelId,
      });
      res.end();
    } catch (err: any) {
      console.error("Chat generation error:", formatApiError(err));
      sendSSE({
        error: {
          message: formatApiError(err) || "Failed to generate AI response",
          type: "chat_error",
        },
      });
      res.end();
    }
  });

  // Regenerate endpoint
  app.post("/api/conversations/:cid/regenerate", async (req, res) => {
    const cid = req.params.cid;
    const conv = conversations.get(cid);
    if (!conv) return res.status(404).json({ error: "Conversation not found", type: "not_found" });
    const user = resolveUser(req) || initialUser;

    // Find last user message
    const convMsgs = Array.from(messages.values())
      .filter((m) => m.conversation_id === cid)
      .sort((a, b) => a.created_at - b.created_at);

    // Remove last assistant message if exists
    if (convMsgs.length > 0 && convMsgs[convMsgs.length - 1].role === "assistant") {
      const lastAss = convMsgs.pop()!;
      messages.delete(lastAss.id);
      try { dbDeleteMessage(lastAss.id); } catch(e) {}
    }

    const lastUser = convMsgs.reverse().find((m) => m.role === "user");
    if (!lastUser) {
      return res.status(400).json({ error: "No user message to regenerate from", type: "invalid_request" });
    }

    const textMsg = lastUser.content;
    const { knowledgeContext, promptWithContext, isGreeting } = buildChatContext({
      textMsg,
      cid,
      file_ids: req.body?.file_ids,
      project_id: req.body?.project_id,
    });

    const modelConfig = resolveModelConfig(conv.model_id || user.active_model_id, user.id);
    if (!modelConfig) {
      res.setHeader("Content-Type", "text/event-stream");
      res.setHeader("Cache-Control", "no-cache");
      res.setHeader("Connection", "keep-alive");
      sendSSE({
        error: {
          message: "No AI model is configured. Please navigate to Models in the navigation bar to add your model.",
          type: "no_model",
        },
      });
      return res.end();
    }
    let activeModelId = modelConfig.id;
    conv.model_id = activeModelId;
    res.setHeader("Content-Type", "text/event-stream");
    res.setHeader("Cache-Control", "no-cache");
    res.setHeader("Connection", "keep-alive");

    const sendSSE = (payload: any) => {
      res.write(`data: ${JSON.stringify(payload)}\n\n`);
    };

    let assistantText = "";
    const assistantMsgId = `msg_${Date.now()}_regen`;

    try {
      // Build conversation history
      const history = [];
      let expectedRole = "user";
      const existingMsgsForRegen = Array.from(messages.values())
        .filter((m) => m.conversation_id === cid)
        .sort((a, b) => a.created_at - b.created_at);
      for (const m of existingMsgsForRegen.slice(-10)) {
        const role = m.role === "assistant" ? "model" : "user";
        if (role === expectedRole && m.content?.trim()) {
          history.push({ role, parts: [{ text: m.content }] });
          expectedRole = expectedRole === "user" ? "model" : "user";
        }
      }
      if (history.length > 0 && history[history.length - 1].role === "user") {
        history.pop();
      }

      const think = !!req.body.think;
      let sysInstruction = "You are Clarity, an intelligent AI assistant grounded in the user's personal and organizational knowledge. \nYour goal is to provide crisp, well-structured, clear, and highly actionable answers with modern formatting. \n\nCHAT UX GUIDELINES:\n1. **Be Human-Like and Conversational**: Avoid robotic phrases like \"Here is your requested output.\" or \"Below is the response.\" Talk like a brilliant, helpful collaborator starting directly and naturally.\n2. **Natural Response Structure**: Do NOT respond like a documentation generator for normal conversation. If the user asks a conversational question (e.g. \"What is my project doing?\" or \"What does this do?\"), explain naturally in conversation. Avoid rigid \"PROJECT ANALYSIS REPORT: 1. Objective 2. Scope\" formats unless the user explicitly asks for a formal report.\n3. **Hinglish & Language Matching (CRITICAL)**: Always match the language used by the user. If the user asks in Hinglish (Hindi written in Roman/English characters, e.g. \"bhai ye batao\", \"ye code kaise run kare\", \"isme error kyu aa raha hai\"), you MUST reply in natural, fluent, friendly Hinglish while keeping technical terms accurate. If the user asks in English, reply in English. If in Hindi, reply in Hindi.\n4. **Use Markdown Effectively**: Use headings, bold, italics, bullet lists, and tables to structure your answers cleanly. DO NOT dump everything into a single large paragraph.\n5. **Emoji Usage**: Use emojis naturally in conversational text when they improve readability (e.g., 🐍 Python, 💡 Tip, ⚠️ Important). Do NOT use emojis inside code, technical identifiers, file names, or API names.\n6. **Visual Diagrams (Explicit Request Only)**: For normal questions (e.g., \"What is the architecture?\", \"Explain the flow\", \"How does this work?\"), answer naturally in text. ONLY output a ```mermaid diagram if the user EXPLICITLY asks to see a visual diagram, flowchart, pipeline, or architecture diagram (e.g. \"show me the architecture diagram\", \"flowchart banao\", \"draw a visual diagram\", \"workflow draw karo\"). When explicitly requested, generate a ```mermaid code block using REAL-LIFE FOUNDATIONAL TECHNOLOGY (e.g. 📱 Client Source, 🌐 Nginx API Gateway, ⚡ Real-time Processing Engine, 🧠 AI Pipeline, 🗄️ Database, 🚨 Alert Dispatcher) and VARIED GEOMETRIC SHAPES: curved rectangles id([\"⚡ Engine\"]), circles id((\"📱 Client\")), cylinders id[(\"🗄️ Database\")], diamonds id{\"⚠️ Condition?\"}, subroutines id[[\"🧠 Module\"]], and flags id>\"🚨 Alert\"]. Prefix node labels with standard UTF-8 emojis (no HTML tags, double-quoted plain text).\n7. **No Automatic Artifacts**: Normal chat should remain conversational. Do NOT automatically generate PDF, PPT, DOCX, XLSX, or SVG unless the user explicitly requests the artifact.";

      if (think) {
        sysInstruction += "\n\nCRITICAL THINKING MODE ACTIVE:\n" +
          "You MUST perform an incredibly deep, thorough, and analytical thinking process BEFORE writing your final answer.\n" +
          "You MUST format your entire thinking process inside a single collapsible HTML <details> block at the VERY BEGINNING of your response, structured EXACTLY like this:\n" +
          "<details class=\"thinking-process-details\" open>\n" +
          "<summary>Thinking Process</summary>\n" +
          "<div class=\"thinking-content\">\n" +
          "[Write your detailed step-by-step thinking process, architectural considerations, safety analysis, and edge cases here]\n" +
          "</div>\n" +
          "</details>\n\n" +
          "Make sure to close the details block correctly. Following the details block, provide your beautiful, structured final response to the user.";
      }

      if (modelConfig.provider === "gemini") {
        const apiKey = modelConfig.apiKey || process.env.GEMINI_API_KEY || process.env.GOOGLE_API_KEY;
        if (!apiKey) throw new Error("Gemini API key is missing. Please configure it in your model settings.");
        
        const contents = [
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
        });
        if (streamRes?.modelUsed) {
          activeModelId = streamRes.modelUsed;
        }
      } else {
        // OpenAI compatible endpoint
        const baseUrl = getEffectiveBaseUrl(modelConfig);
        if (!baseUrl) throw new Error("Base URL is missing for this model.");
        
        const openAiHistory = history.map(h => ({
          role: h.role === "model" ? "assistant" : "user",
          content: h.parts[0].text
        }));
        openAiHistory.push({ role: "user", content: promptWithContext });

        const headers = { "Content-Type": "application/json" };
        if (modelConfig.apiKey) headers["Authorization"] = `Bearer ${modelConfig.apiKey}`;
        
        const reqBody = {
          model: modelConfig.modelName || "gpt-3.5-turbo",
          messages: [
            { role: "system", content: sysInstruction },
            ...openAiHistory
          ],
          stream: true
        };
        
        const response = await fetch(`${baseUrl.replace(/\/$/, "")}/chat/completions`, {
          method: "POST",
          headers,
          body: JSON.stringify(reqBody)
        });
        
        if (!response.ok) {
           throw new Error(`HTTP ${response.status}: ${await response.text()}`);
        }
        
        if (response.body) {
           // We use a simple read loop. In standard node environments stream reading uses async iterators, but we can use chunk reading here.
           // Since Node 18 fetch is supported.
           const decoder = new TextDecoder("utf-8");
           for await (const chunk of response.body) {
             const decoded = decoder.decode(chunk, { stream: true });
             const lines = decoded.split("\n");
             for (const line of lines) {
               if (line.trim().startsWith("data: ") && !line.includes("[DONE]")) {
                 try {
                   const parsed = JSON.parse(line.trim().slice(6));
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

      if (assistantText) {
        const aMsg: MessageItem = {
          id: assistantMsgId,
          conversation_id: cid,
          role: "assistant",
          content: assistantText,
          model_id: activeModelId,
          created_at: Date.now(),
        };
        messages.set(aMsg.id, aMsg);
        try {
          dbSaveMessage({
            id: aMsg.id,
            conversation_id: cid,
            role: "assistant",
            content: assistantText,
            created_at: aMsg.created_at,
          });
        } catch (dbErr) {
          console.error("Failed to save regenerated message to DB:", dbErr);
        }
      }
      res.end();
    } catch (err: any) {
      console.error("Chat regeneration error:", formatApiError(err));
      sendSSE({ error: { message: formatApiError(err) || "Failed to regenerate AI response", type: "chat_error" } });
      res.end();
    }
  });

  // Register Full Project, File Explorer, Uploads, Diagnostics & Knowledge RAG Routes
  registerProjectAndFileRoutes(app, projects, files, projectAnalyses, resolveUser, initialUser);
  registerRagRoutes(app);

  // -------------------------------------------------------------------------
  // Universal File & Asset Generation Engine Endpoints (Step 3)
  // -------------------------------------------------------------------------
  


  app.get("/api/projects", (req, res) => {
    const user = resolveUser(req) || initialUser;
    // Always sync with SQLite database to make sure newly imported/persisted projects are visible
    try {
      const dbProjects = dbListProjects();
      for (const p of dbProjects) {
        const meta: any = parseMetadataSafely(p.metadata);
        const pFiles = dbListFiles(p.id);
        const effectiveCount = pFiles.length > 0 ? pFiles.length : (meta.file_count || countProjectFiles(p.id) || 0);
        if (!projects.has(p.id)) {
          projects.set(p.id, {
            id: p.id,
            user_id: meta.user_id || user.id,
            name: p.name,
            description: p.description || meta.description || "",
            source: (p.source_type as any) || meta.source || "upload",
            project_type: meta.project_type || undefined,
            primary_language: meta.primary_language || undefined,
            file_count: effectiveCount,
            created_at: p.created_at,
            updated_at: p.updated_at,
            github: meta.github || undefined,
          });
        } else {
          const cur = projects.get(p.id)!;
          if (!cur.file_count || cur.file_count === 0) {
            cur.file_count = effectiveCount;
          }
        }
      }
    } catch (e) {
      console.error("Error listing projects from DB:", e);
    }
    const userProjects = Array.from(projects.values())
      .filter(p => {
        if (!p.user_id) return true;
        if (user && user.id !== initialUser.id) return p.user_id === user.id;
        return p.user_id === initialUser.id;
      })
      .map(p => {
        let fCount = p.file_count;
        if (!fCount || fCount === 0) {
          const dbFCount = countProjectFiles(p.id);
          if (dbFCount > 0) fCount = dbFCount;
        }
        return {
          ...p,
          file_count: fCount || 0
        };
      });
    // Return formatted response compatible with both array readers and object { projects: [] } readers
    res.json({ projects: userProjects, success: true });
  });

  app.post("/api/projects", async (req, res) => {
    const user = resolveUser(req) || initialUser;
    const { name } = req.body || {};
    if (!name) return res.status(400).json({ error: "Name is required" });
    
    const pid = "proj_" + Math.random().toString(36).substr(2, 9);
    const pItem = {
      id: pid,
      user_id: user.id,
      name,
      description: "",
      project_type: "other",
      primary_language: "text",
      created_at: Date.now(),
      updated_at: Date.now(),
      status: "ready",
      source: "upload"
    };
    
    projects.set(pid, pItem);
    
    // Save to DB
    try {
      dbCreateProject({
        id: pid,
        name,
        created_at: pItem.created_at,
        updated_at: pItem.updated_at,
        metadata: JSON.stringify({ user_id: user.id })
      });
      // Also create folder
      createProjectFolderOnDisk(pid, "/");
    } catch (e) {
      console.error(e);
    }
    
    res.json(pItem);
  });

  app.delete("/api/projects/:pid", (req, res) => {
    const pid = req.params.pid;
    const user = resolveUser(req) || initialUser;
    
    const proj = projects.get(pid);
    const dbP = dbGetProject(pid);
    if (!proj && !dbP) return res.status(404).json({ error: "Project not found" });
    
    // In-memory cleanup
    projects.delete(pid);
    projectAnalyses.delete(pid);
    for (const [id, a] of projectArtifacts.entries()) {
      if (a.projectId === pid) {
        projectArtifacts.delete(id);
      }
    }
    for (const [id, f] of files.entries()) {
      if (f.project_id === pid) {
        files.delete(id);
      }
    }
    for (const [id, c] of conversations.entries()) {
      if (c.project_id === pid) {
        conversations.delete(id);
      }
    }
    for (const [id, m] of messages.entries()) {
      if (m.project_id === pid) {
        messages.delete(id);
      }
    }
    
    // Stop any running process
    try {
      stopProject(pid);
    } catch {}

    // Database and disk cleanup
    try {
      dbDeleteProject(pid);
      deleteProjectKnowledge(pid);
      dbDeleteProjectAnalysis(pid);
      deleteProjectStorage(pid); // disk storage
    } catch (e) {
      console.error("Error cleaning up project from DB/disk:", e);
    }
    
    return res.json({ success: true, deleted: true, pid });
  });


  app.post("/api/projects/:pid/chat", async (req, res) => {
    const pid = req.params.pid;
    const user = resolveUser(req) || initialUser;
    const proj = projects.get(pid);
    if (!proj) return res.status(404).json({ error: "Project not found", type: "not_found" });
    
    const { message, model_id, file_ids, attachments, history } = req.body || {};
    let textMsg = String(message || "").trim();
    
    // Extract document content from attachments
    let attachedDocsContext = "";
    if (Array.isArray(file_ids)) {
      for (const fid of file_ids) {
        const fileObj = files.get(fid) || dbGetWorkspaceFile(fid);
        if (fileObj && fileObj.content) {
          attachedDocsContext += `\n\n=== ATTACHED DOCUMENT "${fileObj.filename}": ===\n${fileObj.content.substring(0, 30000)}\n=== END OF ATTACHED DOCUMENT ===\n`;
        }
      }
    }
    if (Array.isArray(attachments)) {
      for (const att of attachments) {
        if (att.content && (!file_ids || !file_ids.includes(att.id || att.file_id))) {
          attachedDocsContext += `\n\n=== ATTACHED DOCUMENT "${att.name || att.filename}": ===\n${att.content.substring(0, 30000)}\n=== END OF ATTACHED DOCUMENT ===\n`;
        }
      }
    }
    if (attachedDocsContext) {
      textMsg = (textMsg ? textMsg + "\n" : "Analyze the attached documents:") + attachedDocsContext;
    }

    if (!textMsg) {
      return res.status(400).json({ error: "Message or attachment is required", type: "invalid_request" });
    }

    res.setHeader("Content-Type", "text/event-stream");
    res.setHeader("Cache-Control", "no-cache");
    res.setHeader("Connection", "keep-alive");
    const sendSSE = (payload: any) => {
      res.write(`data: ${JSON.stringify(payload)}\n\n`);
    };

    const modelConfig = resolveModelConfig(model_id || user.active_model_id, user.id);
    if (!modelConfig) {
      sendSSE({
        content: "No AI model is configured. Please navigate to Models in the navigation bar to add a model.",
        done: true,
      });
      return res.end();
    }

    let assistantResponse = "";
    try {
      let generatedArtifacts: GeneratedArtifact[] = [];
      const targetFormat = req.body?.format || req.body?.explicitFormat || (req.body?.generation_mode === "file" ? undefined : req.body?.generation_mode);
      const targetFile = req.body?.targetFile || req.body?.filePath;
      const detectedIntent = detectGenerationIntent(textMsg, targetFile, targetFormat);
      
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
          lineCount: f.content ? f.content.split(/\r?\n/).length : 0,
        }));
        
      if (!analysis) {
        analysis = analyzeProject(proj.name, pid, extracted as any);
        projectAnalyses.set(pid, analysis);
      }

      // DIAGRAM & WORKFLOW REQUEST INTERCEPTION IN CHAT
      const isDiagramRequest = /diagram|architecture|workflow|pipeline|naksha|flowchart|structure|flow|map|system view|architecture diagram/i.test(textMsg) && (/diagram|architecture|workflow|pipeline|naksha|flowchart|structure|flow|map|system view/i.test(textMsg) || detectedIntent === "diagram_architecture");
      if (isDiagramRequest || detectedIntent === "diagram_architecture") {
        const isWorkflow = /workflow|pipeline|sequence|steps|process/i.test(textMsg);
        const diagramTypeLabel = isWorkflow ? "System Workflow & Execution Pipeline" : "System Architecture & Subsystems Map";

        let mermaidCode = `graph TD\n    Client["Client / Web Browser"] --> Server["server.ts - Backend API"]\n`;
        mermaidCode += `    Server --> Router["API Router & Subsystems"]\n`;

        extracted.slice(0, 7).forEach((f, idx) => {
          const nodeId = `file_${idx}`;
          const cleanName = f.path.replace(/"/g, '\\"');
          mermaidCode += `    Router --> ${nodeId}["${cleanName}"]\n`;
        });

        mermaidCode += `    style Client fill:#f8fafc,stroke:#3b82f6,stroke-width:2px,rx:8,ry:8\n`;
        mermaidCode += `    style Server fill:#f8fafc,stroke:#ec4899,stroke-width:2px,rx:8,ry:8\n`;

        const humanoidGreeting = `🤖✨ **Arre bhai, bilkul tayyar hai!** Aapke **${proj.name}** project ka ye raha gorgeous **${diagramTypeLabel}**! 🚀⚡\n\nAbhi ke abhi inspect karo (zoom, pan, full-screen mode \`[ ]\`, zoom out \`-\`, fit, zoom in \`+\`) aur top buttons se direct **PNG** ya **JPG** format mein download bhi kar lo! Koi aur doubt ho toh bina hichkichahat ke batao dost! 💻🌟\n\n\`\`\`mermaid\n${mermaidCode}\n\`\`\``;

        sendSSE({ 
          content: humanoidGreeting, 
          done: true, 
          intent: "CODE_EXPLANATION" 
        });
        return res.end();
      }

      // CODE EXPLANATION PIPELINE (HIGHEST PRIORITY)
      if (detectedIntent === "code_explanation") {
        const bodyTarget = req.body?.targetFile || req.body?.filePath || "";
        let targetFileRecord = extracted.find((f) => bodyTarget && (f.path.toLowerCase() === bodyTarget.toLowerCase() || f.path.toLowerCase().endsWith(bodyTarget.toLowerCase())));

        if (!targetFileRecord) {
          const pathMatches = textMsg.match(/`([^`]+\.[a-zA-Z0-9]+)`/)
            || textMsg.match(/\b((?:src\/|lib\/|components\/|pages\/|routes\/|services\/|utils\/|public\/|css\/|js\/|styles\/|[a-zA-Z0-9_\-\/]+)\.[a-zA-Z0-9]+)\b/gi)
            || textMsg.match(/\b([a-zA-Z0-9_\-]+\.(?:css|ts|js|jsx|tsx|py|html|json|md|sql|yaml|yml|sh|c|cpp|cs|java|go|rb|php))\b/gi);

          if (pathMatches) {
            for (const rawMatch of pathMatches) {
              const cleanPath = rawMatch.replace(/`/g, "").trim().toLowerCase();
              const match = extracted.find(
                (f) => f.path.toLowerCase() === cleanPath
                  || f.path.toLowerCase().endsWith(cleanPath)
                  || f.name.toLowerCase() === cleanPath
              );
              if (match) {
                targetFileRecord = match;
                break;
              }
            }
          }
        }

        // Fallback to active non-binary file if general "explain this file/code"
        if (!targetFileRecord && /(this file|current file|opened file|this code)/i.test(textMsg)) {
          targetFileRecord = extracted.find((f) => !f.isBinary && f.content && f.lineCount > 5) || extracted[0];
        }

        if (!targetFileRecord && textMsg.match(/`([^`]+)`/)) {
          const rawMatch = textMsg.match(/`([^`]+)`/)![1].trim();
          targetFileRecord = extracted.find((f) => f.path.toLowerCase().includes(rawMatch.toLowerCase()));
        }

        if (!targetFileRecord) {
          const requestedPathMatch = textMsg.match(/`([^`]+)`/) || textMsg.match(/\b([a-zA-Z0-9_\-\.\/]+\.[a-zA-Z0-9]+)\b/);
          const requestedPath = requestedPathMatch ? requestedPathMatch[1] : "the specified file";
          sendSSE({
            content: `I couldn't find \`${requestedPath}\` in the selected project. Please verify the file path from the file explorer (e.g., \`src/index.css\`, \`server.ts\`).`,
            intent: "CODE_EXPLANATION",
            done: true,
          });
          return res.end();
        }

        // Check if user provided a specific snippet in the message
        const snippetMatch = textMsg.match(/```(?:[a-zA-Z0-9_\-]+)?\n([\s\S]+?)\n```/);
        const hasSnippet = Boolean(snippetMatch && snippetMatch[1].trim().length > 0);
        const selectedSnippet = hasSnippet ? snippetMatch![1].trim() : "";

        // Generate Code Explanation Response
        const systemInstruction = `You are Clarity AI, an expert software engineer and code analyst.

CRITICAL INSTRUCTIONS:
- TARGETED FOCUS (STRICT RULE): The user is asking about ${hasSnippet ? "a SPECIFIC selected snippet of code" : "the file `" + targetFileRecord.path + "`"}. Focus STRICTLY on the requested ${hasSnippet ? "code snippet lines, its logic, variables, and approach" : "file's purpose, core logic, and direct functions"}.
- DO NOT explain the entire project, do NOT dump full repository architecture or file inventories. Answer ONLY what is requested in a controlled, concise, and structured manner.
- HINGLISH & LANGUAGE MATCHING (CRITICAL): If the user asks in Hinglish (Hindi written in English alphabet, e.g. "ye code kya kar raha hai", "bhai iska matlab kya hai", "isme error kyu hai"), you MUST respond in natural, friendly, fluent Hinglish while keeping variable names and syntax accurate. If the user asks in English, respond in English. If in Hindi, respond in Hindi.
- CONTROLLED OUTPUT: Keep the explanation crisp, direct, and readable. Generously use expressive emojis, symbols, icons (🤖✨💡🚀⚡), short bullet points, bold text, and clean formatting. Avoid repetitive filler or unrequested project background.`;

        let codePrompt = "";
        if (hasSnippet) {
          codePrompt = `Explain this specific code selection from \`${targetFileRecord.path}\`:

\`\`\`${targetFileRecord.extension.replace('.', '') || 'text'}
${selectedSnippet}
\`\`\`

User Request: "${textMsg}"

Provide a controlled, precise explanation of what this specific code snippet does, how its logic works step-by-step, and its immediate role in \`${targetFileRecord.path}\`. Answer directly in the user's language (use fluent Hinglish if user asked in Hinglish). Do NOT explain the rest of the project.`;
        } else {
          codePrompt = `Please explain the following existing file from project "${proj.name}":

File Path: \`${targetFileRecord.path}\`
File Extension: ${targetFileRecord.extension}
Total Lines: ${targetFileRecord.lineCount}

Actual Source Code of \`${targetFileRecord.path}\`:
\`\`\`${targetFileRecord.extension.replace('.', '') || 'text'}
${(targetFileRecord.content || "").slice(0, 16000)}
\`\`\`

User Request: "${textMsg}"

Provide a focused, controlled explanation of this file's purpose, main functions, and flow. Answer directly in the user's language (use fluent Hinglish if user asked in Hinglish). Do NOT explain the entire project.`;
        }

        const formattedHistory = Array.isArray(history) ? history : [];
        const geminiContents = formattedHistory.map((h: any) => ({
           role: h.role === "assistant" ? "model" : "user",
           parts: [{ text: h.content }]
        }));
        geminiContents.push({ role: "user", parts: [{ text: codePrompt }] });

        const openAiContents = formattedHistory.map((h: any) => ({
           role: h.role === "model" ? "assistant" : h.role,
           content: h.content
        }));
        openAiContents.push({ role: "user", content: codePrompt });

        const apiKey = modelConfig.apiKey || process.env.GEMINI_API_KEY || process.env.GOOGLE_API_KEY;
        if (modelConfig.provider === "gemini" && apiKey) {
          await streamGeminiWithResilience({
            apiKey,
            modelName: modelConfig.modelName,
            contents: geminiContents,
            systemInstruction,
            onChunk: (chunkText) => {
              if (chunkText) sendSSE({ content: chunkText, intent: "CODE_EXPLANATION" });
            },
          });
        } else {
          // OpenAI fallback
          const baseUrl = getEffectiveBaseUrl(modelConfig);
          if (!baseUrl) throw new Error("Base URL is missing for this model.");
          const headers: Record<string, string> = { "Content-Type": "application/json" };
          if (modelConfig.apiKey) headers["Authorization"] = `Bearer ${modelConfig.apiKey}`;
          
          const resOpenAi = await fetch(`${baseUrl.replace(/\/$/, "")}/chat/completions`, {
            method: "POST",
            headers,
            body: JSON.stringify({
              model: modelConfig.modelName || "gpt-3.5-turbo",
              messages: [
                { role: "system", content: systemInstruction },
                ...openAiContents,
              ],
              stream: true,
            }),
          });
          if (!resOpenAi.ok) throw new Error(`HTTP ${resOpenAi.status}: ${await resOpenAi.text()}`);
          if (resOpenAi.body) {
            const decoder = new TextDecoder("utf-8");
            for await (const chunk of resOpenAi.body) {
              const decoded = decoder.decode(chunk, { stream: true });
              const lines = decoded.split("\n");
              for (const line of lines) {
                if (line.trim().startsWith("data: ") && !line.includes("[DONE]")) {
                  try {
                    const parsed = JSON.parse(line.trim().slice(6));
                    const token = parsed.choices?.[0]?.delta?.content || "";
                    if (token) sendSSE({ content: token, intent: "CODE_EXPLANATION" });
                  } catch (e) {}
                }
              }
            }
          }
        }
        sendSSE({ done: true, intent: "CODE_EXPLANATION" });
        return res.end();
      }

      // ARTIFACT GENERATION PIPELINE
      const isArtifactIntent = [
        "document_docx",
        "presentation_pptx",
        "document_pdf",
        "spreadsheet_xlsx",
        "data_csv",
        "diagram_architecture",
        "image_asset",
        "recreate_project",
        "project_report",
        "code_single",
        "code_multi",
        "code_modify"
      ].includes(detectedIntent);

      if (isArtifactIntent) {
        try {
          const gemClient = modelConfig.provider === "gemini" && (modelConfig.apiKey || process.env.GEMINI_API_KEY || process.env.GOOGLE_API_KEY)
            ? new GoogleGenAI({ apiKey: modelConfig.apiKey || process.env.GEMINI_API_KEY || process.env.GOOGLE_API_KEY })
            : null;
          const genResult = await executeGeneration({
            prompt: textMsg,
            projectId: pid,
            userId: proj.user_id,
            analysis,
            files: extracted as any,
            geminiClient: gemClient,
            modelName: modelConfig.modelName,
            format: targetFormat,
            targetFile: targetFile,
          });
          if (genResult.success && genResult.artifacts.length > 0) {
            for (const art of genResult.artifacts) {
              projectArtifacts.set(art.id, art);
            }
            generatedArtifacts = genResult.artifacts;
            sendSSE({ type: "artifacts", artifacts: genResult.artifacts });
            const planMsg = `\n\n${genResult.message}`;
            assistantResponse += planMsg;
            sendSSE({ content: planMsg });
          } else {
             sendSSE({ content: "I analyzed your request, but could not generate the specific artifacts. " + genResult.message });
          }
        } catch (genErr: any) {
          console.warn("Generation error in chat:", genErr);
          sendSSE({ content: `\n\n[Generation Error: ${formatApiError(genErr)}]` });
        }
      } else {
        const isGreeting = isGeneralGreeting(textMsg);
        const fileListSummary = extracted.slice(0, 35).map(f => `  - ${f.path} (${f.lineCount} lines)`).join("\n");
        const endpointsSummary = analysis.apiIntelligence?.endpoints?.slice(0, 15).map(e => `${e.method} ${e.path}`).join(", ") || "None";
        const modelsSummary = analysis.databaseIntelligence?.models?.slice(0, 10).map(m => m.name).join(", ") || "None";
        const depsSummary = (Array.isArray(analysis.dependencies) ? analysis.dependencies : (analysis.dependencies?.packages || [])).slice(0, 15).map(d => d.name).join(", ") || "Standard Libraries";

        const hasAttachedDocs = Boolean(attachedDocsContext && attachedDocsContext.trim().length > 0);

        const systemInstruction = isGreeting ? `You are Clarity AI, the intelligent assistant for project "${proj.name}".
The user has sent a simple greeting or smalltalk (e.g. 'hi', 'hello', 'kaise ho').
Respond warmly, concisely, and naturally in the user's language (e.g. "Hi! 👋 Kaise ho? Main Clarity hoon. Main aapke ${proj.name} project mein help karne ke liye tayyar hoon. Bataiye, aaj kya karna hai?").
Do NOT dump file lists, full architecture reports, code summaries, or invoice details for a simple greeting.` : `You are Clarity AI, a highly articulate, senior software architect and AI assistant.

${hasAttachedDocs ? `
CRITICAL ABSOLUTE HIGHEST PRIORITY - ATTACHED DOCUMENT / UPLOADED FILE ANALYSIS:
The user has attached or uploaded document(s) / file(s) for analysis: ${attachedDocNames.length > 0 ? attachedDocNames.join(", ") : "Attached File"}.
Your PRIMARY and ABSOLUTE HIGHEST PRIORITY is to answer the user's question directly based on the contents of these ATTACHED DOCUMENTS.
- Do NOT hardcode or pivot the response back to the project codebase ("${proj.name}") unless the user explicitly asks how the attached document relates to the project.
- Read and explain what is inside the attached document clearly, accurately, and thoroughly.
- Answer directly in the EXACT language used by the user (use natural, friendly, fluent Hinglish if requested in Hinglish, e.g. "Is PDF me...", "Is document me...").
` : ""}

CURRENT PROJECT GROUND TRUTH:
- Project Name: ${proj.name}
- Primary Language & Stack: ${analysis.primaryLanguage} | ${analysis.frameworks?.join(", ") || "Web Stack"}
- Overview: ${analysis.summary}
- Total Source Files: ${extracted.length} (${analysis.fileStats.totalLines} lines)
- Primary Code Files:
${fileListSummary}
- Detected APIs: ${endpointsSummary}
- Database Models: ${modelsSummary}
- Key Dependencies: ${depsSummary}

HUMANOID CHAT, EXPLANATION & CRITICAL THINKING GUIDELINES:
1. **Strict Relevance & Controlled Scope (CRITICAL)**: Answer ONLY what the user asked. If the user asks about an attached document/file, focus strictly on that document. If the user asks about a specific line, function, error, file, or topic in the project, answer that topic directly in a controlled, concise manner. NEVER dump the whole project summary, stack overview, or complete file tree unless requested.
2. **Natural Conversational Structure**: Do NOT respond like a formal documentation generator for ordinary questions. Speak like a thoughtful tech lead and collaborator.
3. **Hinglish & Language Matching (CRITICAL)**: Always respond in the exact language used by the user. If the user writes in Hinglish (Hindi written in Roman/English characters, e.g. 'is pdf me kya hai', 'ye code kya karta hai', 'ye batao', 'kya issue hai'), you MUST respond in natural, fluent, friendly Hinglish while keeping technical terms accurate. If in English, respond in English. If in Hindi, respond in Hindi.
4. **Be Warm, Expressive, and Human-Like**: Talk like a world-class principal architect and caring friend. Use a natural, friendly tone with warm empathy. Generously incorporate expressive emojis, symbols, and icons (e.g. 🤖✨🚀⚡📊💻🌟🎯🔥💡) in every response to create an engaging and lively interaction experience. Respond directly and naturally without forced greetings like "Namaste".
5. **CRITICAL THINKING / CHALLENGE-FIRST MODE (CORE BEHAVIOR)**:
   - **Evaluate Reasoning Before Supporting**: When the user presents a plan, idea, strategy, technical decision, architecture decision, product decision, assumption, proposed solution, or debugging approach, evaluate it critically for weakest points, incorrect assumptions, missing requirements, technical risks, security risks, scalability issues, unnecessary complexity, hidden trade-offs, edge cases, better alternatives, and missing evidence. If a meaningful weakness exists, mention it BEFORE agreeing or supporting the idea.
   - **Do Not Challenge Normal Chat**: Do NOT challenge greetings, simple factual questions, definitions, translations, calculations, straightforward tasks, artifact requests, or normal conversational questions.
   - **Challenge Only When Useful**: Challenge when the message contains a meaningful decision, idea, plan, assumption, claim, strategy, or technical approach. Do not manufacture criticism just to appear intelligent. If reasonable, explain why.
   - **Natural Phrasing**: Use natural phrasing like "One concern: ...", "Why it matters: ...", "A better approach may be: ...".
   - **Never Blindly Agree**: Avoid automatic phrases like "You're absolutely right", "Great idea", "Perfect", "Exactly", unless justified. Agreement comes AFTER evaluation.
   - **Technical Decisions & Root Cause**: For coding, architecture, RAG, database, API, security, and system-design questions, determine root cause vs symptom, potential breaking changes, architecture conflicts, simpler solutions, and project evidence. If fixing a symptom, state: "This may fix the symptom, but the root cause appears to be X."
   - **Project-Aware Reasoning**: Use actual current project context and ProjectEvidence. Never invent files, APIs, databases, frameworks, or metrics. If unverified: "I can't verify that from the available project evidence."
   - **Actionable Alternatives**: Never criticize without helping. Provide a safer approach and explain why.
   - **Do Not Override User Intent**: Critical thinking must not prevent Clarity from performing a clearly requested task (e.g., "Create a PPT", "Fix this bug", "Create a report"). Only challenge if they prescribe an approach with a meaningful technical problem.
6. **Format & Readability**: Arrange text nicely like ChatGPT to make it easy to understand. Use ordered lists, unordered lists, bold text, and code snippets where appropriate.
7. **Context Grounding**: If an attached document is present or referenced, ground your answer in the attached document. Otherwise, ground details directly in project "${proj.name}".
8. **Visual Diagrams & Foundational Tech Workflows (Explicit Request Only)**: For normal questions, answer conversationally in text. ONLY output a \`\`\`mermaid diagram if the user EXPLICITLY asks to see a visual diagram, flowchart, pipeline, or architecture diagram.
9. **No Automatic Artifacts**: Do NOT automatically generate files or reports unless explicitly requested.
10. **Image & Visual Asset Capabilities**: Clarity AI IS FULLY CAPABLE of generating high-resolution PNG images, conceptual technical diagrams, presentation hero graphics, architecture slides, Word documents, Excel spreadsheets, PDFs, and PowerPoint decks directly when explicitly requested!`;

        const formattedHistory = Array.isArray(history) ? history : [];
        const geminiContents = formattedHistory.map((h: any) => ({
           role: h.role === "assistant" ? "model" : "user",
           parts: [{ text: h.content }]
        }));
        geminiContents.push({ role: "user", parts: [{ text: textMsg }] });

        const openAiContents = formattedHistory.map((h: any) => ({
           role: h.role === "model" ? "assistant" : h.role,
           content: h.content
        }));
        openAiContents.push({ role: "user", content: textMsg });

        if (modelConfig.provider === "gemini") {
          const apiKey = modelConfig.apiKey || process.env.GEMINI_API_KEY || process.env.GOOGLE_API_KEY;
          if (!apiKey) throw new Error("AI client not available. API key is missing.");
          await streamGeminiWithResilience({
            apiKey,
            modelName: modelConfig.modelName,
            contents: geminiContents,
            systemInstruction,
            onChunk: (chunkText) => {
              if (chunkText) {
                sendSSE({ content: chunkText });
              }
            },
          });
        } else {
          // OpenAI compatible endpoint
          const baseUrl = getEffectiveBaseUrl(modelConfig);
          if (!baseUrl) throw new Error("Base URL is missing for this model.");
          const headers: Record<string, string> = { "Content-Type": "application/json" };
          if (modelConfig.apiKey) headers["Authorization"] = `Bearer ${modelConfig.apiKey}`;
          
          const resOpenAi = await fetch(`${baseUrl.replace(/\/$/, "")}/chat/completions`, {
            method: "POST",
            headers,
            body: JSON.stringify({
              model: modelConfig.modelName || "gpt-3.5-turbo",
              messages: [
                { role: "system", content: systemInstruction },
                ...openAiContents,
              ],
              stream: true,
            }),
          });
          if (!resOpenAi.ok) throw new Error(`HTTP ${resOpenAi.status}: ${await resOpenAi.text()}`);
          if (resOpenAi.body) {
            const decoder = new TextDecoder("utf-8");
            for await (const chunk of resOpenAi.body) {
              const decoded = decoder.decode(chunk, { stream: true });
              const lines = decoded.split("\n");
              for (const line of lines) {
                if (line.trim().startsWith("data: ") && !line.includes("[DONE]")) {
                  try {
                    const parsed = JSON.parse(line.trim().slice(6));
                    const token = parsed.choices?.[0]?.delta?.content || "";
                    if (token) sendSSE({ content: token });
                  } catch (e) {}
                }
              }
            }
          }
        }
      }
      sendSSE({ done: true });
      res.end();
    } catch (err: any) {
      console.error("Project chat error:", err);
      sendSSE({ content: `\n\n[Error generating response: ${formatApiError(err)}]`, done: true });
      res.end();
    }
  });

  app.post("/api/projects/:pid/generate", async (req, res) => {
    const user = resolveUser(req) || initialUser;
    const pid = req.params.pid;
    const proj = projects.get(pid);
    if (!proj) return res.status(404).json({ error: "Project not found", type: "not_found" });

    const { prompt, targetFile, model_id, template, format } = req.body || {};
    if (!prompt && !template) return res.status(400).json({ error: "Prompt or template is required", type: "invalid_request" });

    let analysis = projectAnalyses.get(pid);
    const pFiles = Array.from(files.values()).filter((f) => f.project_id === pid);
    const extracted: ExtractedFile[] = pFiles.map((f) => ({
      path: f.filename,
      name: path.basename(f.filename),
      extension: path.extname(f.filename).toLowerCase(),
      size: f.size,
      isBinary: f.file_type === "binary",
      content: f.content,
      lineCount: f.content ? f.content.split(/\r?\n/).length : 0,
    }));

    if (!analysis) {
      analysis = analyzeProject(proj.name, pid, extracted);
      projectAnalyses.set(pid, analysis);
    }

    const rawPrompt = typeof prompt === "string" ? prompt.trim() : "";
    const rawTemplate = typeof template === "string" ? template.trim() : "";
    const rawFormat = typeof format === "string" ? format.trim().toLowerCase() : "";
    const rawTargetFile = typeof targetFile === "string" ? targetFile.trim() : undefined;

    // Strictly detect user intent from prompt analysis, explicit format, and template
    const detectedIntent = detectGenerationIntent(rawPrompt, rawTargetFile, rawFormat, rawTemplate);

    // Resolve strictly enforced format string ("pptx" | "docx" | "xlsx" | "pdf" | "svg" | "csv" | "code")
    let resolvedFormat: string = rawFormat;
    if (!resolvedFormat) {
      if (detectedIntent === "presentation_pptx") resolvedFormat = "pptx";
      else if (detectedIntent === "document_docx" || detectedIntent === "project_report") resolvedFormat = "docx";
      else if (detectedIntent === "spreadsheet_xlsx") resolvedFormat = "xlsx";
      else if (detectedIntent === "document_pdf") resolvedFormat = "pdf";
      else if (detectedIntent === "diagram_architecture") resolvedFormat = "svg";
      else if (detectedIntent === "data_csv") resolvedFormat = "csv";
      else if (detectedIntent === "code_single" || detectedIntent === "code_multi") resolvedFormat = "code";
    }

    // Ensure prompt is descriptive and driven by the resolved file type and template, preventing hardcoded defaults
    let effectivePrompt = rawPrompt;
    if (!effectivePrompt) {
      if (resolvedFormat === "pptx") {
        effectivePrompt = `Generate a comprehensive PowerPoint presentation slide deck (.pptx) using the ${rawTemplate || "technical_defense"} template for project ${proj.name}`;
      } else if (resolvedFormat === "docx") {
        effectivePrompt = `Generate an in-depth executive Word technical report (.docx) using the ${rawTemplate || "project_proposal"} template for project ${proj.name}`;
      } else if (resolvedFormat === "xlsx") {
        effectivePrompt = `Generate a complete multi-sheet Excel spreadsheet analysis workbook (.xlsx) detailing project metrics, APIs, dependencies, and findings for project ${proj.name}`;
      } else if (resolvedFormat === "pdf") {
        effectivePrompt = `Generate a printable executive PDF report (.pdf) for project ${proj.name}`;
      } else if (resolvedFormat === "svg") {
        effectivePrompt = `Generate an interactive SVG architecture diagram for project ${proj.name}`;
      } else {
        effectivePrompt = `Generate ${rawTemplate || "project"} asset for ${proj.name}`;
      }
    }

    const modelConfig = resolveModelConfig(model_id || user.active_model_id, user.id);
    const gemClient = modelConfig && modelConfig.provider === "gemini" && (modelConfig.apiKey || process.env.GEMINI_API_KEY || process.env.GOOGLE_API_KEY)
      ? new GoogleGenAI({ apiKey: modelConfig.apiKey || process.env.GEMINI_API_KEY || process.env.GOOGLE_API_KEY })
      : null;

    try {
      const result = await executeGeneration({
        prompt: effectivePrompt,
        template: rawTemplate || undefined,
        format: resolvedFormat || undefined,
        projectId: pid,
        userId: user.id,
        analysis,
        files: extracted,
        geminiClient: gemClient,
        modelName: modelConfig?.modelName,
        targetFile: rawTargetFile,
      });

      if (result.success && result.artifacts.length > 0) {
        for (const art of result.artifacts) {
          projectArtifacts.set(art.id, art);
          try {
            dbCreateArtifact({
              id: art.id,
              project_id: pid,
              name: art.filename,
              path: art.path || art.filename,
              mime_type: art.mimeType,
              artifact_type: art.category || art.extension,
              content: art.content || (art.bufferBase64 ? JSON.stringify({
                bufferBase64: art.bufferBase64,
                structuredData: art.structuredData,
                description: art.description,
                size: art.size,
                mimeType: art.mimeType,
                category: art.category,
                filename: art.filename,
                extension: art.extension,
                validation: art.validation,
              }) : ""),
            });
          } catch (dbErr) {
            console.warn(`[DB] Failed to persist artifact ${art.id}:`, dbErr);
          }
        }
      }

      res.json({
        ...result,
        artifact: result.artifacts?.[0] || result.artifact,
        format: resolvedFormat,
      });
    } catch (err: any) {
      console.error("Generate error:", err);
      res.status(500).json({ error: formatApiError(err) || "Failed to generate artifact", type: "generation_error" });
    }
  });

  app.post("/api/projects/:pid/diagnostics", (req, res) => {
    const pid = req.params.pid;
    const { path, content } = req.body || {};
    if (!path || typeof content !== "string") return res.status(400).json({ error: "Missing path or content" });
    
    // We can call analyzeFileDiagnostics here
    const issues = analyzeFileDiagnostics(path, content, Array.from(files.values()).filter(f => f.project_id === pid));
    const summary = { errors: 0, warnings: 0, suggestions: 0 };
    issues.forEach(i => {
       if (i.severity === 'error') summary.errors++;
       else if (i.severity === 'warning') summary.warnings++;
       else summary.suggestions++;
    });
    res.json({ issues, summary });
  });

  app.post("/api/projects/:pid/diagnostics/ai-fix", async (req, res) => {
    const pid = req.params.pid;
    const { path, line, issueId, issueMessage, issueExplanation, fixAll } = req.body || {};
    
    const projectFiles = Array.from(files.values()).filter(f => f.project_id === pid);
    const target = projectFiles.find(f => f.filename === path || f.filename.endsWith("/" + path));
    if (!target) return res.status(404).json({ error: "File not found" });

    const issues = analyzeFileDiagnostics(path, target.content || "", projectFiles);
    const issue = issues.find(i => i.id === issueId);
    
    if (issue && issue.patchedContent) {
       return res.json({ fixedContent: issue.patchedContent });
    }
    
    if (issue && issue.suggestedCode && issue.diff) {
       const newContent = (target.content || "").replace(issue.diff.before, issue.diff.after);
       return res.json({ fixedContent: newContent });
    } else if (issue && issue.suggestedCode && issue.currentCode) {
       const newContent = (target.content || "").replace(issue.currentCode, issue.suggestedCode);
       return res.json({ fixedContent: newContent });
    }

    const sys = "You are a senior developer fixing code issues. Return ONLY the fully fixed file content. Do not include markdown codeblocks (```) wrapping the file, just the raw content. Do not explain anything.";
    
    let user = "";
    if (fixAll) {
       const allIssues = issues.map((iss, idx) => `${idx+1}. Line ${iss.line}: ${iss.message} - ${iss.explanation}`).join("\n");
       user = `File: ${path}
Issues to fix:
${allIssues}

Current Content:
${target.content || ""}

Fix all these issues and output the complete fixed file content:`;
    } else {
       user = `File: ${path}
Line: ${line}
Issue: ${issueMessage}
Explanation: ${issueExplanation}

Current Content:
${target.content || ""}

Fix the issue and output the complete fixed file content:`;
    }
    
    try {
      const resp = await generateGeminiWithResilience(sys, user);
      if (resp && resp.text) {
         let fixed = resp.text.trim();
         if (fixed.startsWith("```")) {
            fixed = fixed.replace(/^```[a-z]*\n/, "").replace(/\n```$/, "");
         }
         return res.json({ fixedContent: fixed });
      }
    } catch (e) {
      console.error(e);
    }

    return res.status(500).json({ error: "No automated fix available without Gemini" });
  });

  app.post("/api/projects/:pid/artifacts", (req, res) => {
    const pid = req.params.pid;
    const { filename, content, bufferBase64, category, description, source } = req.body || {};
    if (!filename || !category) return res.status(400).json({ error: "filename and category are required" });
    
    const art = {
      id: "art_" + Math.random().toString(36).substring(2, 9),
      projectId: pid,
      userId: "local",
      filename,
      extension: filename.split('.').pop(),
      mimeType: "application/pdf",
      size: bufferBase64 ? Math.floor((bufferBase64.length * 3) / 4) : 0,
      category,
      description: description || "Exported asset",
      bufferBase64,
      content,
      createdAt: Date.now(),
      updatedAt: Date.now(),
      source: source || "Upload",
      validation: { status: "unverified", message: "Pending validation" }
    };
    projectArtifacts.set(art.id, art);
    res.json({ artifact: art });
  });

  app.get("/api/projects/:pid/artifacts", (req, res) => {
    const pid = req.params.pid;
    const arts = Array.from(projectArtifacts.values())
      .filter((a) => a.projectId === pid)
      .sort((a, b) => b.createdAt - a.createdAt);
    res.json({ artifacts: arts });
  });

  app.get("/api/artifacts/:id", (req, res) => {
    let art = projectArtifacts.get(req.params.id);
    if (!art) {
      try {
        const dbArt = dbGetArtifact(req.params.id);
        if (dbArt) {
          let parsedExtra: any = {};
          if (dbArt.content && dbArt.content.startsWith("{")) {
            try { parsedExtra = JSON.parse(dbArt.content); } catch (_) {}
          }
          art = {
            id: dbArt.id,
            projectId: dbArt.project_id,
            filename: parsedExtra.filename || dbArt.name,
            extension: parsedExtra.extension || (dbArt.name.split('.').pop() || "txt"),
            mimeType: parsedExtra.mimeType || dbArt.mime_type || "application/octet-stream",
            size: parsedExtra.size || (dbArt.content ? Buffer.byteLength(dbArt.content) : 0),
            category: parsedExtra.category || (dbArt.artifact_type as any) || "data",
            description: parsedExtra.description || "",
            bufferBase64: parsedExtra.bufferBase64,
            structuredData: parsedExtra.structuredData,
            content: parsedExtra.bufferBase64 ? undefined : dbArt.content || undefined,
            createdAt: dbArt.created_at,
            updatedAt: dbArt.updated_at,
            source: "Database",
            validation: parsedExtra.validation || { status: "passed", message: "Restored from database" }
          };
          projectArtifacts.set(art.id, art);
        }
      } catch (dbErr) {
        console.warn(`[API] DB lookup failed for artifact ${req.params.id}:`, dbErr);
      }
    }
    if (!art) return res.status(404).json({ error: "Artifact not found", type: "not_found" });
    res.json({ artifact: art });
  });

  app.get("/api/artifacts/:id/download", (req, res) => {
    let art = projectArtifacts.get(req.params.id);
    if (!art) {
      try {
        const dbArt = dbGetArtifact(req.params.id);
        if (dbArt) {
          let parsedExtra: any = {};
          if (dbArt.content && dbArt.content.startsWith("{")) {
            try { parsedExtra = JSON.parse(dbArt.content); } catch (_) {}
          }
          art = {
            id: dbArt.id,
            projectId: dbArt.project_id,
            filename: parsedExtra.filename || dbArt.name,
            extension: parsedExtra.extension || (dbArt.name.split('.').pop() || "txt"),
            mimeType: parsedExtra.mimeType || dbArt.mime_type || "application/octet-stream",
            size: parsedExtra.size || (dbArt.content ? Buffer.byteLength(dbArt.content) : 0),
            category: parsedExtra.category || (dbArt.artifact_type as any) || "data",
            description: parsedExtra.description || "",
            bufferBase64: parsedExtra.bufferBase64,
            structuredData: parsedExtra.structuredData,
            content: parsedExtra.bufferBase64 ? undefined : dbArt.content || undefined,
            createdAt: dbArt.created_at,
            updatedAt: dbArt.updated_at,
            source: "Database",
            validation: parsedExtra.validation || { status: "passed", message: "Restored from database" }
          };
          projectArtifacts.set(art.id, art);
        }
      } catch (_) {}
    }
    if (!art) return res.status(404).json({ error: "Artifact not found", type: "not_found" });

    res.setHeader("Content-Disposition", `attachment; filename="${encodeURIComponent(art.filename)}"`);
    res.setHeader("Content-Type", art.mimeType || "application/octet-stream");

    if (art.bufferBase64) {
      const buf = Buffer.from(art.bufferBase64, "base64");
      res.setHeader("Content-Length", buf.length);
      return res.send(buf);
    }

    const text = art.content || "";
    res.setHeader("Content-Length", Buffer.byteLength(text, "utf-8"));
    res.send(text);
  });

  app.delete("/api/artifacts/:id", (req, res) => {
    const id = req.params.id;
    let deleted = false;
    if (projectArtifacts.has(id)) {
      projectArtifacts.delete(id);
      deleted = true;
    }
    try {
      const dbRes = dbDeleteArtifact(id);
      if (dbRes) deleted = true;
    } catch (e) {
      console.warn(`[API] dbDeleteArtifact failed for ${id}:`, e);
    }

    if (deleted) {
      return res.json({ deleted: true, id });
    }
    res.status(404).json({ error: "Artifact not found", type: "not_found" });
  });

  app.patch("/api/artifacts/:id", (req, res) => {
    const art = projectArtifacts.get(req.params.id);
    if (!art) return res.status(404).json({ error: "Artifact not found", type: "not_found" });

    const { filename, description } = req.body || {};
    if (filename) art.filename = String(filename).trim();
    if (description) art.description = String(description).trim();
    art.updatedAt = Date.now();
    res.json({ ok: true, artifact: art });
  });

  app.post("/api/artifacts/:id/apply", (req, res) => {
    const user = resolveUser(req) || initialUser;
    const art = projectArtifacts.get(req.params.id);
    if (!art) return res.status(404).json({ error: "Artifact not found", type: "not_found" });
    if (!art.content) {
      return res.status(400).json({ error: "Only text and code artifacts can be applied to workspace.", type: "invalid_type" });
    }

    const pid = art.projectId;
    const proj = projects.get(pid);
    if (!proj) return res.status(404).json({ error: "Project not found", type: "not_found" });

    // Check if file already exists in project files
    const pFiles = Array.from(files.values()).filter((f) => f.project_id === pid);
    const existing = pFiles.find((f) => f.filename === art.filename || f.filename.endsWith("/" + art.filename));

    if (existing) {
      existing.content = art.content;
      existing.size = Buffer.byteLength(art.content, "utf-8");
    } else {
      const newId = `file_art_${Date.now()}_${Math.random().toString(36).substring(2, 6)}`;
      const newFile: FileItem = {
        id: newId,
        user_id: user.id,
        conversation_id: null,
        project_id: pid,
        filename: art.filename,
        mime: art.mimeType || "text/plain",
        size: Buffer.byteLength(art.content, "utf-8"),
        file_type: "code",
        content: art.content,
        uploaded_at: Math.floor(Date.now() / 1000),
      };
      files.set(newId, newFile);
    }

    art.appliedToProject = true;

    // Re-run project analysis so workspace updates reflect immediately
    const updatedPFiles = Array.from(files.values()).filter((f) => f.project_id === pid);
    const extracted: ExtractedFile[] = updatedPFiles.map((f) => ({
      path: f.filename,
      name: path.basename(f.filename),
      extension: path.extname(f.filename).toLowerCase(),
      size: f.size,
      isBinary: f.file_type === "binary",
      content: f.content,
      lineCount: f.content ? f.content.split(/\r?\n/).length : 0,
    }));
    const updatedAnalysis = refreshProjectIntelligence(pid);

    res.json({ ok: true, message: `Successfully applied ${art.filename} to project workspace!`, analysis: updatedAnalysis });
  });

  // Architecture Advisor: Get Report
  app.get("/api/projects/:pid/advisor", (req, res) => {
    let pid = req.params.pid;
    let proj = projects.get(pid);
    if (!proj && pid !== "global" && projects.size > 0) {
      proj = Array.from(projects.values())[0];
      pid = proj.id;
    }
    if (!proj) return res.status(404).json({ error: "Project not found", type: "not_found" });

    const analysis = refreshProjectIntelligence(pid) || projectAnalyses.get(pid);
    const advisor = analysis?.architecture?.advisor || null;
    res.json({ ok: true, advisor, health: analysis?.architecture?.health });
  });

  function classifyFile(filePath: string): { isBinary: boolean; category: string; language: string } {
    const ext = path.extname(filePath).toLowerCase();
    const binaryExts = [".png", ".jpg", ".jpeg", ".gif", ".webp", ".ico", ".bmp", ".pdf", ".zip", ".tar", ".gz", ".7z", ".exe", ".bin", ".wasm", ".woff", ".woff2", ".ttf", ".eot"];
    const isBinary = binaryExts.includes(ext);
    const category = isBinary ? "binary" : "code";
    const lang = ext.replace(".", "") || "text";
    return { isBinary, category, language: lang };
  }

  function applySingleFixHelper(
    effectivePid: string,
    user: any,
    fixData: { file: string; before?: string; after?: string; explanation?: string }
  ): { ok: boolean; file: string; error?: string } {
    try {
      const { file: targetPath, before, after } = fixData;
      const rawClean = typeof targetPath === "string" ? targetPath.replace(/^[\\\/]+/, "").trim() : "";
      const cleanPath = sanitizeProjectPath(targetPath) || rawClean;
      if (!cleanPath) {
        return { ok: false, file: targetPath || "unknown", error: "Invalid target file path" };
      }
      const safeAfter = typeof after === "string" ? after : typeof before === "string" ? before : "";
      if (!safeAfter && typeof after !== "string") {
        return { ok: false, file: cleanPath, error: "Replacement or creation content ('after') is required" };
      }

      let pFiles = Array.from(files.values()).filter((f) => f.project_id === effectivePid);
      if (pFiles.length === 0 && projects.size > 0) {
        const firstPid = Array.from(projects.keys())[0];
        const pFirst = Array.from(files.values()).filter((f) => f.project_id === firstPid);
        if (pFirst.length > 0) {
          pFiles = pFirst;
          effectivePid = firstPid;
        }
      }

      let targetFile = pFiles.find(
        (f) =>
          f.filename === cleanPath ||
          f.filename.endsWith("/" + cleanPath) ||
          cleanPath.endsWith("/" + f.filename) ||
          cleanPath.endsWith(f.filename) ||
          path.basename(f.filename) === path.basename(cleanPath)
      );

      if (!targetFile) {
        const allFiles = Array.from(files.values());
        targetFile = allFiles.find(
          (f) =>
            f.filename === cleanPath ||
            f.filename.endsWith("/" + cleanPath) ||
            path.basename(f.filename) === path.basename(cleanPath)
        );
        if (targetFile && targetFile.project_id) {
          effectivePid = targetFile.project_id;
        }
      }

      if (targetFile) {
        let currentContent = targetFile.content || "";
        const normContent = currentContent.replace(/\r\n/g, "\n");
        const normBefore = before ? before.replace(/\r\n/g, "\n") : "";

        if (normBefore && normBefore.trim() && normContent.includes(normBefore.trim())) {
          currentContent = normContent.replace(normBefore.trim(), safeAfter.trim());
        } else if (normBefore && normContent.includes(normBefore)) {
          currentContent = normContent.replace(normBefore, safeAfter);
        } else if (safeAfter) {
          if (currentContent.length < 150) {
            currentContent = safeAfter;
          } else {
            if (!currentContent.includes(safeAfter.trim())) {
              currentContent = currentContent.trimEnd() + "\n\n" + safeAfter.trim() + "\n";
            }
          }
        }
        targetFile.content = currentContent;
        targetFile.size = Buffer.byteLength(currentContent, "utf-8");
        try {
          dbUpdateFile(targetFile.id, { content: currentContent, size: targetFile.size });
        } catch (dbErr) {
          console.warn("Could not update file in SQLite db:", dbErr);
        }
      } else {
        // Create new file safely
        const classification = classifyFile(cleanPath);
        const newId = `file_adv_${Date.now()}_${Math.random().toString(36).substring(2, 6)}`;
        targetFile = {
          id: newId,
          user_id: user?.id || initialUser.id,
          conversation_id: null,
          project_id: effectivePid,
          filename: cleanPath,
          mime: classification.isBinary ? "application/octet-stream" : "text/plain",
          size: Buffer.byteLength(safeAfter, "utf-8"),
          file_type: classification.isBinary ? "binary" : "code",
          content: safeAfter,
          uploaded_at: Math.floor(Date.now() / 1000),
        };
        files.set(newId, targetFile);
        try {
          dbCreateFile({
            id: newId,
            project_id: effectivePid,
            path: cleanPath,
            name: path.basename(cleanPath),
            extension: path.extname(cleanPath).toLowerCase(),
            language: path.extname(cleanPath).replace(".", "") || "text",
            size: targetFile.size,
            content: safeAfter,
            is_binary: classification.isBinary,
          });
        } catch (dbErr) {
          console.warn("Could not create file in SQLite db:", dbErr);
        }
      }

      // Persist applied fix to physical disk so that the re-analyzer reads the updated file
      try {
        writeProjectFileToDisk(effectivePid, cleanPath, targetFile.content || "");
      } catch (diskErr) {
        console.warn("Failed to write applied fix to physical disk:", diskErr);
      }

      return { ok: true, file: cleanPath };
    } catch (helperErr: any) {
      console.error("applySingleFixHelper caught error:", helperErr);
      return { ok: false, file: fixData?.file || "unknown", error: helperErr.message || "Error applying fix" };
    }
  }

  // Architecture Advisor: User Approved Fix Application (Single Fix)
  app.post("/api/projects/:pid/advisor/apply-fix", (req, res) => {
    try {
      const user = resolveUser(req) || initialUser;
      const pid = req.params.pid;
      let proj = projects.get(pid);
      if (!proj) {
        const dbP = dbGetProject(pid);
        if (dbP) {
          const meta: any = parseMetadataSafely(dbP.metadata);
          proj = {
            id: dbP.id,
            user_id: meta.user_id || initialUser.id,
            name: dbP.name,
            description: dbP.description || "",
            source: (dbP.source_type as any) || "upload",
            file_count: 0,
            created_at: dbP.created_at,
            updated_at: dbP.updated_at,
          };
          projects.set(pid, proj);
        }
      }
      if (!proj && pid !== "global" && projects.size > 0) {
        proj = Array.from(projects.values())[0];
      }

      const effectivePid = proj ? proj.id : pid;
      const { file: targetPath, before, after, explanation } = req.body || {};
      const result = applySingleFixHelper(effectivePid, user, { file: targetPath, before, after, explanation });
      if (!result.ok) {
        return res.status(400).json({ error: result.error || "Failed to apply fix", type: "invalid_fix" });
      }

      const updatedAnalysis = refreshProjectIntelligence(effectivePid);

      return res.json({
        ok: true,
        message: `Successfully applied architectural fix to ${result.file}`,
        file: result.file,
        analysis: updatedAnalysis,
        explanation: explanation || "Applied repair fix recommended by Architecture Advisor",
      });
    } catch (err: any) {
      console.error("Failed to apply architectural fix:", err);
      return res.status(500).json({
        error: err.message || "Failed to apply architectural fix",
        type: "server_error"
      });
    }
  });

  // Architecture Advisor: Batch Repair All Issues ("Repair all")
  app.post("/api/projects/:pid/advisor/apply-all-fixes", (req, res) => {
    try {
      const user = resolveUser(req) || initialUser;
      const pid = req.params.pid;
      let proj = projects.get(pid);
      if (!proj) {
        const dbP = dbGetProject(pid);
        if (dbP) {
          const meta: any = parseMetadataSafely(dbP.metadata);
          proj = {
            id: dbP.id,
            user_id: meta.user_id || initialUser.id,
            name: dbP.name,
            description: dbP.description || "",
            source: (dbP.source_type as any) || "upload",
            file_count: 0,
            created_at: dbP.created_at,
            updated_at: dbP.updated_at,
          };
          projects.set(pid, proj);
        }
      }
      if (!proj && pid !== "global" && projects.size > 0) {
        proj = Array.from(projects.values())[0];
      }

      const effectivePid = proj ? proj.id : pid;
      let fixesToApply = req.body?.fixes;

      if (!fixesToApply || !Array.isArray(fixesToApply) || fixesToApply.length === 0) {
        let analysis = projectAnalyses.get(effectivePid);
        if (!analysis) {
          analysis = refreshProjectIntelligence(effectivePid) || undefined;
        }
        const issues = analysis?.architecture?.advisor?.issues || [];
        fixesToApply = issues.map((iss: any) => {
          if (iss.fixDiff) return iss.fixDiff;
          return {
            file: iss.targetFile || iss.sourceFile || "server.ts",
            before: iss.sourceSnippet || "",
            after: iss.suggestedImplementation || `// Verified architecture connection for ${iss.title}\n`,
            explanation: iss.explanation || iss.title,
          };
        });
      }

      let appliedCount = 0;
      const results: any[] = [];
      for (const fix of fixesToApply) {
        if (!fix || !fix.file) continue;
        const resObj = applySingleFixHelper(effectivePid, user, fix);
        if (resObj.ok) appliedCount++;
        results.push(resObj);
      }

      const updatedAnalysis = refreshProjectIntelligence(effectivePid);

      return res.json({
        ok: true,
        appliedCount,
        totalAttempted: fixesToApply.length,
        message: `Successfully repaired ${appliedCount} architectural issue${appliedCount === 1 ? "" : "s"}!`,
        analysis: updatedAnalysis,
        results,
      });
    } catch (err: any) {
      console.error("Failed to apply all architectural fixes:", err);
      return res.status(500).json({
        error: err.message || "Failed to batch repair issues",
        type: "server_error"
      });
    }
  });

  // Download All Project Artifacts as ZIP Archive
  app.get("/api/projects/:pid/artifacts/download-all", (req, res) => {
    const pid = req.params.pid;
    const proj = projects.get(pid);
    const arts = Array.from(projectArtifacts.values()).filter((a) => a.projectId === pid);

    if (arts.length === 0) {
      return res.status(404).json({ error: "No artifacts found for this project", type: "not_found" });
    }

    const zip = new AdmZip();
    for (const art of arts) {
      if (art.bufferBase64) {
        const buf = Buffer.from(art.bufferBase64, "base64");
        zip.addFile(art.filename, buf);
      } else {
        const content = art.content || "";
        zip.addFile(art.filename, Buffer.from(content, "utf-8"));
      }
    }

    const zipBuffer = zip.toBuffer();
    const zipName = `${(proj?.name || "project").replace(/[^a-zA-Z0-9_-]/g, "_")}-artifacts.zip`;

    res.setHeader("Content-Disposition", `attachment; filename="${zipName}"`);
    res.setHeader("Content-Type", "application/zip");
    res.setHeader("Content-Length", zipBuffer.length);
    res.send(zipBuffer);
  });

  // Download Selected Artifacts as ZIP
  app.post("/api/artifacts/download-zip", (req, res) => {
    const { artifactIds, zipName } = req.body || {};
    if (!Array.isArray(artifactIds) || artifactIds.length === 0) {
      return res.status(400).json({ error: "artifactIds array is required", type: "invalid_request" });
    }

    const zip = new AdmZip();
    let addedCount = 0;

    for (const id of artifactIds) {
      const art = projectArtifacts.get(id);
      if (art) {
        if (art.bufferBase64) {
          const buf = Buffer.from(art.bufferBase64, "base64");
          zip.addFile(art.filename, buf);
        } else {
          const content = art.content || "";
          zip.addFile(art.filename, Buffer.from(content, "utf-8"));
        }
        addedCount++;
      }
    }

    if (addedCount === 0) {
      return res.status(404).json({ error: "None of the specified artifacts were found", type: "not_found" });
    }

    const zipBuffer = zip.toBuffer();
    const fileName = (zipName || "generated-files.zip").replace(/[^a-zA-Z0-9._-]/g, "_");

    res.setHeader("Content-Disposition", `attachment; filename="${fileName}"`);
    res.setHeader("Content-Type", "application/zip");
    res.setHeader("Content-Length", zipBuffer.length);
    res.send(zipBuffer);
  });

  // Project report & presentation export routes (DOCX, PPTX, PDF, XLSX)
  app.get("/api/projects/:pid/export/docx", async (req, res) => {
    const pid = req.params.pid;
    const proj = projects.get(pid);
    if (!proj) return res.status(404).json({ error: "Project not found", type: "not_found" });

    const pFiles = Array.from(files.values()).filter((f) => f.project_id === pid);
    const extracted: ExtractedFile[] = pFiles.map((f) => ({
      path: f.filename,
      name: path.basename(f.filename),
      extension: path.extname(f.filename).toLowerCase(),
      size: f.size,
      isBinary: f.file_type === "binary",
      content: f.content,
      lineCount: f.content ? f.content.split(/\r?\n/).length : 0,
    }));

    let analysis = projectAnalyses.get(pid);
    if (!analysis) {
      analysis = analyzeProject(proj.name, pid, extracted);
      projectAnalyses.set(pid, analysis);
    }

    try {
      const docxBuf = await generateDocxReport(analysis, extracted);
      const fileName = `${analysis.projectName.toLowerCase().replace(/[^a-z0-9]/g, "_")}_report.docx`;
      res.setHeader("Content-Disposition", `attachment; filename="${fileName}"`);
      res.setHeader("Content-Type", "application/vnd.openxmlformats-officedocument.wordprocessingml.document");
      res.send(docxBuf);
    } catch (err: any) {
      console.error("Export DOCX error:", err);
      res.status(500).json({ error: formatApiError(err) || "Failed to generate DOCX report" });
    }
  });

  app.get("/api/projects/:pid/export/pptx", async (req, res) => {
    const pid = req.params.pid;
    const proj = projects.get(pid);
    if (!proj) return res.status(404).json({ error: "Project not found", type: "not_found" });

    const pFiles = Array.from(files.values()).filter((f) => f.project_id === pid);
    const extracted: ExtractedFile[] = pFiles.map((f) => ({
      path: f.filename,
      name: path.basename(f.filename),
      extension: path.extname(f.filename).toLowerCase(),
      size: f.size,
      isBinary: f.file_type === "binary",
      content: f.content,
      lineCount: f.content ? f.content.split(/\r?\n/).length : 0,
    }));

    let analysis = projectAnalyses.get(pid);
    if (!analysis) {
      analysis = analyzeProject(proj.name, pid, extracted);
      projectAnalyses.set(pid, analysis);
    }

    try {
      const template = (req.query.template as string) || "technical_defense";
      const pptxBuf = await generatePowerPointPresentation(analysis, template, extracted);
      const fileName = `${analysis.projectName.toLowerCase().replace(/[^a-z0-9]/g, "_")}_presentation.pptx`;
      res.setHeader("Content-Disposition", `attachment; filename="${fileName}"`);
      res.setHeader("Content-Type", "application/vnd.openxmlformats-officedocument.presentationml.presentation");
      res.send(pptxBuf);
    } catch (err: any) {
      console.error("Export PPTX error:", err);
      res.status(500).json({ error: formatApiError(err) || "Failed to generate PPTX presentation" });
    }
  });

  app.get("/api/projects/:pid/export/pdf", async (req, res) => {
    const pid = req.params.pid;
    const proj = projects.get(pid);
    if (!proj) return res.status(404).json({ error: "Project not found", type: "not_found" });

    const pFiles = Array.from(files.values()).filter((f) => f.project_id === pid);
    const extracted: ExtractedFile[] = pFiles.map((f) => ({
      path: f.filename,
      name: path.basename(f.filename),
      extension: path.extname(f.filename).toLowerCase(),
      size: f.size,
      isBinary: f.file_type === "binary",
      content: f.content,
      lineCount: f.content ? f.content.split(/\r?\n/).length : 0,
    }));

    let analysis = projectAnalyses.get(pid);
    if (!analysis) {
      analysis = analyzeProject(proj.name, pid, extracted);
      projectAnalyses.set(pid, analysis);
    }

    try {
      const pdfBuf = await generatePdfReport(analysis, extracted);
      const fileName = `${analysis.projectName.toLowerCase().replace(/[^a-z0-9]/g, "_")}_executive_audit.pdf`;
      res.setHeader("Content-Disposition", `attachment; filename="${fileName}"`);
      res.setHeader("Content-Type", "application/pdf");
      res.send(pdfBuf);
    } catch (err: any) {
      console.error("Export PDF error:", err);
      res.status(500).json({ error: formatApiError(err) || "Failed to generate PDF audit report" });
    }
  });

  app.get("/api/projects/:pid/export/xlsx", async (req, res) => {
    const pid = req.params.pid;
    const proj = projects.get(pid);
    if (!proj) return res.status(404).json({ error: "Project not found", type: "not_found" });

    const pFiles = Array.from(files.values()).filter((f) => f.project_id === pid);
    const extracted: ExtractedFile[] = pFiles.map((f) => ({
      path: f.filename,
      name: path.basename(f.filename),
      extension: path.extname(f.filename).toLowerCase(),
      size: f.size,
      isBinary: f.file_type === "binary",
      content: f.content,
      lineCount: f.content ? f.content.split(/\r?\n/).length : 0,
    }));

    let analysis = projectAnalyses.get(pid);
    if (!analysis) {
      analysis = analyzeProject(proj.name, pid, extracted);
      projectAnalyses.set(pid, analysis);
    }

    try {
      const xlsxBuf = await generateExcelWorkbook(analysis, extracted);
      const fileName = `${analysis.projectName.toLowerCase().replace(/[^a-z0-9]/g, "_")}_analysis.xlsx`;
      res.setHeader("Content-Disposition", `attachment; filename="${fileName}"`);
      res.setHeader("Content-Type", "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet");
      res.send(xlsxBuf);
    } catch (err: any) {
      console.error("Export XLSX error:", err);
      res.status(500).json({ error: formatApiError(err) || "Failed to generate Excel workbook" });
    }
  });

  // Project architecture diagram export routes (SVG & high-res PNG)
  app.get(["/api/projects/:pid/export/svg", "/api/projects/:pid/export/diagram.svg"], async (req, res) => {
    const pid = req.params.pid;
    const proj = projects.get(pid);
    if (!proj) return res.status(404).json({ error: "Project not found", type: "not_found" });

    const pFiles = Array.from(files.values()).filter((f) => f.project_id === pid);
    const extracted: ExtractedFile[] = pFiles.map((f) => ({
      path: f.filename,
      name: path.basename(f.filename),
      extension: path.extname(f.filename).toLowerCase(),
      size: f.size,
      isBinary: f.file_type === "binary",
      content: f.content,
      lineCount: f.content ? f.content.split(/\r?\n/).length : 0,
    }));

    let analysis = projectAnalyses.get(pid);
    if (!analysis) {
      analysis = analyzeProject(proj.name, pid, extracted);
      projectAnalyses.set(pid, analysis);
    }

    try {
      const svgStr = generateArchitectureDiagramSvg(analysis);
      const fileName = `${analysis.projectName.toLowerCase().replace(/[^a-z0-9]/g, "_")}_architecture.svg`;
      res.setHeader("Content-Disposition", `attachment; filename="${fileName}"`);
      res.setHeader("Content-Type", "image/svg+xml; charset=utf-8");
      res.send(svgStr);
    } catch (err: any) {
      console.error("Export SVG diagram error:", err);
      res.status(500).json({ error: formatApiError(err) || "Failed to generate SVG architecture diagram" });
    }
  });

  app.get(["/api/projects/:pid/export/png", "/api/projects/:pid/export/diagram.png"], async (req, res) => {
    const pid = req.params.pid;
    const proj = projects.get(pid);
    if (!proj) return res.status(404).json({ error: "Project not found", type: "not_found" });

    const pFiles = Array.from(files.values()).filter((f) => f.project_id === pid);
    const extracted: ExtractedFile[] = pFiles.map((f) => ({
      path: f.filename,
      name: path.basename(f.filename),
      extension: path.extname(f.filename).toLowerCase(),
      size: f.size,
      isBinary: f.file_type === "binary",
      content: f.content,
      lineCount: f.content ? f.content.split(/\r?\n/).length : 0,
    }));

    let analysis = projectAnalyses.get(pid);
    if (!analysis) {
      analysis = analyzeProject(proj.name, pid, extracted);
      projectAnalyses.set(pid, analysis);
    }

    try {
      const svgStr = generateArchitectureDiagramSvg(analysis);
      const pngBuf = renderSvgToPngBuffer(svgStr, 1920);
      const fileName = `${analysis.projectName.toLowerCase().replace(/[^a-z0-9]/g, "_")}_architecture.png`;
      res.setHeader("Content-Disposition", `attachment; filename="${fileName}"`);
      res.setHeader("Content-Type", "image/png");
      res.send(pngBuf);
    } catch (err: any) {
      console.error("Export PNG diagram error:", err);
      res.status(500).json({ error: formatApiError(err) || "Failed to generate PNG architecture diagram" });
    }
  });

  app.get(["/api/projects/:pid/export/jpg", "/api/projects/:pid/export/jpeg", "/api/projects/:pid/export/diagram.jpg"], async (req, res) => {
    const pid = req.params.pid;
    const proj = projects.get(pid);
    if (!proj) return res.status(404).json({ error: "Project not found", type: "not_found" });

    const pFiles = Array.from(files.values()).filter((f) => f.project_id === pid);
    const extracted: ExtractedFile[] = pFiles.map((f) => ({
      path: f.filename,
      name: path.basename(f.filename),
      extension: path.extname(f.filename).toLowerCase(),
      size: f.size,
      isBinary: f.file_type === "binary",
      content: f.content,
      lineCount: f.content ? f.content.split(/\r?\n/).length : 0,
    }));

    let analysis = projectAnalyses.get(pid);
    if (!analysis) {
      analysis = analyzeProject(proj.name, pid, extracted);
      projectAnalyses.set(pid, analysis);
    }

    try {
      const svgStr = generateArchitectureDiagramSvg(analysis);
      const jpgBuf = await renderSvgToJpgBuffer(svgStr, 1920, 92);
      const fileName = `${analysis.projectName.toLowerCase().replace(/[^a-z0-9]/g, "_")}_architecture.jpg`;
      res.setHeader("Content-Disposition", `attachment; filename="${fileName}"`);
      res.setHeader("Content-Type", "image/jpeg");
      res.send(jpgBuf);
    } catch (err: any) {
      console.error("Export JPG diagram error:", err);
      res.status(500).json({ error: formatApiError(err) || "Failed to generate JPG architecture diagram" });
    }
  });

  // Dedicated Render Endpoint for Client-Side Diagrams (Mermaid, Artifacts) to real PNG / JPG binaries
  app.post("/api/diagrams/render-image", async (req, res) => {
    try {
      const { svg, format, filename, width } = req.body || {};
      if (!svg || typeof svg !== "string") {
        return res.status(400).json({ error: "SVG content string is required" });
      }

      const targetFormat = (format === "jpg" || format === "jpeg") ? "jpg" : "png";
      const targetWidth = Math.min(Math.max(Number(width) || 1920, 600), 3840);
      const targetFilename = filename || `clarity_diagram_${Date.now()}.${targetFormat}`;

      if (targetFormat === "jpg") {
        const jpgBuf = await renderSvgToJpgBuffer(svg, targetWidth, 95);
        if (!jpgBuf || jpgBuf.length === 0) {
          throw new Error("Failed to rasterize SVG into JPG");
        }
        res.setHeader("Content-Disposition", `attachment; filename="${targetFilename}"`);
        res.setHeader("Content-Type", "image/jpeg");
        return res.send(jpgBuf);
      } else {
        const pngBuf = renderSvgToPngBuffer(svg, targetWidth);
        if (!pngBuf || pngBuf.length === 0) {
          throw new Error("Failed to rasterize SVG into PNG");
        }
        res.setHeader("Content-Disposition", `attachment; filename="${targetFilename}"`);
        res.setHeader("Content-Type", "image/png");
        return res.send(pngBuf);
      }
    } catch (err: any) {
      console.error("Diagram render-image error:", err);
      res.status(500).json({ error: formatApiError(err) || "Failed to render diagram image" });
    }
  });

  // --- Visual Asset Management & Image Generation API Routes ---
  app.post("/api/projects/:pid/assets/generate-image", async (req, res) => {
    const pid = req.params.pid;
    const proj = projects.get(pid);
    if (!proj) return res.status(404).json({ error: "Project not found", type: "not_found" });

    const { prompt, assetType, aspectRatio, model, sourceImageId } = req.body || {};
    if (!prompt) return res.status(400).json({ error: "Prompt is required" });

    console.log(`[ImagePipeline] imageRequestReceived - UI request for project ${pid} ("${proj.name}"). Prompt: "${prompt.slice(0, 50)}...", Model: ${model || "default"}`);

    const pFiles = Array.from(files.values()).filter((f) => f.project_id === pid);
    const extracted: ExtractedFile[] = pFiles.map((f) => ({
      path: f.filename,
      name: path.basename(f.filename),
      extension: path.extname(f.filename).toLowerCase(),
      size: f.size,
      isBinary: f.file_type === "binary",
      content: f.content,
      lineCount: f.content ? f.content.split(/\r?\n/).length : 0,
    }));

    let analysis = projectAnalyses.get(pid);
    if (!analysis) {
      analysis = analyzeProject(proj.name, pid, extracted);
      projectAnalyses.set(pid, analysis);
    }

    let sourceImageBase64: string | undefined;
    let sourceImageMimeType: string | undefined;
    if (sourceImageId) {
      try {
        const sourceAsset = getVisualAsset(sourceImageId);
        if (sourceAsset) {
          sourceImageBase64 = sourceAsset.contentBase64;
          sourceImageMimeType = sourceAsset.mimeType;
        }
      } catch (err) {
        console.warn(`[API] Failed to fetch source asset ${sourceImageId}:`, err);
      }
    }

    try {
      const result = await generateProjectImage({
        projectId: pid,
        prompt,
        analysis,
        assetType: assetType || "architecture_diagram",
        aspectRatio: aspectRatio || "16:9",
        model: model || "gemini-3.1-flash-lite-image",
        sourceImageBase64,
        sourceImageMimeType,
      });

      const assetId = result.assetId || `vasset_${Date.now()}_${Math.random().toString(36).substring(2, 7)}`;
      saveVisualAsset({
        id: assetId,
        project_id: pid,
        projectId: pid,
        filename: prompt.slice(0, 60),
        asset_type: assetType || "architecture_diagram",
        assetType: assetType || "architecture_diagram",
        prompt: prompt,
        mime_type: result.mimeType,
        mimeType: result.mimeType,
        dimensions: `${result.width}x${result.height}`,
        content_base64: result.bufferBase64,
        contentBase64: result.bufferBase64,
        source: (result.modelUsed && result.modelUsed.includes("gemini")) ? "gemini" : "svg_renderer",
        model: result.modelUsed,
      });

      res.json({
        success: true,
        lastProviderError: result.lastProviderError || null,
        isFallbackUsed: result.isFallbackUsed || false,
        asset: {
          id: assetId,
          projectId: pid,
          title: prompt.slice(0, 60),
          assetType: assetType || "architecture_diagram",
          mimeType: result.mimeType,
          width: result.width,
          height: result.height,
          dataUrl: `data:${result.mimeType};base64,${result.bufferBase64}`,
          modelUsed: result.modelUsed,
          createdAt: Date.now(),
        },
      });
    } catch (err: any) {
      const formattedError = formatApiError(err) || err.message || "Failed to generate visual image asset";
      console.error("[ImagePipeline] Generate visual image error:", formattedError, err);
      res.status(500).json({ error: formattedError, details: String(err) });
    }
  });

  app.get("/api/projects/:pid/assets", async (req, res) => {
    const pid = req.params.pid;
    try {
      const dbAssets = listVisualAssets(pid);
      const assets = dbAssets.map(a => ({
          id: a.id,
          projectId: a.project_id,
          title: a.filename,
          assetType: a.asset_type,
          promptUsed: a.prompt,
          mimeType: a.mime_type,
          contentBase64: a.content_base64,
          createdAt: a.created_at,
      }));
      res.json({ success: true, assets });
    } catch (err: any) {
      console.error("List visual assets error:", err);
      res.status(500).json({ error: formatApiError(err) || "Failed to list visual assets" });
    }
  });

  app.delete("/api/projects/:pid/assets/:id", async (req, res) => {
    try {
      deleteVisualAsset(req.params.id);
      res.json({ success: true, message: "Visual asset deleted successfully" });
    } catch (err: any) {
      res.status(500).json({ error: formatApiError(err) || "Failed to delete visual asset" });
    }
  });

  app.get("/api/projects/:pid/export/xlsx", async (req, res) => {
    const pid = req.params.pid;
    const proj = projects.get(pid);
    if (!proj) return res.status(404).json({ error: "Project not found", type: "not_found" });

    const pFiles = Array.from(files.values()).filter((f) => f.project_id === pid);
    const extracted: ExtractedFile[] = pFiles.map((f) => ({
      path: f.filename,
      name: path.basename(f.filename),
      extension: path.extname(f.filename).toLowerCase(),
      size: f.size,
      isBinary: f.file_type === "binary",
      content: f.content,
      lineCount: f.content ? f.content.split(/\r?\n/).length : 0,
    }));

    let analysis = projectAnalyses.get(pid);
    if (!analysis) {
      analysis = analyzeProject(proj.name, pid, extracted);
      projectAnalyses.set(pid, analysis);
    }

    try {
      const xlsxBuf = await generateExcelWorkbook(analysis, extracted);
      const fileName = `${analysis.projectName.toLowerCase().replace(/[^a-z0-9]/g, "_")}_technical_spec.xlsx`;
      res.setHeader("Content-Disposition", `attachment; filename="${fileName}"`);
      res.setHeader("Content-Type", "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet");
      res.send(xlsxBuf);
    } catch (err: any) {
      console.error("Export XLSX error:", err);
      res.status(500).json({ error: formatApiError(err) || "Failed to generate Excel technical spec" });
    }
  });

  // Project comprehensive report export (Markdown & JSON)
  app.get("/api/projects/:pid/report", (req, res) => {
    const pid = req.params.pid;
    const proj = projects.get(pid);
    if (!proj) return res.status(404).json({ error: "Project not found", type: "not_found" });

    let analysis = projectAnalyses.get(pid);
    if (!analysis) {
      const pFiles = Array.from(files.values()).filter((f) => f.project_id === pid);
      const extracted: ExtractedFile[] = pFiles.map((f) => ({
        path: f.filename,
        name: path.basename(f.filename),
        extension: path.extname(f.filename).toLowerCase(),
        size: f.size,
        isBinary: f.file_type === "binary",
        content: f.content,
        lineCount: f.content ? f.content.split(/\r?\n/).length : 0,
      }));
      analysis = analyzeProject(proj.name, pid, extracted);
      projectAnalyses.set(pid, analysis);
    }

    const mdReport = `# Comprehensive Project Intelligence Report: ${analysis.projectName}
Generated by Clarity Universal Project Understanding Engine

---

## 1. Executive Summary
- **Project Name**: ${analysis.projectName}
- **Project Type**: ${analysis.projectType}
- **Primary Language**: ${analysis.primaryLanguage}
- **Frameworks**: ${analysis.frameworks.join(", ") || "Standard / Vanilla"}
- **Total Files**: ${analysis.fileStats.totalFiles}
- **Total Lines of Code**: ${analysis.fileStats.totalLines}
- **Security Health Score**: ${analysis.securityAnalysis.score}/100
- **Code Quality Score**: ${analysis.codeQuality.score}/100

---

## 2. Language Breakdown
${analysis.languages.map((l) => `- **${l.name}**: ${l.percentage}% (${l.linesCount} lines across ${l.filesCount} files)`).join("\n")}

---

## 3. Architecture & Subsystems
${analysis.architecture.summary}

### Discovered Layers
${analysis.architecture.nodes.map((n) => `### ${n.label} (${n.type})
${n.description}
- **Evidence Files**: ${n.files.map((f) => `\`${f}\``).join(", ")}
`).join("\n")}

---

## 4. End-to-End Data Flow
${analysis.dataFlow.summary}

${analysis.dataFlow.steps.map((s) => `${s.step}. **${s.title}**
   - Flow: \`${s.source}\` → \`${s.target}\`
   - Description: ${s.description}
   - Reference Files: ${s.files.map((f) => `\`${f}\``).join(", ")}
`).join("\n")}

---

## 5. API Intelligence Catalog
${analysis.apiIntelligence.detected
  ? analysis.apiIntelligence.endpoints.map((e) => `### \`${e.method}\` ${e.path}
- File: \`${e.file}:${e.line}\`
- Protected: ${e.authRequired ? "Yes" : "No"}
${e.callers && e.callers.length ? `- Callers: ${e.callers.map((c) => `\`${c}\``).join(", ")}` : ""}
`).join("\n")
  : "_No internal backend endpoints detected._"
}

---

## 6. Database Intelligence
${analysis.databaseIntelligence.description}

${analysis.databaseIntelligence.models.length > 0
  ? `### Discovered Models / Schemas
${analysis.databaseIntelligence.models.map((m) => `- **Model \`${m.name}\`** in \`${m.file}\``).join("\n")}`
  : ""
}

---

## 7. Security Audit Findings
${analysis.securityAnalysis.findings.length > 0
  ? analysis.securityAnalysis.findings.map((f) => `### [${f.severity}] ${f.title}
- **Category**: ${f.category}
- **Location**: \`${f.file}:${f.line}\`
- **Code Evidence**: \`${f.redactedSnippet}\`
- **Impact**: ${f.description}
- **Remediation**: ${f.suggestedFix}
`).join("\n")
  : "_No critical static security vulnerabilities detected._"
}

---

## 8. Code Quality & Maintainability
- **Quality Score**: ${analysis.codeQuality.score}/100
- **Automated Tests**: ${analysis.codeQuality.testing.hasTests ? `Yes (${analysis.codeQuality.testing.testFilesCount} test files)` : "No automated tests detected"}

${analysis.codeQuality.issues.map((i) => `### ${i.title}
- **Location**: \`${i.file}${i.line ? `:${i.line}` : ""}\`
- **Why it matters**: ${i.whyItMatters}
- **Suggested Fix**: ${i.suggestedFix}
`).join("\n")}

---

## 9. Viva / Defense Preparation
${analysis.knowledgeBase.vivaQuestions.map((vq, idx) => `### Q${idx + 1}: ${vq.question}
**Answer**:
${vq.answer}

*Reference Files*: ${vq.relatedFiles.map((f) => `\`${f}\``).join(", ")}
`).join("\n\n")}
`;

    if (req.query.format === "json") {
      return res.json({ analysis, markdown: mdReport });
    }

    res.setHeader("Content-Type", "text/markdown; charset=utf-8");
    res.setHeader("Content-Disposition", `attachment; filename="${analysis.projectName.toLowerCase().replace(/[^a-z0-9]/g, "_")}_report.md"`);
    res.send(mdReport);
  });


  // -------------------------------------------------------------------------
  // CLARITY TERMINAL & RUN ENDPOINTS
  // -------------------------------------------------------------------------
  const previewProxy = httpProxy.createProxyServer({ ws: true });
  previewProxy.on("error", (err, _req, res: any) => {
    if (res.writeHead) {
      res.writeHead(502, { "Content-Type": "text/plain" });
      res.end("Preview service not reachable or still starting: " + err.message);
    }
  });

  app.use("/api/preview/:port", (req, res) => {
    const port = parseInt(req.params.port, 10);
    if (!port || isNaN(port)) return res.status(400).send("Invalid port");
    previewProxy.web(req, res, { target: `http://127.0.0.1:${port}` });
  });

  app.post("/api/projects/:pid/terminals", async (req, res) => {
    try {
      const pid = req.params.pid;
      const { command, title } = req.body;
      
      const dbFiles = dbListFiles(pid);
      const projFiles = dbFiles.map(f => ({ filename: f.path, content: f.content, project_id: f.project_id }));
      syncProjectFiles(pid, projFiles);

      const session = createTerminalSession(pid, command || "bash", title || "Terminal");
      await startTerminalSession(session.id);
      
      res.json(sanitizeSession(session));
    } catch (err: any) {
      res.status(400).json({ error: err.message });
    }
  });

  app.get("/api/projects/:pid/detect", (req, res) => {
    try {
      const pid = req.params.pid;
      const detection = detectProject(pid);
      res.json(detection);
    } catch (err: any) {
      res.status(400).json({ error: err.message });
    }
  });

  app.get("/api/projects/:pid/terminals", (req, res) => {
    const pid = req.params.pid;
    const sessions = getProjectSessions(pid);
    res.json(sessions.map(s => sanitizeSession(s)));
  });

  app.post("/api/terminals/:tid/stop", (req, res) => {
    try {
      const session = stopTerminalSession(req.params.tid);
      // Clean up from memory if explicitly requested (e.g., closing tab)
      if (req.query.delete === 'true') {
          activeSessions.delete(req.params.tid);
      }
      res.json(sanitizeSession(session));
    } catch (err: any) {
      res.status(404).json({ error: err.message });
    }
  });
  
  app.post("/api/terminals/:tid/restart", async (req, res) => {
    try {
      stopTerminalSession(req.params.tid);
      const session = await startTerminalSession(req.params.tid);
      res.json(sanitizeSession(session));
    } catch (err: any) {
      res.status(404).json({ error: err.message });
    }
  });

  app.post("/api/terminals/:tid/input", (req, res) => {
    try {
      if (req.body.input) sendInputToSession(req.params.tid, req.body.input);
      res.json({ ok: true });
    } catch (err: any) {
      res.status(404).json({ error: err.message });
    }
  });

  // Legacy fallback for run buttons
  app.post("/api/projects/:pid/run", async (req, res) => {
      const pid = req.params.pid;
      const dbFiles = dbListFiles(pid);
      const projFiles = dbFiles.map(f => ({ filename: f.path, content: f.content, project_id: f.project_id }));
      syncProjectFiles(pid, projFiles);
      
      let cmd = req.body?.command || "npm run dev";
      const session = createTerminalSession(pid, cmd, "Run Project");
      await startTerminalSession(session.id);
      res.json(sanitizeSession(session));
  });
  
  app.get("/api/projects/:pid/run/status", (req, res) => {
      const pid = req.params.pid;
      const sessions = getProjectSessions(pid);
      if (sessions.length > 0) {
          res.json(sanitizeSession(sessions[sessions.length-1]));
      } else {
          res.json({ status: "idle", logs: [] });
      }
  });

  app.post("/api/projects/:pid/stop", (req, res) => {
      const pid = req.params.pid;
      const sessions = getProjectSessions(pid);
      for (const s of sessions) {
          if (s.status === "running" || s.status === "starting") stopTerminalSession(s.id);
      }
      res.json({ ok: true });
  });

  // Project analysis versions & runs

  app.get("/api/projects/:pid/versions", (_req, res) => {
    res.json({ versions: [] });
  });
  app.post("/api/projects/:pid/versions", (req, res) => {
    res.status(201).json({ id: `ver_${Date.now()}`, project_id: req.params.pid });
  });
  app.get("/api/projects/:pid/runs", (_req, res) => {
    res.json({ runs: [] });
  });
  app.post("/api/projects/:pid/runs", (req, res) => {
    res.status(201).json({ id: `run_${Date.now()}`, project_id: req.params.pid });
  });
  app.get("/api/runs/:run_id", (req, res) => {
    res.json({ id: req.params.run_id, status: "completed", stage: "done" });
  });
  app.patch("/api/runs/:run_id", (req, res) => {
    res.json({ ok: true });
  });

  // -------------------------------------------------------------------------
  // Diagnostic Route (Temporary)
  // -------------------------------------------------------------------------
  app.get("/api/debug/routes", (req, res) => {
    const routes = app._router.stack
      .filter((layer: any) => layer.route)
      .map((layer: any) => ({
        method: Object.keys(layer.route.methods)[0].toUpperCase(),
        path: layer.route.path,
      }));
    res.json(routes);
  });

  console.log("[DEBUG] All routes registered. Route stack:", app._router.stack
    .filter((layer: any) => layer.route)
    .map((layer: any) => `${Object.keys(layer.route.methods)[0].toUpperCase()} ${layer.route.path}`));

  // -------------------------------------------------------------------------
  // Vite Integration (Dev) vs Static Serving (Production)
  // -------------------------------------------------------------------------
  console.log("NODE_ENV is:", process.env.NODE_ENV);
  if (process.env.NODE_ENV !== "production") {
    const { createServer: createViteServer } = await import("vite");
    const vite = await createViteServer({
      server: { middlewareMode: true },
      appType: "spa",
    });
    app.use(vite.middlewares);
  } else {
    const distPath = path.join(process.cwd(), "dist");
    app.use(express.static(distPath));
    app.get("*all", (_req, res) => {
      res.sendFile(path.join(distPath, "index.html"));
    });
  }

  app.listen(PORT, "0.0.0.0", async () => {
    console.log(`Clarity server listening on http://0.0.0.0:${PORT}`);
    if (isSupabaseConfigured()) {
      console.log("[Supabase] Environment credentials loaded.");
      try {
        const report = await verifySupabaseConnection();
        console.log(`[Supabase Status] Connection: ${report.supabaseConnection} | PostgreSQL: ${report.postgreSqlAccess} | Storage: ${report.storageAccess} | Auth: ${report.authIntegration} | Isolation: ${report.userProjectIsolation}`);
        await ensureSupabaseBucketsExist();
      } catch (err) {
        console.warn("[Supabase Startup Error]:", err);
      }
    } else {
      console.log("[Supabase] No SUPABASE_URL / keys detected in process.env. Operating with local SQLite database engine.");
    }
  });
}

const workerExport = {
  async fetch(request: Request, env: any, ctx: any): Promise<Response> {
    const url = new URL(request.url);
    if (url.pathname.startsWith("/api/")) {
      const backendUrl = (env && env.BACKEND_URL) || process.env.BACKEND_URL || "https://clarity-sznp.onrender.com";
      const targetUrl = new URL(url.pathname + url.search, backendUrl);
      const proxyReq = new Request(targetUrl, {
        method: request.method,
        headers: request.headers,
        body: request.method !== "GET" && request.method !== "HEAD" ? request.body : undefined,
        redirect: "manual",
      });
      try {
        const resp = await fetch(proxyReq);
        return resp;
      } catch (err: any) {
        return new Response(JSON.stringify({ error: err.message || "Proxy error" }), {
          status: 502,
          headers: { "Content-Type": "application/json" },
        });
      }
    }

    if (env && env.ASSETS) {
      let res = await env.ASSETS.fetch(request);
      if (res.status === 404) {
        res = await env.ASSETS.fetch(new Request(new URL("/", request.url), request));
      }
      return res;
    }

    return new Response("Not found", { status: 404 });
  }
};

export default workerExport;

if (typeof process !== "undefined" && process.versions && process.versions.node && !(globalThis as any).WebSocketPair) {
  startServer().catch((err) => {
    console.error("Failed to start server:", err);
    process.exit(1);
  });
}
