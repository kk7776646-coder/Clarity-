import os
import sqlite3
import threading
from typing import Any

def _get_db_path() -> str:
    env_path = os.environ.get("DATABASE_PATH", "").strip()
    if env_path:
        return os.path.abspath(env_path)
    # Render (and most PaaS) provide a persistent disk at /var/data. The source
    # tree is ephemeral and is wiped on every deploy/restart, so writing the
    # SQLite file under server/data would lose every session on each redeploy.
    render_path = "/var/data/nexus.db"
    if os.path.isdir("/var/data"):
        return render_path
    return os.path.join(os.path.dirname(os.path.dirname(os.path.abspath(__file__))), "data", "nexus.db")

_LOCK = threading.Lock()
_initialized = False

SCHEMA = """
CREATE TABLE IF NOT EXISTS users (
    id TEXT PRIMARY KEY,
    email TEXT NOT NULL UNIQUE,
    name TEXT,
    password_hash TEXT NOT NULL,
    created_at REAL NOT NULL,
    last_login_at REAL
);
CREATE TABLE IF NOT EXISTS sessions (
    token TEXT PRIMARY KEY,
    user_id TEXT NOT NULL,
    created_at REAL NOT NULL,
    expires_at REAL NOT NULL,
    FOREIGN KEY (user_id) REFERENCES users(id) ON DELETE CASCADE
);
CREATE TABLE IF NOT EXISTS conversations (
    id TEXT PRIMARY KEY,
    user_id TEXT,
    title TEXT NOT NULL,
    model_id TEXT,
    created_at REAL NOT NULL,
    updated_at REAL NOT NULL,
    FOREIGN KEY (user_id) REFERENCES users(id) ON DELETE CASCADE
);
CREATE TABLE IF NOT EXISTS messages (
    id TEXT PRIMARY KEY,
    conversation_id TEXT NOT NULL,
    role TEXT NOT NULL,
    content TEXT NOT NULL,
    model_id TEXT,
    timestamp REAL NOT NULL,
    FOREIGN KEY (conversation_id) REFERENCES conversations(id) ON DELETE CASCADE
);
CREATE TABLE IF NOT EXISTS message_attachments (
    id TEXT PRIMARY KEY,
    message_id TEXT NOT NULL,
    file_id TEXT NOT NULL,
    name TEXT,
    mime TEXT,
    FOREIGN KEY (message_id) REFERENCES messages(id) ON DELETE CASCADE
);
CREATE TABLE IF NOT EXISTS files (
    id TEXT PRIMARY KEY,
    user_id TEXT,
    conversation_id TEXT,
    filename TEXT NOT NULL,
    mime TEXT NOT NULL,
    size INTEGER NOT NULL,
    uploaded_at REAL NOT NULL,
    path TEXT NOT NULL,
    file_type TEXT,
    processed INTEGER DEFAULT 0,
    FOREIGN KEY (user_id) REFERENCES users(id) ON DELETE CASCADE
);
CREATE TABLE IF NOT EXISTS projects (
    id TEXT PRIMARY KEY,
    user_id TEXT,
    name TEXT NOT NULL,
    created_at REAL NOT NULL,
    description TEXT,
    FOREIGN KEY (user_id) REFERENCES users(id) ON DELETE CASCADE
);
CREATE TABLE IF NOT EXISTS project_files (
    id TEXT PRIMARY KEY,
    project_id TEXT NOT NULL,
    file_id TEXT,
    path TEXT NOT NULL,
    name TEXT NOT NULL,
    ext TEXT NOT NULL,
    file_type TEXT,
    content TEXT,
    size INTEGER NOT NULL,
    FOREIGN KEY (project_id) REFERENCES projects(id) ON DELETE CASCADE,
    FOREIGN KEY (file_id) REFERENCES files(id) ON DELETE SET NULL
);
CREATE TABLE IF NOT EXISTS model_configs (
    id TEXT PRIMARY KEY,
    user_id TEXT,
    name TEXT NOT NULL,
    provider TEXT NOT NULL,
    base_url TEXT,
    api_key TEXT,
    model_name TEXT,
    model_type TEXT,
    capabilities TEXT,
    context_window INTEGER,
    max_output_tokens INTEGER,
    default_temperature REAL,
    default_top_p REAL DEFAULT 1.0,
    top_p REAL DEFAULT 1.0,
    supports_streaming INTEGER,
    enabled INTEGER DEFAULT 1,
    status TEXT DEFAULT 'untested',
    last_tested_at REAL,
    last_error TEXT,
    is_active INTEGER DEFAULT 0,
    created_at REAL NOT NULL,
    FOREIGN KEY (user_id) REFERENCES users(id) ON DELETE CASCADE
);
CREATE TABLE IF NOT EXISTS embeddings (
    id TEXT PRIMARY KEY,
    project_id TEXT NOT NULL,
    file_path TEXT NOT NULL,
    chunk_index INTEGER NOT NULL,
    content TEXT NOT NULL,
    vector TEXT,
    FOREIGN KEY (project_id) REFERENCES projects(id) ON DELETE CASCADE
);
CREATE INDEX IF NOT EXISTS idx_messages_conv ON messages(conversation_id);
CREATE INDEX IF NOT EXISTS idx_files_conv ON files(conversation_id);
CREATE INDEX IF NOT EXISTS idx_proj_files ON project_files(project_id);
CREATE INDEX IF NOT EXISTS idx_embeddings_proj ON embeddings(project_id);

-- Whole-project analysis: versions, runs, evidence, knowledge claims and
-- debug sessions. Added as separate tables alongside the existing schema;
-- no existing tables or columns are dropped or renamed.
CREATE TABLE IF NOT EXISTS project_versions (
    id TEXT PRIMARY KEY,
    project_id TEXT NOT NULL,
    version_number INTEGER NOT NULL,
    label TEXT,
    source TEXT,
    created_at REAL NOT NULL,
    file_count INTEGER DEFAULT 0,
    note TEXT,
    FOREIGN KEY (project_id) REFERENCES projects(id) ON DELETE CASCADE
);
CREATE TABLE IF NOT EXISTS analysis_runs (
    id TEXT PRIMARY KEY,
    project_id TEXT NOT NULL,
    version_id TEXT,
    user_id TEXT,
    status TEXT NOT NULL DEFAULT 'pending',
    stage TEXT NOT NULL DEFAULT 'scanning',
    started_at REAL NOT NULL,
    completed_at REAL,
    files_discovered INTEGER DEFAULT 0,
    files_analyzed INTEGER DEFAULT 0,
    chunks_indexed INTEGER DEFAULT 0,
    error_count INTEGER DEFAULT 0,
    warning_count INTEGER DEFAULT 0,
    model_id TEXT,
    detail TEXT,
    FOREIGN KEY (project_id) REFERENCES projects(id) ON DELETE CASCADE,
    FOREIGN KEY (version_id) REFERENCES project_versions(id) ON DELETE SET NULL
);
CREATE TABLE IF NOT EXISTS evidence (
    id TEXT PRIMARY KEY,
    project_id TEXT NOT NULL,
    version_id TEXT,
    run_id TEXT,
    project_file_id TEXT,
    path TEXT,
    symbol TEXT,
    line_start INTEGER,
    line_end INTEGER,
    observation TEXT,
    evidence_type TEXT,
    confidence TEXT,
    created_at REAL NOT NULL,
    FOREIGN KEY (project_id) REFERENCES projects(id) ON DELETE CASCADE,
    FOREIGN KEY (version_id) REFERENCES project_versions(id) ON DELETE SET NULL,
    FOREIGN KEY (run_id) REFERENCES analysis_runs(id) ON DELETE SET NULL,
    FOREIGN KEY (project_file_id) REFERENCES project_files(id) ON DELETE SET NULL
);
CREATE TABLE IF NOT EXISTS knowledge_claims (
    id TEXT PRIMARY KEY,
    project_id TEXT NOT NULL,
    version_id TEXT,
    run_id TEXT,
    statement TEXT NOT NULL,
    category TEXT,
    confidence TEXT,
    status TEXT NOT NULL DEFAULT 'inferred',
    created_at REAL NOT NULL,
    updated_at REAL NOT NULL,
    FOREIGN KEY (project_id) REFERENCES projects(id) ON DELETE CASCADE,
    FOREIGN KEY (version_id) REFERENCES project_versions(id) ON DELETE SET NULL,
    FOREIGN KEY (run_id) REFERENCES analysis_runs(id) ON DELETE SET NULL
);
CREATE TABLE IF NOT EXISTS knowledge_claim_evidence (
    claim_id TEXT NOT NULL,
    evidence_id TEXT NOT NULL,
    PRIMARY KEY (claim_id, evidence_id),
    FOREIGN KEY (claim_id) REFERENCES knowledge_claims(id) ON DELETE CASCADE,
    FOREIGN KEY (evidence_id) REFERENCES evidence(id) ON DELETE CASCADE
);
CREATE TABLE IF NOT EXISTS debug_sessions (
    id TEXT PRIMARY KEY,
    project_id TEXT,
    version_id TEXT,
    user_id TEXT,
    error_text TEXT,
    stack_trace TEXT,
    source_context TEXT,
    affected_files TEXT,
    affected_functions TEXT,
    root_cause TEXT,
    suggested_fix TEXT,
    generated_diff TEXT,
    validation TEXT,
    test_result TEXT,
    build_result TEXT,
    confidence TEXT,
    started_at REAL NOT NULL,
    completed_at REAL,
    FOREIGN KEY (project_id) REFERENCES projects(id) ON DELETE SET NULL,
    FOREIGN KEY (version_id) REFERENCES project_versions(id) ON DELETE SET NULL,
    FOREIGN KEY (user_id) REFERENCES users(id) ON DELETE SET NULL
);
CREATE INDEX IF NOT EXISTS idx_project_versions_proj ON project_versions(project_id);
CREATE INDEX IF NOT EXISTS idx_analysis_runs_proj ON analysis_runs(project_id);
CREATE INDEX IF NOT EXISTS idx_analysis_runs_ver ON analysis_runs(version_id);
CREATE INDEX IF NOT EXISTS idx_evidence_proj ON evidence(project_id);
CREATE INDEX IF NOT EXISTS idx_evidence_run ON evidence(run_id);
CREATE INDEX IF NOT EXISTS idx_claims_proj ON knowledge_claims(project_id);
CREATE INDEX IF NOT EXISTS idx_claims_run ON knowledge_claims(run_id);
CREATE INDEX IF NOT EXISTS idx_debug_user ON debug_sessions(user_id);

CREATE TABLE IF NOT EXISTS code_relationships (
    id TEXT PRIMARY KEY,
    project_id TEXT NOT NULL,
    version_id TEXT,
    from_file_path TEXT,
    from_symbol TEXT,
    relationship_type TEXT,
    to_file_path TEXT,
    to_symbol TEXT,
    evidence_ref TEXT,
    confidence TEXT DEFAULT 'medium',
    created_at REAL NOT NULL,
    FOREIGN KEY (project_id) REFERENCES projects(id) ON DELETE CASCADE,
    FOREIGN KEY (version_id) REFERENCES project_versions(id) ON DELETE SET NULL
);
CREATE INDEX IF NOT EXISTS idx_relationships_project ON code_relationships(project_id);
CREATE INDEX IF NOT EXISTS idx_relationships_version ON code_relationships(version_id);
CREATE TABLE IF NOT EXISTS patches (
    id TEXT PRIMARY KEY,
    user_id TEXT NOT NULL,
    project_id TEXT NOT NULL,
    version_id TEXT,
    title TEXT NOT NULL,
    request TEXT,
    reason TEXT,
    root_cause TEXT,
    files_changed_json TEXT,
    diff_text TEXT,
    evidence_refs_json TEXT,
    risk_level TEXT DEFAULT 'LOW',
    status TEXT NOT NULL DEFAULT 'PROPOSED',
    created_at REAL NOT NULL,
    FOREIGN KEY (project_id) REFERENCES projects(id) ON DELETE CASCADE,
    FOREIGN KEY (user_id) REFERENCES users(id) ON DELETE CASCADE
);
CREATE INDEX IF NOT EXISTS idx_patches_project ON patches(project_id);
CREATE INDEX IF NOT EXISTS idx_patches_version ON patches(version_id);
CREATE INDEX IF NOT EXISTS idx_patches_user ON patches(user_id);
CREATE INDEX IF NOT EXISTS idx_patches_status ON patches(status);
CREATE TABLE IF NOT EXISTS project_chunks (
    id TEXT PRIMARY KEY,
    project_id TEXT NOT NULL,
    version_id TEXT,
    run_id TEXT,
    chunk_index INTEGER NOT NULL DEFAULT 0,
    file_path TEXT NOT NULL,
    file_id TEXT,
    symbol_name TEXT,
    symbol_type TEXT,
    chunk_type TEXT NOT NULL DEFAULT 'file',
    language TEXT,
    line_start INTEGER,
    line_end INTEGER,
    content TEXT NOT NULL,
    content_hash TEXT,
    embedding_id TEXT,
    created_at REAL NOT NULL DEFAULT (unixepoch()),
    FOREIGN KEY (project_id) REFERENCES projects(id) ON DELETE CASCADE,
    FOREIGN KEY (version_id) REFERENCES project_versions(id) ON DELETE SET NULL,
    FOREIGN KEY (run_id) REFERENCES analysis_runs(id) ON DELETE SET NULL,
    FOREIGN KEY (file_id) REFERENCES project_files(id) ON DELETE SET NULL
);
CREATE INDEX IF NOT EXISTS idx_project_chunks_proj ON project_chunks(project_id);
CREATE INDEX IF NOT EXISTS idx_project_chunks_ver ON project_chunks(version_id);
CREATE INDEX IF NOT EXISTS idx_project_chunks_run ON project_chunks(run_id);
CREATE TABLE IF NOT EXISTS project_architecture (
    id TEXT PRIMARY KEY,
    project_id TEXT NOT NULL,
    version_id TEXT,
    user_id TEXT,
    nodes_json TEXT,
    edges_json TEXT,
    modules_json TEXT,
    metrics_json TEXT,
    risks_json TEXT,
    created_at REAL NOT NULL DEFAULT (unixepoch()),
    FOREIGN KEY (project_id) REFERENCES projects(id) ON DELETE CASCADE,
    FOREIGN KEY (version_id) REFERENCES project_versions(id) ON DELETE SET NULL,
    FOREIGN KEY (user_id) REFERENCES users(id) ON DELETE SET NULL
);
CREATE INDEX IF NOT EXISTS idx_project_arch_proj ON project_architecture(project_id);
CREATE INDEX IF NOT EXISTS idx_project_arch_ver ON project_architecture(version_id);
"""

# Columns added after the first release. Applied only when missing so existing
# databases keep their rows.
_MIGRATIONS: list[tuple[str, str, str]] = [
    ("conversations", "user_id", "TEXT"),
    ("files", "user_id", "TEXT"),
    ("projects", "user_id", "TEXT"),
    ("project_files", "file_type", "TEXT"),
    ("model_configs", "user_id", "TEXT"),
    ("model_configs", "model_name", "TEXT"),
    ("model_configs", "top_p", "REAL DEFAULT 1.0"),
    ("model_configs", "enabled", "INTEGER DEFAULT 1"),
    ("model_configs", "status", "TEXT DEFAULT 'untested'"),
    ("model_configs", "last_tested_at", "REAL"),
    ("model_configs", "last_error", "TEXT"),
    ("users", "last_login_at", "REAL"),
    ("users", "active_model_id", "TEXT"),
    ("project_files", "hash", "TEXT"),
    ("project_files", "version_id", "TEXT"),
    ("code_relationships", "version_id", "TEXT"),
]


def _ensure_dirs() -> None:
    db_path = _get_db_path()
    parent = os.path.dirname(os.path.abspath(db_path))
    if parent and not os.path.isdir(parent):
        try:
            os.makedirs(parent, exist_ok=True)
        except OSError:
            # On Render, /var/data is provided as a pre-mounted persistent disk.
            # If for some reason it is not present, fall through and let sqlite
            # raise its own error rather than masking the misconfiguration.
            pass


def _get_conn() -> sqlite3.Connection:
    _ensure_dirs()
    conn = sqlite3.connect(_get_db_path())
    conn.row_factory = sqlite3.Row
    conn.execute("PRAGMA journal_mode=WAL")
    conn.execute("PRAGMA foreign_keys=ON")
    return conn


def _table_columns(conn: sqlite3.Connection, table: str) -> set[str]:
    return {row[1] for row in conn.execute("PRAGMA table_info(%s)" % table)}


def init() -> None:
    """Create the schema, then apply additive migrations. Safe to call often."""
    global _initialized
    with _LOCK:
        if _initialized:
            return
        conn = _get_conn()
        try:
            conn.executescript(SCHEMA)
            conn.commit()
            for table, column, decl in _MIGRATIONS:
                if column not in _table_columns(conn, table):
                    conn.execute("ALTER TABLE %s ADD COLUMN %s %s" % (table, column, decl))
            conn.commit()
            # Drop indexes that depend on user_id columns which may have been missing
            # in older databases, then recreate them.
            for index in (
                "idx_conversations_user", "idx_files_user", "idx_projects_user",
                "idx_models_user",
            ):
                try:
                    conn.execute("DROP INDEX IF EXISTS %s" % index)
                except sqlite3.OperationalError:
                    pass
            conn.execute(
                "CREATE INDEX IF NOT EXISTS idx_conversations_user "
                "ON conversations(user_id, updated_at DESC)"
            )
            conn.execute("CREATE INDEX IF NOT EXISTS idx_files_user ON files(user_id)")
            conn.execute("CREATE INDEX IF NOT EXISTS idx_projects_user ON projects(user_id)")
            conn.execute("CREATE INDEX IF NOT EXISTS idx_models_user ON model_configs(user_id)")
            conn.commit()
            for table, column, decl in _MIGRATIONS:
                if column not in _table_columns(conn, table):
                    conn.execute("ALTER TABLE %s ADD COLUMN %s %s" % (table, column, decl))
            conn.commit()
        finally:
            conn.close()
        _initialized = True


def query(sql: str, params: tuple = (), one: bool = False) -> Any:
    init()
    with _LOCK:
        conn = _get_conn()
        try:
            rows = conn.execute(sql, params).fetchall()
            conn.commit()
            if one:
                return dict(rows[0]) if rows else None
            return [dict(r) for r in rows]
        finally:
            conn.close()


def execute(sql: str, params: tuple = ()) -> int:
    init()
    with _LOCK:
        conn = _get_conn()
        try:
            cur = conn.execute(sql, params)
            conn.commit()
            return cur.rowcount
        finally:
            conn.close()


def executemany(sql: str, params_list: list[tuple]) -> None:
    init()
    with _LOCK:
        conn = _get_conn()
        try:
            conn.executemany(sql, params_list)
            conn.commit()
        finally:
            conn.close()
