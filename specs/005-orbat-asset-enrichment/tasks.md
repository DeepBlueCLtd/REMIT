---
description: "Task list for ORBAT asset enrichment — kind, icons, confidence & red dual-range rings"
---

# Tasks: ORBAT asset enrichment — kind, icons, confidence & red dual-range rings

**Input**: Design documents from `specs/005-orbat-asset-enrichment/`

**Prerequisites**: [plan.md](./plan.md), [spec.md](./spec.md), [research.md](./research.md), [data-model.md](./data-model.md), [contracts/](./contracts/)

**Tests**: INCLUDED — the project's quality gates require `npm run test:unit` (`node --test`, `test/*.test.mjs`) and `npm run test:e2e` (Playwright cloud wrapper, `e2e/*.spec.ts`) on every PR (constitution §Development Workflow). Graphical work captures evidence screenshots.

**Organization**: grouped by user story (US1–US3 from spec.md). Additive to spec 004 — extends the existing `orbat.js` model, `orbat-panel.js` surface, and `map.js` renderer in place; no new app modules.

## Format: `[ID] [P?] [Story] Description`

- **[P]**: can run in parallel (different files, no dependency on incomplete tasks)
- **[Story]**: US1 / US2 / US3 (setup, foundational, polish carry no story label)

## Path Conventions

Single static web app: schema in `schema/`, app in `app/js/`, unit tests in `test/*.test.mjs`, e2e in `e2e/*.spec.ts`.

---

## Phase 1: Setup (Schema — source of truth, Principle I)

**Purpose**: Extend the LinkML data model with the enriched, serialisable fields and regenerate. Generated artefacts are outputs; never hand-edited.

- [ ] T001 Add `PlatformKind` enum (`infantry|vehicle|aircraft|vessel|sensor|emplacement|structure`) to `schema/common.yaml`
- [ ] T002 Add optional `kind` (range `PlatformKind`), `symbol` (string override), and `confidence` (range existing `ConfidenceLevel`) attributes to `Asset` in `schema/orbat.yaml`
- [ ] T003 Add `detection_range_m` and `engagement_range_m` (range `float`) to `RedParams` in `schema/orbat.yaml`
- [ ] T004 Regenerate artefacts: `bash schema/generate.sh` → verify `schema/gen/remit.ts` + `remit.schema.json` include `PlatformKind`, `Asset.kind/symbol/confidence`, `RedParams.detection_range_m/engagement_range_m`; do NOT hand-edit generated files

**Checkpoint**: schema regenerated; enriched asset shapes available as generated types.

---

## Phase 2: Foundational (Blocking Prerequisites)

**Purpose**: Shared model behaviour every story builds on — backward-compatible loading, the tune/validate/default extensions, and the symbol lookup. Not a demoable story on its own.

**⚠️ CRITICAL**: No user-story work begins until this phase is complete.

- [ ] T005 Implement `normalize(orbat)` — default absent fields and **migrate** spec-004 drafts (red `extent_m` → `detection_range_m`, seed `engagement_range_m ≈ 0.5×` clamped ≤ detection); pure + idempotent; wire it into `loadDraft`/`getDraft` (FR-010) — in `app/js/orbat/orbat.js`
- [ ] T006 Extend `tuneAsset` to accept `kind`/`symbol`/`confidence` on the asset and `detection_range_m`/`engagement_range_m` inside `patch.red` (clamp to `BOUNDS.extent_m`; reconcile `engagement ≤ detection`, FR-006); extend `addAsset` red defaults and `validate` (kind/confidence vocab + range bounds + window) — in `app/js/orbat/orbat.js`
- [ ] T007 Add the `SYMBOLS` glyph lookup (`PlatformKind` → Unicode/emoji) + `symbolOf(asset)` (override → kind → generic dot) export (UI/behaviour carve-out, ADR-0012) — in `app/js/orbat/orbat.js`

**Checkpoint**: a spec-004 draft loads + migrates cleanly; enriched fields tune/clamp; `symbolOf` resolves. Stories can begin.

---

## Phase 3: User Story 1 — Type an asset & see the right symbol (Priority: P1) 🎯 MVP

**Goal**: A planner sets an asset's platform `kind`; the map marker becomes a kind+allegiance symbol (overridable per asset) instead of a plain dot.

**Independent Test**: add one asset per allegiance with different kinds → each shows the matching symbol; override one icon then clear it → only that marker changes and reverts; the selected route/plan is unchanged.

### Tests for User Story 1

- [ ] T008 [P] [US1] Unit tests — `symbolOf` (override > kind > generic), `kind`/`symbol` round-trip through `tuneAsset`/`canonical`, determinism — in `test/orbat.test.mjs`
- [ ] T009 [P] [US1] e2e — set distinct kinds across the three allegiances, assert distinct symbols; override + clear one icon; assert route/plan unchanged (honest floor) — in `e2e/orbat.spec.ts`

### Implementation for User Story 1

- [ ] T010 [US1] Render the per-row **kind selector** and **icon/symbol picker** (with a clear-override affordance) in `app/js/shell/orbat-panel.js`
- [ ] T011 [US1] Draw each asset's symbol glyph (`TextLayer` via `symbolOf`) over the allegiance marker; extend the `data-assets` dataset with kind for the e2e suite; capture evidence screenshots → `specs/005-orbat-asset-enrichment/evidence/screenshots/` — in `app/js/views/map.js`

**Checkpoint**: typed allegiance-framed symbols render and are authorable — the MVP.

---

## Phase 4: User Story 2 — Record intel confidence (Priority: P1)

**Goal**: A planner sets each asset's confidence (high/medium/low); the map de-emphasises low-confidence assets and the roster shows a badge.

**Independent Test**: set a red asset to low confidence → faded marker + low badge; raise to high → emphasis updates; reload → persists.

### Tests for User Story 2

- [ ] T012 [P] [US2] Unit tests — `confidence` round-trip + absent-default behaviour, isolation — in `test/orbat.test.mjs`
- [ ] T013 [P] [US2] e2e — set low vs high confidence, assert map emphasis differs + roster badge + persistence across reload — in `e2e/orbat.spec.ts`

### Implementation for User Story 2

- [ ] T014 [US2] Render the per-row **confidence selector** + a roster confidence badge in `app/js/shell/orbat-panel.js`
- [ ] T015 [US2] Map `confidence` → marker/glyph **opacity** (high≈1.0, medium≈0.6, low≈0.35; absent ⇒ full) in `app/js/views/map.js`

**Checkpoint**: intel confidence is authorable and visible across map + roster.

---

## Phase 5: User Story 3 — Red threat detection vs engagement reach (Priority: P2)

**Goal**: A red asset gets two independently-tunable rings — detection (outer) and engagement (inner); green/blue keep their single extent.

**Independent Test**: set detection > engagement on a red asset → two distinct concentric rings; try engagement > detection → reconciled with feedback; green/blue still show a single extent control + ring.

### Tests for User Story 3

- [ ] T016 [P] [US3] Unit tests — dual-range clamp, `engagement ≤ detection` reconciliation, red migration seed, green/blue single-extent unaffected — in `test/orbat.test.mjs`
- [ ] T017 [P] [US3] e2e — two distinct red rings, engagement>detection reconciled, green/blue single ring, route unchanged — in `e2e/orbat.spec.ts`

### Implementation for User Story 3

- [ ] T018 [US3] Replace the single extent tuner for **red** rows with **detection** + **engagement** range tuners (single extent stays for green/blue); inline reconcile feedback — in `app/js/shell/orbat-panel.js`
- [ ] T019 [US3] Draw red assets as a faint outer **detection** ring + a bold inner **engagement** ring (single `extent_m` ring retained for green/blue) in `app/js/views/map.js`

**Checkpoint**: all three enrichments are independently authorable and visible; everything stays display-only.

---

## Phase 6: Polish & Cross-Cutting Concerns

- [ ] T020 [P] Record project memory: new ADR (asset enrichment — kind/symbol/confidence + red dual-range, display-only) in `docs/project_notes/decisions.md`; platform-kind glyph table + confidence-opacity scale + red range fields in `docs/project_notes/key_facts.md`; work-log entry in `docs/project_notes/issues.md`
- [ ] T021 [P] Author the blog post `specs/005-orbat-asset-enrichment/blog/post.md` from `docs/blog-post-template.md` (problem/options/strategy/results/screenshots + "at a glance") and add `blog/screenshots/`
- [ ] T022 Run `quickstart.md` end-to-end (incl. the spec-004 draft backward-compat check) and collect evidence screenshots into `specs/005-orbat-asset-enrichment/evidence/screenshots/`
- [ ] T023 Run `npm run test:unit` + `npm run test:e2e` + `npm run typecheck`; ensure `// @ts-check` is clean across the changed modules

---

## Dependencies & Execution Order

### Phase Dependencies

- **Setup (Phase 1)**: schema first; T001→T002→T003→T004 sequential (same generation).
- **Foundational (Phase 2)**: depends on Setup; **blocks all user stories**. T005/T006/T007 all edit `orbat.js` — sequence them.
- **User Stories (Phase 3–5)**: all depend on Foundational. Independent of each other in behaviour, but all three touch `orbat-panel.js` and `map.js` — **coordinate/sequence those edits** (test files are parallel-safe).
- **Polish (Phase 6)**: after the desired stories are complete.

### User Story Dependencies

- **US1 (P1)**: after Foundational — the MVP (symbols are the foundation the picture hangs off).
- **US2 (P1)**: after Foundational — independent of US1 (confidence is orthogonal to kind).
- **US3 (P2)**: after Foundational — independent; relies on the dual-range clamp/migration from T005/T006.

### Within Each User Story

- Tests written first and FAIL before implementation.
- Model behaviour (already in Foundational) → panel wiring → map rendering.
- Story complete and independently tested before moving on.

### Parallel Opportunities

- Unit-test and e2e-test tasks marked [P] within a story run together (`test/orbat.test.mjs` vs `e2e/orbat.spec.ts`).
- Polish T020/T021 [P] are independent files.
- Note: US1/US2/US3 panel + map edits are NOT parallel (same files) — coordinate or sequence.

---

## Implementation Strategy

### MVP First (User Story 1 only)

1. Phase 1 Setup → 2. Phase 2 Foundational → 3. Phase 3 US1 (kind + symbols) → **STOP & validate** the typed-symbol picture → demo via the PR preview.

### Incremental Delivery

Setup + Foundational → US1 (symbols, MVP) → US2 (confidence) → US3 (red dual-range) → Polish. Each story adds value without breaking the previous ones, and all are display-only (NF9) + backward-compatible with spec-004 drafts (FR-010).

---

## Notes

- [P] = different files, no dependency on incomplete work.
- LinkML is the source of truth (Principle I): `kind`/`symbol`/`confidence` + red ranges are schema-defined and regenerated (T001–T004), never hand-authored; only the glyph lookup (`SYMBOLS`/`symbolOf`) stays in `app/js` (the UI/behaviour carve-out).
- Honest floor (NF9) + determinism (NF3) are assertable invariants — no enriched attribute touches routing/the kernel (re-asserted in T009/T017's route-unchanged check).
- Backward compatibility (FR-010) is foundational (T005) and verified in T022's spec-004 draft check.
- Commit after each task or logical group; capture evidence screenshots during e2e runs.
