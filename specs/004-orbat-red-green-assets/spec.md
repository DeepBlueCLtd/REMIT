# Feature Specification: ORBAT — add & tune blue, red, and green assets

**Feature Branch**: `claude/fervent-feynman-5g4dpb` (cloud session; spec dir `004-orbat-red-green-assets`)

**Created**: 2026-06-12

**Status**: Draft

**Input**: User description: "Add red and green assets in the ORBAT (order of battle). Provide the ability to add and tune multiple instances of each asset." — extended in review to include **blue (own-force)** assets as a third authorable allegiance at the same display-only level, for symmetry with *one ontology, three stances* (DEC-60).

## Context — why

The ORBAT (Order of Battle) is the **authoring root** of the command-post stretch (DEC-60): it
catalogues the **participants and potential participants** of an operation before requirement and
plan authoring. Entities on the ORBAT are typed by **allegiance** — **blue** (own force), **red**
(hostile), **green** (neutral / host-nation / civilian) — under *one ontology, three stances*: the
kernel **plans-for** blue, **avoids-assesses** red, and **respects** green. DEC-60 is explicit that
the ORBAT populates **both** the Entity catalogue **and the blue force-pool a Scheme allocates**.

Today the entity catalogue is fixed in config and seeds a single own-force scenario. This feature
lets a planner **author all three sides of the ORBAT themselves** — placing as many own-force (blue),
hostile (red), and neutral (green) assets as the scenario needs, and **tuning each instance's
parameters independently**. Per the horizon-split guard (DEC-56): v1 ships the **authoring and
display scaffolding** — instances are first-class entities projected across the views. The
*reactive* adversary, and the **capability-matched allocation** of blue assets, remain designed-for,
not claimed: authoring/tuning a blue pool asset does **not** change kernel routing in v1 (NF9 — the
honest floor; NF3 — determinism). The existing planned own-force (ROVER-1) is reconciled as the
canonical blue asset and continues to drive the plan through the existing machinery, unchanged.

## User Scenarios & Testing *(mandatory)*

### User Story 1 - Add and tune hostile (red) asset instances (Priority: P1)

A planner opens the ORBAT and adds one or more **red** assets — a threat such as a patrol, a
sensor/observation post, or a weapon position. Each asset is placed in the area of operations and
its parameters are tuned independently: its label, its location, the extent/reach of the threat it
represents, and its severity. The planner can add several distinct red assets, each tuned to a
different position and reach, and see every one of them reflected on the map.

**Why this priority**: Red assets are the primary thing a mission plans *around*. Without the ability
to place and shape the threat picture, the planner cannot express the adversary side of a scenario at
all. This story alone is a viable slice: an authorable, visible red ORBAT.

**Independent Test**: Open the ORBAT with an empty red side, add two red assets with different
positions and threat extents, tune one, and confirm both appear distinctly on the map with the tuned
values — without touching the other allegiances.

**Acceptance Scenarios**:

1. **Given** an ORBAT with no red assets, **When** the planner adds a red asset and sets its location
   and threat extent, **Then** a hostile-typed entity appears on the roster and renders in the red
   allegiance style on the map at that location.
2. **Given** one red asset already present, **When** the planner adds a second with a different
   location, **Then** both persist as independent entries with independent parameters.
3. **Given** a red asset, **When** the planner tunes its threat extent or severity, **Then** the
   change is reflected in its depiction without affecting any other asset.
4. **Given** a red asset, **When** the scenario is viewed, **Then** the system shows the threat as
   **display-only** context and performs **no** fabricated adversary movement or reactive reasoning
   (honest floor).

---

### User Story 2 - Add and tune neutral (green) asset instances (Priority: P1)

A planner adds one or more **green** assets — a neutral or protected entity such as a host-nation
village, a civilian vessel, a hospital, or a no-strike area. Each green asset is placed and tuned
independently: its label, its location/extent, its sensitivity (collateral weight), and the nature of
the protection. The planner can maintain several green assets at once, each with its own parameters.

**Why this priority**: Green assets carry the rules-of-engagement and collateral picture — the
constraints a defensible plan must respect. They are co-equal with red in expressing a scenario, so
they share P1. Independently viable: an authorable, visible green ORBAT.

**Independent Test**: Open the ORBAT with an empty green side, add two green assets with different
locations and sensitivities, tune one, and confirm both render in the green allegiance style with the
tuned values — independent of the other allegiances.

**Acceptance Scenarios**:

1. **Given** an ORBAT with no green assets, **When** the planner adds a green asset and sets its
   location and sensitivity, **Then** a neutral-typed entity appears on the roster and renders in the
   green allegiance style on the map.
2. **Given** one green asset already present, **When** the planner adds a second with different
   parameters, **Then** both persist as independent, separately-tunable entries.
3. **Given** a green asset, **When** the planner tunes its sensitivity or extent, **Then** the change
   is reflected in its depiction without affecting any other asset.

---

### User Story 3 - Add and tune own-force (blue) asset instances (Priority: P2)

A planner adds one or more **blue** assets to the own-force pool — additional platforms/units beyond
the single planned own-force. Each blue asset is placed and tuned independently: its label, its
location, its extent, and an availability + capability stub (the vocabulary a future Scheme matches
to a requirement's activity needs). The depiction is **display-only**: blue pool assets populate the
force-pool and appear on the map, but tuning them does **not** alter kernel routing in v1 (the
capability-matched allocation is the deferred capability). The existing planned own-force (ROVER-1)
appears as the canonical blue asset and continues to drive the plan unchanged.

**Why this priority**: Authoring the blue force-pool completes the *one ontology, three stances*
symmetry and seeds the future Scheme allocation, but the essential v1 value (the threat + neutral
picture) is already delivered by P1, and own force is already planned by the existing machinery —
so this is completeness, at P2. It reuses the same add/tune pipeline as red/green.

**Independent Test**: Add two blue pool assets with different availability/capability stubs, tune
one, and confirm both render in the blue allegiance style alongside the existing own force — and that
the selected plan/route is **unchanged** by the tuning (display-only proof).

**Acceptance Scenarios**:

1. **Given** the ORBAT, **When** the planner adds a blue asset and sets its location and
   availability, **Then** an own-force-typed entity appears on the roster and renders in the blue
   allegiance style, distinct from red and green.
2. **Given** a blue asset, **When** the planner tunes its capability stub or availability, **Then**
   the change is reflected in the roster/depiction and the **plan and route are unchanged** (no
   kernel coupling in v1).
3. **Given** the existing planned own-force, **When** the ORBAT is opened, **Then** ROVER-1 is shown
   as the canonical blue asset (reconciled, not duplicated).

---

### User Story 4 - Manage the ORBAT roster (Priority: P2)

The planner manages the full set of blue, red, and green instances as a roster: rename an asset,
duplicate an existing asset as a starting point for a similar one, and remove an asset that is no
longer relevant. The roster — and every instance's tuned parameters — persists so the scenario can be
revisited across sessions.

**Why this priority**: Roster management makes authoring practical at the scale of a real scenario,
but the core value (add + tune + see) is already delivered by P1/US3. It builds on the other stories.

**Independent Test**: With several assets of each allegiance present, duplicate one, rename the copy,
remove a different asset, reload the scenario, and confirm the roster and all tuned values are exactly
as left.

**Acceptance Scenarios**:

1. **Given** several assets on the ORBAT, **When** the planner duplicates one, **Then** an independent
   copy is created carrying the source's parameters, which can then be tuned separately.
2. **Given** an asset on the ORBAT, **When** the planner removes it, **Then** it disappears from the
   roster and all views, and the remaining assets are unaffected. (The canonical planned own-force is
   protected from removal, or removal is handled predictably.)
3. **Given** an authored ORBAT, **When** the scenario is reloaded, **Then** every instance and its
   tuned parameters are restored exactly.

---

### User Story 5 - ORBAT instances appear across the planning views (Priority: P3)

Every instance is a first-class **entity** (DEC-52), so it appears not only on the map but wherever
the views project entities — including the Sync Matrix when an instance carries a time-varying aspect
(e.g. a patrol active only in certain windows, or a blue asset available only for part of the
mission). The depiction is display-only and synchronised with the shared playhead and selection.

**Why this priority**: Cross-view projection is the pay-off of modelling assets as entities, but the
map depiction in P1/US3 already delivers the essential authoring feedback. This is enrichment.

**Independent Test**: Add a red asset with an active-time window, scrub the shared timeline, and
confirm its track appears on the Sync Matrix and stays aligned with the map depiction.

**Acceptance Scenarios**:

1. **Given** an asset with a time-varying aspect, **When** the planner scrubs the playhead, **Then**
   the asset's Sync-Matrix track and its map depiction update together.
2. **Given** any ORBAT asset, **When** the planner selects it in one view, **Then** the selection is
   reflected in the other views.

---

### Edge Cases

- **Empty allegiance.** A scenario with no assets of a given allegiance is valid; views simply show
  none of that colour, and planning proceeds.
- **Many instances.** The roster stays legible and usable with a realistic count of similar assets
  across all three allegiances; instances stay individually identifiable and tunable.
- **Out-of-bounds placement.** An asset placed outside the area of operations is rejected or clamped
  with clear feedback rather than silently lost.
- **Out-of-range tuning.** A parameter tuned beyond its allowed bounds is rejected or clamped with
  feedback; the asset is never left in an invalid state.
- **Duplicate labels.** Two assets may share a human label; identity is tracked separately (not by
  the label).
- **The canonical own-force.** The existing planned own-force is reconciled as a blue asset, not
  duplicated; removing or invalidating it is prevented or handled predictably so the plan stays valid.
- **Removal of a referenced asset.** Removing an asset another part of the scenario refers to is
  handled predictably (blocked with explanation, or cascaded with notice) rather than leaving a
  dangling reference.

## Requirements *(mandatory)*

### Functional Requirements

- **FR-001**: The ORBAT MUST let a planner add a **blue (own-force)**, **red (hostile)**, or **green
  (neutral)** asset, each typed by allegiance, as a first-class entity in the scenario's entity
  catalogue.
- **FR-002**: The system MUST support **multiple independent instances** of each allegiance; adding,
  editing, or removing one instance MUST NOT affect any other.
- **FR-003**: Each instance MUST expose **tunable parameters** appropriate to its allegiance,
  including at minimum a human label, a location within the area of operations, an extent/reach, and
  an allegiance-specific group (red: severity, optional active windows; green: sensitivity,
  protection; blue: availability + a capability stub). Tuning a parameter MUST update only that
  instance.
- **FR-004**: The system MUST **validate** tuned parameters against their allowed bounds and reject
  or clamp out-of-range values with clear feedback, never leaving an instance in an invalid state.
- **FR-005**: Each instance MUST be rendered in its **allegiance style** (blue / red / green) on the
  map at its authored location, visually distinct across the three allegiances.
- **FR-006**: The planner MUST be able to **duplicate** an existing instance (an independent copy
  carrying the source's parameters) and **remove** an instance from the roster.
- **FR-007**: The ORBAT roster and every instance's tuned parameters MUST **persist** so the scenario
  can be revisited across sessions with all values restored.
- **FR-008**: All instances MUST be **display-only context** in this release: the system MUST NOT
  generate adversary behaviour, **and MUST NOT change kernel routing or the generated plans in
  response to authored blue/red/green parameters** (NF9 honest floor; reactive adversary and
  capability-matched allocation deferred per DEC-51/56).
- **FR-009**: The feature MUST NOT change the determinism of planning (NF3): authored ORBAT
  parameters are inputs; identical inputs MUST continue to yield identical plans and projections.
- **FR-010**: Instances that carry a time-varying aspect MUST project onto the Sync Matrix as a
  track, synchronised with the shared playhead and selection.
- **FR-011**: The feature MUST reuse the existing **entity / allegiance** vocabulary and the
  config-declared catalogue shape, so the ORBAT authoring path is *additive* to the data model
  (allegiance attribute + asset parameters only).
- **FR-012**: The existing planned own-force MUST be **reconciled** as the canonical blue asset
  (shown, not duplicated) and MUST continue to drive the plan through the existing machinery,
  unaffected by blue-pool authoring.

### Key Entities *(include if feature involves data)*

- **ORBAT**: The roster of participants and potential participants — the authoring root. Holds the
  collection of allegiance-typed asset instances and is the entry point that seeds downstream
  planning (and the blue force-pool a future Scheme allocates).
- **Asset instance**: A first-class **entity** (DEC-52) with identity, an **allegiance** (blue / red
  / green), a human label, a location/extent in the area of operations, and an allegiance-appropriate
  parameter group. Projected display-only across the views.
- **Red (hostile) parameters**: location, threat extent/reach, severity, optional active window(s).
  Threat *source* only in v1; reactive behaviour deferred.
- **Green (neutral) parameters**: location/extent, sensitivity (collateral weight), and protection
  nature (e.g. keep-out vs minimise-effect). Constraint/objective *emission* deferred; display-only.
- **Blue (own-force) parameters**: location/extent, availability, and a capability stub (the
  vocabulary a future Scheme matches to activity needs). Allocation *capability* deferred;
  display-only — does not drive routing in v1.
- **Allegiance**: The blue / red / green typing that selects the kernel stance (plan-for /
  avoid-assess / respect) and the rendering style.

## Success Criteria *(mandatory)*

### Measurable Outcomes

- **SC-001**: A planner can add a new asset of any allegiance, place it, and see it on the map in
  **under 30 seconds**, with no prior training beyond the on-screen affordances.
- **SC-002**: A planner can maintain **at least 10 instances of each allegiance** on one ORBAT, with
  every instance remaining individually identifiable and independently tunable.
- **SC-003**: Tuning any single instance's parameter changes **only that instance** in **100%** of
  cases — no other instance is affected.
- **SC-004**: After authoring an ORBAT and reloading the scenario, **100%** of instances and their
  tuned parameter values are restored exactly.
- **SC-005**: Across the feature, the system produces **zero** fabricated adversary behaviour and the
  selected plan/route is **unchanged** by any blue/red/green tuning — every depicted effect traces
  directly to a planner-authored parameter (honest-floor + display-only audit).
- **SC-006**: Re-planning the same scenario with an unchanged ORBAT yields **identical** plans and
  projections (determinism preserved).

## Assumptions

- **Display-only scope (v1).** All three allegiances are authored at the same shape-scaffolding level
  (DEC-56 freeze guard). Red assets are passive threat *sources*; green assets are passive
  collateral/ROE *markers*; blue pool assets are *display-only force-pool members* — none yet emits
  live kernel constraints/objectives, reacts, or alters routing. Capability (capability-matched
  allocation, reactive adversary, constraint/objective emission) is designed-for and deferred
  (DEC-59/60/61).
- **Own-force reconciliation.** The single existing planned own-force (ROVER-1) is surfaced as the
  canonical blue asset and keeps driving the plan via the existing machinery; ORBAT blue authoring
  adds *additional* pool members without changing how the plan is computed.
- **Reuse the entity model.** Assets are modelled as existing allegiance-typed **entities** (DEC-52)
  in the config-declared catalogue (DEC-48…50); the only data-model additions are the allegiance
  attribute and the per-asset tunable parameters (DEC-60), not a new object family.
- **Area of operations.** Assets are placed within the current H3-hex area of operations and located
  by hex/lat-lon consistent with the existing map and routing (spec 003).
- **Parameter set.** The concrete per-allegiance parameter list is a reasonable starter set chosen at
  design time; the spec fixes the *shape* (label + location + extent + allegiance-specific group),
  not the exact field names or scales.
- **Persistence.** The existing scenario/store mechanism is reused to persist the ORBAT; no new
  storage system is introduced.
- **Single planner, sequential.** Authoring is by a single user in v1 (multi-user role distribution
  and stamped-delta concurrency remain the DEC-61 deferred seam).
