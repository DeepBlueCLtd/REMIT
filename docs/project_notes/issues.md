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

<!-- Add new rows above as work completes. -->
