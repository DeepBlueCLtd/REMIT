# Quickstart — validate ORBAT blue/red/green assets

A runnable validation guide proving the feature end-to-end. Details live in
[data-model.md](./data-model.md) and [contracts/](./contracts/); this is the run/verify path.

## Prerequisites

```bash
npm install
# Data-model changes require regenerating the schema artefacts (bootstraps a LinkML venv):
bash schema/generate.sh        # → schema/gen/remit.schema.json, schema/gen/remit.ts
```

## Run the app

```bash
npm run dev        # Vite dev server; open the ORBAT (SME-Intel) tab
# or: npm run build && npm run preview
```

## Validation scenarios (map to user stories)

### US1 — Add & tune red assets (P1)
1. Open the ORBAT with an empty red side → the **Red (hostile)** group shows "none".
2. **Add red**, place it on the map → a red point + extent ring + label appears; a row appears in the roster.
3. **Add red** again at a different cell → two independent red rows; both visible on the map.
4. Tune the first asset's **extent** and **severity** → only its ring/label changes; the second is untouched.
5. Confirm **no** adversary motion or assessment is shown beyond the authored params (honest floor).

### US2 — Add & tune green assets (P1)
1. With an empty green side, **Add green**, set location + **sensitivity** + **protection** → a green
   marker renders, distinct from red and own force.
2. **Add green** again with different params → two independent green rows; tuning one leaves the other unchanged.

### US3 — Add & tune blue (own-force) assets (P2)
1. Open the ORBAT → the existing own-force (ROVER-1) appears in the **Blue** group, marked canonical
   and with its remove control disabled.
2. **Add blue**, set location + **availability** + a **capability** stub → a blue marker renders,
   distinct from red and green.
3. Tune the blue asset's capability/availability → the roster/depiction updates **and the selected
   route/plan is unchanged** (display-only proof — no kernel coupling).

### US4 — Manage the roster (P2)
1. **Duplicate** a red asset → an independent copy (new id) carrying the source's params; tune it separately.
2. **Remove** a green asset → it disappears from roster and map; the rest are unaffected. Confirm the
   canonical own-force blue asset cannot be removed.
3. **Reload the page** → the full roster and every tuned value are restored exactly (localStorage draft).

### US5 — Cross-view projection (P3)
1. Give a red asset an **active window** (e.g. H+30..H+60) → a track appears on the Sync Matrix.
2. Scrub the shared playhead → the track and the map marker stay aligned; selecting the row highlights it in both views.

## Automated checks

```bash
npm run test:unit          # orbat model: deterministic add/duplicate/tune/remove, validation/clamp, canonical identity
npm run test:e2e           # cloud Playwright: author → tune → see on map/matrix → persist across reload
# (local: npm run test:e2e:local)
```

Capture evidence screenshots into `specs/004-orbat-red-green-assets/evidence/screenshots/` during the
e2e run (empty → one red → many red+green → tune before/after → Sync-Matrix track → after reload).

## Expected outcomes (success criteria)

- New asset placed and visible in **< 30 s** (SC-001); ≥ 10 instances per allegiance stay legible/tunable (SC-002).
- Tuning affects **only** the targeted asset (SC-003); reload restores **100%** of instances/values (SC-004).
- **Zero** fabricated adversary behaviour and the route/plan **unchanged** by any blue/red/green tune (SC-005); re-planning an unchanged ORBAT is **identical** (SC-006).
