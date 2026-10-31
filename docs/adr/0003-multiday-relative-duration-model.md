# ADR 0003: Multi-Day Itineraries & Unified Relative Duration Model

## Status
Accepted

## Context
Following PRD v2.0 refinement, the user specified that the system must support both single-day trails (e.g. 3-hour food trail, 6-hour heritage walk) and multi-day itineraries (e.g. 2-day or 3-day Udaipur guide), and that itineraries should be stored and shared with the same schema and discovery mechanisms as trails. Furthermore, trails must be easily cloned by other travelers regardless of their arrival date/time.

## Decisions

### 1. Flexible Duration Model (Single-Day & Multi-Day)
- Trails and itineraries support two duration types: `single_day` and `multi_day`.
- Multi-day itineraries organize stops by `day_number` (1, 2, 3...) with optional daily themes (e.g. *"Day 1: Royal Palaces & Lake Pichola"*, *"Day 2: Monsoon Palace & Artisan Villages"*).
- Duration is tracked at the top level as `total_days` (integer) and `total_duration_hours` (estimated active hours).

### 2. Unified Relative Duration Storage
- Community Trails store relative time increments rather than hard-coded calendar dates:
  - `suggested_duration_minutes`: Time spent at the place (e.g. 90 mins).
  - `estimated_transit_minutes`: Time to transit to the next stop.
  - `time_slot`: Guidance bucket (`morning`, `afternoon`, `sunset_evening`, `night`).
  - `day_number`: Day index within the journey.
  - `sequence_in_day`: Chronological order within that specific day.
- When a user adopts or clones a trail, the **Constraint Solver** maps these relative durations onto concrete calendar arrival and departure timestamps for each selected date, verifying that daily operating hours, sunset times, and budget constraints hold.

### 3. Budget Handling Across Multi-Day Trips
- **In Discovery / Curated Feed**: Trails display the **Total Trip Budget** (e.g. *"₹3,500 total across 2 days"*) so users can easily filter and compare.
- **In Trip Builder / AI Planning**: When planning from scratch or customizing, the AI agent interactively prompts the user:
  1. *Total budget vs. per-day budget preference.*
  2. *Daily starting point / hotel location for each morning.*

### 4. Storage Separation: `My Trips` vs `Community Trails`
- **`personal_trips` (My Trips)**: Private user workspace storing in-progress, active, and completed itineraries. Users can save, modify, and resume planning across multiple sessions.
- **`community_trails`**: Public or unlisted curated trails generated from completed personal trips via the Trip-to-Trail loop, preserving attribution and tips.

## Consequences
- Single unified data model powers both quick afternoon walking trails and comprehensive multi-day holiday guides.
- Eliminates calendar coupling: a trail created on a Tuesday can be cloned and run on a Saturday without time-shifting errors.
