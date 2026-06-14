---

description: "Task list for ORBAT blue/red/green assets implementation"
---

# Tasks: ORBAT — add & tune blue, red, and green assets

**Input**: Design documents from `specs/004-orbat-red-green-assets/`

**Prerequisites**: [plan.md](./plan.md), [spec.md](./spec.md), [research.md](./research.md), [data-model.md](./data-model.md), [contracts/](./contracts/)

**Tests**: INCLUDED — the project's quality gates require `npm run test:unit` (`node --test`, `test/*.test.mjs`) and `npm run test:e2e` (Playwright cloud wrapper, `e2e/*.spec.ts`) on every PR (constitution §Development Workflow). Graphical work captures evidence screenshots.

**Organization**: grouped by user story (US1–US5 from spec.md) for independent implementation and testing.

## Format: `[ID] [P?] [Story] Description`

- **[P]**: can run in parallel (different files, no dependency on incomplete tasks)
- **[Story]**: US1 / US2 / US3 / US4 / US5 (setup, foundational, polish carry no story label)

## Path Conventions

Single static web app: schema in `schema/`, app in `app/js/`, unit tests in `test/*.test.mjs`, e2e in `e2e/*.spec.ts`.

---

## Phase 1: Setup (Shared Infrastructure)

**Purpose**: Extend the LinkML data model (Principle I — source of truth) and scaffold the new module. Regenerated artefacts are outputs; never hand-edited.

- [X] T001 Add `Allegiance` enum (`blue|red|green`, with stance notes) to `schema/common.yaml`
- [X] T002 Add optional `allegiance` attribute (range `Allegiance`) to `Entity` in `schema/entities.yaml`
- [X] T003 Create `schema/orbat.yaml` module — `Orbat`, `Asset` (+ `canonical_own_force`), `BlueParams`, `RedParams`, `GreenParams`, `TimeWindow` classes + `Protection` enum (per [data-model.md](./data-model.md)); reuse existing `Waypoint`/`Lineage`
- [X] T004 Import the `orbat` module in the entry schema `schema/remit.yaml`
- [X] T005 Regenerate artefacts: `bash schema/generate.sh` → verify `schema/gen/remit.schema.json` + `schema/gen/remit.ts` include `Orbat`/`Asset`/`Allegiance`/`BlueParams`; do NOT hand-edit generated files
- [X] T006 [P] Create `app/js/orbat/orbat.js` skeleton (`// @ts-check`) importing the generated types from `schema/gen/remit.ts`

**Checkpoint**: schema regenerated, allegiance/asset shapes available as generated types.

---

## Phase 2: Foundational (Blocking Prerequisites)

**Purpose**: Shared model, persistence, projection plumbing, and panel mount that ALL stories build on. Not a demoable story on its own.

**⚠️ CRITICAL**: No user-story work begins until this phase is complete.

- [X] T007 Implement `emptyOrbat(name)` + `canonical(orbat)` (assets sorted by `id`, canonical JSON, DEC-35) in `app/js/orbat/orbat.js`
- [X] T008 Implement `validate(asset)` — bounds clamp for `extent_m`/`severity`/`sensitivity`, `start_min ≤ end_min`, position-in-AO, allegiance↔param-group match for all three allegiances — in `app/js/orbat/orbat.js`
- [X] T009 Implement persistence `saveDraft`/`loadDraft` (localStorage key `remit.orbat.M-001`, canonical JSON) in `app/js/orbat/orbat.js`
- [X] T010 Implement display-only `assetToEntity(asset)` adapter (allegiance-typed Entity; `provenance.kind='self'` for the canonical own-force else `'actor'`; position; no kernel reference — NF9) in `app/js/orbat/orbat.js`
- [X] T011 Implement `reconcileOwnForce(orbat, self)` — surface the existing planned own-force (ROVER-1) as the single `canonical_own_force` blue asset, idempotent — in `app/js/orbat/orbat.js`
- [X] T012 Extend `buildEntities()` to fold authored ORBAT assets into the entity set in `app/js/entities/entities.js`
- [X] T013 Extend `map.render` to draw an allegiance-coloured asset marker layer (point + faint extent ring + label) in `app/js/views/map.js`
- [X] T014 Register the ORBAT authoring panel as a config-declared role-tab (home: `sme-int`) in `app/js/shell/roles.js` and scaffold `app/js/shell/orbat-panel.js` with `mount(container, ctx)`
- [X] T015 Wire the panel + authored assets into the render loop (feed assets to `map.render` and `buildEntities`; reconcile own-force on load) in `app/js/main.js`

**Checkpoint**: an asset added in code renders on the map; the panel mounts; ROVER-1 shows as the canonical blue asset. Stories can now begin.

---

## Phase 3: User Story 1 — Add & tune red (hostile) assets (Priority: P1) 🎯 MVP

**Goal**: A planner adds multiple independent red threat assets and tunes each (label, position, extent, severity); each appears in the red allegiance style on the map.

**Independent Test**: With an empty red side, add two red assets at different cells, tune one's extent/severity, confirm both render distinctly and only the tuned one changed — without touching the other allegiances.

### Tests for User Story 1

- [X] T016 [P] [US1] Unit tests — deterministic `addAsset` (fresh unique id), `tuneAsset` red clamp (`extent_m`, `severity`), per-asset isolation, `canonical` stability — in `test/orbat.test.mjs`
- [X] T017 [P] [US1] e2e — add two red assets, tune one, assert both visible + isolation + no fabricated adversary motion (honest floor) — in `e2e/orbat.spec.ts`

### Implementation for User Story 1

- [X] T018 [US1] Implement `addAsset(orbat, {allegiance:'red', position})` with red defaults + fresh id; reject out-of-AO positions — in `app/js/orbat/orbat.js`
- [X] T019 [US1] Implement `tuneAsset(orbat, id, patch)` applying clamped `RedParams` (severity) + `extent_m`/`label` to only the targeted asset — in `app/js/orbat/orbat.js`
- [X] T020 [US1] Render the **Red (hostile)** roster group, **Add red**, and per-row tuners (label, extent, severity) in `app/js/shell/orbat-panel.js`
- [X] T021 [US1] Red marker styling (`#ff7b72` family) + extent ring + click-to-pick-hex placement in `app/js/views/map.js`
- [X] T022 [US1] Inline validation feedback (clamp/reject with message) in `app/js/shell/orbat-panel.js`; capture evidence screenshots → `specs/004-orbat-red-green-assets/evidence/screenshots/`

**Checkpoint**: red ORBAT is authorable, tunable, and visible — the MVP.

---

## Phase 4: User Story 2 — Add & tune green (neutral) assets (Priority: P1)

**Goal**: A planner adds multiple independent green assets and tunes each (label, position, extent, sensitivity, protection); each appears in the green allegiance style, distinct from the others.

**Independent Test**: With an empty green side, add two green assets with different sensitivities, tune one, confirm both render in green and only the tuned one changed.

### Tests for User Story 2

- [X] T023 [P] [US2] Unit tests — green defaults, `GreenParams` clamp (`sensitivity`, `protection`), isolation — in `test/orbat.test.mjs`
- [X] T024 [P] [US2] e2e — add two green assets, tune one, assert distinct green styling vs red/own-force — in `e2e/orbat.spec.ts`

### Implementation for User Story 2

- [X] T025 [US2] Extend `addAsset`/`tuneAsset` with green defaults + `GreenParams` (`sensitivity`, `protection`) in `app/js/orbat/orbat.js`
- [X] T026 [US2] Render the **Green (neutral)** roster group, **Add green**, and per-row tuners (label, extent, sensitivity, protection) in `app/js/shell/orbat-panel.js`
- [X] T027 [US2] Green marker styling (`#38d39f` family) visually distinct from red and own-force in `app/js/views/map.js`

**Checkpoint**: red and green sides are independently authorable and visible.

---

## Phase 5: User Story 3 — Add & tune own-force (blue) assets (Priority: P2)

**Goal**: A planner adds multiple independent blue pool assets and tunes each (label, position, extent, availability, capability stub); each appears in the blue allegiance style. Tuning is **display-only** — it does not change kernel routing — and the existing planned own-force (ROVER-1) is reconciled as the canonical blue asset.

**Independent Test**: Add two blue pool assets, tune one's availability/capability, confirm both render in blue alongside ROVER-1 and that the selected plan/route is **unchanged** by the tuning.

### Tests for User Story 3

- [X] T028 [P] [US3] Unit tests — blue defaults + `BlueParams` clamp, `reconcileOwnForce` idempotent + single `canonical_own_force`, duplicate never copies the canonical flag — in `test/orbat.test.mjs`
- [X] T029 [P] [US3] e2e — add + tune blue, assert blue styling + **route/plan unchanged** by tuning (display-only proof) + ROVER-1 shown reconciled — in `e2e/orbat.spec.ts`

### Implementation for User Story 3

- [X] T030 [US3] Extend `addAsset`/`tuneAsset` with blue defaults + `BlueParams` (`availability`, `capabilities`) in `app/js/orbat/orbat.js`
- [X] T031 [US3] Render the **Blue (own force)** roster group, **Add blue**, per-row tuners (label, extent, availability, capabilities), and show the canonical own-force row marked with its **remove disabled** in `app/js/shell/orbat-panel.js`
- [X] T032 [US3] Blue marker styling distinct from red/green in `app/js/views/map.js`; assert in the e2e/honest-floor path that a blue tune leaves the route unchanged (no kernel coupling)

**Checkpoint**: all three allegiances are independently authorable and visible; blue stays display-only.

---

## Phase 6: User Story 4 — Manage the ORBAT roster (Priority: P2)

**Goal**: Duplicate, remove, and persist assets across all allegiances; the roster and tuned values survive reload; committing mints an immutable version. The canonical own-force is protected from removal.

**Independent Test**: Duplicate an asset, rename the copy, remove a different asset, reload — confirm the roster and every tuned value are exactly as left, and that the canonical own-force cannot be removed.

### Tests for User Story 4

- [X] T033 [P] [US4] Unit tests — `duplicateAsset` (new id, independent copy, no canonical flag), `removeAsset` (others unaffected; canonical own-force protected), `commit` immutability + lineage — in `test/orbat.test.mjs`
- [X] T034 [P] [US4] e2e — duplicate + remove, reload page, assert roster + tuned values restored; canonical own-force not removable — in `e2e/orbat.spec.ts`

### Implementation for User Story 4

- [X] T035 [US4] Implement `duplicateAsset(orbat, id)` (deep-copy under new id, drop canonical flag) + `removeAsset(orbat, id)` (refuse the canonical own-force) in `app/js/orbat/orbat.js`; wire duplicate/remove controls in `app/js/shell/orbat-panel.js`
- [X] T036 [US4] Mirror `saveDraft` on every mutating op and `loadDraft` on panel mount in `app/js/shell/orbat-panel.js`
- [X] T037 [US4] Implement `commit(orbat, objects)` — immutable content-addressed `Orbat` version with `lineage.previous_version` — in `app/js/orbat/orbat.js`; add a **Commit ORBAT** action to the panel

**Checkpoint**: roster management + persistence across sessions work.

---

## Phase 7: User Story 5 — ORBAT instances across the planning views (Priority: P3)

**Goal**: An asset with active time-windows (a red patrol, a blue availability window) projects as a Sync-Matrix track, synchronised with the shared playhead and selection.

**Independent Test**: Add a red asset with an active window, scrub the timeline, confirm its track appears on the Sync Matrix and stays aligned with the map; selecting it highlights it in both views.

### Tests for User Story 5

- [X] T038 [P] [US5] e2e — asset with `active_windows` shows a Sync-Matrix track aligned with the playhead; selection syncs across views — in `e2e/orbat.spec.ts`

### Implementation for User Story 5

- [X] T039 [US5] Add an `active_windows` (`TimeWindow[]`) tuner for red assets and an availability-window tuner for blue assets in `app/js/shell/orbat-panel.js`
- [X] T040 [US5] Emit a `window`-type aspect from `assetToEntity` (reuse the satellite-pass render path) and add the catalogue row in `app/js/entities/entities.js` so the asset appears as a Sync-Matrix track
- [X] T041 [US5] Bind shared selection across panel ↔ map ↔ Sync-Matrix in `app/js/main.js`

**Checkpoint**: all five user stories are independently functional.

---

## Phase 8: Polish & Cross-Cutting Concerns

- [X] T042 [P] Record project memory: new ADR (ORBAT blue/red/green authoring scaffolding, blue display-only) in `docs/project_notes/decisions.md`; allegiance palette + localStorage key in `docs/project_notes/key_facts.md`; work-log entry in `docs/project_notes/issues.md`
- [X] T043 [P] Author the blog post `specs/004-orbat-red-green-assets/blog/post.md` from `docs/blog-post-template.md` (problem/options/strategy/results/screenshots + "at a glance") and add `blog/screenshots/`
- [X] T044 Run `quickstart.md` end-to-end and collect evidence screenshots into `specs/004-orbat-red-green-assets/evidence/screenshots/`
- [X] T045 Run `npm run test:unit` + `npm run test:e2e`; ensure `// @ts-check` is clean across the new modules

---

## Dependencies & Execution Order

### Phase Dependencies

- **Setup (Phase 1)**: schema first; T001→T002→T003→T004→T005 sequential (same generation), T006 after T005.
- **Foundational (Phase 2)**: depends on Setup; **blocks all user stories**.
- **User Stories (Phase 3–7)**: all depend on Foundational. US1 & US2 (both P1) and US3 (P2) reuse the same add/tune pipeline; US4 builds on having assets to manage; US5 builds on the asset→entity path.
- **Polish (Phase 8)**: after the desired stories are complete.

### User Story Dependencies

- **US1 (P1)**: after Foundational — no dependency on other stories (MVP).
- **US2 (P1)**: after Foundational — independent of US1 (shares `addAsset`/panel/map but exercises the green path).
- **US3 (P2)**: after Foundational — independent; relies on `reconcileOwnForce` (T011) for the canonical blue asset; reuses the US1/US2 add/tune pipeline.
- **US4 (P2)**: after Foundational — easiest to validate once US1–US3 produce assets to duplicate/remove; the model ops are independent.
- **US5 (P3)**: after Foundational — depends on `assetToEntity` (T010); independently testable.

### Within Each User Story

- Tests written first and FAIL before implementation.
- Model ops (`orbat.js`) before panel wiring before map/matrix styling.
- Story complete and independently tested before moving on.

### Parallel Opportunities

- T006 [P] alongside late Setup.
- Unit-test and e2e-test tasks marked [P] within a story run together (different files: `test/orbat.test.mjs` vs `e2e/orbat.spec.ts`).
- US1, US2, US3 can be staffed in parallel after Foundational (note: all three touch `orbat.js`, `orbat-panel.js`, `map.js` — coordinate or sequence those edits).
- Polish T042/T043 [P] are independent files.

---

## Parallel Example: User Story 1

```bash
# Tests first (different files):
Task: "Unit tests for orbat model in test/orbat.test.mjs"          # T016
Task: "e2e author+tune red in e2e/orbat.spec.ts"                   # T017
```

---

## Implementation Strategy

### MVP First (User Story 1 only)

1. Phase 1 Setup → 2. Phase 2 Foundational → 3. Phase 3 US1 (red) → **STOP & validate** the red ORBAT end-to-end → demo via the PR preview.

### Incremental Delivery

Setup + Foundational → US1 (red, MVP) → US2 (green) → US3 (blue own-force pool) → US4 (roster + persistence) → US5 (Sync-Matrix projection) → Polish. Each story adds value without breaking the previous ones.

---

## Notes

- [P] = different files, no dependency on incomplete work.
- LinkML is the source of truth (Principle I): asset/allegiance shapes are schema-defined and regenerated (T001–T005), never hand-authored; only display closures/UI stay in `app/js`.
- Honest floor (NF9) + determinism (NF3) + **display-only blue** are assertable invariants — exercised by T016/T017/T028/T029 (the blue route-unchanged proof) and reaffirmed in T022/T032.
- The existing planned own-force is reconciled (T011), not re-implemented; it stays the only kernel-wired own force.
- Commit after each task or logical group; capture evidence screenshots during e2e runs.
