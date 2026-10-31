from fastapi import APIRouter, Depends
from sqlalchemy.ext.asyncio import AsyncSession
from sqlalchemy import text
from app.core.database import get_db

router = APIRouter()


@router.get("/health")
async def health_check(db: AsyncSession = Depends(get_db)):
    """Health check endpoint verifying database connectivity and PostGIS installation."""
    try:
        # Check PostGIS version
        postgis_ver = await db.execute(text("SELECT PostGIS_Version();"))
        pg_ver_str = postgis_ver.scalar()

        # Count places
        places_res = await db.execute(text("SELECT COUNT(*) FROM places;"))
        places_count = places_res.scalar()

        # Count trails
        trails_res = await db.execute(text("SELECT COUNT(*) FROM community_trails;"))
        trails_count = trails_res.scalar()

        return {
            "status": "ok",
            "database": "connected",
            "postgis": "installed",
            "postgis_version": pg_ver_str,
            "places_count": places_count,
            "trails_count": trails_count
        }
    except Exception as e:
        return {
            "status": "degraded",
            "database": "error",
            "detail": str(e)
        }
