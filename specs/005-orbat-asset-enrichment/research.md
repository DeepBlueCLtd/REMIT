# Phase 0 — Research & Decisions: ORBAT asset enrichment

All decisions resolve the spec's choices against the spec-004 codebase, the register (DEC-52/60, NF3/
NF9) and the constitution (Principle I, no-build). No open `NEEDS CLARIFICATION` remain.

## D1 — Symbols as `TextLayer` glyphs, not an icon atlas

- **Decision**: render each asset's symbol as a **Unicode/emoji glyph** via the existing deck.gl
  `TextLayer` (already imported in `map.js`), drawn over the allegiance-coloured `ScatterplotLayer`
  marker that supplies the affiliation framing/colour. A hand-written `SYMBOLS` lookup maps each
  `kind` → glyph; an unset kind falls back to today's dot. A per-asset `symbol` override replaces the
  glyph string.
- **Rationale**: no icon-atlas image, no new dependency, no build step (Principle II) — and it is
  deterministic. The glyph lookup is display/UI-only behaviour (the documented ADR-0012 carve-out), so
  it stays in `app/js`; only the *data* (`kind`, `symbol`, `confidence`) is schema-defined.
- **Glyph table (v1, illustrative — tunable at implement)**: infantry 👤 · vehicle 🚙 · aircraft ✈ ·
  vessel 🚢 · sensor 📡 · emplacement 🛡 · structure 🏢 · (unset) ● .
- **Alternatives considered**: deck.gl `IconLayer` with an SVG/PNG atlas (rejected — needs a bundled
  image asset + atlas plumbing, heavier than v1 scaffolding warrants); a full APP-6/MIL-STD-2525
  symbology engine (rejected — out of scope per the spec; a lookup table, not an engine). Affiliation
  *frame shapes* (hostile diamond / neutral square / friendly rectangle) deferred — colour framing via
  the existing circular marker is enough for v1; PolygonLayer frames are a later polish.

## D2 — `kind` is a schema enum; the glyph map is UI

- **Decision**: add a `PlatformKind` enum to `schema/common.yaml`
  (`infantry|vehicle|aircraft|vessel|sensor|emplacement|structure`) and an optional `Asset.kind`
  (range `PlatformKind`) + optional `Asset.symbol` (string override) to `schema/orbat.yaml`; regenerate.
- **Rationale**: `kind` is persisted, serialisable object-core → Principle I owns it. The kind→glyph
  rendering is behaviour/UI (carve-out). Keeping the vocabulary in the schema means the HTML reference
  and JSON Schema document the allowed kinds.
- **Alternatives considered**: a free-text `kind` string (rejected — loses the controlled vocabulary
  the symbol map keys off, and validation); per-allegiance kind enums (rejected — kind is orthogonal to
  side; an emplacement can be red or blue).

## D3 — Confidence reuses `ConfidenceLevel`; rendered as emphasis

- **Decision**: add optional `Asset.confidence` (range the existing `ConfidenceLevel` =
  high|medium|low). The map reflects it as **marker opacity** (high ≈ 1.0, medium ≈ 0.6, low ≈ 0.35)
  and the roster shows a small confidence badge. Absent ⇒ rendered at full emphasis (treated as the
  unflagged default).
- **Rationale**: confidence is the defining attribute of an *Intel* picture and the vocabulary already
  exists (no new scale, no schema churn beyond the attribute). Opacity is an honest, pre-attentive cue
  that needs no extra layer.
- **Alternatives considered**: a numeric 0–1 confidence (rejected — `ConfidenceLevel` is the
  project-standard banding, NF10-style); a separate legend/encoding (deferred — opacity + badge suffice
  for v1).

## D4 — Red dual ranges live on `RedParams`; `engagement ≤ detection` enforced

- **Decision**: add `detection_range_m` and `engagement_range_m` (both `float`) to `RedParams`. The map
  draws a **faint outer detection ring** and a **bolder inner engagement ring**. `tuneAsset` clamps both
  to the extent bounds and reconciles `engagement_range_m ≤ detection_range_m` (with inline feedback),
  never silently dropping a value (FR-006). Green/blue keep the single `Asset.extent_m` + single ring.
- **Rationale**: a threat's "where it can see me" and "where it can hit me" are operationally distinct;
  putting both on `RedParams` keeps them red-only (FR-007) and leaves green/blue untouched. Reuses the
  existing `ScatterplotLayer` ring (two instances) — no new layer type.
- **Alternatives considered**: two `Asset.extent` fields shared by all allegiances (rejected — green/
  blue don't have a detection/engagement distinction); a single extent + a ratio (rejected — less
  legible/tunable than two explicit radii).

## D5 — Backward compatibility: default + migrate spec-004 drafts

- **Decision**: loading is tolerant (FR-010). Assets without `kind`/`symbol` render the generic dot;
  without `confidence` render at full emphasis. A **red** asset without dual ranges **migrates** its
  prior single `extent_m` to `detection_range_m`, with `engagement_range_m` defaulting to a fraction
  (e.g. 0.5 × detection) within it. Migration happens on load/normalisation in the model, idempotently.
- **Rationale**: spec-004 drafts already live in users' localStorage and committed `Orbat`s; they must
  keep loading and rendering (SC-005). Canonical/sorted serialisation (DEC-35/NF3) is preserved because
  migration is a pure function of the prior content.
- **Alternatives considered**: a versioned migration framework (rejected — overkill for one additive
  step; a normalising loader is enough); refusing old drafts (rejected — breaks persistence guarantees).

## D6 — Honest floor (NF9) & determinism (NF3) unchanged

- **Decision**: no new attribute is read by the kernel, `buildEntities` plan terms, or any routing
  path. The enriched fields feed only the marker glyph/opacity/rings and the roster. Identical authoring
  ⇒ identical canonical bytes ⇒ identical projection.
- **Rationale**: this is display-only scaffolding (DEC-56/ADR-0026). Threat-reactive routing remains the
  deferred avoid-assess capability (DEC-51). An e2e re-asserts "tune ⇒ committed Plan ids unchanged".
- **Alternatives considered**: letting `engagement_range_m` nudge `edgeCost` for a plan-around demo
  (rejected — breaches NF9 in v1; that is the deferred capability).
