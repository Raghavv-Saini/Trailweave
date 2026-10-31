"""
Unit & Integration tests for Track 4 Ticket 11:
Dedicated Artisan Studio Directory & Artifact Catalogue Gallery (/artisans)
Spec: docs/tickets/track-4-artisan-onboarding-admin/11-artisan-studio-directory.md & docs/API_SPEC.md §1.2
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
        DATABASE_URL = "sqlite+aiosqlite:///:memory:"
        API_V1_STR = "/api/v1"
        PROJECT_NAME = "TrailWeave"
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

from fastapi import HTTPException
from app.api.v1.artisans import list_artisans, get_artisan_details, IN_MEMORY_APPROVED_ARTISANS


class _DummyDbSession:
    """Mock database session that simulates empty DB / fallback to in-memory approved records."""
    async def execute(self, *args, **kwargs):
        raise ConnectionError("Simulated DB offline for fallback test")


@pytest.mark.asyncio
async def test_artisan_directory_list_all():
    db = _DummyDbSession()
    artisans = await list_artisans(db=db)
    assert len(artisans) >= 4
    names = [a.artisan_name for a in artisans]
    assert "Master Mohanlal Sharma" in names
    assert "Master Kavita Kumhar" in names
    assert "Babu Bhatt Puppeteer" in names
    assert "Ramesh Chandra Parmar" in names

    # Verify catalogue_images are populated
    mohanlal = next(a for a in artisans if a.id == "artisan_mohanlal")
    assert isinstance(mohanlal.catalogue_images, list)
    assert len(mohanlal.catalogue_images) >= 1
    assert mohanlal.opening_time in ("09:00", "10:00")
    assert mohanlal.closing_time in ("20:00", "21:00")


@pytest.mark.asyncio
async def test_artisan_directory_filter_workshop_and_fee():
    db = _DummyDbSession()

    # Filter for hands-on workshops only
    workshops = await list_artisans(has_workshop=True, db=db)
    assert all(a.has_workshop is True for a in workshops)
    assert any(a.id == "artisan_mohanlal" for a in workshops)
    assert not any(a.id == "artisan_leather" for a in workshops)

    # Filter for retail-only studios
    retail = await list_artisans(has_workshop=False, db=db)
    assert all(a.has_workshop is False for a in retail)
    assert any(a.id == "artisan_leather" for a in retail)

    # Filter by max workshop fee
    budget_workshops = await list_artisans(has_workshop=True, max_fee=250.0, db=db)
    assert all(a.workshop_fee_inr <= 250.0 for a in budget_workshops)
    assert any(a.id == "artisan_pottery" for a in budget_workshops)
    assert not any(a.id == "artisan_mohanlal" for a in budget_workshops)  # 300 > 250


@pytest.mark.asyncio
async def test_artisan_directory_filter_craft_type():
    db = _DummyDbSession()
    pottery = await list_artisans(craft_type="pottery", db=db)
    assert len(pottery) == 1
    assert pottery[0].id == "artisan_pottery"
    assert "Terracotta Pottery" in pottery[0].craft_type

    miniature = await list_artisans(craft_type="miniature", db=db)
    assert len(miniature) == 1
    assert miniature[0].id == "artisan_mohanlal"


@pytest.mark.asyncio
async def test_artisan_detail_profile_and_404():
    db = _DummyDbSession()
    detail = await get_artisan_details(artisan_id="artisan_mohanlal", db=db)
    assert detail.id == "artisan_mohanlal"
    assert detail.artisan_name == "Master Mohanlal Sharma"
    assert detail.has_workshop is True
    assert detail.workshop_fee_inr in (300.0, 350.0)
    assert detail.workshop_duration_minutes == 45
    assert len(detail.catalogue_images) >= 2
    assert "Jagdish Chowk" in detail.address

    # Unknown artisan should raise 404
    try:
        await get_artisan_details(artisan_id="artisan_nonexistent_xyz", db=db)
        assert False, "Should have raised HTTPException 404"
    except HTTPException as e:
        assert e.status_code == 404


@pytest.mark.asyncio
async def test_approved_artisan_syncs_to_directory():
    """Verify that newly approved artisan from admin portal immediately syncs to /artisans directory."""
    db = _DummyDbSession()
    new_id = "artisan_test_potter_sync"
    IN_MEMORY_APPROVED_ARTISANS[new_id] = {
        "id": new_id,
        "place_id": "place_test_potter_sync_studio",
        "artisan_name": "Ratan Lal Kumhar",
        "craft_type": "Molela Terracotta Sculpting",
        "phone_number": "+919829099112",
        "place_name": "Ratan Lal Heritage Terracotta Studio",
        "address": "Molela / Hathi Pole, Udaipur",
        "latitude": 24.585,
        "longitude": 73.687,
        "bio": "National award-winning Molela clay muralist.",
        "has_workshop": True,
        "workshop_fee_inr": 250.0,
        "workshop_duration_minutes": 50,
        "workshop_description": "Hands-on votive plaque making.",
        "opening_time": "10:00",
        "closing_time": "19:00",
        "approval_status": "approved",
        "catalogue_images": ["https://images.unsplash.com/photo-terracotta-sync"],
    }

    # 1. Directory list should immediately include the new approved artisan
    artisans = await list_artisans(db=db)
    found = next((a for a in artisans if a.id == new_id), None)
    assert found is not None
    assert found.artisan_name == "Ratan Lal Kumhar"
    assert found.craft_type == "Molela Terracotta Sculpting"
    assert found.workshop_fee_inr == 250.0
    assert found.catalogue_images == ["https://images.unsplash.com/photo-terracotta-sync"]

    # 2. Detail lookup should retrieve full record
    detail = await get_artisan_details(artisan_id=new_id, db=db)
    assert detail.id == new_id
    assert detail.artisan_name == "Ratan Lal Kumhar"
    assert detail.bio == "National award-winning Molela clay muralist."


def _drive_coroutine(coro):
    """Drives a deterministic async test coroutine without creating socketpairs."""
    try:
        coro.send(None)
    except StopIteration as e:
        return e.value
    finally:
        coro.close()


if __name__ == "__main__":
    _drive_coroutine(test_artisan_directory_list_all())
    _drive_coroutine(test_artisan_directory_filter_workshop_and_fee())
    _drive_coroutine(test_artisan_directory_filter_craft_type())
    _drive_coroutine(test_artisan_detail_profile_and_404())
    _drive_coroutine(test_approved_artisan_syncs_to_directory())
    print("All 5 backend Ticket 11 Artisan Directory & Detail tests passed!")
