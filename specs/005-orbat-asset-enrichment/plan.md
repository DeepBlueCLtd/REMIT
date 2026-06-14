# Implementation Plan: ORBAT asset enrichment — kind, icons, confidence & red dual-range rings

**Branch**: `claude/spec-04-implement-0u0s9y` (spec dir `005-orbat-asset-enrichment`) | **Date**: 2026-06-13 | **Spec**: [spec.md](./spec.md)

**Input**: Feature specification from `specs/005-orbat-asset-enrichment/spec.md`

## Summary

Make the ORBAT map read like a recognised operational picture rather than coloured dots, without
crossing the honest floor (NF9). **Display-only, additive** enrichments to the spec-004 `Asset`:
a shared **platform `kind`** vocabulary that drives an allegiance-framed **map symbol** (with a
per-asset override), an intel **`confidence`** level (reusing the existing `ConfidenceLevel`) reflected
as marker emphasis + a roster badge, for red (hostile) assets **dual range rings**
(`detection_range_m` / `engagement_range_m`) replacing the single extent, and lightweight **descriptive
detail** (`strength`, `notes`, and a per-allegiance descriptor — red threat type, green category, blue
role). The serialisable shape is
added to the **LinkML schema** (Principle I) and regenerated; the *glyph lookup* (kind → symbol) is the
documented UI/behaviour carve-out and stays hand-written. Map rendering reuses the existing deck.gl
layers (a `TextLayer` glyph over the allegiance-coloured marker; a second `ScatterplotLayer` ring for
red). Nothing touches the kernel/routing; spec-004 drafts load unchanged via defaulting + migration.

## Technical Context

**Language/Version**: JavaScript (ES modules, `// @ts-check` + JSDoc); Node ≥ 20 for tooling.

**Primary Dependencies**: existing app stack — `maplibre-gl`, `@deck.gl/*` (`ScatterplotLayer`,
`TextLayer` already in `map.js`), `h3-js`, Vite (ADR-0014); LinkML toolchain (`schema/generate.sh`).
**No new runtime dependencies** (ADR-0014) — symbols are Unicode/emoji glyphs via the existing
`TextLayer`, not an icon atlas image.

**Storage**: in-browser. The enriched asset persists in the same localStorage ORBAT draft and
content-addressed `Orbat` commit established in spec 004 (DEC-35/ADR-0026).

**Testing**: `npm run test:unit` (`node --test`, `test/orbat.test.mjs`) for the model additions
(kind/confidence round-trip, dual-range clamp + `engagement ≤ detection`, spec-004 draft migration);
`npm run test:e2e` (`e2e/orbat.spec.ts`) for the authoring + projection surface; evidence screenshots
under `specs/005-orbat-asset-enrichment/evidence/`.

**Target Platform**: modern browser (static app served from `app/`); cloud + local dev.

**Project Type**: single static web app (no backend) — Option 1 layout.

**Performance Goals**: authoring feedback within one frame (SC-002); legible symbol picture at the
spec-004 scale (≥ 10 instances per allegiance).

**Constraints**: honest floor (NF9) — no attribute influences routing/the kernel; determinism (NF3) —
identical authoring ⇒ identical projection; additive + backward-compatible (FR-010) — spec-004 drafts
load with defaults, red migrates `extent_m` → `detection_range_m`; no new build machinery / runtime dep.

**Scale/Scope**: one ORBAT per scenario; seven platform kinds; three confidence levels; two extra red
radii; lightweight descriptive fields (strength, notes, red threat-type, green category, blue role).
Builds directly on spec 004; reuses its model/panel/projection.

## Constitution Check

*GATE: Must pass before Phase 0 research. Re-check after Phase 1 design.*

| Principle | Status | Notes |
|---|---|---|
| **I. LinkML is the data-model source of truth** (NON-NEGOTIABLE) | ✅ PASS (gated) | New persisted fields (`kind`, `symbol`, `confidence`, red `detection_range_m`/`engagement_range_m`) are added to the schema modules and regenerated. The **glyph lookup** (kind → emoji/Unicode) is a display/UI-only single-place table — the documented carve-out — and stays hand-written. |
| **II. No-build static app** | ✅ PASS | Stays in `app/js` ES modules + `// @ts-check`; symbols via the existing `TextLayer` (no icon-atlas asset, no new dep). (Vite already adopted under ADR-0014.) |
| **III. Spec-driven workflow + blog** | ✅ PASS | spec → plan → tasks → implement; blog post sketched below (Phase 2) and authored at implement. |
| **IV. Durable project memory** | ✅ PASS | New ADR (enrichment: kind/symbol/confidence + red dual-range, display-only) and `key_facts`/`issues` entries recorded at implement. |
| **V. Repo canonical + immutability** | ✅ PASS | Reuses spec-004's immutable committed `Orbat` with lineage; no change to the commit model. |

**No violations** → Complexity Tracking left empty.

## Project Structure

### Documentation (this feature)

```text
specs/005-orbat-asset-enrichment/
├── plan.md              # This file
├── spec.md              # Feature spec
├── research.md          # Phase 0 — decisions resolved
├── data-model.md        # Phase 1 — schema additions (kind/confidence + red dual-range)
├── contracts/
│   └── orbat-enrichment.md   # Model + UI + projection contract additions
├── quickstart.md        # Phase 1 — runnable validation guide
├── checklists/
│   └── requirements.md  # Spec quality checklist (done at /speckit-specify)
├── blog/                # Authored at /speckit-implement
└── evidence/            # Playwright screenshots captured at implement
```

### Source Code (repository root)

```text
schema/
├── common.yaml          # + PlatformKind enum + GreenCategory enum
├── orbat.yaml           # + Asset.kind/symbol/confidence/strength/notes; RedParams.detection_range_m/engagement_range_m/threat_type;
│                        #   GreenParams.category; BlueParams.role
└── gen/                 # REGENERATED (remit.schema.json, remit.ts) — do not hand-edit

app/js/
├── orbat/orbat.js       # tuneAsset: kind/symbol/confidence/strength/notes + per-allegiance descriptor + red dual-range clamp
│                        #   (engagement ≤ detection); defaults + spec-004 migration (extent_m → detection_range_m); SYMBOLS (UI carve-out)
├── shell/orbat-panel.js # + kind/icon/confidence + strength/notes + threat-type/category/role + red detection/engagement tuners
└── views/map.js         # symbol glyph (TextLayer) over allegiance marker; confidence → opacity; red two-ring rendering

test/orbat.test.mjs      # + kind/confidence round-trip, dual-range clamp/invariant, draft migration
e2e/orbat.spec.ts        # + typed-symbol + confidence emphasis + red dual-ring + route-unchanged
```

**Structure Decision**: Single static web app (Option 1). Extend the spec-004 surfaces in place —
schema (`common.yaml` enum + `orbat.yaml` fields, regenerated), the model module, the panel, and the
map renderer — rather than adding new modules. No new files beyond docs/tests.

## Complexity Tracking

> No constitution violations — section intentionally empty.

## Phase 2 — Blog post plan (REMIT)

Planning only (authored at `/speckit-implement` into `specs/005-orbat-asset-enrichment/blog/post.md`,
from `docs/blog-post-template.md`):

- **At a glance**: **"The ORBAT stops being coloured dots — typed symbols, an intel-confidence wash,
  and a threat's see-it vs hit-it rings, all still honest-floor display-only."** Featured screenshot:
  the map with kind symbols across the three sides and a red asset's two concentric range rings.
- **The problem**: spec 004 rendered every asset as a same-looking coloured dot with one extent ring —
  no platform type, no intel reliability, and a single radius that conflated a threat's detection and
  weapon reach.
- **Options**: (a) NATO APP-6/2525 symbology engine vs (b) a compact glyph lookup table; (c) deck.gl
  `IconLayer` with an icon atlas vs (d) a `TextLayer` Unicode/emoji glyph (no asset, no dep); (e) a new
  confidence scale vs reusing `ConfidenceLevel`; (f) red ranges as two `Asset.extent`s vs a `RedParams`
  detection/engagement pair.
- **The strategy**: schema-define `kind`/`symbol`/`confidence` + red `detection_range_m`/
  `engagement_range_m` and regenerate (Principle I); render symbols as `TextLayer` glyphs over the
  allegiance marker (no-build, no atlas); confidence → marker opacity + roster badge; enforce
  `engagement ≤ detection`; keep everything display-only (NF9) and backward-compatible (migrate the
  old single `extent_m`).
- **The results**: typed allegiance-framed symbols; a confidence wash; red dual rings; spec-004 drafts
  still load; route/plan unchanged by any tune; determinism preserved.
- **Screenshots to capture** (Playwright → `evidence/screenshots/*.png`): dots → typed symbols (before/
  after); the three allegiances with distinct kind glyphs; a low-confidence threat faded next to a
  high-confidence one; a red asset's detection + engagement rings; the enriched roster row (kind/icon/
  confidence/range tuners); a spec-004 draft loading intact after the upgrade.
