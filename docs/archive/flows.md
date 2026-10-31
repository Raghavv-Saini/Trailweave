# [ARCHIVED / HISTORICAL BRIEF]
> [!NOTE]
> **Archival Notice:** This document is an early revision brief (v1 -> v2) exploring the pivot from creator-led travel planning to community discovery under the working name "FairPath".
> All product requirements and data structures specified here have been consolidated into [`docs/PRD.md`](../PRD.md) (PRD v3.0) and ADRs 0002 & 0003. This document is retained solely for historical provenance and rationale.

---

# FairPath — PRD Revision Brief
## Transition from Creator-Led Travel Planning to Community-Powered Travel Discovery

**Project:** FairPath — AI-Powered Community Travel Platform  
**Hackathon:** Aravalli Build Championship: Road to DevFest Udaipur 2026  
**Initial Location:** Udaipur, Rajasthan, India  
**Objective:** Update the existing Detailed Product Requirements Document (PRD) to reflect the new community-first product direction while retaining the original Fair-Path Engine, AI planning capabilities, artisan inclusion, and technical architecture.

---

# 1. Background: Original Product Concept

The original FairPath product was designed around three major components:

### A. Creator-Led Discovery
Professional travel creators could upload or structure their travel itineraries, link Instagram Reels and YouTube videos, and help tourists discover interesting destinations.

### B. AI-Powered Itinerary Planning
Tourists could select creator recommendations and enter their budget, interests, available time, and starting location.

An AI-assisted optimization engine would combine recommendations, check feasibility, and generate a personalized route.

### C. Fair-Path Engine and Artisan Inclusion
A recommendation engine would identify relevant local artisans, small businesses, and overlooked experiences along a tourist's journey.

Artisans could register and update information using Hindi/Mewari WhatsApp voice messages.

**Original positioning:**
"Creators inspire. AI personalizes. Fair-Path connects tourists with local communities."

### Problems with the Original Approach

We identified three weaknesses:

1. **Creator acquisition:** The platform initially depends on persuading professional content creators to contribute itineraries.
2. **Limited differentiation:** A generic itinerary planner can already be approximated using ChatGPT or Gemini with search and mapping tools.
3. **Passive tourists:** Tourists consume recommendations but do not contribute to improving the platform after completing their journeys.

The updated concept must address all three problems without abandoning the original purpose of supporting local communities.

---

# 2. New Product Direction: Community-Powered FairPath

FairPath will become a **community-powered travel discovery, planning, and experience-sharing platform**.

Instead of depending primarily on professional influencers, every traveler can contribute to the platform after completing a trip.

A user can:

1. Discover travel itineraries published by other travelers.
2. Select complete community trails or individual stops from different trails.
3. Personalize their selections through an AI-assisted itinerary planner.
4. Discover relevant local artisans and businesses through the Fair-Path Engine.
5. Follow their itinerary and record which places they actually visited.
6. Convert their completed trip into a shareable community trail.
7. Inspire future tourists, who can adapt or remix that trail.

This creates a continuous community loop:

**Discover → Select → Personalize → Experience → Share → Discover Again**

The user is no longer merely a consumer of travel recommendations.

**Every tourist can become a curator, and every experienced trip can contribute useful information to the community.**

### Updated Product Positioning

**FairPath — Explore like a local. Travel your way. Pass it on.**

Alternative mission statement:

"FairPath transforms real travelers' experiences into personalized, actionable journeys while improving discovery opportunities for local artisans and businesses."

### Important Strategic Principle

Professional content creators are not removed from the platform.

They become one category of community curator alongside ordinary tourists and local residents.

The platform must not require users to become professional creators or build social-media followings to contribute useful content.

---

# 3. New Primary User Journey

The primary tourist experience must be redesigned around community trail discovery rather than beginning with an empty AI chat interface.

## Step 1: Open FairPath

The user opens the application and sees a travel discovery homepage.

If the destination is known, the homepage is customized for that city. Otherwise, the user selects a destination.

For the hackathon, only Udaipur needs to be supported.

The homepage contains:

- A destination header and discovery search.
- Featured community-curated trails.
- Travel interest categories such as Heritage, Food, Art & Crafts, Nature, and Hidden Gems.
- A prominent option to explore community trails.
- An alternative option to create an itinerary from scratch.
- Access to saved trails and the user's existing trips.

### Two Primary Entry Points

**Option A — Explore Community Trails (Primary)**

Users discover itineraries shared by previous travelers and select the experiences they like.

**Option B — Plan From Scratch (Secondary)**

Users enter their interests, budget, time, and location and allow the AI planning system to suggest places.

Both paths eventually lead to the same Trip Builder.

The application should not force users to interact with an LLM chatbot before discovering travel content.

---

# 4. Community Trail Discovery and Filtering

A new **Community Trail Explorer** becomes a central feature.

Users can browse previously published itineraries and filter them according to their needs.

## Required Filters

### Personal Preferences
- Destination.
- Available time or trip duration.
- Maximum budget in INR.
- Starting location.
- Travel mode: walking or driving.
- Interests: food, heritage, crafts, nature, etc.
- Intended travel date, where applicable.

### Community Discovery Filters
- Trail category.
- Estimated price range.
- Duration.
- Geographic proximity.
- Walkability or travel style.
- Inclusion of artisan experiences.
- Recently shared or updated trails.
- Planned versus self-reported experienced trails.
- Curator type: traveler, local resident, or professional creator.

Filters should be easy to modify without restarting trip planning.

## Community Trail Cards

Each trail card should display:

- Trail title.
- Curator name and profile.
- Short description.
- Destination.
- Stops count.
- Estimated total duration.
- Estimated or reported cost.
- Interest tags.
- Relevant images, if supplied.
- Last updated date.
- Whether the trail is based on a self-reported completed trip.
- Basic community usefulness signals where available.

Do not imply that self-reported visits are independently verified.

## Community Ranking

Community trails should be ranked primarily by relevance rather than popularity.

A proposed initial ranking model:

- Interest relevance: 30%.
- Time and budget compatibility: 25%.
- Geographic relevance: 20%.
- Data freshness and completeness: 15%.
- Community usefulness signals: 10%.

These are provisional weights that should be tested and refined.

Follower counts, views, creator popularity, and commission amounts should not dominate recommendations.

New curators should still have a reasonable opportunity to gain visibility.

---

# 5. New Feature: Selecting and Combining Community Trails

Users must not be restricted to choosing only one complete community itinerary.

This is one of the most important changes to the product.

Each community trail should offer three actions.

## Action 1: Use as Base

The user starts their personal itinerary using one community trail.

They can subsequently add, remove, or replace stops and let the AI personalize it.

## Action 2: Add All Stops

The user adds every stop from a community trail to their current selection.

This allows combining recommendations from multiple community trails.

## Action 3: Pick Individual Stops

The user expands a trail and selects only the places or experiences they are interested in.

### Example

Community Trail A:
- Heritage walk.
- City Palace.
- Local restaurant.

Community Trail B:
- Miniature-painting workshop.
- Textile artisan.
- Local tea shop.

A tourist may select:
- Heritage walk from Trail A.
- City Palace from Trail A.
- Miniature-painting workshop from Trail B.
- Tea shop from Trail B.

FairPath combines these into a new personal trip.

### Important Functional Requirements

- Allow selection of stops across multiple community trails.
- Maintain a temporary trip selection or trip basket.
- Remove duplicate place records.
- Preserve attribution to the original trail creators.
- Allow users to remove stops independently.
- Show estimated stop-level costs and durations.
- Let users return to community discovery without losing their selection.
- Do not assume the selected stops form a valid itinerary until optimization has been performed.

A complete community trail may exceed the user's budget while some individual stops still fit.

Therefore, distinguish between:

- **Complete trail fits:** Preliminary estimates suggest the full trail meets the filters.
- **Partial match:** Some stops may be suitable.
- **Needs optimization:** A valid schedule has not yet been confirmed.

Users should not lose access to useful individual recommendations simply because the complete original trail does not fit.

---

# 6. Updated Trip Builder

After selecting community stops, the user enters the Trip Builder.

This is where the original AI itinerary engine and the new community features come together.

## Suggested Interface

On desktop:
- Left side: ordered itinerary timeline.
- Right side: interactive map.

On mobile:
- Full-width itinerary timeline.
- Switchable map view.

## Trip Builder Capabilities

The user can:

- Review selected places.
- Identify the community trail each place came from.
- Add or remove stops.
- Change budget, time, travel mode, and starting location.
- Request AI-assisted optimization.
- Review route distances and estimated travel times.
- Explore relevant Fair-Path artisan suggestions.
- Accept or reject itinerary adjustments.
- Save or start the resulting trip.

## AI Planning Workflow

1. Read the selected community stops.
2. Retrieve canonical place records.
3. Eliminate duplicate locations.
4. Add optional relevant candidates from the Fair-Path database.
5. Retrieve travel times and distances from the routing API.
6. Check budget and duration constraints.
7. Respect known opening hours and availability.
8. Reorder stops into a feasible itinerary.
9. Preserve community curator attribution.
10. Generate natural-language explanations using an LLM.

### Important Architecture Principle

The LLM must not independently determine whether a route is feasible.

Routing, estimated costs, scheduling, operating-hour checks, and hard-constraint validation must remain deterministic or grounded in trusted external data.

The LLM is responsible for preference interpretation, explanations, suggestions, and conversational modifications.

Examples of optional conversational modifications:

- "Make this trip cheaper."
- "Replace museums with artisan experiences."
- "I only have three hours."
- "Suggest less crowded alternatives."

These should be an additional interaction mechanism rather than the primary application interface.

---

# 7. Fair-Path Engine — Retain and Strengthen

The Fair-Path Engine remains a major differentiating component.

Its objective is to improve relevant discovery of local artisans, smaller businesses, and authentic cultural experiences.

It should not be replaced by popularity-based community recommendations.

## Updated Role

Fair-Path now uses:

1. User preferences.
2. Selected community trail stops.
3. Available time and budget.
4. Geographic proximity.
5. Verified artisan and business listings.
6. Availability and pricing information where provided.
7. Community feedback and experience data.

It recommends local experiences that fit the tourist's actual journey.

### Example

A tourist combines two community trails containing heritage attractions and local food stops.

Fair-Path identifies a suitable miniature-painting workshop along the route.

It explains why the experience is relevant and how including it affects travel time and cost.

The tourist can accept or reject the suggestion.

### Fairness Requirements

- Do not recommend an artisan solely because they are obscure.
- Relevance, affordability, reliability, and route feasibility remain important.
- Do not secretly prioritize businesses because they pay commissions.
- Preserve pricing and recommendation transparency.
- Do not invent real-time availability or crowd conditions.
- Provide opportunities for relevant businesses with limited prior exposure.

Community trails should also make it possible for tourists to discover artisans organically through other travelers' experiences.

---

# 8. New Core Feature: Trip-to-Trail

**Trip-to-Trail is the flagship community contribution feature.**

At the end of their journey, travelers can turn their personal itineraries into reusable community trails.

## Objective

Remove the effort traditionally required to create travel content.

Instead of asking users to manually write a travel guide, FairPath automatically prepares a draft using their existing trip records.

## User Flow

### Step 1: Finish Trip

The tourist explicitly marks their trip as completed.

The application displays their planned stops and allows them to confirm what happened.

A trip should not automatically be considered completed simply because its planned duration has elapsed.

### Step 2: Confirm Visited Places

Each stop can be marked:

- Visited.
- Skipped.
- Not Sure.

Users can correct expenses, visit durations, and add unplanned stops.

A claimed visit must be treated as self-reported unless separately verified.

### Step 3: Generate a Community Trail Draft

AI uses confirmed trip information to suggest:

- An appropriate title.
- A short description.
- An ordered list of selected visited places.
- Approximate duration.
- A public budget range.
- Interest categories.
- A short summary of the experience.

Skipped and uncertain stops are excluded by default.

AI must not fabricate activities, experiences, reviews, or expenses.

### Step 4: Personalize the Trail

The user may:

- Edit the title.
- Add travel tips.
- Highlight favorite stops.
- Remove private or irrelevant stops.
- Add optional photos.
- Modify public-facing expenditure estimates.
- Choose a cover image.
- Review the route and descriptions.

### Step 5: Privacy Review

The application shows exactly what will become visible to others.

Visibility options:

- Private.
- Unlisted, accessible through a link.
- Public, discoverable by the community.

Publishing requires explicit user consent.

### Step 6: Publish

After validation, the community trail becomes available according to its visibility settings.

The user automatically becomes a community curator after publishing their first trail.

No separate professional-creator onboarding is required.

### Step 7: Reuse

Other tourists may discover and personalize the published trail.

Their personalized trips remain separate from the original community trail.

This completes the community contribution loop.

---

# 9. Community Remixing and Attribution

The platform should eventually support a GitHub-like fork-and-improve concept for travel itineraries.

### Example

User A shares:

"Udaipur Heritage Trail Under ₹1,500."

User B follows this trail but adds a pottery workshop.

After completing their journey, User B publishes:

"Udaipur Heritage and Crafts Trail."

The application preserves attribution to User A while recording User B as the curator of the modified version.

## Requirements

- Original trails remain unchanged.
- Users create independent derivative trails.
- Preserve source trail identifiers.
- Attribute original recommendations.
- Track trail versions.
- Require permission for public remixing and reuse of protected content.
- Do not automatically copy another curator's private notes or photographs.

### MVP Priority

Basic trail reuse is mandatory.

Full public remixing, version history visualization, and complex attribution interfaces can be Phase 2 features if implementation time is limited.

---

# 10. Trust, Privacy, and Content Quality

Community contributions create new safety and quality challenges that were less significant in the original creator-focused PRD.

The updated PRD must explicitly address them.

## Private Trip vs Public Trail

A user's private trip and published community trail must be separate database entities.

Do not automatically publish:

- Home or hotel addresses.
- Exact personal GPS history.
- Sensitive location information.
- Exact private travel timestamps.
- Unselected personal notes.
- Personal contact information.
- Actual expenditure without permission.
- Private photographs.

Only information explicitly reviewed and approved for sharing should become public.

## Publication Validation

Before a trail can be publicly published, the system should verify:

- The publishing user owns or has permission to publish the content.
- The trail has a sufficient number of valid stops.
- Published stops reference canonical place records.
- Duplicate locations are handled.
- Required public fields are present.
- Invalid or negative prices are rejected.
- Potential personal information is flagged.
- Unsupported AI-generated claims are removed.
- Copyright and media-sharing permissions are respected.
- The user has approved the public preview.

## Planned vs Experienced Trails

The application must distinguish:

**Planned Trail:** An itinerary that has been created but not confirmed as experienced.

**Experienced Trail:** An itinerary shared after the user reports completing the relevant visits.

Experienced does not automatically mean independently verified.

A self-reported completion should be labeled accordingly.

## Revalidating Community Trails

A route that worked for one traveler may not work for another traveler on another date.

Therefore, selecting a community trail must trigger fresh feasibility checks using the new traveler's constraints.

The original trail provides inspiration and useful historical context.

The planner generates a new actionable itinerary.

---

# 11. Updated Data Model

The original PRD already included users, creators, places, artisan profiles, itineraries, and recommendations.

The new community system requires additional entities and clearer separation between personal journeys and public trails.

## New or Modified Core Entities

### users
- id
- display_name
- role and profile settings
- created_at

A tourist may also become a curator. Roles should not be unnecessarily exclusive.

### personal_trips
- id
- owner_id
- destination
- start_location
- budget
- planned_start
- planned_end
- status
- completed_at

Private by default.

### personal_trip_stops
- id
- trip_id
- place_id
- planned_order
- visit_status
- estimated_cost
- actual_cost
- actual_duration
- private_notes

### community_trails
- id
- owner_id
- title
- description
- destination
- visibility
- publication_status
- allow_remix
- current_version_id
- created_at
- updated_at

### trail_versions
- id
- trail_id
- version_number
- previous_version_id
- remixed_from_version_id
- published_at

### trail_stops
- id
- version_id
- place_id
- sequence
- suggested_duration
- estimated_cost
- public_tip
- source_attribution

### trail_source_links
- trail_id
- source_trip_id (private/internal)
- original_trail_version_id
- attribution_type

### trail_engagement
- id
- trail_id
- user_id
- event_type
- created_at

Events may include:
- Viewed.
- Saved.
- Used as itinerary base.
- Personalized.
- Reported completed.

### trail_reports
- id
- trail_id
- reporter_id
- reason
- status

### Existing Tables to Preserve

- Places with spatial coordinates and verification data.
- Artisan profiles.
- Artisan offerings and availability.
- WhatsApp voice submissions.
- Itinerary recommendations.
- Creator/referral attribution.
- Pricing and opening-hour information.

Use PostgreSQL and PostGIS for relational and geographic queries.

Row Level Security or equivalent backend authorization must protect private trips and drafts.

---

# 12. Updated Functional Requirements

The revised PRD must include the following new requirements.

| ID | Feature | Priority |
|---|---|---|
| COM-01 | Community-first destination homepage | P0 |
| COM-02 | Community trail listing and detail page | P0 |
| COM-03 | Trail discovery filters | P0 |
| COM-04 | Select a complete trail as the base | P0 |
| COM-05 | Select individual stops from trails | P0 |
| COM-06 | Combine stops from multiple trails | P0 |
| COM-07 | Preserve original curator attribution | P0 |
| COM-08 | AI itinerary optimization of selected stops | P0 |
| COM-09 | Trip progress and visited/skipped tracking | P0 |
| COM-10 | Finish-trip workflow | P0 |
| COM-11 | Automated Trip-to-Trail draft generation | P0 |
| COM-12 | Edit and review community trail | P0 |
| COM-13 | Privacy controls and explicit publication | P0 |
| COM-14 | Publish and discover community trails | P0 |
| COM-15 | Revalidate a community trail for a new traveler | P0 |
| COM-16 | Add tips and optional photographs | P1 |
| COM-17 | Public trail remixing | P1 |
| COM-18 | Basic community reporting and moderation | P1 |
| COM-19 | Followers, comments, creator earnings and reputation | P2 |

These requirements supplement, rather than automatically replace, the original itinerary, maps, AI, artisan onboarding, and Fair-Path requirements.

---

# 13. Updated MVP Architecture

Retain the existing architecture where practical.

| Layer | Recommended Technology |
|---|---|
| Frontend | Next.js + TypeScript |
| UI | Tailwind CSS + shadcn/ui |
| Backend | FastAPI |
| Database | Supabase PostgreSQL + PostGIS |
| LLM | Gemini Flash-class model |
| Mapping and directions | Google Maps Platform |
| Speech-to-text | Google Cloud Speech-to-Text |
| Artisan communication | Meta WhatsApp Cloud API |
| Trip scheduling | Deterministic optimization and routing logic |
| Deployment | Vercel + Google Cloud Run |

### New Backend Services

Add:

- Community Trail Service.
- Trail Discovery and Ranking Service.
- Trip Progress Service.
- Trip-to-Trail Publishing Service.
- Trail Privacy and Validation Service.
- Trail Attribution and Remix Service.

Do not build these as separate microservices for the hackathon.

They can be modules within a single FastAPI application.

### Existing Services to Retain

- AI preference interpretation.
- Itinerary optimization.
- Routing and geographic search.
- Fair-Path recommendation ranking.
- Artisan voice onboarding.
- Artisan profile validation.
- Creator attribution.

---

# 14. Updated Success Metrics

The original PRD emphasized itineraries generated, creator participation, and artisan exposure.

The revised PRD should also measure whether community content creates real value.

## Primary Product Metric

**Number of community trails reused to create journeys that users later report completing.**

This measures the complete community value loop more meaningfully than simple page views or likes.

## Supporting Metrics

### Traveler Engagement
- Community trails viewed.
- Trails saved.
- Stops selected from different trails.
- Personalized itineraries generated.
- Trips started.
- Trips reported completed.

### Community Contribution
- Trip-to-Trail drafts generated.
- Draft-to-publication conversion rate.
- Public trails published.
- Unique contributing curators.
- Existing trails reused or remixed.
- Reuse of newly published trails.

### Artisan Inclusion
- Relevant artisan recommendations shown.
- Artisan profiles viewed.
- Artisan inquiries initiated.
- Confirmed experience requests, if implemented.
- Discovery of previously less-exposed businesses.

### Recommendation Quality
- Itinerary feasibility rate.
- Budget adherence.
- Estimated versus reported trip duration.
- Accepted Fair-Path suggestions.
- Reports of outdated or incorrect community information.

Do not use total AI-generated itineraries as the sole primary indicator of product success.

---

# 15. Hackathon MVP Scope

The project is being built for a two-day hackathon on October 31 and November 1, 2026.

The updated PRD must be ambitious in product direction but realistic in development scope.

## Essential Demonstration

Prepare a small curated Udaipur dataset and a few community trails.

A successful demonstration should show:

1. User A has a completed Udaipur trip.
2. User A confirms the places visited.
3. FairPath creates an editable community trail draft.
4. User A reviews and publishes the trail.
5. User B opens the community discovery homepage.
6. User B discovers User A's trail.
7. User B selects specific stops and combines them with another trail.
8. FairPath generates a feasible itinerary respecting budget, time, and routing constraints.
9. The Fair-Path Engine recommends a relevant local artisan.
10. User B accepts or rejects that recommendation.
11. User B records visited and skipped stops.
12. User B can generate a new Trip-to-Trail draft.

This demonstrates the central community loop.

## WhatsApp Artisan Component

Retain the original Hindi WhatsApp voice onboarding demonstration if development capacity permits.

Ideally, show that an artisan can update information through a voice message, confirm the structured data, and make that information available to the Fair-Path Engine.

This should remain part of the product architecture even if the real-time messaging integration needs a labeled demo fallback.

## Features to Deprioritize

- Professional influencer recruitment workflows.
- Complex creator analytics.
- Creator payout and commission settlement.
- Full accommodation/transport booking.
- Automated Instagram Reel scraping.
- Followers and social networking features.
- Complex reviews and comment feeds.
- Nationwide expansion.
- Guaranteed real-time crowd detection.
- Advanced machine-learning recommendation training.
- Full trail version-history interfaces.

The goal is not to create a social network during the hackathon.

The goal is to demonstrate a functioning community-powered travel loop.

---

# 16. Required PRD Changes — Section by Section

The agent modifying the previous PRD should make these concrete changes:

| Existing PRD Section | Required Modification |
|---|---|
| Executive Summary | Reposition FairPath as community-powered travel discovery and experience sharing |
| Product Vision | Introduce the Discover → Personalize → Experience → Share loop |
| User Personas | Expand from tourists, professional creators, and artisans to tourists/community curators, professional creators, and artisans |
| Creator Discovery | Replace professional-creator-first discovery with community trail discovery |
| Tourist Onboarding | Introduce destination selection and two entry points: community trails or plan from scratch |
| Functional Requirements | Add discovery filters, stop selection, trail mixing, trip tracking, and Trip-to-Trail |
| AI Itinerary Planner | Accept community trails and selected stops as structured planning inputs |
| Fair-Path Engine | Include community context while preserving artisan discovery and fairness objectives |
| User Journeys | Add community exploration, trip remixing, trip completion, and publication workflows |
| UI Requirements | Add homepage, explorer, trail details, trip builder, trip recap, and publishing screens |
| Database | Add private trips, community trails, versions, stop records, attribution, and engagement |
| API Design | Add trail discovery, selection, publishing, remixing, and trip progress endpoints |
| Privacy & Security | Explicitly separate private travel data from public trails |
| Recommendation Algorithms | Add relevance-based community trail ranking alongside Fair-Path ranking |
| Analytics | Add community contribution, trail reuse, and completed-trip metrics |
| MVP Scope | Prioritize the complete community loop over professional creator marketplace features |
| Roadmap | Separate the 48-hour hackathon demo from advanced community features |
| Product Differentiation | Emphasize experience-based community information and artisan inclusion rather than generic LLM itinerary generation |

---

# 17. Important Product Principles

The revised PRD must preserve the following principles:

1. **Community first, not influencer first.** Professional creators remain welcome, but ordinary travelers and locals can become curators.

2. **No blank-page content creation.** Completed trip information should become the foundation for a new community trail.

3. **Flexible discovery.** Users can adopt full trails, combine multiple trails, or select individual stops.

4. **Community content is inspiration, not a guaranteed valid route.** Every reused itinerary must be checked against the new user's constraints.

5. **The Fair-Path Engine remains central.** Local artisan and small-business discovery must not become a minor optional directory.

6. **Travelers control their experiences.** AI-generated changes and publishing actions require appropriate user review and consent.

7. **Private trips remain private by default.** Public trails contain only deliberately approved information.

8. **Attribution is preserved.** Original curators and contributing sources should receive appropriate credit.

9. **Relevance matters more than popularity.** The platform should not become an engagement-only social media feed.

10. **Avoid exaggerated claims.** Self-reported visits are not verified visits; simulated crowds are not live data; estimated costs are not confirmed prices.

11. **Use AI where it adds actual value.** Natural-language interpretation, summarization, and explanations should complement deterministic routing and validation.

12. **Build a complete workflow before expanding features.** The hackathon MVP must demonstrate the community loop reliably.

---

# 18. Final Product Vision

FairPath should evolve from:

"An AI travel itinerary generator powered by creator recommendations."

Into:

**"A community-powered travel ecosystem where real travelers share experiences, future travelers discover and personalize those journeys, and local artisans gain meaningful opportunities to participate in tourism."**

The final product connects three main components:

### 1. Community Knowledge Layer
Travelers and locals publish trails based on their experiences.

### 2. Intelligent Travel Execution Layer
AI-assisted planning, maps, deterministic scheduling, and context-aware recommendations make community experiences actionable.

### 3. Local Inclusion Layer
The Fair-Path Engine and WhatsApp-based artisan onboarding connect tourists with relevant local businesses.

Together these form a sustainable contribution loop:

**A traveler experiences a place → Shares their journey → Another traveler discovers and improves it → More useful community knowledge becomes available → Relevant local businesses gain discovery opportunities.**

The long-term advantage is not simply the ability to generate itineraries.

It is the combination of community-contributed travel knowledge, useful execution workflows, transparent local discovery, and continually improving data about actual experiences.

---

# 19. Instructions to the PRD Revision Agent

Using this document as the approved product direction:

1. Read the existing FairPath Detailed PRD carefully.
2. Preserve the original product's essential technology, artisan onboarding, and Fair-Path recommendation objectives.
3. Update the product vision to the community-powered model.
4. Rewrite user journeys to reflect the new discovery and contribution loop.
5. Replace professional-creator-first onboarding with community trail discovery.
6. Integrate trail selection and mixing into the existing itinerary planning workflow.
7. Add the complete Trip-to-Trail feature, including validation and privacy requirements.
8. Expand the database schema and API specification to support community trails, attribution, and remixing.
9. Update success metrics and acceptance criteria.
10. Redefine hackathon P0, P1, and P2 priorities to ensure feasibility.
11. Explicitly distinguish confirmed decisions from optional future features and design hypotheses.
12. Produce a coherent, detailed, implementation-ready revised PRD rather than simply appending these additions as a separate section.

**The revised PRD must describe one cohesive product, not a collection of disconnected modules.**

The primary user experience should be:

**Open FairPath → Explore Community Trails → Filter and Select → Mix Experiences → Generate a Personalized Trip → Discover Local Artisans → Complete the Journey → Publish Your Own Trail → Inspire the Next Traveler.**

This is the central experience around which the entire revised PRD should be organized.
