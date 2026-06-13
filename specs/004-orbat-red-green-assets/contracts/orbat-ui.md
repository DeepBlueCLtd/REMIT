# Contract — ORBAT authoring surface (`app/js/shell/orbat-panel.js`)

A config-declared role-tab (DEC-61 shell seed; natural home: the `sme-int` role — "red/green
entities and threat"). It mounts with the shared context `{ objects, world, playhead, … }` and reads
/ writes the roster **only** through `app/js/orbat/orbat.js` (contract: `orbat-store.md`).

## Affordances (testable contract)

| Affordance | Behaviour | Backing requirement |
|---|---|---|
| **Roster** | Three groups, **Blue (own force)**, **Red (hostile)**, **Green (neutral)**, listing each asset by label + key params. Empty groups show an explicit "none" state. The canonical own-force (ROVER-1) is shown in Blue, marked and protected from removal. | FR-001/012, edge: empty ORBAT |
| **Add blue / Add red / Add green** | Adds a default asset of that allegiance; placement via the map's click-to-pick-hex (spec 003 F5) or a default AO-centre position. Appears immediately in the roster and on the map. | FR-001/005, US1/US2/US3 |
| **Per-row tuners** | Numeric/range/select inputs for `label`, `extent_m`, and the allegiance group: `severity` + `active_windows` (red); `sensitivity` + `protection` (green); `availability` + `capabilities` (blue). Editing re-renders map + Sync-Matrix live. | FR-003, US1/US2/US3 |
| **Duplicate** | One click clones the row under a new id (never the `canonical_own_force` flag); the copy is independently tunable. | FR-006, US4 |
| **Remove** | Removes the row from roster and all views; others unaffected. The canonical own-force asset's remove control is disabled. | FR-006/012, US4 |
| **Validation feedback** | Out-of-range tunes and out-of-AO placements are clamped/rejected with an inline message; the asset never enters an invalid state. | FR-004, edges |
| **Selection** | Selecting a row highlights the asset on the map / Sync-Matrix and vice-versa (shared selection). | US5 |

## Projection contract (display-only)

- **Map** (`map.render`): each asset draws an allegiance-coloured point + faint extent ring +
  label, visually distinct across the three allegiances (FR-005). Blue own-force family, red
  `#ff7b72`-family, green `#38d39f`-family (palette in `key_facts.md`).
- **Sync Matrix** (`sync-matrix`): any asset with a time-varying aspect (red `active_windows`, a blue
  availability window) contributes a `window`-render track via a catalogue row; it stays aligned with
  the shared playhead and selection (FR-010/US5).
- **Honest floor + display-only**: nothing the panel shows implies adversary motion/assessment, and
  no tune (including blue availability/capability) changes the route or plan (FR-008/NF9).

## Persistence contract

- Every mutating affordance calls `saveDraft` (mirror to localStorage). On mount, `loadDraft`
  restores the roster and all tuned values exactly (FR-007/SC-004).
- A **Commit ORBAT** action mints an immutable version in the `ObjectStore` (lineage preserved).

## Non-goals (deferred, asserted by tests where cheap)

- No routing/kernel influence from any asset, including blue tuning (NF9/NF3) — the plan/route is
  unchanged by authoring.
- No capability-matched allocation of the blue force-pool (DEC-60 capability — H2): blue is
  display-only scaffolding; the existing planned own-force is reconciled, not re-implemented.
- No live ROE constraint / collateral objective emission (DEC-60 J3 capability — H2/H3).
