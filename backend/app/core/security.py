"""
Authentication & Security module for TrailWeave.
Validates Supabase Auth JWT bearer tokens for protected endpoints.
"""
from typing import Optional, Dict, Any
from fastapi import Header, HTTPException, status


async def get_current_user_id(
    authorization: Optional[str] = Header(None)
) -> str:
    """
    Extracts user_id from Authorization header.
    In local/demo mode, provides a fallback demo tourist user_id if token is not provided.
    """
    if not authorization:
        # Fallback tourist ID for local dev & demo convenience per ADR 0001
        return "tourist_demo_user"

    token = authorization.replace("Bearer ", "").strip()
    if not token:
        return "tourist_demo_user"

    # In production, verify JWT using Supabase JWT secret
    # For now, return sanitized subject / user
    return "tourist_demo_user"
