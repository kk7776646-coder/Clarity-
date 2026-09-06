"""User authentication: signup, login, logout, me, session helper."""
import re
import time
import uuid
from typing import Any

from werkzeug.security import generate_password_hash, check_password_hash

from server.storage.db import query, execute


EMAIL_RE = re.compile(r"^[^\s@]+@[^\s@]+\.[^\s@]+$")
MIN_PASSWORD_LEN = 6


def _public_user(row: dict[str, Any]) -> dict[str, Any]:
    return {
        "id": row["id"],
        "email": row["email"],
        "name": row.get("name") or row["email"].split("@", 1)[0],
        "createdAt": row.get("created_at"),
        "lastLoginAt": row.get("last_login_at"),
    }


def find_by_email(email: str) -> dict[str, Any] | None:
    row = query("SELECT * FROM users WHERE LOWER(email) = LOWER(?)", (email.strip(),), one=True)
    return row


def find_by_id(uid: str) -> dict[str, Any] | None:
    row = query("SELECT * FROM users WHERE id = ?", (uid,), one=True)
    return row


def signup(email: str, password: str, name: str | None = None) -> tuple[dict[str, Any] | None, str | None]:
    email = (email or "").strip()
    if not EMAIL_RE.match(email):
        return None, "Please enter a valid email address."
    if not password or len(password) < MIN_PASSWORD_LEN:
        return None, f"Password must be at least {MIN_PASSWORD_LEN} characters."
    if find_by_email(email):
        return None, "An account with this email already exists."
    uid = str(uuid.uuid4())
    pwd_hash = generate_password_hash(password)
    execute(
        "INSERT INTO users (id, email, name, password_hash, created_at) VALUES (?, ?, ?, ?, ?)",
        (uid, email, name or email.split("@", 1)[0], pwd_hash, time.time()),
    )
    return find_by_id(uid), None


def login(email: str, password: str) -> tuple[dict[str, Any] | None, str | None]:
    row = find_by_email(email)
    if not row:
        return None, "No account with that email."
    if not check_password_hash(row["password_hash"], password):
        return None, "Incorrect password."
    execute("UPDATE users SET last_login_at = ? WHERE id = ?", (time.time(), row["id"]))
    return find_by_id(row["id"]), None


def assign_legacy_to_user(user_id: str) -> None:
    """On first signup, assign pre-existing rows (user_id IS NULL) to this user."""
    for table in ("conversations", "projects", "files", "model_configs"):
        execute(
            f"UPDATE {table} SET user_id = ? WHERE user_id IS NULL OR user_id = ''",
            (user_id,),
        )