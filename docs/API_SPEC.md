# TrailWeave: API Specification & Gemini Tool Contracts

**Status:** Authoritative API & Integration Specification  
**Protocols:** REST (JSON over HTTPS) + Google GenAI Tool Calling + Google Cloud Speech-to-Text (`hi-IN`)  
**Related ADRs:** [ADR 0001](adr/0001-trailweave-architecture.md), [ADR 0004](adr/0004-ai-travel-companion-and-smart-geofencing.md), [ADR 0005](adr/0005-unified-trip-engine-and-active-companion.md), [ADR 0006](adr/0006-artisan-workshop-offerings-and-tourist-preferences.md), [ADR 0007](adr/0007-deterministic-itinerary-planner-and-transit-routing.md), [ADR 0008](adr/0008-unified-mutation-engine-and-replan-lifecycle.md), [ADR 0009](adr/0009-artisan-smart-recommendation-scorer-and-detour-engine.md), [ADR 0010](adr/0010-web-voice-artisan-onboarding-and-catalogue.md)

---

## 1. REST Endpoints Overview

All protected endpoints require a Supabase Auth Bearer token: `Authorization: Bearer <jwt_token>`.

### 1.1 Discovery & Trails

#### `GET /api/trails`
Browse community trails with filtering.
- **Query Parameters**:
  - `duration_type` (optional): `single_day` | `multi_day`
  - `max_budget` (optional): numeric (in INR)
  - `tags` (optional): comma-separated string (e.g. `heritage,food,crafts`)
  - `is_featured` (optional): boolean
- **Response `200 OK`**:
```json
[
  {
    "id": "trail_01",
    "title": "Udaipur Royal Palaces & Artisan Trail",
    "author_name": "Arjun Sharma",
    "duration_type": "single_day",
    "total_duration_hours": 6.5,
    "estimated_cost_inr": 1250,
    "tags": ["heritage", "artisan", "walking"],
    "is_experienced": true,
    "stops_count": 5
  }
]
```

#### `GET /api/trails/{id}`
Returns complete details and relative stops for a community trail.
- **Response `200 OK`**: Includes trail metadata, author attribution, and array of stops sorted by `(day_number, sequence_in_day)` with `suggested_duration_minutes` and `traveler_tip`.

---

### 1.2 Artisan Studio Directory

#### `GET /api/artisans`
Browse verified Udaipur artisan studios.
- **Query Parameters**:
  - `has_workshop` (optional): boolean (filter for hands-on masterclasses)
  - `max_fee` (optional): numeric (max workshop fee in INR)
  - `craft_type` (optional): string (`miniature_painting`, `pottery`, etc.)
- **Response `200 OK`**:
```json
[
  {
    "id": "artisan_01",
    "artisan_name": "Master Mohanlal Sharma",
    "craft_type": "Pichwai & Miniature Painting",
    "place_id": "place_miniature_studio",
    "address": "14 Jagdish Chowk, Old City, Udaipur",
    "has_workshop": true,
    "workshop_fee_inr": 300,
    "workshop_duration_minutes": 45,
    "workshop_description": "Learn 400-year-old squirrel-hair brush techniques on handmade paper."
  }
]
```

#### `GET /api/artisans/{id}`
Fetches full artisan studio profile, photo gallery, and workshop offerings.

#### `GET /api/trips/{trip_id}/recommendations/artisans`
Scores and discovers nearby verified Udaipur artisan studios within a 15-minute detour buffer along the tourist's active route, respecting remaining trip budget, venue operating hours, and experience preference.
- **Query Parameters**:
  - `preference` (optional): string (`workshops`, `store_visits`, `both`, default `both`)
  - `max_detour_minutes` (optional): integer (max allowed detour in minutes, default `15`)
  - `travel_mode` (optional): string (`walking`, `auto_rickshaw`, `cab`)
- **Response `200 OK`**:
```json
{
  "trip_id": "trip_demo_udaipur",
  "preference": "both",
  "travel_mode": "auto_rickshaw",
  "remaining_budget_inr": 1070.0,
  "total_candidates_evaluated": 4,
  "recommendations": [
    {
      "artisan_id": "artisan_pottery",
      "place_id": "place_pottery_studio",
      "artisan_name": "Master Kavita Kumhar",
      "craft_type": "Terracotta Pottery & Clay Sculpting",
      "offering_type": "workshop",
      "fee_inr": 250.0,
      "duration_minutes": 45,
      "detour_minutes": 5,
      "optimal_insert_order": 2,
      "rationale": "Master Kavita Kumhar: 5 min detour, ₹250 workshop fee, open until 7:30 PM, fits under your ₹1,070 budget",
      "latitude": 24.5815,
      "longitude": 73.682,
      "address": "22 Chandpole Ghat Road, Old City, Udaipur, Rajasthan 313001",
      "image_url": "https://images.unsplash.com/photo-1565193566173-7a0ee3dbe261?auto=format&fit=crop&w=900&q=80",
      "has_workshop": true
    }
  ]
}
```

#### `POST /api/trips/recommendations/artisans`
Transient recommendation scoring for candidate routes or baskets in the Trip Builder before a trip is persisted.
- **Request Body**:
```json
{
  "stops": [
    {"place_id": "place_city_palace", "latitude": 24.5764, "longitude": 73.6835, "entry_fee_inr": 330}
  ],
  "budget_inr": 2000,
  "travel_mode": "auto_rickshaw",
  "preference": "workshops",
  "max_detour_minutes": 15
}
```
- **Response `200 OK`**: Same `ArtisanRecommendationResponse` schema.

---

### 1.3 Personal Trip & Active Companion Operations

#### `POST /api/trips`
Plans and creates an optimized personal itinerary from selected places or a community trail using the Deterministic Itinerary Planner. Validates opening/closing hours, computes transit durations (via Google Distance Matrix API when `GOOGLE_MAPS_API_KEY` is set, with deterministic Haversine fallback), enforces hard budget caps, expands relative durations into concrete `planned_arrival` and `planned_departure` timestamps across single or multiple days, and persists `trips` (`revision = 1`), `itinerary_versions` (`version_number = 1`), and `trip_stops`.
- **Request Body (`TravelRequest`)**:
```json
{
  "user_id": "user_tourist_01",
  "title": "My Udaipur Cultural Journey",
  "destination": "Udaipur",
  "start_datetime": "2026-11-01T09:00:00+05:30",
  "total_days": 1,
  "budget_inr": 2000,
  "budget_mode": "total",
  "travel_mode": "auto_rickshaw",
  "artisan_preference": "workshop",
  "start_location": {
    "name": "Hotel Swaroop Vilas",
    "latitude": 24.5854,
    "longitude": 73.6812
  },
  "place_ids": ["place_city_palace", "place_mohanlal_studio", "place_jagdish_temple"],
  "stops": [],
  "source_trail_id": null,
  "optimize_route": true,
  "allow_warnings": false
}
```
- **Response `201 Created`**: Returns the authoritative `TripResponse` (`revision = 1`, `active_version.version_number = 1`).
- **Response `422 Unprocessable Entity` (Infeasible Schedule)**: Returned when budget or venue closing hours are violated and `allow_warnings = false`:
```json
{
  "detail": {
    "message": "Schedule violates budget or venue operating hour constraints.",
    "is_feasible": false,
    "budget_exceeded": true,
    "total_estimated_cost_inr": 630.0,
    "budget_limit_inr": 400.0,
    "closing_hour_conflicts": []
  }
}
```

#### `GET /api/trips/{trip_id}`
Load the authoritative current state of a personal trip.
- **Response `200 OK`**:
```json
{
  "id": "trip_abc123",
  "title": "My Udaipur Cultural Journey",
  "revision": 2,
  "status": "in_progress",
  "budget_inr": 2000,
  "artisan_preference": "both",
  "active_version": {
    "version_number": 2,
    "total_estimated_cost_inr": 1450,
    "total_estimated_duration_minutes": 360,
    "stops": [
      {
        "id": "stop_1",
        "trip_id": "trip_abc123",
        "place_id": "place_city_palace",
        "name": "City Palace Udaipur",
        "address": "Old City, Udaipur, Rajasthan 313001",
        "latitude": 24.5764,
        "longitude": 73.6835,
        "category": "heritage",
        "entry_fee_inr": 330,
        "image_url": "https://images.unsplash.com/photo-1599661046289-e31897846e41?auto=format&fit=crop&w=900&q=80",
        "day_number": 1,
        "sequence_in_day": 1,
        "planned_arrival": "2026-10-31T09:30:00Z",
        "planned_departure": "2026-10-31T11:30:00Z",
        "suggested_duration_minutes": 120,
        "actual_duration_minutes": 120,
        "visit_status": "visited",
        "is_pinned": false
      },
      {
        "id": "stop_2",
        "trip_id": "trip_abc123",
        "place_id": "place_mohanlal_studio",
        "name": "Master Mohanlal Miniature Art Studio",
        "address": "14 Jagdish Chowk, Old City, Udaipur, Rajasthan 313001",
        "latitude": 24.5796,
        "longitude": 73.6844,
        "category": "artisan_studio",
        "entry_fee_inr": 0,
        "image_url": "https://images.unsplash.com/photo-1582555172866-f73bb12a2ab3?auto=format&fit=crop&w=900&q=80",
        "day_number": 1,
        "sequence_in_day": 2,
        "planned_arrival": "2026-10-31T11:45:00Z",
        "planned_departure": "2026-10-31T12:30:00Z",
        "suggested_duration_minutes": 45,
        "actual_duration_minutes": null,
        "visit_status": "pending",
        "is_pinned": true
      }
    ]
  }
}
```

#### `GET /api/trips/{trip_id}/events`
Fetches the append-only event log for UI audit trail and fresh Gemini context injection.
- **Response `200 OK`**: Array of `trip_events` (`actor`, `source`, `event_type`, `resulting_revision`, `payload`, `created_at`).

#### `POST /api/trips/{trip_id}/stops/{stop_id}/visit`
Records an arrival check-in (triggered by proximity geofence or 1-tap manual fallback).
- **Request Body**:
```json
{
  "checkin_method": "manual_fallback", // or "geofence_proximity"
  "arrival_timestamp": "2026-10-31T09:35:12Z"
}
```
- **Response `200 OK`**: Updates `visit_status = 'visited'`, appends event to `trip_events`.

#### `POST /api/trips/{trip_id}/stops/{stop_id}/checkout`
Records a departure checkout (triggered by tourist tap or 20-min grace buffer auto-checkout).
- **Request Body**:
```json
{
  "checkout_method": "manual_tap", // or "grace_buffer_timeout"
  "departure_timestamp": "2026-10-31T11:30:00Z"
}
```
- **Response `200 OK`**: Updates `actual_duration_minutes`, appends `stop_checkout` event to `trip_events`, schedules AI transition notification, updates remaining timeline.

---

### 1.4 Unified Replan & Concurrency Control

#### `POST /api/trips/{trip_id}/replan-preview`
Submits candidate modifications from either the manual UI editor or the AI agent. Evaluates feasibility and returns a provisional proposal with cost/time diffs without altering the active trip.
- **Request Body**:
```json
{
  "base_revision": 2,
  "requested_by": "manual_editor",
  "operations": [
    {
      "type": "skip_stop",
      "stop_id": "stop_museum"
    },
    {
      "type": "add_stop",
      "place_id": "place_pottery_workshop",
      "new_order": 3
    }
  ]
}
```
- **Response `200 OK`**:
```json
{
  "proposal_id": "prop_9981",
  "base_revision": 2,
  "is_feasible": true,
  "validation_diff": {
    "cost_delta_inr": -150,
    "duration_delta_minutes": -20,
    "stops_added": ["place_pottery_workshop"],
    "stops_skipped": ["stop_museum"],
    "closing_hour_conflicts": []
  },
  "candidate_stops": [ ... ],
  "expires_at": "2026-10-31T12:00:00Z"
}
```

#### `POST /api/trips/{trip_id}/replan-accept`
Commits an approved proposal. Enforces strict optimistic concurrency locking.
- **Request Body**:
```json
{
  "proposal_id": "prop_9981",
  "expected_revision": 2
}
```
- **Response `200 OK`**:
```json
{
  "success": true,
  "new_revision": 3,
  "message": "Itinerary updated successfully"
}
```
- **Response `409 Conflict` (Optimistic Concurrency Failure)**:
```json
{
  "detail": "Revision mismatch. Expected revision 2, but trip has already progressed to revision 3. Please refresh and review latest plan.",
  "current_revision": 3
}
```

#### `POST /api/trips/{trip_id}/assistant/messages`
Sends conversational guidance, transit route queries, or itinerary alteration requests to the Gemini companion (`gemini-3-flash-preview` with automatic fallback to `gemini-3.5-flash` / `gemini-flash-lite-latest`). Supports multi-turn conversation history (`history`) and client trip state sync (`client_trip_state`).
- **Request Body**:
```json
{
  "message": "I need to travel from City Palace to Bagore Ki Haveli by auto",
  "history": [
    { "role": "user", "text": "What is my next stop?" },
    { "role": "ai", "text": "Khamma Ghani! Your next stop is Jagdish Temple at 12:40 PM." }
  ],
  "client_trip_state": {
    "title": "Udaipur Living Heritage & Crafts Walk",
    "revision": 2,
    "stops": []
  }
}
```
- **Response `200 OK`**: Returns AI response narrative, an optional embedded interactive `ReplanProposalCard` (or auto-committed revision update when confirming a prior proposal), and `trip_updated` / `new_revision` flags.
```json
{
  "response_narrative": "Khamma Ghani! Traveling from City Palace to Bagore Ki Haveli by auto-rickshaw covers 1.4 km and takes about 7 minutes (estimated fare ₹50). Would you like me to update this leg in your itinerary to auto-rickshaw and adjust your arrival timings?",
  "replan_proposal": null,
  "acknowledged_events": [],
  "trip_updated": false,
  "new_revision": null
}
```

#### `POST /api/trips/{trip_id}/draft-trail-content`
Prompts Gemini Flash to compose an engaging trail title, markdown overview, estimated budget, and relevant tags from confirmed visited stops (Trip-to-Trail AI draft).
- **Request Body**:
```json
{
  "include_stop_ids": ["stop_1", "stop_2", "stop_4"],
  "vibe_hint": "heritage walk"
}
```
- **Response `200 OK`**:
```json
{
  "title": "Afternoon Heritage & Lakeside Crafts Walk",
  "description": "Explored City Palace and a hidden miniature art masterclass in Jagdish Chowk. Recommended for history lovers and art enthusiasts looking for an authentic Udaipur afternoon.",
  "tags": ["heritage", "artisan", "lake"],
  "estimated_budget_inr": 380,
  "total_duration_hours": 3.5
}
```

#### `POST /api/trips/{trip_id}/publish-trail`
Converts a finished trip into a publicly visible Community Trail (Trip-to-Trail). Creates `community_trails` and child `community_trail_stops` records with relative durations, scrubbing private notes and private start locations. Marks trip as `completed`.
- **Request Body**:
```json
{
  "title": "Afternoon Heritage & Lakeside Crafts Walk",
  "description": "Explored City Palace and a hidden miniature art masterclass in Jagdish Chowk.",
  "include_stop_ids": ["stop_1", "stop_2", "stop_4"],
  "exclude_private_notes": true,
  "tags": ["heritage", "artisan", "lake"],
  "visibility": "public"
}
```
- **Response `201 Created`**: Returns newly created `community_trails` record including child `stops`.

---

### 1.5 Artisan Hindi Voice Onboarding, Self-Service Catalogue & Admin Curation

#### `POST /api/artisans/onboard`
Ingests a Hindi voice submission from `/artisans/onboard` along with the artisan's phone number, a 4-digit numeric PIN (`4-अंकों का पिन`), optional GPS coordinates, and optional self-uploaded craft/artifact photos (`catalogue_images`). Runs Google Cloud Speech-to-Text V2 (`hi-IN`) transcription (immediately discarding raw audio bytes), prompts Gemini Flash to generate an **English Admin Brief**, a **Missing Info Checklist**, and pre-filled structured fields, and persists an `artisan_drafts` record.
- **Request Body**:
```json
{
  "phone_number": "+919829099887",
  "pin": "1234",
  "audio_base64": null,
  "transcript_hint": "नमस्ते, मैं शंकर लाल कुम्हार हूँ। मेरी टेराकोटा पॉटरी की दुकान हाथीपोल में है। हम 45 मिनट की वर्कशॉप कराते हैं जिसकी फीस 250 रुपये है।",
  "text_message": null,
  "latitude": 24.584,
  "longitude": 73.6865,
  "catalogue_images": [
    "https://images.unsplash.com/photo-1565193566173-7a0ee3dbe261?auto=format&fit=crop&w=900&q=80"
  ]
}
```
- **Response `201 Created` (`ArtisanPortalProfileResponse`)**:
```json
{
  "id": "draft_abc123",
  "source_type": "draft",
  "approval_status": "draft",
  "artisan_name": "Shankar Lal Kumhar",
  "craft_type": "Terracotta Pottery & Clay Sculpting",
  "phone_number": "+919829099887",
  "address": "Hathi Pole Bazaar, Old City, Udaipur",
  "has_workshop": true,
  "workshop_fee_inr": 250.0,
  "workshop_duration_minutes": 45,
  "workshop_description": "Hands-on 45-minute terracotta pottery workshop.",
  "admin_brief": "Artisan Shankar Lal Kumhar runs a Terracotta Pottery workshop in Hathipole Bazaar offering a 45-minute hands-on session for ₹250.",
  "missing_info_checklist": [
    "Confirm daily opening and closing hours"
  ],
  "raw_transcript": "नमस्ते, मैं शंकर लाल कुम्हार हूँ। मेरी टेराकोटा पॉटरी की दुकान हाथीपोल में है। हम 45 मिनट की वर्कशॉप कराते हैं जिसकी फीस 250 रुपये है।",
  "catalogue_images": [
    "https://images.unsplash.com/photo-1565193566173-7a0ee3dbe261?auto=format&fit=crop&w=900&q=80"
  ]
}
```

#### `POST /api/artisans/login`
Authenticates a returning artisan using their `phone_number` and 4-digit `pin` against either approved `artisans` or pending `artisan_drafts`, returning their studio approval status and `catalogue_images`.
- **Request Body**:
```json
{
  "phone_number": "+919829099887",
  "pin": "1234"
}
```
- **Response `200 OK`**: Returns `ArtisanPortalProfileResponse`.

#### `POST /api/artisans/me/catalogue`
Appends one or more craft/artifact photos to the authenticated artisan's `catalogue_images` array.
- **Request Body**:
```json
{
  "phone_number": "+919829099887",
  "pin": "1234",
  "image_urls": [
    "https://images.unsplash.com/photo-1578749556568-bc2c40e68b61?auto=format&fit=crop&w=900&q=80"
  ]
}
```
- **Response `200 OK`**: Returns updated `ArtisanPortalProfileResponse`.

#### `DELETE /api/artisans/me/catalogue`
Removes a specified craft/artifact photo from the authenticated artisan's `catalogue_images` array.

#### `GET /api/admin/artisan-drafts`
Returns all incoming voice onboarding drafts with `sender_phone`, `raw_transcript`, and `extracted_data` (`admin_brief`, `missing_info_checklist`, pre-filled studio fields, and `catalogue_images`).

#### `POST /api/admin/artisan-drafts/{draft_id}/approve`
Atomically promotes a voice draft into canonical `places` (`category = 'artisan_studio'`) and `artisans` (`profile_status = 'approved'`), carrying over the artisan's phone number, PIN hash, and uploaded `catalogue_images`.

#### `POST /api/admin/artisan-drafts/{draft_id}/reject`
Marks an `artisan_draft` as `rejected`.

#### `GET /api/admin/artisans` & `PATCH /api/admin/artisans/{artisan_id}`
Returns and updates complete operational and contact information for all onboarded artisans (including `phone_number` for 1-tap `tel:` calling, coordinates, opening/closing hours, workshop pricing, bio, status, and `catalogue_images`).

#### `GET /api/admin/trails`, `PATCH /api/admin/trails/{trail_id}/feature` & `POST /api/admin/places`
Admin curation endpoints for featuring community trails and importing canonical places into `places`.

---

## 2. Native Gemini Function Calling Tool Contracts

The Gemini assistant is conditioned as a "Cultured Local Companion" and strictly restricted to the following backend tool declarations. It cannot execute arbitrary database mutations.

```json
[
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
    "description": "Fetches the recent accepted trip events (manual skips, additions, reorders) so the AI can acknowledge previous user actions.",
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
          "description": "Search term, e.g. 'pottery', 'miniature painting', 'rooftop tea'."
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
    "name": "calculate_transit_route",
    "description": "Calculates live distance, transit duration (via Google Routes API v2 or Haversine road-factor fallback), and estimated fare in INR between two stops or Udaipur places for a given travel mode ('walking', 'auto_rickshaw', or 'cab').",
    "parameters": {
      "type": "OBJECT",
      "properties": {
        "origin_name_or_stop_id": {
          "type": "STRING",
          "description": "Origin stop ID or place name (e.g. 'City Palace')."
        },
        "destination_name_or_stop_id": {
          "type": "STRING",
          "description": "Destination stop ID or place name (e.g. 'Bagore Ki Haveli')."
        },
        "travel_mode": {
          "type": "STRING",
          "enum": ["walking", "auto_rickshaw", "cab"],
          "description": "Travel mode to evaluate."
        }
      },
      "required": ["origin_name_or_stop_id", "destination_name_or_stop_id", "travel_mode"]
    }
  },
  {
    "name": "propose_trip_changes",
    "description": "Submits candidate itinerary modifications to the deterministic Trip Engine and generates a provisional ReplanProposal for tourist preview and approval (or commits immediately when auto_commit=true after explicit user confirmation).",
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
              "place_id": {
                "type": "STRING",
                "description": "Canonical or Udaipur gazetteer place ID for add_stop operations."
              },
              "custom_place_name": {
                "type": "STRING",
                "description": "Display name when adding a custom or non-canonical Udaipur venue."
              },
              "stop_id": {
                "type": "STRING",
                "description": "Existing stop ID for skip, remove, pin, duration, reschedule, or leg-specific travel mode operations."
              },
              "new_order": {
                "type": "INTEGER",
                "description": "Target sequence index within the day."
              },
              "travel_mode": {
                "type": "STRING",
                "enum": ["walking", "auto_rickshaw", "cab"],
                "description": "New travel mode for update_travel_mode."
              },
              "duration_minutes": {
                "type": "INTEGER",
                "description": "New duration in minutes for update_stop_duration."
              },
              "planned_arrival_time": {
                "type": "STRING",
                "description": "Target arrival time in HH:MM (24h) or ISO-8601 format for reschedule_stop."
              },
              "budget_inr": {
                "type": "NUMBER",
                "description": "Updated trip budget in INR for update_budget."
              }
            },
            "required": ["type"]
          }
        },
        "auto_commit": {
          "type": "BOOLEAN",
          "description": "Set to true when the user is explicitly confirming a previously discussed change or requesting an immediate direct edit."
        },
        "response_narrative": {
          "type": "STRING",
          "description": "Clear, helpful explanation for the traveler."
        }
      },
      "required": ["operations", "response_narrative"]
    }
  },
  {
    "name": "execute_direct_trip_action",
    "description": "Directly marks a stop as visited/checked-in, marks a stop as checked-out, or updates trip budget/artisan preferences when requested by the traveler in chat.",
    "parameters": {
      "type": "OBJECT",
      "properties": {
        "action_type": {
          "type": "STRING",
          "enum": ["mark_visited", "mark_checkout", "update_budget", "update_artisan_preference"],
          "description": "Direct trip status or preference update to perform."
        },
        "stop_id": {
          "type": "STRING",
          "description": "Target stop ID or stop name for mark_visited or mark_checkout."
        },
        "budget_inr": {
          "type": "NUMBER",
          "description": "New trip budget in INR."
        },
        "artisan_preference": {
          "type": "STRING",
          "enum": ["workshop", "shopping", "both"],
          "description": "New artisan preference."
        }
      },
      "required": ["action_type"]
    }
  }
]
```

---

### 1.7 Tourist & Admin Authentication & Superuser Team Management (ADR 0011)

#### `POST /api/v1/auth/signup` (and `/api/auth/signup`)
Registers a new Tourist account with email and password and returns an access token.
- **Request Body:**
```json
{
  "email": "tourist@example.com",
  "password": "securepassword123",
  "full_name": "Aarav Mehta"
}
```
- **Response (`201 Created`):**
```json
{
  "access_token": "tw_jwt_...",
  "token_type": "bearer",
  "user": {
    "id": "user_...",
    "email": "tourist@example.com",
    "full_name": "Aarav Mehta",
    "role": "tourist",
    "is_active": true,
    "created_at": "2026-11-01T00:00:00Z"
  }
}
```

#### `POST /api/v1/auth/login` (and `/api/auth/login`)
Authenticates an existing Tourist or Admin/Superuser using email and password.
- **Request Body:**
```json
{
  "email": "admin@trailweave.org",
  "password": "admin123"
}
```

#### `GET /api/v1/auth/me` (and `/api/auth/me`)
Returns the currently authenticated user profile from the `Authorization: Bearer <token>` header.

#### `GET /api/v1/admin/team` (and `/api/admin/team`)
Returns all administrator and superuser accounts. Requires `admin` or `superuser` role (`403 Forbidden` for tourists).

#### `POST /api/v1/admin/team` (and `/api/admin/team`)
Allows an authenticated administrator/superuser to add a new administrator (`role: "admin"` or `"superuser"`).
- **Request Body:**
```json
{
  "email": "new.admin@trailweave.org",
  "password": "adminpassword123",
  "full_name": "Priya Rathore",
  "role": "admin"
}
```

