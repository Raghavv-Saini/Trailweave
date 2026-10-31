-- TrailWeave PostGIS Schema Specification
-- Authoritative DDL for all 10 core tables

-- Enable PostGIS extension for geospatial radius and distance calculations
CREATE EXTENSION IF NOT EXISTS postgis;

-- ============================================================================
-- 1. Canonical Places
-- ============================================================================
CREATE TABLE IF NOT EXISTS places (
    id TEXT PRIMARY KEY,
    name TEXT NOT NULL,
    category TEXT NOT NULL, -- 'attraction', 'heritage', 'dining', 'artisan_studio'
    latitude DOUBLE PRECISION NOT NULL,
    longitude DOUBLE PRECISION NOT NULL,
    geom GEOMETRY(Point, 4326),
    address TEXT NOT NULL,
    entry_fee_inr NUMERIC DEFAULT 0,
    typical_duration_minutes INT DEFAULT 45,
    opening_time TIME,
    closing_time TIME,
    data_status TEXT DEFAULT 'verified', -- 'verified', 'reported', 'estimated', 'demo_simulated'
    created_at TIMESTAMPTZ DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_places_geom ON places USING GIST (geom);
CREATE INDEX IF NOT EXISTS idx_places_category ON places (category);

-- Trigger to automatically populate geom from lat/lng
CREATE OR REPLACE FUNCTION update_places_geom()
RETURNS TRIGGER AS $$
BEGIN
    NEW.geom = ST_SetSRID(ST_MakePoint(NEW.longitude, NEW.latitude), 4326);
    RETURN NEW;
END;
$$ LANGUAGE plpgsql;

DROP TRIGGER IF EXISTS trg_places_geom_update ON places;
CREATE TRIGGER trg_places_geom_update
BEFORE INSERT OR UPDATE OF latitude, longitude ON places
FOR EACH ROW EXECUTE FUNCTION update_places_geom();

-- ============================================================================
-- 2. Artisans
-- ============================================================================
CREATE TABLE IF NOT EXISTS artisans (
    id TEXT PRIMARY KEY,
    place_id TEXT REFERENCES places(id) ON DELETE CASCADE,
    artisan_name TEXT NOT NULL,
    craft_type TEXT NOT NULL, -- e.g. 'Miniature Painting', 'Terracotta Pottery', 'Pichwai Art'
    phone_number TEXT,
    pin_hash TEXT, -- 4-digit numeric PIN hash for returning artisan login
    bio TEXT,
    catalogue_images JSONB DEFAULT '[]'::jsonb, -- Self-service craft & artifact photo URLs
    has_workshop BOOLEAN DEFAULT FALSE,
    workshop_fee_inr NUMERIC DEFAULT 0,
    workshop_duration_minutes INT DEFAULT 45,
    workshop_description TEXT,
    profile_status TEXT DEFAULT 'approved', -- 'approved', 'pending_review', 'rejected'
    created_at TIMESTAMPTZ DEFAULT NOW()
);

ALTER TABLE artisans ADD COLUMN IF NOT EXISTS pin_hash TEXT;
ALTER TABLE artisans ADD COLUMN IF NOT EXISTS catalogue_images JSONB DEFAULT '[]'::jsonb;

CREATE INDEX IF NOT EXISTS idx_artisans_place_id ON artisans (place_id);
CREATE INDEX IF NOT EXISTS idx_artisans_has_workshop ON artisans (has_workshop);

-- ============================================================================
-- 3. Authoritative Trips
-- ============================================================================
CREATE TABLE IF NOT EXISTS trips (
    id TEXT PRIMARY KEY,
    user_id TEXT NOT NULL,
    title TEXT,
    destination TEXT DEFAULT 'Udaipur',
    duration_type TEXT DEFAULT 'single_day', -- 'single_day', 'multi_day'
    total_days INT DEFAULT 1,
    budget_inr NUMERIC NOT NULL,
    budget_mode TEXT DEFAULT 'total', -- 'total', 'per_day'
    artisan_preference TEXT DEFAULT 'both', -- 'workshop', 'store', 'both', 'none'
    revision INT NOT NULL DEFAULT 1, -- Monotonic integer
    current_itinerary_version_id TEXT,
    status TEXT DEFAULT 'planned', -- 'planned', 'in_progress', 'completed'
    completed_at TIMESTAMPTZ,
    updated_at TIMESTAMPTZ DEFAULT NOW(),
    created_at TIMESTAMPTZ DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_trips_user_id ON trips (user_id);
CREATE INDEX IF NOT EXISTS idx_trips_revision ON trips (id, revision);

-- ============================================================================
-- 4. Immutable Itinerary Version Snapshots
-- ============================================================================
CREATE TABLE IF NOT EXISTS itinerary_versions (
    id TEXT PRIMARY KEY,
    trip_id TEXT REFERENCES trips(id) ON DELETE CASCADE,
    version_number INT NOT NULL,
    total_estimated_cost_inr NUMERIC NOT NULL,
    total_estimated_duration_minutes INT NOT NULL,
    route_geometry JSONB,
    created_at TIMESTAMPTZ DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_itinerary_versions_trip_id ON itinerary_versions (trip_id, version_number);

-- ============================================================================
-- 5. Trip Stops
-- ============================================================================
CREATE TABLE IF NOT EXISTS trip_stops (
    id TEXT PRIMARY KEY,
    trip_id TEXT REFERENCES trips(id) ON DELETE CASCADE,
    itinerary_version_id TEXT REFERENCES itinerary_versions(id) ON DELETE CASCADE,
    place_id TEXT REFERENCES places(id),
    day_number INT DEFAULT 1,
    sequence_in_day INT NOT NULL,
    planned_arrival TIMESTAMPTZ,
    planned_departure TIMESTAMPTZ,
    suggested_duration_minutes INT NOT NULL,
    actual_duration_minutes INT,
    is_pinned BOOLEAN DEFAULT FALSE,
    visit_status TEXT DEFAULT 'pending', -- 'pending', 'visited', 'skipped'
    source_attribution TEXT,
    private_notes TEXT
);

CREATE INDEX IF NOT EXISTS idx_trip_stops_trip_id ON trip_stops (trip_id);
CREATE INDEX IF NOT EXISTS idx_trip_stops_visit_status ON trip_stops (visit_status);

-- ============================================================================
-- 6. Append-Only Trip Event Log
-- ============================================================================
CREATE TABLE IF NOT EXISTS trip_events (
    id TEXT PRIMARY KEY,
    trip_id TEXT REFERENCES trips(id) ON DELETE CASCADE,
    resulting_revision INT NOT NULL,
    actor TEXT NOT NULL, -- 'user', 'ai_assistant', 'system'
    source TEXT NOT NULL, -- 'manual_editor', 'ai_tool', 'geofence', 'buffer_timeout'
    event_type TEXT NOT NULL, -- 'stop_visited', 'stop_skipped', 'stops_reordered', 'replan_committed'
    payload JSONB,
    created_at TIMESTAMPTZ DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_trip_events_trip_revision ON trip_events (trip_id, resulting_revision);

-- ============================================================================
-- 7. Provisional Replan Proposals
-- ============================================================================
CREATE TABLE IF NOT EXISTS replan_proposals (
    id TEXT PRIMARY KEY,
    trip_id TEXT REFERENCES trips(id) ON DELETE CASCADE,
    base_revision INT NOT NULL,
    requested_by TEXT NOT NULL, -- 'manual_editor', 'ai_assistant'
    operations JSONB NOT NULL,
    candidate_stops JSONB NOT NULL,
    validation_diff JSONB NOT NULL,
    is_feasible BOOLEAN NOT NULL,
    status TEXT DEFAULT 'pending', -- 'pending', 'accepted', 'rejected', 'expired'
    expires_at TIMESTAMPTZ NOT NULL,
    created_at TIMESTAMPTZ DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_replan_proposals_trip_status ON replan_proposals (trip_id, status);

-- ============================================================================
-- 8. Community Trails
-- ============================================================================
CREATE TABLE IF NOT EXISTS community_trails (
    id TEXT PRIMARY KEY,
    author_id TEXT NOT NULL,
    author_name TEXT NOT NULL,
    source_trip_id TEXT REFERENCES trips(id),
    title TEXT NOT NULL,
    description TEXT,
    destination TEXT DEFAULT 'Udaipur',
    duration_type TEXT DEFAULT 'single_day', -- 'single_day', 'multi_day'
    total_days INT DEFAULT 1,
    total_duration_hours NUMERIC,
    estimated_cost_inr NUMERIC,
    tags TEXT[],
    is_experienced BOOLEAN DEFAULT TRUE,
    visibility TEXT DEFAULT 'public', -- 'public', 'unlisted', 'private'
    is_featured BOOLEAN DEFAULT FALSE,
    created_at TIMESTAMPTZ DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_community_trails_featured ON community_trails (is_featured, created_at DESC);
CREATE INDEX IF NOT EXISTS idx_community_trails_tags ON community_trails USING GIN (tags);

-- ============================================================================
-- 9. Community Trail Stops
-- ============================================================================
CREATE TABLE IF NOT EXISTS community_trail_stops (
    id TEXT PRIMARY KEY,
    trail_id TEXT REFERENCES community_trails(id) ON DELETE CASCADE,
    place_id TEXT REFERENCES places(id),
    day_number INT DEFAULT 1,
    sequence_in_day INT NOT NULL,
    suggested_duration_minutes INT NOT NULL,
    estimated_transit_minutes INT DEFAULT 15,
    time_slot TEXT, -- 'morning', 'afternoon', 'sunset_evening', 'night'
    traveler_tip TEXT
);

CREATE INDEX IF NOT EXISTS idx_community_trail_stops_trail ON community_trail_stops (trail_id, day_number, sequence_in_day);

-- ============================================================================
-- 10. Artisan Voice Drafts
-- Hindi Web voice messages transcribed (Google STT hi-IN) and summarized (Gemini Admin Brief) before admin publication
-- ============================================================================
CREATE TABLE IF NOT EXISTS artisan_drafts (
    id TEXT PRIMARY KEY,
    submission_id TEXT UNIQUE,
    whatsapp_message_id TEXT UNIQUE,
    sender_phone TEXT NOT NULL,
    media_url TEXT,
    raw_transcript TEXT,
    extracted_data JSONB, -- Contains admin_brief, missing_info_checklist, pin_hash, catalogue_images, and pre-filled fields
    approval_status TEXT DEFAULT 'draft', -- 'draft', 'pending_confirmation', 'approved', 'rejected'
    created_at TIMESTAMPTZ DEFAULT NOW()
);

ALTER TABLE artisan_drafts ADD COLUMN IF NOT EXISTS submission_id TEXT UNIQUE;

CREATE INDEX IF NOT EXISTS idx_artisan_drafts_status ON artisan_drafts (approval_status);

-- ============================================================================
-- 11. Users (Tourists, Admins & Superusers - ADR 0011)
-- ============================================================================
CREATE TABLE IF NOT EXISTS users (
    id TEXT PRIMARY KEY,
    email TEXT UNIQUE NOT NULL,
    hashed_password TEXT NOT NULL,
    full_name TEXT NOT NULL,
    role TEXT NOT NULL DEFAULT 'tourist', -- 'tourist', 'admin', 'superuser'
    is_active BOOLEAN NOT NULL DEFAULT TRUE,
    created_at TIMESTAMPTZ DEFAULT NOW(),
    updated_at TIMESTAMPTZ DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_users_email ON users (email);
CREATE INDEX IF NOT EXISTS idx_users_role ON users (role);

