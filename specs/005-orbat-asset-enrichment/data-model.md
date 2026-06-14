# Phase 1 — Data Model: ORBAT asset enrichment

**Source of truth = LinkML** (Principle I). The shapes below are authored in the schema modules and
**regenerated** into `schema/gen/remit.schema.json` + `schema/gen/remit.ts` via `schema/generate.sh`.
The app imports the generated TS. The kind → glyph lookup is the documented behaviour/UI carve-out and
stays hand-written in `app/js`.

## Schema additions

### `common.yaml` — new enum

```yaml
enums:
  PlatformKind:
    description: >-
      The platform/type class of an ORBAT asset (DEC-60). Orthogonal to allegiance; drives the
      map symbol. Display-only in v1 (NF9). v1 set, pluggable like ActivityType (NF7).
    permissible_values:
      infantry:    { description: dismounted personnel }
      vehicle:     { description: ground vehicle }
      aircraft:    { description: fixed/rotary wing }
      vessel:      { description: surface/sub-surface craft }
      sensor:      { description: sensor / radar / observation post }
      emplacement: { description: fixed weapon / SAM / fortified position }
      structure:   { description: building / installation / facility }
```

> `ConfidenceLevel` (high|medium|low) already exists in `common.yaml` — reused, not redefined.

### `common.yaml` — green category enum

```yaml
enums:
  GreenCategory:
    description: The category of a neutral/green protected place (DEC-60 J3); display-only in v1.
    permissible_values:
      hospital:         { description: medical facility }
      school:           { description: educational facility }
      utility:          { description: power / water / comms infrastructure }
      place_of_worship: { description: religious site }
      residential:      { description: populated residential area }
      other:            { description: uncategorised protected place }
```

### `orbat.yaml` — three attributes on `Asset`

```yaml
    attributes:
      # ...existing id/allegiance/label/position/extent_m/blue/red/green/canonical_own_force...
      kind:
        range: PlatformKind
        description: platform type (DEC-60); drives the map symbol. Absent ⇒ generic marker.
      symbol:
        description: optional per-asset symbol override (a glyph); absent ⇒ derived from kind + allegiance
      confidence:
        range: ConfidenceLevel
        description: intel reliability of this asset (DEC-19); rendered as marker emphasis + a roster badge
      strength:
        description: free-text strength descriptor (e.g. "×3", "platoon"); display-only
      notes:
        description: free-text operator notes; display-only
```

### `orbat.yaml` — descriptive + dual-range attributes on the param groups

```yaml
  RedParams:
    attributes:
      severity:       { ... }            # unchanged
      active_windows: { ... }            # unchanged
      detection_range_m:
        range: float
        description: outer reach the threat can DETECT within (metres); the faint outer ring
      engagement_range_m:
        range: float
        description: inner reach the threat can ENGAGE within (metres); the bold inner ring (≤ detection)
      threat_type:
        description: free-text threat/weapon type (e.g. SAM, MG, armour); display-only

  GreenParams:
    attributes:
      sensitivity: { ... }               # unchanged
      protection:  { ... }               # unchanged
      category:
        range: GreenCategory
        description: kind of protected place (hospital/school/…); display-only

  BlueParams:
    attributes:
      availability:        { ... }       # unchanged
      capabilities:        { ... }       # unchanged
      availability_window: { ... }       # unchanged (spec 004 fix)
      role:
        description: free-text own-force role (e.g. recce, C2, fires); display-only
```

> `Asset.extent_m` is retained for green/blue (their single ring). For red it is superseded by the dual
> ranges and used only as the migration source for `detection_range_m` (see Lifecycle below).

## Entities (summary of changes)

| Entity | New fields | Notes |
|---|---|---|
| **Asset** | `kind` (PlatformKind), `symbol` (string override), `confidence` (ConfidenceLevel), `strength` (string), `notes` (string) | all optional, additive; display-only |
| **RedParams** | `detection_range_m`, `engagement_range_m` (float), `threat_type` (string) | red-only dual rings (`engagement ≤ detection`) + threat descriptor |
| **GreenParams** | `category` (GreenCategory) | protected-place kind |
| **BlueParams** | `role` (string) | own-force role descriptor |

## Validation rules (from the spec)

- **FR-001/002**: `kind` ∈ the `PlatformKind` vocabulary (or unset → generic symbol). The rendered
  symbol is `symbol` if set, else derived from `kind` + `allegiance`, else the generic dot.
- **FR-004**: `confidence` ∈ {high, medium, low} (or unset → full-emphasis default).
- **FR-005/006**: `detection_range_m` and `engagement_range_m` are clamped to the extent bounds
  (`BOUNDS.extent_m`, 100..20000 m); `engagement_range_m` is reconciled to be ≤ `detection_range_m`
  (clamp + inline feedback), never silently dropped.
- **FR-007**: dual ranges apply to **red only**; green/blue validate/render the single `extent_m`.
- **FR-013**: green `category` ∈ the `GreenCategory` vocabulary (or unset); red `threat_type`, blue
  `role`, and shared `strength`/`notes` are free text (trimmed; empty ⇒ omitted, FR-014).
- **FR-009/015/NF9**: none of `kind`/`symbol`/`confidence`/`strength`/`notes`/`detection_range_m`/
  `engagement_range_m`/`threat_type`/`category`/`role` is read by the kernel or any plan term —
  display-only.

## Lifecycle / migration (FR-010, backward compatibility)

```text
load draft / committed Orbat ─► normalise(asset):
    kind absent        → leave unset (generic symbol)
    confidence absent  → leave unset (full-emphasis default)
    red & no dual range:
        detection_range_m  ← extent_m ?? DEFAULT_EXTENT.red
        engagement_range_m ← round(0.5 × detection_range_m), clamped, ≤ detection
```

- Normalisation is a **pure, idempotent** function of prior content, so canonical/sorted serialisation
  (DEC-35) and determinism (NF3) hold: a spec-004 draft canonicalises identically before and after a
  no-op normalise once migrated.
- Persistence, duplicate, remove and commit are **unchanged** from spec 004 (ADR-0026); the new fields
  ride along in the same canonical JSON draft and content-addressed `Orbat` commit.

## App rendering (display-only, hand-written carve-out)

- `map.js`: a `SYMBOLS` glyph lookup (`kind` → Unicode/emoji) renders an asset's symbol via the existing
  `TextLayer`, over the allegiance-coloured marker; `confidence` sets marker (and glyph) **opacity**.
  Red assets draw **two** `ScatterplotLayer` rings — faint outer `detection_range_m`, bold inner
  `engagement_range_m`; green/blue keep the single `extent_m` ring.
- `orbat-panel.js`: each row gains a **kind** selector, an **icon/symbol** picker with a clear-override
  affordance, a **confidence** selector, **strength** + **notes** inputs, a per-allegiance descriptor
  control (red **threat type** text, green **category** select, blue **role** text), and — for red rows —
  **detection** and **engagement** range tuners (the single extent tuner stays for green/blue). Empty
  descriptive values are omitted from the roster display, not shown blank.
