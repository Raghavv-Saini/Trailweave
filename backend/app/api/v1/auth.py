"""
Tourist & Admin Authentication Endpoints (ADR 0011).
Spec: docs/API_SPEC.md §1.7
"""
import uuid
from datetime import datetime, timezone
from typing import Any, Dict
from fastapi import APIRouter, Depends, HTTPException, status
from sqlalchemy.ext.asyncio import AsyncSession
from sqlalchemy import text

from app.core.database import get_db
from app.core.security import (
    IN_MEMORY_USERS,
    create_access_token,
    get_current_user,
    hash_password,
    verify_password,
)
from app.schemas.auth import (
    TokenResponse,
    UserLoginRequest,
    UserResponse,
    UserSignupRequest,
)

router = APIRouter(tags=["Authentication"])


@router.post(
    "/signup",
    response_model=TokenResponse,
    status_code=status.HTTP_201_CREATED,
)
async def signup_tourist(
    body: UserSignupRequest,
    db: AsyncSession = Depends(get_db),
) -> TokenResponse:
    """
    Registers a new Tourist user with email and password and returns an access token.
    """
    email = (body.email or "").strip().lower()
    full_name = (body.full_name or "").strip()
    if not email or "@" not in email:
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail="A valid email address is required.",
        )
    if not full_name:
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail="Full name is required.",
        )

    if email in IN_MEMORY_USERS:
        raise HTTPException(
            status_code=status.HTTP_409_CONFLICT,
            detail="An account with this email already exists.",
        )

    hashed_pw = hash_password(body.password)
    user_id = f"user_{uuid.uuid4().hex[:10]}"
    now = datetime.now(timezone.utc)

    try:
        existing_row = await db.execute(
            text("SELECT id FROM users WHERE LOWER(email) = :email"),
            {"email": email},
        )
        if existing_row.fetchone():
            raise HTTPException(
                status_code=status.HTTP_409_CONFLICT,
                detail="An account with this email already exists.",
            )
        await db.execute(
            text(
                """
                INSERT INTO users (id, email, hashed_password, full_name, role, is_active, created_at, updated_at)
                VALUES (:id, :email, :hashed_password, :full_name, 'tourist', TRUE, :created_at, :updated_at)
                """
            ),
            {
                "id": user_id,
                "email": email,
                "hashed_password": hashed_pw,
                "full_name": full_name,
                "created_at": now,
                "updated_at": now,
            },
        )
        await db.commit()
    except HTTPException:
        raise
    except Exception:
        await db.rollback()

    user_record: Dict[str, Any] = {
        "id": user_id,
        "email": email,
        "hashed_password": hashed_pw,
        "full_name": full_name,
        "role": "tourist",
        "is_active": True,
        "created_at": now,
    }
    IN_MEMORY_USERS[email] = user_record

    token = create_access_token(user_record)
    return TokenResponse(
        access_token=token,
        token_type="bearer",
        user=UserResponse(**user_record),
    )


@router.post(
    "/login",
    response_model=TokenResponse,
)
async def login_user(
    body: UserLoginRequest,
    db: AsyncSession = Depends(get_db),
) -> TokenResponse:
    """
    Authenticates an existing Tourist or Admin/Superuser with email and password.
    """
    email = (body.email or "").strip().lower()
    password = body.password or ""

    user_record = IN_MEMORY_USERS.get(email)

    if not user_record:
        try:
            res = await db.execute(
                text(
                    "SELECT id, email, hashed_password, full_name, role, is_active, created_at FROM users WHERE LOWER(email) = :email"
                ),
                {"email": email},
            )
            row = res.fetchone()
            if row:
                rm = row._mapping
                user_record = {
                    "id": rm["id"],
                    "email": rm["email"],
                    "hashed_password": rm["hashed_password"],
                    "full_name": rm["full_name"],
                    "role": rm["role"],
                    "is_active": rm["is_active"],
                    "created_at": rm["created_at"],
                }
                IN_MEMORY_USERS[email] = user_record
        except Exception:
            pass

    if not user_record or not verify_password(password, user_record["hashed_password"]):
        raise HTTPException(
            status_code=status.HTTP_401_UNAUTHORIZED,
            detail="Invalid email or password.",
        )

    token = create_access_token(user_record)
    return TokenResponse(
        access_token=token,
        token_type="bearer",
        user=UserResponse(**user_record),
    )


@router.get(
    "/me",
    response_model=UserResponse,
)
async def get_me(
    current_user: Dict[str, Any] = Depends(get_current_user),
) -> UserResponse:
    """
    Returns the profile of the currently authenticated user.
    """
    return UserResponse(**current_user)
