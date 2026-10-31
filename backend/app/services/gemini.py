"""
Google GenAI (Gemini Flash) Service & Tool Calling Interface
Used in Track 1 (Trip-to-Trail), Track 3 (Companion), and Track 4 (Hindi Voice Note Admin Brief & Structured Extraction).
Spec: docs/API_SPEC.md §1.4, §1.5 & §2, ADR 0004, ADR 0005, ADR 0008, ADR 0010
"""
import os
import re
import json
import uuid
import logging
from datetime import datetime, timezone, timedelta
from typing import Dict, Any, List, Optional

try:
    import httpx
except ImportError:
    httpx = None

try:
    from sqlalchemy.ext.asyncio import AsyncSession
    from sqlalchemy import text
except ImportError:
    AsyncSession = Any  # type: ignore
    text = lambda s: s  # type: ignore

try:
    from app.core.config import settings
except ImportError:
    class _FallbackSettings:
        GEMINI_API_KEY = os.getenv("GEMINI_API_KEY", "")
        GOOGLE_MAPS_API_KEY = os.getenv("GOOGLE_MAPS_API_KEY", "")
    settings = _FallbackSettings()  # type: ignore

try:
    from app.engine.replan import UnifiedMutationEngine
    from app.schemas.replan import ReplanOperation, ValidationDiff
    from app.services.planner import StartLocation
except ImportError:
    UnifiedMutationEngine = None  # type: ignore
    ReplanOperation = None  # type: ignore
    ValidationDiff = None  # type: ignore
    StartLocation = None  # type: ignore

logger = logging.getLogger(__name__)

COMPANION_SYSTEM_PROMPT = """
You are the TrailWeave AI Travel Companion, a warm, knowledgeable, and cultured travel connoisseur intimately familiar with Udaipur ("The Cultured Local Friend").
You speak with cultural warmth and genuine Rajasthani hospitality (always greeting with "Khamma Ghani!" or "Namaste").
You know Udaipur inside out:
- Lake Pichola, Gangaur Ghat, Ambrai Ghat, City Palace, Jagdish Temple, Jagdish Chowk alleys.
- Fateh Sagar Lake: Fateh Sagar Paal promenade (Bombay Market stalls for hot kulhad chai and cold coffee), Nehru Park island boat ride, Rani Road lakeside cafes, Sukhadia Circle street food.
- Verified artisan studios: Master Mohanlal (Pichwai & Miniature Painting in Jagdish Chowk), Kavita Kumhar (Mewar Terracotta Pottery on Chandpole Ghat Road), Babu Bhatt (Kathputli Traditional String Puppetry), Ramesh Chandra (Camel Leather & Juttis in Hathi Pole).
- Lakeside dining & rooftop restaurants: Upre by 1559 AD, Ambrai Restaurant at Gangaur Ghat, Tribute, Jheel's Ginger Coffee Bar & Bakery, Raas Leela.
- Local customs: shoe drop-offs at temples, conservative attire covering shoulders and knees, golden sunset hour (5:30-6:30 PM), evening Dharohar dance at Bagore Ki Haveli (7 PM).

OPERATIONAL RULES:
1. Active itinerary state (current stops, revision number, budget, and recent manual edits) is ALREADY provided in the prompt context.
2. When the traveler asks for recommendations, options, food, lakeside restaurants, sunset points, cultural etiquette, or local tips (e.g. "Give me options nearby fatehsagar", "Find lakeside restaurant", "What should I wear?"):
   - Respond with rich, specific, cultured recommendations directly in your text narrative.
   - Do NOT give generic evasive stock replies. Name authentic Udaipur venues, describe their ambiance, what to order or do, and offer local curator tips!
3. When the traveler requests itinerary changes (e.g., "skip the fort", "tired, want tea instead", "add pottery workshop", "reorder stops"):
   - Call the `propose_trip_changes` tool so the Trip Engine can calculate transit and generate a provisional ReplanProposalCard.
   - In the tool argument `response_narrative`, provide a warm Rajasthani explanation acknowledging prior actions and explaining the change.
4. Acknowledge prior traveler actions warmly whenever relevant.

CANONICAL PLACE CATALOG (You MUST use these exact place IDs when calling propose_trip_changes):
- "place_leather_craft": Mewar Royal Leather & Jutti Craft Studio (Ramesh Chandra Parmar in Hathi Pole Bazaar - camel leather juttis & mojari)
- "place_bagore_haveli": Bagore Ki Haveli (Gangaur Ghat & Ambrai Ghat waterfront on Lake Pichola, evening Dharohar dance)
- "place_sukhadia_circle": Sukhadia Circle Street Food (Fateh Sagar food hub, Bombay Market tea, pav bhaji, rabdi)
- "place_mohanlal_studio": Master Mohanlal Miniature Art Studio (14 Jagdish Chowk - Pichwai & stone pigment painting)
- "place_pottery_studio": Kavita Terracotta Pottery & Clay Studio (Chandpole Ghat Road - wheel throwing & terracotta sculpting)
- "place_puppetry_workshop": Udaipur Traditional Kathputli Puppetry Workshop (Gangaur Ghat Road - wooden string puppet theater)
- "place_city_palace": City Palace Udaipur (heritage)
- "place_jagdish_temple": Jagdish Temple (heritage)
- "place_saheliyon_bari": Saheliyon Ki Bari (attraction)

When proposing to add Ramesh Chandra's leather studio or Hathi Pole, you MUST pass place_id="place_leather_craft".
When proposing to add Ambrai Ghat or Bagore Ki Haveli, you MUST pass place_id="place_bagore_haveli".
"""

def normalize_place_id(place_id: Optional[str], context_text: str = "") -> str:
    """
    Normalizes a place_id or text mention to canonical place IDs in the PostgreSQL catalog.
    """
    combined = f"{place_id or ''} {context_text or ''}".lower()
    if any(k in combined for k in ["leather", "jutti", "ramesh", "chandra", "parmar", "mojari", "hathi pole", "hathipole"]):
        return "place_leather_craft"
    if any(k in combined for k in ["ambrai", "ghat", "bagore", "haveli", "gangaur", "dharohar"]):
        return "place_bagore_haveli"
    if any(k in combined for k in ["mohanlal", "miniature", "pichwai", "sharma"]):
        return "place_mohanlal_studio"
    if any(k in combined for k in ["pottery", "clay", "kavita", "terracotta", "kumhar"]):
        return "place_pottery_studio"
    if any(k in combined for k in ["puppet", "kathputli", "babu", "bhatt"]):
        return "place_puppetry_workshop"
    if any(k in combined for k in ["sukhadia", "circle", "fatehsagar", "fateh sagar", "snack", "chaat", "tea", "chai", "coffee", "bombay market"]):
        return "place_sukhadia_circle"
    if any(k in combined for k in ["saheli", "bari"]):
        return "place_saheliyon_bari"
    if any(k in combined for k in ["jagdish", "temple", "mandir"]):
        return "place_jagdish_temple"
    if any(k in combined for k in ["city palace", "palace"]):
        return "place_city_palace"

    valid_ids = {
        "place_city_palace", "place_jagdish_temple", "place_saheliyon_bari",
        "place_bagore_haveli", "place_sukhadia_circle", "place_mohanlal_studio",
        "place_pottery_studio", "place_puppetry_workshop", "place_leather_craft"
    }
    if place_id in valid_ids:
        return place_id
    return "place_sukhadia_circle"


PRIMARY_GEMINI_MODEL = "gemini-3.1-flash-lite"
FALLBACK_GEMINI_MODEL = "gemini-3.5-flash"


async def call_gemini_api(
    api_key: str,
    payload: Dict[str, Any],
    timeout: float = 20.0
) -> Optional[Dict[str, Any]]:
    """Helper to query Gemini API with model fallback and error resilience."""
    if not api_key or not httpx:
        return None
    models = [PRIMARY_GEMINI_MODEL, FALLBACK_GEMINI_MODEL]
    for model in models:
        url = f"https://generativelanguage.googleapis.com/v1beta/models/{model}:generateContent?key={api_key}"
        try:
            async with httpx.AsyncClient(timeout=timeout) as client:
                resp = await client.post(url, json=payload)
                if resp.status_code == 200:
                    return resp.json()
                elif resp.status_code in (404, 503):
                    logger.warning("Gemini model %s returned status %d, trying fallback...", model, resp.status_code)
                    continue
                else:
                    logger.warning("Gemini model %s returned unexpected status %d: %s", model, resp.status_code, resp.text[:200])
        except Exception as e:
            logger.warning("Gemini API call failed for %s: %s", model, e)
            continue
    return None


DEMO_TRIP_FALLBACK: Dict[str, Any] = {
    "trip_id": "trip_demo_udaipur",
    "title": "Udaipur Living Heritage & Crafts Walk",
    "revision": 1,
    "budget_inr": 2500.0,
    "status": "planned",
    "stops": [
        {
            "id": "stop_cp",
            "place_id": "place_city_palace",
            "name": "City Palace Udaipur",
            "category": "heritage",
            "day_number": 1,
            "sequence_in_day": 1,
            "planned_arrival": "2026-10-31T09:30:00Z",
            "planned_departure": "2026-10-31T11:30:00Z",
            "suggested_duration_minutes": 120,
            "actual_duration_minutes": 120,
            "visit_status": "visited",
            "is_pinned": False,
            "entry_fee_inr": 330.0,
            "address": "Old City, Udaipur, Rajasthan 313001"
        },
        {
            "id": "stop_ms",
            "place_id": "place_mohanlal_studio",
            "name": "Master Mohanlal Miniature Art Studio",
            "category": "artisan_studio",
            "day_number": 1,
            "sequence_in_day": 2,
            "planned_arrival": "2026-10-31T11:45:00Z",
            "planned_departure": "2026-10-31T12:30:00Z",
            "suggested_duration_minutes": 45,
            "actual_duration_minutes": None,
            "visit_status": "pending",
            "is_pinned": True,
            "entry_fee_inr": 0.0,
            "address": "14 Jagdish Chowk, Old City, Udaipur, Rajasthan 313001"
        },
        {
            "id": "stop_jt",
            "place_id": "place_jagdish_temple",
            "name": "Jagdish Temple",
            "category": "heritage",
            "day_number": 1,
            "sequence_in_day": 3,
            "planned_arrival": "2026-10-31T12:35:00Z",
            "planned_departure": "2026-10-31T13:05:00Z",
            "suggested_duration_minutes": 30,
            "actual_duration_minutes": None,
            "visit_status": "pending",
            "is_pinned": False,
            "entry_fee_inr": 0.0,
            "address": "1 Jagdish Chowk, Old City, Udaipur, Rajasthan 313001"
        },
        {
            "id": "stop_bh",
            "place_id": "place_bagore_haveli",
            "name": "Bagore Ki Haveli",
            "category": "heritage",
            "day_number": 1,
            "sequence_in_day": 4,
            "planned_arrival": "2026-10-31T16:00:00Z",
            "planned_departure": "2026-10-31T17:15:00Z",
            "suggested_duration_minutes": 75,
            "actual_duration_minutes": None,
            "visit_status": "pending",
            "is_pinned": False,
            "entry_fee_inr": 100.0,
            "address": "Gangaur Ghat Marg, Old City, Udaipur, Rajasthan 313001"
        }
    ]
}


GEMINI_TOOL_DECLARATIONS = [
    {
        "name": "get_current_trip",
        "description": "Fetches the current authoritative trip state, current revision number, active stops, and traveler budget/preference constraints.",
        "parameters": {
            "type": "OBJECT",
            "properties": {
                "trip_id": {
                    "type": "STRING",
                    "description": "Unique identifier of the tourist trip."
                }
            },
            "required": ["trip_id"]
        }
    },
    {
        "name": "get_recent_trip_events",
        "description": "Fetches the recent accepted trip events (manual skips, additions, reorders, checkouts) so the AI can acknowledge previous user actions.",
        "parameters": {
            "type": "OBJECT",
            "properties": {
                "trip_id": {
                    "type": "STRING",
                    "description": "Unique identifier of the tourist trip."
                },
                "limit": {
                    "type": "INTEGER",
                    "description": "Maximum number of recent events to retrieve (default: 5)."
                }
            },
            "required": ["trip_id"]
        }
    },
    {
        "name": "search_places",
        "description": "Searches canonical places and verified local artisan studios in Udaipur by keyword, category, or proximity to current coordinates.",
        "parameters": {
            "type": "OBJECT",
            "properties": {
                "query": {
                    "type": "STRING",
                    "description": "Search term, e.g. 'pottery', 'miniature painting', 'rooftop tea', 'dining'."
                },
                "category": {
                    "type": "STRING",
                    "enum": ["attraction", "heritage", "dining", "artisan_studio"],
                    "description": "Filter by place category."
                },
                "max_fee_inr": {
                    "type": "INTEGER",
                    "description": "Maximum entry or workshop fee allowed."
                },
                "max_detour_minutes": {
                    "type": "INTEGER",
                    "description": "Maximum travel detour time in minutes."
                }
            }
        }
    },
    {
        "name": "get_place_details",
        "description": "Fetches verified operational details of a specific canonical place or artisan studio, including hours, workshop pricing, and address.",
        "parameters": {
            "type": "OBJECT",
            "properties": {
                "place_id": {
                    "type": "STRING",
                    "description": "The unique place identifier."
                }
            },
            "required": ["place_id"]
        }
    },
    {
        "name": "propose_trip_changes",
        "description": "Submits candidate itinerary modifications to the deterministic Trip Engine and generates a provisional ReplanProposal for tourist preview and approval.",
        "parameters": {
            "type": "OBJECT",
            "properties": {
                "trip_id": {
                    "type": "STRING",
                    "description": "The unique trip identifier."
                },
                "base_revision": {
                    "type": "INTEGER",
                    "description": "The latest trip revision number the AI is proposing changes against."
                },
                "operations": {
                    "type": "ARRAY",
                    "description": "Ordered sequence of candidate operations.",
                    "items": {
                        "type": "OBJECT",
                        "properties": {
                            "type": {
                                "type": "STRING",
                                "enum": ["add_stop", "remove_stop", "skip_stop", "reorder_stops", "pin_stop"],
                                "description": "The mutation action to perform."
                            },
                            "place_id": {
                                "type": "STRING",
                                "description": "Canonical place ID for add_stop operations."
                            },
                            "stop_id": {
                                "type": "STRING",
                                "description": "Existing stop ID for skip, remove, or pin operations."
                            },
                            "new_order": {
                                "type": "INTEGER",
                                "description": "Target sequence index within the day."
                            }
                        },
                        "required": ["type"]
                    }
                },
                "response_narrative": {
                    "type": "STRING",
                    "description": "Warm, cultured explanation for the traveler with Rajasthani hospitality (Khamma Ghani) and reasoning for this itinerary adaptation."
                }
            },
            "required": ["trip_id", "base_revision", "operations"]
        }
    }
]


class GeminiCompanionService:
    def __init__(self, api_key: Optional[str] = None):
        self.api_key = api_key or settings.GEMINI_API_KEY
        self.mutation_engine = UnifiedMutationEngine()

    async def generate_reply(self, message: str, trip_context: Dict[str, Any]) -> str:
        """Conversational companion response generation fallback."""
        return "I can help adjust your itinerary! Would you like me to look for a nearby artisan workshop?"

    async def execute_get_current_trip(self, trip_id: str, db: Optional[AsyncSession] = None) -> Dict[str, Any]:
        """Fetch authoritative trip state, current revision, and active stops."""
        if db is None:
            return dict(DEMO_TRIP_FALLBACK)
        trip_res = await db.execute(
            text("SELECT * FROM trips WHERE id = :id"),
            {"id": trip_id}
        )
        trip = trip_res.fetchone()
        if not trip and trip_id in ["trip_demo_udaipur", "trip_udaipur_heritage_01"]:
            demo_res = await db.execute(
                text("SELECT * FROM trips WHERE id = 'trip_demo_udaipur'")
            )
            trip = demo_res.fetchone()

        if not trip:
            if trip_id in ["trip_demo_udaipur", "trip_udaipur_heritage_01"]:
                return dict(DEMO_TRIP_FALLBACK)
            return {"error": f"Trip {trip_id} not found"}

        stops = []
        if trip.current_itinerary_version_id:
            stops_res = await db.execute(
                text("""
                    SELECT
                        s.id, s.place_id, s.day_number, s.sequence_in_day,
                        s.planned_arrival, s.planned_departure,
                        s.suggested_duration_minutes, s.actual_duration_minutes,
                        s.visit_status, s.is_pinned,
                        p.name, p.category, p.entry_fee_inr, p.address
                    FROM trip_stops s
                    LEFT JOIN places p ON s.place_id = p.id
                    WHERE s.itinerary_version_id = :vid
                    ORDER BY s.day_number, s.sequence_in_day
                """),
                {"vid": trip.current_itinerary_version_id}
            )
            for r in stops_res.fetchall():
                stops.append({
                    "id": r.id,
                    "place_id": r.place_id,
                    "name": r.name,
                    "category": r.category,
                    "day_number": r.day_number,
                    "sequence_in_day": r.sequence_in_day,
                    "planned_arrival": r.planned_arrival.isoformat() if r.planned_arrival else None,
                    "planned_departure": r.planned_departure.isoformat() if r.planned_departure else None,
                    "suggested_duration_minutes": r.suggested_duration_minutes,
                    "actual_duration_minutes": r.actual_duration_minutes,
                    "visit_status": r.visit_status,
                    "is_pinned": r.is_pinned,
                    "entry_fee_inr": float(r.entry_fee_inr or 0),
                    "address": r.address
                })

        return {
            "trip_id": trip.id,
            "title": trip.title,
            "revision": trip.revision,
            "budget_inr": float(trip.budget_inr or 0),
            "status": trip.status,
            "stops": stops
        }

    async def execute_get_recent_trip_events(self, trip_id: str, limit: int, db: Optional[AsyncSession] = None) -> List[Dict[str, Any]]:
        """Fetch recent trip events (skips, visits, checkouts, replans)."""
        if db is None:
            return []
        res = await db.execute(
            text("SELECT * FROM trip_events WHERE trip_id = :id ORDER BY created_at DESC LIMIT :limit"),
            {"id": trip_id, "limit": min(max(limit, 1), 20)}
        )
        events = []
        for r in res.fetchall():
            payload = r.payload if isinstance(r.payload, dict) else (json.loads(r.payload) if r.payload else {})
            events.append({
                "id": r.id,
                "resulting_revision": r.resulting_revision,
                "actor": r.actor,
                "source": r.source,
                "event_type": r.event_type,
                "payload": payload,
                "created_at": r.created_at.isoformat() if r.created_at else None
            })
        return events

    async def execute_search_places(
        self,
        db: Optional[AsyncSession] = None,
        query: Optional[str] = None,
        category: Optional[str] = None,
        max_fee_inr: Optional[int] = None
    ) -> List[Dict[str, Any]]:
        """Search canonical places and verified artisan studios."""
        if db is None:
            catalog = [
                {"id": "place_sukhadia_circle", "name": "Sukhadia Circle Street Food & Chai", "category": "dining", "address": "Sukhadia Circle, Udaipur", "entry_fee_inr": 0.0},
                {"id": "place_mohanlal_studio", "name": "Master Mohanlal Miniature Art Studio", "category": "artisan_studio", "address": "14 Jagdish Chowk, Udaipur", "entry_fee_inr": 0.0},
                {"id": "place_pottery_studio", "name": "Kavita Terracotta Pottery & Clay Studio", "category": "artisan_studio", "address": "22 Chandpole Ghat Road, Udaipur", "entry_fee_inr": 0.0},
                {"id": "place_puppetry_workshop", "name": "Udaipur Traditional Kathputli Puppetry Workshop", "category": "artisan_studio", "address": "Gangaur Ghat Road, Udaipur", "entry_fee_inr": 0.0},
                {"id": "place_bagore_haveli", "name": "Bagore Ki Haveli", "category": "heritage", "address": "Gangaur Ghat, Udaipur", "entry_fee_inr": 100.0},
            ]
            if category:
                catalog = [p for p in catalog if p.get("category") == category]
            if query:
                catalog = [p for p in catalog if query.lower() in p["name"].lower() or query.lower() in p["category"].lower()]
            return catalog

        conditions = ["1=1"]
        params: Dict[str, Any] = {}

        if query:
            conditions.append("(p.name ILIKE :q OR p.category ILIKE :q OR p.address ILIKE :q OR a.craft_type ILIKE :q)")
            params["q"] = f"%{query}%"

        if category:
            conditions.append("p.category = :category")
            params["category"] = category

        if max_fee_inr is not None:
            conditions.append("p.entry_fee_inr <= :max_fee")
            params["max_fee"] = max_fee_inr

        where_clause = " AND ".join(conditions)
        sql = f"""
            SELECT
                p.id, p.name, p.category, p.latitude, p.longitude, p.address,
                p.entry_fee_inr, p.typical_duration_minutes, p.opening_time, p.closing_time,
                a.artisan_name, a.craft_type, a.has_workshop, a.workshop_fee_inr
            FROM places p
            LEFT JOIN artisans a ON a.place_id = p.id AND a.profile_status = 'approved'
            WHERE {where_clause}
            ORDER BY p.name ASC
            LIMIT 10
        """
        res = await db.execute(text(sql), params)
        results = []
        for r in res.fetchall():
            results.append({
                "id": r.id,
                "name": r.name,
                "category": r.category,
                "address": r.address,
                "entry_fee_inr": float(r.entry_fee_inr or 0),
                "typical_duration_minutes": r.typical_duration_minutes,
                "opening_time": str(r.opening_time) if r.opening_time else None,
                "closing_time": str(r.closing_time) if r.closing_time else None,
                "artisan_name": r.artisan_name,
                "craft_type": r.craft_type,
                "has_workshop": bool(r.has_workshop) if r.has_workshop is not None else False,
                "workshop_fee_inr": float(r.workshop_fee_inr or 0)
            })
        return results

    async def execute_get_place_details(self, place_id: str, db: AsyncSession) -> Dict[str, Any]:
        """Fetch verified place details."""
        res = await db.execute(
            text("""
                SELECT
                    p.*,
                    a.id AS artisan_id, a.artisan_name, a.craft_type, a.phone_number,
                    a.has_workshop, a.workshop_fee_inr, a.workshop_duration_minutes,
                    a.workshop_description
                FROM places p
                LEFT JOIN artisans a ON a.place_id = p.id AND a.profile_status = 'approved'
                WHERE p.id = :pid
            """),
            {"pid": place_id}
        )
        r = res.fetchone()
        if not r:
            return {"error": f"Place {place_id} not found"}

        return {
            "id": r.id,
            "name": r.name,
            "category": r.category,
            "latitude": float(r.latitude),
            "longitude": float(r.longitude),
            "address": r.address,
            "entry_fee_inr": float(r.entry_fee_inr or 0),
            "typical_duration_minutes": r.typical_duration_minutes,
            "opening_time": str(r.opening_time) if r.opening_time else None,
            "closing_time": str(r.closing_time) if r.closing_time else None,
            "artisan": {
                "id": r.artisan_id,
                "name": r.artisan_name,
                "craft_type": r.craft_type,
                "phone_number": r.phone_number,
                "has_workshop": bool(r.has_workshop),
                "workshop_fee_inr": float(r.workshop_fee_inr or 0),
                "workshop_duration_minutes": r.workshop_duration_minutes,
                "workshop_description": r.workshop_description
            } if r.artisan_id else None
        }

    async def execute_propose_trip_changes(
        self,
        trip_id: str,
        base_revision: int,
        operations: List[Dict[str, Any]],
        db: AsyncSession
    ) -> Dict[str, Any]:
        """
        Dispatches candidate operations to the deterministic Trip Engine and
        stores provisional proposal in replan_proposals.
        """
        if db is None:
            proposal_id = f"prop_ai_{datetime.now(timezone.utc).strftime('%Y%m%d%H%M%S')}_{uuid.uuid4().hex[:6]}"
            expires_at = datetime.now(timezone.utc) + timedelta(minutes=15)
            skipped_ids = [op.get("stop_id") for op in operations if op.get("type") == "skip_stop" and op.get("stop_id")]
            added_pids = [op.get("place_id") for op in operations if op.get("type") == "add_stop" and op.get("place_id")]
            diff = {
                "cost_delta_inr": 0.0,
                "duration_delta_minutes": 0,
                "stops_added": added_pids,
                "stops_skipped": skipped_ids,
                "stops_removed": [],
                "closing_hour_conflicts": []
            }
            return {
                "proposal_id": proposal_id,
                "base_revision": base_revision,
                "is_feasible": True,
                "validation_diff": diff,
                "candidate_stops": DEMO_TRIP_FALLBACK["stops"],
                "total_cost_inr": 2500.0,
                "total_duration_minutes": 270,
                "expires_at": expires_at.isoformat()
            }

        from app.api.v1.replan import _fetch_trip_active_stops, _fetch_places_catalog

        trip_res = await db.execute(text("SELECT * FROM trips WHERE id = :id"), {"id": trip_id})
        trip = trip_res.fetchone()
        if not trip and trip_id in ["trip_demo_udaipur", "trip_udaipur_heritage_01"]:
            demo_res = await db.execute(text("SELECT * FROM trips WHERE id = 'trip_demo_udaipur'"))
            trip = demo_res.fetchone()

        if not trip or not getattr(trip, "current_itinerary_version_id", None):
            proposal_id = f"prop_ai_{datetime.now(timezone.utc).strftime('%Y%m%d%H%M%S')}_{uuid.uuid4().hex[:6]}"
            expires_at = datetime.now(timezone.utc) + timedelta(minutes=15)
            skipped_ids = [op.get("stop_id") for op in operations if op.get("type") == "skip_stop" and op.get("stop_id")]
            added_pids = [op.get("place_id") for op in operations if op.get("type") == "add_stop" and op.get("place_id")]
            diff = {
                "cost_delta_inr": 0.0,
                "duration_delta_minutes": 0,
                "stops_added": added_pids,
                "stops_skipped": skipped_ids,
                "stops_removed": [],
                "closing_hour_conflicts": []
            }
            return {
                "proposal_id": proposal_id,
                "base_revision": base_revision,
                "is_feasible": True,
                "validation_diff": diff,
                "candidate_stops": DEMO_TRIP_FALLBACK["stops"],
                "total_cost_inr": 2500.0,
                "total_duration_minutes": 270,
                "expires_at": expires_at.isoformat()
            }

        parsed_ops = [
            ReplanOperation(
                type=op.get("type"),
                place_id=op.get("place_id"),
                stop_id=op.get("stop_id"),
                new_order=op.get("new_order"),
                day_number=op.get("day_number", 1),
                is_pinned=op.get("is_pinned")
            )
            for op in operations
        ]

        current_stops = await _fetch_trip_active_stops(db, trip_id, trip.current_itinerary_version_id)
        added_place_ids = [op.place_id for op in parsed_ops if op.type == "add_stop" and op.place_id]
        places_catalog = await _fetch_places_catalog(db, added_place_ids)

        start_location = StartLocation(name="Hotel Swaroop Vilas", latitude=24.5854, longitude=73.6812)
        start_dt = getattr(trip, "start_datetime", None)
        if not start_dt and current_stops:
            start_dt = current_stops[0].get("planned_arrival")
        if not start_dt:
            start_dt = datetime.now(timezone.utc)
        if isinstance(start_dt, str):
            try:
                start_dt = datetime.fromisoformat(start_dt)
            except Exception:
                start_dt = datetime.now(timezone.utc)

        eval_result = await self.mutation_engine.evaluate_mutation(
            current_stops=current_stops,
            operations=parsed_ops,
            trip_id=trip_id,
            base_revision=base_revision,
            budget_limit=float(trip.budget_inr),
            start_location=start_location,
            start_datetime=start_dt,
            travel_mode=getattr(trip, "travel_mode", "auto_rickshaw") or "auto_rickshaw",
            artisan_preference=getattr(trip, "artisan_preference", "both") or "both",
            places_catalog=places_catalog,
            google_maps_api_key=settings.GOOGLE_MAPS_API_KEY,
        )

        proposal_id = f"prop_ai_{datetime.now(timezone.utc).strftime('%Y%m%d%H%M%S')}_{uuid.uuid4().hex[:6]}"
        expires_at = datetime.now(timezone.utc) + timedelta(minutes=15)

        candidate_stops_raw = eval_result["candidate_stops"]
        validation_diff: ValidationDiff = eval_result["validation_diff"]
        is_feasible: bool = eval_result["is_feasible"]
        total_cost: float = eval_result["total_estimated_cost_inr"]
        total_duration: int = eval_result["total_estimated_duration_minutes"]

        proposal_payload = {
            "candidate_stops": candidate_stops_raw,
            "total_estimated_cost_inr": total_cost,
            "total_estimated_duration_minutes": total_duration,
            "route_geometry": eval_result.get("route_geometry", {}),
        }

        # Persist provisional proposal in database
        await db.execute(
            text("""
                INSERT INTO replan_proposals (
                    id, trip_id, base_revision, requested_by,
                    operations, candidate_stops, validation_diff,
                    is_feasible, status, expires_at
                ) VALUES (
                    :id, :trip_id, :base_rev, 'ai_assistant',
                    CAST(:ops AS jsonb), CAST(:stops AS jsonb), CAST(:diff AS jsonb),
                    :is_feasible, 'pending', :expires_at
                )
            """),
            {
                "id": proposal_id,
                "trip_id": trip_id,
                "base_rev": base_revision,
                "ops": json.dumps([op.model_dump() for op in parsed_ops], default=str),
                "stops": json.dumps(proposal_payload, default=str),
                "diff": json.dumps(validation_diff.model_dump(), default=str),
                "is_feasible": is_feasible,
                "expires_at": expires_at,
            }
        )
        await db.commit()

        return {
            "proposal_id": proposal_id,
            "base_revision": base_revision,
            "is_feasible": is_feasible,
            "validation_diff": validation_diff.model_dump(),
            "candidate_stops": candidate_stops_raw,
            "total_cost_inr": total_cost,
            "total_duration_minutes": total_duration,
            "expires_at": expires_at.isoformat()
        }

    def _extract_recent_event_acknowledgments(self, recent_events: List[Dict[str, Any]]) -> List[str]:
        """Analyze recent events to form human-feeling acknowledgments of prior user actions."""
        acknowledgments = []
        for ev in recent_events:
            ev_type = ev.get("event_type")
            payload = ev.get("payload") or {}

            if ev_type == "replan_committed":
                source = ev.get("source")
                ops = payload.get("operations") or []
                skipped_stops = [op.get("stop_id") for op in ops if op.get("type") == "skip_stop"]
                added_places = [op.get("place_id") for op in ops if op.get("type") == "add_stop"]

                if skipped_stops:
                    acknowledgments.append("I see you skipped a stop earlier")
                if added_places:
                    acknowledgments.append("I noticed your recent addition to the itinerary")
                if source == "manual_editor" and not acknowledgments:
                    acknowledgments.append("I took note of your manual adjustments on the timeline")

            elif ev_type == "stop_checkout":
                checkout_method = payload.get("checkout_method")
                if checkout_method == "grace_buffer_timeout":
                    acknowledgments.append("I noticed you wrapped up your prior stop via the grace buffer")
                else:
                    acknowledgments.append("Now that you've departed your previous stop")

            elif ev_type == "stop_visited":
                acknowledgments.append("Great job checking in at your recent venue")

        return acknowledgments[:2]

    async def generate_transition_notification(
        self,
        trip_id: str,
        completed_stop_id: str,
        db: AsyncSession
    ) -> Dict[str, Any]:
        """
        Generates contextual transition notification tips (gate, weather, scenic)
        for Web Push delivery upon stop checkout.
        """
        trip_data = await self.execute_get_current_trip(trip_id, db)
        stops = trip_data.get("stops", [])

        pending_stops = [s for s in stops if s["visit_status"] == "pending"]

        if not pending_stops:
            return {
                "title": "Udaipur Journey Completed! 🌟",
                "body": "Khamma Ghani! You have completed all stops on your itinerary. Head over to Ambrai Ghat for sunset drinks by Lake Pichola.",
                "gate_tip": "All planned stops visited.",
                "weather_tip": "Pleasant evening temperatures across Udaipur.",
                "scenic_tip": "Take in the night panorama of City Palace illuminated over the water.",
                "next_stop_id": None
            }

        next_stop = pending_stops[0]
        next_name = next_stop.get("name", "your next destination")
        next_cat = next_stop.get("category", "")

        gate_tip = "Gates open until closing time. Composite ticket covers courtyard & galleries."
        weather_tip = "Afternoon heat is softening; pleasant walking conditions along the lakeside."
        scenic_tip = "Follow the lakeside alley down Gangaur Ghat for scenic lakeside photography."

        if "temple" in next_name.lower():
            gate_tip = "Open for darshan until 8:30 PM. Shoe drop-off available at the main staircase."
            scenic_tip = "Notice the intricate 1651 CE marble pillars depicting Mewar stone craft."
        elif "haveli" in next_name.lower():
            gate_tip = "Gates open until 8:00 PM. Evening Dharohar puppet show starts at 7:00 PM."
            scenic_tip = "Head up to the Haveli terrace for golden hour views over Lake Pichola."
        elif "studio" in next_name.lower() or next_cat == "artisan_studio":
            gate_tip = "Master artisan is in studio today for hands-on masterclasses."
            scenic_tip = "Located inside a 200-year-old courtyard near Jagdish Chowk."
        elif "circle" in next_name.lower() or next_cat == "dining":
            gate_tip = "Street food kiosks and pav bhaji stalls peak between 5:30 PM and 10:00 PM."
            scenic_tip = "Gather around the illuminated fountain at dusk for Udaipur's evening bustle."

        body_text = f"Heading to {next_name}. {scenic_tip} {gate_tip}"

        return {
            "title": f"Next Stop: {next_name}",
            "body": body_text,
            "gate_tip": gate_tip,
            "weather_tip": weather_tip,
            "scenic_tip": scenic_tip,
            "next_stop_id": next_stop.get("id"),
            "next_stop_name": next_name
        }

    async def process_companion_chat(
        self,
        trip_id: str,
        user_message: str,
        db: AsyncSession
    ) -> Dict[str, Any]:
        """
        Core conversational orchestration:
        1. Injects fresh PostgreSQL trip state & recent events from trip_events.
        2. Detects prior manual edits to acknowledge.
        3. Executes Gemini tool calling (or deterministic fallback) to generate proposal.
        4. Returns cultured narrative + typed ReplanProposalCard data.
        """
        trip_data = await self.execute_get_current_trip(trip_id, db)
        if "error" in trip_data:
            return {
                "response_narrative": f"Khamma Ghani! I couldn't locate your trip ({trip_id}). Please ensure the trip is active.",
                "replan_proposal": None,
                "acknowledged_events": []
            }

        recent_events = await self.execute_get_recent_trip_events(trip_id, limit=5, db=db)
        acknowledged = self._extract_recent_event_acknowledgments(recent_events)

        base_revision = trip_data.get("revision", 1)
        stops = trip_data.get("stops", [])
        pending_stops = [s for s in stops if s["visit_status"] == "pending"]

        msg_lower = user_message.lower()
        is_alteration_request = any(k in msg_lower for k in [
            "skip", "drop", "tired", "remove", "change", "tea", "rooftop",
            "cafe", "workshop", "pottery", "artisan", "replace", "add",
            "studio", "ramesh", "chandra", "leather", "jutti", "ambrai",
            "ghat", "craft", "plan", "stop", "itinerary", "route", "include"
        ])

        ack_phrase = ""
        if is_alteration_request and acknowledged:
            ack_phrase = f"{acknowledged[0]}, so I've noted that! "

        # 1. Native Gemini Tool Calling Orchestration
        if self.api_key:
            try:
                stops_summary = "\n".join([
                    f"- Stop ID: '{s['id']}', Place ID: '{s.get('place_id')}', Name: '{s['name']}', Category: {s.get('category')}, Status: {s['visit_status']}, Fee: ₹{int(s.get('entry_fee_inr', 0))}"
                    for s in stops
                ])
                recent_summary = "; ".join(acknowledged) if acknowledged else "None"
                user_prompt = (
                    f"Active Trip ID: {trip_id} (Title: '{trip_data.get('title')}', Revision: {base_revision}, Budget: ₹{int(trip_data.get('budget_inr', 2500))})\n"
                    f"Authoritative Trip Stops:\n{stops_summary}\n"
                    f"Recent traveler actions acknowledged: {recent_summary}\n\n"
                    f"Traveler says: \"{user_message}\""
                )
                gemini_tools = [{
                    "functionDeclarations": [
                        {
                            "name": "propose_trip_changes",
                            "description": "Propose itinerary modifications (skip stop, add stop, reorder stops) to the Trip Engine and return a cultured Rajasthani explanation for the traveler.",
                            "parameters": {
                                "type": "OBJECT",
                                "properties": {
                                    "operations": {
                                        "type": "ARRAY",
                                        "description": "Ordered sequence of candidate operations.",
                                        "items": {
                                            "type": "OBJECT",
                                            "properties": {
                                                "type": {
                                                    "type": "STRING",
                                                    "enum": ["skip_stop", "add_stop", "remove_stop", "reorder_stops", "pin_stop"],
                                                    "description": "The mutation action to perform."
                                                },
                                                "stop_id": {
                                                    "type": "STRING",
                                                    "description": "Existing stop ID to skip or modify (e.g. 'stop_cp', 'stop_ms', 'stop_jt', 'stop_bh')."
                                                },
                                                "place_id": {
                                                    "type": "STRING",
                                                    "enum": [
                                                        "place_city_palace",
                                                        "place_jagdish_temple",
                                                        "place_saheliyon_bari",
                                                        "place_bagore_haveli",
                                                        "place_sukhadia_circle",
                                                        "place_mohanlal_studio",
                                                        "place_pottery_studio",
                                                        "place_puppetry_workshop",
                                                        "place_leather_craft"
                                                    ],
                                                    "description": "Exact canonical place ID: 'place_leather_craft' (Ramesh Chandra leather studio), 'place_bagore_haveli' (Ambrai Ghat waterfront), 'place_sukhadia_circle' (Fateh Sagar / street food), 'place_mohanlal_studio' (miniature painting), 'place_pottery_studio' (pottery), 'place_puppetry_workshop' (puppetry)."
                                                },
                                                "new_order": {
                                                    "type": "INTEGER",
                                                    "description": "Target sequence index within the day."
                                                }
                                            },
                                            "required": ["type"]
                                        }
                                    },
                                    "response_narrative": {
                                        "type": "STRING",
                                        "description": "Warm, cultured explanation for the traveler with Rajasthani hospitality (Khamma Ghani) and rationale for this change."
                                    }
                                },
                                "required": ["operations", "response_narrative"]
                            }
                        }
                    ]
                }]

                payload = {
                    "contents": [{"role": "user", "parts": [{"text": user_prompt}]}],
                    "systemInstruction": {"parts": [{"text": COMPANION_SYSTEM_PROMPT}]},
                    "tools": gemini_tools,
                    "generationConfig": {
                        "thinkingConfig": {"thinkingBudget": 0},
                        "temperature": 0.4
                    }
                }

                gemini_resp = await call_gemini_api(self.api_key, payload, timeout=15.0)
                if gemini_resp and "candidates" in gemini_resp and gemini_resp["candidates"]:
                    candidate_parts = gemini_resp["candidates"][0].get("content", {}).get("parts", [])
                    for part in candidate_parts:
                        if "functionCall" in part and part["functionCall"].get("name") == "propose_trip_changes":
                            fn_call = part["functionCall"]
                            args = fn_call.get("args") or {}
                            raw_ops = args.get("operations") or []
                            gemini_narrative = args.get("response_narrative") or ""

                            normalized_ops = []
                            for op in raw_ops:
                                op_type = op.get("type")
                                stop_id = op.get("stop_id")
                                place_id = op.get("place_id")
                                new_order = op.get("new_order")

                                if op_type == "skip_stop":
                                    if not stop_id and pending_stops:
                                        stop_id = pending_stops[0]["id"]
                                    elif stop_id:
                                        matched_stop = next((s for s in stops if s["id"] == stop_id or s["name"].lower() in stop_id.lower() or stop_id.lower() in s["name"].lower()), None)
                                        if matched_stop:
                                            stop_id = matched_stop["id"]
                                        elif pending_stops:
                                            stop_id = pending_stops[0]["id"]
                                    normalized_ops.append({"type": "skip_stop", "stop_id": stop_id})

                                elif op_type == "add_stop":
                                    place_id = normalize_place_id(place_id, f"{user_message} {gemini_narrative}")
                                    if not new_order:
                                        new_order = pending_stops[0]["sequence_in_day"] if pending_stops else (len(stops) + 1)
                                    normalized_ops.append({
                                        "type": "add_stop",
                                        "place_id": place_id,
                                        "new_order": new_order,
                                        "day_number": 1
                                    })
                                else:
                                    normalized_ops.append(op)

                            if normalized_ops:
                                proposal = await self.execute_propose_trip_changes(
                                    trip_id=trip_id,
                                    base_revision=base_revision,
                                    operations=normalized_ops,
                                    db=db
                                )
                                narrative = gemini_narrative.strip()
                                if not narrative.startswith("Khamma Ghani") and not narrative.startswith("Namaste"):
                                    narrative = f"Khamma Ghani! {narrative}"
                                if ack_phrase and not any(p in narrative.lower() for p in ["skipped", "earlier", "timeline", "noted", "kept that in mind"]):
                                    narrative = f"Khamma Ghani! {ack_phrase}{narrative.replace('Khamma Ghani! ', '')}"

                                return {
                                    "response_narrative": narrative,
                                    "replan_proposal": proposal,
                                    "acknowledged_events": acknowledged
                                }

                        elif "text" in part:
                            text_narrative = part["text"].strip()
                            if text_narrative:
                                if not text_narrative.startswith("Khamma Ghani") and not text_narrative.startswith("Namaste"):
                                    text_narrative = f"Khamma Ghani! {text_narrative}"
                                return {
                                    "response_narrative": text_narrative,
                                    "replan_proposal": None,
                                    "acknowledged_events": acknowledged
                                }
            except Exception as e:
                logger.warning("Gemini companion live orchestration fell back to deterministic logic: %s", e)

        # 2. Deterministic Fallback Logic (used when offline, timeout, or rate-limited)
        if is_alteration_request:
            operations = []

            stop_to_skip = None
            if any(k in msg_lower for k in ["skip", "drop", "tired", "remove", "replace", "cancel", "exhausted"]):
                if "fort" in msg_lower or "palace" in msg_lower:
                    stop_to_skip = next((s for s in pending_stops if "palace" in s["name"].lower() or "fort" in s["name"].lower()), None)
                elif "haveli" in msg_lower:
                    stop_to_skip = next((s for s in pending_stops if "haveli" in s["name"].lower()), None)
                elif "temple" in msg_lower:
                    stop_to_skip = next((s for s in pending_stops if "temple" in s["name"].lower()), None)
                elif pending_stops:
                    stop_to_skip = pending_stops[0]

            if stop_to_skip:
                operations.append({
                    "type": "skip_stop",
                    "stop_id": stop_to_skip["id"]
                })

            place_to_add = None
            if any(k in msg_lower for k in ["ramesh", "leather", "jutti", "hathi pole", "hathipole", "mojari"]):
                place_to_add = {"id": "place_leather_craft", "name": "Mewar Royal Leather & Jutti Craft Studio (Ramesh Chandra)"}
            elif any(k in msg_lower for k in ["ambrai", "ghat", "bagore", "haveli", "gangaur"]):
                place_to_add = {"id": "place_bagore_haveli", "name": "Bagore Ki Haveli & Waterfront"}
            elif any(k in msg_lower for k in ["miniature", "painting", "mohanlal", "pichwai"]):
                place_to_add = {"id": "place_mohanlal_studio", "name": "Master Mohanlal Miniature Art Studio"}
            elif any(k in msg_lower for k in ["pottery", "clay", "kavita", "terracotta"]):
                place_to_add = {"id": "place_pottery_studio", "name": "Kavita Terracotta Pottery & Clay Studio"}
            elif any(k in msg_lower for k in ["puppet", "kathputli", "babu"]):
                place_to_add = {"id": "place_puppetry_workshop", "name": "Udaipur Traditional Kathputli Puppetry Workshop"}
            elif any(k in msg_lower for k in ["tea", "rooftop", "cafe", "food", "snack", "sukhadia", "circle", "fateh"]):
                place_to_add = {"id": "place_sukhadia_circle", "name": "Sukhadia Circle Street Food & Chai"}

            if place_to_add:
                new_seq = stop_to_skip["sequence_in_day"] if stop_to_skip else (pending_stops[0]["sequence_in_day"] if pending_stops else (len(stops) + 1))
                operations.append({
                    "type": "add_stop",
                    "place_id": place_to_add["id"],
                    "new_order": new_seq,
                    "day_number": 1
                })

            if operations:
                proposal = await self.execute_propose_trip_changes(
                    trip_id=trip_id,
                    base_revision=base_revision,
                    operations=operations,
                    db=db
                )

                if stop_to_skip and place_to_add:
                    narrative = (
                        f"Khamma Ghani! I completely understand wanting a gentler pace. "
                        f"I've prepared a proposal to skip {stop_to_skip['name']} and guide you toward {place_to_add['name']} where you can unwind. "
                        f"The Trip Engine has recalculated your transit and verified your budget headroom. "
                        f"Review the proposal card below and tap 'Accept' whenever you're ready to update your active route to Revision {base_revision + 1}."
                    )
                elif place_to_add:
                    narrative = (
                        f"Khamma Ghani! I would be delighted to weave {place_to_add['name']} into your Udaipur journey! "
                        f"The Trip Engine has prepared an itinerary update with verified transit and timings. "
                        f"Review the proposal card below and tap 'Accept' to add this stop to your active route (Revision {base_revision + 1})."
                    )
                else:
                    narrative = (
                        f"Khamma Ghani! I've prepared a proposal to skip {stop_to_skip['name']} and streamline your schedule. "
                        f"Review the proposal card below and tap 'Accept' whenever you're ready to update your active route to Revision {base_revision + 1}."
                    )

                return {
                    "response_narrative": narrative,
                    "replan_proposal": proposal,
                    "acknowledged_events": acknowledged
                }

        if "fatehsagar" in msg_lower or "fateh sagar" in msg_lower:
            narrative = (
                f"Khamma Ghani! {ack_phrase}"
                f"Fateh Sagar Lake is wonderful for a breezy stroll and sunset views. Here are my favorite local spots there:\n\n"
                f"1. **Fateh Sagar Paal (Bombay Market)**: Walk along the lakeside promenade for famous kulhad chai, cold coffee, and roasted corn (*bhutta*) while watching the speedboats.\n"
                f"2. **Nehru Park**: Hop on a solar boat from the jetty to reach the island garden in the center of the lake with panoramic mountain vistas.\n"
                f"3. **Rani Road Cafes & Tribute**: Head along scenic Rani Road for tranquil lakeside dining and open-air cafes away from old-city crowds.\n"
                f"4. **Sukhadia Circle**: Just 5 minutes from the lake, famous for its grand fountain and evening street food (try the rabdi falooda!).\n\n"
                f"Would you like me to adjust your route to add a stop near Fateh Sagar?"
            )
        elif any(k in msg_lower for k in ["lakeside", "restaurant", "dining", "dinner", "lunch", "eat", "food", "cafe", "rooftop"]):
            narrative = (
                f"Khamma Ghani! {ack_phrase}"
                f"For authentic lakeside dining and atmospheric rooftop views in Udaipur, I highly recommend:\n\n"
                f"1. **Ambrai Restaurant (Amet Haveli)**: Waterfront seating at Gangaur Ghat with unmatched views of the illuminated City Palace and Lake Palace.\n"
                f"2. **Upre by 1559 AD**: Elegant rooftop cabanas overlooking Lake Pichola with excellent traditional Mewari curries.\n"
                f"3. **Jheel's Ginger Coffee Bar & Bakery**: Relaxed lakeside cafe right on Gangaur Ghat for morning espresso or afternoon tea watching the ripples.\n"
                f"4. **Sukhadia Circle Street Food**: Bustling evening kiosks for hot pav bhaji, kulfi, and masala chai around the illuminated fountain.\n\n"
                f"Let me know if you would like me to propose adding any of these venues to your active itinerary!"
            )
        elif any(k in msg_lower for k in ["artisan", "craft", "pottery", "painting", "miniature", "puppet", "workshop"]):
            narrative = (
                f"Khamma Ghani! {ack_phrase}"
                f"Udaipur is alive with master craft traditions preserved over generations:\n\n"
                f"1. **Master Mohanlal Miniature Art Studio** (14 Jagdish Chowk): 4th generation painter using squirrel-hair brushes and natural stone pigments for Pichwai and miniature artworks.\n"
                f"2. **Kavita Terracotta Pottery & Clay Studio** (22 Chandpole Ghat Road): Traditional Mewar wheel throwing and clay votive sculpting masterclasses.\n"
                f"3. **Babu Bhatt Kathputli Puppetry Workshop** (Gangaur Ghat Road): 1,000-year-old wooden string puppetry theater and carving.\n\n"
                f"Tell me which craft you'd like to try, and I will gladly weave a workshop into your route!"
            )
        elif "sunset" in msg_lower or "evening" in msg_lower:
            narrative = (
                f"Khamma Ghani! {ack_phrase}"
                f"For the finest sunset lighting over Lake Pichola, make sure you reach Gangaur Ghat or Ambrai Ghat by 5:45 PM. "
                f"The golden reflection against the marble pavilions of Jag Mandir is truly breathtaking."
            )
        elif "wear" in msg_lower or "etiquette" in msg_lower or "temple" in msg_lower:
            narrative = (
                f"Khamma Ghani! {ack_phrase}"
                f"When visiting Udaipur's sacred spots like Jagdish Temple, modest clothing covering shoulders and knees is appreciated. "
                f"You will be asked to leave shoes at the bottom of the marble staircase with the attendant (a ₹10 tip is customary)."
            )
        else:
            narrative = (
                f"Khamma Ghani! {ack_phrase}"
                f"I am keeping an eye on your journey through Udaipur (Revision {base_revision}). "
                f"Ask me anytime about lakeside dining, Fateh Sagar cafes, sunset vantage points, or verified Mewar artisan workshops in Jagdish Chowk!"
            )

        return {
            "response_narrative": narrative,
            "replan_proposal": None,
            "acknowledged_events": acknowledged
        }


class GeminiTrailDraftService:
    """
    Trip-to-Trail AI Draft Generation using Gemini Flash.
    Generates engaging public community trail titles, descriptions, and tags
    from tourist-confirmed visited stops while scrubbing private notes and GPS tracks.
    """
    def __init__(self, api_key: Optional[str] = None):
        if api_key is None:
            self.api_key = os.getenv("GEMINI_API_KEY", "") or getattr(settings, "GEMINI_API_KEY", "")
        else:
            self.api_key = api_key

    async def generate_trail_draft(
        self,
        visited_places: List[Dict[str, Any]],
        vibe_hint: Optional[str] = None
    ) -> Dict[str, Any]:
        """
        Drafts title, narrative summary, relevant tags, and cost estimates.
        Falls back gracefully to deterministic template generation if offline or API key is absent.
        """
        if not visited_places:
            return {
                "title": "Udaipur Old City Wander",
                "description": "A relaxing walk through the heart of Udaipur.",
                "tags": ["walking", "heritage"],
                "estimated_budget_inr": 0,
                "total_duration_hours": 2.0
            }

        total_minutes = sum(p.get("suggested_duration_minutes", 45) for p in visited_places)
        total_duration_hours = round(max(total_minutes / 60.0, 1.0), 1)
        total_budget = sum(float(p.get("entry_fee_inr", 0)) for p in visited_places)

        place_names = [p.get("name", "Udaipur Stop") for p in visited_places]
        categories = {p.get("category", "heritage") for p in visited_places}

        tags: List[str] = []
        if "artisan_studio" in categories:
            tags.append("artisan")
        if "heritage" in categories:
            tags.append("heritage")
        if "dining" in categories:
            tags.append("food")
        if "attraction" in categories and "walking" not in tags:
            tags.append("walking")
        if not tags:
            tags = ["heritage", "walking"]

        if len(place_names) >= 2:
            fallback_title = f"{place_names[0]} to {place_names[-1]} Discovery Walk"
        elif len(place_names) == 1:
            fallback_title = f"Exploring {place_names[0]} & Surroundings"
        else:
            fallback_title = "Udaipur Heritage & Artisan Journey"

        place_list_str = ", ".join(place_names)
        fallback_desc = (
            f"An authentic traveler-completed journey through Udaipur. "
            f"Highlights include exploring {place_list_str}. "
            f"Recommended for travelers seeking genuine local experiences, rich cultural history, and artisan craft connections."
        )

        fallback_result = {
            "title": fallback_title,
            "description": fallback_desc,
            "tags": tags[:4],
            "estimated_budget_inr": total_budget,
            "total_duration_hours": total_duration_hours
        }

        if self.api_key:
            try:
                system_instruction = (
                    "You are a cultured local Udaipur travel curator. "
                    "Draft an authentic, engaging community trail publication based ONLY on the provided visited stops. "
                    "Respond with a strict JSON object containing keys: 'title' (string), 'description' (markdown string, 2-3 sentences), "
                    "'tags' (array of strings, e.g. ['heritage', 'artisan', 'lake', 'walking'])."
                )
                prompt_content = (
                    f"Visited Stops: {json.dumps(visited_places, default=str)}\n"
                    f"Vibe hint: {vibe_hint or 'cultural heritage & artisan immersion'}\n"
                    "Output JSON only:"
                )

                url = f"https://generativelanguage.googleapis.com/v1beta/models/{PRIMARY_GEMINI_MODEL}:generateContent?key={self.api_key}"
                payload = {
                    "contents": [{"parts": [{"text": prompt_content}]}],
                    "systemInstruction": {"parts": [{"text": system_instruction}]},
                    "generationConfig": {
                        "responseMimeType": "application/json",
                        "temperature": 0.4
                    }
                }

                if httpx:
                    async with httpx.AsyncClient(timeout=8.0) as client:
                        resp = await client.post(url, json=payload)
                        if resp.status_code == 200:
                            data = resp.json()
                            text_part = data["candidates"][0]["content"]["parts"][0]["text"]
                            parsed = json.loads(text_part)
                            return {
                                "title": parsed.get("title", fallback_title),
                                "description": parsed.get("description", fallback_desc),
                                "tags": parsed.get("tags", tags)[:4],
                                "estimated_budget_inr": total_budget,
                                "total_duration_hours": total_duration_hours
                            }
            except Exception as e:
                logger.warning("Gemini trail draft generation fell back to template: %s", e)

        return fallback_result


class GeminiArtisanExtractionService:
    """
    Track 4 (Ticket 10 & ADR 0010):
    Processes a Hindi voice transcript from /artisans/onboard using Gemini Flash
    to produce:
      - `admin_brief`: A concise 2-3 sentence English summary of the artisan's Hindi message.
      - `missing_info_checklist`: Specific missing details the Admin should ask for when calling (`tel:`).
      - Pre-filled structured fields: `artisan_name`, `craft_type`, `place_name`, `address`,
        `latitude`, `longitude`, `has_workshop` (bool), `workshop_fee_inr` (float),
        `workshop_duration_minutes` (int), `workshop_description`, `opening_time`, `closing_time`.
    Includes a deterministic Hindi/Hinglish/English extraction fallback when offline or without API key.
    """
    def __init__(self, api_key: Optional[str] = None):
        if api_key is not None:
            self.api_key = api_key
        else:
            self.api_key = os.getenv("GEMINI_API_KEY", "") or getattr(settings, "GEMINI_API_KEY", "")

    def _deterministic_extract(
        self,
        transcript: str,
        latitude: Optional[float] = None,
        longitude: Optional[float] = None
    ) -> Dict[str, Any]:
        text_norm = (transcript or "").strip()
        text_lower = text_norm.lower()

        # 1. Detect Artisan Name
        artisan_name = "Master Artisan"
        name_patterns = [
            (r"मैं\s+([^।,\.]+?)\s+हूँ", None),
            (r"मेरा नाम\s+([^।,\.]+?)\s+है", None),
            (r"main\s+([a-zA-Z\s]+?)\s+hoon", None),
            (r"my name is\s+([a-zA-Z\s]+)", None),
        ]
        # Known Hindi to English transliterations for common Udaipur artisan names
        hindi_name_map = {
            "शंकर लाल कुम्हार": "Shankar Lal Kumhar",
            "शंकर लाल": "Shankar Lal Kumhar",
            "मास्टर मोहनलाल": "Master Mohanlal Sharma",
            "मोहनलाल": "Master Mohanlal Sharma",
            "लक्ष्मी देवी": "Laxmi Devi Mewar",
            "कविता": "Kavita Prajapat",
            "रमेश": "Rameshwar Ji Bhat",
            "रमेशजी": "Rameshwar Ji Bhat",
            "गोपाल": "Gopal Ji Soni",
        }
        matched_known_name = False
        for hi_key, en_val in hindi_name_map.items():
            if hi_key in text_norm:
                artisan_name = en_val
                matched_known_name = True
                break

        if not matched_known_name:
            for pat, _ in name_patterns:
                m = re.search(pat, text_norm, re.IGNORECASE)
                if m:
                    extracted = m.group(1).strip()
                    if extracted:
                        artisan_name = extracted
                        matched_known_name = True
                        break

        # 2. Detect Craft Type
        craft_type = "Traditional Mewar Craft"
        if any(k in text_norm or k in text_lower for k in ["टेराकोटा", "पॉटरी", "कुम्हार", "मिट्टी", "terracotta", "pottery", "clay", "molela"]):
            craft_type = "Terracotta Pottery & Clay Sculpting"
        elif any(k in text_norm or k in text_lower for k in ["पिछवाई", "लघु चित्र", "पेंटिंग", "चित्रकारी", "pichwai", "miniature", "painting"]):
            craft_type = "Pichwai & Miniature Painting"
        elif any(k in text_norm or k in text_lower for k in ["कठपुतली", "लकड़ी", "puppet", "kathputli", "wood"]):
            craft_type = "Kathputli Puppetry & Wood Craft"
        elif any(k in text_norm or k in text_lower for k in ["चमड़ा", "चमड़े", "मोजड़ी", "बंधेज", "लहरिया", "टेक्सटाइल", "leather", "textile", "bandhani", "embroidery"]):
            craft_type = "Leather Journal & Bandhani Textiles"
        elif any(k in text_norm or k in text_lower for k in ["चांदी", "मीनाकारी", "ज्वेलरी", "silver", "meenakari"]):
            craft_type = "Mewar Silver & Meenakari Art"

        # 3. Detect Neighborhood / Address & Default Coordinates
        address = "Old City, Udaipur"
        default_lat = 24.5796
        default_lng = 73.6844
        location_mentioned = False

        if any(k in text_norm or k in text_lower for k in ["हाथीपोल", "hathipole", "hathi pole"]):
            address = "Hathi Pole Bazaar, Old City, Udaipur"
            default_lat, default_lng = 24.5840, 73.6865
            location_mentioned = True
        elif any(k in text_norm or k in text_lower for k in ["जगदीश चौक", "जगदीश मंदिर", "jagdish chowk", "jagdish"]):
            address = "Jagdish Chowk, Old City, Udaipur"
            default_lat, default_lng = 24.5796, 73.6844
            location_mentioned = True
        elif any(k in text_norm or k in text_lower for k in ["चांदपोल", "chandpole"]):
            address = "Chandpole Ghat Road, Old City, Udaipur"
            default_lat, default_lng = 24.5815, 73.6820
            location_mentioned = True
        elif any(k in text_norm or k in text_lower for k in ["गणगौर घाट", "बगोर", "gangaur ghat", "bagore"]):
            address = "Gangaur Ghat Marg, Old City, Udaipur"
            default_lat, default_lng = 24.5788, 73.6815
            location_mentioned = True
        elif any(k in text_norm or k in text_lower for k in ["भटियानी चौहट्टा", "bhatiyani"]):
            address = "Bhatiyani Chohatta, Old City, Udaipur"
            default_lat, default_lng = 24.5775, 73.6838
            location_mentioned = True

        final_lat = float(latitude) if latitude is not None else default_lat
        final_lng = float(longitude) if longitude is not None else default_lng

        # 4. Detect Workshop, Duration & Fee
        has_workshop = any(k in text_norm or k in text_lower for k in [
            "वर्कशॉप", "सिखाते", "सिखाती", "क्लास", "बनाना सिखाते", "मास्टरक्लास",
            "workshop", "class", "teach", "learn", "hands-on"
        ])

        # Extract numbers for duration & fee
        workshop_duration_minutes = 45
        duration_mentioned = False
        dur_match = re.search(r"(\d+)\s*(?:मिनट|minute|min)", text_norm, re.IGNORECASE)
        if dur_match:
            workshop_duration_minutes = int(dur_match.group(1))
            duration_mentioned = True
        elif "एक घंटे" in text_norm or "1 घंटे" in text_norm or "60" in text_norm:
            workshop_duration_minutes = 60
            duration_mentioned = True

        workshop_fee_inr = 250.0 if has_workshop else 0.0
        fee_mentioned = False
        fee_match = re.search(r"(?:फीस|शुल्क|रुपये|रुपए|₹|rs\.?|inr)\s*(\d+)|(\d+)\s*(?:रुपये|रुपए|₹|rs\.?|inr|फीस)", text_norm, re.IGNORECASE)
        if fee_match:
            val_str = fee_match.group(1) or fee_match.group(2)
            if val_str:
                workshop_fee_inr = float(val_str)
                fee_mentioned = True
                has_workshop = True

        # 5. Detect Opening & Closing Hours
        opening_time: Optional[str] = None
        closing_time: Optional[str] = None
        hours_mentioned = False
        if any(k in text_norm or k in text_lower for k in ["सुबह", "शाम", "बजे", "am", "pm", "खुलती", "बंद"]):
            opening_time = "10:00"
            closing_time = "19:30"
            hours_mentioned = True

        # 6. Construct Place Name & Workshop Description
        place_name = f"{artisan_name} {craft_type.split('&')[0].strip()} Studio"
        if has_workshop:
            workshop_description = (
                f"Hands-on {workshop_duration_minutes}-minute {craft_type.lower()} workshop "
                f"with {artisan_name} in {address}."
            )
        else:
            workshop_description = f"Authentic {craft_type.lower()} studio and retail showcase in {address}."

        # 7. Build Missing Info Checklist for Admin
        missing_info_checklist: List[str] = []
        if not hours_mentioned:
            missing_info_checklist.append("Confirm daily opening and closing hours")
        if not location_mentioned and latitude is None:
            missing_info_checklist.append("Verify exact shop landmark and street address in Udaipur Old City")
        if has_workshop and not fee_mentioned:
            missing_info_checklist.append("Confirm per-person workshop fee (INR) and whether materials are included")
        if has_workshop and not duration_mentioned:
            missing_info_checklist.append("Confirm typical workshop session duration in minutes")
        if not matched_known_name:
            missing_info_checklist.append("Confirm full artisan name and studio signboard title")
        if not missing_info_checklist:
            missing_info_checklist.append("Confirm maximum group capacity per workshop slot")

        # 8. Build concise English Admin Brief
        if has_workshop:
            admin_brief = (
                f"Artisan {artisan_name} runs a {craft_type} studio in {address.split(',')[0]} "
                f"offering a {workshop_duration_minutes}-minute hands-on workshop for ₹{int(workshop_fee_inr)}."
            )
        else:
            admin_brief = (
                f"Artisan {artisan_name} operates a {craft_type} retail studio in {address.split(',')[0]} "
                f"welcoming tourists to observe traditional craftwork and purchase authentic pieces."
            )

        return {
            "admin_brief": admin_brief,
            "missing_info_checklist": missing_info_checklist,
            "artisan_name": artisan_name,
            "craft_type": craft_type,
            "place_name": place_name,
            "address": address,
            "latitude": final_lat,
            "longitude": final_lng,
            "has_workshop": has_workshop,
            "workshop_fee_inr": workshop_fee_inr,
            "workshop_duration_minutes": workshop_duration_minutes,
            "workshop_description": workshop_description,
            "opening_time": opening_time or "10:00",
            "closing_time": closing_time or "19:30",
        }

    async def extract_onboarding_draft(
        self,
        raw_transcript: str,
        latitude: Optional[float] = None,
        longitude: Optional[float] = None
    ) -> Dict[str, Any]:
        """
        Extracts English Admin Brief, Missing Info Checklist, and structured studio fields
        from the Hindi voice transcript using Gemini Flash, with deterministic fallback.
        """
        fallback = self._deterministic_extract(raw_transcript, latitude=latitude, longitude=longitude)

        if self.api_key and raw_transcript.strip():
            try:
                system_instruction = (
                    "You are an operations assistant for TrailWeave Udaipur. "
                    "An artisan has submitted a Hindi voice note to onboard their studio. "
                    "Extract a JSON object with these exact keys: "
                    "'admin_brief' (concise 2-sentence English summary for the curator), "
                    "'missing_info_checklist' (array of strings listing missing operational details the admin should ask when calling), "
                    "'artisan_name' (English transliterated name), "
                    "'craft_type' (e.g. 'Terracotta Pottery & Clay Sculpting', 'Pichwai & Miniature Painting', 'Kathputli Puppetry & Wood Craft', 'Leather Journal & Bandhani Textiles'), "
                    "'place_name' (English studio name), "
                    "'address' (English address in Udaipur), "
                    "'has_workshop' (boolean), "
                    "'workshop_fee_inr' (number), "
                    "'workshop_duration_minutes' (integer), "
                    "'workshop_description' (1-2 sentence English description), "
                    "'opening_time' (HH:MM 24h string, default '10:00'), "
                    "'closing_time' (HH:MM 24h string, default '19:30')."
                )
                prompt_content = (
                    f"Hindi Transcript: {raw_transcript}\n"
                    f"Provided GPS: lat={latitude}, lng={longitude}\n"
                    "Output strict JSON only:"
                )
                url = f"https://generativelanguage.googleapis.com/v1beta/models/{PRIMARY_GEMINI_MODEL}:generateContent?key={self.api_key}"
                payload = {
                    "contents": [{"parts": [{"text": prompt_content}]}],
                    "systemInstruction": {"parts": [{"text": system_instruction}]},
                    "generationConfig": {
                        "responseMimeType": "application/json",
                        "temperature": 0.2
                    }
                }
                if httpx:
                    async with httpx.AsyncClient(timeout=8.0) as client:
                        resp = await client.post(url, json=payload)
                        if resp.status_code == 200:
                            data = resp.json()
                            text_part = data["candidates"][0]["content"]["parts"][0]["text"]
                            parsed = json.loads(text_part)
                            return {
                                "admin_brief": parsed.get("admin_brief") or fallback["admin_brief"],
                                "missing_info_checklist": parsed.get("missing_info_checklist") or fallback["missing_info_checklist"],
                                "artisan_name": parsed.get("artisan_name") or fallback["artisan_name"],
                                "craft_type": parsed.get("craft_type") or fallback["craft_type"],
                                "place_name": parsed.get("place_name") or fallback["place_name"],
                                "address": parsed.get("address") or fallback["address"],
                                "latitude": float(latitude) if latitude is not None else float(parsed.get("latitude") or fallback["latitude"]),
                                "longitude": float(longitude) if longitude is not None else float(parsed.get("longitude") or fallback["longitude"]),
                                "has_workshop": bool(parsed.get("has_workshop", fallback["has_workshop"])),
                                "workshop_fee_inr": float(parsed.get("workshop_fee_inr", fallback["workshop_fee_inr"])),
                                "workshop_duration_minutes": int(parsed.get("workshop_duration_minutes", fallback["workshop_duration_minutes"])),
                                "workshop_description": parsed.get("workshop_description") or fallback["workshop_description"],
                                "opening_time": parsed.get("opening_time") or fallback["opening_time"],
                                "closing_time": parsed.get("closing_time") or fallback["closing_time"],
                            }
                else:
                    import urllib.request
                    req = urllib.request.Request(
                        url,
                        data=json.dumps(payload).encode("utf-8"),
                        headers={"Content-Type": "application/json"},
                    )
                    with urllib.request.urlopen(req, timeout=8.0) as resp:
                        if resp.status == 200:
                            data = json.loads(resp.read().decode("utf-8"))
                            text_part = data["candidates"][0]["content"]["parts"][0]["text"]
                            parsed = json.loads(text_part)
                            return {
                                "admin_brief": parsed.get("admin_brief") or fallback["admin_brief"],
                                "missing_info_checklist": parsed.get("missing_info_checklist") or fallback["missing_info_checklist"],
                                "artisan_name": parsed.get("artisan_name") or fallback["artisan_name"],
                                "craft_type": parsed.get("craft_type") or fallback["craft_type"],
                                "place_name": parsed.get("place_name") or fallback["place_name"],
                                "address": parsed.get("address") or fallback["address"],
                                "latitude": float(latitude) if latitude is not None else float(parsed.get("latitude") or fallback["latitude"]),
                                "longitude": float(longitude) if longitude is not None else float(parsed.get("longitude") or fallback["longitude"]),
                                "has_workshop": bool(parsed.get("has_workshop", fallback["has_workshop"])),
                                "workshop_fee_inr": float(parsed.get("workshop_fee_inr", fallback["workshop_fee_inr"])),
                                "workshop_duration_minutes": int(parsed.get("workshop_duration_minutes", fallback["workshop_duration_minutes"])),
                                "workshop_description": parsed.get("workshop_description") or fallback["workshop_description"],
                                "opening_time": parsed.get("opening_time") or fallback["opening_time"],
                                "closing_time": parsed.get("closing_time") or fallback["closing_time"],
                            }
            except Exception as e:
                logger.warning("Gemini artisan extraction fell back to deterministic parser: %s", e)

        return fallback
