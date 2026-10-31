"""
Pydantic Schemas for Tourist & Admin Authentication and Superuser Team Management (ADR 0011).
"""
from datetime import datetime
from typing import Optional
from pydantic import BaseModel, ConfigDict


class UserSignupRequest(BaseModel):
    email: str
    password: str
    full_name: str


class UserLoginRequest(BaseModel):
    email: str
    password: str


class UserResponse(BaseModel):
    id: str
    email: str
    full_name: str
    role: str = "tourist"  # 'tourist', 'admin', 'superuser'
    is_active: bool = True
    created_at: Optional[datetime] = None

    model_config = ConfigDict(from_attributes=True)


class TokenResponse(BaseModel):
    access_token: str
    token_type: str = "bearer"
    user: UserResponse


class AdminCreateUserRequest(BaseModel):
    email: str
    password: str
    full_name: str
    role: str = "admin"  # 'admin' or 'superuser'
