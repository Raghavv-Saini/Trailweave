"""
Google GenAI (Gemini Flash) Service & Tool Calling Interface
Used in Track 3 (Companion) and Track 4 (Voice note structured extraction).
"""
from typing import Dict, Any, List

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
