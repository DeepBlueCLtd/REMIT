# Implementation Plan: ORBAT — add & tune blue, red, and green assets

**Branch**: `claude/fervent-feynman-5g4dpb` (spec dir `004-orbat-red-green-assets`) | **Date**: 2026-06-12 | **Spec**: [spec.md](./spec.md)

**Input**: Feature specification from `specs/004-orbat-red-green-assets/spec.md`

## Summary

Bring all three sides of the ORBAT (DEC-60) — **blue** (own force), **red** (hostile), **green**
(neutral) — forward into the app as **display-only authoring scaffolding** (DEC-56 horizon split,
NF9 honest floor). A planner can add, duplicate, tune, and remove **multiple independent instances**
of each allegiance; each is a first-class **Entity** (DEC-52) carrying an **allegiance**, projected
onto the map (allegiance-coloured markers) and onto the Sync Matrix (a track when it carries a
time-varying aspect). Authoring/tuning never changes kernel routing in v1: the existing planned
own-force (ROVER-1) is reconciled as the canonical blue asset and keeps driving the plan unchanged;
blue pool assets seed the future Scheme allocation (the deferred capability). The serialisable shape
— the `Allegiance` enum, the per-allegiance asset parameters, and the `Orbat` container — is added to
the **LinkML schema** (Principle I, non-negotiable) and regenerated; the app imports the generated
types and reuses the existing entity/projection plumbing (`buildEntities` → map + `sync-matrix`). The
authored ORBAT persists across sessions.

## Technical Context

**Language/Version**: JavaScript (ES modules, `// @ts-check` + JSDoc); Node ≥ 20 for tooling.

**Primary Dependencies**: existing app stack — `h3-js`, `maplibre-gl`, `@deck.gl/*`, Vite (ADR-0014);
LinkML toolchain (`schema/generate.sh`) for the data model. **No new runtime dependencies** (ADR-0014:
deps minimised and maintainer-approved).

**Storage**: in-browser. Authored ORBAT persists via the browser (localStorage of the canonical
ORBAT JSON) so the scenario survives reload (FR-007); the content-addressed `ObjectStore`
(`app/js/stores/stores.js`) holds committed immutable versions with lineage.

**Testing**: `npm run test:unit` (`node --test`) for the ORBAT model (canonical/deterministic
add/duplicate/tune/remove, validation/clamping); `npm run test:e2e` (Playwright cloud wrapper) for
the authoring surface + map/Sync-Matrix projection; evidence screenshots under
`specs/004-orbat-red-green-assets/evidence/`.

**Target Platform**: modern browser (the static app served from `app/`); cloud + local dev.

**Project Type**: single static web app (no backend) — Option 1 layout below.

**Performance Goals**: authoring feedback is immediate (map/Sync-Matrix re-render on tune within one
frame); legible roster at ≥ 10 instances per allegiance (SC-002).

**Constraints**: determinism (NF3) — authored params are canonical inputs, identical inputs ⇒
identical plans/projections; honest floor (NF9) — no fabricated adversary behaviour; additive to the
data model (allegiance attribute + asset params only, DEC-60); no new build machinery.

**Scale/Scope**: one ORBAT per scenario; tens of asset instances; **three** allegiances authorable
(blue, red, green) at the display-only level — the existing planned own-force is reconciled as the
canonical blue asset and is unaffected by pool authoring.

## Constitution Check

*GATE: Must pass before Phase 0 research. Re-check after Phase 1 design.*

| Principle | Status | Notes |
|---|---|---|
| **I. LinkML is the data-model source of truth** (NON-NEGOTIABLE) | ✅ PASS (gated) | The persisted ORBAT/asset shape is serialisable object-core, so it is **schema-defined and regenerated**, never hand-authored: add `Allegiance` enum + `Asset`/`Orbat` to the schema modules, run `schema/generate.sh`, import the generated TS in `app/js`. **Display-only render closures** (aspect `at()` functions, the catalogue rows) stay hand-written — the documented carve-out for behaviour + UI-only shapes. |
| **II. No-build static app** | ✅ PASS | Stays in `app/js` ES modules + `// @ts-check`; **no new build machinery**. (Vite already adopted under ADR-0014 — a recorded deviation; this feature adds nothing new.) |
| **III. Spec-driven workflow + blog** | ✅ PASS | Following spec → plan → tasks → implement; blog post sketched in Phase 2 and authored at implement. |
| **IV. Durable project memory** | ✅ PASS | New ADR for "ORBAT blue/red/green authoring scaffolding" in `decisions.md`; `issues.md` work-log entry; `key_facts.md` for the allegiance palette/persistence key — recorded at implement. |
| **V. Repo canonical + immutability** | ✅ PASS | Committed ORBAT versions are immutable with lineage (the working draft is the editable surface; commit mints a new version). |

**No violations** → Complexity Tracking left empty.

## Project Structure

### Documentation (this feature)

```text
specs/004-orbat-red-green-assets/
├── plan.md              # This file
├── spec.md              # Feature spec
├── research.md          # Phase 0 — decisions resolved
├── data-model.md        # Phase 1 — schema additions (allegiance, asset, orbat)
├── contracts/
│   ├── orbat-store.md   # Persisted ORBAT object + add/duplicate/tune/remove operations
│   └── orbat-ui.md      # ORBAT authoring surface contract (affordances, validation, projection)
├── quickstart.md        # Phase 1 — runnable validation guide
├── checklists/
│   └── requirements.md  # Spec quality checklist (done at /speckit-specify)
├── blog/                # Authored at /speckit-implement (post.md + screenshots/)
└── evidence/            # Playwright screenshots captured at implement
```

### Source Code (repository root)

```text
schema/
├── common.yaml          # + Allegiance enum (blue|red|green)
├── entities.yaml        # + allegiance attribute on Entity
├── force.yaml           # (reference; Profile/State unchanged)
├── orbat.yaml           # NEW module: Orbat container + Asset (+ Blue/Red/GreenParams)
├── remit.yaml           # entry schema: import the new orbat module
└── gen/                 # REGENERATED (remit.schema.json, remit.ts) — do not hand-edit

app/js/
├── orbat/
│   └── orbat.js         # NEW: ORBAT model — add/duplicate/tune/remove, validation/clamp,
│                        #      canonicalisation; asset → Entity adapter (allegiance-typed)
├── entities/entities.js # buildEntities() folds in authored ORBAT assets as display-only entities
├── views/map.js         # render() draws allegiance-coloured asset markers (extent ring + label)
├── views/sync-matrix.js # (unchanged plumbing) shows asset tracks via the catalogue
├── shell/orbat-panel.js # NEW: the authoring surface (role-tab/panel) — roster + per-instance tuners
└── main.js              # wires the panel + feeds authored assets into map.render / entities

tests/ (node --test) and e2e/ (Playwright)
├── e2e/orbat.spec.js          # NEW: author → tune → see on map/matrix → persist across reload
└── app/js/orbat/*.test.js     # NEW: model unit tests (deterministic, validation/clamp)
```

**Structure Decision**: Single static web app (Option 1). The data core extends the LinkML schema
(new `orbat.yaml` module + two small edits to `common.yaml`/`entities.yaml`), regenerated into
`schema/gen/`. The app gains one model module (`app/js/orbat/orbat.js`) and one UI surface
(`app/js/shell/orbat-panel.js`), then reuses the existing entity → map/Sync-Matrix projection rather
than adding a parallel rendering path.

## Complexity Tracking

> No constitution violations — section intentionally empty.

## Phase 2 — Blog post plan (REMIT)

Planning only (authored at `/speckit-implement` into `specs/004-orbat-red-green-assets/blog/post.md`,
from `docs/blog-post-template.md`):

- **At a glance**: **"The ORBAT grows all three sides — drop in as many own-force, threat, and
  protected-place assets as a scenario needs, and tune each one."** Featured screenshot: the map with
  blue own-force, red threat rings, and green no-strike markers placed, plus the roster panel open.
- **The problem**: the entity catalogue was fixed in config and seeded only a single own force; a
  planner could not express the own-force pool, the adversary, or the neutral picture of a scenario.
- **Options**: (a) bespoke per-allegiance asset objects vs (b) reuse the allegiance-typed Entity +
  config catalogue; (c) free-form map drawing vs (d) a tunable parameter roster; (e) where the data
  lives — hand-written app type vs LinkML-generated; (f) blue display-only vs wired into the planner.
- **The strategy**: reuse Entity + allegiance (DEC-60), schema-define the serialisable shape and
  regenerate (Principle I), keep all three allegiances display-only under the DEC-56 guard / NF9
  honest floor (blue does not drive routing; own-force reconciled), project through the existing
  map + Sync-Matrix.
- **The results**: add/duplicate/tune/remove multiple instances of each allegiance; allegiance-coloured
  map markers; Sync-Matrix tracks for time-windowed assets; persistence across reload; determinism +
  unchanged-plan preserved.
- **Screenshots to capture** (Playwright → `evidence/screenshots/*.png`): empty ORBAT → one red asset
  placed → multiple blue+red+green assets with extent rings → a tuner adjusting threat extent
  (before/after) → a blue tune leaving the route unchanged → a time-windowed asset's track on the
  Sync Matrix → roster after duplicate/remove → scenario restored after reload.
