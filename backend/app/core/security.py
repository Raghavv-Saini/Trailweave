"""
Authentication & Security module for TrailWeave.
Validates JWT bearer tokens for protected Tourist/Admin endpoints (ADR 0011)
and handles 4-digit numeric PIN hashing & phone normalization for Artisan Portal (ADR 0010).
"""
import base64
from datetime import datetime, timezone
import hashlib
import hmac
import json
import os
import re
from typing import Any, Dict, Optional

try:
    from fastapi import Depends, Header, HTTPException, status
except ImportError:
    def Header(default=None):  # type: ignore
        return default

    def Depends(dep=None):  # type: ignore
        return dep

    class status:  # type: ignore
        HTTP_400_BAD_REQUEST = 400
        HTTP_401_UNAUTHORIZED = 401
        HTTP_403_FORBIDDEN = 403

    class HTTPException(Exception):  # type: ignore
        def __init__(self, status_code: int, detail: str):
            super().__init__(detail)
            self.status_code = status_code
            self.detail = detail

from app.core.config import settings

# SHA-256 digests of compromised legacy default secrets from public git history
_COMPROMISED_SECRET_HASHES = {
    "759c144e1e5cbf801a9dac48f363f9011587002f88c27d6e32932fb9186a8a6a",
    "905c94fd7a15ae5a89c35bb055e6dd0908345418887bf835a4ddf8b806acf2dd",
    "dbabc115574ba4538f635df292ad89df59343942a96f5b3c78bf7e51d6b66945",
}


def _get_required_security_secret(name: str) -> str:
    """
    Reads a required auth/security secret from Settings (loaded from env/.env) or os.environ.
    Fails fast with a clear error if unset or if attempting to use compromised legacy defaults.
    """
    val = (getattr(settings, name, "") or os.environ.get(name, "")).strip()
    if not val:
        raise RuntimeError(
            f"Critical security configuration missing: '{name}' is not set. "
            f"Please set '{name}' in your environment or .env file before starting TrailWeave. "
            f"Do not use compromised legacy default values."
        )
    val_digest = hashlib.sha256(val.encode("utf-8")).hexdigest()
    if val_digest in _COMPROMISED_SECRET_HASHES:
        raise RuntimeError(
            f"Critical security configuration error: '{name}' is set to a compromised "
            f"legacy value from git history. Please generate a new unique secret."
        )
    return val


def get_pin_hash_salt() -> str:
    return _get_required_security_secret("PIN_HASH_SALT")


def get_password_hash_salt() -> str:
    return _get_required_security_secret("PASSWORD_HASH_SALT")


def get_jwt_secret_key() -> str:
    return _get_required_security_secret("JWT_SECRET_KEY")


PIN_HASH_SALT: str = get_pin_hash_salt()
PASSWORD_HASH_SALT: str = get_password_hash_salt()
JWT_SECRET_KEY: str = get_jwt_secret_key()


def normalize_phone_number(phone: str) -> str:
    """
    Normalizes an Indian or international phone number to E.164-like format (e.g., +919829099887).
    """
    digits = re.sub(r"\D", "", (phone or "").strip())
    if not digits:
        return ""
    if len(digits) == 10:
        return f"+91{digits}"
    if len(digits) == 12 and digits.startswith("91"):
        return f"+{digits}"
    if len(digits) == 11 and digits.startswith("0"):
        return f"+91{digits[1:]}"
    return f"+{digits}"


def validate_four_digit_pin(pin: str) -> str:
    """
    Validates that the provided PIN is a strict 4-digit numeric PIN (4-अंकों का पिन).
    """
    cleaned = (pin or "").strip()
    if not re.fullmatch(r"\d{4}", cleaned):
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail="PIN must be a 4-digit numeric code (4-अंकों का पिन, e.g., 1234)."
        )
    return cleaned


def hash_pin(pin: str) -> str:
    """
    Deterministically hashes a 4-digit numeric PIN using PBKDF2-HMAC-SHA256.
    """
    cleaned = validate_four_digit_pin(pin)
    salt = get_pin_hash_salt()
    dk = hashlib.pbkdf2_hmac(
        "sha256",
        cleaned.encode("utf-8"),
        salt.encode("utf-8"),
        10000
    )
    return f"pbkdf2_sha256${dk.hex()}"


def verify_pin(pin: str, stored_pin_hash: Optional[str]) -> bool:
    """
    Verifies a 4-digit numeric PIN against a stored hash.
    If a legacy/seeded artisan record has no pin_hash yet, accepts default demo PIN '1234'.
    """
    cleaned = (pin or "").strip()
    if not re.fullmatch(r"\d{4}", cleaned):
        return False
    if not stored_pin_hash:
        return cleaned == "1234"
    expected = hash_pin(cleaned)
    return hmac.compare_digest(expected, stored_pin_hash)


def hash_password(password: str) -> str:
    """
    Deterministically hashes a user password using PBKDF2-HMAC-SHA256.
    """
    cleaned = (password or "").strip()
    if len(cleaned) < 4:
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail="Password must be at least 4 characters long."
        )
    salt = get_password_hash_salt()
    dk = hashlib.pbkdf2_hmac(
        "sha256",
        cleaned.encode("utf-8"),
        salt.encode("utf-8"),
        10000
    )
    return f"pbkdf2_sha256${dk.hex()}"


def verify_password(plain_password: str, hashed_password: str) -> bool:
    """
    Verifies a plaintext password against a stored PBKDF2-HMAC-SHA256 hash.
    """
    cleaned = (plain_password or "").strip()
    if not cleaned or not hashed_password:
        return False
    try:
        expected = hash_password(cleaned)
    except Exception:
        return False
    return hmac.compare_digest(expected, hashed_password)


def create_access_token(user_data: Dict[str, Any]) -> str:
    """
    Creates an HMAC-SHA256 signed JWT-compatible access token.
    """
    payload = {
        "sub": user_data["id"],
        "email": user_data["email"],
        "full_name": user_data.get("full_name", ""),
        "role": user_data.get("role", "tourist"),
        "iat": int(datetime.now(timezone.utc).timestamp()),
    }
    payload_bytes = json.dumps(payload, separators=(",", ":"), sort_keys=True).encode("utf-8")
    payload_b64 = base64.urlsafe_b64encode(payload_bytes).decode("utf-8").rstrip("=")
    jwt_secret = get_jwt_secret_key()
    signature = hmac.new(
        jwt_secret.encode("utf-8"),
        payload_b64.encode("utf-8"),
        hashlib.sha256,
    ).hexdigest()
    return f"tw_jwt.{payload_b64}.{signature}"


def decode_access_token(token: str) -> Optional[Dict[str, Any]]:
    """
    Verifies and decodes an HMAC-SHA256 signed access token.
    """
    if not token or not token.startswith("tw_jwt."):
        return None
    parts = token.split(".")
    if len(parts) != 3:
        return None
    _, payload_b64, signature = parts
    jwt_secret = get_jwt_secret_key()
    expected_sig = hmac.new(
        jwt_secret.encode("utf-8"),
        payload_b64.encode("utf-8"),
        hashlib.sha256,
    ).hexdigest()
    if not hmac.compare_digest(signature, expected_sig):
        return None
    padding = "=" * (-len(payload_b64) % 4)
    try:
        payload_bytes = base64.urlsafe_b64decode(payload_b64 + padding)
        return json.loads(payload_bytes.decode("utf-8"))
    except Exception:
        return None


# Pre-seeded in-memory user store for zero-error offline & testing support (ADR 0011)
IN_MEMORY_USERS: Dict[str, Dict[str, Any]] = {
    "admin@trailweave.org": {
        "id": "user_superadmin_default",
        "email": "admin@trailweave.org",
        "hashed_password": hash_password("admin123"),
        "full_name": "TrailWeave SuperAdmin",
        "role": "superuser",
        "is_active": True,
        "created_at": datetime(2026, 10, 31, 9, 0, 0, tzinfo=timezone.utc),
    },
    "tourist@trailweave.org": {
        "id": "user_tourist_demo",
        "email": "tourist@trailweave.org",
        "hashed_password": hash_password("tourist123"),
        "full_name": "Aarav Sharma",
        "role": "tourist",
        "is_active": True,
        "created_at": datetime(2026, 10, 31, 9, 30, 0, tzinfo=timezone.utc),
    },
}


async def get_current_user(
    authorization: Optional[str] = Header(None)
) -> Dict[str, Any]:
    """
    Extracts and validates the authenticated user from the Authorization Bearer token.
    Raises 401 if token is missing or invalid.
    """
    if not authorization or not authorization.startswith("Bearer "):
        raise HTTPException(
            status_code=status.HTTP_401_UNAUTHORIZED,
            detail="Missing or invalid Authorization Bearer token."
        )
    token = authorization.replace("Bearer ", "").strip()
    decoded = decode_access_token(token)
    if not decoded:
        raise HTTPException(
            status_code=status.HTTP_401_UNAUTHORIZED,
            detail="Invalid or expired authentication token."
        )
    email = decoded.get("email", "").lower()
    if email in IN_MEMORY_USERS:
        return IN_MEMORY_USERS[email]
    return {
        "id": decoded.get("sub", "user_unknown"),
        "email": email,
        "full_name": decoded.get("full_name", "Traveler"),
        "role": decoded.get("role", "tourist"),
        "is_active": True,
        "created_at": datetime.now(timezone.utc),
    }


async def require_admin(
    current_user: Dict[str, Any] = Depends(get_current_user)
) -> Dict[str, Any]:
    """
    Enforces that the authenticated user has 'admin' or 'superuser' privileges.
    Raises 403 Forbidden for simple tourists.
    """
    if current_user.get("role") not in ("admin", "superuser"):
        raise HTTPException(
            status_code=status.HTTP_403_FORBIDDEN,
            detail="Admin or Superuser privileges required."
        )
    return current_user


async def get_current_user_id(
    authorization: Optional[str] = Header(None)
) -> str:
    """
    Extracts user_id from Authorization header.
    In local/demo mode, provides a fallback demo tourist user_id if token is not provided.
    """
    if not authorization:
        return "tourist_demo_user"

    token = authorization.replace("Bearer ", "").strip()
    if not token:
        return "tourist_demo_user"

    decoded = decode_access_token(token)
    if decoded and decoded.get("sub"):
        return str(decoded["sub"])

    return "tourist_demo_user"
