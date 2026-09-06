"""User accounts and server-side sessions.

Passwords are stored only as salted hashes (werkzeug PBKDF2/scrypt). Session
tokens live in the database and are handed to the browser in an HttpOnly
cookie, so no credential material is ever readable from JavaScript.
"""

import os
import re
import secrets
import time
import uuid
from typing import Any

from werkzeug.security import check_password_hash, generate_password_hash

from server.storage.db import execute, query

SESSION_COOKIE = "clarity_session"
SESSION_TTL_SECONDS = int(os.environ.get("SESSION_TTL_SECONDS", 60 * 60 * 24 * 30))
MIN_PASSWORD_LENGTH = 8

_EMAIL_RE = re.compile(r"^[^@\s]+@[^@\s.]+\.[^@\s]+$")


class AuthError(Exception):
    def __init__(self, message: str, status_code: int = 400, error_type: str = "auth_error"):
        self.status_code = status_code
        self.error_type = error_type
        super().__init__(message)


def normalize_email(email: str) -> str:
    return str(email or "").strip().lower()


def validate_credentials(email: str, password: str) -> tuple[str, str]:
    mail = normalize_email(email)
    pwd = str(password or "")
    if not mail:
        raise AuthError("Email is required", 400, "missing_email")
    if not _EMAIL_RE.match(mail):
        raise AuthError("Enter a valid email address", 400, "invalid_email")
    if len(pwd) < MIN_PASSWORD_LENGTH:
        raise AuthError(
            f"Password must be at least {MIN_PASSWORD_LENGTH} characters",
            400,
            "weak_password",
        )
    return mail, pwd


def public_user(row: dict[str, Any]) -> dict[str, Any]:
    """The only user shape ever sent to the browser: no hash, no token."""
    return {
        "id": row["id"],
        "email": row["email"],
        "created_at": row.get("created_at"),
        "last_login_at": row.get("last_login_at"),
        "active_model_id": row.get("active_model_id"),
    }


def get_user_by_email(email: str) -> dict[str, Any] | None:
    return query("SELECT * FROM users WHERE email = ?", (normalize_email(email),), one=True)


def get_user(user_id: str) -> dict[str, Any] | None:
    return query("SELECT * FROM users WHERE id = ?", (user_id,), one=True)


def create_user(email: str, password: str) -> dict[str, Any]:
    mail, pwd = validate_credentials(email, password)
    if get_user_by_email(mail):
        raise AuthError("An account with this email already exists", 409, "email_taken")
    uid = f"user_{uuid.uuid4().hex[:12]}"
    now = time.time()
    execute(
        "INSERT INTO users (id, email, password_hash, created_at) VALUES (?, ?, ?, ?)",
        (uid, mail, generate_password_hash(pwd), now),
    )
    return get_user(uid)


def verify_login(email: str, password: str) -> dict[str, Any]:
    mail = normalize_email(email)
    pwd = str(password or "")
    if not mail or not pwd:
        raise AuthError("Email and password are required", 400, "missing_credentials")
    row = get_user_by_email(mail)
    # Same message for unknown email and wrong password: no account enumeration.
    if not row or not check_password_hash(row["password_hash"], pwd):
        raise AuthError("Incorrect email or password", 401, "invalid_credentials")
    execute("UPDATE users SET last_login_at = ? WHERE id = ?", (time.time(), row["id"]))
    return get_user(row["id"])


def create_session(user_id: str) -> tuple[str, float]:
    token = secrets.token_urlsafe(48)
    now = time.time()
    expires = now + SESSION_TTL_SECONDS
    execute(
        "INSERT INTO sessions (token, user_id, created_at, expires_at) VALUES (?, ?, ?, ?)",
        (token, user_id, now, expires),
    )
    return token, expires


def resolve_session(token: str | None) -> dict[str, Any] | None:
    if not token:
        return None
    row = query("SELECT * FROM sessions WHERE token = ?", (token,), one=True)
    if not row:
        return None
    if float(row["expires_at"]) < time.time():
        execute("DELETE FROM sessions WHERE token = ?", (token,))
        return None
    return get_user(row["user_id"])


def destroy_session(token: str | None) -> None:
    if token:
        execute("DELETE FROM sessions WHERE token = ?", (token,))


def purge_expired_sessions() -> int:
    return execute("DELETE FROM sessions WHERE expires_at < ?", (time.time(),))


def set_active_model(user_id: str, model_id: str | None) -> None:
    execute("UPDATE users SET active_model_id = ? WHERE id = ?", (model_id, user_id))
