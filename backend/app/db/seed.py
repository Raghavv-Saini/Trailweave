"""
Seed data script for TrailWeave MVP.
Populates verified Udaipur places, artisans, initial community trails, and the demo active trip into Supabase PostgreSQL.
"""
import asyncio
import json
import os
import sys
from datetime import time, datetime, timezone
from typing import List, Dict, Any

# Add backend directory to sys.path if run directly
current_dir = os.path.dirname(os.path.abspath(__file__))
backend_dir = os.path.abspath(os.path.join(current_dir, "..", ".."))
if backend_dir not in sys.path:
    sys.path.insert(0, backend_dir)

from sqlalchemy import text
from app.core.database import engine
from app.core.security import hash_pin

PLACES_SEED: List[Dict[str, Any]] = [
    {
        "id": "place_city_palace",
        "name": "City Palace Udaipur",
        "category": "heritage",
        "latitude": 24.5764,
        "longitude": 73.6835,
        "address": "Old City, Udaipur, Rajasthan 313001",
        "entry_fee_inr": 330,
        "typical_duration_minutes": 120,
        "opening_time": time(9, 0),
        "closing_time": time(17, 30),
        "image_url": "https://images.unsplash.com/photo-1615836245337-f5b9b2303f10?auto=format&fit=crop&w=900&q=80",
        "data_status": "verified"
    },
    {
        "id": "place_jagdish_temple",
        "name": "Jagdish Temple",
        "category": "heritage",
        "latitude": 24.5794,
        "longitude": 73.6841,
        "address": "1 Jagdish Chowk, Old City, Udaipur, Rajasthan 313001",
        "entry_fee_inr": 0,
        "typical_duration_minutes": 30,
        "opening_time": time(5, 0),
        "closing_time": time(22, 0),
        "image_url": "https://images.pexels.com/photos/15534239/pexels-photo-15534239.jpeg?auto=compress&cs=tinysrgb&w=900",
        "data_status": "verified"
    },
    {
        "id": "place_saheliyon_bari",
        "name": "Saheliyon Ki Bari",
        "category": "attraction",
        "latitude": 24.6019,
        "longitude": 73.6853,
        "address": "Saheli Marg, New Vidhya Nagar, Udaipur, Rajasthan 313001",
        "entry_fee_inr": 50,
        "typical_duration_minutes": 60,
        "opening_time": time(9, 0),
        "closing_time": time(19, 0),
        "image_url": "https://images.unsplash.com/photo-1651306614297-9c1301ad460e?auto=format&fit=crop&w=900&q=80",
        "data_status": "verified"
    },
    {
        "id": "place_bagore_haveli",
        "name": "Bagore Ki Haveli",
        "category": "heritage",
        "latitude": 24.5798,
        "longitude": 73.6800,
        "address": "Gangaur Ghat Marg, Old City, Udaipur, Rajasthan 313001",
        "entry_fee_inr": 100,
        "typical_duration_minutes": 90,
        "opening_time": time(10, 0),
        "closing_time": time(20, 0),
        "image_url": "https://images.unsplash.com/photo-1722080711528-095791cd14d4?auto=format&fit=crop&w=900&q=80",
        "data_status": "verified"
    },
    {
        "id": "place_sukhadia_circle",
        "name": "Sukhadia Circle Street Food",
        "category": "dining",
        "latitude": 24.6035,
        "longitude": 73.6885,
        "address": "Sukhadia Circle, Panchwati, Udaipur, Rajasthan 313001",
        "entry_fee_inr": 0,
        "typical_duration_minutes": 45,
        "opening_time": time(17, 0),
        "closing_time": time(23, 0),
        "image_url": "https://images.unsplash.com/photo-1601050690597-df0568f70950?auto=format&fit=crop&w=900&q=80",
        "data_status": "verified"
    },
    {
        "id": "place_mohanlal_studio",
        "name": "Master Mohanlal Miniature Art Studio",
        "category": "artisan_studio",
        "latitude": 24.5796,
        "longitude": 73.6844,
        "address": "14 Jagdish Chowk, Old City, Udaipur, Rajasthan 313001",
        "entry_fee_inr": 0,
        "typical_duration_minutes": 45,
        "opening_time": time(10, 0),
        "closing_time": time(20, 0),
        "image_url": "https://images.unsplash.com/photo-1582555172866-f73bb12a2ab3?auto=format&fit=crop&w=900&q=80",
        "data_status": "verified"
    },
    {
        "id": "place_pottery_studio",
        "name": "Kavita Terracotta Pottery & Clay Studio",
        "category": "artisan_studio",
        "latitude": 24.5815,
        "longitude": 73.6820,
        "address": "22 Chandpole Ghat Road, Old City, Udaipur, Rajasthan 313001",
        "entry_fee_inr": 0,
        "typical_duration_minutes": 45,
        "opening_time": time(9, 30),
        "closing_time": time(19, 30),
        "image_url": "https://images.unsplash.com/photo-1565193566173-7a0ee3dbe261?auto=format&fit=crop&w=900&q=80",
        "data_status": "verified"
    },
    {
        "id": "place_puppetry_workshop",
        "name": "Udaipur Traditional Kathputli Puppetry Workshop",
        "category": "artisan_studio",
        "latitude": 24.5788,
        "longitude": 73.6815,
        "address": "Gangaur Ghat Road, Old City, Udaipur, Rajasthan 313001",
        "entry_fee_inr": 0,
        "typical_duration_minutes": 45,
        "opening_time": time(10, 0),
        "closing_time": time(19, 0),
        "image_url": "https://images.unsplash.com/photo-1534447677768-be436bb09401?auto=format&fit=crop&w=900&q=80",
        "data_status": "verified"
    },
    {
        "id": "place_leather_craft",
        "name": "Mewar Royal Leather & Jutti Craft Studio",
        "category": "artisan_studio",
        "latitude": 24.5840,
        "longitude": 73.6865,
        "address": "Hathi Pole Bazaar, Udaipur, Rajasthan 313001",
        "entry_fee_inr": 0,
        "typical_duration_minutes": 25,
        "opening_time": time(10, 30),
        "closing_time": time(20, 30),
        "image_url": "https://images.pexels.com/photos/4427645/pexels-photo-4427645.jpeg?auto=compress&cs=tinysrgb&w=900",
        "data_status": "verified"
    }
]

ARTISANS_SEED: List[Dict[str, Any]] = [
    {
        "id": "artisan_mohanlal",
        "place_id": "place_mohanlal_studio",
        "artisan_name": "Master Mohanlal Sharma",
        "craft_type": "Pichwai & Miniature Painting",
        "phone_number": "+919829012345",
        "pin_hash": hash_pin("1234"),
        "bio": "4th generation Udaipur miniature artist specializing in natural stone pigments and squirrel-hair brushes.",
        "catalogue_images": json.dumps([
            "https://images.unsplash.com/photo-1582555172866-f73bb12a2ab3?auto=format&fit=crop&w=900&q=80",
            "https://images.unsplash.com/photo-1579783902614-a3fb3927b675?auto=format&fit=crop&w=900&q=80",
        ]),
        "has_workshop": True,
        "workshop_fee_inr": 300,
        "workshop_duration_minutes": 45,
        "workshop_description": "Hands-on miniature painting masterclass on handmade vintage paper.",
        "profile_status": "approved"
    },
    {
        "id": "artisan_pottery",
        "place_id": "place_pottery_studio",
        "artisan_name": "Master Kavita Kumhar",
        "craft_type": "Terracotta Pottery & Clay Sculpting",
        "phone_number": "+919829023456",
        "pin_hash": hash_pin("1234"),
        "bio": "Renowned Mewar potter crafting heritage earthenware and terracotta votive plaques.",
        "catalogue_images": json.dumps([
            "https://images.unsplash.com/photo-1565193566173-7a0ee3dbe261?auto=format&fit=crop&w=900&q=80",
            "https://images.unsplash.com/photo-1610701596007-11502861dcfa?auto=format&fit=crop&w=900&q=80",
        ]),
        "has_workshop": True,
        "workshop_fee_inr": 250,
        "workshop_duration_minutes": 45,
        "workshop_description": "Wheel throwing and traditional Mewar terracotta clay sculpting masterclass.",
        "profile_status": "approved"
    },
    {
        "id": "artisan_puppetry",
        "place_id": "place_puppetry_workshop",
        "artisan_name": "Babu Bhatt Puppeteer",
        "craft_type": "Kathputli Traditional String Puppetry",
        "phone_number": "+919829034567",
        "pin_hash": hash_pin("1234"),
        "bio": "Master puppeteer preserving 1,000-year-old Rajasthani wooden string puppet theater traditions.",
        "catalogue_images": json.dumps([
            "https://images.unsplash.com/photo-1534447677768-be436bb09401?auto=format&fit=crop&w=900&q=80",
        ]),
        "has_workshop": True,
        "workshop_fee_inr": 200,
        "workshop_duration_minutes": 45,
        "workshop_description": "Learn string manipulation, carving, and live traditional Rajasthani puppet theater storytelling.",
        "profile_status": "approved"
    },
    {
        "id": "artisan_leather",
        "place_id": "place_leather_craft",
        "artisan_name": "Ramesh Chandra Parmar",
        "craft_type": "Handcrafted Camel Leather & Mojari Juttis",
        "phone_number": "+919829045678",
        "pin_hash": hash_pin("1234"),
        "bio": "Heritage cobbler and artisan crafting durable vegetable-tanned camel leather juttis with silk embroidery.",
        "catalogue_images": json.dumps([
            "https://images.pexels.com/photos/4427645/pexels-photo-4427645.jpeg?auto=compress&cs=tinysrgb&w=900",
        ]),
        "has_workshop": False,
        "workshop_fee_inr": 0,
        "workshop_duration_minutes": 20,
        "workshop_description": "Browse master leather embroidery and hand-stitching techniques.",
        "profile_status": "approved"
    }
]

COMMUNITY_TRAILS_SEED: List[Dict[str, Any]] = [
    {
        "id": "trail_royal_palaces_crafts",
        "author_id": "user_arjun_travels",
        "author_name": "Arjun Sharma",
        "title": "Udaipur Royal Palaces & Crafts",
        "description": "A classic single-day journey through Udaipur's iconic royal complex, sacred temples, and living heritage masterclasses.",
        "destination": "Udaipur",
        "duration_type": "single_day",
        "total_days": 1,
        "total_duration_hours": 6.5,
        "estimated_cost_inr": 1250,
        "tags": ["heritage", "artisan", "walking"],
        "is_experienced": True,
        "visibility": "public",
        "is_featured": True
    },
    {
        "id": "trail_old_city_heritage_walk",
        "author_id": "user_priya_walks",
        "author_name": "Priya Sen",
        "title": "Old City Evening Heritage Walk",
        "description": "Sunset views by Lake Pichola, evening prayers at Jagdish Temple, and street food tastings at Sukhadia Circle.",
        "destination": "Udaipur",
        "duration_type": "single_day",
        "total_days": 1,
        "total_duration_hours": 3.5,
        "estimated_cost_inr": 450,
        "tags": ["heritage", "evening", "food"],
        "is_experienced": True,
        "visibility": "public",
        "is_featured": True
    }
]

COMMUNITY_TRAIL_STOPS_SEED: List[Dict[str, Any]] = [
    # Stops for "Udaipur Royal Palaces & Crafts"
    {
        "id": "cts_rpc_1",
        "trail_id": "trail_royal_palaces_crafts",
        "place_id": "place_city_palace",
        "day_number": 1,
        "sequence_in_day": 1,
        "suggested_duration_minutes": 120,
        "estimated_transit_minutes": 10,
        "time_slot": "morning",
        "traveler_tip": "Arrive early at 9:30 AM to beat tour groups. Purchase the museum + palace composite ticket at Badi Pol."
    },
    {
        "id": "cts_rpc_2",
        "trail_id": "trail_royal_palaces_crafts",
        "place_id": "place_mohanlal_studio",
        "day_number": 1,
        "sequence_in_day": 2,
        "suggested_duration_minutes": 45,
        "estimated_transit_minutes": 5,
        "time_slot": "morning",
        "traveler_tip": "Located just 2 mins walk from Jagdish Chowk. Master Mohanlal demonstrates squirrel-hair fine detailing."
    },
    {
        "id": "cts_rpc_3",
        "trail_id": "trail_royal_palaces_crafts",
        "place_id": "place_jagdish_temple",
        "day_number": 1,
        "sequence_in_day": 3,
        "suggested_duration_minutes": 30,
        "estimated_transit_minutes": 10,
        "time_slot": "afternoon",
        "traveler_tip": "Climb the steep stone steps to admire the intricate 1651 AD pillar carvings."
    },
    {
        "id": "cts_rpc_4",
        "trail_id": "trail_royal_palaces_crafts",
        "place_id": "place_bagore_haveli",
        "day_number": 1,
        "sequence_in_day": 4,
        "suggested_duration_minutes": 90,
        "estimated_transit_minutes": 0,
        "time_slot": "sunset_evening",
        "traveler_tip": "Book seats for the 7 PM Dharohar cultural dance performance in the neem courtyard."
    },

    # Stops for "Old City Evening Heritage Walk"
    {
        "id": "cts_ehw_1",
        "trail_id": "trail_old_city_heritage_walk",
        "place_id": "place_bagore_haveli",
        "day_number": 1,
        "sequence_in_day": 1,
        "suggested_duration_minutes": 75,
        "estimated_transit_minutes": 5,
        "time_slot": "sunset_evening",
        "traveler_tip": "Sit by Gangaur Ghat just outside before entry to watch the sun set over Lake Pichola."
    },
    {
        "id": "cts_ehw_2",
        "trail_id": "trail_old_city_heritage_walk",
        "place_id": "place_jagdish_temple",
        "day_number": 1,
        "sequence_in_day": 2,
        "suggested_duration_minutes": 30,
        "estimated_transit_minutes": 15,
        "time_slot": "evening",
        "traveler_tip": "Evening aarti with temple bells is magical around 7:30 PM."
    },
    {
        "id": "cts_ehw_3",
        "trail_id": "trail_old_city_heritage_walk",
        "place_id": "place_sukhadia_circle",
        "day_number": 1,
        "sequence_in_day": 3,
        "suggested_duration_minutes": 60,
        "estimated_transit_minutes": 0,
        "time_slot": "night",
        "traveler_tip": "Take a 10-minute auto-rickshaw to Sukhadia Circle for pav bhaji, falooda, and kulfi."
    }
]

DEMO_TRIP_STOPS_SEED: List[Dict[str, Any]] = [
    {
        "id": "stop_cp",
        "trip_id": "trip_demo_udaipur",
        "itinerary_version_id": "ver_demo_1",
        "place_id": "place_city_palace",
        "day_number": 1,
        "sequence_in_day": 1,
        "planned_arrival": datetime(2026, 10, 31, 9, 30, tzinfo=timezone.utc),
        "planned_departure": datetime(2026, 10, 31, 11, 30, tzinfo=timezone.utc),
        "suggested_duration_minutes": 120,
        "actual_duration_minutes": 120,
        "is_pinned": False,
        "visit_status": "visited",
        "source_attribution": "Udaipur Royal Palaces & Crafts",
        "private_notes": "Enter via Badi Pol gate"
    },
    {
        "id": "stop_ms",
        "trip_id": "trip_demo_udaipur",
        "itinerary_version_id": "ver_demo_1",
        "place_id": "place_mohanlal_studio",
        "day_number": 1,
        "sequence_in_day": 2,
        "planned_arrival": datetime(2026, 10, 31, 11, 45, tzinfo=timezone.utc),
        "planned_departure": datetime(2026, 10, 31, 12, 30, tzinfo=timezone.utc),
        "suggested_duration_minutes": 45,
        "actual_duration_minutes": None,
        "is_pinned": True,
        "visit_status": "pending",
        "source_attribution": "TrailWeave Artisan Recommendation",
        "private_notes": "45-min miniature painting masterclass"
    },
    {
        "id": "stop_jt",
        "trip_id": "trip_demo_udaipur",
        "itinerary_version_id": "ver_demo_1",
        "place_id": "place_jagdish_temple",
        "day_number": 1,
        "sequence_in_day": 3,
        "planned_arrival": datetime(2026, 10, 31, 12, 45, tzinfo=timezone.utc),
        "planned_departure": datetime(2026, 10, 31, 13, 15, tzinfo=timezone.utc),
        "suggested_duration_minutes": 30,
        "actual_duration_minutes": None,
        "is_pinned": False,
        "visit_status": "pending",
        "source_attribution": "Udaipur Royal Palaces & Crafts",
        "private_notes": "Shoe drop-off at bottom of marble steps"
    },
    {
        "id": "stop_bh",
        "trip_id": "trip_demo_udaipur",
        "itinerary_version_id": "ver_demo_1",
        "place_id": "place_bagore_haveli",
        "day_number": 1,
        "sequence_in_day": 4,
        "planned_arrival": datetime(2026, 10, 31, 13, 15, tzinfo=timezone.utc),
        "planned_departure": datetime(2026, 10, 31, 14, 45, tzinfo=timezone.utc),
        "suggested_duration_minutes": 90,
        "actual_duration_minutes": None,
        "is_pinned": False,
        "visit_status": "pending",
        "source_attribution": "Old City Evening Heritage Walk",
        "private_notes": "Walk via Gangaur Ghat lakeside lane"
    },
    {
        "id": "stop_sb",
        "trip_id": "trip_demo_udaipur",
        "itinerary_version_id": "ver_demo_1",
        "place_id": "place_saheliyon_bari",
        "day_number": 1,
        "sequence_in_day": 5,
        "planned_arrival": datetime(2026, 10, 31, 15, 15, tzinfo=timezone.utc),
        "planned_departure": datetime(2026, 10, 31, 16, 15, tzinfo=timezone.utc),
        "suggested_duration_minutes": 60,
        "actual_duration_minutes": None,
        "is_pinned": False,
        "visit_status": "pending",
        "source_attribution": "Udaipur Royal Palaces & Crafts",
        "private_notes": "Fountain gardens and marble lotus kiosks"
    },
    {
        "id": "stop_sc",
        "trip_id": "trip_demo_udaipur",
        "itinerary_version_id": "ver_demo_1",
        "place_id": "place_sukhadia_circle",
        "day_number": 1,
        "sequence_in_day": 6,
        "planned_arrival": datetime(2026, 10, 31, 17, 0, tzinfo=timezone.utc),
        "planned_departure": datetime(2026, 10, 31, 18, 0, tzinfo=timezone.utc),
        "suggested_duration_minutes": 60,
        "actual_duration_minutes": None,
        "is_pinned": False,
        "visit_status": "pending",
        "source_attribution": "Old City Evening Heritage Walk",
        "private_notes": "Evening street food and kulhad chai"
    }
]


async def seed_database() -> None:
    """Populates seed data using idempotent UPSERT statements."""
    print("🌱 Starting TrailWeave database seeding...")

    async with engine.begin() as conn:
        await conn.execute(text("ALTER TABLE places ADD COLUMN IF NOT EXISTS image_url TEXT"))
        await conn.execute(text("ALTER TABLE artisans ADD COLUMN IF NOT EXISTS pin_hash TEXT"))
        await conn.execute(text("ALTER TABLE artisans ADD COLUMN IF NOT EXISTS catalogue_images JSONB DEFAULT '[]'::jsonb"))

        # 1. Seed Places
        for p in PLACES_SEED:
            await conn.execute(
                text("""
                    INSERT INTO places (
                        id, name, category, latitude, longitude, address,
                        entry_fee_inr, typical_duration_minutes, opening_time, closing_time, image_url, data_status
                    ) VALUES (
                        :id, :name, :category, :latitude, :longitude, :address,
                        :entry_fee_inr, :typical_duration_minutes, :opening_time, :closing_time, :image_url, :data_status
                    )
                    ON CONFLICT (id) DO UPDATE SET
                        name = EXCLUDED.name,
                        category = EXCLUDED.category,
                        latitude = EXCLUDED.latitude,
                        longitude = EXCLUDED.longitude,
                        address = EXCLUDED.address,
                        entry_fee_inr = EXCLUDED.entry_fee_inr,
                        typical_duration_minutes = EXCLUDED.typical_duration_minutes,
                        opening_time = EXCLUDED.opening_time,
                        closing_time = EXCLUDED.closing_time,
                        image_url = EXCLUDED.image_url,
                        data_status = EXCLUDED.data_status;
                """),
                p
            )
        print(f"✓ Seeded {len(PLACES_SEED)} places.")

        # 2. Seed Artisans
        for a in ARTISANS_SEED:
            await conn.execute(
                text("""
                    INSERT INTO artisans (
                        id, place_id, artisan_name, craft_type, phone_number, pin_hash,
                        bio, catalogue_images, has_workshop, workshop_fee_inr, workshop_duration_minutes,
                        workshop_description, profile_status
                    ) VALUES (
                        :id, :place_id, :artisan_name, :craft_type, :phone_number, :pin_hash,
                        :bio, CAST(:catalogue_images AS jsonb), :has_workshop, :workshop_fee_inr, :workshop_duration_minutes,
                        :workshop_description, :profile_status
                    )
                    ON CONFLICT (id) DO UPDATE SET
                        place_id = EXCLUDED.place_id,
                        artisan_name = EXCLUDED.artisan_name,
                        craft_type = EXCLUDED.craft_type,
                        phone_number = EXCLUDED.phone_number,
                        pin_hash = COALESCE(artisans.pin_hash, EXCLUDED.pin_hash),
                        bio = EXCLUDED.bio,
                        catalogue_images = EXCLUDED.catalogue_images,
                        has_workshop = EXCLUDED.has_workshop,
                        workshop_fee_inr = EXCLUDED.workshop_fee_inr,
                        workshop_duration_minutes = EXCLUDED.workshop_duration_minutes,
                        workshop_description = EXCLUDED.workshop_description,
                        profile_status = EXCLUDED.profile_status;
                """),
                a
            )
        print(f"✓ Seeded {len(ARTISANS_SEED)} artisans.")

        # 3. Seed Community Trails
        for t in COMMUNITY_TRAILS_SEED:
            await conn.execute(
                text("""
                    INSERT INTO community_trails (
                        id, author_id, author_name, title, description,
                        destination, duration_type, total_days, total_duration_hours,
                        estimated_cost_inr, tags, is_experienced, visibility, is_featured
                    ) VALUES (
                        :id, :author_id, :author_name, :title, :description,
                        :destination, :duration_type, :total_days, :total_duration_hours,
                        :estimated_cost_inr, :tags, :is_experienced, :visibility, :is_featured
                    )
                    ON CONFLICT (id) DO UPDATE SET
                        title = EXCLUDED.title,
                        description = EXCLUDED.description,
                        total_duration_hours = EXCLUDED.total_duration_hours,
                        estimated_cost_inr = EXCLUDED.estimated_cost_inr,
                        tags = EXCLUDED.tags,
                        is_featured = EXCLUDED.is_featured;
                """),
                t
            )
        print(f"✓ Seeded {len(COMMUNITY_TRAILS_SEED)} community trails.")

        # 4. Seed Community Trail Stops
        for cs in COMMUNITY_TRAIL_STOPS_SEED:
            await conn.execute(
                text("""
                    INSERT INTO community_trail_stops (
                        id, trail_id, place_id, day_number, sequence_in_day,
                        suggested_duration_minutes, estimated_transit_minutes, time_slot, traveler_tip
                    ) VALUES (
                        :id, :trail_id, :place_id, :day_number, :sequence_in_day,
                        :suggested_duration_minutes, :estimated_transit_minutes, :time_slot, :traveler_tip
                    )
                    ON CONFLICT (id) DO UPDATE SET
                        suggested_duration_minutes = EXCLUDED.suggested_duration_minutes,
                        estimated_transit_minutes = EXCLUDED.estimated_transit_minutes,
                        time_slot = EXCLUDED.time_slot,
                        traveler_tip = EXCLUDED.traveler_tip;
                """),
                cs
            )
        print(f"✓ Seeded {len(COMMUNITY_TRAIL_STOPS_SEED)} community trail stops.")

        # 5. Seed Demo Active Trip ("trip_demo_udaipur") & Version ("ver_demo_1")
        await conn.execute(
            text("""
                INSERT INTO trips (
                    id, user_id, title, destination, duration_type, total_days,
                    budget_inr, budget_mode, artisan_preference, revision,
                    current_itinerary_version_id, status
                ) VALUES (
                    'trip_demo_udaipur', 'user_demo_raghav', 'Udaipur Living Heritage & Crafts Walk',
                    'Udaipur', 'single_day', 1, 1500, 'total', 'both', 1,
                    'ver_demo_1', 'in_progress'
                )
                ON CONFLICT (id) DO UPDATE SET
                    title = 'Udaipur Living Heritage & Crafts Walk',
                    revision = 1,
                    current_itinerary_version_id = 'ver_demo_1',
                    status = 'in_progress';
            """)
        )

        await conn.execute(
            text("""
                INSERT INTO itinerary_versions (
                    id, trip_id, version_number, total_estimated_cost_inr, total_estimated_duration_minutes
                ) VALUES (
                    'ver_demo_1', 'trip_demo_udaipur', 1, 780, 405
                )
                ON CONFLICT (id) DO UPDATE SET
                    version_number = 1,
                    total_estimated_cost_inr = 780,
                    total_estimated_duration_minutes = 405;
            """)
        )

        await conn.execute(
            text("DELETE FROM trip_stops WHERE trip_id = 'trip_demo_udaipur'")
        )

        for ts in DEMO_TRIP_STOPS_SEED:
            await conn.execute(
                text("""
                    INSERT INTO trip_stops (
                        id, trip_id, itinerary_version_id, place_id, day_number, sequence_in_day,
                        planned_arrival, planned_departure, suggested_duration_minutes,
                        actual_duration_minutes, is_pinned, visit_status, source_attribution, private_notes
                    ) VALUES (
                        :id, :trip_id, :itinerary_version_id, :place_id, :day_number, :sequence_in_day,
                        :planned_arrival, :planned_departure, :suggested_duration_minutes,
                        :actual_duration_minutes, :is_pinned, :visit_status, :source_attribution, :private_notes
                    )
                    ON CONFLICT (id) DO UPDATE SET
                        trip_id = EXCLUDED.trip_id,
                        itinerary_version_id = EXCLUDED.itinerary_version_id,
                        place_id = EXCLUDED.place_id,
                        day_number = EXCLUDED.day_number,
                        sequence_in_day = EXCLUDED.sequence_in_day,
                        planned_arrival = EXCLUDED.planned_arrival,
                        planned_departure = EXCLUDED.planned_departure,
                        suggested_duration_minutes = EXCLUDED.suggested_duration_minutes,
                        actual_duration_minutes = EXCLUDED.actual_duration_minutes,
                        is_pinned = EXCLUDED.is_pinned,
                        visit_status = EXCLUDED.visit_status,
                        source_attribution = EXCLUDED.source_attribution,
                        private_notes = EXCLUDED.private_notes;
                """),
                ts
            )
        print(f"✓ Seeded demo active trip (trip_demo_udaipur) with {len(DEMO_TRIP_STOPS_SEED)} stops.")

    print("✨ Database seeding completed successfully!")


if __name__ == "__main__":
    asyncio.run(seed_database())
