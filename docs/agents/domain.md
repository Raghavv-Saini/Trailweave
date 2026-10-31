# Domain Docs

How engineering skills and agents consume and maintain this repo's domain and architectural documentation.

## Before exploring, read these

- **`GLOSSARY.md`** at the repo root: ubiquitous domain terminology.
- **`docs/adr/`**: read ADRs that touch the area you are about to work in.
- **Living Specifications**:
  - `docs/API_SPEC.md`: REST endpoints and Gemini tool calling contracts.
  - `docs/DATABASE_SCHEMA.md`: PostgreSQL schema, PostGIS geometry, and tables.
  - `docs/ARCHITECTURE.md`: System topology, mutation flows, and concurrency.

If any of these files don't exist, **proceed silently**. The `/domain-modeling` skill creates them lazily when terms or decisions actually get resolved.

## File structure

```
/
├── GLOSSARY.md
├── docs/
│   ├── adr/
│   │   ├── 0001-trailweave-architecture.md
│   │   └── ...
│   ├── ARCHITECTURE.md
│   ├── DATABASE_SCHEMA.md
│   ├── API_SPEC.md
│   └── tickets/
└── src/
```

## Use the glossary's vocabulary

When your output names a domain concept (in an issue title, a refactor proposal, a hypothesis, a test name), use the term as defined in `GLOSSARY.md`. Don't drift to synonyms the glossary explicitly avoids.

If the concept you need isn't in the glossary yet, that's a signal: either you're inventing language the project doesn't use (reconsider) or there's a real gap (note it for `/domain-modeling`).

## Flag ADR conflicts & record new decisions

- If your proposal contradicts an existing ADR, surface it explicitly rather than silently overriding:
  > _Contradicts ADR-0005 (unified trip engine), but worth reopening because…_
- When resolving a non-trivial architectural trade-off or introducing a new system boundary, create a new ADR in `docs/adr/NNNN-<slug>.md`.
- Whenever an API contract, database schema, or flow changes, immediately update the corresponding living spec (`docs/API_SPEC.md`, `docs/DATABASE_SCHEMA.md`, or `docs/ARCHITECTURE.md`) so teammate developers working in parallel are never blocked or broken.
