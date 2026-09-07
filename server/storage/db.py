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
