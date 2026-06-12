# Contract — ORBAT authoring surface (`app/js/shell/orbat-panel.js`)

A config-declared role-tab (DEC-61 shell seed; natural home: the `sme-int` role — "red/green
entities and threat"). It mounts with the shared context `{ objects, world, playhead, … }` and reads
/ writes the roster **only** through `app/js/orbat/orbat.js` (contract: `orbat-store.md`).

## Affordances (testable contract)

| Affordance | Behaviour | Backing requirement |
|---|---|---|
| **Roster** | Two groups, **Red (hostile)** and **Green (neutral)**, listing each asset by label + key params. Empty groups show an explicit "none" state. | FR-001, edge: empty ORBAT |
| **Add red / Add green** | Adds a default asset of that allegiance; placement via the map's click-to-pick-hex (spec 003 F5) or a default AO-centre position. Appears immediately in the roster and on the map. | FR-001/005, US1/US2 |
| **Per-row tuners** | Numeric/range inputs for `label`, `extent_m`, `severity` (red) / `sensitivity` (green), `protection` (green), and `active_windows` (red). Editing re-renders map + Sync-Matrix live. | FR-003, US1/US2 |
| **Duplicate** | One click clones the row under a new id; the copy is independently tunable. | FR-006, US3 |
| **Remove** | Removes the row from roster and all views; others unaffected. | FR-006, US3 |
| **Validation feedback** | Out-of-range tunes and out-of-AO placements are clamped/rejected with an inline message; the asset never enters an invalid state. | FR-004, edges |
| **Selection** | Selecting a row highlights the asset on the map / Sync-Matrix and vice-versa (shared selection). | US4 |

## Projection contract (display-only)

- **Map** (`map.render`): each asset draws an allegiance-coloured point + faint extent ring +
  label, visually distinct from own force and the other allegiance (FR-005). Red `#ff7b72`-family,
  green `#38d39f`-family (palette in `key_facts.md`).
- **Sync Matrix** (`sync-matrix`): a red asset with `active_windows` contributes a `window`-render
  track via a catalogue row; it stays aligned with the shared playhead and selection (FR-010/US4).
- **Honest floor**: nothing the panel shows implies adversary motion or assessment beyond authored
  params (FR-008/NF9).

## Persistence contract

- Every mutating affordance calls `saveDraft` (mirror to localStorage). On mount, `loadDraft`
  restores the roster and all tuned values exactly (FR-007/SC-004).
- A **Commit ORBAT** action mints an immutable version in the `ObjectStore` (lineage preserved).

## Non-goals (deferred, asserted by tests where cheap)

- No routing/kernel influence from any asset (NF9/NF3).
- No blue/own-force authoring here (existing entity).
- No live ROE constraint / collateral objective emission (DEC-60 J3 capability — H2/H3).
