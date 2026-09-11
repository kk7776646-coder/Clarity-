import { registerProjectAndFileRoutes } from "./project-routes";
import { executeCommand, stopProject, getRunStatus } from "./run-engine.js";
import express from "express";
import cookieParser from "cookie-parser";
import cors from "cors";
import path from "path";
import fs from "fs";
import os from "os";
import crypto from "crypto";
import multer from "multer";
import { createServer as createViteServer } from "vite";
import { GoogleGenAI } from "@google/genai";
import { extractZipSecurely, analyzeProject, ProjectAnalysis, ExtractedFile } from "./project-analyzer";
import { executeGeneration, GeneratedArtifact, detectGenerationIntent } from "./file-generator";
import { executeCopilotTurn } from "./copilot-engine.js";
import { indexProject, updateFileKnowledge, deleteFileKnowledge, getProjectKnowledge, searchKnowledge, deleteProjectKnowledge } from "./knowledge-engine.js";
import { analyzeFileDiagnostics } from "./project-diagnostics";
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
} from "./db.js";
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

// Lazy Gemini client helper & Resilience Layer

function formatApiError(err: any): string {
  if (!err) return "An unknown error occurred";
  let msg = err.message || (typeof err === "string" ? err : JSON.stringify(err));
  
  // Recursively unwrap nested JSON error strings from API responses
  for (let i = 0; i < 4; i++) {
    const jsonMatch = msg.match(/\{[\s\S]*\}/);
    if (!jsonMatch) break;
    try {
      const parsed = JSON.parse(jsonMatch[0]);
      if (parsed.error) {
        if (typeof parsed.error === "string") {
          msg = parsed.error;
        } else if (parsed.error.message) {
          msg = parsed.error.message;
        } else {
          msg = JSON.stringify(parsed.error);
        }
      } else if (parsed.message) {
        msg = parsed.message;
      } else {
        break;
      }
    } catch {
      break;
    }
  }

  const status = String(err.status || err.code || "");
  const combined = `${status} ${msg}`.toLowerCase();

  if (
    combined.includes("503") ||
    combined.includes("unavailable") ||
    combined.includes("high demand") ||
    combined.includes("spikes in demand") ||
    combined.includes("overloaded")
  ) {
    return "The AI model is currently experiencing temporary high demand from the provider. Clarity attempted fallback models, but all are temporarily busy. Please try your message again in a few seconds.";
  }
  if (
    combined.includes("429") ||
    combined.includes("quota") ||
    combined.includes("resource_exhausted") ||
    combined.includes("rate limit")
  ) {
    return "API rate limit or quota exceeded. Please wait a moment before trying again.";
  }
  if (
    combined.includes("401") ||
    combined.includes("403") ||
    combined.includes("invalid api key") ||
    combined.includes("api_key_invalid") ||
    combined.includes("permission_denied")
  ) {
    return "Invalid or unauthorized Gemini API key. Please verify your API key in settings.";
  }
  return msg;
}

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

// Active models in memory (loaded purely from user-configured entries in database)
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

// Seed an initial conversation
const initialConv: ConversationItem = {
  id: "conv_welcome",
  user_id: initialUser.id,
  title: "Welcome to Clarity",
  model_id: "",
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
  model_id: "",
  created_at: Date.now() - 60000,
};
messages.set(welcomeMsg.id, welcomeMsg);

// Hydrate state from persistent SQLite database on boot
function hydrateFromDatabase() {
  try {
    initDatabaseSchema();
    const dbProjects = dbListProjects();
    for (const p of dbProjects) {
      let meta: any = {};
      if (p.metadata) {
        try { meta = JSON.parse(p.metadata); } catch {}
      }
      const pItem: ProjectItem = {
        id: p.id,
        user_id: meta.user_id || initialUser.id,
        name: p.name,
        description: p.description || "",
        source: (p.source_type as any) || "upload",
        project_type: meta.project_type || undefined,
        primary_language: meta.primary_language || undefined,
        file_count: meta.file_count || undefined,
        created_at: p.created_at,
        updated_at: p.updated_at,
        github: meta.github || undefined,
      };
      projects.set(p.id, pItem);

      // Load files for project
      const pFiles = dbListFiles(p.id);
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
        m.id === "clarity-gemini" ||
        m.name === "Gemini 3.6 Flash" ||
        m.model_name === "gemini-3.6-flash" ||
        m.id === "Gemini 3.5 Flash-Lite" ||
        m.name === "Gemini 3.5 Flash-Lite"
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
          model_id: c.model_id === "clarity-gemini" ? "" : (c.model_id || ""),
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
            model_id: m.model_id === "clarity-gemini" ? "" : (m.model_id || ""),
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
        users.set(u.id, {
          id: u.id,
          email: u.email,
          name: u.name,
          password: u.password || "",
          active_model_id: u.active_model_id || "",
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

  app.use(cors({ origin: true, credentials: true }));
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
  // Health
  // -------------------------------------------------------------------------
  app.get("/api/health", (_req, res) => {
    res.json({ status: "ok", service: "clarity" });
  });

  // -------------------------------------------------------------------------
  // Auth API
  // -------------------------------------------------------------------------
  app.get("/api/auth/me", (req, res) => {
    const user = resolveUser(req);
    if (!user) {
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

  app.post("/api/models/set-active", (req, res) => {
    const user = resolveUser(req) || initialUser;
    const { model_id } = req.body || {};
    if (!model_id || !models.has(model_id)) {
      return res.status(404).json({ error: `Model '${model_id}' not found`, type: "model_not_found" });
    }
    user.active_model_id = model_id;
    res.json({ ok: true, active: model_id, model: publicModel(models.get(model_id)!) });
  });

  app.post("/api/models/test", async (req, res) => {
    const body = req.body || {};
    const mid = String(body.id || "").trim();
    const m = models.get(mid) || body;
    const provider = String(m.provider || "").toLowerCase();
    
    if (provider === "gemini") {
      try {
        const apiKey = m.apiKey || process.env.GEMINI_API_KEY || process.env.GOOGLE_API_KEY;
        if (!apiKey) return res.status(400).json({ error: "API Key required for Gemini." });
        const testModel = m.modelName;
        if (!testModel) return res.status(400).json({ error: "Model name/ID is required." });
        const ai = new GoogleGenAI({ apiKey });
        await ai.models.generateContent({
          model: testModel,
          contents: "ping",
        });
        return res.json({ ok: true, message: `Gemini connection verified using ${testModel}` });
      } catch (err: any) {
        return res.status(400).json({ error: `Connection failed: ${formatApiError(err)}` });
      }
    }
    
    try {
      const baseUrl = m.baseUrl;
      if (!baseUrl) return res.status(400).json({ error: "Base URL is required." });
      const headers: Record<string, string> = { "Content-Type": "application/json" };
      if (m.apiKey) headers["Authorization"] = `Bearer ${m.apiKey}`;
      const response = await fetch(`${baseUrl.replace(/\/$/, "")}/models`, { method: "GET", headers });
      if (!response.ok) {
         throw new Error(`HTTP ${response.status}: ${await response.text()}`);
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
    const list = Array.from(conversations.values())
      .filter((c) => c.user_id === user.id)
      .sort((a, b) => b.updated_at - a.updated_at);
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
    const conv = conversations.get(cid);
    if (!conv) return res.status(404).json({ error: "Conversation not found", type: "not_found" });
    const convMessages = Array.from(messages.values())
      .filter((m) => m.conversation_id === cid)
      .sort((a, b) => a.created_at - b.created_at);
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

    const { message, file_ids, project_id, model_id } = req.body || {};
    const textMsg = String(message || "").trim();
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
    const activeModelId = modelConfig.id;
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

    // Gather knowledge context from attached files or shared files
    let knowledgeContext = "";
    if (Array.isArray(file_ids) && file_ids.length > 0) {
      for (const fid of file_ids) {
        const fileObj = files.get(fid);
        if (fileObj && fileObj.content) {
          knowledgeContext += `\n\n[File: ${fileObj.filename}]\n${fileObj.content.substring(0, 5000)}`;
        }
      }
    }

    if (project_id && (projectAnalyses.has(project_id) || dbGetProjectAnalysis(project_id))) {
      const pa = projectAnalyses.get(project_id) || dbGetProjectAnalysis(project_id)!;
      knowledgeContext += `\n\n[Active Project: ${pa.projectName} (${pa.projectType})]\n` +
        `Primary Language: ${pa.primaryLanguage}\n` +
        `Summary: ${pa.summary}\n` +
        `Architecture: ${pa.architecture?.summary || "N/A"}\n` +
        `Endpoints: ${(pa.apiIntelligence?.endpoints || []).map((e) => `${e.method} ${e.path} (${e.file})`).slice(0, 8).join(", ")}\n` +
        `Database: ${pa.databaseIntelligence?.description || "N/A"}`;
    }

    // Also check shared knowledge files
    const sharedFiles = Array.from(files.values()).filter((f) => !f.conversation_id && !f.project_id);
    if (sharedFiles.length > 0 && !knowledgeContext) {
      knowledgeContext = `\n\n[Indexed Knowledge Documents in Workspace: ${sharedFiles.map((f) => f.filename).join(", ")}]`;
    }

    const promptWithContext = knowledgeContext
      ? `You have access to the following knowledge context:${knowledgeContext}\n\nUser Question: ${textMsg}`
      : textMsg;

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

        const ai = new GoogleGenAI({ apiKey });
        const responseStream = await ai.models.generateContentStream({
          model: modelConfig.modelName,
          contents,
          config: {
            systemInstruction: "You are Clarity, an intelligent AI assistant grounded in the user's personal and organizational knowledge. You provide crisp, well-structured, clear, and actionable answers with code blocks and formatting where appropriate.",
          },
        });

        for await (const chunk of responseStream) {
          const text = chunk.text || "";
          if (text) {
            assistantText += text;
            sendSSE({ content: text });
          }
        }
      } else {
        // OpenAI compatible endpoint
        const baseUrl = modelConfig.baseUrl;
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
            { role: "system", content: "You are Clarity, an intelligent AI assistant grounded in the user's personal and organizational knowledge." },
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
      console.error("Chat generation error:", err);
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
    let knowledgeContext = "";
    if (req.body?.project_id && (projectAnalyses.has(req.body.project_id) || dbGetProjectAnalysis(req.body.project_id))) {
      const pa = projectAnalyses.get(req.body.project_id) || dbGetProjectAnalysis(req.body.project_id)!;
      knowledgeContext += `\n\n[Active Project: ${pa.projectName} (${pa.projectType})]\n` +
        `Primary Language: ${pa.primaryLanguage}\n` +
        `Summary: ${pa.summary}\n` +
        `Architecture: ${pa.architecture?.summary || "N/A"}\n` +
        `Endpoints: ${(pa.apiIntelligence?.endpoints || []).map((e) => `${e.method} ${e.path} (${e.file})`).slice(0, 8).join(", ")}\n` +
        `Database: ${pa.databaseIntelligence?.description || "N/A"}`;
    }

    const sharedFiles = Array.from(files.values()).filter((f) => !f.conversation_id && !f.project_id);
    if (sharedFiles.length > 0 && !knowledgeContext) {
      knowledgeContext = `\n\n[Indexed Knowledge Documents in Workspace: ${sharedFiles.map((f) => f.filename).join(", ")}]`;
    }

    const promptWithContext = knowledgeContext
      ? `You have access to the following knowledge context:${knowledgeContext}\n\nUser Question: ${textMsg}`
      : textMsg;

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
    const activeModelId = modelConfig.id;
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

        const ai = new GoogleGenAI({ apiKey });
        const responseStream = await ai.models.generateContentStream({
          model: modelConfig.modelName,
          contents,
          config: {
            systemInstruction: "You are Clarity, an intelligent AI assistant grounded in the user's personal and organizational knowledge. You provide crisp, well-structured, clear, and actionable answers with code blocks and formatting where appropriate.",
          },
        });

        for await (const chunk of responseStream) {
          const text = chunk.text || "";
          if (text) {
            assistantText += text;
            sendSSE({ content: text });
          }
        }
      } else {
        // OpenAI compatible endpoint
        const baseUrl = modelConfig.baseUrl;
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
            { role: "system", content: "You are Clarity, an intelligent AI assistant grounded in the user's personal and organizational knowledge." },
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
      console.error("Chat regeneration error:", err);
      sendSSE({ error: { message: formatApiError(err) || "Failed to regenerate AI response", type: "chat_error" } });
      res.end();
    }
  });

  // Register Full Project, File Explorer, Uploads, Diagnostics & Knowledge RAG Routes
  registerProjectAndFileRoutes(app, projects, files, projectAnalyses, resolveUser, initialUser);

  // -------------------------------------------------------------------------
  // Universal File & Asset Generation Engine Endpoints (Step 3)
  // -------------------------------------------------------------------------
  


  app.get("/api/projects", (req, res) => {
    const user = resolveUser(req) || initialUser;
    // Always sync with SQLite database to make sure newly imported/persisted projects are visible
    try {
      const dbProjects = dbListProjects();
      for (const p of dbProjects) {
        if (!projects.has(p.id)) {
          let meta: any = {};
          if (p.metadata) {
            try { meta = JSON.parse(p.metadata); } catch {}
          }
          projects.set(p.id, {
            id: p.id,
            user_id: meta.user_id || user.id,
            name: p.name,
            description: p.description || meta.description || "",
            source: (p.source_type as any) || meta.source || "upload",
            project_type: meta.project_type || undefined,
            primary_language: meta.primary_language || undefined,
            file_count: meta.file_count || undefined,
            created_at: p.created_at,
            updated_at: p.updated_at,
            github: meta.github || undefined,
          });
        }
      }
    } catch (e) {
      console.error("Error listing projects from DB:", e);
    }
    const userProjects = Array.from(projects.values()).filter(p => !p.user_id || p.user_id === user.id || user.id === initialUser.id);
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
    
    const { message, model_id } = req.body || {};
    const textMsg = String(message || "").trim();
    if (!textMsg) {
      return res.status(400).json({ error: "Message is required", type: "invalid_request" });
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
      const hasGenIntent = /(create|generate|make|build|export|modify|fix|refactor|add|write|code).*(\.\w+|python|javascript|typescript|html|css|java|cpp|c\+\+|c#|csharp|php|sql|json|yaml|yml|md|markdown|jupyter|notebook|word|document|docx|excel|xlsx|spreadsheet|presentation|pptx|powerpoint|pdf|csv|diagram|architecture|file|component|feature|report|program|app|application|script|code|website|page)/i.test(textMsg);
      
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
      
      if (hasGenIntent) {
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
        if (modelConfig.provider === "gemini") {
          const apiKey = modelConfig.apiKey || process.env.GEMINI_API_KEY || process.env.GOOGLE_API_KEY;
          if (!apiKey) throw new Error("AI client not available. API key is missing.");
          const ai = new GoogleGenAI({ apiKey });
          const responseStream = await ai.models.generateContentStream({
            model: modelConfig.modelName,
            contents: [{ role: "user", parts: [{ text: textMsg }] }],
            config: {
              systemInstruction: "You are Clarity, an AI assistant analyzing a project.",
            },
          });
          for await (const chunk of responseStream) {
            const chunkText = chunk.text || "";
            if (chunkText) {
              sendSSE({ content: chunkText });
            }
          }
        } else {
          // OpenAI compatible endpoint
          const baseUrl = modelConfig.baseUrl;
          if (!baseUrl) throw new Error("Base URL is missing for this model.");
          const headers: Record<string, string> = { "Content-Type": "application/json" };
          if (modelConfig.apiKey) headers["Authorization"] = `Bearer ${modelConfig.apiKey}`;
          const resOpenAi = await fetch(`${baseUrl.replace(/\/$/, "")}/chat/completions`, {
            method: "POST",
            headers,
            body: JSON.stringify({
              model: modelConfig.modelName || "gpt-3.5-turbo",
              messages: [
                { role: "system", content: "You are Clarity, an AI assistant analyzing a project." },
                { role: "user", content: textMsg },
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
      sendSSE({ done: true, artifacts: generatedArtifacts });
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

    const { prompt, targetFile, model_id } = req.body || {};
    if (!prompt) return res.status(400).json({ error: "Prompt is required", type: "invalid_request" });

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

    const modelConfig = resolveModelConfig(model_id || user.active_model_id, user.id);
    const gemClient = modelConfig && modelConfig.provider === "gemini" && (modelConfig.apiKey || process.env.GEMINI_API_KEY || process.env.GOOGLE_API_KEY)
      ? new GoogleGenAI({ apiKey: modelConfig.apiKey || process.env.GEMINI_API_KEY || process.env.GOOGLE_API_KEY })
      : null;

    try {
      const result = await executeGeneration({
        prompt: String(prompt).trim(),
        projectId: pid,
        userId: user.id,
        analysis,
        files: extracted,
        geminiClient: gemClient,
        modelName: modelConfig?.modelName,
        targetFile,
      });

      if (result.success && result.artifacts.length > 0) {
        for (const art of result.artifacts) {
          projectArtifacts.set(art.id, art);
        }
      }

      res.json(result);
    } catch (err: any) {
      console.error("Generate error:", err);
      res.status(500).json({ error: formatApiError(err) || "Failed to generate artifact", type: "generation_error" });
    }
  });

  app.get("/api/projects/:pid/artifacts", (req, res) => {
    const pid = req.params.pid;
    const arts = Array.from(projectArtifacts.values())
      .filter((a) => a.projectId === pid)
      .sort((a, b) => b.createdAt - a.createdAt);
    res.json({ artifacts: arts });
  });

  app.get("/api/artifacts/:id", (req, res) => {
    const art = projectArtifacts.get(req.params.id);
    if (!art) return res.status(404).json({ error: "Artifact not found", type: "not_found" });
    res.json({ artifact: art });
  });

  app.get("/api/artifacts/:id/download", (req, res) => {
    const art = projectArtifacts.get(req.params.id);
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
    if (projectArtifacts.has(id)) {
      projectArtifacts.delete(id);
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
    const pid = req.params.pid;
    const proj = projects.get(pid);
    if (!proj) return res.status(404).json({ error: "Project not found", type: "not_found" });

    let analysis = projectAnalyses.get(pid);
    if (!analysis) {
      analysis = refreshProjectIntelligence(pid) || undefined;
    }
    const advisor = analysis?.architecture?.advisor || null;
    res.json({ ok: true, advisor, health: analysis?.architecture?.health });
  });

  // Architecture Advisor: User Approved Fix Application
  app.post("/api/projects/:pid/advisor/apply-fix", (req, res) => {
    const user = resolveUser(req) || initialUser;
    const pid = req.params.pid;
    const proj = projects.get(pid);
    if (!proj) return res.status(404).json({ error: "Project not found", type: "not_found" });

    const { file: targetPath, before, after, explanation } = req.body || {};
    const cleanPath = sanitizeProjectPath(targetPath);
    if (!cleanPath) {
      return res.status(400).json({ error: "Invalid target file path", type: "invalid_path" });
    }
    if (typeof after !== "string") {
      return res.status(400).json({ error: "Replacement or creation content ('after') is required", type: "invalid_content" });
    }

    const pFiles = Array.from(files.values()).filter((f) => f.project_id === pid);
    let targetFile = pFiles.find((f) => f.filename === cleanPath || f.filename.endsWith("/" + cleanPath));

    if (targetFile) {
      let currentContent = targetFile.content || "";
      if (before && typeof before === "string" && before.trim() && currentContent.includes(before.trim())) {
        currentContent = currentContent.replace(before.trim(), after.trim());
      } else if (before && currentContent.includes(before)) {
        currentContent = currentContent.replace(before, after);
      } else {
        // Append cleanly
        currentContent = currentContent.trimEnd() + "\n\n" + after.trim() + "\n";
      }
      targetFile.content = currentContent;
      targetFile.size = Buffer.byteLength(currentContent, "utf-8");
    } else {
      // Create new file
      const classification = classifyFile(cleanPath);
      const newId = `file_adv_${Date.now()}_${Math.random().toString(36).substring(2, 6)}`;
      targetFile = {
        id: newId,
        user_id: user.id,
        conversation_id: null,
        project_id: pid,
        filename: cleanPath,
        mime: classification.isBinary ? "application/octet-stream" : "text/plain",
        size: Buffer.byteLength(after, "utf-8"),
        file_type: "code",
        content: after,
        uploaded_at: Math.floor(Date.now() / 1000),
      };
      files.set(newId, targetFile);
    }

    const updatedAnalysis = refreshProjectIntelligence(pid);

    res.json({
      ok: true,
      message: `Successfully applied architectural fix to ${cleanPath}`,
      file: cleanPath,
      analysis: updatedAnalysis,
      explanation: explanation || "Applied repair fix recommended by Architecture Advisor",
    });
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
  // RUN & TEST ENGINE ENDPOINTS
  // -------------------------------------------------------------------------

  app.post("/api/projects/:pid/run", async (req, res) => {
    try {
      const pid = req.params.pid;
      const projFiles = Array.from(files.values()).filter((f) => f.project_id === pid);
      if (projFiles.length === 0) return res.status(404).json({ error: "Project not found or empty" });
      const status = await executeCommand(pid, projFiles, "run", req.body?.command);
      res.json(status);
    } catch (err: any) {
      res.status(400).json({ error: err.message });
    }
  });

  app.post("/api/projects/:pid/build", async (req, res) => {
    try {
      const pid = req.params.pid;
      const projFiles = Array.from(files.values()).filter((f) => f.project_id === pid);
      if (projFiles.length === 0) return res.status(404).json({ error: "Project not found or empty" });
      const status = await executeCommand(pid, projFiles, "build", req.body?.command);
      res.json(status);
    } catch (err: any) {
      res.status(400).json({ error: err.message });
    }
  });

  app.post("/api/projects/:pid/test", async (req, res) => {
    try {
      const pid = req.params.pid;
      const projFiles = Array.from(files.values()).filter((f) => f.project_id === pid);
      if (projFiles.length === 0) return res.status(404).json({ error: "Project not found or empty" });
      const status = await executeCommand(pid, projFiles, "test", req.body?.command);
      res.json(status);
    } catch (err: any) {
      res.status(400).json({ error: err.message });
    }
  });

  app.post("/api/projects/:pid/stop", (req, res) => {
    const pid = req.params.pid;
    const status = stopProject(pid);
    res.json(status);
  });

  app.get("/api/projects/:pid/run/status", (req, res) => {
    const pid = req.params.pid;
    const status = getRunStatus(pid);
    res.json(status);
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
  // Vite Integration (Dev) vs Static Serving (Production)
  // -------------------------------------------------------------------------
  if (process.env.NODE_ENV !== "production") {
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

  app.listen(PORT, "0.0.0.0", () => {
    console.log(`Clarity server listening on http://0.0.0.0:${PORT}`);
  });
}

startServer().catch((err) => {
  console.error("Failed to start server:", err);
  process.exit(1);
});
