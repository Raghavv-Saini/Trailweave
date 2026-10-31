"""
Unit & Integration tests for Track 4 Ticket 12:
Admin Curation, Artisan Contact Directory & Place Verification Portal (/admin)
Spec: docs/tickets/track-4-artisan-onboarding-admin/12-admin-curation-verification-portal.md & docs/API_SPEC.md §1.5
"""
import os
import sys
import types

backend_dir = os.path.abspath(os.path.join(os.path.dirname(__file__), ".."))
if backend_dir not in sys.path:
    sys.path.insert(0, backend_dir)

# Shim fastapi & dependencies if not installed in standalone environment
if "fastapi" not in sys.modules:
    fastapi_mod = types.ModuleType("fastapi")

    class HTTPException(Exception):
        def __init__(self, status_code: int, detail: str = ""):
            super().__init__(detail)
            self.status_code = status_code
            self.detail = detail

    class APIRouter:
        def __init__(self, *args, **kwargs):
            pass
        def get(self, *args, **kwargs):
            return lambda fn: fn
        def post(self, *args, **kwargs):
            return lambda fn: fn
        def patch(self, *args, **kwargs):
            return lambda fn: fn
        def delete(self, *args, **kwargs):
            return lambda fn: fn

    def Depends(fn=None):
        return None

    def Query(default=None, **kwargs):
        return default

    def Body(default=None, **kwargs):
        return default

    class status:
        HTTP_200_OK = 200
        HTTP_201_CREATED = 201
        HTTP_400_BAD_REQUEST = 400
        HTTP_401_UNAUTHORIZED = 401
        HTTP_404_NOT_FOUND = 404
        HTTP_409_CONFLICT = 409

    fastapi_mod.HTTPException = HTTPException
    fastapi_mod.APIRouter = APIRouter
    fastapi_mod.Depends = Depends
    fastapi_mod.Query = Query
    fastapi_mod.Body = Body
    fastapi_mod.status = status
    sys.modules["fastapi"] = fastapi_mod

if "sqlalchemy" not in sys.modules:
    sqla_mod = types.ModuleType("sqlalchemy")
    sqla_mod.text = lambda q: q
    sys.modules["sqlalchemy"] = sqla_mod

    sqla_ext = types.ModuleType("sqlalchemy.ext")
    sqla_ext_asyncio = types.ModuleType("sqlalchemy.ext.asyncio")
    class AsyncSession:
        pass
    sqla_ext_asyncio.AsyncSession = AsyncSession
    sqla_ext_asyncio.create_async_engine = lambda *a, **k: None
    sqla_ext_asyncio.async_sessionmaker = lambda *a, **k: lambda: None
    sqla_ext.asyncio = sqla_ext_asyncio
    sys.modules["sqlalchemy.ext"] = sqla_ext
    sys.modules["sqlalchemy.ext.asyncio"] = sqla_ext_asyncio

if "pydantic" not in sys.modules:
    pyd_mod = types.ModuleType("pydantic")
    class BaseModel:
        def __init__(self, **kwargs):
            for k, v in kwargs.items():
                setattr(self, k, v)
        def model_dump(self):
            return self.__dict__
    def Field(default=None, default_factory=None):
        if default_factory is not None:
            return default_factory()
        return default
    def field_validator(*args, **kwargs):
        return lambda fn: fn
    class ConfigDict(dict):
        pass
    pyd_mod.BaseModel = BaseModel
    pyd_mod.Field = Field
    pyd_mod.field_validator = field_validator
    pyd_mod.ConfigDict = ConfigDict
    sys.modules["pydantic"] = pyd_mod

if "pydantic_settings" not in sys.modules:
    pyds_mod = types.ModuleType("pydantic_settings")
    class BaseSettings(pyd_mod.BaseModel):
        DATABASE_URL: str = "sqlite+aiosqlite:///:memory:"
        API_V1_STR: str = "/api/v1"
        PROJECT_NAME: str = "TrailWeave"
    class SettingsConfigDict(dict):
        pass
    pyds_mod.BaseSettings = BaseSettings
    pyds_mod.SettingsConfigDict = SettingsConfigDict
    sys.modules["pydantic_settings"] = pyds_mod

try:
    import pytest
except ImportError:
    class _DummyPytest:
        class mark:
            @staticmethod
            def asyncio(fn):
                return fn
    pytest = _DummyPytest()  # type: ignore
from app.api.v1.admin import (
    list_artisan_drafts,
    approve_artisan_draft,
    reject_artisan_draft,
    list_admin_artisans,
    update_admin_artisan,
    list_admin_trails,
    toggle_trail_feature,
    create_admin_place,
    IN_MEMORY_TRAILS,
    IN_MEMORY_PLACES,
)
from app.api.v1.artisans import (
    IN_MEMORY_ARTISAN_DRAFTS,
    IN_MEMORY_APPROVED_ARTISANS,
)
from app.schemas.admin import (
    ArtisanDraftApproveRequest,
    AdminArtisanUpdateRequest,
    AdminTrailFeatureRequest,
    AdminPlaceCreateRequest,
)


class _DummyDbSession:
    """Mock DB session that simulates no-op execution for standalone testing."""
    async def execute(self, *args, **kwargs):
        raise RuntimeError("No live DB connection")
    async def commit(self):
        pass


@pytest.mark.asyncio
async def test_list_artisan_drafts_queue():
    db = _DummyDbSession()
    drafts = await list_artisan_drafts(db=db)
    assert len(drafts) >= 1
    shankar = next((d for d in drafts if "shankar" in d.id), None)
    assert shankar is not None
    assert shankar.sender_phone == "+919829099887"
    assert "टेराकोटा" in shankar.raw_transcript
    assert shankar.extracted_data is not None
    assert "Shankar Lal Kumhar" in shankar.extracted_data["admin_brief"]
    assert len(shankar.extracted_data["missing_info_checklist"]) >= 1
    assert len(shankar.extracted_data["catalogue_images"]) >= 2


@pytest.mark.asyncio
async def test_approve_artisan_draft_atomicity():
    db = _DummyDbSession()
    # Add a mock draft for testing approval
    test_draft_id = "draft_test_mohit"
    IN_MEMORY_ARTISAN_DRAFTS[test_draft_id] = {
        "id": test_draft_id,
        "submission_id": "sub_test_mohit",
        "sender_phone": "+919829055443",
        "media_url": None,
        "raw_transcript": "नमस्ते, मैं मोहित सोनी हूँ। हमारी चांदी के मीनाकारी की दुकान बड़ा बाज़ार में है।",
        "approval_status": "draft",
        "extracted_data": {
            "artisan_name": "Mohit Soni",
            "craft_type": "Silver Meenakari & Enameling",
            "place_name": "Mohit Soni Heritage Meenakari Studio",
            "address": "Bada Bazaar, Old City, Udaipur",
            "latitude": 24.582,
            "longitude": 73.687,
            "has_workshop": True,
            "workshop_fee_inr": 400.0,
            "workshop_duration_minutes": 60,
            "workshop_description": "Learn traditional silver enameling and stone setting.",
            "opening_time": "10:30",
            "closing_time": "20:00",
            "admin_brief": "Master Mohit Soni practices heritage silver Meenakari in Bada Bazaar offering 1-hour workshops for ₹400.",
            "missing_info_checklist": ["Check workshop capacity"],
            "pin_hash": "hash_1234",
            "catalogue_images": ["https://images.unsplash.com/photo-silver-meenakari"],
        },
    }

    # Approve with refined opening time and bio
    approve_req = ArtisanDraftApproveRequest(
        artisan_name="Master Mohit Soni",
        craft_type="Silver Meenakari & Fine Enameling",
        place_name="Mohit Soni Heritage Meenakari Studio",
        address="Bada Bazaar, Old City, Udaipur, Rajasthan 313001",
        latitude=24.5825,
        longitude=73.6875,
        has_workshop=True,
        workshop_fee_inr=450.0,
        workshop_duration_minutes=60,
        opening_time="10:00",
        closing_time="20:30",
        bio="5th generation royal court silver enameler.",
    )

    result = await approve_artisan_draft(draft_id=test_draft_id, body=approve_req, db=db)
    assert result["success"] is True
    assert result["artisan_id"] == "artisan_test_mohit"
    assert result["place_id"] == "place_test_mohit_studio"

    # Verify approved record preserved phone, pin, and catalogue
    approved = IN_MEMORY_APPROVED_ARTISANS["artisan_test_mohit"]
    assert approved["phone_number"] == "+919829055443"
    assert approved["pin_hash"] == "hash_1234"
    assert approved["catalogue_images"] == ["https://images.unsplash.com/photo-silver-meenakari"]
    assert approved["workshop_fee_inr"] == 450.0
    assert approved["approval_status"] == "approved"
    assert IN_MEMORY_ARTISAN_DRAFTS[test_draft_id]["approval_status"] == "approved"


@pytest.mark.asyncio
async def test_reject_artisan_draft():
    db = _DummyDbSession()
    reject_draft_id = "draft_test_reject"
    IN_MEMORY_ARTISAN_DRAFTS[reject_draft_id] = {
        "id": reject_draft_id,
        "sender_phone": "+919829099999",
        "raw_transcript": "Spam test message",
        "approval_status": "draft",
        "extracted_data": {},
    }

    res = await reject_artisan_draft(draft_id=reject_draft_id, db=db)
    assert res["success"] is True
    assert IN_MEMORY_ARTISAN_DRAFTS[reject_draft_id]["approval_status"] == "rejected"


@pytest.mark.asyncio
async def test_admin_artisans_directory_and_patch():
    db = _DummyDbSession()
    artisans = await list_admin_artisans(db=db)
    assert len(artisans) >= 2
    mohanlal = next((a for a in artisans if a.id == "artisan_mohanlal"), None)
    assert mohanlal is not None
    assert mohanlal.phone_number == "+919829012345"
    assert mohanlal.has_workshop is True
    assert len(mohanlal.catalogue_images) >= 2

    # Patch artisan info (e.g. curator called and updated phone and store hours)
    patch_req = AdminArtisanUpdateRequest(
        phone_number="+919829088776",
        opening_time="09:00",
        closing_time="21:00",
        workshop_fee_inr=350.0,
    )
    updated = await update_admin_artisan(artisan_id="artisan_mohanlal", body=patch_req, db=db)
    assert updated.phone_number == "+919829088776"
    assert updated.opening_time == "09:00"
    assert updated.closing_time == "21:00"
    assert updated.workshop_fee_inr == 350.0


@pytest.mark.asyncio
async def test_curation_trails_and_places():
    db = _DummyDbSession()
    # List trails
    trails = await list_admin_trails(db=db)
    assert len(trails) >= 2

    # Toggle featured status
    feature_res = await toggle_trail_feature(
        trail_id="trail_artisan_immersions",
        body=AdminTrailFeatureRequest(is_featured=True),
        db=db,
    )
    assert feature_res["success"] is True
    assert feature_res["is_featured"] is True
    assert IN_MEMORY_TRAILS["trail_artisan_immersions"]["is_featured"] is True

    # Create new verified place
    place_req = AdminPlaceCreateRequest(
        name="Ambrai Ghat Promenade",
        category="scenic",
        address="Chandpole, Udaipur, Rajasthan 313001",
        latitude=24.5775,
        longitude=73.6800,
        opening_time="06:00",
        closing_time="22:00",
        entry_fee_inr=0.0,
        typical_duration_minutes=45,
    )
    new_place = await create_admin_place(body=place_req, db=db)
    assert new_place.name == "Ambrai Ghat Promenade"
    assert new_place.category == "scenic"
    assert new_place.data_status == "verified"
    assert new_place.id in IN_MEMORY_PLACES


def _drive_coroutine(coro):
    """Drives a deterministic async test coroutine without creating socketpairs."""
    try:
        coro.send(None)
    except StopIteration as e:
        return e.value
    finally:
        coro.close()


if __name__ == "__main__":
    _drive_coroutine(test_list_artisan_drafts_queue())
    _drive_coroutine(test_approve_artisan_draft_atomicity())
    _drive_coroutine(test_reject_artisan_draft())
    _drive_coroutine(test_admin_artisans_directory_and_patch())
    _drive_coroutine(test_curation_trails_and_places())
    print("All 5 backend Ticket 12 Admin Curation & Verification tests passed!")
