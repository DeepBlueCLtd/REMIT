# Contract — ORBAT asset enrichment (additions to spec 004)

Additive to the spec-004 contracts (`orbat-store.md`, `orbat-ui.md`). The ORBAT model
(`app/js/orbat/orbat.js`) stays the only writer; UI and rendering read through it. All operations
remain pure/deterministic and display-only (NF9): no addition here is read by the kernel or any plan.

## Types (regenerated from the schema — do not redeclare)

`Asset` gains `kind: PlatformKind?`, `symbol: string?`, `confidence: ConfidenceLevel?`, `strength:
string?`, `notes: string?`. `RedParams` gains `detection_range_m: number?`, `engagement_range_m:
number?`, `threat_type: string?`. `GreenParams` gains `category: GreenCategory?`. `BlueParams` gains
`role: string?`. `PlatformKind` and `GreenCategory` are new enums; `ConfidenceLevel` is the existing one.

## Model operations (additions / changes)

| Function | Change | Guarantees |
|---|---|---|
| `tuneAsset(orbat, id, patch)` | accepts `kind`, `symbol`, `confidence`, `strength`, `notes` on the asset; `detection_range_m`/`engagement_range_m`/`threat_type` inside `patch.red`; `category` inside `patch.green`; `role` inside `patch.blue` | clamps both ranges to `BOUNDS.extent_m`; reconciles `engagement_range_m ≤ detection_range_m` (FR-006); validates `kind`/`confidence`/`category` against their vocabularies; trims free-text + drops empties; touches only the targeted asset (SC-003). |
| `normalize(orbat)` (new, applied by `loadDraft`/`getDraft`) | defaults absent fields; **migrates** a red asset's single `extent_m` → `detection_range_m`, seeding `engagement_range_m` ≤ it | pure + idempotent; preserves canonical bytes/identity for already-migrated rosters (NF3/FR-010). |
| `addAsset(orbat, { allegiance, … })` | red seeds `detection_range_m`/`engagement_range_m` defaults; all allegiances may carry `kind`/`confidence` | unchanged id/isolation guarantees. |
| `validate(asset)` | also checks `kind ∈ PlatformKind`, `confidence ∈ ConfidenceLevel`, range bounds + `engagement ≤ detection` | `{ ok, issues[] }`; display feedback, never blocks. |
| `symbolOf(asset)` (new, UI carve-out) | returns the glyph: `asset.symbol` if set, else `SYMBOLS[kind]`, else the generic dot | pure; no kernel reference. |

`duplicateAsset` / `removeAsset` / `commit` / `canonical` / `reconcileOwnForce` are **unchanged** — the
new fields deep-copy, persist, and canonicalise like any other asset field.

## UI affordances (panel — additions to `orbat-ui.md`)

| Affordance | Behaviour | Backing requirement |
|---|---|---|
| **Kind selector** | per-row select over the `PlatformKind` vocabulary; changes the map symbol live. | FR-001/002, US1 |
| **Icon/symbol picker** | choose an override glyph for one asset; a **clear** affordance reverts to the kind+allegiance default. | FR-003, US1 |
| **Confidence selector** | per-row high/medium/low; map emphasis + roster badge update live. | FR-004, US2 |
| **Red dual-range tuners** | red rows show **detection** and **engagement** range inputs (replacing the single extent); the single extent tuner remains for green/blue. | FR-005/006/007, US3 |
| **Strength + notes** | per-row strength descriptor and free-text notes; shown in the roster, omitted when empty. | FR-012/014, US4 |
| **Per-allegiance descriptor** | red **threat type** (text), green **category** (select over `GreenCategory`), blue **role** (text). | FR-013, US4 |

## Projection contract (display-only)

- **Map** (`map.render`): each asset draws its **symbol glyph** (`TextLayer`) over the allegiance
  marker; **confidence** sets marker/glyph **opacity** (high→full, medium→~0.6, low→~0.35). **Red**
  assets draw a faint outer **detection** ring and a bold inner **engagement** ring (`detection ≥
  engagement`); green/blue draw their single extent ring. Existing `data-assets` attribute is retained;
  it MAY be extended with kind/confidence for e2e assertions.
- **Honest floor + determinism**: nothing the panel/map shows changes the route or plan (FR-009/NF9);
  identical authoring ⇒ identical projection (NF3).

## Non-goals (deferred)

- No NATO APP-6/2525 symbology engine or affiliation frame shapes (a glyph lookup, not an engine).
- No icon-atlas image asset / new dependency (glyphs via `TextLayer`).
- No routing/kernel influence from any enriched attribute (the avoid-assess capability stays deferred,
  DEC-51); no richer place-on-map interaction (spec-004 default placement reused).
