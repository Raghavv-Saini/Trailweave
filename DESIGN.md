---
name: TrailWeave
description: Authentic Udaipur travel & living artisan journeys with understated luxury editorial craft
colors:
  primary: "#1E3A5F"
  primary-hover: "#152943"
  primary-deep: "#0F1E31"
  pichola-ink: "#191C1E"
  pichola-ink-subtle: "#3F464C"
  limestone: "#FDFBF7"
  sand: "#F4EFEA"
  sand-border: "#E8E4DC"
  haveli-gold: "#9E7432"
  haveli-gold-soft: "#F8F4EE"
  emerald-craft: "#2A6E4F"
  emerald-craft-soft: "#EBF5F0"
typography:
  display:
    fontFamily: "var(--font-newsreader), Newsreader, Georgia, serif"
    fontSize: "2.75rem"
    fontWeight: 400
    lineHeight: 1.15
    letterSpacing: "-0.02em"
  heading:
    fontFamily: "var(--font-newsreader), Newsreader, Georgia, serif"
    fontSize: "1.5rem"
    fontWeight: 500
    lineHeight: 1.25
    letterSpacing: "-0.01em"
  body:
    fontFamily: "var(--font-sans), Plus_Jakarta_Sans, -apple-system, sans-serif"
    fontSize: "0.875rem"
    fontWeight: 400
    lineHeight: 1.5
    letterSpacing: "0em"
rounded:
  sm: "6px"
  md: "10px"
  lg: "16px"
  xl: "24px"
spacing:
  xs: "4px"
  sm: "8px"
  md: "16px"
  lg: "24px"
  xl: "32px"
components:
  button-primary:
    backgroundColor: "{colors.primary}"
    textColor: "#FFFFFF"
    rounded: "{rounded.md}"
    padding: "10px 18px"
  button-primary-hover:
    backgroundColor: "{colors.primary-hover}"
---

# Design System: TrailWeave

## Overview
TrailWeave's visual world embodies authentic Mewari heritage and discreet high-end editorial curation. The design trades away aggressive neon badges, saturated AI gradient buttons, and generic rounded templates in favor of Udaipur limestone surfaces, deep royal Mewar indigo actions, Pichola slate typography, and architectural restraint.

## Colors
- **Limestone Ground (`#FDFBF7`)**: The foundational canvas across all routes. Evokes dry-stone haveli plaster and morning light across Lake Pichola.
- **Pichola Slate Ink (`#191C1E`)**: Used for primary headlines, body text, and stark secondary buttons. High legibility under bright outdoor conditions.
- **Mewar Indigo (`#1E3A5F`)**: The unified action color. Used for primary buttons, active tabs, filter states, and interactive accents. Replaces all legacy neon orange (`#E05A2B`).
- **Sand & Linen (`#F4EFEA`, Border `#E8E4DC`)**: Subdued container cards and structural dividers.
- **Haveli Gold (`#9E7432`, Soft `#F8F4EE`)**: Subtle historical notes and curated highlights.
- **Emerald Craft (`#2A6E4F`, Soft `#EBF5F0`)**: Positive status badges (visited stops, feasible replans, verified craftsmen).

## Typography
- **Headings & Editorial Titles**: `Newsreader` (`.font-serif`). Human, literary, and evocative.
- **Body & Controls**: `Plus Jakarta Sans` (`.font-sans`). Crisp, modern, legible at 10px–14px.

## Layout
- Responsive max-width canvas (`max-w-7xl mx-auto px-4 sm:px-6 lg:px-8`).
- Desktop: Multi-column editorial discovery grids (3 cols) and operational 2-column workspace for active in-trip navigation (7 cols left timeline, 5 cols right sticky companion).
- Mobile: Elegant vertical flow with discreet bottom navigation bar (`md:hidden`).

## Elevation & Depth
- 1px hairline stone borders (`border-[#E8E4DC]`) with subtle, soft natural shadows (`shadow-2xs` or `shadow-xs`).
- No neon halos, no zero-blur offset brutalist drop-shadows.

## Shapes
- Modest corner radii: 12px–16px (`rounded-xl` to `rounded-2xl`) for cards; 8px–10px (`rounded-lg` / `rounded-xl`) for buttons; pills reserved exclusively for small metadata tags.

## Components
- **Primary Buttons**: Mewar Indigo background (`bg-[#1E3A5F] hover:bg-[#152943] text-white`).
- **Secondary Buttons**: Neutral white or limestone background with stone border (`bg-white border border-[#E8E4DC] text-[#191C1E] hover:bg-[#F4EFEA]`).
- **Active Filter Chips**: Mewar Indigo background or solid Pichola slate ink.
- **Callout Banners**: Quiet sand/limestone backgrounds (`bg-[#FBF9F5] border-[#E8E4DC]`) with Mewar indigo or slate accents.

## Do's and Don'ts
- **DO** use Mewar Indigo (`#1E3A5F`) as the single consistent primary action color across the entire platform.
- **DO** use Newsreader serif for trail titles, artisan studio names, and hero headlines.
- **DON'T** use saturated orange (`#E05A2B`) or amber gradients for buttons, tabs, or badges.
- **DON'T** use AI hype sparkles or robot emojis as decorative badges.
