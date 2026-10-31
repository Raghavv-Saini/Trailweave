"""
Google GenAI (Gemini Flash) Service & Tool Calling Interface
Used in Track 1 (Trip-to-Trail), Track 3 (Companion), and Track 4 (Voice note structured extraction).
Spec: docs/API_SPEC.md §1.4 & §2, ADR 0004, ADR 0005, ADR 0008
Ticket: docs/tickets/track-3-active-trip-companion/09-ai-companion-push-notifications.md
"""
import os
import json
import uuid
import logging
from datetime import datetime, timezone, timedelta, time
from typing import Dict, Any, List, Optional

try:
    import httpx
except ImportError:
    httpx = None

from sqlalchemy.ext.asyncio import AsyncSession
from sqlalchemy import text

from app.core.config import settings
from app.engine.replan import UnifiedMutationEngine, PLACE_IMAGE_MAP, DEFAULT_PLACE_IMAGE
from app.schemas.replan import ReplanOperation, ValidationDiff
from app.services.planner import StartLocation

logger = logging.getLogger(__name__)

COMPANION_SYSTEM_PROMPT = """
You are the TrailWeave AI Travel Companion, a warm, knowledgeable, and cultured travel connoisseur intimately familiar with Udaipur ("The Cultured Local Friend").
You speak with cultural warmth and genuine Rajasthani hospitality (often greeting with "Khamma Ghani" or "Namaste").
You understand the topography of Udaipur: narrow pedestrian alleys around Jagdish Chowk, Gangaur Ghat, and Bhatiyani Chohatta, temple customs (shoe drop-offs, conservative dress, prayer times), afternoon heat management, scenic sunset lighting over Lake Pichola, and verified local artisan traditions (Mewar miniature painting, Molela terracotta, and Pichwai art).

CRITICAL OPERATIONAL RULES:
1. Always maintain awareness of the traveler's active trip state and current revision number.
2. Explicitly acknowledge prior manual user edits and events (e.g., "I see you skipped the museum earlier...", "Now that you've wrapped up at City Palace...") before proposing any new itinerary changes.
3. You never execute unvalidated or arbitrary database mutations. When the traveler requests changes ("I'm tired, can we skip the fort and find a rooftop tea shop nearby?"), you MUST execute typed tool calls:
   - `get_current_trip`: Inspect current authoritative revision, pending stops, and budget.
   - `get_recent_trip_events`: Review recent manual actions (skips, visits, checkouts) to acknowledge them.
   - `search_places`: Look up nearby verified Udaipur venues, rooftop cafes, or artisan workshops.
   - `get_place_details`: Verify venue hours, workshop fees, and address.
   - `propose_trip_changes`: Dispatch candidate operations to the deterministic Trip Engine to generate a provisional ReplanProposal card for tourist acceptance.
4. When proposing alterations, explain your cultural and logistical reasoning warmly, showing how the changes respect their pace, budget, and local lighting.
"""

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

    async def execute_get_current_trip(self, trip_id: str, db: AsyncSession) -> Dict[str, Any]:
        """Fetch authoritative trip state, current revision, and active stops."""
        trip_res = await db.execute(
            text("SELECT * FROM trips WHERE id = :id"),
            {"id": trip_id}
        )
        trip = trip_res.fetchone()
        if not trip:
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

    async def execute_get_recent_trip_events(self, trip_id: str, limit: int, db: AsyncSession) -> List[Dict[str, Any]]:
        """Fetch recent trip events (skips, visits, checkouts, replans)."""
        res = await db.execute(
            text("SELECT * FROM trip_events WHERE trip_id = :id ORDER BY created_at DESC LIMIT :limit"),
            {"id": trip_id, "limit": min(max(limit,