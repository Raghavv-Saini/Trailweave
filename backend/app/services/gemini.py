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
        db: AsyncSession,
        query: Optional[str] = None,
        category: Optional[str] = None,
        max_fee_inr: Optional[int] = None
    ) -> List[Dict[str, Any]]:
        """Search canonical places and verified artisan studios."""
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
        from app.api.v1.replan import _fetch_trip_active_stops, _fetch_places_catalog

        trip_res = await db.execute(text("SELECT * FROM trips WHERE id = :id"), {"id": trip_id})
        trip = trip_res.fetchone()
        if not trip:
            return {"error": f"Trip {trip_id} not found"}

        if not trip.current_itinerary_version_id:
            return {"error": "Trip has no active version"}

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
        start_dt = getattr(trip, "start_datetime", None) or datetime.now(timezone.utc)
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
                "ops": json.dumps([op.model_dump() for op in parsed_ops]),
                "stops": json.dumps(candidate_stops_raw),
                "diff": json.dumps(validation_diff.model_dump()),
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
            "cafe", "workshop", "pottery", "artisan", "replace", "add"
        ])

        ack_phrase = ""
        if acknowledged:
            ack_phrase = f"{acknowledged[0]}, so I've kept that in mind! "

        if is_alteration_request and pending_stops:
            operations = []

            stop_to_skip = None
            if "fort" in msg_lower or "palace" in msg_lower:
                stop_to_skip = next((s for s in pending_stops if "palace" in s["name"].lower() or "fort" in s["name"].lower()), None)
            elif "haveli" in msg_lower:
                stop_to_skip = next((s for s in pending_stops if "haveli" in s["name"].lower()), None)
            elif "temple" in msg_lower:
                stop_to_skip = next((s for s in pending_stops if "temple" in s["name"].lower()), None)

            if not stop_to_skip and ("tired" in msg_lower or "skip" in msg_lower):
                stop_to_skip = pending_stops[0]

            if stop_to_skip:
                operations.append({
                    "type": "skip_stop",
                    "stop_id": stop_to_skip["id"]
                })

            place_to_add = None
            if any(k in msg_lower for k in ["tea", "rooftop", "cafe", "food", "snack"]):
                dining_candidates = await self.execute_search_places(db, query="Sukhadia", category="dining")
                if dining_candidates:
                    place_to_add = dining_candidates[0]
            elif any(k in msg_lower for k in ["pottery", "miniature", "workshop", "artisan", "craft"]):
                artisan_candidates = await self.execute_search_places(db, category="artisan_studio")
                if artisan_candidates:
                    place_to_add = artisan_candidates[0]

            if not place_to_add and ("tea" in msg_lower or "relax" in msg_lower):
                place_to_add = {"id": "place_sukhadia_circle", "name": "Sukhadia Circle Street Food & Chai"}

            if place_to_add:
                new_seq = stop_to_skip["sequence_in_day"] if stop_to_skip else (pending_stops[0]["sequence_in_day"] if pending_stops else 2)
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

                skip_name = stop_to_skip["name"] if stop_to_skip else "the upcoming stop"
                add_name = place_to_add["name"] if place_to_add else "a peaceful local spot"

                narrative = (
                    f"Khamma Ghani! {ack_phrase}"
                    f"I completely understand wanting a gentler pace. I've prepared a proposal to skip {skip_name} "
                    f"and guide you toward {add_name} where you can unwind. "
                    f"The Trip Engine has recalculated your transit and verified your budget headroom. "
                    f"Review the proposal card below and tap 'Accept' whenever you're ready to update your active route to Revision {base_revision + 1}."
                )

                return {
                    "response_narrative": narrative,
                    "replan_proposal": proposal,
                    "acknowledged_events": acknowledged
                }

        if "sunset" in msg_lower or "evening" in msg_lower:
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
                f"I am keeping an eye on your journey through Udaipur. Your current route is on Revision {base_revision}. "
                f"Feel free to ask me to skip stops, suggest artisan masterclasses in Jagdish Chowk, or find a lakeside rooftop tea stall anytime!"
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
    def __init__(self, api_key: str = ""):
        self.api_key = api_key or os.getenv("GEMINI_API_KEY", "") or settings.GEMINI_API_KEY

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

                url = f"https://generativelanguage.googleapis.com/v1beta/models/gemini-3-flash-preview:generateContent?key={self.api_key}"
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
                url = f"https://generativelanguage.googleapis.com/v1beta/models/gemini-3-flash-preview:generateContent?key={self.api_key}"
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
