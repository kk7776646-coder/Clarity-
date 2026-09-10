import { DatabaseSync } from "node:sqlite";
import fs from "fs";
import path from "path";

// Ensure data directory exists
const DATA_DIR = path.join(process.cwd(), "data");
if (!fs.existsSync(DATA_DIR)) {
  fs.mkdirSync(DATA_DIR, { recursive: true });
}

const DB_PATH = process.env.CLARITY_DB_PATH || path.join(DATA_DIR, "clarity.db");

// Initialize Database connection
export const db = new DatabaseSync(DB_PATH);

// Enable WAL mode and foreign keys
db.exec("PRAGMA journal_mode = WAL;");
db.exec("PRAGMA foreign_keys = ON;");
db.exec("PRAGMA synchronous = NORMAL;");

/**
 * Execute a function within an ACID transaction
 */
export function runTransaction<T>(fn: () => T): T {
  db.exec("BEGIN TRANSACTION;");
  try {
    const result = fn();
    db.exec("COMMIT;");
    return result;
  } catch (err) {
    try {
      db.exec("ROLLBACK;");
    } catch (rbErr) {
      console.error("Rollback failed:", rbErr);
    }
    throw err;
  }
}

/**
 * Initialize / verify database schema and migrations
 */
export function initDatabaseSchema() {
  runTransaction(() => {
    // 1. Projects
    db.exec(`
      CREATE TABLE IF NOT EXISTS projects (
        id TEXT PRIMARY KEY,
        name TEXT NOT NULL,
        description TEXT,
        source_type TEXT DEFAULT 'upload',
        root_path TEXT,
        status TEXT DEFAULT 'ready',
        created_at INTEGER NOT NULL,
        updated_at INTEGER NOT NULL,
        last_indexed_at INTEGER,
        metadata TEXT
      );
      CREATE INDEX IF NOT EXISTS idx_projects_updated ON projects(updated_at);
    `);

    // 2. Project Files
    db.exec(`
      CREATE TABLE IF NOT EXISTS project_files (
        id TEXT PRIMARY KEY,
        project_id TEXT NOT NULL,
        path TEXT NOT NULL,
        name TEXT NOT NULL,
        extension TEXT,
        language TEXT,
        size INTEGER DEFAULT 0,
        hash TEXT,
        version INTEGER DEFAULT 1,
        content TEXT,
        is_binary INTEGER DEFAULT 0,
        created_at INTEGER NOT NULL,
        updated_at INTEGER NOT NULL,
        FOREIGN KEY (project_id) REFERENCES projects(id) ON DELETE CASCADE
      );
      CREATE INDEX IF NOT EXISTS idx_project_files_proj ON project_files(project_id);
      CREATE INDEX IF NOT EXISTS idx_project_files_path ON project_files(project_id, path);
      CREATE INDEX IF NOT EXISTS idx_project_files_hash ON project_files(hash);
    `);

    // 3. Artifacts
    db.exec(`
      CREATE TABLE IF NOT EXISTS artifacts (
        id TEXT PRIMARY KEY,
        project_id TEXT NOT NULL,
        file_id TEXT,
        name TEXT NOT NULL,
        path TEXT,
        mime_type TEXT,
        artifact_type TEXT,
        version INTEGER DEFAULT 1,
        hash TEXT,
        content TEXT,
        created_at INTEGER NOT NULL,
        updated_at INTEGER NOT NULL,
        FOREIGN KEY (project_id) REFERENCES projects(id) ON DELETE CASCADE
      );
      CREATE INDEX IF NOT EXISTS idx_artifacts_proj ON artifacts(project_id);
    `);

    // 4. Knowledge Chunks
    db.exec(`
      CREATE TABLE IF NOT EXISTS knowledge_chunks (
        id TEXT PRIMARY KEY,
        project_id TEXT NOT NULL,
        file_id TEXT,
        chunk_id TEXT,
        content TEXT NOT NULL,
        chunk_type TEXT,
        symbol TEXT,
        start_line INTEGER,
        end_line INTEGER,
        hash TEXT,
        version INTEGER DEFAULT 1,
        created_at INTEGER NOT NULL,
        updated_at INTEGER NOT NULL,
        FOREIGN KEY (project_id) REFERENCES projects(id) ON DELETE CASCADE
      );
      CREATE INDEX IF NOT EXISTS idx_knowledge_chunks_proj ON knowledge_chunks(project_id);
      CREATE INDEX IF NOT EXISTS idx_knowledge_chunks_file ON knowledge_chunks(file_id);
      CREATE INDEX IF NOT EXISTS idx_knowledge_chunks_hash ON knowledge_chunks(hash);
    `);

    // 5. Architecture Nodes
    db.exec(`
      CREATE TABLE IF NOT EXISTS architecture_nodes (
        id TEXT PRIMARY KEY,
        project_id TEXT NOT NULL,
        node_type TEXT,
        name TEXT NOT NULL,
        file_id TEXT,
        metadata TEXT,
        FOREIGN KEY (project_id) REFERENCES projects(id) ON DELETE CASCADE
      );
      CREATE INDEX IF NOT EXISTS idx_arch_nodes_proj ON architecture_nodes(project_id);
    `);

    // 6. Architecture Edges
    db.exec(`
      CREATE TABLE IF NOT EXISTS architecture_edges (
        id TEXT PRIMARY KEY,
        project_id TEXT NOT NULL,
        source_node_id TEXT NOT NULL,
        target_node_id TEXT NOT NULL,
        relationship TEXT,
        confidence REAL DEFAULT 1.0,
        evidence TEXT,
        FOREIGN KEY (project_id) REFERENCES projects(id) ON DELETE CASCADE
      );
      CREATE INDEX IF NOT EXISTS idx_arch_edges_proj ON architecture_edges(project_id);
    `);

    // 7. Diagnostics
    db.exec(`
      CREATE TABLE IF NOT EXISTS diagnostics (
        id TEXT PRIMARY KEY,
        project_id TEXT NOT NULL,
        file_id TEXT,
        severity TEXT,
        category TEXT,
        message TEXT NOT NULL,
        line INTEGER,
        column INTEGER,
        status TEXT DEFAULT 'open',
        created_at INTEGER NOT NULL,
        FOREIGN KEY (project_id) REFERENCES projects(id) ON DELETE CASCADE
      );
      CREATE INDEX IF NOT EXISTS idx_diagnostics_proj ON diagnostics(project_id);
    `);

    // 8. Test Runs
    db.exec(`
      CREATE TABLE IF NOT EXISTS test_runs (
        id TEXT PRIMARY KEY,
        project_id TEXT NOT NULL,
        command TEXT,
        status TEXT,
        output TEXT,
        started_at INTEGER NOT NULL,
        finished_at INTEGER,
        FOREIGN KEY (project_id) REFERENCES projects(id) ON DELETE CASCADE
      );
      CREATE INDEX IF NOT EXISTS idx_test_runs_proj ON test_runs(project_id);
    `);

    // 9. GitHub Connections
    db.exec(`
      CREATE TABLE IF NOT EXISTS github_connections (
        id TEXT PRIMARY KEY,
        project_id TEXT NOT NULL,
        repository TEXT NOT NULL,
        branch TEXT NOT NULL,
        sync_status TEXT DEFAULT 'synced',
        last_synced_at INTEGER,
        metadata TEXT,
        FOREIGN KEY (project_id) REFERENCES projects(id) ON DELETE CASCADE
      );
      CREATE INDEX IF NOT EXISTS idx_github_conn_proj ON github_connections(project_id);
    `);

    // 10. Project Analyses (Structured JSON payload)
    db.exec(`
      CREATE TABLE IF NOT EXISTS project_analyses (
        project_id TEXT PRIMARY KEY,
        summary TEXT,
        project_type TEXT,
        primary_language TEXT,
        analysis_json TEXT NOT NULL,
        updated_at INTEGER NOT NULL,
        FOREIGN KEY (project_id) REFERENCES projects(id) ON DELETE CASCADE
      );
    `);

    // 11. Conversations
    db.exec(`
      CREATE TABLE IF NOT EXISTS conversations (
        id TEXT PRIMARY KEY,
        user_id TEXT NOT NULL,
        project_id TEXT,
        title TEXT NOT NULL,
        model_id TEXT,
        created_at INTEGER NOT NULL,
        updated_at INTEGER NOT NULL
      );
      CREATE INDEX IF NOT EXISTS idx_conversations_user ON conversations(user_id);
      CREATE INDEX IF NOT EXISTS idx_conversations_proj ON conversations(project_id);
    `);

    // 12. Messages
    db.exec(`
      CREATE TABLE IF NOT EXISTS messages (
        id TEXT PRIMARY KEY,
        conversation_id TEXT NOT NULL,
        role TEXT NOT NULL,
        content TEXT NOT NULL,
        model_id TEXT,
        attachments TEXT,
        created_at INTEGER NOT NULL,
        FOREIGN KEY (conversation_id) REFERENCES conversations(id) ON DELETE CASCADE
      );
      CREATE INDEX IF NOT EXISTS idx_messages_conv ON messages(conversation_id);
    `);

    // 13. Workspace Files (General uploads)
    db.exec(`
      CREATE TABLE IF NOT EXISTS workspace_files (
        id TEXT PRIMARY KEY,
        user_id TEXT NOT NULL,
        filename TEXT NOT NULL,
        mime TEXT,
        size INTEGER DEFAULT 0,
        file_type TEXT,
        content TEXT,
        uploaded_at INTEGER NOT NULL
      );
      CREATE INDEX IF NOT EXISTS idx_workspace_files_user ON workspace_files(user_id);
    `);

    // 14. Users
    db.exec(`
      CREATE TABLE IF NOT EXISTS users (
        id TEXT PRIMARY KEY,
        email TEXT NOT NULL,
        name TEXT NOT NULL,
        password TEXT,
        active_model_id TEXT,
        created_at INTEGER NOT NULL
      );
    `);

    // 15. Models
    db.exec(`
      CREATE TABLE IF NOT EXISTS models (
        id TEXT PRIMARY KEY,
        name TEXT NOT NULL,
        provider TEXT NOT NULL,
        base_url TEXT,
        api_key TEXT,
        model_name TEXT NOT NULL,
        model_type TEXT,
        capabilities TEXT,
        context_window INTEGER,
        max_output_tokens INTEGER,
        default_temperature REAL,
        default_top_p REAL,
        supports_streaming INTEGER DEFAULT 1,
        enabled INTEGER DEFAULT 1,
        status TEXT,
        is_user INTEGER DEFAULT 0
      );
    `);
  });
}

// ---------------------------------------------------------------------------
// Typed CRUD Interface & Services
// ---------------------------------------------------------------------------

export interface DbProject {
  id: string;
  name: string;
  description: string;
  source_type: string;
  root_path: string | null;
  status: string;
  created_at: number;
  updated_at: number;
  last_indexed_at: number | null;
  metadata: string | null; // JSON string
}

export interface DbProjectFile {
  id: string;
  project_id: string;
  path: string;
  name: string;
  extension: string;
  language: string;
  size: number;
  hash: string;
  version: number;
  content: string;
  is_binary: number;
  created_at: number;
  updated_at: number;
}

export interface DbArtifact {
  id: string;
  project_id: string;
  file_id: string | null;
  name: string;
  path: string | null;
  mime_type: string | null;
  artifact_type: string | null;
  version: number;
  hash: string | null;
  content: string | null;
  created_at: number;
  updated_at: number;
}

export interface DbKnowledgeChunk {
  id: string;
  project_id: string;
  file_id: string;
  chunk_id: string;
  content: string;
  chunk_type: string;
  symbol: string;
  start_line: number;
  end_line: number;
  hash: string;
  version: number;
  created_at: number;
  updated_at: number;
}

export interface DbArchitectureNode {
  id: string;
  project_id: string;
  node_type: string;
  name: string;
  file_id: string | null;
  metadata: string | null;
}

export interface DbArchitectureEdge {
  id: string;
  project_id: string;
  source_node_id: string;
  target_node_id: string;
  relationship: string;
  confidence: number;
  evidence: string | null;
}

export interface DbDiagnostic {
  id: string;
  project_id: string;
  file_id: string | null;
  severity: string;
  category: string;
  message: string;
  line: number | null;
  column: number | null;
  status: string;
  created_at: number;
}

// ---------------------------------------------------------------------------
// Projects Service
// ---------------------------------------------------------------------------
export function createProject(project: {
  id: string;
  name: string;
  description?: string;
  source_type?: string;
  root_path?: string | null;
  status?: string;
  created_at?: number;
  updated_at?: number;
  metadata?: any;
}): DbProject {
  const now = Date.now();
  const created = project.created_at || now;
  const updated = project.updated_at || now;
  const metaStr = project.metadata ? JSON.stringify(project.metadata) : null;

  const stmt = db.prepare(`
    INSERT INTO projects (id, name, description, source_type, root_path, status, created_at, updated_at, metadata)
    VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?)
  `);

  stmt.run(
    project.id,
    project.name,
    project.description || "",
    project.source_type || "upload",
    project.root_path || null,
    project.status || "ready",
    created,
    updated,
    metaStr
  );

  return getProject(project.id)!;
}

export function getProject(id: string): DbProject | null {
  const stmt = db.prepare("SELECT * FROM projects WHERE id = ?");
  const row = stmt.get(id) as any;
  if (!row) return null;
  return row as DbProject;
}

export function listProjects(): DbProject[] {
  const stmt = db.prepare("SELECT * FROM projects ORDER BY updated_at DESC");
  return (stmt.all() as any[]) as DbProject[];
}

export function updateProject(
  id: string,
  updates: Partial<Omit<DbProject, "id" | "created_at">> & { metadata?: any }
): DbProject | null {
  const current = getProject(id);
  if (!current) return null;

  const now = Date.now();
  const name = updates.name !== undefined ? updates.name : current.name;
  const description = updates.description !== undefined ? updates.description : current.description;
  const source_type = updates.source_type !== undefined ? updates.source_type : current.source_type;
  const root_path = updates.root_path !== undefined ? updates.root_path : current.root_path;
  const status = updates.status !== undefined ? updates.status : current.status;
  const last_indexed_at = updates.last_indexed_at !== undefined ? updates.last_indexed_at : current.last_indexed_at;
  
  let metadataStr = current.metadata;
  if (updates.metadata !== undefined) {
    if (typeof updates.metadata === "string") {
      metadataStr = updates.metadata;
    } else {
      metadataStr = JSON.stringify(updates.metadata);
    }
  }

  const stmt = db.prepare(`
    UPDATE projects
    SET name = ?, description = ?, source_type = ?, root_path = ?, status = ?, updated_at = ?, last_indexed_at = ?, metadata = ?
    WHERE id = ?
  `);

  stmt.run(name, description, source_type, root_path, status, now, last_indexed_at, metadataStr, id);
  return getProject(id);
}

/**
 * Completely and atomically delete a project and all cascading resources
 */
export function deleteProject(projectId: string): boolean {
  if (!projectId) return false;
  return runTransaction(() => {
    // Explicit deletions in transaction to guarantee 100% cascade across all SQLite environments
    db.prepare("DELETE FROM project_files WHERE project_id = ?").run(projectId);
    db.prepare("DELETE FROM artifacts WHERE project_id = ?").run(projectId);
    db.prepare("DELETE FROM knowledge_chunks WHERE project_id = ?").run(projectId);
    db.prepare("DELETE FROM architecture_nodes WHERE project_id = ?").run(projectId);
    db.prepare("DELETE FROM architecture_edges WHERE project_id = ?").run(projectId);
    db.prepare("DELETE FROM diagnostics WHERE project_id = ?").run(projectId);
    db.prepare("DELETE FROM test_runs WHERE project_id = ?").run(projectId);
    db.prepare("DELETE FROM github_connections WHERE project_id = ?").run(projectId);
    db.prepare("DELETE FROM project_analyses WHERE project_id = ?").run(projectId);
    db.prepare("DELETE FROM conversations WHERE project_id = ?").run(projectId);

    const res = db.prepare("DELETE FROM projects WHERE id = ?").run(projectId);
    return res.changes > 0;
  });
}

// ---------------------------------------------------------------------------
// Project Files Service
// ---------------------------------------------------------------------------
export function createFile(file: {
  id: string;
  project_id: string;
  path: string;
  name: string;
  extension?: string;
  language?: string;
  size?: number;
  hash?: string;
  version?: number;
  content?: string;
  is_binary?: boolean | number;
}): DbProjectFile {
  const now = Date.now();
  const stmt = db.prepare(`
    INSERT INTO project_files (id, project_id, path, name, extension, language, size, hash, version, content, is_binary, created_at, updated_at)
    VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
    ON CONFLICT(id) DO UPDATE SET
      path = excluded.path,
      name = excluded.name,
      extension = excluded.extension,
      language = excluded.language,
      size = excluded.size,
      hash = excluded.hash,
      version = project_files.version + 1,
      content = excluded.content,
      is_binary = excluded.is_binary,
      updated_at = excluded.updated_at
  `);

  stmt.run(
    file.id,
    file.project_id,
    file.path,
    file.name,
    file.extension || path.extname(file.name),
    file.language || "text",
    file.size || 0,
    file.hash || "",
    file.version || 1,
    file.content || "",
    file.is_binary ? 1 : 0,
    now,
    now
  );

  return getFile(file.id)!;
}

export function getFile(id: string): DbProjectFile | null {
  const stmt = db.prepare("SELECT * FROM project_files WHERE id = ?");
  const row = stmt.get(id);
  return (row as DbProjectFile) || null;
}

export function getProjectFileByPath(projectId: string, filePath: string): DbProjectFile | null {
  const stmt = db.prepare("SELECT * FROM project_files WHERE project_id = ? AND path = ?");
  const row = stmt.get(projectId, filePath);
  return (row as DbProjectFile) || null;
}

export function listFiles(projectId: string): DbProjectFile[] {
  const stmt = db.prepare("SELECT * FROM project_files WHERE project_id = ? ORDER BY path ASC");
  return (stmt.all(projectId) as any[]) as DbProjectFile[];
}

export function updateFile(
  id: string,
  updates: Partial<Omit<DbProjectFile, "id" | "project_id" | "created_at">>
): DbProjectFile | null {
  const current = getFile(id);
  if (!current) return null;

  const now = Date.now();
  const filePath = updates.path !== undefined ? updates.path : current.path;
  const name = updates.name !== undefined ? updates.name : current.name;
  const ext = updates.extension !== undefined ? updates.extension : current.extension;
  const lang = updates.language !== undefined ? updates.language : current.language;
  const size = updates.size !== undefined ? updates.size : current.size;
  const hash = updates.hash !== undefined ? updates.hash : current.hash;
  const ver = updates.version !== undefined ? updates.version : current.version + 1;
  const content = updates.content !== undefined ? updates.content : current.content;
  const isBinary = updates.is_binary !== undefined ? updates.is_binary : current.is_binary;

  const stmt = db.prepare(`
    UPDATE project_files
    SET path = ?, name = ?, extension = ?, language = ?, size = ?, hash = ?, version = ?, content = ?, is_binary = ?, updated_at = ?
    WHERE id = ?
  `);

  stmt.run(filePath, name, ext, lang, size, hash, ver, content, isBinary, now, id);
  return getFile(id);
}

export function deleteFile(id: string): boolean {
  return runTransaction(() => {
    const file = getFile(id);
    if (file) {
      db.prepare("DELETE FROM knowledge_chunks WHERE project_id = ? AND file_id = ?").run(file.project_id, file.path);
    }
    const res = db.prepare("DELETE FROM project_files WHERE id = ?").run(id);
    return res.changes > 0;
  });
}

export function deleteProjectFileByPath(projectId: string, filePath: string): boolean {
  return runTransaction(() => {
    const file = getProjectFileByPath(projectId, filePath);
    if (!file) return false;
    db.prepare("DELETE FROM knowledge_chunks WHERE project_id = ? AND file_id = ?").run(projectId, filePath);
    const res = db.prepare("DELETE FROM project_files WHERE id = ?").run(file.id);
    return res.changes > 0;
  });
}

export function updateFileByPath(
  projectId: string,
  filePath: string,
  updates: Partial<Omit<DbProjectFile, "id" | "project_id" | "created_at">>
): DbProjectFile | null {
  const file = getProjectFileByPath(projectId, filePath);
  if (!file) return null;
  return updateFile(file.id, updates);
}

export function renameProjectFolderFiles(projectId: string, oldFolder: string, newFolder: string): number {
  return runTransaction(() => {
    const oldPrefix = oldFolder.endsWith("/") ? oldFolder : oldFolder + "/";
    const newPrefix = newFolder.endsWith("/") ? newFolder : newFolder + "/";
    const files = listFiles(projectId);
    let count = 0;
    const now = Date.now();
    for (const f of files) {
      if (f.path.startsWith(oldPrefix)) {
        const newPath = newPrefix + f.path.substring(oldPrefix.length);
        const newName = path.basename(newPath);
        const newExt = path.extname(newName);
        db.prepare(`
          UPDATE project_files
          SET path = ?, name = ?, extension = ?, version = version + 1, updated_at = ?
          WHERE id = ?
        `).run(newPath, newName, newExt, now, f.id);
        db.prepare("UPDATE knowledge_chunks SET file_id = ? WHERE project_id = ? AND file_id = ?")
          .run(newPath, projectId, f.path);
        count++;
      } else if (f.path === oldFolder) {
        const newName = path.basename(newFolder);
        const newExt = path.extname(newName);
        db.prepare(`
          UPDATE project_files
          SET path = ?, name = ?, extension = ?, version = version + 1, updated_at = ?
          WHERE id = ?
        `).run(newFolder, newName, newExt, now, f.id);
        db.prepare("UPDATE knowledge_chunks SET file_id = ? WHERE project_id = ? AND file_id = ?")
          .run(newFolder, projectId, f.path);
        count++;
      }
    }
    return count;
  });
}

export function deleteProjectFolderFiles(projectId: string, folderPath: string): number {
  return runTransaction(() => {
    const prefix = folderPath.endsWith("/") ? folderPath : folderPath + "/";
    const files = listFiles(projectId).filter((f) => f.path.startsWith(prefix) || f.path === folderPath);
    for (const f of files) {
      db.prepare("DELETE FROM knowledge_chunks WHERE project_id = ? AND file_id = ?").run(projectId, f.path);
      db.prepare("DELETE FROM project_files WHERE id = ?").run(f.id);
    }
    return files.length;
  });
}

// ---------------------------------------------------------------------------
// Artifacts Service
// ---------------------------------------------------------------------------
export function createArtifact(artifact: {
  id: string;
  project_id: string;
  file_id?: string | null;
  name: string;
  path?: string | null;
  mime_type?: string | null;
  artifact_type?: string | null;
  version?: number;
  hash?: string | null;
  content?: string | null;
}): DbArtifact {
  const now = Date.now();
  const stmt = db.prepare(`
    INSERT INTO artifacts (id, project_id, file_id, name, path, mime_type, artifact_type, version, hash, content, created_at, updated_at)
    VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
    ON CONFLICT(id) DO UPDATE SET
      name = excluded.name,
      path = excluded.path,
      mime_type = excluded.mime_type,
      artifact_type = excluded.artifact_type,
      version = artifacts.version + 1,
      hash = excluded.hash,
      content = excluded.content,
      updated_at = excluded.updated_at
  `);

  stmt.run(
    artifact.id,
    artifact.project_id,
    artifact.file_id || null,
    artifact.name,
    artifact.path || null,
    artifact.mime_type || null,
    artifact.artifact_type || null,
    artifact.version || 1,
    artifact.hash || null,
    artifact.content || null,
    now,
    now
  );

  return getArtifact(artifact.id)!;
}

export function getArtifact(id: string): DbArtifact | null {
  const stmt = db.prepare("SELECT * FROM artifacts WHERE id = ?");
  const row = stmt.get(id);
  return (row as DbArtifact) || null;
}

export function listArtifacts(projectId: string): DbArtifact[] {
  const stmt = db.prepare("SELECT * FROM artifacts WHERE project_id = ? ORDER BY created_at DESC");
  return (stmt.all(projectId) as any[]) as DbArtifact[];
}

export function deleteArtifact(id: string): boolean {
  const res = db.prepare("DELETE FROM artifacts WHERE id = ?").run(id);
  return res.changes > 0;
}

// ---------------------------------------------------------------------------
// Knowledge Chunks Service
// ---------------------------------------------------------------------------
export function createKnowledgeChunk(chunk: {
  id: string;
  project_id: string;
  file_id: string;
  chunk_id: string;
  content: string;
  chunk_type?: string;
  symbol?: string;
  start_line?: number;
  end_line?: number;
  hash?: string;
  version?: number;
}): DbKnowledgeChunk {
  const now = Date.now();
  const stmt = db.prepare(`
    INSERT INTO knowledge_chunks (id, project_id, file_id, chunk_id, content, chunk_type, symbol, start_line, end_line, hash, version, created_at, updated_at)
    VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
    ON CONFLICT(id) DO UPDATE SET
      content = excluded.content,
      chunk_type = excluded.chunk_type,
      symbol = excluded.symbol,
      start_line = excluded.start_line,
      end_line = excluded.end_line,
      hash = excluded.hash,
      version = knowledge_chunks.version + 1,
      updated_at = excluded.updated_at
  `);

  stmt.run(
    chunk.id,
    chunk.project_id,
    chunk.file_id,
    chunk.chunk_id,
    chunk.content,
    chunk.chunk_type || "text",
    chunk.symbol || "",
    chunk.start_line || 1,
    chunk.end_line || 1,
    chunk.hash || "",
    chunk.version || 1,
    now,
    now
  );

  const row = db.prepare("SELECT * FROM knowledge_chunks WHERE id = ?").get(chunk.id);
  return row as DbKnowledgeChunk;
}

export function listKnowledgeChunks(projectId: string, fileId?: string): DbKnowledgeChunk[] {
  if (fileId) {
    const stmt = db.prepare("SELECT * FROM knowledge_chunks WHERE project_id = ? AND file_id = ? ORDER BY start_line ASC");
    return (stmt.all(projectId, fileId) as any[]) as DbKnowledgeChunk[];
  }
  const stmt = db.prepare("SELECT * FROM knowledge_chunks WHERE project_id = ? ORDER BY file_id ASC, start_line ASC");
  return (stmt.all(projectId) as any[]) as DbKnowledgeChunk[];
}

export function deleteKnowledgeForProject(projectId: string): number {
  const res = db.prepare("DELETE FROM knowledge_chunks WHERE project_id = ?").run(projectId);
  return res.changes;
}

// ---------------------------------------------------------------------------
// Architecture & Diagnostics Services
// ---------------------------------------------------------------------------
export function saveArchitecture(
  projectId: string,
  nodes: Array<{ id: string; node_type?: string; name: string; file_id?: string | null; metadata?: any }>,
  edges: Array<{ id: string; source_node_id: string; target_node_id: string; relationship?: string; confidence?: number; evidence?: string | null }>
) {
  runTransaction(() => {
    db.prepare("DELETE FROM architecture_nodes WHERE project_id = ?").run(projectId);
    db.prepare("DELETE FROM architecture_edges WHERE project_id = ?").run(projectId);

    const insertNode = db.prepare(`
      INSERT INTO architecture_nodes (id, project_id, node_type, name, file_id, metadata)
      VALUES (?, ?, ?, ?, ?, ?)
    `);
    const seenNodes = new Set();
    for (const n of nodes) {
      if (!n.id) continue;
      const internalId = projectId + "_" + n.id;
      if (seenNodes.has(internalId)) continue;
      seenNodes.add(internalId);

      const nodeType = n.node_type || (n as any).type || "component";
      const nodeName = n.name || (n as any).label || n.id;
      const fileId = n.file_id || ((n as any).files && (n as any).files[0]) || null;
      const meta = n.metadata ? n.metadata : {
        subType: (n as any).subType,
        description: (n as any).description,
        files: (n as any).files,
        level: (n as any).level,
        evidence: (n as any).evidence,
        metrics: (n as any).metrics,
      };
      insertNode.run(
        internalId,
        projectId,
        nodeType,
        nodeName,
        fileId,
        meta ? JSON.stringify(meta) : null
      );
    }

    const insertEdge = db.prepare(`
      INSERT INTO architecture_edges (id, project_id, source_node_id, target_node_id, relationship, confidence, evidence)
      VALUES (?, ?, ?, ?, ?, ?, ?)
    `);
    const seenEdges = new Set();
    let edgeCounter = 0;
    for (const e of edges) {
      edgeCounter++;
      const src = e.source_node_id || (e as any).source || (e as any).from;
      const tgt = e.target_node_id || (e as any).target || (e as any).to;
      let edgeId = e.id || `${src}_${tgt}_${edgeCounter}`;
      const internalEdgeId = projectId + "_" + edgeId;
      if (seenEdges.has(internalEdgeId)) continue;
      seenEdges.add(internalEdgeId);

      const evidenceStr = e.evidence ? (typeof e.evidence === 'string' ? e.evidence : JSON.stringify(e.evidence)) : null;
      insertEdge.run(
        internalEdgeId,
        projectId,
        projectId + "_" + src,
        projectId + "_" + tgt,
        e.relationship || (e as any).label || "depends_on",
        e.confidence !== undefined ? e.confidence : 1.0,
        evidenceStr
      );
    }
  });
}


export function getArchitecture(projectId: string) {
  const nodes = db.prepare("SELECT * FROM architecture_nodes WHERE project_id = ?").all(projectId) as any[];
  const edges = db.prepare("SELECT * FROM architecture_edges WHERE project_id = ?").all(projectId) as any[];
  
  const prefix = projectId + "_";
  return {
    nodes: nodes.map(n => {
      let outId = n.id;
      if (outId.startsWith(prefix)) outId = outId.substring(prefix.length);
      return { ...n, id: outId, metadata: n.metadata ? JSON.parse(n.metadata) : null };
    }),
    edges: edges.map(e => {
      let outId = e.id;
      let srcId = e.source_node_id;
      let tgtId = e.target_node_id;
      if (outId.startsWith(prefix)) outId = outId.substring(prefix.length);
      if (srcId.startsWith(prefix)) srcId = srcId.substring(prefix.length);
      if (tgtId.startsWith(prefix)) tgtId = tgtId.substring(prefix.length);
      return { ...e, id: outId, source_node_id: srcId, target_node_id: tgtId, source: srcId, target: tgtId };
    })
  };
}

export function deleteArchitectureForProject(projectId: string): void {
  runTransaction(() => {
    db.prepare("DELETE FROM architecture_nodes WHERE project_id = ?").run(projectId);
    db.prepare("DELETE FROM architecture_edges WHERE project_id = ?").run(projectId);
  });
}

export function saveDiagnostics(projectId: string, diags: Array<Omit<DbDiagnostic, "id" | "project_id" | "created_at"> & { id?: string }>) {
  runTransaction(() => {
    db.prepare("DELETE FROM diagnostics WHERE project_id = ?").run(projectId);
    const stmt = db.prepare(`
      INSERT INTO diagnostics (id, project_id, file_id, severity, category, message, line, column, status, created_at)
      VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
    `);
    const now = Date.now();
    for (const d of diags) {
      const id = d.id || `diag_${projectId}_${Math.random().toString(36).substr(2, 9)}`;
      stmt.run(
        id,
        projectId,
        d.file_id || null,
        d.severity || "info",
        d.category || "general",
        d.message,
        d.line !== undefined ? d.line : null,
        d.column !== undefined ? d.column : null,
        d.status || "open",
        now
      );
    }
  });
}

export function getDiagnostics(projectId: string): DbDiagnostic[] {
  const stmt = db.prepare("SELECT * FROM diagnostics WHERE project_id = ? ORDER BY severity DESC, line ASC");
  return (stmt.all(projectId) as any[]) as DbDiagnostic[];
}

export function deleteDiagnosticsForProject(projectId: string): number {
  const res = db.prepare("DELETE FROM diagnostics WHERE project_id = ?").run(projectId);
  return res.changes;
}

// ---------------------------------------------------------------------------
// Project Analysis Cache Service
// ---------------------------------------------------------------------------
export function saveProjectAnalysis(projectId: string, analysis: any) {
  const now = Date.now();
  const summary = analysis.summary || "";
  const pType = analysis.projectType || "";
  const pLang = analysis.primaryLanguage || "";
  const jsonStr = JSON.stringify(analysis);

  const stmt = db.prepare(`
    INSERT INTO project_analyses (project_id, summary, project_type, primary_language, analysis_json, updated_at)
    VALUES (?, ?, ?, ?, ?, ?)
    ON CONFLICT(project_id) DO UPDATE SET
      summary = excluded.summary,
      project_type = excluded.project_type,
      primary_language = excluded.primary_language,
      analysis_json = excluded.analysis_json,
      updated_at = excluded.updated_at
  `);

  stmt.run(projectId, summary, pType, pLang, jsonStr, now);
}

export function getProjectAnalysis(projectId: string): any | null {
  const stmt = db.prepare("SELECT analysis_json FROM project_analyses WHERE project_id = ?");
  const row = stmt.get(projectId) as any;
  if (!row || !row.analysis_json) return null;
  try {
    return JSON.parse(row.analysis_json);
  } catch {
    return null;
  }
}

export function deleteProjectAnalysis(projectId: string): boolean {
  const res = db.prepare("DELETE FROM project_analyses WHERE project_id = ?").run(projectId);
  return res.changes > 0;
}

// ---------------------------------------------------------------------------
// Conversations & Messages Service
// ---------------------------------------------------------------------------
export function saveConversation(
  convOrId: string | { id: string; user_id: string; project_id?: string | null; title: string; model_id?: string | null; created_at?: number; updated_at?: number },
  user_id?: string,
  title?: string,
  model_id?: string | null
) {
  const conv = typeof convOrId === "object" ? convOrId : {
    id: convOrId,
    user_id: user_id || "default",
    title: title || "New Chat",
    model_id: model_id || null,
  };
  const now = Date.now();
  const stmt = db.prepare(`
    INSERT INTO conversations (id, user_id, project_id, title, model_id, created_at, updated_at)
    VALUES (?, ?, ?, ?, ?, ?, ?)
    ON CONFLICT(id) DO UPDATE SET
      project_id = excluded.project_id,
      title = excluded.title,
      model_id = excluded.model_id,
      updated_at = excluded.updated_at
  `);

  stmt.run(
    conv.id,
    conv.user_id,
    conv.project_id || null,
    conv.title,
    conv.model_id || null,
    conv.created_at || now,
    conv.updated_at || now
  );
}

export function getConversation(id: string) {
  return db.prepare("SELECT * FROM conversations WHERE id = ?").get(id) as any;
}

export function listConversations(userId: string) {
  return db.prepare("SELECT * FROM conversations WHERE user_id = ? ORDER BY updated_at DESC").all(userId) as any[];
}

export function deleteConversation(id: string) {
  return db.prepare("DELETE FROM conversations WHERE id = ?").run(id).changes > 0;
}

export function saveMessage(
  msgOrId: string | { id: string; conversation_id: string; role: string; content: string; model_id?: string | null; attachments?: any; created_at?: number },
  conversation_id?: string,
  role?: string,
  content?: string,
  model_id?: string | null
) {
  const msg = typeof msgOrId === "object" ? msgOrId : {
    id: msgOrId,
    conversation_id: conversation_id!,
    role: role!,
    content: content || "",
    model_id: model_id || null,
  };
  const now = Date.now();
  const stmt = db.prepare(`
    INSERT INTO messages (id, conversation_id, role, content, model_id, attachments, created_at)
    VALUES (?, ?, ?, ?, ?, ?, ?)
    ON CONFLICT(id) DO UPDATE SET
      content = excluded.content,
      model_id = excluded.model_id,
      attachments = excluded.attachments
  `);

  stmt.run(
    msg.id,
    msg.conversation_id,
    msg.role,
    msg.content,
    msg.model_id || null,
    msg.attachments ? JSON.stringify(msg.attachments) : null,
    msg.created_at || now
  );
}

export function deleteMessage(id: string) {
  return db.prepare("DELETE FROM messages WHERE id = ?").run(id).changes > 0;
}

export function listMessages(conversationId: string) {
  const rows = db.prepare("SELECT * FROM messages WHERE conversation_id = ? ORDER BY created_at ASC").all(conversationId) as any[];
  return rows.map(r => ({
    ...r,
    attachments: r.attachments ? JSON.parse(r.attachments) : []
  }));
}

// ---------------------------------------------------------------------------
// Workspace Files Service
// ---------------------------------------------------------------------------
export function saveWorkspaceFile(f: {
  id: string;
  user_id: string;
  filename: string;
  mime?: string;
  size?: number;
  file_type?: string;
  content?: string;
  uploaded_at?: number;
}) {
  const now = Date.now();
  const stmt = db.prepare(`
    INSERT INTO workspace_files (id, user_id, filename, mime, size, file_type, content, uploaded_at)
    VALUES (?, ?, ?, ?, ?, ?, ?, ?)
    ON CONFLICT(id) DO UPDATE SET
      filename = excluded.filename,
      mime = excluded.mime,
      size = excluded.size,
      file_type = excluded.file_type,
      content = excluded.content
  `);

  stmt.run(
    f.id,
    f.user_id,
    f.filename,
    f.mime || "text/plain",
    f.size || 0,
    f.file_type || "document",
    f.content || "",
    f.uploaded_at || now
  );
}

export function getWorkspaceFile(id: string) {
  return db.prepare("SELECT * FROM workspace_files WHERE id = ?").get(id) as any;
}

export function listWorkspaceFiles(userId: string) {
  return db.prepare("SELECT * FROM workspace_files WHERE user_id = ? ORDER BY uploaded_at DESC").all(userId) as any[];
}

export function deleteWorkspaceFile(id: string) {
  return db.prepare("DELETE FROM workspace_files WHERE id = ?").run(id).changes > 0;
}

// ---------------------------------------------------------------------------
// GitHub Connections Service
// ---------------------------------------------------------------------------
export function saveGithubConnection(projectId: string, conn: {
  repository: string;
  branch: string;
  sync_status?: string;
  last_synced_at?: number;
  metadata?: any;
}) {
  const id = `gh_${projectId}`;
  const stmt = db.prepare(`
    INSERT INTO github_connections (id, project_id, repository, branch, sync_status, last_synced_at, metadata)
    VALUES (?, ?, ?, ?, ?, ?, ?)
    ON CONFLICT(id) DO UPDATE SET
      repository = excluded.repository,
      branch = excluded.branch,
      sync_status = excluded.sync_status,
      last_synced_at = excluded.last_synced_at,
      metadata = excluded.metadata
  `);

  stmt.run(
    id,
    projectId,
    conn.repository,
    conn.branch,
    conn.sync_status || "synced",
    conn.last_synced_at || Date.now(),
    conn.metadata ? JSON.stringify(conn.metadata) : null
  );
}

export function getGithubConnection(projectId: string) {
  const row = db.prepare("SELECT * FROM github_connections WHERE project_id = ?").get(projectId) as any;
  if (!row) return null;
  return {
    ...row,
    metadata: row.metadata ? JSON.parse(row.metadata) : null
  };
}

// Initialize schema on load
initDatabaseSchema();

export function dbGetModels(): any[] {
  return db.prepare("SELECT * FROM models").all();
}

export function dbGetModel(id: string): any {
  return db.prepare("SELECT * FROM models WHERE id = ?").get(id);
}

export function dbSaveModel(model: any) {
  const stmt = db.prepare(`
    INSERT INTO models (id, name, provider, base_url, api_key, model_name, model_type, capabilities, context_window, max_output_tokens, default_temperature, default_top_p, supports_streaming, enabled, status, is_user)
    VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
    ON CONFLICT(id) DO UPDATE SET
      name = excluded.name,
      provider = excluded.provider,
      base_url = excluded.base_url,
      api_key = excluded.api_key,
      model_name = excluded.model_name,
      model_type = excluded.model_type,
      capabilities = excluded.capabilities,
      context_window = excluded.context_window,
      max_output_tokens = excluded.max_output_tokens,
      default_temperature = excluded.default_temperature,
      default_top_p = excluded.default_top_p,
      supports_streaming = excluded.supports_streaming,
      enabled = excluded.enabled,
      status = excluded.status,
      is_user = excluded.is_user
  `);
  
  stmt.run(
    model.id, model.name, model.provider, model.baseUrl || model.base_url || null, model.apiKey || model.api_key || null,
    model.modelName || model.model_name || "", model.modelType || model.model_type || "text",
    typeof model.capabilities === 'string' ? model.capabilities : JSON.stringify(model.capabilities || {}),
    model.contextWindow || model.context_window || 0, model.maxOutputTokens || model.max_output_tokens || 0,
    model.defaultTemperature || model.default_temperature || 0.7, model.defaultTopP || model.default_top_p || 1.0,
    model.supportsStreaming !== false ? 1 : 0, model.enabled !== false ? 1 : 0,
    model.status || "available", model.isUser ? 1 : 0
  );
}

export function dbDeleteModel(id: string) {
  db.prepare("DELETE FROM models WHERE id = ?").run(id);
}
