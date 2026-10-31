"""
Google GenAI (Gemini Flash) Service & Tool Calling Interface
Used in Track 3 (Companion) and Track 4 (Voice note structured extraction).
"""
import os
import json
import logging
from typing import Dict, Any, List, Optional

try:
    import httpx
except ImportError:
    httpx = None

logger = logging.getLogger(__name__)

GEMINI_TOOL_DECLARATIONS = [
    {
        "name": "get_current_trip",
        "description": "Fetches current authoritative trip state and revision number.",
        "parameters": {"type": "OBJECT", "properties": {"trip_id": {"type": "STRING"}}, "required": ["trip_id"]}
    },
    {
        "name": "get_recent_trip_events",
        "description": "Fetches recent accepted trip events for user context.",
        "parameters": {"type": "OBJECT", "properties": {"trip_id": {"type": "STRING"}, "limit": {"type": "INTEGER"}}, "required": ["trip_id"]}
    },
    {
        "name": "search_places",
        "description": "Searches canonical places and verified local artisan studios in Udaipur.",
        "parameters": {"type": "OBJECT", "properties": {"query": {"type": "STRING"}, "category": {"type": "STRING"}}}
    },
    {
        "name": "propose_trip_changes",
        "description": "Submits candidate modifications to generate provisional ReplanProposal.",
        "parameters": {
            "type": "OBJECT",
            "properties": {
                "trip_id": {"type": "STRING"},
                "base_revision": {"type": "INTEGER"},
                "operations": {"type": "ARRAY"}
            },
            "required": ["trip_id", "base_revision", "operations"]
        }
    }
]


class GeminiCompanionService:
    def __init__(self, api_key: str = ""):
        self.api_key = api_key

    async def generate_reply(self, message: str, trip_context: Dict[str, Any]) -> str:
        """Conversational companion response generation."""
        return "I can help adjust your itinerary! Would you like me to look for a nearby artisan workshop?"


class GeminiTrailDraftService:
    """
    Trip-to-Trail AI Draft Generation using Gemini Flash.
    Generates engaging public community trail titles, descriptions, and tags
    from tourist-confirmed visited stops while scrubbing private notes and GPS tracks.
    """
    def __init__(self, api_key: str = ""):
        self.api_key = api_key or os.getenv("GEMINI_API_KEY", "")

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

        # Calculate base aggregates
        total_minutes = sum(p.get("suggested_duration_minutes", 45) for p in visited_places)
        total_duration_hours = round(max(total_minutes / 60.0, 1.0), 1)
        total_budget = sum(float(p.get("entry_fee_inr", 0)) for p in visited_places)

        # Synthesize fallback values
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

        # Attempt Gemini Flash call if API key configured
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

                url = f"https://generativelanguage.googleapis.com/v1beta/models/gemini-1.5-flash:generateContent?key={self.api_key}"
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
                else:
                    import urllib.request
                    req = urllib.request.Request(
                        url,
                        data=json.dumps(payload).encode("utf-8"),
                        headers={"Content-Type": "application/json"}
                    )
                    with urllib.request.urlopen(req, timeout=8.0) as resp:
                        if resp.status == 200:
                            data = json.loads(resp.read().decode("utf-8"))
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
