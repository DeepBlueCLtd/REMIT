# Architectural Decision Records

Short ADRs capturing decisions and their trade-offs.

**Protocol:** before proposing an architectural change, check this file for an
existing decision. If your change conflicts with one, acknowledge the conflict and
explain why the change is warranted.

Each entry records: date, the decision, context, options considered, and
consequences. Link evidence (e.g. `specs/<feature>/evidence/`) where relevant.

---

## ADR-0001 (2026-06-08) — Static gh-pages previews instead of server review apps

- **Context:** we want a browsable preview for every PR without running a server
  per PR.
- **Decision:** publish static builds to the `gh-pages` branch under
  `/pr-preview/pr-<n>/`.
- **Options considered:** (a) server-based review apps (e.g. Heroku); (b) static
  previews on `gh-pages`.
- **Consequences:** no runtime or cost per PR; limited to static output (no
  server-side APIs in the preview).

## ADR-0002 (2026-06-08) — Publish the blog from deploy.yml, not a separate workflow

- **Context:** the blog publisher and the site deploy both write to `gh-pages` and
  both fired on `push` to `main`. Sharing one concurrency group to avoid races made
  them cancel each other (see `bugs.md`, same date); separate groups would instead
  let their `gh-pages` pushes race.
- **Decision:** publish the blog as a step inside `deploy.yml`, so every
  push-to-main `gh-pages` write happens in a single workflow run.
- **Options considered:** (a) two workflows, shared group — cancels on a simultaneous
  merge; (b) two workflows, separate groups — `git push` to `gh-pages` can race;
  (c) serialise via `workflow_run` — works but adds trigger/SHA complexity;
  (d) fold into one run — chosen.
- **Consequences:** one deploy run owns all push-to-main `gh-pages` writes; blog
  logic is a labelled, customisable step rather than its own workflow. PR previews
  stay separate (different event) and share the group only to serialise.

## ADR-0003 (2026-06-08) — Enable Jekyll on gh-pages and derive `baseurl` at deploy

- **Context:** the blog under `/blog/` needs Jekyll, but `peaceiris/actions-gh-pages`
  disables it by default (writes `.nojekyll`); and a project site served at `/<repo>/`
  needs `site.baseurl` set for the blog's `relative_url` links to resolve — yet a
  reusable template must not hardcode the repo name.
- **Decision:** publish with `enable_jekyll: true` (and remove any pre-existing
  `.nojekyll` once), and inject `baseurl` into `_config.yml` at deploy time, derived
  from `GITHUB_REPOSITORY`: `""` for a user/org root site or a custom domain (CNAME),
  `/<repo>` otherwise.
- **Options considered:** (a) hardcode `baseurl` — breaks on fork/rename; (b) make
  template users set it manually — blog broken out of the box; (c) rewrite templates to
  avoid `baseurl` — invasive, awkward for `post.url`; (d) derive it at deploy — chosen.
- **Consequences:** the blog renders and links correctly on any repo with no manual
  config; the static-vs-Jekyll boundary stays simply "has front-matter?", so the app
  and previews remain untouched. Custom domains are handled via the CNAME check.

## ADR-0004 (2026-06-08) — Install and customise spec-kit in this child instance

- **Context:** REMIT is a concrete instance of the template (not the template
  library), so spec-kit should be installed and the documented patterns made
  functional. Two documented capabilities were only described, not wired up:
  (#7) the 3-tier active-feature resolution naming `.specify/.active-feature`, and
  (#5) blog-post generation hooked into the spec-kit lifecycle. Upstream spec-kit
  resolves the active feature via `SPECIFY_FEATURE` → `.specify/feature.json` /
  `SPECIFY_FEATURE_DIRECTORY` → branch prefix — it does **not** read the
  `.specify/.active-feature` file our `CLAUDE.md` and `.gitignore` already commit
  to, and emits no "available specs + recovery hint" on a miss.
- **Decision:** install spec-kit
  (`specify init --here --integration claude --script sh --force --ignore-agent-tools`),
  and add REMIT customisations: (a) `.specify/scripts/bash/active-feature.sh`
  (tier-2 `.active-feature` reader + recovery hint) wired into `common.sh`
  via two small fenced hunks in `get_current_branch` / `get_feature_paths`;
  (b) `.specify/scripts/bash/blog-scaffold.sh` plus fenced blog steps in the
  `speckit-plan` / `speckit-implement` skill bodies.
- **Options considered:** (a) adopt upstream `feature.json`/`SPECIFY_FEATURE_DIRECTORY`
  and abandon `.active-feature` — rejected: diverges from the documented contract
  and the existing `.gitignore` entry; (b) hand-build a custom spec-kit *extension*
  (manifest + `.registry` + hooks) for the blog — rejected: fragile (manifest-hash
  integrity, registry wiring) for little gain; (c) patch `common.sh` + edit skill
  bodies, keeping custom logic in our own un-managed helper scripts — **chosen**.
- **Consequences:** the custom helper scripts survive `specify init` re-runs, but
  the fenced hunks in `common.sh` and the two skill bodies are overwritten on
  re-init and must be re-applied (each is marked `REMIT addition`). Commit the
  `.specify/` toolchain and `.claude/skills/`; gitignore only per-worktree state
  (`.specify/.active-feature`, `.specify/feature.json`). The blog *publisher*
  (`deploy.yml`) is unchanged — it already consumes `specs/*/blog/`.

## ADR-0005 (2026-06-09) — Walking skeleton ships as no-build ES modules (JSDoc-typed), not TypeScript

- **Context:** REMIT's register says the v1 kernel is "TypeScript in-browser mock"
  (DEC-41), but this repo's deploy/preview pipeline contract is a **no-build static
  app** (`pages.config.yml` `build_command: ""`, `dist_dir: app`) — the PR preview
  publishes `app/` verbatim. Introducing a bundler for the skeleton would couple the
  one thing the maintainer reviews (the live PR demo) to new build machinery.
- **Decision:** implement the DEC-44 walking skeleton as plain ES modules under
  `app/js/`, typed with `// @ts-check` + JSDoc. No build step; the preview pipeline
  stays untouched.
- **Options considered:** (a) TS + esbuild/vite via `pages.config.yml` build_command —
  faithful to DEC-41's letter but adds CI/build risk to every preview; (b) TS compiled
  output committed — generated code in review diffs; (c) JSDoc-typed ES modules — keeps
  the deployment contract, loses strict TS syntax. Chosen: (c).
- **Consequences:** type discipline is advisory (ts-check) rather than enforced;
  recorded as a DEC-47 local deviation in `specs/002-walking-skeleton/spec.md` to
  reconcile at the skeleton gate — natural revisit point is DEC-57's LinkML-generated
  TypeScript types, which would justify standing up a real TS build.

<!-- Add new ADRs above this line. -->

## ADR-0006 (2026-06-10) — Tidal ford: leg-level wait-vs-detour weighing, not time-expanded search

- **Context:** increment A of the mudflat slice (G6/DEC-54) makes K-7 a tidal ford
  (wadeable ±3 h of low tide), so the exfil leg becomes time-dependent. A general
  solution is a time-expanded A* (state = cell × time); for a 28×18 demo grid with
  one tidal edge it buries the demo's point in machinery.
- **Decision:** model the tide as a parametric periodic **channel** (period 745 min,
  first low tide H+268, half-width 180 → window [H+88, H+448]) whose open/close edges
  fill the baseline's `forecast_changepoints`. The kernel materialises the exfil **two
  ways** — natural path with a hold at the bank if the ford is shut, and a ford-free
  detour via K-9 — and commits to the earlier RV arrival, publishing the weighing as
  `plan.tide_decision` (surfaced on Plan/Compare cards). Mid-mission re-routes go
  through the same chooser (`chooseExfilRoute`), keeping NF1's single evaluation
  surface.
- **Trade-offs:** exact and explainable for one tidal feature; does not generalise to
  many time-windows per route (a real kernel would need time-expanded search, DEC-41
  line). Execution-delay assessment still shifts the whole timeline uniformly — a
  delay before the bank is really absorbed by the wait; re-assessing the window in
  execution is increment B.
- **Consequences:** schedules may carry split exfil legs (move → hold "Await low
  tide" → cross); RV arrival is the **last** exfil leg (`findLast` — assessExfil,
  measuresAt, plan cards, AAR). Band tracking keys off the visit's end, not the
  phase, so the mid-exfil hold doesn't flip the monitored commitment.

## ADR-0007 (2026-06-10) — Execution disturbances are local re-plans (plan-time ≡ sim-time)

- **Context:** increment A's wingman modelled obstruction delays as a uniform
  offset against the planned timeline (`assess(…, delayMin)`), which became
  dishonest once schedules contained tide holds: a delay before the bank is
  really absorbed by the wait, and a large one forfeits the window entirely.
- **Decision:** drop the offset. An obstruction splices a `hold` leg at the
  vehicle's position and re-times the remainder via `rerouteExecution` — the same
  machinery as blocked-cell re-routes — whose exfil legs re-run the tide-aware
  wait-vs-detour chooser at the new absolute times. Plan-time equals sim-time;
  the assessors read the rebased plan with no delay parameter; `m.tide` carries
  the live decision and the wingman alerts (≋, `tide_reassessment`) whenever a
  rebase changes its mode (wait → open, open → detour on forfeit, …).
- **Trade-offs:** the committed plan stays immutable (the wingman rebases its
  execution clone); the execution log records each rebase with the absorbed
  minutes. Repeated obstructions extend the standing hold; an in-progress visit
  survives rebases whole (the dwell is a commitment, not routing). The uniform
  `delayMin` parameter remains on the kernel assessors for API compatibility but
  the wingman no longer uses it.

## ADR-0008 (2026-06-10) — Sync Matrix as a config-driven entity-projection stack (D6/DEC-52/53)

- **Context:** the entity slice of DEC-54 calls for the D6 Sync Matrix — a
  temporal multi-track view that generalises the skeleton's single timeline —
  over the new first-class Entity abstraction (DEC-52), exercising all three
  provenances (self / forecast / provider) display-only.
- **Decision:** model entities as `{ id, label, provenance, aspects }` where each
  aspect is a typed time-function (`scalar | window | status | cell`) read via a
  single `at(plan, t)` (NF1). A CONFIG catalogue (`entities.js` `syncCatalogue`)
  maps entity.aspect → render type → track; the renderer (`views/sync-matrix.js`)
  draws a stack on one shared axis + playhead. Self reads `stateAt`; tide is a
  forecast entity over the baseline tide channel; the IKAROS-3 satellite is a
  mock provider (DEC-49) returning pass windows. The timeline strip + `makeTimeline`
  are removed — the phase track subsumes them.
- **Coincidence:** at this slice, v1 is **human-scan only** (DEC-53/NF9) — no
  automated window detection. The cursor readout reports each aspect's state at H+t
  (ford open/closed, sat overhead) so coincidences are visible while scrubbing.
  Advisory banded windows (**H1-lite**, the C10-lite dual — shipped next in ADR-0009)
  and first-class coincidence objects (H3) were designed-for from here.
- **Rendering:** the SVG rebuilds only when projected content changes (a content
  signature: sel id, schedule, horizon, catalogue); the cursor slides every tick.
  This keeps playback/scrub cheap and lets drag handlers survive mid-scrub (they
  are not re-bound per tick).
- **Trade-offs:** display-only (no cast-to-channel — that is C9/H3); one default
  role preset (the catalogue is structured for per-role presets but only one is
  wired). The satellite ephemeris is a hand-tuned mock, chosen so the first pass
  coincides with the default OP dwell — illustrative, NF9-honest.

## ADR-0009 (2026-06-10) — Coincidence as advisory declared-conjunction windows (H1-lite, DEC-53)

- **Context:** the Sync Matrix (ADR-0008) shipped coincidence as human-scan only.
  DEC-53's designed-for next step is **advisory banded coincidence windows** — the
  temporal dual of C10's spatial column-aggregation — under the C10-lite discipline
  (DEC-32): advisory, never decides.
- **Decision:** a coincidence **rule** is config (`coincidenceRules()`): a declared
  CONJUNCTION of aspect-predicates over entities (e.g. `self.phase === 'visit' ∧
  sat.pass overhead` = "Imagery window"). `coincidenceWindows()` scans [0,horizon]
  for the maximal intervals where a rule holds; the matrix renders them as faint
  full-height guide columns behind the tracks plus a labelled advisory lane, and the
  cursor readout names any window it sits inside.
- **Discipline:** advisory ONLY — the windows are computed from, and rendered over,
  the existing projection; they never feed the kernel, never alter the plan, and are
  labelled `advisory · C10-lite`. First-class coincidence *objects* the kernel could
  exploit (rendezvous, C9) are deferred to H3 (the opportunity-dual of conflict C1).
- **Horizon (consistency fix):** filed **H1-lite**, not H2. This advisory banded
  tier is the temporal sibling of C10's banded overlay, which is itself `H1-lite`
  and ships in v1 (DEC-32) — duals under one discipline must share a horizon. The
  register's earlier `(H2)` tag on the D6 coincidence tier and DEC-53's "v1
  human-scan only" wording were realigned to H1-lite to match C10; the H3 boundary
  (first-class objects) is unchanged.
- **Trade-offs:** rules are hand-authored demo set-pieces (NF9-honest); the scan is
  1-min resolution (fine for advisory). Both shipped rules need a selected COA
  (self.phase), so windows appear from Views on, not the World step.

## ADR-0011 (2026-06-10) — LinkML is the data-model source of truth; artefacts are generated (DEC-57)

- **Context:** DEC-57 adopts LinkML as the source of truth for the serialisable
  object core (one schema → JSON Schema · TypeScript · Pydantic · HTML), with
  `remit-data-model.md` becoming a generated view. No schema existed yet; the
  data-model mini-site was hand-authored HTML. The maintainer wants the schema
  authored and **human-documented for stakeholder review**, and (constitution)
  wants all non-trivial types to come from this one store, with derived artefacts
  generated, never hand-written.
- **Decision:** author the model (60 classes, 20 enums) from the `remit-data-model.md`
  spine, **reconciled field-by-field against the walking skeleton's real object
  shapes** (so schema ≡ code). Generate via `schema/generate.sh`: JSON Schema +
  TypeScript (`schema/gen/`) and a **single self-contained HTML reference**
  (`schema/build-reference.py` → `site/data-model/`) that replaces the hand-authored
  tour. **Pydantic is omitted** (no Python consumer yet — one line to add). The
  reference is published with the whole site, so it is reviewable per-PR (ADR-0010).
- **Modular schema (version-control hygiene):** the model is **split into discrete
  LinkML modules** under `schema/` — `common` (shared value objects + all enums),
  `requirement`, `world`, `force`, `entities`, `plan`, `records` — stitched by a thin
  entry `schema/remit.yaml` that imports them all; generators run on the entry. To
  avoid circular imports in a cross-linked domain (e.g. `world.FactLayer → Observation`
  in records, `plan.Stamp → Requirement` in requirement), modules import **only**
  `common`; cross-module class references resolve at the merged level (verified —
  including circular refs and the ER diagram). A 1,200-line monolith was rejected:
  clumsy diffs, review and merge conflicts.
- **Options considered (HTML reference):** (a) standard `gen-doc` + MkDocs-Material —
  canonical, full-featured, but **8.8 MB / 315 files**, churns hundreds of files per
  edit, and clashes with the lean no-build repo (ADR-0005); (b) build the docs in CI —
  keeps the repo lean but adds a heavy LinkML+MkDocs step to deploy *and* preview,
  undoing the preview simplification just made; (c) a single self-contained generated
  page on-brand with the tour it replaces (~90 KB, one-file diffs, mermaid via CDN) —
  **chosen**.
- **Scope boundary (DEC-57):** LinkML models *data, not behaviour*. Function-valued
  fields (`Channel.values`, `MovementModel.cost_speed`, `Aspect.value`) and service
  endpoints are documented but not modelled as slots — they live in the seam contract.
- **Skeleton reconciliation:** the schema follows the *code's* field names
  (`clock_min`, `margin_band`, `config_core_hash`, the skeleton's `profile_version`/
  `start` Stamp additions, `Strategy`, `TideDecision`, …), and flags classes the
  skeleton does not yet build (MovementModel, Excursion, ChannelDelta, Effect,
  AOPackage, Waiver, Replan). Divergences (entity `aspects` as object-map vs list;
  `kind`/`provenance` folding) are noted in-schema.
- **Deviation:** `Entity.kind` and `DataProvenance.kind` are documented **strings,
  not enums**, because a permissible value literally named `self` crashes the LinkML
  loader (jsonasobj2 reserves `self`) and the value must equal its key — see bugs.md.
- **Consequences:** the data model now has one validated source feeding the docs,
  JSON Schema and TS; the reference is generated and stakeholder-reviewable. Deferred
  follow-ups (logged): GENERATED banners + a regen-no-diff CI check; a golden-fixtures
  adherence test (skeleton instances validate against the generated JSON Schema); and
  migrating the skeleton's inline shapes onto the generated TS types — see ADR-0012.

## ADR-0012 (2026-06-10) — Adopt the LinkML "one source of truth" type rules (constitution)

- **Context:** the maintainer runs a constitution in a sibling project: *LinkML
  schemas define all data structures; Pydantic/JSON Schema/TypeScript are derived,
  never hand-written; never hand-author a type the schema could generate; types at a
  cross-boundary surface that subset a typed source must be expressed structurally
  (Pick/Omit/Partial/derived validator), never re-listed by hand* — because re-listed
  fields keep compiling while silently dropping a field the source later grows. Enforced
  at writing-time and via lint. They asked how this applies to REMIT.
- **Decision:** adopt the principle here, scoped to this repo's reality:
  1. `schema/remit.yaml` is the one source; `schema/gen/*` and
     `site/data-model/` are generated, never hand-edited.
  2. **UI-only, single-class discrete types are exempt** (the maintainer's carve-out) —
     e.g. the Sync-Matrix display catalogue, coincidence-window rows, render closures,
     and `main.js` in-flight UI state stay hand-written; the schema models the
     serialisable *data* core only.
  3. **The cross-boundary subset rule has no surface yet** — REMIT v1 is one in-browser
     JS process (no host↔webview / service wire). It activates when a boundary appears.
  4. The JS analogue of the "silent field-drop" failure is **drift between the
     skeleton's inline shapes and the schema** — there is no compiler to catch it, so
     the faithful port is a **golden-fixtures adherence test** plus **GENERATED banners +
     a regen-no-diff CI check** (both deferred, ADR-0011), and the writing-time habit in
     CLAUDE.md: *before declaring a non-trivial shared shape in `app/js`, import the
     generated type instead of re-listing fields.*
- **Consequences:** the rules are recorded (CLAUDE.md "Data model" section, the
  spec-kit constitution, and here). Full realisation — the app importing generated
  types and the adherence/lint enforcement — is sequenced as follow-up work, not done
  in this PR.

## ADR-0010 (2026-06-10) — PR previews publish the whole static site, not the app alone

- **Context:** the landing page, `/data-model/`, and the blog are published only on
  merge (by `deploy.yml`); the PR preview published `dist_dir` (the app) verbatim at
  the preview root (see ADR-0001, and ADR-0005's "the preview publishes `app/`
  verbatim"). So a PR that adds or changes a site/docs section (like the Data Model
  mini-site) had nothing reviewable in its preview — the comment linked only to the app.
- **Decision:** assemble the preview the same way `deploy.yml` assembles the merged
  site: copy `site/.` to the preview root (landing page + static sections), then the
  app under `/<app_path>/`. The preview comment now lands on the welcome page, from
  which reviewers reach `/app/` and `/data-model/`. `pr-preview.yml` reads `app_path`
  from `pages.config.yml` (it previously read only `build_command`/`dist_dir`).
- **Options considered:** (a) leave it app-only, review docs locally — no per-PR
  coverage for landing/docs changes; (b) copy only `/data-model/` alongside the
  root app — narrow, and the welcome page itself stays unreviewable; (c) mirror the
  full static-site assembly — **chosen**.
- **Consequences:** the app moves from the preview root to `/<app_path>/` (the
  welcome page's `app/` link resolves; bookmarks to the old root now hit the landing
  page). The **blog is intentionally excluded** from previews: Jekyll only reads the
  gh-pages *root* `_config.yml`/`_layouts`, so blog pages can't render from a
  `pr-preview/pr-N/` subdir — the assemble step drops `_config.yml`, `_layouts/`,
  and `blog/`, so the landing page's "Blog →" card 404s in-preview (it renders on the
  merged site). This refines, and does not conflict with, ADR-0005: the app is still
  published verbatim with no build step, just under `/<app_path>/` instead of at root.

## ADR-0013 (2026-06-11) — Mermaid is the canonical ER view for the data-model reference

- **Context:** the generated reference (`schema/build-reference.py` → `site/data-model/`)
  was built as a *comparison* of four structure views — a self-contained HTML
  containment tree, per-module ER diagrams pre-rendered to inline SVG (offline, via a
  bundled-Chromium step in `schema/render-mermaid.mjs`), in-browser Mermaid ER diagrams
  (CDN), and tree+SVG — fronted by a chooser `index.html`, so the maintainer could pick
  one. The diagrams initially rendered static and small; we then added a self-contained
  pan/zoom viewport (drag/scroll/fit) and made each entity box a link to its
  `#class-<Name>` card. The maintainer chose the **Mermaid** ER view.
- **Decision:** collapse to a single page — the Mermaid ER reference becomes
  `site/data-model/index.html`. The containment-tree and SVG variants, the chooser, and
  the variant banner are dropped. Because Mermaid renders in the browser from the CDN,
  the **offline SVG pre-render is removed**: `schema/render-mermaid.mjs` is deleted and
  the `mermaid` **npm** devDependency (used only by that pre-render) is removed — the
  build (`schema/generate.sh`) no longer needs Node or Chromium, only the LinkML venv.
  The pan/zoom + clickable-box behaviour (`PANZOOM_SCRIPT`) is kept and now targets the
  single `.erd` viewport.
- **Options considered:** (a) keep all four variants + chooser — more to maintain, and
  a "pick one" was the explicit point; (b) keep the offline SVG variant as a no-CDN
  fallback alongside Mermaid — retains the Chromium build step and a second code path
  for a fallback the maintainer didn't pick; (c) **single Mermaid page — chosen.**
- **Consequences:** the reference now depends on the Mermaid CDN at *view* time (blank
  diagrams if the CDN is blocked); this is an accepted trade for the in-browser,
  zoomable, source-inlined diagrams. Re-introducing an offline render is a revert of
  this ADR (the deleted renderer is in git history). The pan/zoom script is
  renderer-agnostic, so an SVG path could be re-added later without touching it.
