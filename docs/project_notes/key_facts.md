# Key facts

Project configuration, URLs, and important constants. Check here first when you
need a value.

| Fact | Value |
|------|-------|
| Repo | `DeepBlueCLtd/REMIT` |
| Pages site | `https://deepbluecltd.github.io/REMIT/` |
| Live app | `https://deepbluecltd.github.io/REMIT/app/` |
| Blog | `https://deepbluecltd.github.io/REMIT/blog/` |
| PR previews | `https://deepbluecltd.github.io/REMIT/pr-preview/pr-<n>/` |
| Default branch | `main` |
| Deploy branch | `gh-pages` |
| Deploy config | `pages.config.yml` |
| spec-kit install | `uvx --from git+https://github.com/github/spec-kit.git specify init --here --integration claude --script sh --force --ignore-agent-tools` |
| spec-kit commands | `/speckit-specify` · `/speckit-plan` · `/speckit-tasks` · `/speckit-implement` (skills under `.claude/skills/`) |
| Active-feature override | `echo NNN-name > .specify/.active-feature` (gitignored, per-worktree; cloud sessions) |
| e2e tests | `npm run test:e2e` (cloud wrapper) · `npm run test:e2e:local` (after `npm install`) |
| Playwright deps | `@playwright/test ^1.60`, `@sparticuz/chromium ^149` (bundled Chromium for cloud) |
| Issue tracking | GitHub Issues + a GitHub **Project** board — **Auto-add covers all new issues** (no label filter needed) |
| Org issue fields | Set via `issue_write` → `issue_fields`: **Priority** (Urgent/High/Medium/Low) · **Effort** (High/Medium/Low) · **Start date** · **Target date** |
| Walking skeleton | `app/` (no build step, ES modules under `app/js/`) — spec + evidence in `specs/002-walking-skeleton/` |
| Skeleton scenario | AO "Kara Crossing" 28×18 @ 500 m · base (2,15) · OP-A (21,3) · window H+30..H+120 · dwell 45 min · band unit 20 min · seed 1337 · kernel `mock-0.1` |
| Tide (increment A) | semidiurnal, period 745 min · first low tide H+268 · ford open ±180 min → [H+88, H+448] · ford cells (23,5)(24,5) mobility 0.55 · K-9 detour ≈ +13 min over open ford |
| Sync Matrix (D6) | `app/js/entities/entities.js` (entities + config catalogue) + `app/js/views/sync-matrix.js` (renderer). Entities: self (own force, via `stateAt`) · tide (forecast) · IKAROS-3 sat (provider). Sat ephemeris: period 95 min · pass 18 min · first centre H+60 (first pass ≈ H+51–69, over the OP dwell). Render types: status/line/band. Coincidence = human scan + advisory banded windows (H1-lite, DEC-53). |
| Coincidence rules (H1-lite) | `coincidenceRules()` in `entities.js`: imagery (observe ∧ sat, H+51–69) · dry-crossing (exfil ∧ ford open, H+88–95) · open-ford-pass (sat ∧ ford open, H+146–164, plan-free). Advisory only. |
| Unit tests | `npm run test:unit` → `node --test "test/**/*.test.mjs"`; golden kernel fixtures in `test/kernel.golden.test.mjs` (pinned plan ids — regenerate deliberately) |
| e2e CI | `.github/workflows/e2e.yml` — Playwright suite on every PR / push to main |
| Data model (LinkML) | **Source of truth:** modular LinkML under `schema/` — modules `common`/`requirement`/`world`/`force`/`entities`/`plan`/`records`, stitched by the entry `schema/remit.yaml` (generators run on the entry; modules import only `common`, cross-module refs resolve at the merge). Generated, never hand-edited: `schema/gen/remit.schema.json`, `schema/gen/remit.ts`, `site/data-model/index.html`. No Pydantic yet. |
| Regenerate data model | `bash schema/generate.sh` — bootstraps a LinkML venv (`LINKML_VENV`, default `/tmp/linkml-venv`) and writes all derived artefacts. LinkML must be in a venv (distro pip fails — see bugs.md). |
| Data-model reference | `https://deepbluecltd.github.io/REMIT/data-model/` — generated single-page reference (classes/fields/enums + ER diagram); replaces the former hand-authored tour. |

_Pages URLs resolve once GitHub Pages is enabled (served from `gh-pages`). Add
anything else worth remembering (service URLs, IDs, constants) as it comes up._
