# Feature Specification: ORBAT asset enrichment — kind, icons, confidence & red dual-range rings

**Feature Branch**: `claude/spec-04-implement-0u0s9y` (spec dir `005-orbat-asset-enrichment`)

**Created**: 2026-06-13

**Status**: Draft

**Input**: User description: "Enrich the SME-Int ORBAT authoring tab with richer, display-only asset characteristics (additive to the existing Asset model from spec 004; honest floor NF9 — no asset influences routing/the kernel). Slice A: a shared platform-type 'kind' controlled vocabulary on every asset, NATO-style map icons keyed by kind + allegiance with an optional per-asset icon override, and an intel 'confidence' attribute surfaced on the map and the roster. Slice B: red (hostile) assets gain dual range rings — a detection range and an engagement/weapon range — replacing the single extent with two independently-tunable radii, each drawn as a distinct ring on the map."

## Overview

Spec 004 delivered the ORBAT authoring scaffolding: a planner can add, tune, duplicate, remove and
commit blue/red/green assets, each an allegiance-coloured dot on the map with a single extent ring.
This feature makes the picture **read like a recognised operational picture** rather than coloured
dots — without crossing the honest floor. It is **purely additive and display-only** (NF9): every
new attribute is authored intel that the operator sees; nothing influences routing or the kernel.

Two slices, each independently shippable:

- **Slice A — platform kind, icons, confidence** (the recognised-picture upgrade): a shared `kind`
  vocabulary, allegiance-framed symbols on the map, and intel confidence shown on every asset.
- **Slice B — red dual range rings**: a hostile asset's reach is split into a *detection* radius and
  an *engagement/weapon* radius, each tunable and drawn as its own ring.

## User Scenarios & Testing *(mandatory)*

### User Story 1 — Type an asset and see the right symbol (Priority: P1)

A planner adds an asset and chooses its **platform kind** (e.g. vehicle, aircraft, vessel, sensor,
emplacement, infantry, structure). The map marker becomes a **kind-and-allegiance symbol** — a
recognisable glyph framed by its side's colour — instead of a plain dot, so the operator reads the
picture at a glance. The planner can override the auto-chosen symbol for a specific asset.

**Why this priority**: turning dots into typed symbols is the single biggest legibility gain and the
foundation the other attributes hang off; it is entirely honest-floor-safe and additive.

**Independent Test**: add one asset of each allegiance, set a different `kind` on each, confirm each
map marker shows the corresponding kind+allegiance symbol; override one asset's icon and confirm only
that marker changes; confirm the route/plan is unchanged by any of it.

**Acceptance Scenarios**:

1. **Given** a new red asset, **When** its kind is set to "emplacement", **Then** its map marker shows
   the emplacement symbol framed in the red (hostile) affiliation and its roster row shows the kind.
2. **Given** two assets of the same kind and allegiance, **When** one's icon is overridden, **Then**
   only that asset's marker changes; the other keeps the auto-derived symbol.
3. **Given** any kind/icon change, **When** a course of action is already selected, **Then** the
   selected route and plan are byte-for-byte unchanged (display-only, NF9).

---

### User Story 2 — Record intel confidence on each asset (Priority: P1)

A planner records how reliable each asset's intel is — **high / medium / low** — and the map and
roster reflect it (e.g. a low-confidence threat renders faded / flagged), so the operator can weigh
the picture by trust.

**Why this priority**: confidence is the defining attribute of an *Intel* picture and reuses the
existing `ConfidenceLevel` vocabulary; it is cheap and high-signal.

**Independent Test**: add a red asset, set confidence to "low", confirm its marker and roster row
visibly indicate low confidence; raise it to "high" and confirm the indication updates; confirm no
effect on routing.

**Acceptance Scenarios**:

1. **Given** an asset with confidence "low", **When** it is rendered, **Then** the map marker is
   visibly de-emphasised (e.g. reduced opacity) and the roster shows a confidence indicator.
2. **Given** confidence is changed, **When** the change is made, **Then** the map and roster update
   immediately and the value persists across reload.

---

### User Story 3 — Tune a red threat's detection vs engagement reach (Priority: P2)

A planner gives a red (hostile) asset **two** range rings — an outer **detection** range and an inner
**engagement/weapon** range — and tunes each independently. The map draws both rings distinctly
(e.g. a faint outer detection ring and a bolder inner engagement ring), so the operator sees both
"where it can see me" and "where it can hit me".

**Why this priority**: a single extent conflates two operationally distinct reaches for a threat;
splitting them sharpens the red picture. It is the most threat-specific of the three slices, so P2.

**Independent Test**: add a red asset, set detection and engagement ranges to different values, confirm
two distinct rings render with the inner ≤ outer relationship enforced; tune one and confirm only that
ring changes; confirm green/blue assets are unaffected and keep their single extent.

**Acceptance Scenarios**:

1. **Given** a red asset, **When** detection range is set larger than engagement range, **Then** the
   map shows two concentric rings (detection outer, engagement inner).
2. **Given** a red asset, **When** the engagement range is set larger than the detection range,
   **Then** the values are reconciled so engagement ≤ detection, with feedback (never an invalid state).
3. **Given** a green or blue asset, **When** the roster is shown, **Then** it still presents a single
   extent control (dual rings are red-only).

---

### Edge Cases

- **Unknown / unset kind**: an asset with no kind chosen falls back to a generic allegiance-framed
  symbol (today's dot behaviour), never an empty/broken marker.
- **Icon override cleared**: removing an override reverts the marker to the auto-derived kind+allegiance
  symbol.
- **Out-of-bounds ranges**: detection/engagement radii are clamped to their declared bounds; the
  engagement radius is reconciled to be ≤ the detection radius (with feedback), never silently lost.
- **Spec-004 drafts**: an ORBAT draft authored before this feature (no kind/confidence/dual-range
  fields) loads cleanly — assets render with generic symbols, default confidence, and red assets adopt
  detection = the prior single extent with engagement defaulting within it.
- **Confidence absent**: an asset with no confidence set renders at full emphasis (treated as the
  highest/unflagged default) rather than appearing erroneously faded.

## Requirements *(mandatory)*

### Functional Requirements

- **FR-001**: Every asset MUST carry an optional **platform kind** drawn from a shared controlled
  vocabulary (at minimum: infantry, vehicle, aircraft, vessel, sensor, emplacement, structure);
  the vocabulary is the source of the asset's symbol.
- **FR-002**: The system MUST render each placed asset as a **symbol determined by its kind and
  allegiance** (affiliation framing per side), replacing the plain dot, and MUST fall back to a
  generic allegiance-framed symbol when kind is unset.
- **FR-003**: A planner MUST be able to **override** an individual asset's symbol; clearing the
  override MUST revert to the auto-derived kind+allegiance symbol.
- **FR-004**: Every asset MUST carry an optional **intel confidence** (high / medium / low) reusing
  the existing confidence vocabulary; the map MUST visibly reflect it (e.g. opacity) and the roster
  MUST show a confidence indicator.
- **FR-005**: Red (hostile) assets MUST support **two independently-tunable range radii** — a
  detection range and an engagement/weapon range — drawn as two visually-distinct rings on the map.
- **FR-006**: The system MUST keep the **engagement radius ≤ detection radius** invariant, reconciling
  (clamping) with inline feedback when an edit would violate it; values are never silently dropped.
- **FR-007**: Green and blue assets MUST retain their single extent control and single ring; dual-range
  rings are red-only.
- **FR-008**: All new attributes (kind, symbol override, confidence, detection/engagement ranges) MUST
  be part of the persisted, serialisable asset shape — defined once in the data-model source of truth
  and regenerated — and MUST round-trip through draft persistence, duplicate, and commit.
- **FR-009**: No new attribute MAY influence routing, the kernel, or any plan; tuning any of them MUST
  leave the selected route/plan unchanged (honest floor, NF9), and identical authoring MUST produce
  identical projections (determinism, NF3).
- **FR-010**: The feature MUST be **backward-compatible** with spec-004 drafts: a roster authored
  without these fields MUST load without error, with sensible defaults applied (generic symbol, full
  emphasis, red detection range seeded from the prior single extent).
- **FR-011**: The authoring panel MUST offer, per asset, a **kind selector**, an **icon picker** (with
  a clear-override affordance), a **confidence selector**, and — for red assets — **detection and
  engagement range tuners**.

### Key Entities *(include if feature involves data)*

- **Asset (extended)**: gains `kind` (platform vocabulary), an optional symbol/icon override,
  `confidence` (reusing the existing confidence levels), and — for the hostile parameter group — a
  `detection_range_m` and an `engagement_range_m` (the dual rings), alongside the spec-004 fields.
- **Platform kind vocabulary**: the controlled set of platform types that maps to symbols.
- **Symbol**: the rendered marker for an asset, derived from kind + allegiance, overridable per asset.

## Success Criteria *(mandatory)*

### Measurable Outcomes

- **SC-001**: An operator can distinguish each asset's **kind and side at a glance** from its map
  symbol, with no two of the seven kinds rendering identically within an allegiance.
- **SC-002**: Setting or changing an asset's kind, icon, confidence, or a red range updates the map and
  roster **within one frame** and persists across reload at 100% fidelity.
- **SC-003**: A red threat's **detection and engagement reaches are both visible and distinct** on the
  map, and the engagement ring is never drawn larger than the detection ring.
- **SC-004**: Tuning **any** enriched attribute leaves the selected route/plan **unchanged** (zero
  routing effect), and re-projecting an unchanged roster is **identical** (NF3).
- **SC-005**: An ORBAT authored under spec 004 **loads without error** after this feature ships, with
  every prior asset still visible and editable.

## Assumptions

- **Display-only, additive.** This builds directly on spec 004's Asset/Orbat model and its map +
  Sync-Matrix projection; it adds attributes and richer rendering only — no routing, allocation, or
  threat-reasoning behaviour (those remain deferred capabilities, NF9 / DEC-51 / DEC-60).
- **Source of truth.** The new fields are added to the LinkML schema (the `orbat` module / shared
  vocabulary) and regenerated; the app imports the generated types — consistent with ADR-0012/0026.
- **Confidence reuses the existing `ConfidenceLevel` vocabulary** (high/medium/low) rather than a new
  scale.
- **Symbol set.** A compact, recognisable symbol set keyed to the seven kinds with per-allegiance
  affiliation framing is sufficient for v1; full APP-6/MIL-STD-2525 fidelity is out of scope (a lookup
  table of glyphs, not a symbology engine).
- **Placement, persistence, duplicate/remove and commit are unchanged** from spec 004 and are reused.
- **Backward compatibility.** Spec-004 drafts in localStorage must keep loading; defaults fill the new
  fields. Red assets migrate their single `extent_m` to the detection range.
- **Map placement remains the spec-004 default-position model** (the panel and map live in different
  role-tabs); a richer place-on-map interaction is explicitly out of scope for this feature.
