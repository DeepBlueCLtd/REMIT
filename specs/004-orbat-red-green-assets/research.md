# Phase 0 — Research & Decisions: ORBAT red/green assets

All decisions resolve the spec's assumptions into concrete design choices, grounded in the existing
codebase and the register (DEC-52/56/60, NF3/NF9). No open `NEEDS CLARIFICATION` remain.

## D1 — Model assets as allegiance-typed Entities, not a new object family

- **Decision**: Each red/green asset is a first-class **Entity** (DEC-52) carrying an **allegiance**.
  Reuse the existing entity → projection plumbing (`buildEntities` → `map` + `sync-matrix`).
- **Rationale**: DEC-60 mandates "reuses entities/providers/commitments wholesale; adds only the
  asset-capability vocabulary + allegiance attribute." A parallel asset type would duplicate the
  projection machinery and violate the additive-only guard.
- **Alternatives considered**: a standalone `ThreatMarker`/`RoeZone` type (rejected — duplicates
  Entity, breaks one-ontology/three-stances symmetry); piggy-backing on `Channel`/excursions
  (rejected — that is the *capability* path, deferred to H2/H3, and would imply kernel coupling).

## D2 — Schema-define the serialisable shape and regenerate (Principle I)

- **Decision**: Add `Allegiance` enum (`blue|red|green`) to `schema/common.yaml`; add an optional
  `allegiance` attribute to `Entity` in `schema/entities.yaml`; add a new `schema/orbat.yaml` module
  with `Orbat` (the roster container) and `Asset` (+ red/green parameter groups), imported by
  `schema/remit.yaml`. Run `schema/generate.sh`; the app imports the generated TS.
- **Rationale**: the persisted ORBAT is serialisable object-core → it is exactly what LinkML owns
  (Principle I, NON-NEGOTIABLE). Hand-authoring it in `app/js` would be the re-listing anti-pattern.
- **Alternatives considered**: hand-written app typedef (rejected — Principle I); deferring schema
  work to a later capability spec (rejected — persistence is in-scope now, so the shape must be
  authored now). The **render closures** (aspect `at()` time-functions) stay hand-written — the
  documented behaviour/UI carve-out.
- **Note**: `schema/generate.sh` bootstraps a LinkML venv (distro `pip` can't install LinkML — see
  `bugs.md`); regenerated files in `schema/gen/` are outputs, never hand-edited.

## D3 — Per-allegiance parameter set (the starter shape)

- **Decision**: every Asset carries `id` (stable identity), `allegiance`, `label`, `position`
  (an AO location — H3 cell / lat-lon, consistent with spec 003), and an `extent` (reach in metres /
  hex radius). Allegiance-specific groups:
  - **Red (hostile)**: `severity` (graded scale, e.g. 1–5), and optional `active_windows`
    (mission-minute `[start,end]` list) for a time-varying threat (the Sync-Matrix track).
  - **Green (neutral)**: `sensitivity` (collateral weight, graded scale), and `protection`
    (nature of the rule — e.g. `keep_out` vs `minimise_effect`), tagged for the future
    hard-constraint / soft-objective split (DEC-60 J3), but **inert** in v1.
- **Rationale**: fixes the *shape* the spec promised (label + location + extent + severity/sensitivity
  per allegiance) while leaving exact scales tunable; the red `active_windows` is what makes an asset
  project as a Sync-Matrix track, reusing the existing `window` aspect render type.
- **Alternatives considered**: a single flat param bag for both allegiances (rejected — loses the
  differentiated-machinery intent of DEC-60); modelling green ROE as live commitments now (rejected —
  that emission is the deferred capability, NF9).

## D4 — Authoring surface: a roster panel with per-instance tuners

- **Decision**: a new surface `app/js/shell/orbat-panel.js` (a config-declared role-tab in the
  DEC-61 shell seed, `shell/roles.js`) presenting the roster (grouped red/green), an **Add** action
  per allegiance, and per-row **duplicate / remove / tune** controls. Placement uses the existing
  map click-to-pick-hex affordance (spec 003 F5); tuning uses numeric/range inputs bound to the
  draft asset.
- **Rationale**: reuses the existing shell/role-tab pattern and the map's pick-hex interaction;
  keeps authoring in one legible place (SC-001/002). The SME-Intel role (`sme-int`, already described
  as "red/green entities and threat") is the natural home.
- **Alternatives considered**: inline map-only editing with no roster (rejected — poor legibility at
  ≥ 10 instances, SC-002); a modal dialog per asset (rejected — slower to tune/compare many).

## D5 — Persistence: canonical ORBAT JSON in localStorage; immutable versions in the store

- **Decision**: the **working draft** ORBAT lives in app state and is mirrored to `localStorage`
  under a fixed key (canonical JSON) so it survives reload (FR-007/SC-004). Committing mints an
  immutable, content-addressed version in the existing `ObjectStore` with lineage (Principle V).
- **Rationale**: the in-memory `ObjectStore` is a mock that does not survive reload; localStorage is
  the lightest durable store consistent with "no backend". Canonical JSON keeps identity stable
  (DEC-35) and feeds determinism (D6).
- **Alternatives considered**: IndexedDB (rejected — overkill for one small object); URL-encoded
  scenario (rejected — unwieldy at scale, though a nice future share-link); server persistence
  (rejected — no backend).

## D6 — Determinism (NF3) and the honest floor (NF9)

- **Decision**: assets are sorted by `id` and canonicalised before they enter `buildEntities` /
  `map.render`; rendering and any downstream plan identity key off the canonical form. Assets are
  **display-only**: no asset influences routing/the kernel, and nothing is synthesised beyond
  authored params.
- **Rationale**: NF3 requires identical inputs ⇒ identical outputs; canonical, sorted inputs
  guarantee it. NF9 (honest floor) forbids fabricated adversary reasoning until the DEC-51 discipline
  exists — so red is a passive threat *source* only.
- **Alternatives considered**: insertion-ordered lists (rejected — order would leak into identity);
  letting red assets nudge `edgeCost` for a "plan-around" demo (rejected — that is the deferred
  avoid-assess capability and would breach NF9 in v1).

## D7 — Map depiction

- **Decision**: extend `map.render` to draw authored assets: a `ScatterplotLayer` point at the
  asset position in the allegiance colour, a faint extent ring (radius = `extent`), and a `TextLayer`
  label — reusing the existing marker layers. Palette recorded in `key_facts.md`: red `#ff7b72`-family
  (already the obstruction colour), green `#38d39f`-family (already a coincidence colour), distinct
  from own-force markers.
- **Rationale**: reuses the existing deck.gl layers (`ScatterplotLayer`/`TextLayer`) already in
  `map.js`; no new rendering dependency.
- **Alternatives considered**: deck.gl `IconLayer` with NATO-style symbols (deferred — nice polish,
  more asset plumbing than v1 scaffolding needs).
