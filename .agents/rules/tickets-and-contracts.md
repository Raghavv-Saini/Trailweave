# Ticket Implementation & Living Specs Rule

Always follow the protocol specified in `AGENTS.md`:

1. **Before Starting Any Ticket**:
   - Check upstream dependencies in `docs/tickets/README.md`.
   - Update the ticket file header: set `Status: claimed`.
   - Review `GLOSSARY.md`, `docs/API_SPEC.md`, and `docs/DATABASE_SCHEMA.md`.

2. **During Implementation**:
   - Strictly adhere to `GLOSSARY.md` domain language.
   - Core principle: AI companion proposes changes (`propose_trip_changes`); deterministic backend engine validates and commits them.
   - If introducing schema or endpoint changes, update `docs/API_SPEC.md`, `docs/DATABASE_SCHEMA.md`, and create an ADR in `docs/adr/` if applicable.

3. **After Implementation**:
   - Run verification and tests.
   - Check off all fulfilled tasks `[x]` in the ticket file.
   - Set `Status: resolved`.
   - Append implementation summary, diff highlights, and verification notes under `## Comments`.

