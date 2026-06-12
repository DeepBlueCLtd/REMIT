# Phase 1 — Data Model: ORBAT red/green assets

**Source of truth = LinkML** (Principle I). The shapes below are authored in the schema modules and
**regenerated** into `schema/gen/remit.schema.json` + `schema/gen/remit.ts` via `schema/generate.sh`.
The app imports the generated TS; it does not hand-author these shapes. Render closures (aspect
time-functions) are the documented behaviour/UI carve-out and stay in `app/js`.

## Schema additions

### `common.yaml` — new enum

```yaml
enums:
  Allegiance:
    description: >-
      Side typing on an entity (DEC-60). Selects the kernel STANCE — plan-for (blue) /
      avoid-assess (red) / respect (green). v1 is display-only (NF9 honest floor).
    permissible_values:
      blue:  { description: own force }
      red:   { description: hostile / adversary (threat source; passive in v1) }
      green: { description: neutral / host-nation / civilian (ROE & collateral; inert in v1) }
```

### `entities.yaml` — one attribute on `Entity`

```yaml
    attributes:
      # ...existing id/label/kind/provenance/aspects...
      allegiance:
        range: Allegiance
        description: side typing (DEC-60); absent ⇒ unaligned/own-context as today
```

> Additive and optional, so existing entities (self/tide/sat) remain valid.

### `orbat.yaml` — NEW module (imported by `remit.yaml`)

```yaml
classes:
  Orbat:
    description: >-
      The roster of participants & potential participants for a scenario — the authoring root
      (DEC-60). Versioned & immutable when committed (lineage); the editable working draft mirrors
      to localStorage. v1 authors the red & green sides; blue is the existing own force.
    attributes:
      id: { identifier: true, description: content id of the canonical form (DEC-35) }
      name: {}
      version: { range: integer }
      assets: { range: Asset, multivalued: true, inlined_as_list: true }
      lineage: { range: Lineage, inlined: true }

  Asset:
    description: >-
      One ORBAT entry — a first-class located thing (DEC-52) typed by allegiance, with
      independently-tunable parameters. Display-only in v1.
    attributes:
      id:         { identifier: true, description: stable per-instance identity (not the label) }
      allegiance: { range: Allegiance, required: true }
      label:      { description: human label; need not be unique }
      position:   { range: Waypoint, inlined: true, description: AO location (H3 cell / lat-lon) }
      extent_m:   { range: float, description: reach/footprint radius in metres }
      red:        { range: RedParams, inlined: true, description: present iff allegiance = red }
      green:      { range: GreenParams, inlined: true, description: present iff allegiance = green }

  RedParams:
    description: Hostile threat picture (threat SOURCE only in v1; reactive behaviour deferred, DEC-51).
    attributes:
      severity:       { range: integer, description: graded threat severity (e.g. 1..5) }
      active_windows: { range: TimeWindow, multivalued: true, inlined_as_list: true,
                        description: mission-minute windows the threat is active (Sync-Matrix track) }

  GreenParams:
    description: Neutral / collateral picture (ROE & collateral emission deferred; inert in v1, DEC-60 J3).
    attributes:
      sensitivity: { range: integer, description: graded collateral weight (e.g. 1..5) }
      protection:  { range: Protection, description: nature of the rule (tagged for the future hard/soft split) }

  TimeWindow:
    description: A mission-minute interval [start,end].
    attributes:
      start_min: { range: integer, required: true }
      end_min:   { range: integer, required: true }

enums:
  Protection:
    permissible_values:
      keep_out:        { description: no-go / no-strike area (future HARD constraint) }
      minimise_effect: { description: collateral to be minimised (future SOFT objective) }
```

> `Waypoint` and `Lineage` already exist in the schema (reused, not redefined).

## Entities (summary)

| Entity | Key fields | Relationships | Notes |
|---|---|---|---|
| **Orbat** | `id`, `version`, `assets[]`, `lineage` | contains `Asset[]` | versioned/immutable when committed; working draft in localStorage |
| **Asset** | `id`, `allegiance`, `label`, `position`, `extent_m` | `red` xor `green` params | first-class Entity (DEC-52); display-only |
| **RedParams** | `severity`, `active_windows[]` | `TimeWindow[]` | threat source only (NF9) |
| **GreenParams** | `sensitivity`, `protection` | `Protection` enum | inert in v1 (DEC-60 J3) |

## Validation rules (from the spec)

- **FR-001/003**: an Asset MUST have `allegiance ∈ {red, green}` (blue is out of scope here),
  a `position` inside the AO, and the parameter group matching its allegiance.
- **FR-002**: `id` is unique per instance and never reused; duplicating mints a fresh `id`.
- **FR-004**: `extent_m`, `severity`, `sensitivity` are clamped to their declared bounds; an
  `active_window` MUST satisfy `start_min ≤ end_min` (rejected/clamped with feedback otherwise).
- **Edge — out-of-bounds position**: rejected or clamped to the AO with feedback (never silently lost).
- **Edge — duplicate labels**: permitted; identity is `id`, not `label`.
- **FR-008/NF9**: no field drives kernel behaviour; all are display inputs only.

## Lifecycle / state

```text
(draft) add ──► tune ──► duplicate / remove ──► tune …     ┐ mirrored to localStorage each change
                                                            │
                              commit ──► Orbat v_n (immutable, content-addressed, lineage→v_{n-1})
```

- The editable surface is the **draft**; **commit** mints an immutable `Orbat` version in the
  `ObjectStore` (Principle V). Reload restores the draft from localStorage (SC-004).
- Canonical/sorted-by-`id` serialisation underpins determinism (NF3) and stable content ids (DEC-35).

## App adapter (display-only, hand-written — carve-out)

`app/js/orbat/orbat.js` maps each committed/draft `Asset` → an `Entity` for `buildEntities()`:
`{ id, label, allegiance, provenance:{kind:'actor'}, aspects }`. Red assets with `active_windows`
expose a `window`-type aspect (reusing the satellite-pass render path) so they appear as Sync-Matrix
tracks; position feeds the map marker. No `at()` closure references the kernel or alters a plan.
