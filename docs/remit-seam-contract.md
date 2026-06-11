# REMIT — Seam Contract (draft 0.3)

*The interface that must stay stable (DEC-41) across implementations. v1 ships in-browser mock implementations behind it (DEC-39); the future real services swap in without client change. Shapes reference `remit-data-model.md` v0.3. JSON-ish, conceptual.*

*v0.2: adds **§D Providers** (computed channels, movement model, entity tracks — DEC-49/52); `Entity` as an object type (A); `config_core` in the planning call and stamp (DEC-48).*

*v0.3: adds the **command-post seam** (DEC-59/60/61, designed-for): §B `/plan/scheme-handful` (Operation -> banded Schemes); §E **source-provider ingress** (DEC-49 run inward), the **role write-scope/delta** rules, and the **registered UI-component** contract. v1 ships mocks (canned Schemes, mock feed) so the contract matures; capability is H2/H3 (DEC-56 guard). Stances/roles ride the instance shell (DEC-48), identity-free.*

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
Object types: Requirement, Baseline, Excursion, Profile, Plan, SelectionRationale, **Entity**, and (designed-for, DEC-59/61) **Operation** / **EndState** / **SchemeOfManoeuvre** and **Role** (Role rides the DEC-48 shell, identity-free) (DEC-52; forecast/observed entities are immutable versioned objects — computed entities come from §D providers, not the store).

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

POST /plan/scheme-handful                   // DEC-59 (designed-for): Operation -> banded handful of Schemes of Manoeuvre
  body: {
    operation_version: id,                  // owns requirements + End-State
    requirement_versions: [id],
    baseline_version: id, excursions: [id], config_core: hash,
    asset_pool: [entity_id],                // blue allocatable assets (DEC-60); capability matched to Activity needs
    appetites: { axis -> setting },         // CO's cross-objective priority (DEC-6, this echelon)
    strategy_seed
  }
  → { schemes: [SchemeOfManoeuvre], kernel_version } | { job_id }
// Scheme scored by effect profile vs End-State (two-level banding, NF10). Portfolio search is a KERNEL
// discipline (DEC-51): v1 mock returns canned schemes.
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

## E. Command-post: ingress, surfaces & roles — DEC-60/61 (designed-for)

```
// INGRESS — the DEC-49 provider seam run INWARD (live field / mock bench, swapped with no client change):
POST /provider/source/{source_id}/stream     // external feed -> STAMPED observation/entity deltas (NF3 over stamped inputs)
  body: { since?: cursor }                    // pull / stream; a live source emits as facts arrive
  → { deltas: [ Observation | EntityDelta ], cursor }   // collapse excursions; update confidence/freshness (DEC-19/25)

// WRITES — every cross-role authoring act is a stamped Delta over the SHARED store
//          (the same path that serialises on /sync later, DEC-25):
POST /role/{role_id}/delta   body: <Delta>    → { id }   // enforced + attributed by write_scope (DEC-15/NF2)
// out-of-scope delta ⇒ error code `write_scope_denied`.

// SURFACES — bespoke role UIs are REGISTERED render-components bound by config; they read via projections
//   (NF1) and write only via /role/{}/delta. A new surface is a RELEASE (conformance-tested, DEC-46);
//   config then selects/parameterises/binds it (release-then-compose; NO config-embedded code — Q15/DEC-50/51).
```
- A source provider is DETERMINISTIC within a version like any §D provider; it differs only in direction (push/stream of facts vs pull of fields). Reuses `provider_nondeterministic` (DEC-50).
- Roles, write-scopes and registered surfaces are **instance-shell** config (DEC-48) — identity-free, never part of the stamp.

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
- **Classification (Q15) sharpened by §E:** bespoke registered surfaces + live source-provider feeds are the system's largest classification surface; marking/enforcement on ingress deltas and per-role surfaces is designed-for, not resolved (DEC-31/61).
- Whether `/plan/scheme-handful` (§B) shares the `/plan/handful` async/job shape verbatim or specialises it.
