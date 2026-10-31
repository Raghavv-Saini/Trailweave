from datetime import datetime
from typing import Optional, Dict, Any, List
from pydantic import BaseModel, ConfigDict


class ArtisanDraftResponse(BaseModel):
    id: str
    submission_id: Optional[str] = None
    whatsapp_message_id: Optional[str] = None
    sender_phone: str
    media_url: Optional[str] = None
    raw_transcript: Optional[str] = None
    extracted_data: Optional[Dict[str, Any]] = None
    approval_status: str = "draft"
    created_at: Optional[datetime] = None

    model_config = ConfigDict(from_attributes=True)


class ArtisanDraftApproveRequest(BaseModel):
    artisan_name: Optional[str] = None
    craft_type: Optional[str] = None
    place_name: Optional[str] = None
    address: Optional[str] = None
    latitude: Optional[float] = None
    longitude: Optional[float] = None
    has_workshop: Optional[bool] = None
    workshop_fee_inr: Optional[float] = None
    workshop_duration_minutes: Optional[int] = None
    workshop_description: Optional[str] = None
    opening_time: Optional[str] = None
    closing_time: Optional[str] = None
    bio: Optional[str] = None


class AdminArtisanResponse(BaseModel):
    id: str
    place_id: str
    artisan_name: str
    place_name: str
    craft_type: str
    phone_number: str
    address: str
    latitude: float
    longitude: float
    opening_time: str = "10:00"
    closing_time: str = "19:00"
    has_workshop: bool = False
    workshop_fee_inr: float = 0.0
    workshop_duration_minutes: int = 45
    workshop_description: Optional[str] = None
    bio: str = ""
    approval_status: str = "approved"
    catalogue_images: List[str] = []

    model_config = ConfigDict(from_attributes=True)


class AdminArtisanUpdateRequest(BaseModel):
    artisan_name: Optional[str] = None
    place_name: Optional[str] = None
    craft_type: Optional[str] = None
    phone_number: Optional[str] = None
    address: Optional[str] = None
    latitude: Optional[float] = None
    longitude: Optional[float] = None
    opening_time: Optional[str] = None
    closing_time: Optional[str] = None
    has_workshop: Optional[bool] = None
    workshop_fee_inr: Optional[float] = None
    workshop_duration_minutes: Optional[int] = None
    workshop_description: Optional[str] = None
    bio: Optional[str] = None
    approval_status: Optional[str] = None
    catalogue_images: Optional[List[str]] = None


class AdminTrailResponse(BaseModel):
    id: str
    title: str
    author_name: str
    description: Optional[str] = None
    destination: str = "Udaipur"
    total_duration_hours: float
    estimated_cost_inr: float
    tags: List[str] = []
    is_featured: bool = False
    is_experienced: bool = False
    visibility: str = "public"

    model_config = ConfigDict(from_attributes=True)


class AdminTrailFeatureRequest(BaseModel):
    is_featured: bool


class AdminPlaceCreateRequest(BaseModel):
    name: str
    category: str = "attraction"
    address: str
    latitude: float
    longitude: float
    opening_time: str = "09:00"
    closing_time: str = "18:00"
    entry_fee_inr: float = 0.0
    typical_duration_minutes: int = 60


class AdminPlaceResponse(BaseModel):
    id: str
    name: str
    category: str
    address: str
    latitude: float
    longitude: float
    opening_time: str
    closing_time: str
    entry_fee_inr: float
    typical_duration_minutes: int
    data_status: str = "verified"

    model_config = ConfigDict(from_attributes=True)
