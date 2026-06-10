# Work log

A log of completed work, with ticket IDs and URLs, so history stays traceable.

**Protocol:** when you complete a piece of work, add a row here and link any
evidence (e.g. `specs/<feature>/evidence/`).

| Date | Ticket | Summary | Links |
|------|--------|---------|-------|
| 2026-06-08 | — | Example: initial project scaffolding from template | `specs/001-…/` |
| 2026-06-08 | PR #2 | Fold blog publishing into `deploy.yml` (fix per-merge `gh-pages` concurrency cancellation) | [#2](https://github.com/IanMayo/repo_template/pull/2) |
| 2026-06-08 | PR #3 | Demo app + sample blog post; deploy no-blog-change fix; URL-derived PR-preview nav; enable Jekyll + derive blog `baseurl` (all base-path-safe) | [#3](https://github.com/IanMayo/repo_template/pull/3) |

| 2026-06-08 | `claude/vigilant-planck-5gxf1s` | Install + customise spec-kit: 3-tier active-feature resolution (`active-feature.sh` + fenced `common.sh` hunks) and blog generation (`blog-scaffold.sh` + plan/implement skill hooks); add Playwright `package.json` (wire-up). | ADR-0004 |

| 2026-06-09 | PR #2 | DEC-44 walking skeleton: full seven-stage lap (capture → learn) as a no-build in-browser app — content-addressed store, mock seam, A*-backed mock kernel, banded compare, synced views, wingman playback, NF3 replay; e2e suite + evidence; blog post. Also: concept doc rename, Playwright cloud-wrapper fixes (CLAUDECODE env, @sparticuz API). | `specs/002-walking-skeleton/` · [#2](https://github.com/DeepBlueCLtd/REMIT/pull/2) |

| 2026-06-10 | PR #2 | Tidal ford increment A (G6/DEC-54): K-7 → tidal ford (±3 h of low tide, parametric periodic channel + forecast changepoints); kernel weighs wait-at-bank vs K-9 detour (`chooseExfilRoute`, decision on each COA card); split exfil legs with `Await low tide` hold; tide-state ford rendering; re-routes tide-aware; 2 new e2e tests + evidence `11–13`. Also Execute: +5 min obstruction, block-next-cell in-flight re-route, speed label fixed to `N min/s`. | ADR-0006 · `specs/002-walking-skeleton/` · [#2](https://github.com/DeepBlueCLtd/REMIT/pull/2) |

| 2026-06-10 | PR #2 | Tidal ford increment B (ADR-0007): obstruction = local re-plan (hold leg + re-timed tail through the tide chooser); plan-time ≡ sim-time, no delay offset; holds absorb delays ("absorbed N min" logged); ≋ tide re-assessment alerts on decision change (wait→open, open→detour on window forfeit); visit survives rebases whole; pending blockage carried through block-rebases. 1 new e2e test (8 passing) + evidence `14`. | ADR-0007 · [#2](https://github.com/DeepBlueCLtd/REMIT/pull/2) |

| 2026-06-10 | PR #2 | Sync Matrix entity slice (ADR-0008, D6/DEC-52/53): first-class entities (`entities.js`) with typed aspects + config catalogue; self/forecast/provider provenances (own force via `stateAt`, tide forecast, IKAROS-3 provider ephemeris); `views/sync-matrix.js` renders a content-keyed multi-track SVG (status/line/band) on one shared playhead; tide/sat project from World step, own-force fills on COA select; cursor readout reports ford/sat coincidence (human-scan only); removed the old timeline + `makeTimeline`. 1 new e2e test (9 passing) + evidence `15`,`16`. | ADR-0008 · [#2](https://github.com/DeepBlueCLtd/REMIT/pull/2) |

| 2026-06-10 | PR #2 | Advisory coincidence on the Sync Matrix (H1-lite; ADR-0009, DEC-53): config coincidence rules (declared conjunctions of aspect-predicates) + `coincidenceWindows()` scan; Imagery window (observe ∧ sat overhead, H+51–69) and Tide-aligned crossing (exfil ∧ ford open, H+88–95); rendered as faint guide columns + a labelled `⌖ Coincidence · advisory · C10-lite` lane; cursor readout names the window it's in. Advisory only — never alters the plan. Re-tagged H2→H1-lite to match C10's banded overlay (its spatial sibling); register + DEC-53 realigned. 9 e2e passing; evidence `17`. | ADR-0009 · [#2](https://github.com/DeepBlueCLtd/REMIT/pull/2) |

| 2026-06-10 | PR #2 | Golden-fixture kernel tests + plan-free coincidence rule. `test/kernel.golden.test.mjs` (`npm run test:unit`, node's runner, zero deps): pins the deterministic planner's tidal-ford set-pieces — 45-dwell→WAIT, 15-dwell→DETOUR, no-go both crossings→infeasible — with golden plan ids (NF3). Third coincidence rule `open-ford-pass` (sat ∧ ford open, H+146–164): pure forecast×provider, surfaces with no COA selected. 4 unit + 9 e2e passing. | [#2](https://github.com/DeepBlueCLtd/REMIT/pull/2) |

| 2026-06-10 | `claude/data-model-mini-site-uqykia` | Data Model mini-site: bespoke, attractive `site/data-model/index.html` (self-contained, light/dark, no build) presenting the v1 data model as a human-oriented tour — three universal rules, lifecycle spine, and entity cards (Requirement → ExecutionLog) with plain-English field glosses + DEC chips, plus the relationships paragraph. Linked from `site/index.html` welcome page. Derived from `docs/remit-data-model.md` (draft 0.3); becomes a generated view once the LinkML schema is authored (DEC-57). Note: no LinkML schema exists in-repo yet. | `site/data-model/` |

| 2026-06-10 | PR #4 | Extended PR previews to publish the whole static site (welcome + `/data-model/` + `/app/`), not just the app, so site/docs changes are reviewable per-PR (`pr-preview.yml` mirrors `deploy.yml`'s assembly; blog excluded — needs root Jekyll). | ADR-0010 · [#4](https://github.com/DeepBlueCLtd/REMIT/pull/4) |

| 2026-06-10 | PR #4 | **LinkML data model authored (DEC-57).** `schema/remit.yaml` — 60 classes, 20 enums — from the `remit-data-model.md` spine, reconciled field-by-field against the walking skeleton's real shapes (schema ≡ code). `schema/generate.sh` (venv-bootstrapping) generates JSON Schema + TypeScript (`schema/gen/`) and a single self-contained **human-readable HTML reference** (`schema/build-reference.py` → `site/data-model/index.html`, ~90 KB, classes/fields/enums with linkages + ER diagram) that **replaces the hand-authored tour**. No Pydantic yet. Two LinkML gotchas hit + recorded (bugs.md). | ADR-0011 · [#4](https://github.com/DeepBlueCLtd/REMIT/pull/4) |

| 2026-06-10 | PR #4 | Recorded the "LinkML one-source-of-truth" type rules (constitution) adapted to REMIT — CLAUDE.md "Data model" section, spec-kit constitution, ADR-0012. Deferred follow-ups: GENERATED banners + regen-no-diff CI check; golden-fixtures adherence test; migrate skeleton inline shapes onto generated TS (own spec). | ADR-0012 · [#4](https://github.com/DeepBlueCLtd/REMIT/pull/4) |

<!-- Add new rows above as work completes. -->
