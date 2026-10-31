# Issue 05: Multi-Day Overnight Lifecycle Transitions

Status: needs-info

## Context
When Day 1 wraps up in the evening, the system needs an explicit lifecycle boundary before starting Day 2 the following morning.

## Options
1. **Explicit `DAY_COMPLETED` State**: Trip transitions to `DAY_COMPLETED` overnight. The next morning, the app presents a "Start Day X" prompt with the day's hotel starting point.

## Comments
Marked as OPEN by user on 2026-10-12.
