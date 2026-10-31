from contextlib import asynccontextmanager
from fastapi import FastAPI
from fastapi.middleware.cors import CORSMiddleware
from app.core.config import settings
from app.core.database import engine
from sqlalchemy import text

# Routers
from app.api.v1.health import router as health_router
from app.api.v1.trails import router as trails_router
from app.api.v1.artisans import router as artisans_router
from app.api.v1.trips import router as trips_router
from app.api.v1.replan import router as replan_router
from app.api.v1.assistant import router as assistant_router
from app.api.v1.whatsapp import router as whatsapp_router
from app.api.v1.admin import router as admin_router


@asynccontextmanager
async def lifespan(app: FastAPI):
    # Test connection on startup
    try:
        async with engine.begin() as conn:
            res = await conn.execute(text("SELECT PostGIS_Version();"))
            print(f"🚀 Connected to PostgreSQL with PostGIS: {res.scalar()}")
    except Exception as e:
        print(f"⚠️ Warning: Database startup check failed: {e}")
    yield
    # Cleanup connection pool on shutdown
    await engine.dispose()


app = FastAPI(
    title=settings.PROJECT_NAME,
    description="TrailWeave: Deterministic Trip Engine & Active Companion Backend",
    version="1.0.0",
    lifespan=lifespan
)

# CORS middleware
app.add_middleware(
    CORSMiddleware,
    allow_origins=settings.CORS_ORIGINS,
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)

# Mount health checks at root /health
app.include_router(health_router, prefix="", tags=["Health"])

# Mount all feature routers under /api and /api/v1 for spec compliance
for prefix in ["/api", "/api/v1"]:
    app.include_router(health_router, prefix=prefix)
    app.include_router(trails_router, prefix=prefix)
    app.include_router(artisans_router, prefix=prefix)
    app.include_router(trips_router, prefix=prefix)
    app.include_router(replan_router, prefix=prefix)
    app.include_router(assistant_router, prefix=prefix)
    app.include_router(whatsapp_router, prefix=prefix)
    app.include_router(admin_router, prefix=prefix)


@app.get("/")
async def root():
    return {
        "project": "TrailWeave API",
        "description": "Explore like a local. Travel your way. Pass it on.",
        "docs": "/docs",
        "health": "/health"
    }


if __name__ == "__main__":
    import uvicorn
    uvicorn.run("app.main:app", host="0.0.0.0", port=settings.PORT, reload=True)
