from typing import Optional, List, Dict, Any
from pydantic import BaseModel, ConfigDict, Field


class ArtisanBase(BaseModel):
    artisan_name: str
    craft_type: str
    place_id: str
    phone_number: Optional[str] = None
    bio: Optional[str] = None
    catalogue_images: List[str] = Field(default_factory=list)
    has_workshop: bool = False
    workshop_fee_inr: float = 0
    workshop_duration_minutes: int = 45
    workshop_description: Optional[str] = None
    profile_status: str = "approved"


class ArtisanResponse(ArtisanBase):
    id: str
    address: Optional[str] = None
    latitude: Optional[float] = None
    longitude: Optional[float] = None
    opening_time: Optional[str] = None
    closing_time: Optional[str] = None

    model_config = ConfigDict(from_attributes=True)


class ArtisanOnboardRequest(BaseModel):
    phone_number: str
    pin: str
    audio_base64: Optional[str] = None
    transcript_hint: Optional[str] = None
    text_message: Optional[str] = None
    latitude: Optional[float] = None
    longitude: Optional[float] = None
    catalogue_images: List[str] = Field(default_factory=list)


class ArtisanLoginRequest(BaseModel):
    phone_number: str
    pin: str


class ArtisanCatalogueAddRequest(BaseModel):
    phone_number: str
    pin: str
    image_urls: List[str] = Field(default_factory=list)


class ArtisanCatalogueDeleteRequest(BaseModel):
    phone_number: str
    pin: str
    image_url: Optional[str] = None
    image_urls: List[str] = Field(default_factory=list)


class ArtisanPortalProfileResponse(BaseModel):
    id: str
    source_type: str = "draft"  # "draft" or "artisan"
    approval_status: str = "draft"  # "draft", "approved", "rejected"
    artisan_name: str
    craft_type: str
    phone_number: str
    place_name: Optional[str] = None
    address: Optional[str] = None
    latitude: Optional[float] = None
    longitude: Optional[float] = None
    has_workshop: bool = False
    workshop_fee_inr: float = 0.0
    workshop_duration_minutes: int = 45
    workshop_description: Optional[str] = None
    opening_time: Optional[str] = "10:00"
    closing_time: Optional[str] = "19:30"
    admin_brief: Optional[str] = None
    missing_info_checklist: List[str] = Field(default_factory=list)
    raw_transcript: Optional[str] = None
    catalogue_images: List[str] = Field(default_factory=list)

    model_config = ConfigDict(from_attributes=True)


class ArtisanRecommendationItem(BaseModel):
    artisan_id: str
    place_id: str
    artisan_name: str
    craft_type: str
    offering_type: str  # "workshop" or "store"
    fee_inr: float
    duration_minutes: int
    detour_minutes: int
    optimal_insert_order: int
    rationale: str
    latitude: float
    longitude: float
    address: Optional[str] = None
    phone_number: Optional[str] = None
    bio: Optional[str] = None
    image_url: Optional[str] = None
    opening_time: Optional[str] = None
    closing_time: Optional[str] = None
    has_workshop: bool = False
    workshop_description: Optional[str] = None

    model_config = ConfigDict(from_attributes=True)


class ArtisanRecommendationResponse(BaseModel):
    trip_id: Optional[str] = None
    preference: str = "both"
    travel_mode: str = "auto_rickshaw"
    remaining_budget_inr: float = 0.0
    total_candidates_evaluated: int = 0
    recommendations: List[ArtisanRecommendationItem] = []


class TransientArtisanRecommendationRequest(BaseModel):
    stops: List[Dict[str, Any]] = []
    start_location: Optional[Dict[str, Any]] = None
    budget_inr: float = 2000.0
    travel_mode: str = "auto_rickshaw"
    preference: str = "both"
    max_detour_minutes: int = 15
