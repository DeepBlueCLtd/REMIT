---

description: "Task list for ORBAT red/green assets implementation"
---

# Tasks: ORBAT — add & tune red and green assets

**Input**: Design documents from `specs/004-orbat-red-green-assets/`

**Prerequisites**: [plan.md](./plan.md), [spec.md](./spec.md), [research.md](./research.md), [data-model.md](./data-model.md), [contracts/](./contracts/)

**Tests**: INCLUDED — the project's quality gates require `npm run test:unit` (`node --test`, `test/*.test.mjs`) and `npm run test:e2e` (Playwright cloud wrapper, `e2e/*.spec.ts`) on every PR (constitution §Development Workflow). Graphical work captures evidence screenshots.

**Organization**: grouped by user story (US1–US4 from spec.md) for independent implementation and testing.

## Format: `[ID] [P?] [Story] Description`

- **[P]**: can run in parallel (different files, no dependency on incomplete tasks)
- **[Story]**: US1 / US2 / US3 / US4 (setup, foundational, polish carry no story label)

## Path Conventions

Single static web app: schema in `schema/`, app in `app/js/`, unit tests in `test/*.test.mjs`, e2e in `e2e/*.spec.ts`.

---

## Phase 1: Setup (Shared Infrastructure)

**Purpose**: Extend the LinkML data model (Principle I — source of truth) and scaffold the new module. Regenerated artefacts are outputs; never hand-edited.

- [ ] T001 Add `Allegiance` enum (`blue|red|green`, with stance notes) to `schema/common.yaml`
- [ ] T002 Add optional `allegiance` attribute (range `Allegiance`) to `Entity` in `schema/entities.yaml`
- [ ] T003 Create `schema/orbat.yaml` module — `Orbat`, `Asset`, `RedParams`, `GreenParams`, `TimeWindow` classes + `Protection` enum (per [data-model.md](./data-model.md)); reuse existing `Waypoint`/`Lineage`
- [ ] T004 Import the `orbat` module in the entry schema `schema/remit.yaml`
- [ ] T005 Regenerate artefacts: `bash schema/generate.sh` → verify `schema/gen/remit.schema.json` + `schema/gen/remit.ts` include `Orbat`/`Asset`/`Allegiance`; do NOT hand-edit generated files
- [ ] T006 [P] Create `app/js/orbat/orbat.js` skeleton (`// @ts-check`) importing the generated types from `schema/gen/remit.ts`

**Checkpoint**: schema regenerated, allegiance/asset shapes available as generated types.

---

## Phase 2: Foundational (Blocking Prerequisites)

**Purpose**: Shared model, persistence, projection plumbing, and panel mount that ALL stories build on. Not a demoable story on its own.

**⚠️ CRITICAL**: No user-story work begins until this phase is complete.

- [ ] T007 Implement `emptyOrbat(name)` + `canonical(orbat)` (assets sorted by `id`, canonical JSON, DEC-35) in `app/js/orbat/orbat.js`
- [ ] T008 Implement `validate(asset)` — bounds clamp for `extent_m`/`severity`/`sensitivity`, `start_min ≤ end_min`, position-in-AO, allegiance↔param-group match — in `app/js/orbat/orbat.js`
- [ ] T009 Implement persistence `saveDraft`/`loadDraft` (localStorage key `remit.orbat.M-001`, canonical JSON) in `app/js/orbat/orbat.js`
- [ ] T010 Implement display-only `assetToEntity(asset)` adapter (allegiance-typed Entity, `provenance.kind='actor'`, position; no kernel reference — NF9) in `app/js/orbat/orbat.js`
- [ ] T011 Extend `buildEntities()` to fold authored ORBAT assets into the entity set in `app/js/entities/entities.js`
- [ ] T012 Extend `map.render` to draw an allegiance-coloured asset marker layer (point + faint extent ring + label) in `app/js/views/map.js`
- [ ] T013 Register the ORBAT authoring panel as a config-declared role-tab (home: `sme-int`) in `app/js/shell/roles.js` and scaffold `app/js/shell/orbat-panel.js` with `mount(container, ctx)`
- [ ] T014 Wire the panel + authored assets into the render loop (feed assets to `map.render` and `buildEntities`) in `app/js/main.js`

**Checkpoint**: an asset added in code renders on the map; the panel mounts. Stories can now begin.

---

## Phase 3: User Story 1 — Add & tune red (hostile) assets (Priority: P1) 🎯 MVP

**Goal**: A planner adds multiple independent red threat assets and tunes each (label, position, extent, severity); each appears in the red allegiance style on the map.

**Independent Test**: With an empty red side, add two red assets at different cells, tune one's extent/severity, confirm both render distinctly and only the tuned one changed — without touching green or own force.

### Tests for User Story 1

- [ ] T015 [P] [US1] Unit tests — deterministic `addAsset` (fresh unique id), `tuneAsset` red clamp (`extent_m`, `severity`), per-asset isolation, `canonical` stability — in `test/orbat.test.mjs`
- [ ] T016 [P] [US1] e2e — add two red assets, tune one, assert both visible + isolation + no fabricated adversary motion (honest floor) — in `e2e/orbat.spec.ts`

### Implementation for User Story 1

- [ ] T017 [US1] Implement `addAsset(orbat, {allegiance:'red', position})` with red defaults + fresh id; reject `blue` and out-of-AO positions — in `app/js/orbat/orbat.js`
- [ ] T018 [US1] Implement `tuneAsset(orbat, id, patch)` applying clamped `RedParams` (severity) + `extent_m`/`label` to only the targeted asset — in `app/js/orbat/orbat.js`
- [ ] T019 [US1] Render the **Red (hostile)** roster group, **Add red**, and per-row tuners (label, extent, severity) in `app/js/shell/orbat-panel.js`
- [ ] T020 [US1] Red marker styling (`#ff7b72` family) + extent ring + click-to-pick-hex placement in `app/js/views/map.js`
- [ ] T021 [US1] Inline validation feedback (clamp/reject with message) in `app/js/shell/orbat-panel.js`; capture evidence screenshots → `specs/004-orbat-red-green-assets/evidence/screenshots/`

**Checkpoint**: red ORBAT is authorable, tunable, and visible — the MVP.

---

## Phase 4: User Story 2 — Add & tune green (neutral) assets (Priority: P1)

**Goal**: A planner adds multiple independent green assets and tunes each (label, position, extent, sensitivity, protection); each appears in the green allegiance style, distinct from red and own force.

**Independent Test**: With an empty green side, add two green assets with different sensitivities, tune one, confirm both render in green and only the tuned one changed.

### Tests for User Story 2

- [ ] T022 [P] [US2] Unit tests — green defaults, `GreenParams` clamp (`sensitivity`, `protection`), isolation — in `test/orbat.test.mjs`
- [ ] T023 [P] [US2] e2e — add two green assets, tune one, assert distinct green styling vs red/own-force — in `e2e/orbat.spec.ts`

### Implementation for User Story 2

- [ ] T024 [US2] Extend `addAsset`/`tuneAsset` with green defaults + `GreenParams` (`sensitivity`, `protection`) in `app/js/orbat/orbat.js`
- [ ] T025 [US2] Render the **Green (neutral)** roster group, **Add green**, and per-row tuners (label, extent, sensitivity, protection) in `app/js/shell/orbat-panel.js`
- [ ] T026 [US2] Green marker styling (`#38d39f` family) visually distinct from red and own-force in `app/js/views/map.js`

**Checkpoint**: both red and green sides are independently authorable and visible.

---

## Phase 5: User Story 3 — Manage the ORBAT roster (Priority: P2)

**Goal**: Duplicate, remove, and persist assets; the roster and all tuned values survive reload; committing mints an immutable version.

**Independent Test**: Duplicate an asset, rename the copy, remove a different asset, reload — confirm the roster and every tuned value are exactly as left.

### Tests for User Story 3

- [ ] T027 [P] [US3] Unit tests — `duplicateAsset` (new id, independent copy), `removeAsset` (others unaffected), `commit` immutability + lineage — in `test/orbat.test.mjs`
- [ ] T028 [P] [US3] e2e — duplicate + remove, reload page, assert roster + tuned values restored — in `e2e/orbat.spec.ts`

### Implementation for User Story 3

- [ ] T029 [US3] Implement `duplicateAsset(orbat, id)` (deep-copy under new id) + `removeAsset(orbat, id)` in `app/js/orbat/orbat.js`; wire duplicate/remove controls in `app/js/shell/orbat-panel.js`
- [ ] T030 [US3] Mirror `saveDraft` on every mutating op and `loadDraft` on panel mount in `app/js/shell/orbat-panel.js`
- [ ] T031 [US3] Implement `commit(orbat, objects)` — immutable content-addressed `Orbat` version with `lineage.previous_version` — in `app/js/orbat/orbat.js`; add a **Commit ORBAT** action to the panel

**Checkpoint**: roster management + persistence across sessions work.

---

## Phase 6: User Story 4 — ORBAT instances across the planning views (Priority: P3)

**Goal**: A red asset with active time-windows projects as a Sync-Matrix track, synchronised with the shared playhead and selection.

**Independent Test**: Add a red asset with an active window, scrub the timeline, confirm its track appears on the Sync Matrix and stays aligned with the map; selecting it highlights it in both views.

### Tests for User Story 4

- [ ] T032 [P] [US4] e2e — red asset with `active_windows` shows a Sync-Matrix track aligned with the playhead; selection syncs across views — in `e2e/orbat.spec.ts`

### Implementation for User Story 4

- [ ] T033 [US4] Add an `active_windows` (`TimeWindow[]`) tuner for red assets in `app/js/shell/orbat-panel.js`
- [ ] T034 [US4] Emit a `window`-type aspect from `assetToEntity` (reuse the satellite-pass render path) and add the catalogue row in `app/js/entities/entities.js` so the asset appears as a Sync-Matrix track
- [ ] T035 [US4] Bind shared selection across panel ↔ map ↔ Sync-Matrix in `app/js/main.js`

**Checkpoint**: all four user stories are independently functional.

---

## Phase 7: Polish & Cross-Cutting Concerns

- [ ] T036 [P] Record project memory: new ADR (ORBAT red/green authoring scaffolding) in `docs/project_notes/decisions.md`; allegiance palette + localStorage key in `docs/project_notes/key_facts.md`; work-log entry in `docs/project_notes/issues.md`
- [ ] T037 [P] Author the blog post `specs/004-orbat-red-green-assets/blog/post.md` from `docs/blog-post-template.md` (problem/options/strategy/results/screenshots + "at a glance") and add `blog/screenshots/`
- [ ] T038 Run `quickstart.md` end-to-end and collect evidence screenshots into `specs/004-orbat-red-green-assets/evidence/screenshots/`
- [ ] T039 Run `npm run test:unit` + `npm run test:e2e`; ensure `// @ts-check` is clean across the new modules

---

## Dependencies & Execution Order

### Phase Dependencies

- **Setup (Phase 1)**: schema first; T001→T002→T003→T004→T005 sequential (same generation), T006 after T005.
- **Foundational (Phase 2)**: depends on Setup; **blocks all user stories**.
- **User Stories (Phase 3–6)**: all depend on Foundational. US1 & US2 are both P1 and largely parallel; US3 builds on having assets to manage; US4 builds on the asset→entity path.
- **Polish (Phase 7)**: after the desired stories are complete.

### User Story Dependencies

- **US1 (P1)**: after Foundational — no dependency on other stories (MVP).
- **US2 (P1)**: after Foundational — independent of US1 (shares `addAsset`/panel/map but exercises the green path).
- **US3 (P2)**: after Foundational — easiest to validate once US1/US2 produce assets to duplicate/remove; the model ops are independent.
- **US4 (P3)**: after Foundational — depends on `assetToEntity` (T010); independently testable.

### Within Each User Story

- Tests written first and FAIL before implementation.
- Model ops (`orbat.js`) before panel wiring before map/matrix styling.
- Story complete and independently tested before moving on.

### Parallel Opportunities

- T006 [P] alongside late Setup.
- Unit-test and e2e-test tasks marked [P] within a story run together (different files: `test/orbat.test.mjs` vs `e2e/orbat.spec.ts`).
- US1 and US2 can be staffed in parallel after Foundational (note: both touch `orbat.js`, `orbat-panel.js`, `map.js` — coordinate or sequence those edits).
- Polish T036/T037 [P] are independent files.

---

## Parallel Example: User Story 1

```bash
# Tests first (different files):
Task: "Unit tests for orbat model in test/orbat.test.mjs"          # T015
Task: "e2e author+tune red in e2e/orbat.spec.ts"                   # T016
```

---

## Implementation Strategy

### MVP First (User Story 1 only)

1. Phase 1 Setup → 2. Phase 2 Foundational → 3. Phase 3 US1 (red) → **STOP & validate** the red ORBAT end-to-end → demo via the PR preview.

### Incremental Delivery

Setup + Foundational → US1 (red, MVP) → US2 (green) → US3 (roster + persistence) → US4 (Sync-Matrix projection) → Polish. Each story adds value without breaking the previous ones.

---

## Notes

- [P] = different files, no dependency on incomplete work.
- LinkML is the source of truth (Principle I): asset/allegiance shapes are schema-defined and regenerated (T001–T005), never hand-authored; only display closures/UI stay in `app/js`.
- Honest floor (NF9) + determinism (NF3) are assertable invariants — exercised by T015/T016 and reaffirmed in T021.
- Commit after each task or logical group; capture evidence screenshots during e2e runs.
