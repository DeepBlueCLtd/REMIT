# Quickstart — validate ORBAT asset enrichment

A runnable validation guide proving the enrichment end-to-end. Details live in
[data-model.md](./data-model.md) and [contracts/](./contracts/); this is the run/verify path. Builds on
spec 004 — the ORBAT tab, placement, persistence and commit are unchanged.

## Prerequisites

```bash
npm install
# Data-model changes require regenerating the schema artefacts (bootstraps a LinkML venv):
bash schema/generate.sh        # → schema/gen/remit.schema.json, schema/gen/remit.ts
```

## Run the app

```bash
npm run dev        # Vite dev server
# Overview tab → "Load the operating area"; then open the ORBAT (SME Int) tab
```

## Validation scenarios (map to user stories)

### US1 — Type an asset & see the right symbol (P1)
1. Add one asset of each allegiance; set a different **kind** on each (e.g. red emplacement, green
   structure, blue vehicle) → each map marker shows the corresponding **kind+allegiance symbol**, not a
   plain dot; the roster row shows the kind.
2. **Override** one asset's icon → only that marker's glyph changes; **clear** it → reverts to the
   kind+allegiance default.
3. Confirm a selected COA's route/plan is unchanged by any kind/icon change (honest floor).

### US2 — Intel confidence (P1)
1. Set a red asset's **confidence** to "low" → its marker renders faded and the roster shows a low badge.
2. Raise it to "high" → emphasis updates immediately; reload → the value persists.

### US3 — Red dual range rings (P2)
1. On a red asset, set **detection** and **engagement** ranges to different values → two concentric
   rings render (detection outer/faint, engagement inner/bold).
2. Try to set **engagement > detection** → it is reconciled to ≤ detection with inline feedback (never
   an invalid state).
3. Confirm a **green/blue** asset still shows a single extent control and single ring.

### Backward compatibility (FR-010)
1. With a spec-004 ORBAT draft already in localStorage (assets without kind/confidence/dual-range),
   load the app → every prior asset still renders (generic symbol, full emphasis) and a red asset shows
   detection = its old extent with an engagement ring inside it.

## Automated checks

```bash
npm run test:unit          # kind/confidence round-trip, dual-range clamp + engagement ≤ detection, draft migration
npm run test:e2e           # cloud Playwright: typed symbol + confidence emphasis + red dual-ring + route-unchanged
```

Capture evidence screenshots into `specs/005-orbat-asset-enrichment/evidence/screenshots/` during the
e2e run (dots → typed symbols, three allegiances, low vs high confidence, red two rings, the enriched
roster row, a spec-004 draft loading intact).

## Expected outcomes (success criteria)

- Each asset's **kind and side are legible at a glance** from its symbol; no two of the seven kinds look
  identical within an allegiance (SC-001).
- Kind/icon/confidence/range edits update map + roster **within one frame** and persist at 100% on
  reload (SC-002).
- A red threat's **detection and engagement reaches are both visible and distinct**, engagement never
  drawn larger than detection (SC-003).
- Tuning **any** enriched attribute leaves the selected route/plan **unchanged**; re-projecting an
  unchanged roster is identical (SC-004).
- A spec-004 ORBAT **loads without error** with every prior asset visible and editable (SC-005).
