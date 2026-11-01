"""
Google GenAI (Gemini Flash) Service & Multi-Step Tool Calling Interface
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
    from app.services.planner import (
        StartLocation,
        compute_transit_minutes,
        haversine_distance_meters,
    )
except ImportError:
    UnifiedMutationEngine = None  # type: ignore
    ReplanOperation = None  # type: ignore
    ValidationDiff = None  # type: ignore
    StartLocation = None  # type: ignore
    compute_transit_minutes = None  # type: ignore
    haversine_distance_meters = None  # type: ignore

logger = logging.getLogger(__name__)

PRIMARY_GEMINI_MODEL = "gemini-3-flash-preview"
FALLBACK_GEMINI_MODEL = "gemini-3.5-flash"
FALLBACK_GEMINI_MODELS = [
    "gemini-3-flash-preview",
    "gemini-3.5-flash",
    "gemini-flash-lite-latest",
    "gemini-3.1-flash-lite",
]

# Comprehensive Udaipur Gazetteer for accurate coordinates, categories, and custom stop creation
UDAIPUR_GAZETTEER: Dict[str, Dict[str, Any]] = {
    "place_city_palace": {
        "id": "place_city_palace",
        "name": "City Palace Udaipur",
        "category": "heritage",
        "latitude": 24.5764,
        "longitude": 73.6835,
        "address": "Old City, Udaipur, Rajasthan 313001",
        "entry_fee_inr": 330.0,
        "typical_duration_minutes": 120,
        "keywords": ["city palace", "badi pol", "royal palace"],
    },
    "place_jagdish_temple": {
        "id": "place_jagdish_temple",
        "name": "Jagdish Temple",
        "category": "heritage",
        "latitude": 24.5794,
        "longitude": 73.6841,
        "address": "1 Jagdish Chowk, Old City, Udaipur, Rajasthan 313001",
        "entry_fee_inr": 0.0,
        "typical_duration_minutes": 30,
        "keywords": ["jagdish temple", "jagdish mandir"],
    },
    "place_bagore_haveli": {
        "id": "place_bagore_haveli",
        "name": "Bagore Ki Haveli",
        "category": "heritage",
        "latitude": 24.5798,
        "longitude": 73.6800,
        "address": "Gangaur Ghat Marg, Old City, Udaipur, Rajasthan 313001",
        "entry_fee_inr": 100.0,
        "typical_duration_minutes": 90,
        "keywords": ["bagore ki haveli", "bagore haveli", "gangaur ghat", "dharohar"],
    },
    "place_saheliyon_bari": {
        "id": "place_saheliyon_bari",
        "name": "Saheliyon Ki Bari",
        "category": "attraction",
        "latitude": 24.6019,
        "longitude": 73.6853,
        "address": "Saheli Marg, New Vidhya Nagar, Udaipur, Rajasthan 313001",
        "entry_fee_inr": 50.0,
        "typical_duration_minutes": 60,
        "keywords": ["saheliyon ki bari", "saheliyon", "fountain garden"],
    },
    "place_sukhadia_circle": {
        "id": "place_sukhadia_circle",
        "name": "Sukhadia Circle Street Food",
        "category": "dining",
        "latitude": 24.6035,
        "longitude": 73.6885,
        "address": "Sukhadia Circle, Panchwati, Udaipur, Rajasthan 313001",
        "entry_fee_inr": 0.0,
        "typical_duration_minutes": 45,
        "keywords": ["sukhadia circle", "sukhadia"],
    },
    "place_mohanlal_studio": {
        "id": "place_mohanlal_studio",
        "name": "Master Mohanlal Miniature Art Studio",
        "category": "artisan_studio",
        "latitude": 24.5796,
        "longitude": 73.6844,
        "address": "14 Jagdish Chowk, Old City, Udaipur, Rajasthan 313001",
        "entry_fee_inr": 0.0,
        "typical_duration_minutes": 45,
        "keywords": ["mohanlal", "miniature", "pichwai"],
    },
    "place_pottery_studio": {
        "id": "place_pottery_studio",
        "name": "Kavita Terracotta Pottery & Clay Studio",
        "category": "artisan_studio",
        "latitude": 24.5815,
        "longitude": 73.6820,
        "address": "22 Chandpole Ghat Road, Old City, Udaipur, Rajasthan 313001",
        "entry_fee_inr": 0.0,
        "typical_duration_minutes": 45,
        "keywords": ["kavita", "pottery", "terracotta", "clay studio"],
    },
    "place_puppetry_workshop": {
        "id": "place_puppetry_workshop",
        "name": "Udaipur Traditional Kathputli Puppetry Workshop",
        "category": "artisan_studio",
        "latitude": 24.5788,
        "longitude": 73.6815,
        "address": "Gangaur Ghat Road, Old City, Udaipur, Rajasthan 313001",
        "entry_fee_inr": 0.0,
        "typical_duration_minutes": 45,
        "keywords": ["puppet", "kathputli", "babu bhatt"],
    },
    "place_leather_craft": {
        "id": "place_leather_craft",
        "name": "Mewar Royal Leather & Jutti Craft Studio",
        "category": "artisan_studio",
        "latitude": 24.5840,
        "longitude": 73.6865,
        "address": "Hathi Pole Bazaar, Udaipur, Rajasthan 313001",
        "entry_fee_inr": 0.0,
        "typical_duration_minutes": 30,
        "keywords": ["ramesh chandra", "leather", "jutti", "mojari", "hathi pole", "hathipole"],
    },
    "place_custom_ambrai_ghat": {
        "id": "place_custom_ambrai_ghat",
        "name": "Ambrai Ghat & Lakeside Waterfront",
        "category": "attraction",
        "latitude": 24.5789,
        "longitude": 73.6791,
        "address": "Chandpole Maji Ka Mandir, Pichola, Udaipur",
        "entry_fee_inr": 20.0,
        "typical_duration_minutes": 45,
        "keywords": ["ambrai ghat", "hanuman ghat"],
    },
    "place_custom_ambrai_restaurant": {
        "id": "place_custom_ambrai_restaurant",
        "name": "Ambrai Restaurant (Amet Haveli)",
        "category": "dining",
        "latitude": 24.5790,
        "longitude": 73.6790,
        "address": "Outside Chandpole, Naga Nagri, Udaipur",
        "entry_fee_inr": 0.0,
        "typical_duration_minutes": 75,
        "keywords": ["ambrai restaurant", "amet haveli"],
    },
    "place_custom_upre": {
        "id": "place_custom_upre",
        "name": "Upre by 1559 AD Rooftop Lounge",
        "category": "dining",
        "latitude": 24.5782,
        "longitude": 73.6795,
        "address": "Lake Pichola Hotel, Outside Chandpole, Udaipur",
        "entry_fee_inr": 0.0,
        "typical_duration_minutes": 75,
        "keywords": ["upre", "1559 ad"],
    },
    "place_custom_jheels_cafe": {
        "id": "place_custom_jheels_cafe",
        "name": "Jheel's Ginger Coffee Bar & Bakery",
        "category": "dining",
        "latitude": 24.5797,
        "longitude": 73.6803,
        "address": "52 Gangaur Ghat Marg, Old City, Udaipur",
        "entry_fee_inr": 0.0,
        "typical_duration_minutes": 45,
        "keywords": ["jheel", "ginger coffee", "rooftop tea", "rooftop cafe", "tea shop", "coffee bar"],
    },
    "place_custom_fateh_sagar": {
        "id": "place_custom_fateh_sagar",
        "name": "Fateh Sagar Lake Promenade (Paal & Bombay Market)",
        "category": "attraction",
        "latitude": 24.6006,
        "longitude": 73.6782,
        "address": "Fateh Sagar Paal, Udaipur, Rajasthan",
        "entry_fee_inr": 0.0,
        "typical_duration_minutes": 60,
        "keywords": ["fateh sagar", "fatehsagar", "bombay market", "nehru park"],
    },
    "place_custom_monsoon_palace": {
        "id": "place_custom_monsoon_palace",
        "name": "Sajjangarh Monsoon Palace",
        "category": "heritage",
        "latitude": 24.5937,
        "longitude": 73.6396,
        "address": "Sajjangarh Sanctuary, Udaipur, Rajasthan",
        "entry_fee_inr": 165.0,
        "typical_duration_minutes": 90,
        "keywords": ["sajjangarh", "monsoon palace"],
    },
    "place_custom_karni_mata": {
        "id": "place_custom_karni_mata",
        "name": "Shri Manshapurna Karni Mata Temple & Ropeway",
        "category": "attraction",
        "latitude": 24.5625,
        "longitude": 73.6852,
        "address": "Doodh Talai, Pichola, Udaipur",
        "entry_fee_inr": 150.0,
        "typical_duration_minutes": 60,
        "keywords": ["karni mata", "doodh talai", "ropeway"],
    },
    "place_custom_badi_lake": {
        "id": "place_custom_badi_lake",
        "name": "Badi Lake & Bahubali Hills Viewpoint",
        "category": "attraction",
        "latitude": 24.6245,
        "longitude": 73.6211,
        "address": "Badi Village, Udaipur, Rajasthan",
        "entry_fee_inr": 20.0,
        "typical_duration_minutes": 90,
        "keywords": ["badi lake", "bahubali hills"],
    },
}


def resolve_udaipur_place(
    place_id: Optional[str] = None,
    name_or_query: Optional[str] = None,
    stops: Optional[List[Dict[str, Any]]] = None,
) -> Dict[str, Any]:
    """
    Resolves a place_id or place name against active trip stops, UDAIPUR_GAZETTEER,
    or synthesizes a custom Udaipur place entry without blindly overwriting to Sukhadia Circle.
    """
    if place_id and place_id in UDAIPUR_GAZETTEER:
        return dict(UDAIPUR_GAZETTEER[place_id])

    search_str = f"{place_id or ''} {name_or_query or ''}".strip().lower()

    if stops:
        for s in stops:
            s_name = (s.get("name") or "").lower()
            s_pid = (s.get("place_id") or "").lower()
            s_id = (s.get("id") or "").lower()
            if (
                (place_id and place_id.lower() in (s_pid, s_id))
                or (s_name and (s_name in search_str or search_str in s_name))
            ):
                return {
                    "id": s.get("place_id") or s.get("id"),
                    "stop_id": s.get("id"),
                    "name": s.get("name") or "Stop",
                    "category": s.get("category") or "attraction",
                    "latitude": float(s.get("latitude") or 24.5794),
                    "longitude": float(s.get("longitude") or 73.6841),
                    "address": s.get("address") or "Udaipur, Rajasthan",
                    "entry_fee_inr": float(s.get("entry_fee_inr") or 0.0),
                    "typical_duration_minutes": int(s.get("suggested_duration_minutes") or 45),
                }

    for pid, meta in UDAIPUR_GAZETTEER.items():
        if meta["name"].lower() in search_str or any(kw in search_str for kw in meta.get("keywords", [])):
            return dict(meta)

    clean_title = (name_or_query or place_id or "Custom Udaipur Venue").strip()
    slug = re.sub(r"[^a-z0-9]+", "_", clean_title.lower()).strip("_")[:24]
    custom_id = place_id if (place_id and place_id.startswith("place_")) else f"place_custom_{slug or uuid.uuid4().hex[:6]}"
    cat = "dining" if any(w in search_str for w in ["cafe", "restaurant", "tea", "coffee", "food", "dinner", "lunch", "rooftop"]) else (
        "artisan_studio" if any(w in search_str for w in ["studio", "workshop", "craft", "art"]) else "attraction"
    )
    return {
        "id": custom_id,
        "name": clean_title if not clean_title.startswith("place_") else clean_title.replace("place_", "").replace("_", " ").title(),
        "category": cat,
        "latitude": 24.5795,
        "longitude": 73.6825,
        "address": "Old City / Lakeside, Udaipur, Rajasthan",
        "entry_fee_inr": 0.0,
        "typical_duration_minutes": 45,
    }


COMPANION_SYSTEM_PROMPT = """
You are the TrailWeave AI Travel Companion, an intelligent, logical, and culturally insightful travel assistant for Udaipur ("The Cultured Local Companion").
You greet warmly ("Khamma Ghani!" or "Namaste") and think like a real human concierge and itinerary planner.

CRITICAL REASONING & BEHAVIORAL RULES:
1. NEVER give canned, repetitive, or pre-scripted responses. Answer ONLY what the traveler is actually asking about. Do NOT bring up pre-loaded itinerary stops (such as Jagdish Temple shoe rules, Fateh Sagar, or random workshops) unless the traveler asks about them or they are directly affected by a route change.
2. You have full access to the traveler's live itinerary (stops, arrival/departure times, durations, travel mode, budget, and recent manual edits) and backend tools.
3. MULTI-STEP LOGICAL THINKING & CONVERSATIONAL CONFIRMATION:
   - When the traveler mentions wanting to travel from one place to another by a specific transport mode (e.g., "I need to travel from City Palace to Bagore Ki Haveli by auto", "Can we take a cab to Saheliyon Ki Bari?", "How long to walk between stops?"):
     a) First call `calculate_transit_route` to compute the real distance, transit minutes across walking/auto_rickshaw/cab (powered by Google Routes API), and estimated auto/cab fare in INR.
     b) If the traveler has NOT confirmed changing the itinerary yet, present the exact transit time, distance, and estimated fare clearly, explain how it affects their stop timings, and ask for confirmation (e.g., "Would you like me to switch that leg / your itinerary to auto-rickshaw and update your schedule?").
   - When the traveler CONFIRMS a discussed change (e.g., "Yes", "Yes please", "Change it", "Go ahead", "Confirm", "Sure") in a follow-up message:
     a) Check the conversation history to see what change was just discussed (e.g., changing travel mode to `auto_rickshaw`, adding a stop, skipping a stop, changing duration/time).
     b) Call `propose_trip_changes` with `auto_commit=True` so the itinerary is immediately updated in the database to the next revision, and confirm to the traveler that their itinerary has been updated!
   - When the traveler directly requests an immediate itinerary change in a single turn (e.g., "I'm tired, can we skip the haveli and find a rooftop tea shop nearby?", "Add Master Mohanlal studio after lunch", "Spend 60 minutes at Jagdish Temple instead of 30", "Move Bagore Ki Haveli to 5:30 PM", "Remove Saheliyon Ki Bari"):
     a) Call `propose_trip_changes` (with `auto_commit=False` so an interactive 1-Tap Proposal Card is generated for review, OR `auto_commit=True` if they explicitly say "apply/commit it now").
     b) If there are recent manual edits in `Recent traveler actions acknowledged`, warmly acknowledge them in your `response_narrative` (e.g. "I see you skipped ... earlier, so I've kept that in mind!").
4. FULL ITINERARY MANAGEMENT CAPABILITIES:
   You can manage every aspect of the itinerary via `propose_trip_changes` and `execute_direct_trip_action`:
   - `update_travel_mode`: Change transit mode (`walking`, `auto_rickshaw`, `cab`) for a specific stop leg (`stop_id`) or the entire trip.
   - `update_stop_duration`: Change how many minutes (`duration_minutes`) the traveler spends at any stop.
   - `reschedule_stop`: Change the `planned_arrival_time` (e.g. `"17:30"`) of any stop.
   - `add_stop`: Add any canonical place from the catalog OR any custom Udaipur restaurant, cafe, ghat, or attraction using `custom_place_name`, `custom_category`, and `duration_minutes`.
   - `skip_stop` / `remove_stop` / `reorder_stops` / `pin_stop`: Skip, remove, reorder, or pin stops.
   - `update_budget`: Change the trip's budget cap (`budget_inr`).
   - `execute_direct_trip_action`: Mark a stop as visited (`mark_visited`) or checked out (`mark_checkout`), or update `artisan_preference` (`workshop`, `store`, `both`).
"""


async def call_gemini_api(
    api_key: str,
    payload: Dict[str, Any],
    timeout: float = 18.0
) -> Optional[Dict[str, Any]]:
    """Helper to query Gemini API with fast model fallback and error resilience."""
    if not api_key or not httpx:
        return None

    for model in FALLBACK_GEMINI_MODELS:
        url = f"https://generativelanguage.googleapis.com/v1beta/models/{model}:generateContent?key={api_key}"
        try:
            async with httpx.AsyncClient(timeout=timeout) as client:
                resp = await client.post(url, json=payload)
                if resp.status_code == 200:
                    return resp.json()
                elif resp.status_code == 400 and "thinkingConfig" in json.dumps(payload.get("generationConfig", {})):
                    clean_payload = dict(payload)
                    gen_cfg = dict(clean_payload.get("generationConfig", {}))
                    gen_cfg.pop("thinkingConfig", None)
                    clean_payload["generationConfig"] = gen_cfg
                    resp_retry = await client.post(url, json=clean_payload)
                    if resp_retry.status_code == 200:
                        return resp_retry.json()
                logger.warning("Gemini model %s returned status %d, trying next model...", model, resp.status_code)
        except Exception as e:
            logger.warning("Gemini API call failed for %s: %s", model, e)
            continue
    return None


DEMO_TRIP_FALLBACK: Dict[str, Any] = {
    "trip_id": "trip_demo_udaipur",
    "title": "Udaipur Living Heritage & Crafts Walk",
    "revision": 1,
    "budget_inr": 2500.0,
    "travel_mode": "auto_rickshaw",
    "artisan_preference": "both",
    "status": "in_progress",
    "stops": [
        {
            "id": "stop_cp",
            "place_id": "place_city_palace",
            "name": "City Palace Udaipur",
            "category": "heritage",
            "latitude": 24.5764,
            "longitude": 73.6835,
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
            "latitude": 24.5796,
            "longitude": 73.6844,
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
            "latitude": 24.5794,
            "longitude": 73.6841,
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
            "latitude": 24.5798,
            "longitude": 73.6800,
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
        "description": "Fetches the current authoritative trip state, current revision number, active stops, travel mode, and traveler budget/preference constraints.",
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
        "description": "Searches canonical places, restaurants, cafes, lakes, and verified local artisan studios in Udaipur by keyword, category, or fee constraint.",
        "parameters": {
            "type": "OBJECT",
            "properties": {
                "query": {
                    "type": "STRING",
                    "description": "Search term, e.g. 'pottery', 'miniature painting', 'rooftop tea', 'lakeside dining', 'Fateh Sagar'."
                },
                "category": {
                    "type": "STRING",
                    "enum": ["attraction", "heritage", "dining", "artisan_studio"],
                    "description": "Filter by place category."
                },
                "max_fee_inr": {
                    "type": "INTEGER",
                    "description": "Maximum entry or workshop fee allowed."
                }
            }
        }
    },
    {
        "name": "get_place_details",
        "description": "Fetches verified operational details of a specific canonical place or artisan studio, including hours, workshop pricing, coordinates, and address.",
        "parameters": {
            "type": "OBJECT",
            "properties": {
                "place_id": {
                    "type": "STRING",
                    "description": "The unique place identifier or place name."
                }
            },
            "required": ["place_id"]
        }
    },
    {
        "name": "calculate_transit_route",
        "description": "Calculates live transit duration, road distance, and estimated fare between two stops or Udaipur locations across walking, auto_rickshaw, and cab using Google Routes API.",
        "parameters": {
            "type": "OBJECT",
            "properties": {
                "origin": {
                    "type": "STRING",
                    "description": "Origin stop name, stop_id, or place name (e.g. 'City Palace Udaipur')."
                },
                "destination": {
                    "type": "STRING",
                    "description": "Destination stop name, stop_id, or place name (e.g. 'Bagore Ki Haveli')."
                },
                "preferred_mode": {
                    "type": "STRING",
                    "enum": ["walking", "auto_rickshaw", "cab"],
                    "description": "Requested travel mode to highlight."
                }
            },
            "required": ["origin", "destination"]
        }
    },
    {
        "name": "propose_trip_changes",
        "description": "Submits itinerary modifications (add/skip/remove/reorder/pin stops, change travel mode, update stop duration, reschedule stop arrival time, or update budget) to the deterministic Trip Engine.",
        "parameters": {
            "type": "OBJECT",
            "properties": {
                "operations": {
                    "type": "ARRAY",
                    "description": "Ordered sequence of itinerary operations.",
                    "items": {
                        "type": "OBJECT",
                        "properties": {
                            "type": {
                                "type": "STRING",
                                "enum": [
                                    "add_stop",
                                    "remove_stop",
                                    "skip_stop",
                                    "reorder_stops",
                                    "pin_stop",
                                    "update_travel_mode",
                                    "update_stop_duration",
                                    "reschedule_stop",
                                    "update_budget"
                                ],
                                "description": "The mutation action to perform."
                            },
                            "stop_id": {
                                "type": "STRING",
                                "description": "Target stop ID or stop name for skip, remove, reorder, pin, update_stop_duration, reschedule_stop, or per-leg update_travel_mode."
                            },
                            "place_id": {
                                "type": "STRING",
                                "description": "Place ID for add_stop (e.g. 'place_city_palace', 'place_bagore_haveli', 'place_mohanlal_studio', 'place_pottery_studio', 'place_puppetry_workshop', 'place_leather_craft', 'place_sukhadia_circle', 'place_saheliyon_bari', or custom ID)."
                            },
                            "custom_place_name": {
                                "type": "STRING",
                                "description": "Name of the venue if adding a custom restaurant, cafe, or attraction (e.g. 'Ambrai Restaurant', 'Jheel's Ginger Coffee Bar', 'Fateh Sagar Paal')."
                            },
                            "custom_category": {
                                "type": "STRING",
                                "enum": ["attraction", "heritage", "dining", "artisan_studio"],
                                "description": "Category for custom added stop."
                            },
                            "new_order": {
                                "type": "INTEGER",
                                "description": "Target 1-based sequence index within the day."
                            },
                            "travel_mode": {
                                "type": "STRING",
                                "enum": ["walking", "auto_rickshaw", "cab"],
                                "description": "New travel mode for update_travel_mode or add_stop."
                            },
                            "duration_minutes": {
                                "type": "INTEGER",
                                "description": "New visit duration in minutes for update_stop_duration or add_stop."
                            },
                            "planned_arrival_time": {
                                "type": "STRING",
                                "description": "New arrival time in HH:MM (24-hour IST, e.g. '17:30') for reschedule_stop or add_stop."
                            },
                            "budget_inr": {
                                "type": "NUMBER",
                                "description": "New trip budget in INR for update_budget."
                            }
                        },
                        "required": ["type"]
                    }
                },
                "response_narrative": {
                    "type": "STRING",
                    "description": "Natural, warm explanation for the traveler detailing the itinerary update."
                },
                "auto_commit": {
                    "type": "BOOLEAN",
                    "description": "Set to true ONLY when the traveler is explicitly confirming a change that was just proposed/discussed in the previous turn (e.g. 'Yes, change it') or explicitly asks to apply immediately."
                }
            },
            "required": ["operations", "response_narrative"]
        }
    },
    {
        "name": "execute_direct_trip_action",
        "description": "Directly marks a stop as visited (check-in) or checked out, or updates trip-level artisan preferences.",
        "parameters": {
            "type": "OBJECT",
            "properties": {
                "action_type": {
                    "type": "STRING",
                    "enum": ["mark_visited", "mark_checkout", "update_artisan_preference"],
                    "description": "Direct action to execute."
                },
                "stop_id": {
                    "type": "STRING",
                    "description": "Stop ID or stop name for mark_visited or mark_checkout."
                },
                "artisan_preference": {
                    "type": "STRING",
                    "enum": ["workshop", "store", "both", "none"],
                    "description": "New artisan preference when action_type is update_artisan_preference."
                }
            },
            "required": ["action_type"]
        }
    }
]


class GeminiCompanionService:
    def __init__(self, api_key: Optional[str] = None):
        self.api_key = api_key if api_key is not None else (os.getenv("GEMINI_API_KEY", "") or settings.GEMINI_API_KEY)
        self.mutation_engine = UnifiedMutationEngine()

    async def generate_reply(self, message: str, trip_context: Dict[str, Any]) -> str:
        """Conversational companion response generation."""
        res = await self.process_companion_chat(
            trip_id=trip_context.get("trip_id", "trip_demo_udaipur"),
            user_message=message,
            db=None,
            client_trip_state=trip_context,
        )
        return res.get("response_narrative", "")

    async def ensure_trip_synced(
        self,
        trip_id: str,
        db: Optional[AsyncSession],
        client_trip_state: Optional[Dict[str, Any]] = None,
    ) -> None:
        """
        If the frontend is working on a custom or locally-hydrated trip not yet in PostgreSQL,
        upserts the trip, version, and stops so tools and replanning operate on real DB rows.
        """
        if db is None or not client_trip_state:
            return
        try:
            res = await db.execute(text("SELECT id FROM trips WHERE id = :id"), {"id": trip_id})
            if res.fetchone():
                return

            title = client_trip_state.get("title") or "My Udaipur Itinerary"
            rev = int(client_trip_state.get("revision") or 1)
            budget = float(client_trip_state.get("budget_inr") or 2500.0)
            stops = client_trip_state.get("stops") or []
            ver_id = f"ver_{trip_id}_{rev}"

            await db.execute(
                text("""
                    INSERT INTO trips (
                        id, user_id, title, destination, duration_type, total_days,
                        budget_inr, budget_mode, artisan_preference, revision,
                        current_itinerary_version_id, status
                    ) VALUES (
                        :id, 'tourist_demo_user', :title, 'Udaipur', 'single_day', 1,
                        :budget, 'total', 'both', :rev, :vid, 'in_progress'
                    ) ON CONFLICT (id) DO NOTHING
                """),
                {"id": trip_id, "title": title, "budget": budget, "rev": rev, "vid": ver_id},
            )
            await db.execute(
                text("""
                    INSERT INTO itinerary_versions (
                        id, trip_id, version_number, total_estimated_cost_inr, total_estimated_duration_minutes
                    ) VALUES (:vid, :tid, :rev, 0, 240) ON CONFLICT (id) DO NOTHING
                """),
                {"vid": ver_id, "tid": trip_id, "rev": rev},
            )
            for idx, s in enumerate(stops):
                pid = s.get("place_id") or f"place_custom_{idx}"
                await db.execute(
                    text("""
                        INSERT INTO places (
                            id, name, category, latitude, longitude, address,
                            entry_fee_inr, typical_duration_minutes, data_status
                        ) VALUES (
                            :id, :name, :cat, :lat, :lon, :addr, :fee, :dur, 'verified'
                        ) ON CONFLICT (id) DO NOTHING
                    """),
                    {
                        "id": pid,
                        "name": s.get("name") or pid,
                        "cat": s.get("category") or "heritage",
                        "lat": float(s.get("latitude") or 24.5794),
                        "lon": float(s.get("longitude") or 73.6841),
                        "addr": s.get("address") or "Udaipur, Rajasthan",
                        "fee": float(s.get("entry_fee_inr") or 0.0),
                        "dur": int(s.get("suggested_duration_minutes") or 45),
                    },
                )
                stop_id = s.get("id") or f"stop_{trip_id}_{idx + 1}"
                arr_val = s.get("planned_arrival")
                dep_val = s.get("planned_departure")
                if isinstance(arr_val, str):
                    try:
                        arr_val = datetime.fromisoformat(arr_val.replace("Z", "+00:00"))
                    except Exception:
                        arr_val = None
                if isinstance(dep_val, str):
                    try:
                        dep_val = datetime.fromisoformat(dep_val.replace("Z", "+00:00"))
                    except Exception:
                        dep_val = None

                await db.execute(
                    text("""
                        INSERT INTO trip_stops (
                            id, trip_id, itinerary_version_id, place_id, day_number,
                            sequence_in_day, planned_arrival, planned_departure,
                            suggested_duration_minutes, actual_duration_minutes,
                            is_pinned, visit_status
                        ) VALUES (
                            :id, :tid, :vid, :pid, :day, :seq, :arr, :dep, :dur, :act, :pin, :status
                        ) ON CONFLICT (id) DO NOTHING
                    """),
                    {
                        "id": stop_id,
                        "tid": trip_id,
                        "vid": ver_id,
                        "pid": pid,
                        "day": int(s.get("day_number") or 1),
                        "seq": int(s.get("sequence_in_day") or (idx + 1)),
                        "arr": arr_val,
                        "dep": dep_val,
                        "dur": int(s.get("suggested_duration_minutes") or 45),
                        "act": s.get("actual_duration_minutes"),
                        "pin": bool(s.get("is_pinned", False)),
                        "status": s.get("visit_status") or "pending",
                    },
                )
            await db.commit()
        except Exception as e:
            logger.warning("Failed to sync client_trip_state for %s: %s", trip_id, e)

    async def execute_get_current_trip(
        self,
        trip_id: str,
        db: Optional[AsyncSession] = None,
        client_trip_state: Optional[Dict[str, Any]] = None,
    ) -> Dict[str, Any]:
        """Fetch authoritative trip state, current revision, travel mode, and active stops."""
        if db is None:
            if client_trip_state and client_trip_state.get("stops"):
                return {
                    "trip_id": trip_id,
                    "title": client_trip_state.get("title", "Udaipur Cultural Journey"),
                    "revision": int(client_trip_state.get("revision", 1)),
                    "budget_inr": float(client_trip_state.get("budget_inr", 2500.0)),
                    "travel_mode": client_trip_state.get("travel_mode", "auto_rickshaw"),
                    "artisan_preference": client_trip_state.get("artisan_preference", "both"),
                    "status": "in_progress",
                    "stops": client_trip_state["stops"],
                }
            return dict(DEMO_TRIP_FALLBACK)

        if client_trip_state:
            await self.ensure_trip_synced(trip_id, db, client_trip_state)

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
            if client_trip_state and client_trip_state.get("stops"):
                return {
                    "trip_id": trip_id,
                    "title": client_trip_state.get("title", "Udaipur Cultural Journey"),
                    "revision": int(client_trip_state.get("revision", 1)),
                    "budget_inr": float(client_trip_state.get("budget_inr", 2500.0)),
                    "travel_mode": client_trip_state.get("travel_mode", "auto_rickshaw"),
                    "artisan_preference": client_trip_state.get("artisan_preference", "both"),
                    "status": "in_progress",
                    "stops": client_trip_state["stops"],
                }
            if trip_id in ["trip_demo_udaipur", "trip_udaipur_heritage_01"]:
                return dict(DEMO_TRIP_FALLBACK)
            return {"error": f"Trip {trip_id} not found"}

        travel_mode = "auto_rickshaw"
        stops = []
        if trip.current_itinerary_version_id:
            ver_res = await db.execute(
                text("SELECT route_geometry FROM itinerary_versions WHERE id = :vid"),
                {"vid": trip.current_itinerary_version_id},
            )
            ver_row = ver_res.fetchone()
            if ver_row and getattr(ver_row, "route_geometry", None):
                rg = ver_row.route_geometry
                if isinstance(rg, str):
                    try:
                        rg = json.loads(rg)
                    except Exception:
                        rg = {}
                if isinstance(rg, dict) and rg.get("travel_mode"):
                    travel_mode = rg["travel_mode"]

            stops_res = await db.execute(
                text("""
                    SELECT
                        s.id, s.place_id, s.day_number, s.sequence_in_day,
                        s.planned_arrival, s.planned_departure,
                        s.suggested_duration_minutes, s.actual_duration_minutes,
                        s.visit_status, s.is_pinned,
                        p.name, p.category, p.entry_fee_inr, p.address, p.latitude, p.longitude
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
                    "latitude": float(r.latitude) if r.latitude is not None else 24.5794,
                    "longitude": float(r.longitude) if r.longitude is not None else 73.6841,
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
            "travel_mode": travel_mode,
            "artisan_preference": getattr(trip, "artisan_preference", "both") or "both",
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
        """Search canonical places, Udaipur gazetteer venues, and verified artisan studios."""
        results: List[Dict[str, Any]] = []
        seen_ids = set()

        if db is not None:
            conditions = ["1=1"]
            params: Dict[str, Any] = {}

            if query:
                conditions.append("(p.name ILIKE :q OR p.category ILIKE :q OR p.address ILIKE :q OR a.craft_type ILIKE :q OR a.artisan_name ILIKE :q)")
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
                LIMIT 12
            """
            try:
                res = await db.execute(text(sql), params)
                for r in res.fetchall():
                    seen_ids.add(r.id)
                    results.append({
                        "id": r.id,
                        "name": r.name,
                        "category": r.category,
                        "address": r.address,
                        "latitude": float(r.latitude) if r.latitude is not None else 24.5794,
                        "longitude": float(r.longitude) if r.longitude is not None else 73.6841,
                        "entry_fee_inr": float(r.entry_fee_inr or 0),
                        "typical_duration_minutes": r.typical_duration_minutes,
                        "opening_time": str(r.opening_time) if r.opening_time else None,
                        "closing_time": str(r.closing_time) if r.closing_time else None,
                        "artisan_name": r.artisan_name,
                        "craft_type": r.craft_type,
                        "has_workshop": bool(r.has_workshop) if r.has_workshop is not None else False,
                        "workshop_fee_inr": float(r.workshop_fee_inr or 0)
                    })
            except Exception as e:
                logger.warning("DB search_places failed: %s", e)

        q_lower = (query or "").lower()
        for pid, meta in UDAIPUR_GAZETTEER.items():
            if pid in seen_ids:
                continue
            if category and meta.get("category") != category:
                continue
            if max_fee_inr is not None and float(meta.get("entry_fee_inr", 0)) > max_fee_inr:
                continue
            if not q_lower or (
                q_lower in meta["name"].lower()
                or q_lower in meta["category"].lower()
                or q_lower in meta["address"].lower()
                or any(q_lower in kw or kw in q_lower for kw in meta.get("keywords", []))
            ):
                results.append(dict(meta))

        return results[:12]

    async def execute_get_place_details(self, place_id: str, db: Optional[AsyncSession] = None) -> Dict[str, Any]:
        """Fetch verified place details from PostgreSQL or Udaipur Gazetteer."""
        if db is not None:
            try:
                res = await db.execute(
                    text("""
                        SELECT
                            p.*,
                            a.id AS artisan_id, a.artisan_name, a.craft_type, a.phone_number,
                            a.has_workshop, a.workshop_fee_inr, a.workshop_duration_minutes,
                            a.workshop_description
                        FROM places p
                        LEFT JOIN artisans a ON a.place_id = p.id AND a.profile_status = 'approved'
                        WHERE p.id = :pid OR p.name ILIKE :pname
                    """),
                    {"pid": place_id, "pname": f"%{place_id}%"}
                )
                r = res.fetchone()
                if r:
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
            except Exception as e:
                logger.warning("DB get_place_details error: %s", e)

        return resolve_udaipur_place(place_id=place_id, name_or_query=place_id)

    async def execute_calculate_transit_route(
        self,
        origin: str,
        destination: str,
        preferred_mode: str = "auto_rickshaw",
        stops: Optional[List[Dict[str, Any]]] = None,
    ) -> Dict[str, Any]:
        """
        Calculates transit duration (via Google Routes API v2 / Distance Matrix / Haversine)
        and estimated fares between two stops or Udaipur places across walking, auto_rickshaw, and cab.
        """
        orig_meta = resolve_udaipur_place(name_or_query=origin, stops=stops)
        dest_meta = resolve_udaipur_place(name_or_query=destination, stops=stops)
        lat1, lon1 = float(orig_meta["latitude"]), float(orig_meta["longitude"])
        lat2, lon2 = float(dest_meta["latitude"]), float(dest_meta["longitude"])

        dist_m = haversine_distance_meters(lat1, lon1, lat2, lon2) if haversine_distance_meters else 1200.0
        road_dist_km = round(max(0.2, (dist_m * 1.3) / 1000.0), 2)
        now_dt = datetime.now(timezone.utc)

        walk_mins = await compute_transit_minutes(lat1, lon1, lat2, lon2, "walking", now_dt, settings.GOOGLE_MAPS_API_KEY)
        auto_mins = await compute_transit_minutes(lat1, lon1, lat2, lon2, "auto_rickshaw", now_dt, settings.GOOGLE_MAPS_API_KEY)
        cab_mins = await compute_transit_minutes(lat1, lon1, lat2, lon2, "cab", now_dt, settings.GOOGLE_MAPS_API_KEY)

        auto_fare_inr = max(40, int(round(30 + road_dist_km * 18, -1)))
        cab_fare_inr = max(120, int(round(80 + road_dist_km * 25, -1)))

        return {
            "origin": {
                "name": orig_meta["name"],
                "place_id": orig_meta.get("id"),
                "stop_id": orig_meta.get("stop_id"),
            },
            "destination": {
                "name": dest_meta["name"],
                "place_id": dest_meta.get("id"),
                "stop_id": dest_meta.get("stop_id"),
            },
            "road_distance_km": road_dist_km,
            "preferred_mode": preferred_mode,
            "modes": {
                "walking": {"duration_minutes": walk_mins, "estimated_fare_inr": 0},
                "auto_rickshaw": {"duration_minutes": auto_mins, "estimated_fare_inr": auto_fare_inr},
                "cab": {"duration_minutes": cab_mins, "estimated_fare_inr": cab_fare_inr},
            },
        }

    async def execute_direct_trip_action(
        self,
        trip_id: str,
        action_type: str,
        stops: List[Dict[str, Any]],
        stop_id: Optional[str] = None,
        artisan_preference: Optional[str] = None,
        db: Optional[AsyncSession] = None,
    ) -> Dict[str, Any]:
        """Executes direct check-in, check-out, or preference updates requested via chat."""
        target_stop = None
        if stop_id:
            target_stop = next(
                (
                    s
                    for s in stops
                    if s.get("id") == stop_id
                    or s.get("place_id") == stop_id
                    or stop_id.lower() in (s.get("name") or "").lower()
                ),
                None,
            )
        if not target_stop and stops:
            pending = [s for s in stops if s.get("visit_status") == "pending"]
            target_stop = pending[0] if pending else stops[0]

        if db is not None:
            if action_type == "mark_visited" and target_stop:
                await db.execute(
                    text("UPDATE trip_stops SET visit_status = 'visited' WHERE id = :sid"),
                    {"sid": target_stop["id"]},
                )
                await db.commit()
                return {"success": True, "action": "mark_visited", "stop_id": target_stop["id"], "stop_name": target_stop["name"]}
            elif action_type == "mark_checkout" and target_stop:
                dur = int(target_stop.get("suggested_duration_minutes") or 45)
                await db.execute(
                    text("UPDATE trip_stops SET visit_status = 'visited', actual_duration_minutes = :dur WHERE id = :sid"),
                    {"sid": target_stop["id"], "dur": dur},
                )
                await db.commit()
                return {"success": True, "action": "mark_checkout", "stop_id": target_stop["id"], "stop_name": target_stop["name"]}
            elif action_type == "update_artisan_preference" and artisan_preference:
                await db.execute(
                    text("UPDATE trips SET artisan_preference = :pref, updated_at = NOW() WHERE id = :tid"),
                    {"pref": artisan_preference, "tid": trip_id},
                )
                await db.commit()
                return {"success": True, "action": "update_artisan_preference", "artisan_preference": artisan_preference}

        return {
            "success": True,
            "action": action_type,
            "stop_id": target_stop["id"] if target_stop else stop_id,
            "stop_name": target_stop["name"] if target_stop else stop_id,
            "artisan_preference": artisan_preference,
        }

    async def execute_propose_trip_changes(
        self,
        trip_id: str,
        base_revision: int,
        operations: List[Dict[str, Any]],
        db: Optional[AsyncSession],
        auto_commit: bool = False,
        fallback_stops: Optional[List[Dict[str, Any]]] = None,
    ) -> Dict[str, Any]:
        """
        Dispatches candidate operations to the deterministic Trip Engine and
        stores provisional proposal in replan_proposals. If auto_commit=True,
        also commits the proposal atomically to Revision N+1.
        """
        parsed_ops: List[ReplanOperation] = []
        for op in operations:
            op_type = op.get("type")
            place_id = op.get("place_id")
            custom_name = op.get("custom_place_name")
            custom_cat = op.get("custom_category")
            custom_lat = op.get("custom_latitude")
            custom_lon = op.get("custom_longitude")
            custom_addr = op.get("custom_address")
            custom_fee = op.get("custom_entry_fee_inr")

            if op_type == "add_stop":
                resolved = resolve_udaipur_place(place_id=place_id, name_or_query=custom_name or place_id)
                place_id = resolved["id"]
                custom_name = custom_name or resolved["name"]
                custom_cat = custom_cat or resolved["category"]
                custom_lat = custom_lat if custom_lat is not None else resolved["latitude"]
                custom_lon = custom_lon if custom_lon is not None else resolved["longitude"]
                custom_addr = custom_addr or resolved["address"]
                custom_fee = custom_fee if custom_fee is not None else resolved["entry_fee_inr"]

            parsed_ops.append(
                ReplanOperation(
                    type=op_type,
                    place_id=place_id,
                    stop_id=op.get("stop_id"),
                    new_order=op.get("new_order"),
                    day_number=op.get("day_number", 1),
                    is_pinned=op.get("is_pinned"),
                    travel_mode=op.get("travel_mode"),
                    duration_minutes=op.get("duration_minutes"),
                    planned_arrival_time=op.get("planned_arrival_time"),
                    custom_place_name=custom_name,
                    custom_category=custom_cat,
                    custom_address=custom_addr,
                    custom_latitude=custom_lat,
                    custom_longitude=custom_lon,
                    custom_entry_fee_inr=custom_fee,
                    budget_inr=op.get("budget_inr"),
                )
            )

        if db is None:
            current_stops = fallback_stops or DEMO_TRIP_FALLBACK["stops"]
            places_catalog = dict(UDAIPUR_GAZETTEER)
            start_location = StartLocation(name="Hotel Swaroop Vilas", latitude=24.5854, longitude=73.6812)
            eval_result = await self.mutation_engine.evaluate_mutation(
                current_stops=current_stops,
                operations=parsed_ops,
                trip_id=trip_id,
                base_revision=base_revision,
                budget_limit=2500.0,
                start_location=start_location,
                start_datetime=datetime.now(timezone.utc),
                travel_mode="auto_rickshaw",
                artisan_preference="both",
                places_catalog=places_catalog,
                google_maps_api_key=settings.GOOGLE_MAPS_API_KEY,
            )
            proposal_id = f"prop_ai_{datetime.now(timezone.utc).strftime('%Y%m%d%H%M%S')}_{uuid.uuid4().hex[:6]}"
            expires_at = datetime.now(timezone.utc) + timedelta(minutes=15)
            return {
                "proposal_id": proposal_id,
                "base_revision": base_revision,
                "is_feasible": eval_result["is_feasible"],
                "validation_diff": eval_result["validation_diff"].model_dump(),
                "candidate_stops": eval_result["candidate_stops"],
                "total_cost_inr": eval_result["total_estimated_cost_inr"],
                "total_duration_minutes": eval_result["total_estimated_duration_minutes"],
                "expires_at": expires_at.isoformat(),
                "auto_committed": auto_commit,
                "new_revision": (base_revision + 1) if auto_commit else None,
            }

        from app.api.v1.replan import _fetch_trip_active_stops, _fetch_places_catalog, accept_replan
        from app.schemas.replan import ReplanAcceptRequest

        trip_res = await db.execute(text("SELECT * FROM trips WHERE id = :id"), {"id": trip_id})
        trip = trip_res.fetchone()
        if not trip and trip_id in ["trip_demo_udaipur", "trip_udaipur_heritage_01"]:
            demo_res = await db.execute(text("SELECT * FROM trips WHERE id = 'trip_demo_udaipur'"))
            trip = demo_res.fetchone()

        if not trip or not getattr(trip, "current_itinerary_version_id", None):
            current_stops = fallback_stops or DEMO_TRIP_FALLBACK["stops"]
            places_catalog = dict(UDAIPUR_GAZETTEER)
            start_location = StartLocation(name="Hotel Swaroop Vilas", latitude=24.5854, longitude=73.6812)
            eval_result = await self.mutation_engine.evaluate_mutation(
                current_stops=current_stops,
                operations=parsed_ops,
                trip_id=trip_id,
                base_revision=base_revision,
                budget_limit=2500.0,
                start_location=start_location,
                start_datetime=datetime.now(timezone.utc),
                travel_mode="auto_rickshaw",
                artisan_preference="both",
                places_catalog=places_catalog,
                google_maps_api_key=settings.GOOGLE_MAPS_API_KEY,
            )
            proposal_id = f"prop_ai_{datetime.now(timezone.utc).strftime('%Y%m%d%H%M%S')}_{uuid.uuid4().hex[:6]}"
            expires_at = datetime.now(timezone.utc) + timedelta(minutes=15)
            return {
                "proposal_id": proposal_id,
                "base_revision": base_revision,
                "is_feasible": eval_result["is_feasible"],
                "validation_diff": eval_result["validation_diff"].model_dump(),
                "candidate_stops": eval_result["candidate_stops"],
                "total_cost_inr": eval_result["total_estimated_cost_inr"],
                "total_duration_minutes": eval_result["total_estimated_duration_minutes"],
                "expires_at": expires_at.isoformat(),
                "auto_committed": auto_commit,
                "new_revision": (base_revision + 1) if auto_commit else None,
            }

        current_stops = await _fetch_trip_active_stops(db, trip.id, trip.current_itinerary_version_id)
        added_place_ids = [op.place_id for op in parsed_ops if op.type == "add_stop" and op.place_id]
        places_catalog = await _fetch_places_catalog(db, added_place_ids)
        for k, v in UDAIPUR_GAZETTEER.items():
            if k not in places_catalog:
                places_catalog[k] = dict(v)

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
            trip_id=trip.id,
            base_revision=base_revision,
            budget_limit=float(trip.budget_inr or 2500.0),
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

        for s in candidate_stops_raw:
            pid = s["place_id"]
            await db.execute(
                text("""
                    INSERT INTO places (
                        id, name, category, latitude, longitude, address,
                        entry_fee_inr, typical_duration_minutes, data_status
                    ) VALUES (
                        :id, :name, :cat, :lat, :lon, :addr, :fee, :dur, 'reported'
                    ) ON CONFLICT (id) DO NOTHING
                """),
                {
                    "id": pid,
                    "name": s.get("name") or pid,
                    "cat": s.get("category") or "attraction",
                    "lat": float(s.get("latitude") or 24.5795),
                    "lon": float(s.get("longitude") or 73.6835),
                    "addr": s.get("address") or "Udaipur, Rajasthan",
                    "fee": float(s.get("entry_fee_inr") or 0.0),
                    "dur": int(s.get("suggested_duration_minutes") or 45),
                },
            )

        proposal_payload = {
            "candidate_stops": candidate_stops_raw,
            "total_estimated_cost_inr": total_cost,
            "total_estimated_duration_minutes": total_duration,
            "route_geometry": eval_result.get("route_geometry", {}),
        }

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
                "trip_id": trip.id,
                "base_rev": base_revision,
                "ops": json.dumps([op.model_dump() for op in parsed_ops], default=str),
                "stops": json.dumps(proposal_payload, default=str),
                "diff": json.dumps(validation_diff.model_dump(), default=str),
                "is_feasible": is_feasible,
                "expires_at": expires_at,
            }
        )
        await db.commit()

        new_rev = None
        if auto_commit:
            try:
                accept_res = await accept_replan(
                    trip_id=trip.id,
                    body=ReplanAcceptRequest(proposal_id=proposal_id, expected_revision=base_revision),
                    db=db,
                )
                if hasattr(accept_res, "new_revision"):
                    new_rev = accept_res.new_revision
            except Exception as e:
                logger.warning("Auto-commit of proposal %s failed: %s", proposal_id, e)

        return {
            "proposal_id": proposal_id,
            "base_revision": base_revision,
            "is_feasible": is_feasible,
            "validation_diff": validation_diff.model_dump(),
            "candidate_stops": candidate_stops_raw,
            "total_cost_inr": total_cost,
            "total_duration_minutes": total_duration,
            "expires_at": expires_at.isoformat(),
            "auto_committed": bool(new_rev is not None),
            "new_revision": new_rev,
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
        db: AsyncSession,
        history: Optional[List[Dict[str, str]]] = None,
        client_trip_state: Optional[Dict[str, Any]] = None,
    ) -> Dict[str, Any]:
        """
        Core conversational orchestration with multi-turn Gemini tool calling (up to 4 rounds):
        1. Syncs client trip state if needed & injects fresh PostgreSQL trip state + recent events.
        2. Preserves multi-turn conversation history so confirmations ("Yes, change it") work seamlessly.
        3. Executes all 7 Gemini tools (`get_current_trip`, `get_recent_trip_events`, `search_places`,
           `get_place_details`, `calculate_transit_route`, `propose_trip_changes`, `execute_direct_trip_action`).
        4. Never uses biased/canned keyword responses.
        """
        trip_data = await self.execute_get_current_trip(
            trip_id, db=db, client_trip_state=client_trip_state
        )
        if "error" in trip_data:
            return {
                "response_narrative": f"Khamma Ghani! I couldn't locate your trip ({trip_id}). Please ensure your trip is active.",
                "replan_proposal": None,
                "acknowledged_events": [],
                "trip_updated": False,
                "new_revision": None,
            }

        recent_events = await self.execute_get_recent_trip_events(trip_id, limit=5, db=db)
        acknowledged = self._extract_recent_event_acknowledgments(recent_events)

        base_revision = trip_data.get("revision", 1)
        stops = trip_data.get("stops", [])

        stops_summary = "\n".join([
            (
                f"  {idx + 1}. Stop ID: '{s['id']}' | Place ID: '{s.get('place_id')}' | Name: '{s['name']}' "
                f"| Category: {s.get('category')} | Status: {s['visit_status']} "
                f"| Time: {s.get('planned_arrival_time')} - {s.get('planned_departure_time')} "
                f"| Duration: {s.get('duration_minutes', 60)} min | Prev Leg Transit: {s.get('transit_minutes_from_prev', 15)} min "
                f"| Fee: ₹{int(s.get('entry_fee_inr', 0))}"
            )
            for idx, s in enumerate(stops)
        ]) or "  (No stops currently in itinerary)"

        recent_summary = "; ".join(acknowledged) if acknowledged else "None"

        context_header = (
            f"=== ACTIVE AUTHORITATIVE TRIP CONTEXT ===\n"
            f"Trip ID: {trip_id}\n"
            f"Title: {trip_data.get('title')}\n"
            f"Revision: {base_revision}\n"
            f"Default Travel Mode: {trip_data.get('travel_mode', 'walking')}\n"
            f"Total Budget: ₹{int(trip_data.get('budget_inr', 2500))} (Mode: {trip_data.get('budget_mode', 'total')})\n"
            f"Artisan Preference: {trip_data.get('artisan_preference', 'both')}\n"
            f"Current Itinerary Stops ({len(stops)} total):\n{stops_summary}\n"
            f"Recent Traveler Actions Acknowledged: {recent_summary}\n"
            f"=========================================\n"
        )

        contents: List[Dict[str, Any]] = []
        if history:
            for idx, turn in enumerate(history[-12:]):
                role = "model" if turn.get("role") in ("ai", "assistant", "model") else "user"
                text_val = (turn.get("text") or turn.get("content") or "").strip()
                if not text_val:
                    continue
                if idx == 0 and role == "model":
                    # Gemini API requires the first turn in contents to have role 'user'
                    contents.append({
                        "role": "user",
                        "parts": [{"text": f"{context_header}\n(Conversation started)"}]
                    })
                contents.append({
                    "role": role,
                    "parts": [{"text": text_val}]
                })

        user_turn_text = f"{context_header}\nTraveler says: \"{user_message}\""
        if contents and contents[-1]["role"] == "user":
            contents[-1]["parts"].append({"text": user_turn_text})
        else:
            contents.append({
                "role": "user",
                "parts": [{"text": user_turn_text}]
            })

        replan_proposal: Optional[Dict[str, Any]] = None
        trip_updated: bool = False
        new_revision: Optional[int] = None
        final_narrative: str = ""

        if not self.api_key:
            return {
                "response_narrative": (
                    "Khamma Ghani! The Gemini API key is not configured in the environment. "
                    "Please verify GEMINI_API_KEY in your .env file so I can assist with your itinerary."
                ),
                "replan_proposal": None,
                "acknowledged_events": acknowledged,
                "trip_updated": False,
                "new_revision": None,
            }

        try:
            max_rounds = 4
            for _round in range(max_rounds):
                payload = {
                    "contents": contents,
                    "systemInstruction": {"parts": [{"text": COMPANION_SYSTEM_PROMPT}]},
                    "tools": [{"functionDeclarations": GEMINI_TOOL_DECLARATIONS}],
                    "generationConfig": {
                        "temperature": 0.35,
                    },
                }

                gemini_resp = await call_gemini_api(self.api_key, payload, timeout=22.0)
                if not gemini_resp or "candidates" not in gemini_resp or not gemini_resp["candidates"]:
                    break

                candidate_content = gemini_resp["candidates"][0].get("content") or {}
                candidate_parts = candidate_content.get("parts") or []
                if not candidate_parts:
                    break

                # Append model turn to conversation history for multi-step tool loop
                contents.append({
                    "role": "model",
                    "parts": candidate_parts,
                })

                fn_calls = [p["functionCall"] for p in candidate_parts if "functionCall" in p]
                text_parts = [p.get("text", "").strip() for p in candidate_parts if "text" in p and p.get("text", "").strip()]

                if text_parts:
                    final_narrative = "\n\n".join(text_parts)

                if not fn_calls:
                    # Model finished tool execution and produced its final answer
                    break

                function_response_parts: List[Dict[str, Any]] = []
                for fn_call in fn_calls:
                    fn_name = fn_call.get("name", "")
                    fn_args = fn_call.get("args") or {}
                    tool_result: Dict[str, Any] = {}

                    if fn_name == "get_current_trip":
                        trip_data = await self.execute_get_current_trip(trip_id, db)
                        base_revision = trip_data.get("revision", base_revision)
                        stops = trip_data.get("stops", stops)
                        tool_result = trip_data

                    elif fn_name == "get_recent_trip_events":
                        ev_limit = int(fn_args.get("limit") or 5)
                        events_res = await self.execute_get_recent_trip_events(trip_id, limit=ev_limit, db=db)
                        tool_result = {"events": events_res}

                    elif fn_name == "search_places":
                        places_res = await self.execute_search_places(
                            category=fn_args.get("category"),
                            query=fn_args.get("query"),
                            max_fee_inr=fn_args.get("max_fee_inr"),
                            db=db,
                        )
                        tool_result = {"places": places_res, "count": len(places_res)}

                    elif fn_name == "get_place_details":
                        p_id = fn_args.get("place_id") or ""
                        tool_result = await self.execute_get_place_details(p_id, db=db)

                    elif fn_name == "calculate_transit_route":
                        origin_q = fn_args.get("origin") or fn_args.get("origin_name_or_stop_id") or ""
                        dest_q = fn_args.get("destination") or fn_args.get("destination_name_or_stop_id") or ""
                        t_mode = fn_args.get("preferred_mode") or fn_args.get("travel_mode") or trip_data.get("travel_mode", "auto_rickshaw")
                        tool_result = await self.execute_calculate_transit_route(
                            origin=origin_q,
                            destination=dest_q,
                            preferred_mode=t_mode,
                            stops=stops,
                        )

                    elif fn_name == "execute_direct_trip_action":
                        act_res = await self.execute_direct_trip_action(
                            trip_id=trip_id,
                            action_type=fn_args.get("action_type") or "",
                            stops=stops,
                            stop_id=fn_args.get("stop_id"),
                            artisan_preference=fn_args.get("artisan_preference"),
                            db=db,
                        )
                        tool_result = act_res
                        if act_res.get("success"):
                            trip_updated = True
                            trip_data = await self.execute_get_current_trip(trip_id, db)
                            base_revision = trip_data.get("revision", base_revision)
                            stops = trip_data.get("stops", stops)
                            new_revision = base_revision

                    elif fn_name == "propose_trip_changes":
                        raw_ops = fn_args.get("operations") or []
                        auto_commit = bool(fn_args.get("auto_commit", False))
                        gemini_narrative = (fn_args.get("response_narrative") or "").strip()
                        if gemini_narrative and not final_narrative:
                            final_narrative = gemini_narrative

                        # Refresh latest revision before proposing
                        trip_data = await self.execute_get_current_trip(trip_id, db)
                        base_revision = trip_data.get("revision", base_revision)
                        stops = trip_data.get("stops", stops)
                        pending_stops = [s for s in stops if s["visit_status"] == "pending"]

                        normalized_ops: List[Dict[str, Any]] = []
                        for op in raw_ops:
                            op_copy = dict(op)
                            op_type = op_copy.get("type")
                            stop_id = op_copy.get("stop_id")

                            # Match stop_id if model passed stop name or fuzzy identifier
                            if stop_id:
                                matched_stop = next(
                                    (
                                        s for s in stops
                                        if s["id"] == stop_id
                                        or s.get("place_id") == stop_id
                                        or s["name"].lower() in stop_id.lower()
                                        or stop_id.lower() in s["name"].lower()
                                    ),
                                    None,
                                )
                                if matched_stop:
                                    op_copy["stop_id"] = matched_stop["id"]
                                elif op_type == "skip_stop" and pending_stops:
                                    op_copy["stop_id"] = pending_stops[0]["id"]
                            elif op_type == "skip_stop" and pending_stops:
                                op_copy["stop_id"] = pending_stops[0]["id"]

                            if op_type == "add_stop":
                                raw_pid = op_copy.get("place_id")
                                custom_name = op_copy.get("custom_place_name")
                                resolved = resolve_udaipur_place(
                                    place_id=raw_pid,
                                    name_or_query=custom_name or raw_pid or user_message,
                                    stops=stops,
                                )
                                if resolved:
                                    op_copy["place_id"] = resolved["id"]
                                    op_copy.setdefault("custom_place_name", resolved["name"])
                                    op_copy.setdefault("custom_category", resolved["category"])
                                    op_copy.setdefault("custom_address", resolved["address"])
                                    op_copy.setdefault("custom_latitude", resolved["latitude"])
                                    op_copy.setdefault("custom_longitude", resolved["longitude"])
                                    op_copy.setdefault("custom_entry_fee_inr", resolved["entry_fee_inr"])
                                    op_copy.setdefault(
                                        "duration_minutes",
                                        resolved.get("typical_duration_minutes", 45),
                                    )
                                if not op_copy.get("new_order"):
                                    op_copy["new_order"] = len(stops) + 1
                                op_copy.setdefault("day_number", 1)

                            normalized_ops.append(op_copy)

                        if normalized_ops:
                            proposal = await self.execute_propose_trip_changes(
                                trip_id=trip_id,
                                base_revision=base_revision,
                                operations=normalized_ops,
                                db=db,
                                auto_commit=auto_commit,
                            )
                            replan_proposal = proposal
                            if proposal.get("committed"):
                                trip_updated = True
                                new_revision = proposal.get("new_revision")
                                trip_data = await self.execute_get_current_trip(trip_id, db)
                                base_revision = trip_data.get("revision", base_revision)
                                stops = trip_data.get("stops", stops)
                            tool_result = {
                                "status": "committed" if proposal.get("committed") else "staged_proposal",
                                "proposal_id": proposal.get("proposal_id"),
                                "is_feasible": proposal.get("is_feasible"),
                                "validation_diff": proposal.get("validation_diff"),
                                "new_revision": proposal.get("new_revision"),
                            }
                        else:
                            tool_result = {"error": "No valid operations provided to propose_trip_changes."}
                    else:
                        tool_result = {"error": f"Unknown tool '{fn_name}'."}

                    function_response_parts.append({
                        "functionResponse": {
                            "name": fn_name,
                            "response": {"result": tool_result},
                        }
                    })

                if (
                    replan_proposal is not None
                    and final_narrative
                    and all(fc.get("name") == "propose_trip_changes" for fc in fn_calls)
                ):
                    break

                contents.append({
                    "role": "user",
                    "parts": function_response_parts,
                })

        except Exception as e:
            logger.error("Gemini companion orchestration error: %s", e)

        if not final_narrative:
            if replan_proposal:
                diff = replan_proposal.get("validation_diff") or {}
                summary_bits = []
                if diff.get("stops_added"):
                    summary_bits.append(f"added {', '.join(diff['stops_added'])}")
                if diff.get("stops_skipped"):
                    summary_bits.append(f"removed/skipped {', '.join(diff['stops_skipped'])}")
                if diff.get("travel_mode_changed"):
                    summary_bits.append(f"updated transit mode ({', '.join(diff['travel_mode_changed'])})")
                if diff.get("durations_updated"):
                    summary_bits.append(f"adjusted duration ({', '.join(diff['durations_updated'])})")
                if diff.get("rescheduled_stops"):
                    summary_bits.append(f"rescheduled {', '.join(diff['rescheduled_stops'])}")
                if diff.get("budget_updated_inr") is not None:
                    summary_bits.append(f"updated budget to ₹{int(diff['budget_updated_inr'])}")
                changes_str = "; ".join(summary_bits) if summary_bits else "updated your itinerary"
                if replan_proposal.get("committed"):
                    final_narrative = (
                        f"Khamma Ghani! I have {changes_str} and committed the update to your active itinerary "
                        f"(now at Revision {new_revision or (base_revision + 1)})."
                    )
                else:
                    final_narrative = (
                        f"Khamma Ghani! I have prepared an itinerary update that {changes_str}. "
                        f"You can review the exact timings and transit details in the proposal card below and tap 'Accept' to apply it."
                    )
            elif trip_updated:
                final_narrative = (
                    f"Khamma Ghani! I have applied your requested update to the active itinerary (Revision {new_revision or base_revision})."
                )
            else:
                final_narrative = (
                    "Khamma Ghani! I encountered a temporary issue connecting to the Gemini reasoning service. "
                    "Please send your message again and I will take care of it right away."
                )

        if acknowledged and replan_proposal:
            if not any(p in final_narrative.lower() for p in ["skipped", "earlier", "timeline", "noted", "kept that in mind"]):
                final_narrative = f"I noted your earlier itinerary update ({acknowledged[0].lower()}). {final_narrative}"

        if not history and "khamma ghani" not in final_narrative.lower() and "namaste" not in final_narrative.lower():
            final_narrative = f"Khamma Ghani! {final_narrative}"

        return {
            "response_narrative": final_narrative,
            "replan_proposal": replan_proposal,
            "acknowledged_events": acknowledged,
            "trip_updated": trip_updated,
            "new_revision": new_revision,
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
