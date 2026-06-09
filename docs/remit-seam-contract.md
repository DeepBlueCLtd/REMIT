# REMIT — Seam Contract (draft 0.2)

*The interface that must stay stable (DEC-41) across implementations. v1 ships in-browser mock implementations behind it (DEC-39); the future real services swap in without client change. Shapes reference `remit-data-model.md` v0.3. JSON-ish, conceptual.*

*v0.2: adds **§D Providers** (computed channels, movement model, entity tracks — DEC-49/52); `Entity` as an object type (A); `config_core` in the planning call and stamp (DEC-48).*

## Scope

**Behind the seam** (mockable / later networked): heavy compute (plan generation, re-scoring, robustness sampling, C10 surfaces), **providers** (computed risk channels, movement model, entity tracks — DEC-49/52), and the object/log stores. A *local* implementation always exists behind the seam, so offline holds (NF5/DEC-39); networked providers only enrich.
**Local-only — NOT over the seam** (DEC-40-D): interactive steering re-plan, and the wingman's rolling-horizon / band-alert loop. These run in the client/field for latency (NF6) and offline (NF5).
**Config (DEC-48):** the world-defining **config core** (medium, channels, movement model, provider declarations, vocabulary) is provisioned and hashed; its hash is a stamp input. The **instance shell** (branding, endpoints, view presets) is client-only and never crosses the seam.

## Conventions

- **Content-addressed (DEC-35):** immutable objects are identified by `id = hash(canonical-serialisation)`. `PUT` is idempotent and returns the id; re-`PUT` of identical content is a no-op. Names are aliases, never identity.
- **Immutability (data-model rule 1):** requirements, baselines, excursions, profiles, plans, stamps never mutate; "change" = new version with hash-linked lineage.
- **Canonical JSON** for hashing (sorted keys, fixed number form); semantic content only. Object schemas are generated from the LinkML data model (DEC-57); the byte-identical, cross-language (TS≡Python) canonicalisation rule that makes content-addressing hold is specified separately (DEC-35/57).
- **Async-capable planning:** generation may take seconds (DEC-28). Endpoints return either a result or a `{job_id}`; clients poll/stream. The v1 mock answers synchronously but uses the same shape.
- **Error model:** `{error: {code, message, detail?}}`. Notable codes: `not_found`, `stamp_incompatible` (comparability guard, DEC-23), `schema_migrated` (DEC-36 replay divergence flag), `unsupported_activity` (vocabulary not in this kernel version).
- **Versioning:** every response carries `kernel_version` and `schema_version`; plans carry their stamp (DEC-29).

---

## A. Object & log store

```
PUT  /objects            body: <immutable object>        → { id }            // idempotent
GET  /objects/{id}                                        → <object> | not_found
POST /objects/exists     body: { ids: [id] }              → { present: [id], missing: [id] }  // trickle dedup (DEC-25)
GET  /objects/{id}/lineage                                → { chain: [id] }   // hash-linked versions

POST /logs/{mission_id}/append   body: <ExecutionLog entry>  → { ok }         // append-only (DEC-25/26)
GET  /logs/{mission_id}          ?after=t                    → [ entry ]
```
Object types: Requirement, Baseline, Excursion, Profile, Plan, SelectionRationale, **Entity** (DEC-52; forecast/observed entities are immutable versioned objects — computed entities come from §D providers, not the store).

## B. Planning service (the kernel call)

```
POST /plan/handful
  body: {
    requirement_version: id,
    baseline_version: id, excursions: [id],
    config_core: hash,                      // world-defining config core (DEC-48); part of stamp
    profile: id,
    appetites: { axis → setting },          // implementer's (DEC-6)
    steering?: [Constraint],                // interpreted gestures (DEC-24)
    strategy_seed                           // → reproducible *a* handful (DEC-40-C)
  }
  → { plans: [Plan], kernel_version } | { job_id }
// Plan carries stamp (authoritative) + materialisation (cached) + scores (DEC-29)
// Stamp includes config_core (DEC-48): comparability guard fires across differing world-cores.

POST /plan/rescore                          // amendment / new world version (B5, DEC-23)
  body: { plan_ids:[id], requirement_version:id, baseline_version:id, excursions:[id], config_core:hash }
  → { rescored: [ { plan_id, scores, stamp_compatible: bool } ] }
// stamp_compatible=false ⇒ comparability guard warns (DEC-23), no false matrix

POST /surface/suitability                   // C10 advisory, v1 best-d-window (DEC-32)
  body: { activity, window, baseline_version:id, excursions:[id] }
  → { grid: BandedSurface }                 // good|marginal|poor per cell (advisory only)
```

## C. Sync (trickle link, when connected — DEC-25)

```
POST /sync/push   body: { deltas:[ Observation|Amendment|Verdict|Alert ], stamps:[Stamp] }  → { accepted, want:[id] }
GET  /sync/pull   ?since=cursor                                                              → { deltas:[…], cursor }
```
Only compact deltas + stamps transit; bulk data was provisioned (DEC-11). `exists` (A) precedes any large send. Plans move as **stamps**, regenerated server-side — identical *only within a kernel version* (DEC-40-A), else `schema_migrated`.

## D. Providers (computed channels · movement · entity tracks) — DEC-49/52

```
// All providers are DETERMINISTIC within a version; provider_version ∈ config_core (DEC-48).
// A local implementation always exists (NF5); networked providers only enrich. Results CA-cached.

POST /provider/channel/{channel_id}/materialise      // bulk: one call, then fully offline
  body: { ao, window, step }                          // step per DEC-21 (resolution ∝ predictability)
  → { raster: f(cell,t) } | { job_id }
POST /provider/channel/{channel_id}/evaluate         // lazy / sub-step precision
  body: { samples: [ (cell, t) ] }                    // BATCH; sparse — route cells only (NF6)
  → { values: [ value ] }

POST /provider/movement/{model_id}/traverse          // anisotropic EDGE cost (DEC-49)
  body: { edges: [ (cell_from, cell_to, t) ], profile: id }    // batch
  → { costs: [ { cost, speed } ] }                    // networked traverse WARNED — inner loop (NF6)

POST /provider/entity/{entity_id}/track              // computed entity, e.g. ephemeris (DEC-52)
  body: { window, aspects?: [name] }
  → { aspects: [ { name, type: cell|scalar|window|status, series: f(t) } ] }
```
- `materialise` is the default (bulk → then offline); `evaluate`/`track` are lazy refinement. `materialise(step)` and `evaluate` must agree at shared `(cell,t)` — a contract-conformance test (DEC-46).
- New error code: `provider_nondeterministic` (conformance guard, DEC-50) — repeats diverge within a version, which would silently break NF3/replay.

---

## v1 mock notes

- All of the above implemented **in-browser**, synchronously, behaviour **illustrative only** — does not validate the real planner's quality (DEC-41 / NF9).
- `strategy_seed`, content-addressing, async shape and stamp-compat flags are honoured by the mock so the **contract** matures even though internals are throwaway.
- v1 providers are mocks too: a mock tide channel (`materialise`+`evaluate`) and one mock ephemeris entity (`track`) — enough to exercise §D end-to-end for the first slices (DEC-54).

## Open items (0.2 → 0.3)

- Streaming vs polling for async planning and `materialise` (`job_id` → SSE? long-poll?).
- Auth/identity placement (deferred with multi-user, DEC-15; classification marking carried but unenforced, DEC-31).
- Whether `/surface/suitability` folds into `/plan/handful` as an internal step vs stays a separate advisory call.
- Pagination/cursor semantics for `/logs` and `/sync/pull`.
- Provider **cache invalidation** + how `config_core` change versions provider results; `track` provenance when a forecast entity is later observed (collapse over `/sync`).
- Whether the entity **cast-to-channel/commitment** (DEC-52) is a client step or a seam-side helper.
