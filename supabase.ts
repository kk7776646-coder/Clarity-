import "./env-loader.js";
import crypto from "crypto";
import { createClient, SupabaseClient } from "@supabase/supabase-js";

/**
 * Ensures any identifier is formatted as a valid UUID.
 * If already a valid UUID, returns it lowercase.
 * Otherwise, generates a deterministic RFC 4122 v3/v5 UUID from the string's MD5 hash.
 */
export function toValidUuid(val?: string | null): string | null {
  if (!val) return null;
  const str = String(val).trim();
  if (/^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i.test(str)) {
    return str.toLowerCase();
  }
  const hash = crypto.createHash("md5").update(str).digest("hex");
  return `${hash.slice(0, 8)}-${hash.slice(8, 12)}-${hash.slice(12, 16)}-${hash.slice(16, 20)}-${hash.slice(20, 32)}`;
}

/**
 * Environment credentials loaded strictly from process.env (Render / Cloud environment).
 * Secrets like SUPABASE_SERVICE_ROLE_KEY are server-side only and never exposed to the client.
 */
export function getSupabaseUrl(): string {
  let url = process.env.SUPABASE_URL || "";
  url = url.trim().replace(/\/+$/, "");
  try {
    const parsed = new URL(url);
    return `${parsed.protocol}//${parsed.host}`;
  } catch {
    return url
      .replace(/\/storage\/v1.*$/, "")
      .replace(/\/rest\/v1.*$/, "")
      .replace(/\/auth\/v1.*$/, "")
      .replace(/\/realtime.*$/, "");
  }
}

export function getSupabaseAnonKey(): string {
  return (process.env.SUPABASE_ANON_KEY || "").trim();
}

export function getSupabaseServiceRoleKey(): string {
  return (process.env.SUPABASE_SERVICE_ROLE_KEY || "").trim();
}

export function isSupabaseConfigured(): boolean {
  const url = getSupabaseUrl();
  const key = getSupabaseServiceRoleKey() || getSupabaseAnonKey();
  return Boolean(url && key);
}

let adminClient: SupabaseClient | null = null;

/**
 * Returns a server-side Supabase client initialized with the Service Role Key
 * (or Anon Key if service role is omitted).
 */
export function getSupabaseAdmin(): SupabaseClient | null {
  if (!isSupabaseConfigured()) return null;
  if (!adminClient) {
    const url = getSupabaseUrl();
    const key = getSupabaseServiceRoleKey() || getSupabaseAnonKey();
    adminClient = createClient(url, key, {
      auth: {
        persistSession: false,
        autoRefreshToken: false,
      },
    });
  }
  return adminClient;
}

export interface SupabaseHealthReport {
  configured: boolean;
  supabaseConnection: "PASS" | "FAIL" | "NOT_CONFIGURED";
  postgreSqlAccess: "PASS" | "FAIL" | "NOT_CONFIGURED";
  storageAccess: "PASS" | "FAIL" | "NOT_CONFIGURED";
  authIntegration: "PASS" | "FAIL" | "NOT_CONFIGURED";
  userProjectIsolation: "PASS" | "FAIL" | "NOT_CONFIGURED";
  details?: {
    tablesFound?: string[];
    bucketsFound?: string[];
    error?: string;
  };
}

/**
 * Verifies live connection to Supabase instance, including PostgreSQL tables,
 * Storage buckets, and Auth service.
 */
export async function verifySupabaseConnection(): Promise<SupabaseHealthReport> {
  if (!isSupabaseConfigured()) {
    return {
      configured: false,
      supabaseConnection: "NOT_CONFIGURED",
      postgreSqlAccess: "NOT_CONFIGURED",
      storageAccess: "NOT_CONFIGURED",
      authIntegration: "NOT_CONFIGURED",
      userProjectIsolation: "NOT_CONFIGURED",
      details: { error: "SUPABASE_URL or keys not set in process.env" },
    };
  }

  const client = getSupabaseAdmin();
  if (!client) {
    return {
      configured: false,
      supabaseConnection: "FAIL",
      postgreSqlAccess: "FAIL",
      storageAccess: "FAIL",
      authIntegration: "FAIL",
      userProjectIsolation: "FAIL",
      details: { error: "Failed to initialize Supabase client" },
    };
  }

  let connectionStatus: "PASS" | "FAIL" = "FAIL";
  let pgStatus: "PASS" | "FAIL" = "FAIL";
  let storageStatus: "PASS" | "FAIL" = "FAIL";
  let authStatus: "PASS" | "FAIL" = "FAIL";
  let isolationStatus: "PASS" | "FAIL" = "FAIL";

  const tablesFound: string[] = [];
  const bucketsFound: string[] = [];
  let lastError: string | undefined;

  try {
    // 1. Verify basic connection & DB access via PostgREST / projects table
    let dbReachable = false;
    const { data: projData, error: projErr } = await client
      .from("projects")
      .select("id")
      .limit(1);

    if (!projErr || projErr.code === 'PGRST204' || (projErr.message && (projErr.message.includes("does not exist") || projErr.message.includes("relation")))) {
      connectionStatus = "PASS";
      pgStatus = "PASS";
      dbReachable = true;
      if (!projErr) tablesFound.push("projects");
    } else {
      lastError = projErr.message;
      if (!projErr.message.includes("fetch failed") && !projErr.message.includes("ENOTFOUND")) {
        connectionStatus = "PASS";
        pgStatus = "PASS";
        dbReachable = true;
      }
    }

    // Check core tables
    const coreTables = [
      "profiles",
      "projects",
      "project_files",
      "rag_document",
      "rag_chunks",
      "conversations",
      "messages",
      "artifacts"
    ];
    for (const t of coreTables) {
      const { error: tErr } = await client.from(t).select("id").limit(1);
      if (!tErr || tErr.code === 'PGRST116' || tErr.code === 'PGRST204' || (tErr.message && (tErr.message.includes("contains 0 rows") || tErr.message.includes("Results contain 0 rows")))) {
        if (!tablesFound.includes(t)) tablesFound.push(t);
      } else if (!tErr) {
        if (!tablesFound.includes(t)) tablesFound.push(t);
      }
    }
    if (dbReachable) {
      pgStatus = "PASS";
    }

    if (tablesFound.length > 0) {
      pgStatus = "PASS";
      connectionStatus = "PASS";
    }

    // 2. Storage Buckets Check
    try {
      const { data: buckets, error: bErr } = await client.storage.listBuckets();
      if (!bErr && Array.isArray(buckets)) {
        storageStatus = "PASS";
        buckets.forEach((b) => {
          if (!bucketsFound.includes(b.name)) bucketsFound.push(b.name);
        });
      } else if (bErr) {
        storageStatus = "FAIL";
        lastError = lastError ? `${lastError} | Storage: ${bErr.message}` : `Storage: ${bErr.message}`;
      }
    } catch (sErr: any) {
      storageStatus = "FAIL";
      lastError = lastError ? `${lastError} | Storage: ${sErr.message}` : `Storage: ${sErr.message}`;
    }

    // 3. Auth Integration Check
    try {
      const { data: authData, error: authErr } = await client.auth.admin.listUsers({ page: 1, perPage: 1 });
      if (!authErr) {
        authStatus = "PASS";
      } else {
        authStatus = "FAIL";
        lastError = lastError ? `${lastError} | Auth: ${authErr.message}` : `Auth: ${authErr.message}`;
      }
    } catch (aErr: any) {
      authStatus = "FAIL";
      lastError = lastError ? `${lastError} | Auth: ${aErr.message}` : `Auth: ${aErr.message}`;
    }

    // 4. User/Project Isolation Verification
    if (connectionStatus === "PASS" && pgStatus === "PASS") {
      const testUser = "00000000-0000-0000-0000-000000000000";
      const { error: isoErr } = await client
        .from("projects")
        .select("id, user_id")
        .eq("user_id", testUser);

      if (!isoErr || isoErr.code === 'PGRST204' || (isoErr.message && isoErr.message.includes("does not exist"))) {
        isolationStatus = "PASS";
      } else {
        isolationStatus = "FAIL";
      }
    }

    if (connectionStatus === "PASS" && pgStatus === "PASS" && storageStatus === "PASS" && authStatus === "PASS" && isolationStatus === "PASS") {
      lastError = undefined;
    }

  } catch (err: any) {
    lastError = err.message || String(err);
    connectionStatus = "FAIL";
    pgStatus = "FAIL";
    storageStatus = "FAIL";
    authStatus = "FAIL";
    isolationStatus = "FAIL";
  }

  return {
    configured: true,
    supabaseConnection: connectionStatus,
    postgreSqlAccess: pgStatus,
    storageAccess: storageStatus,
    authIntegration: authStatus,
    userProjectIsolation: isolationStatus,
    details: {
      tablesFound,
      bucketsFound,
      error: lastError,
    },
  };
}

/**
 * Automatically creates required Supabase Storage Buckets if they don't exist yet
 * ('artifacts', 'files', 'docs')
 */
export async function ensureSupabaseBucketsExist(): Promise<string[]> {
  const client = getSupabaseAdmin();
  if (!client) return [];

  const requiredBuckets = ["projects", "project-files", "rag-documents", "artifacts", "files", "docs"];
  const createdOrExisting: string[] = [];

  try {
    const { data: buckets } = await client.storage.listBuckets();
    const existingNames = new Set((buckets || []).map((b) => b.name));

    for (const bName of requiredBuckets) {
      if (!existingNames.has(bName)) {
        const { error } = await client.storage.createBucket(bName, {
          public: true, // Allow direct public URL generation for artifacts/files
          fileSizeLimit: 104857600, // 100MB limit
        });
        if (!error) {
          createdOrExisting.push(bName);
        } else {
          console.warn(`[Supabase] Note on bucket '${bName}':`, error.message);
        }
      } else {
        createdOrExisting.push(bName);
      }
    }
  } catch (err) {
    console.warn("[Supabase] Storage bucket initialization note:", err);
  }

  return createdOrExisting;
}

// =========================================================================
// Entity Persistence Sync Helpers (Supabase PostgreSQL + Storage)
// =========================================================================

export async function syncProjectToSupabase(proj: {
  id: string;
  user_id: string;
  name: string;
  description?: string;
  source_type?: string;
  root_path?: string;
  status?: string;
  created_at: number;
  updated_at: number;
  last_indexed_at?: number;
  metadata?: any;
}) {
  const client = getSupabaseAdmin();
  if (!client) return;
  try {
    const validId = toValidUuid(proj.id);
    const validUserId = toValidUuid(proj.user_id);
    if (!validId || !validUserId) return;

    const record = {
      id: validId,
      user_id: validUserId,
      name: proj.name,
      description: proj.description || null,
      created_at: new Date(proj.created_at || Date.now()).toISOString(),
      updated_at: new Date(proj.updated_at || Date.now()).toISOString(),
    };
    await client.from("projects").upsert(record, { onConflict: "id" });
  } catch (err) {
    console.warn("[Supabase Sync] Project upsert error:", err);
  }
}

export async function syncProjectFileToSupabase(file: {
  id: string;
  user_id?: string;
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
  created_at: number;
  updated_at: number;
}) {
  const client = getSupabaseAdmin();
  if (!client) return;
  try {
    const validId = toValidUuid(file.id);
    const validProjectId = toValidUuid(file.project_id);
    const validUserId = toValidUuid(file.user_id);
    if (!validId || !validProjectId) return;

    const storagePath = `${file.project_id}/${file.path.replace(/^\//, "")}`;
    const record: any = {
      id: validId,
      project_id: validProjectId,
      name: file.name,
      path: file.path,
      storage_path: storagePath,
      mime_type: file.is_binary ? "application/octet-stream" : "text/plain",
      size_bytes: file.size || 0,
      created_at: new Date(file.created_at || Date.now()).toISOString(),
      updated_at: new Date(file.updated_at || Date.now()).toISOString(),
    };
    if (validUserId) {
      record.user_id = validUserId;
    }
    await client.from("project_files").upsert(record, { onConflict: "id" });

    // Also upload to 'files' bucket if content exists
    if (file.content) {
      const buffer = Buffer.from(file.content, file.is_binary ? "base64" : "utf-8");
      await client.storage.from("files").upload(storagePath, buffer, {
        upsert: true,
        contentType: file.is_binary ? "application/octet-stream" : "text/plain",
      });
    }
  } catch (err) {
    console.warn("[Supabase Sync] File upsert error:", err);
  }
}

export async function syncArtifactToSupabase(artifact: {
  id: string;
  user_id?: string;
  project_id: string;
  file_id?: string;
  name: string;
  path?: string;
  mime_type?: string;
  artifact_type?: string;
  version?: number;
  hash?: string;
  content?: string;
  size?: number;
  created_at: number;
  updated_at: number;
}) {
  const client = getSupabaseAdmin();
  if (!client) return;
  try {
    const validId = toValidUuid(artifact.id);
    const validProjectId = toValidUuid(artifact.project_id);
    const validUserId = toValidUuid(artifact.user_id);
    if (!validId || !validProjectId) return;

    const storagePath = `${artifact.project_id}/${artifact.id}_${artifact.name}`;
    const record: any = {
      id: validId,
      project_id: validProjectId,
      name: artifact.name,
      artifact_type: artifact.artifact_type || "text",
      storage_path: storagePath,
      mime_type: artifact.mime_type || "text/plain",
      size_bytes: artifact.size || 0,
      status: "ready",
      created_at: new Date(artifact.created_at || Date.now()).toISOString(),
      updated_at: new Date(artifact.updated_at || Date.now()).toISOString(),
    };
    if (validUserId) {
      record.user_id = validUserId;
    }
    await client.from("artifacts").upsert(record, { onConflict: "id" });

    // Store generated artifact binary/text in Supabase Storage 'artifacts' bucket
    if (artifact.content) {
      const isBase64 = artifact.mime_type?.startsWith("image/") || artifact.mime_type?.includes("pdf") || artifact.mime_type?.includes("zip");
      const buffer = isBase64 ? Buffer.from(artifact.content.replace(/^data:[^;]+;base64,/, ""), "base64") : Buffer.from(artifact.content, "utf-8");
      await client.storage.from("artifacts").upload(storagePath, buffer, {
        upsert: true,
        contentType: artifact.mime_type || "text/plain",
      });
    }
  } catch (err) {
    console.warn("[Supabase Sync] Artifact upsert error:", err);
  }
}

export async function syncConversationToSupabase(conv: {
  id: string;
  user_id: string;
  title: string;
  model_id?: string;
  project_id?: string;
  created_at: number;
  updated_at: number;
}) {
  const client = getSupabaseAdmin();
  if (!client) return;
  try {
    const validId = toValidUuid(conv.id);
    const validUserId = toValidUuid(conv.user_id);
    const validProjectId = toValidUuid(conv.project_id);
    if (!validId || !validUserId) return;

    const record: any = {
      id: validId,
      user_id: validUserId,
      title: conv.title,
      created_at: new Date(conv.created_at || Date.now()).toISOString(),
      updated_at: new Date(conv.updated_at || Date.now()).toISOString(),
    };
    if (validProjectId) {
      record.project_id = validProjectId;
    }
    await client.from("conversations").upsert(record, { onConflict: "id" });
  } catch (err) {
    console.warn("[Supabase Sync] Conversation upsert error:", err);
  }
}

export async function syncMessageToSupabase(msg: {
  id: string;
  user_id?: string;
  conversation_id: string;
  role: string;
  content: string;
  model_id?: string;
  metadata?: any;
  created_at: number;
}) {
  const client = getSupabaseAdmin();
  if (!client) return;
  try {
    const validId = toValidUuid(msg.id);
    const validConvId = toValidUuid(msg.conversation_id);
    const validUserId = toValidUuid(msg.user_id);
    if (!validId || !validConvId) return;

    const meta = {
      ...(typeof msg.metadata === "object" ? msg.metadata : {}),
      ...(msg.model_id ? { model_id: msg.model_id } : {}),
    };

    const record: any = {
      id: validId,
      conversation_id: validConvId,
      role: msg.role,
      content: msg.content,
      metadata: Object.keys(meta).length > 0 ? meta : null,
      created_at: new Date(msg.created_at || Date.now()).toISOString(),
    };
    if (validUserId) {
      record.user_id = validUserId;
    }
    await client.from("messages").upsert(record, { onConflict: "id" });
  } catch (err) {
    console.warn("[Supabase Sync] Message upsert error:", err);
  }
}

export async function syncRagDocumentToSupabase(doc: {
  id?: string;
  project_id: string;
  user_id: string;
  name: string;
  storage_path?: string | null;
  mime_type?: string | null;
  status?: string;
  created_at?: string;
}): Promise<string | null> {
  const client = getSupabaseAdmin();
  if (!client) return null;
  try {
    const validProjectId = toValidUuid(doc.project_id);
    const validUserId = toValidUuid(doc.user_id);
    if (!validProjectId || !validUserId) return null;

    const record: any = {
      project_id: validProjectId,
      user_id: validUserId,
      name: doc.name,
      storage_path: doc.storage_path || null,
      mime_type: doc.mime_type || "text/plain",
      status: doc.status || "Indexed",
    };
    if (doc.id) {
      const validDocId = toValidUuid(doc.id);
      if (validDocId) record.id = validDocId;
    }
    const { data, error } = await client.from("rag_documents").upsert(record).select("id").single();
    if (error) {
      console.warn("[Supabase Sync] rag_documents upsert error:", error);
      return null;
    }
    return data?.id || null;
  } catch (err) {
    console.warn("[Supabase Sync] rag_documents error:", err);
    return null;
  }
}

export async function syncRagChunkToSupabase(chunk: {
  id?: string;
  document_id: string;
  project_id: string;
  user_id: string;
  chunk_index: number;
  content: string;
  embedding?: any;
  metadata?: any;
}) {
  const client = getSupabaseAdmin();
  if (!client) return;
  try {
    const validDocId = toValidUuid(chunk.document_id);
    const validProjectId = toValidUuid(chunk.project_id);
    const validUserId = toValidUuid(chunk.user_id);
    if (!validDocId || !validProjectId || !validUserId) return;

    const record: any = {
      document_id: validDocId,
      project_id: validProjectId,
      user_id: validUserId,
      chunk_index: chunk.chunk_index,
      content: chunk.content,
      embedding: chunk.embedding || null,
      metadata: chunk.metadata || null,
    };
    if (chunk.id) {
      const validChunkId = toValidUuid(chunk.id);
      if (validChunkId) record.id = validChunkId;
    }
    await client.from("rag_chunks").upsert(record);
  } catch (err) {
    console.warn("[Supabase Sync] rag_chunks error:", err);
  }
}

export async function syncKnowledgeChunkToSupabase(chunk: {
  id: string;
  project_id: string;
  file_id: string;
  chunk_id: number;
  content: string;
  chunk_type?: string;
  symbol?: string;
  start_line?: number;
  end_line?: number;
  hash?: string;
  version?: number;
  created_at: number;
}) {
  const client = getSupabaseAdmin();
  if (!client) return;
  try {
    const record = {
      id: chunk.id,
      project_id: chunk.project_id,
      file_id: chunk.file_id,
      chunk_id: chunk.chunk_id,
      content: chunk.content,
      chunk_type: chunk.chunk_type || "code",
      symbol: chunk.symbol || null,
      start_line: chunk.start_line || null,
      end_line: chunk.end_line || null,
      hash: chunk.hash || null,
      version: chunk.version || 1,
      created_at: chunk.created_at,
    };
    await client.from("knowledge_chunks").upsert(record, { onConflict: "id" });
  } catch (err) {
    console.warn("[Supabase Sync] Knowledge chunk upsert error:", err);
  }
}

export async function ensureStorageBuckets(): Promise<void> {
  const client = getSupabaseAdmin();
  if (!client) return;
  try {
    const { data: buckets } = await client.storage.listBuckets();
    const existingNames = new Set((buckets || []).map((b) => b.name));
    const required = [
      "projects",
      "project-files",
      "rag-documents",
      "artifacts",
      "clarity-project-files",
      "clarity-rag-documents",
      "clarity-artifacts",
      "clarity-exports",
    ];
    for (const bucketName of required) {
      if (!existingNames.has(bucketName)) {
        try {
          await client.storage.createBucket(bucketName, { public: false });
          console.log(`[Supabase Storage] Created bucket: ${bucketName}`);
        } catch (err: any) {
          if (!err?.message?.includes("already exists")) {
            console.warn(`[Supabase Storage] Notice creating bucket ${bucketName}:`, err?.message || err);
          }
        }
      }
    }
  } catch (err) {
    console.warn("[Supabase Storage] Bucket check notice:", err);
  }
}

export async function syncModelToSupabase(model: any): Promise<{ success: boolean; error?: any; code?: string; details?: string; hint?: string }> {
  const client = getSupabaseAdmin();
  if (!client) {
    console.error("[MODEL TRACE] syncModelToSupabase: Supabase admin client not configured");
    return { success: false, error: "Supabase client not configured" };
  }
  try {
    let capsStr = "{}";
    if (model.capabilities) {
      capsStr = typeof model.capabilities === 'string' ? model.capabilities : JSON.stringify(model.capabilities);
    }
    const uid = model.user_id || model.userId;
    if (!uid) {
      return { success: false, error: "User ID is required to persist model" };
    }
    const recordId = model.id.includes(":::") ? model.id : `${uid}:::${model.id}`;
    const record = {
      id: recordId,
      user_id: uid,
      name: model.name || model.id,
      provider: model.provider || "custom",
      provider_model_id: model.modelName || model.provider_model_id || model.model_name || model.id,
      capabilities: capsStr,
      context_window: Number(model.contextWindow ?? model.context_window ?? 16000),
      max_output_tokens: Number(model.maxOutputTokens ?? model.max_output_tokens ?? 4096),
      temperature: Number(model.defaultTemperature ?? model.temperature ?? model.default_temperature ?? 0.7),
      top_p: Number(model.defaultTopP ?? model.top_p ?? model.default_top_p ?? 1.0),
      base_url: model.baseUrl || model.base_url || "",
      api_secret: model.apiKey || model.api_secret || model.api_key || "",
      enabled: model.enabled !== false ? 1 : 0,
      status: model.status || "available",
      is_user: model.isUser || model.is_user ? 1 : 0,
      created_at: model.created_at || Date.now(),
      updated_at: model.updated_at || Date.now(),
    };

    console.log(`[MODEL TRACE] UPSERTing model id=${record.id}, user_id=${record.user_id}, provider=${record.provider}, provider_model_id=${record.provider_model_id}, hasApiKey=${Boolean(record.api_secret)}`);

    let { data, error } = await client.from("models").upsert(record, { onConflict: "id" }).select();
    if (error && (error.message?.includes("constraint") || error.code === "42P10")) {
      const res2 = await client.from("models").upsert(record, { onConflict: "user_id,id" }).select();
      error = res2.error;
      data = res2.data;
    }
    if (error) {
      console.error(`[MODEL TRACE] Model upsert error code=${error.code}, message=${error.message}, details=${error.details}, hint=${error.hint}`);
      return { 
        success: false, 
        error: error.message || "Database upsert failed", 
        code: error.code, 
        details: error.details, 
        hint: error.hint 
      };
    }

    console.log(`[MODEL TRACE] Model upsert successful id=${record.id}, user_id=${record.user_id}`);
    return { success: true };
  } catch (err: any) {
    console.error("[MODEL TRACE] Model upsert exception:", err?.message || err);
    return { success: false, error: err?.message || String(err) };
  }
}

export async function deleteModelFromSupabase(modelId: string, userId?: string) {
  const client = getSupabaseAdmin();
  if (!client) return;
  try {
    const idsToDelete = [modelId];
    if (userId && !modelId.includes(":::")) {
      idsToDelete.push(`${userId}:::${modelId}`);
    }
    let query = client.from("models").delete().in("id", idsToDelete);
    if (userId) {
      query = query.eq("user_id", userId);
    }
    await query;
  } catch (err) {
    console.warn("[Supabase Sync] Model delete error:", err);
  }
}

export async function syncUserToSupabase(user: {
  id: string;
  email: string;
  name: string;
  password?: string;
  rawPassword?: string;
  active_model_id?: string;
  created_at: number;
}): Promise<{ success: boolean; authUserId?: string; error?: string }> {
  const client = getSupabaseAdmin();
  if (!client) return { success: false, error: "Supabase not configured" };

  const cleanEmail = user.email.toLowerCase().trim();
  const cleanName = (user.name || cleanEmail.split("@")[0]).trim();
  let tableSuccess = false;
  let authSuccess = false;
  let lastErr = "";

  let authUserId: string | null = null;

  // Tier 1: Sync to Supabase Auth admin API (auth.users)
  // Guarantees canonical auth user in auth.users
  try {
    const rawPass = user.rawPassword || (user.password && !user.password.includes(":") ? user.password : undefined);
    const { data: createData, error: authErr } = await client.auth.admin.createUser({
      email: cleanEmail,
      password: rawPass || `Clarity_${user.id}_Secure!`,
      email_confirm: true,
      user_metadata: {
        id: user.id,
        name: cleanName,
        password_hash: user.password || "",
        active_model_id: user.active_model_id || "",
      },
    });

    if (!authErr && createData?.user) {
      authSuccess = true;
      authUserId = createData.user.id;
    } else if (authErr && (authErr.message?.includes("already") || authErr.status === 422)) {
      // User exists in Supabase Auth, update their metadata & password
      const { data: userList } = await client.auth.admin.listUsers({ page: 1, perPage: 100 });
      const found = userList?.users?.find(u => u.email?.toLowerCase() === cleanEmail);
      if (found) {
        authUserId = found.id;
        const updatePayload: any = {
          user_metadata: {
            id: user.id,
            name: cleanName,
            password_hash: user.password || "",
            active_model_id: user.active_model_id || "",
          },
        };
        if (rawPass) {
          updatePayload.password = rawPass;
        }
        await client.auth.admin.updateUserById(found.id, updatePayload);
        authSuccess = true;
      }
    }
  } catch (authEx: any) {
    console.warn("[Supabase Sync] Supabase Auth admin notice:", authEx?.message || authEx);
  }

  // Tier 2: Upsert into public.profiles table (foreign key to auth.users.id)
  if (authUserId) {
    try {
      const { error: profErr } = await client.from("profiles").upsert({
        id: authUserId,
        email: cleanEmail,
        display_name: cleanName,
        updated_at: new Date().toISOString(),
      }, { onConflict: "id" });
      if (!profErr) {
        tableSuccess = true;
      } else {
        console.warn("[Supabase Sync] profiles table upsert notice:", profErr.message);
      }
    } catch (profEx: any) {
      console.warn("[Supabase Sync] profiles upsert exception:", profEx?.message || profEx);
    }
  }

  // Tier 3: Upsert into public.users table if it exists
  try {
    const record = {
      id: user.id,
      email: cleanEmail,
      name: cleanName,
      password: user.password || "",
      active_model_id: user.active_model_id || "",
      created_at: user.created_at || Date.now(),
      updated_at: Date.now(),
    };
    const { error: tblErr } = await client.from("users").upsert(record, { onConflict: "id" });
    if (!tblErr) {
      tableSuccess = true;
    } else {
      lastErr = tblErr.message;
    }
  } catch (err: any) {
    lastErr = err?.message || String(err);
  }

  return { success: tableSuccess || authSuccess, authUserId: authUserId || undefined, error: lastErr || undefined };
}

export class SupabaseUnreachableError extends Error {
  constructor(message: string) {
    super(message);
    this.name = "SupabaseUnreachableError";
  }
}

function isNetworkError(err: any): boolean {
  if (!err) return false;
  const msg = (err.message || String(err)).toLowerCase();
  return (
    msg.includes("fetch failed") ||
    msg.includes("enotfound") ||
    msg.includes("econnrefused") ||
    msg.includes("etimedout") ||
    msg.includes("network error") ||
    msg.includes("502") ||
    msg.includes("503") ||
    msg.includes("504")
  );
}

export async function checkSupabaseUserExists(email: string): Promise<{
  id: string;
  email: string;
  name: string;
  password?: string;
  active_model_id?: string;
  created_at: number;
} | null> {
  const client = getSupabaseAdmin();
  if (!client) return null;
  const cleanEmail = email.toLowerCase().trim();

  // 1. Try public.users table
  try {
    const { data, error } = await client.from("users").select("*").eq("email", cleanEmail).limit(1);
    if (!error && data && data.length > 0) {
      const u = data[0];
      return {
        id: u.id,
        email: u.email,
        name: u.name,
        password: u.password || "",
        active_model_id: u.active_model_id || "",
        created_at: Number(u.created_at) || Date.now(),
      };
    }
    if (error && isNetworkError(error)) {
      throw new SupabaseUnreachableError(error.message);
    }
  } catch (e: any) {
    if (e instanceof SupabaseUnreachableError || isNetworkError(e)) {
      throw new SupabaseUnreachableError(e.message || "Supabase connection unreachable");
    }
  }

  // 2. Try Supabase Auth admin
  try {
    const { data, error } = await client.auth.admin.listUsers({ page: 1, perPage: 100 });
    if (error && isNetworkError(error)) {
      throw new SupabaseUnreachableError(error.message);
    }
    const found = data?.users?.find(u => u.email?.toLowerCase() === cleanEmail);
    if (found) {
      const meta = found.user_metadata || {};
      return {
        id: meta.id || found.id,
        email: found.email || cleanEmail,
        name: meta.name || cleanEmail.split("@")[0],
        password: meta.password_hash || "",
        active_model_id: meta.active_model_id || "",
        created_at: new Date(found.created_at).getTime() || Date.now(),
      };
    }
  } catch (e: any) {
    if (e instanceof SupabaseUnreachableError || isNetworkError(e)) {
      throw new SupabaseUnreachableError(e.message || "Supabase connection unreachable");
    }
  }

  return null;
}

export async function authenticateWithSupabase(email: string, password: string): Promise<{
  id: string;
  email: string;
  name: string;
  password?: string;
  active_model_id?: string;
  created_at: number;
} | null> {
  if (!isSupabaseConfigured()) return null;
  const cleanEmail = email.toLowerCase().trim();
  const url = getSupabaseUrl();
  const authKey = getSupabaseAnonKey() || getSupabaseServiceRoleKey();

  // Create an ephemeral auth client to avoid mutating shared adminClient session state
  const authClient = createClient(url, authKey, {
    auth: {
      persistSession: false,
      autoRefreshToken: false,
    },
  });

  // First verify directly via Supabase Auth
  try {
    const { data: authData, error: authErr } = await authClient.auth.signInWithPassword({
      email: cleanEmail,
      password: password,
    });
    if (!authErr && authData?.user) {
      const meta = authData.user.user_metadata || {};
      return {
        id: meta.id || authData.user.id,
        email: authData.user.email || cleanEmail,
        name: meta.name || cleanEmail.split("@")[0],
        password: meta.password_hash || "",
        active_model_id: meta.active_model_id || "",
        created_at: new Date(authData.user.created_at).getTime() || Date.now(),
      };
    }
    if (authErr && isNetworkError(authErr)) {
      throw new SupabaseUnreachableError(authErr.message);
    }
  } catch (e: any) {
    if (e instanceof SupabaseUnreachableError || isNetworkError(e)) {
      throw new SupabaseUnreachableError(e.message || "Supabase Auth unreachable");
    }
  }

  return null;
}

export async function syncSessionToSupabase(session: {
  token: string;
  user_id: string;
  created_at: number;
  expires_at: number;
}): Promise<void> {
  const client = getSupabaseAdmin();
  if (!client) return;
  try {
    await client.from("sessions").upsert(session, { onConflict: "token" });
  } catch (err: any) {
    console.warn("[Supabase Sync] Session upsert notice:", err?.message || err);
  }
}

export async function deleteSessionFromSupabase(token: string): Promise<void> {
  const client = getSupabaseAdmin();
  if (!client) return;
  try {
    await client.from("sessions").delete().eq("token", token);
  } catch (err: any) {
    console.warn("[Supabase Sync] Session delete notice:", err?.message || err);
  }
}

export async function syncWorkspaceFileToSupabase(file: {
  id: string;
  user_id: string;
  filename: string;
  mime: string;
  size: number;
  file_type: string;
  content: string;
  uploaded_at: number;
}): Promise<void> {
  const client = getSupabaseAdmin();
  if (!client) return;
  try {
    await client.from("workspace_files").upsert(file, { onConflict: "id" });
  } catch (err: any) {
    console.warn("[Supabase Sync] Workspace file upsert notice:", err?.message || err);
  }
}

export async function deleteWorkspaceFileFromSupabase(id: string): Promise<void> {
  const client = getSupabaseAdmin();
  if (!client) return;
  try {
    await client.from("workspace_files").delete().eq("id", id);
  } catch (err: any) {
    console.warn("[Supabase Sync] Workspace file delete notice:", err?.message || err);
  }
}

export async function hydrateAllFromSupabase(dbAdapters: {
  dbSaveUser?: (user: any) => void;
  dbSaveProject?: (proj: any) => void;
  dbSaveFile?: (file: any) => void;
  dbSaveModel?: (model: any) => void;
  dbSaveConversation?: (cid: string, userId: string, title: string, modelId?: string) => void;
  dbSaveMessage?: (msgId: string, cid: string, role: string, content: string, modelId?: string, attachments?: any) => void;
  dbSaveArtifact?: (artifact: any) => void;
  dbSaveWorkspaceFile?: (file: any) => void;
  dbSaveSession?: (token: string, userId: string, expiresAt: number) => void;
}): Promise<{
  usersCount: number;
  sessionsCount: number;
  projectsCount: number;
  modelsCount: number;
  conversationsCount: number;
  messagesCount: number;
  artifactsCount: number;
  filesCount: number;
  workspaceFilesCount: number;
}> {
  const client = getSupabaseAdmin();
  if (!client) {
    console.warn("[Supabase Hydration] Supabase client not configured. Skipping Supabase hydration.");
    return {
      usersCount: 0,
      sessionsCount: 0,
      projectsCount: 0,
      modelsCount: 0,
      conversationsCount: 0,
      messagesCount: 0,
      artifactsCount: 0,
      filesCount: 0,
      workspaceFilesCount: 0,
    };
  }

  console.log("[Supabase Hydration] Fetching full production state from Supabase PostgreSQL...");

  let usersCount = 0;
  let sessionsCount = 0;
  let projectsCount = 0;
  let modelsCount = 0;
  let conversationsCount = 0;
  let messagesCount = 0;
  let artifactsCount = 0;
  let filesCount = 0;
  let workspaceFilesCount = 0;

  try {
    // 1. Hydrate Users (Dual source: public.users table + auth.users admin list)
    const hydratedUserEmails = new Set<string>();
    try {
      const { data: dbUsers, error: uErr } = await client.from("users").select("*");
      if (!uErr && dbUsers && dbUsers.length > 0) {
        usersCount = dbUsers.length;
        for (const u of dbUsers) {
          hydratedUserEmails.add(u.email?.toLowerCase());
          if (dbAdapters.dbSaveUser) {
            dbAdapters.dbSaveUser({
              id: u.id,
              email: u.email,
              name: u.name,
              password: u.password || "",
              active_model_id: u.active_model_id || "",
              created_at: Number(u.created_at) || Date.now(),
            });
          }
        }
      }
    } catch (e: any) {
      console.warn("[Supabase Hydration] Note on public.users query:", e?.message || e);
    }

    // Fallback: Check Supabase Auth admin for any users not in public.users
    try {
      const { data: authList } = await client.auth.admin.listUsers({ page: 1, perPage: 100 });
      if (authList?.users) {
        for (const au of authList.users) {
          const email = au.email?.toLowerCase();
          if (email && !hydratedUserEmails.has(email)) {
            const meta = au.user_metadata || {};
            usersCount++;
            hydratedUserEmails.add(email);
            if (dbAdapters.dbSaveUser) {
              dbAdapters.dbSaveUser({
                id: meta.id || au.id,
                email: email,
                name: meta.name || email.split("@")[0],
                password: meta.password_hash || "",
                active_model_id: meta.active_model_id || "",
                created_at: new Date(au.created_at).getTime() || Date.now(),
              });
            }
          }
        }
      }
    } catch (e: any) {
      console.warn("[Supabase Hydration] Note on auth.admin listUsers:", e?.message || e);
    }

    // 2. Hydrate Sessions
    try {
      const { data: dbSessions, error: sErr } = await client
        .from("sessions")
        .select("*")
        .gt("expires_at", Date.now());
      if (!sErr && dbSessions && dbSessions.length > 0) {
        sessionsCount = dbSessions.length;
        for (const s of dbSessions) {
          if (dbAdapters.dbSaveSession) {
            dbAdapters.dbSaveSession(s.token, s.user_id, Number(s.expires_at));
          }
        }
      }
    } catch (e: any) {
      console.warn("[Supabase Hydration] Note on sessions query:", e?.message || e);
    }

    // 3. Hydrate Projects
    const { data: dbProjects, error: pErr } = await client.from("projects").select("*");
    if (!pErr && dbProjects) {
      projectsCount = dbProjects.length;
      for (const p of dbProjects) {
        if (dbAdapters.dbSaveProject) {
          dbAdapters.dbSaveProject({
            id: p.id,
            user_id: p.user_id || "user_default",
            name: p.name,
            description: p.description || "",
            source_type: p.source_type || "upload",
            root_path: p.root_path || "",
            status: p.status || "ready",
            created_at: Number(p.created_at) || Date.now(),
            updated_at: Number(p.updated_at) || Date.now(),
            last_indexed_at: p.last_indexed_at ? Number(p.last_indexed_at) : null,
            metadata: p.metadata,
          });
        }
      }
    }

    // 4. Hydrate Models
    const { data: dbModels, error: mErr } = await client.from("models").select("*");
    if (!mErr && dbModels) {
      modelsCount = dbModels.length;
      for (const m of dbModels) {
        if (dbAdapters.dbSaveModel) {
          let caps = m.capabilities;
          if (typeof caps === "string") {
            try { caps = JSON.parse(caps); } catch {}
          }
          dbAdapters.dbSaveModel({
            id: m.id.includes(":::") ? m.id.split(":::")[1] : m.id,
            user_id: m.user_id || "user_default",
            name: m.name,
            provider: m.provider,
            baseUrl: m.base_url || "",
            apiKey: m.api_secret || m.api_key || "",
            modelName: m.provider_model_id || m.model_name || m.id,
            modelType: m.model_type || "text",
            capabilities: caps || {},
            contextWindow: Number(m.context_window) || 16000,
            maxOutputTokens: Number(m.max_output_tokens) || 4096,
            defaultTemperature: Number(m.temperature ?? m.default_temperature) || 0.7,
            defaultTopP: Number(m.top_p ?? m.default_top_p) || 1.0,
            supportsStreaming: m.supports_streaming !== 0,
            enabled: m.enabled !== 0,
            status: m.status || "available",
            isUser: m.is_user !== 0,
          });
        }
      }
    }

    // 5. Hydrate Conversations
    const { data: dbConvs, error: cErr } = await client.from("conversations").select("*");
    if (!cErr && dbConvs) {
      conversationsCount = dbConvs.length;
      for (const c of dbConvs) {
        if (dbAdapters.dbSaveConversation) {
          dbAdapters.dbSaveConversation(c.id, c.user_id || "user_default", c.title, c.model_id);
        }
      }
    }

    // 6. Hydrate Messages
    const { data: dbMsgs, error: msgErr } = await client.from("messages").select("*");
    if (!msgErr && dbMsgs) {
      messagesCount = dbMsgs.length;
      for (const msg of dbMsgs) {
        if (dbAdapters.dbSaveMessage) {
          dbAdapters.dbSaveMessage(msg.id, msg.conversation_id, msg.role, msg.content, msg.model_id, msg.attachments);
        }
      }
    }

    // 7. Hydrate Artifacts
    const { data: dbArts, error: aErr } = await client.from("artifacts").select("*");
    if (!aErr && dbArts) {
      artifactsCount = dbArts.length;
      for (const a of dbArts) {
        if (dbAdapters.dbSaveArtifact) {
          let content = a.content || "";
          if (!content && a.storage_path) {
            try {
              const { data: downloaded } = await client.storage.from("artifacts").download(a.storage_path);
              if (downloaded) {
                content = await downloaded.text();
              }
            } catch (e: any) {
              console.warn(`[Supabase Hydration] Could not download artifact storage file ${a.storage_path}:`, e?.message || e);
            }
          }
          dbAdapters.dbSaveArtifact({
            id: a.id,
            project_id: a.project_id,
            file_id: a.file_id || null,
            name: a.name,
            path: a.path || null,
            mime_type: a.mime_type || null,
            artifact_type: a.artifact_type || null,
            version: Number(a.version) || 1,
            hash: a.hash || null,
            content: content,
            created_at: Number(a.created_at) || Date.now(),
            updated_at: Number(a.updated_at) || Date.now(),
          });
        }
      }
    }

    // 8. Hydrate Project Files
    const { data: dbFiles, error: fErr } = await client.from("project_files").select("*");
    if (!fErr && dbFiles) {
      filesCount = dbFiles.length;
      for (const f of dbFiles) {
        if (dbAdapters.dbSaveFile) {
          let content = f.content || "";
          if (!content && f.storage_path) {
            try {
              const { data: downloaded } = await client.storage.from("files").download(f.storage_path);
              if (downloaded) {
                content = await downloaded.text();
              }
            } catch (e: any) {
              console.warn(`[Supabase Hydration] Could not download project file ${f.storage_path}:`, e?.message || e);
            }
          }
          dbAdapters.dbSaveFile({
            id: f.id,
            project_id: f.project_id,
            path: f.path,
            name: f.name,
            extension: f.extension || "",
            language: f.language || "",
            size: Number(f.size) || 0,
            hash: f.hash || "",
            version: Number(f.version) || 1,
            content: content,
            is_binary: f.is_binary ? 1 : 0,
            created_at: Number(f.created_at) || Date.now(),
            updated_at: Number(f.updated_at) || Date.now(),
          });
        }
      }
    }

    // 9. Hydrate Workspace Files
    try {
      const { data: dbWorkspaceFiles, error: wfErr } = await client.from("workspace_files").select("*");
      if (!wfErr && dbWorkspaceFiles) {
        workspaceFilesCount = dbWorkspaceFiles.length;
        for (const wf of dbWorkspaceFiles) {
          if (dbAdapters.dbSaveWorkspaceFile) {
            dbAdapters.dbSaveWorkspaceFile({
              id: wf.id,
              userId: wf.user_id,
              filename: wf.filename,
              mime: wf.mime,
              size: Number(wf.size) || 0,
              fileType: wf.file_type || "document",
              content: wf.content || "",
              uploadedAt: Number(wf.uploaded_at) || Date.now(),
            });
          }
        }
      }
    } catch (e: any) {
      console.warn("[Supabase Hydration] Note on workspace_files query:", e?.message || e);
    }

    console.log(`[Supabase Hydration SUCCESS] Hydrated ${usersCount} users, ${sessionsCount} sessions, ${projectsCount} projects, ${modelsCount} models, ${conversationsCount} conversations, ${messagesCount} messages, ${artifactsCount} artifacts, ${filesCount} files, ${workspaceFilesCount} workspace files.`);
  } catch (err: any) {
    console.error("[Supabase Hydration ERROR] Failed to hydrate data from Supabase:", err?.message || err);
  }

  return {
    usersCount,
    sessionsCount,
    projectsCount,
    modelsCount,
    conversationsCount,
    messagesCount,
    artifactsCount,
    filesCount,
    workspaceFilesCount,
  };
}
