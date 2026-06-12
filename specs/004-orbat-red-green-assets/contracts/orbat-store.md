# Contract — ORBAT model & persistence (`app/js/orbat/orbat.js`)

The ORBAT model is the only writer of the authored roster. It is a **pure, deterministic** module
over the LinkML-generated `Orbat`/`Asset` types (imported from `schema/gen/remit.ts`); UI and
rendering read through it. All operations return a **new** draft (no in-place mutation), keeping
identity stable and rendering reproducible (NF3).

## Types

Imported from the generated schema (do not redeclare):
`Orbat`, `Asset`, `RedParams`, `GreenParams`, `TimeWindow`, `Allegiance`, `Protection`.

## Operations

| Function | Signature (conceptual) | Guarantees |
|---|---|---|
| `emptyOrbat(name)` | `(string) → Orbat` | version 1, `assets: []`. |
| `addAsset(orbat, { allegiance, position })` | `(Orbat, seed) → { orbat, id }` | mints a fresh unique `id`; seeds default params for the allegiance; rejects `allegiance='blue'` (out of scope) and out-of-AO `position`. |
| `duplicateAsset(orbat, id)` | `(Orbat, id) → { orbat, id }` | deep-copies the source's params under a **new** `id`; source unchanged (FR-002/006). |
| `tuneAsset(orbat, id, patch)` | `(Orbat, id, Partial<Asset>) → Orbat` | applies `patch` to **only** that asset; **clamps/validates** bounds (FR-004); other assets byte-identical. |
| `removeAsset(orbat, id)` | `(Orbat, id) → Orbat` | drops the asset; remaining assets unaffected (FR-006). |
| `validate(asset)` | `(Asset) → { ok, issues[] }` | bounds + window `start ≤ end` + position-in-AO + allegiance/param-group match. |
| `canonical(orbat)` | `(Orbat) → string` | assets sorted by `id`, canonical JSON (DEC-35) — the persistence & identity form. |

## Persistence

- **Draft**: `saveDraft(orbat)` writes `canonical(orbat)` to `localStorage['remit.orbat.M-001']`;
  `loadDraft()` restores it (returns `emptyOrbat` if absent). Mirrored on every mutating op so reload
  restores exactly (SC-004).
- **Commit**: `commit(orbat, objects)` PUTs an immutable, content-addressed `Orbat` into the shared
  `ObjectStore` with `lineage.previous_version` → the prior committed id (Principle V; idempotent
  re-PUT per DEC-35).

## Invariants

- **Determinism (NF3)**: `canonical` is a pure function of asset content (sorted by `id`); equal
  rosters ⇒ equal bytes ⇒ equal content id. No timestamps/insertion-order leak in.
- **Honest floor (NF9)**: the module exposes **no** function that derives adversary behaviour or
  mutates a plan; output is consumed display-only.
- **Isolation (FR-002/SC-003)**: every op returns a new draft touching only the targeted asset.

## Display adapter

`assetToEntity(asset) → Entity` (display-only; the hand-written carve-out) produces the
`buildEntities()`-shaped entity: allegiance-typed, `provenance.kind='actor'`, a `position` for the
map marker, and — for red assets with `active_windows` — a `window`-type aspect for the Sync Matrix
(reusing the satellite-pass render path). Contains no kernel reference.
