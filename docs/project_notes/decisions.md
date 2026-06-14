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

## ADR-0014 (2026-06-11) — Dependency policy: minimise, don't prohibit (maintainer-approved)

- **Context:** ADR-0005 shipped the skeleton as no-build ES modules with effectively zero
  runtime dependencies, and `CLAUDE.md` described the app as having "zero external
  dependencies". The H3 hex-grid migration (ADR-0016) needs correct H3 maths and a real map
  renderer; hand-rolling either is large, bug-prone, and off the project's value. The
  maintainer clarified the intent: dependencies are not forbidden — they should be
  **minimised**, and each addition is **approval-gated**.
- **Decision:** runtime dependencies are permitted where they give a clear
  development/maintenance benefit over hand-rolling, **subject to explicit maintainer
  approval**. "Zero dependencies" is no longer an invariant; "minimise, justify, approve" is.
  First approved set (ADR-0015/0016): `h3-js` (indexing/neighbours/hierarchy), `maplibre-gl`
  + `@deck.gl/*` (map + hex rendering), `vite` (build, dev-only).
- **Options considered:** (a) keep zero-dependency, hand-roll H3 + a hex renderer — rejected:
  re-implementing H3 grid maths and a WebGL map is large and error-prone; (b) allow deps
  freely — rejected: erodes the small, auditable surface; (c) minimise + approval-gate — chosen.
- **Consequences:** new deps are listed and justified in the PR and recorded here on approval;
  `package-lock.json` pins exact versions; kernel modules stay dependency-light (only `h3-js`,
  Node-importable) so the browser-free `node --test` suite still runs. Relaxes ADR-0005's
  spirit; `CLAUDE.md` updated to match.

## ADR-0015 (2026-06-11) — Adopt a Vite build step (revisits ADR-0005)

- **Context:** ADR-0005 chose no-build ES modules to keep the PR-preview demo decoupled from
  build machinery, naming DEC-57 (generated TS types) as the natural revisit point. The H3
  migration (ADR-0016) pulls in `maplibre-gl` and `@deck.gl/*` — large ESM packages with
  bare-specifier imports and submodules, impractical to serve un-bundled. An earlier-than-
  expected but warranted revisit.
- **Decision:** adopt **Vite**. `pages.config.yml` already drives an optional build in both
  workflows, so the change is config, not workflow code: `build_command: "npm ci && npm run
  build"`, `dist_dir: "dist"`, `app_path: "app"` (unchanged). Vite is rooted at `app/`, builds
  to `dist/`, with **`base: './'`** so one bundle resolves under `/REMIT/app/` (deploy) and
  `/REMIT/pr-preview/pr-<n>/` (preview).
- **Options considered:** (a) stay no-build, load deck.gl/maplibre via CDN/import-map —
  rejected: runtime CDN dependency + fragile submodule resolution; (b) vendor pre-built bundles
  — rejected: heavy committed blobs, manual versioning; (c) Vite — chosen (best DX; workflows
  already support a build command).
- **Consequences:** the PR preview now exercises `vite build` (ADR-0001/0005's review surface
  preserved); `run-playwright.mjs` serves the built `dist/`; Node-importable kernel modules keep
  `node --test` build-free. `dist/` stays gitignored.

## ADR-0016 (2026-06-11) — H3 hex grid for routing & visualisation (supersedes the square grid and ADR-0006)

- **Context:** the skeleton planned on an abstract 28×18 square grid (8-connected A*, octile)
  with a hand-rolled Canvas, and modelled one tidal ford via a leg-level wait-vs-detour chooser
  (ADR-0006), which itself noted "a real kernel would need time-expanded search". We move to a
  hex grid based on **H3** for isotropic 6-neighbour movement, genuine real-lat/lon-anchored
  indexes with a **latent hierarchy** (future-proofing + dataset interop), and a real-map
  renderer — over a fresh scenario with **multiple** tidal fords.
- **Decision:**
  - **Grid:** H3 at **res 9** (~300 m cells, ~1.2k over a ~14×9 km AO) anchored to a real
    lat/lon (Solway Firth head). A canonical **sorted** AO cell-set gives each cell a stable
    integer id; neighbours are **bearing-sorted** into a frozen adjacency for deterministic A*
    (NF3). Plan identity keys off H3 index **strings** (canonical-JSON-safe, no floats).
  - **Routing:** a deterministic **time-dependent (time-expanded) A*** (state = cell × time,
    1-min steps, waiting allowed) replaces the octile search and **subsumes ADR-0006's chooser**
    — multiple fords are handled by arrival-time-gated edge feasibility; the wait-vs-detour
    decision emerges from the search and is read back into `plan.tide_decision`.
  - **Rendering:** **MapLibre GL JS** (keyless Carto Positron *light* raster basemap, behind a
    load-guard so it degrades gracefully where tiles are blocked) + **deck.gl**
    `H3HexagonLayer`/`PathLayer`/`IconLayer` via `MapboxOverlay` replace the Canvas renderer.
    The hex-cell overlay is independently **toggleable** (a MapLibre control) so the basemap
    beneath can be revealed; routes/markers/ghost stay drawn either way.
  - The H3 **hierarchy is latent** — no active LOD / coarse-to-fine planning / aggregation yet.
- **Trade-offs:** richer and geographically grounded, but a larger surface (build + WebGL + new
  coordinate model) and a deliberate identity change (the config-core hash and golden plan ids
  are regenerated for the new world). WebGL gates only screenshots, not logic (functional e2e is
  `data-*`/state-based), capping the risk.
- **Consequences:** `world.js`/`astar.js`/`kernel.js` are rewritten and `render.js` is replaced;
  `entities.js`, `sync-matrix.js`, `learn.js`, `seam.js`, `stores.js`, `canonical.js` are
  position-agnostic and unchanged; golden fixtures and e2e map-interaction are regenerated.
  Supersedes ADR-0006.

## ADR-0017 (2026-06-11) — Hex terrain sampled from the basemap, baked (refines ADR-0016)

- **Context:** ADR-0016 shipped *synthetic* terrain (a procedural N–S river, fords, woods)
  over the real lat/lon anchor — "abstract-now / geo-later". Once the real Carto basemap
  rendered beneath the hexes (switched to the legible Positron *light* style), the synthetic
  terrain visibly **did not line up** with the map: the painted river ran N–S while the real
  Solway estuary runs ~E–W. The maintainer asked for the hex characteristics to come from the
  map.
- **Decision:** **sample the basemap and bake the result.** `tools/sample-terrain.mjs` renders
  the Positron basemap fit to the AO in a headless browser, reads the basemap framebuffer
  (`gl.readPixels` after a forced redraw), and classifies each of the ~1,445 H3 cells by colour
  (water / open / forest / rough) into a committed `app/js/kernel/terrain-sampled.json`.
  `world.js` loads that baked file as its base terrain, then paints a few **designed set-pieces
  over it** — bank roads, an all-tide causeway, and three tidal fords (the "waths") carved
  across the real water — and snaps the named places (base / RV / OPs) to the nearest dry cell.
- **Determinism (NF3):** the sample is taken **once, offline, and committed**; nothing is
  fetched at runtime, so the browser app and the browser-free `node --test` golden suite read
  identical terrain and plan ids stay reproducible. Re-run the sampler deliberately (basemap or
  AO change) and regenerate the goldens.
- **Options considered:** (a) full OSM/Overpass classification — most accurate, heavier data
  pipeline; (b) **sample the basemap, bake — chosen** (quick; auto-matches whatever basemap is
  shown; classification is approximate — water and green are reliable on Positron, roads/landuse
  are not, hence the designed road/ford overlay); (c) classify at runtime — rejected
  (non-deterministic; the Node golden suite has no browser).
- **Consequences:** the scenario was **re-anchored onto the real estuary** and the golden
  fixtures regenerated (new plan ids, schedules, tide decisions); a short 15-min dwell now
  yields two COAs (direct and tracked converge and content-dedupe) where the 45-min demo still
  yields three. A small author-time hook in `views/map.js` (`window.__REMIT_SAMPLE` →
  `preserveDrawingBuffer` + `window.__map`) keeps the framebuffer readable; it is inert in
  production.

## ADR-0018 (2026-06-12) — Reposition the mission onto the contiguous south-shore arc; the approach is overland (refines ADR-0016/0017)

- **Context:** ADR-0017's sampled estuary, while visually faithful, fragments the west
  "bank" into a thin **ring** of dry land around a broad water body. ADR-0017 snapped the
  named places to the *nearest* dry cell — but for the northern OPs (above Sandywath /
  Bowness Wath) the nearest dry ground was a **water-isolated pocket**: base→OP-A/OP-C were
  reachable only by a ~65-step loop around the whole estuary. Worse, the approach A* reused
  the exfil's edge cost, so it treated the full-width tidal fords as cheap shortcuts and the
  green **approach line waded straight across the deep estuary** (the reported bug). A
  fan-out probe confirmed *no* west-bank base reaches all three OPs by a short dry route —
  the geometry, not the router, was broken.
- **Decision** (maintainer-chosen among reposition / reshape-terrain / revert-ADR-0017):
  **reposition the mission points.** Keep the real sampled estuary as the water to cross;
  move the three OPs onto the one contiguous **south-shore arc** near the river mouth, where
  a short ford-free approach exists (`world.js` `PLACES.ops`). Give the approach/observe leg
  its **own passability** (`kernel.js` `approachCost`, fords → `Infinity`) so the observe
  leg is overland-only while the **exfil keeps the tide-gated ford/bridge** search.
- **Consequences:** approaches are now 9–20 dry steps, ford-free, west of the river (no
  wading, no grand tour). Because the arc sits beside the all-tide causeway, the cheapest
  exfil **detours to the causeway** rather than waiting out a ford, and balanced appetites
  collapse the handful to **two COAs** (covered ≡ direct, content-deduped) at *both* the 45-
  and 15-min dwells — so the tidal "wait vs. cross" drama is muted relative to ADR-0017 (the
  price of a workable geometry on this terrain; the northern waths that gave that drama are
  the unreachable ones). Golden fixtures + e2e COA counts regenerated; the OP names became
  positional (the wath-overlook labels no longer applied). **The muted drama is restored by
  ADR-0020** (the OP positions here are superseded).

## ADR-0019 (2026-06-12) — Drop the standalone "Views" stage; Compare previews the projections live

- **Context:** the lap had a dedicated **Views** stage between Compare and Execute whose
  only job was to show the selected plan's map + Sync-Matrix projections and let the operator
  scrub the playhead before executing. With Compare now **previewing a highlighted COA
  everywhere on selection** (map ghost + own-force tracks, before commit), the Views
  interstitial was redundant.
- **Decision** (maintainer-requested): remove Views; Compare → **Execute** directly. The
  shared projection surface (map + matrix + playhead) is always on screen, so no projection
  capability is lost; the playhead reset to H+0 that Views performed moved into the Execute
  mount. The lap is now **six stages** (World → Capture → Plan → Compare → Execute → Learn).
- **Consequences:** `main.js` (STAGES, `mountStage`, removed `mountViews`), `app/index.html`
  (panel + renumbered headings) and the e2e (the Views assertions folded into Compare,
  screenshots renumbered `05-execute` / `06-learn`) updated. One fewer click to execution.

## ADR-0020 (2026-06-12) — Relocate the mission to the north head to restore the tide drama (refines ADR-0018)

- **Context:** ADR-0018 moved the OPs to the south-shore arc to stop the approach wading the
  estuary — but that arc *is* the all-tide causeway, with a free land walk-around at the river
  mouth, so the exfil always detoured and the tidal "hold for low water" drama vanished. That
  drama (the optimiser handling a *temporal* obstruction, scheduling a hold at the bank) is
  the most valuable thing the demo shows, and the maintainer asked for it back. Investigation
  (ASCII terrain maps + fan-out probes) showed the sampled estuary is **widest exactly where
  the historic waths are** (the middle is all water/ford), so the only dry, base-reachable
  land *adjacent to a wath* is the **north head**, beside Bowness Wath — and, like the south
  head, it has a free walk-around.
- **Decision:** relocate base + the three OPs onto the **north-head land overlooking Bowness
  Wath** (dry approach, 8–14 ford-free steps), and **close the north-head walk-around** with a
  designed water fill (extend the estuary to the northern shore, *east* of the OPs — west of
  −3.107, the OPs and their approach, is untouched). The exfil must then hold at the bank for
  low water and ford the wath; the all-tide causeway stays at 54.928 as the (now far, ~5 km)
  alternative the optimiser weighs and rejects.
- **Consequences:** both the 45- and 15-min dwells now **wait** — the schedule splits
  `exfil → hold (await low tide) → exfil`, and because the tide (waths open H+88) bounds the
  crossing, a shorter visit just means a **longer hold** for the **same RV** (≈H+102): the
  tide, not the dwell, sets the exfil. ADR-0018's wading fix is preserved (approaches are dry
  and ford-free); the cordon test reverts to exfil-infeasibility (the OP is no longer inside
  the cordon band). Golden fixtures, e2e, and evidence regenerated; OP names became
  Bowness-Wath overlooks. **Trade-off:** the all-tide detour is never the cheaper option here,
  so the COAs no longer *split* wait-vs-detour the way ADR-0016 did — the demo shows a clean,
  unanimous tidal hold instead (the Goldilocks wath that would split them, Sandywath, sits in
  the unreachable mid-estuary water). **The split is restored by ADR-0021.**

## ADR-0021 (2026-06-12) — A designed tidal islet at Sandywath to restore the wait-vs-drive fork (refines ADR-0020)

- **Context:** ADR-0020's north-head version gave a clear tidal *hold*, but every COA made the
  same call, so the routes looked alike — the maintainer wanted the original **wait-vs-drive
  fork** back (some COAs wait out the tide and ford; others take the longer all-tide road —
  two visibly different routes). Exhaustive search confirmed the sampled estuary can't offer it
  from real ground: the one wath at a "Goldilocks" distance from the causeway (**Sandywath**)
  has open water on *both* shores (the estuary is widest exactly where the waths are), so there
  is nowhere dry to stand beside it; the reachable waths are either too close to the causeway
  (always drive) or too far (always wait), and the south head's natural land bypass is binary —
  open (always drive) or walled (always wait). The maintainer asked for a designed islet.
- **Decision** (maintainer-approved): carve a small **tidal islet + spit** beside Sandywath — a
  rough saltmarsh causeway from the southern base out to a dry knoll at the wath (`buildTerrain`:
  a `paintPath` spit + `paintDisk` knoll painted over the water — one more set-piece, exactly
  like the causeway and the waths). Base sits on the south shore, the RV across Sandywath on the
  east bank; the north-head walk-around stays filled, so the only all-tide alternative to fording
  is the long road south to the causeway.
- **Consequences:** the exfil genuinely **forks**, and the app's default dwell drops to **25 min**
  so the default scenario shows it: `direct` drives the all-tide road (fast, RV ≈H+86, no wait)
  while `tracked` holds ~32 min at the bank and fords Sandywath (RV ≈H+98) — two distinct routes,
  a speed-vs-concealment trade-off. A longer watch (45 min) lands the team at the bank after low
  water, so both simply ford and the fork closes. This is the first set-piece drawn over water
  *as land* (the others carve crossings); it bends the sampled coastline by ~one spit, which the
  Solway really does have. Golden fixtures, the e2e (dwell 25, `direct`/`tracked` cards, the
  drive-leg block step) and evidence regenerated.

## ADR-0022 (2026-06-12) — Tab shell as the read-only DEC-61 seed (roles-as-config, context-by-injection, pop-out via opener-shared store)

- **Context:** the app was a single UI. The target is a command post — many role surfaces
  over **one** content-addressed store (DEC-59/60/61). The maintainer asked to start that:
  a tabbed, role-based UI where the current screen becomes "Overview" and a new "Data
  Analysis" surface drills through the live data — and, crucially, can be **monitored while
  the mission is driven** (so it must run *beside* Overview, not instead of it).
- **Decision:** introduce a thin shell (`app/js/shell/`) that realises DEC-61 in its
  simplest **read-only** form. (a) **One shared context** — `objects`/`logs`/`seam`/`world`/
  `playhead` are extracted from `main.js` into `shell/context.js`; every surface projects the
  same store. (b) **Roles are config** — `shell/roles.js` lists `{id,label,status,poppable,
  mount}` (the DEC-61 "config-declared bundle"; `writeScope`/`mode` are deferred with the
  writes). (c) **Context by injection** — surfaces are `mount(container, ctx)`, so the *same*
  surface renders the *same* live store inline or popped-out. (d) **Pop-out** — a poppable
  surface opens `popout.html` in its own window and reads the opener's live context via
  `window.opener.__remit` (same-origin), so it monitors changes the main window makes. (e)
  **Overview untouched** — its markup stays static in `index.html`, and `main.js` is imported
  lazily by `shell/overview.js` (it auto-boots on import and queries DOM ids that must exist
  first). Change visibility: since objects are immutable/content-addressed, "changed" = new
  ids; Data Analysis diffs `objects.list()` and **glows** new rows + their type-group header
  (the hook future mock feeds reuse).
- **Options considered:** (a) iframe/second-instance per role — separate stores, defeats
  "one shared store"; (b) swap the whole UI per role — no side-by-side monitor; (c) grow
  `main.js` into the shell — forces the boot block to move and bloats the orchestrator;
  (d) **thin shell + lazy Overview + context injection — chosen.** For cross-window state:
  `window.opener` sharing (chosen, no serialisation) vs a `BroadcastChannel` of stamped
  deltas (deferred — the real `/sync` path, needed once feeds/multi-window *writes* land).
- **Consequences:** the popped-out monitor shares the opener's in-memory store, so it lives
  only while the main window is open and does not survive a main-window reload (it shows a
  recovery message). `SeamClient.onTraffic` gained a backward-compatible unsubscribe return so
  unmounted/popped-out surfaces drop their listener. **No LinkML change** — the roles list is
  UI-only discrete config (ADR-0012 §2); Operation/Scheme/Role/Delta stay designed-for. The
  five non-Overview roles are labelled placeholders; their surfaces, and DEC-61 stamped-delta
  writes + write-scope enforcement, are the next phases. The entry module is now
  `js/shell/shell.js`.
- **Addendum (2026-06-12) — first DEC-61 write: live steering.** On the maintainer's call,
  denying cells in Plan is treated as the *application of intel* and shared across the system
  rather than kept local: each no-go change writes a `SteeringDelta`
  (`{scope:'steering', constraints: Constraint[], provenance}`) to the shared store (debounced
  ~450 ms, deduped on the cell set), where every surface — including a popped-out monitor —
  sees it land. Risk **appetites stay local** (a ranking lens), the explicit contrast. The
  delta is **LinkML-modeled, not hand-shaped** (ADR-0011/0012): `Delta` (abstract) +
  `SteeringDelta` in `schema/records.yaml` — following the `LogEntry` subtype and
  `SelectionRationale` attribution patterns — generated to `schema/gen/remit.{ts,schema.json}`
  and the HTML reference; the payload reuses the schema's `Constraint` (DEC-24), and `main.js`
  references the generated `SteeringDelta` type. Only **write-scope enforcement** (the write is
  attributed but not yet scope-checked) still follows in the writes phase. This makes the
  surface no longer strictly read-only, but holds NF1/NF2: reads still project, and the write
  is attributed (role + author + time).

## ADR-0023 (2026-06-12) — Just-in-time departure: defer a tidal wait to base, not the exposed bank

- **Context:** when a COA's exfil crossed a tidal wath that was shut, the kernel held the team
  *at the bank* for low water — a visible but tactically poor "sit exposed at the ford" wait.
  The maintainer noted two things: (a) it would be better to **delay departure** so the team
  reaches the wath *at* low water, and (b) because both COAs departed at H+0, their map markers
  overlapped (you saw one vehicle until the exfil diverged).
- **Decision:** when a COA's exfil would hold at the bank for the tide, recompute the plan with
  a **just-in-time departure** — the latest base departure that still meets the visit window and
  reaches the wath exactly at low water (`kernel.js` `materialise()`). The bank-hold becomes a
  leading *"Delay departure — cross at low water"* hold **at base**; the crossing is then a
  single open-wath ford. Same RV (tide-bound), no exposed bank-wait, and the tide-waiting COA
  departs *later* than the drive-the-road COA — so the two vehicles move at different times.
- **Consequences:** the tracked COA's schedule changes from `[transit, hold(window), visit,
  exfil, hold(bank), exfil]` to `[hold(delay), transit, visit, exfil]`; its **plan id is
  unchanged** (ids key off the decision inputs, not the materialisation — NF3), so only the
  golden's schedule/wait assertions moved. The window-hold (arriving early to be *in position*
  before the observation window) is kept — only the *tidal* wait is deferred. The wingman's
  in-flight re-routes still hold at the bank (you cannot retro-delay a departure mid-mission).

## ADR-0024 (2026-06-12) — Enforce the JSDoc type-checking the app already declares (checkJs + strict in CI); stay on JS, don't convert to TypeScript

- **Context:** every `app/js` file already carried `// @ts-check` and rich JSDoc types,
  but nothing *enforced* them — no `tsconfig`, no `typescript` dep, no CI step — so the
  directives were editor-only best-effort and type drift accumulated silently (442 errors,
  including stale pre-hex annotations in `wingman.js` and a real schema/code divergence).
  The maintainer wants TypeScript's type-safety without converting the source to `.ts`.
- **Decision:** keep the app as plain ES-module JavaScript and **enforce** the existing
  `// @ts-check`. Added a root `tsconfig.json` (`allowJs`+`checkJs`, `strict`, `noEmit`,
  `types: []`, `lib` DOM, `moduleResolution: bundler`), pinned `typescript` as a devDep,
  exposed `npm run typecheck` (`tsc -p tsconfig.json`), and gate it in CI (`typecheck.yml`,
  PR + push-to-main). Drove the app **442 → 0** type errors.
- **Options considered:** (a) convert `app/js` to TypeScript — adds a transpile step and
  churns every file for no extra safety the JSDoc didn't already give; rejected. (b) enforce
  the existing JSDoc via `tsc --checkJs --strict` — **chosen**. (c) leave `// @ts-check` as
  editor-only — the status quo that let the drift accumulate.
- **Consequences:** type drift now fails the build; no source migrated to `.ts`, no runtime
  build step added (Vite bundles the same JS). Fixes are JSDoc annotations + type-only casts
  with **zero `@ts-ignore`/`@ts-nocheck`** (the codebase stays suppression-free). Opaque
  serialisable blobs (`plan`/`requirement`/log entries/viz data) stay `any` per the
  data-model carve-out (ADR-0012); DOM, primitives and shared shapes are precisely typed
  (new typedefs incl. `HexAO`, `Strat`/`Leg`/`RerouteOpts`, `Entity`/`Aspect`). `app/hexviz.js`
  (a standalone evidence page) is outside `include`; type-checking the Node-side tooling
  (`test`/`e2e`/`run-playwright.mjs`) is a possible follow-up under a second, Node-lib config.

## ADR-0025 (2026-06-12) — Capture execution-phase perturbations as typed `ExecutionDelta` store objects (issue #7)

- **Context:** the Execute phase lets the operator perturb a live run — an obstruction
  (`+5`/`+25 min` hold) or a blocked cell forcing a re-route. Both appended a prose
  `Observation` to the append-only execution log, but their *structured* inputs (cell,
  minutes, resulting RV) lived only in transient wingman UI state. Nothing reached the
  content-addressed object store, so — unlike `SteeringDelta` (the first DEC-61 write) — the
  perturbations were invisible to the Data Analysis monitor and carried no structured inputs
  for replay (NF3). The maintainer raised this as issue #7: *"they aren't captured in the
  model. Should they be?"*
- **Decision:** **Yes.** Model the perturbation in LinkML and write it via the existing
  DEC-61 attributed-delta path. Added `ExecutionEventKind` (`obstruction`|`block`) + a
  `HexCell` value object (`h3` + optional `lat`/`lng`, the hex successor to `Waypoint`) to
  `common`, and a concrete `ExecutionDelta (is_a: Delta)` to `records` (`event`, `at_min`,
  `cell`, `delay_min`, `rv_min`, `absorbed_min`); regenerated `schema/gen/` + the HTML
  reference. The wingman calls `seam.putObject('ExecutionDelta', …)` on each edit, attributed
  to the operator wearing the **Ops** hat (`role: 'duty-officer-ops'`).
- **Options considered:** (a) pack the fields into the prose log entry — still invisible to
  the store-backed monitor/replay; rejected. (b) a hand-written wingman UI-state object —
  violates the LinkML one-source-of-truth rule (ADR-0012) the moment it crosses into the
  shared store; rejected. (c) a generated typed delta mirroring `SteeringDelta` — **chosen**.
- **Consequences:** in-flight edits now appear in Data Analysis (with change-glow) and are
  structurally preserved for replay. The prose log entry is **kept** (it reads well in the
  after-action record) — the delta is its structured sibling, not a replacement; the share is
  **non-fatal** (a failed write never breaks the live loop, since the log already recorded
  the event). **Not done:** re-running a stamp does not yet *re-apply* the captured
  perturbations (they're exogenous operator acts) — capturing the inputs is the prerequisite,
  automatic re-application is the follow-up. `HexCell` is now the natural type to migrate the
  documented square-vs-hex `Constraint.cells` drift in `SteeringDelta` onto (bugs.md).

## ADR-0026 (2026-06-13) — ORBAT blue/red/green authoring scaffolding (display-only)

- **Context:** the entity catalogue was fixed in config and seeded only a single own
  force; a planner could not express the own-force *pool*, the adversary, or the neutral
  picture of a scenario (DEC-60). The serialisable ORBAT/asset shape had to live somewhere.
- **Decision:** bring all three sides forward as **display-only authoring scaffolding**
  (DEC-56 horizon split, NF9 honest floor). Each asset is a first-class **Entity** (DEC-52)
  carrying an `allegiance`, reusing the existing entity → map / Sync-Matrix projection. The
  serialisable shape is **schema-defined and regenerated** (Principle I): an `Allegiance`
  enum (`blue|red|green`) on `common`, an optional `allegiance` attribute on `Entity`, and a
  new `schema/orbat.yaml` module (`Orbat`, `Asset`, `Blue/Red/GreenParams`, `Protection`;
  reusing `Waypoint`/`Lineage`/`TimeWindow`). The model (`app/js/orbat/orbat.js`) is a pure,
  deterministic writer (add/duplicate/tune/remove/validate/canonical/commit); the panel
  (`app/js/shell/orbat-panel.js`, the `sme-int` role-tab) and map read through it.
- **Blue is display-only:** authoring/tuning **never** changes kernel routing in v1. The
  existing planned own-force (ROVER-1) is **reconciled** as the single `canonical_own_force`
  blue asset (protected from removal) and keeps driving the plan via the pre-existing
  machinery; pool blue assets seed the future Scheme allocation (deferred, H2). The
  route-unchanged invariant is asserted by an e2e (tune blue → committed Plan ids identical).
- **Options considered:** (a) a bespoke `ThreatMarker`/`RoeZone` type — rejected, duplicates
  Entity and breaks one-ontology/three-stances symmetry (DEC-60); (b) a hand-written app
  typedef for the persisted shape — rejected, violates Principle I (ADR-0012); (c) wiring
  red into `edgeCost` for a plan-around demo — rejected, that is the deferred avoid-assess
  capability and would breach NF9. Placement uses a default in-AO position (cross-tab
  map-click is impractical: the map lives in the Overview tab, the panel in `sme-int`).
- **Consequences:** add/duplicate/tune/remove multiple instances of each allegiance;
  allegiance-coloured map markers (+ faint extent ring + label); Sync-Matrix tracks for
  time-windowed assets; the working draft mirrors to `localStorage` (survives reload),
  commit mints an immutable content-addressed `Orbat` with lineage. Determinism (NF3):
  assets are sorted by `id` and canonicalised before identity/projection. **Not done
  (deferred, NF9):** reactive adversary behaviour (DEC-51), capability-matched blue
  allocation (H2), live ROE constraint / collateral objective emission (DEC-60 J3).

## ADR-0027 (2026-06-14) — ORBAT asset enrichment: kind/icons/confidence + red dual-range + descriptive fields (display-only)

- **Context:** spec 004 rendered every ORBAT asset as a same-looking allegiance-coloured dot with a
  single extent ring — no platform type, no intel reliability, a single radius that conflated a
  threat's detection and weapon reach, and no descriptive detail. The maintainer asked to enrich the
  SME-Int picture (spec 005).
- **Decision:** add **display-only, additive** asset attributes (NF9 honest floor) — all schema-defined
  and regenerated (Principle I): a shared `kind` (`PlatformKind` enum) driving a map **symbol** with a
  per-asset `symbol` override; an intel `confidence` (reusing `ConfidenceLevel`) shown as marker
  **opacity**; red **dual range rings** (`detection_range_m`/`engagement_range_m` on `RedParams`,
  `engagement ≤ detection` enforced) replacing the single extent for red; and lightweight descriptive
  fields — shared `strength`/`notes`, red `threat_type`, green `category` (`GreenCategory` enum), blue
  `role`. Green/blue keep the single `extent_m`.
- **Symbols are TextLayer glyphs, not an icon atlas** (research D1): a hand-written `SYMBOLS` lookup
  (kind → Unicode/emoji) rendered via the existing deck.gl `TextLayer` over the allegiance marker — no
  bundled image asset, no new dependency, no build step (Principle II). The glyph lookup + `symbolOf`/
  `confidenceOpacity` are the documented UI/behaviour carve-out (ADR-0012); only the *data* is schema.
- **Backward compatibility (FR-010):** a pure, idempotent `normalize()` (wired into `loadDraft`)
  migrates spec-004 red drafts — `detection_range_m` adopts the prior single `extent_m`, seeding
  `engagement_range_m ≈ 0.5×` (clamped ≤ detection). Absent kind/confidence default to generic
  symbol / full emphasis. Canonical bytes/identity are preserved for already-migrated rosters (NF3).
- **Vocab vs free-text semantics:** controlled-vocabulary fields (kind, confidence, green category)
  IGNORE an invalid value (keep the last valid one) and clear only on empty (`setVocab`); free-text
  fields (symbol, strength, notes, threat_type, role) trim and drop-when-empty (`setOrDrop`/`cleanStr`),
  never stored blank (FR-014).
- **Options considered:** (a) a NATO APP-6/2525 symbology engine + affiliation frame shapes — rejected
  for v1 (a lookup table, not an engine; colour framing suffices); (b) deck.gl `IconLayer` with an icon
  atlas — rejected (needs a bundled image asset); (c) a new numeric confidence scale — rejected (reuse
  `ConfidenceLevel`); (d) two `Asset.extent`s shared by all allegiances — rejected (green/blue have no
  detect/engage distinction; ranges live on `RedParams`).
- **Consequences:** the map reads like a recognised picture — typed allegiance symbols, a confidence
  wash, red see-it/hit-it rings, hover tooltips with descriptive detail. Everything stays display-only
  (an e2e re-asserts tune ⇒ committed Plan ids unchanged); spec-004 drafts load intact. **Out of scope
  (deferred):** a richer place-on-map interaction and true NATO frame shapes (a later slice); any
  routing/kernel influence (the avoid-assess capability, DEC-51).

## ADR-0028 (2026-06-14) — Skeleton-gate reconciliation (DEC-47 → register DEC-62)

- **Context:** the DEC-44 walking skeleton (PR #2, issue [#3](https://github.com/DeepBlueCLtd/REMIT/issues/3))
  surfaced three build discoveries that out-ran or contradicted the register, held as local deviations under
  DEC-47's batch-reconciliation policy for the skeleton-complete gate. All three had since been **baked into the
  LinkML source of truth** (DEC-57) when the schema was reconciled against the skeleton's real object shapes — but
  the **Doc-owned register** (DEC-37) and the prose spine `docs/remit-data-model.md` §6/§7 still showed the
  pre-skeleton wording. The maintainer asked to close the gate.
- **Decision:** record **DEC-62** in `docs/remit-register.md` ratifying the three, and bring the prose spine into
  line with the schema. **(A) Stamp gains a platform/start axis** — `profile_version` (own-force profile, DEC-19)
  + `start{x,y,clock_min}` are identity inputs (a plan depends on both; identical stamps with different profiles
  would collide, breaking NF3); refines DEC-29/35. **(B) Plan-id within-handful discriminator** — one stamp
  legitimately yields a handful (DEC-22/40-C), so `Plan.id = hash(Stamp ⊕ strategy)`, not `hash(Stamp)`; the stamp
  stays the comparability basis (A3), the strategy distinguishes siblings; clarifies DEC-29. **(C) No-build
  `// @ts-check`+JSDoc ratified as DEC-41's TypeScript realisation** — a mechanism note, not a reversal: v1 keeps
  the no-build deploy/preview contract (Principle II, ADR-0001/0005, DEC-58) and meets DEC-41's typing intent via
  JSDoc checked by `tsc --checkJs --noEmit` (ADR-0024) consuming the LinkML-generated `.ts` types (DEC-57).
- **Why ratify, not reverse:** (A) and (B) are NF3 necessities the schema already enforces — the only open work
  was recording them so the register ≡ the generated source. (C)'s register revisit-trigger ("when DEC-57's
  generated TS lands") had fired, and the no-build constitution is now firmly established (Principle II; ADR-0024
  enforces TypeScript-grade checking *without* a build), so the gate conclusion is ratify, following DEC-40's
  caveat-not-reversal pattern.
- **Scope — docs/governance only:** `remit-register.md` (DEC-62 + version → v28), `remit-data-model.md` §6/§7
  squared to the schema, the skeleton spec's deviations section annotated with the gate outcome, project memory.
  **No schema or code change** — the schema already carries `profile_version`/`start`/`StartState` and
  `Plan.strategy` / `id = hash(Stamp, strategy)`; `schema/gen/` untouched, no regenerate needed.
- **Remaining skeleton notes:** World-before-Capture tool-order, mock band-calibration, and the `entities/` vs
  `views/projection/` module placement were reviewed and **held as-is** (no register change); the mid-stream
  coincidence H2→H1-lite edit (ADR-0009/DEC-53) was already reconciled. Closes issue #3.

## ADR-0029 (2026-06-14) — LinkML guardrails: GENERATED banners, regen-no-diff CI, schema-adherence test

- **Context:** ADR-0011/0012 adopted LinkML as the one source of truth (DEC-57) and logged three deferred
  guardrails to make Principle I *enforceable* rather than aspirational: GENERATED banners on the derived
  artefacts, a regen-no-diff CI check, and a golden-fixtures adherence test (skeleton instances validate against
  the generated JSON Schema). This lands all three. (The fourth ADR-0012 note — migrating the app's inline shapes
  onto the generated TS — remains its own spec.)
- **Decision:**
  - **GENERATED banners.** `schema/generate.sh` now stamps every derived file `@generated — DO NOT EDIT` (a `//`
    block on `remit.ts`, a `$comment` first-key on `remit.schema.json` — textual insert, no reformat — and an HTML
    comment on `index.html`), plus a `.gitattributes` marking them `linguist-generated`. The banner is re-applied
    each run, so it survives regeneration.
  - **regen-no-diff CI** (`.github/workflows/schema-regen.yml`): regenerates from the schema and fails on any diff
    under `schema/gen/` + `site/data-model/`, so the committed artefacts can never silently fall out of step with
    `schema/*.yaml`. Reproducibility pinned — `generate.sh` installs `linkml==1.11.1` + `linkml-runtime==1.11.1`,
    CI uses Python 3.11; verified to reproduce the committed bytes exactly (empty `git diff`).
  - **Schema-adherence test** (`test/schema-adherence.test.mjs`, `node --test`): builds real instances — a
    committed `Orbat` (red/green/own-force) and a kernel `Plan` (Stamp/Scores/Materialisation) — and validates
    them against `schema/gen/remit.schema.json` with **ajv** (dev-only; draft-2019-09). Documented pre-existing
    drifts are stripped per class (its `DRIFT` map) and the rest validated strictly, so the guard is green yet
    still fails on any NEW drift (proven by an undeclared-field assertion). Wired into a new **`unit.yml`** CI job
    (`npm run test:unit`) — which also closes the gap that the unit suite (golden fixtures, ORBAT, routing) had
    never run in CI, only e2e + typecheck did, so the adherence guard (and all the others) now actually fire on PRs.
- **The guard earned its keep immediately:** it confirmed the documented `Waypoint` square-vs-hex drift (bugs.md)
  extends beyond `SteeringDelta` to `Asset.position`, `Stamp.start` and `Materialisation.trajectory`, and surfaced
  two more — the kernel carries `appetites` as a `{axis:setting}` map where the schema models `Appetite[]`, and
  `TideDecision` shapes differently. Recorded (bugs.md) and stripped via `DRIFT`; the Waypoint→HexCell migration +
  appetites/tide reconciliation (then emptying `DRIFT`) is the concrete next follow-up this guard makes visible.
- **Dependency (ADR-0014):** adds `ajv` as a **dev**-only dependency (test-only; never imported by `app/` or the
  kernel), maintainer-approved for this guard. No runtime dependency added.
- **Options considered:** (a) ajv vs a hand-rolled validator — ajv, for faithful draft-2019-09 validation (a
  hand-rolled check can't honestly resolve `$ref`/`anyOf`/`additionalProperties`); (b) banner via reserialisation
  vs textual insert — textual, to leave gen-json-schema's bytes untouched (zero churn); (c) fixing the surfaced
  drift now vs strip-and-track — tracked, to keep this PR a pure guardrail, not a schema migration.
- **Consequences:** Principle I is now enforced, not just stated — generated files are labelled, drift fails CI
  two ways (regen + adherence), and the schema's real gaps are visible and tracked. Scope: tooling/CI/test only;
  the sole schema-output change is the banner text. No `app/`/kernel code changed.
