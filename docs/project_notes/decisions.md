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

## ADR-0010 (2026-06-11) — Dependency policy: minimise, don't prohibit (maintainer-approved)

- **Context:** ADR-0005 shipped the skeleton as no-build ES modules with effectively zero
  runtime dependencies, and `CLAUDE.md` described the app as having "zero external
  dependencies". The H3 hex-grid migration (ADR-0012) needs correct H3 maths and a real map
  renderer; hand-rolling either is large, bug-prone, and off the project's value. The
  maintainer clarified the intent: dependencies are not forbidden — they should be
  **minimised**, and each addition is **approval-gated**.
- **Decision:** runtime dependencies are permitted where they give a clear
  development/maintenance benefit over hand-rolling, **subject to explicit maintainer
  approval**. "Zero dependencies" is no longer an invariant; "minimise, justify, approve" is.
  First approved set (ADR-0011/0012): `h3-js` (indexing/neighbours/hierarchy), `maplibre-gl`
  + `@deck.gl/*` (map + hex rendering), `vite` (build, dev-only).
- **Options considered:** (a) keep zero-dependency, hand-roll H3 + a hex renderer — rejected:
  re-implementing H3 grid maths and a WebGL map is large and error-prone; (b) allow deps
  freely — rejected: erodes the small, auditable surface; (c) minimise + approval-gate — chosen.
- **Consequences:** new deps are listed and justified in the PR and recorded here on approval;
  `package-lock.json` pins exact versions; kernel modules stay dependency-light (only `h3-js`,
  Node-importable) so the browser-free `node --test` suite still runs. Relaxes ADR-0005's
  spirit; `CLAUDE.md` updated to match.

## ADR-0011 (2026-06-11) — Adopt a Vite build step (revisits ADR-0005)

- **Context:** ADR-0005 chose no-build ES modules to keep the PR-preview demo decoupled from
  build machinery, naming DEC-57 (generated TS types) as the natural revisit point. The H3
  migration (ADR-0012) pulls in `maplibre-gl` and `@deck.gl/*` — large ESM packages with
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

## ADR-0012 (2026-06-11) — H3 hex grid for routing & visualisation (supersedes the square grid and ADR-0006)

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
  - **Rendering:** **MapLibre GL JS** (keyless Carto dark-matter basemap) + **deck.gl**
    `H3HexagonLayer`/`PathLayer`/`IconLayer` via `MapboxOverlay` replace the Canvas renderer.
  - The H3 **hierarchy is latent** — no active LOD / coarse-to-fine planning / aggregation yet.
- **Trade-offs:** richer and geographically grounded, but a larger surface (build + WebGL + new
  coordinate model) and a deliberate identity change (the config-core hash and golden plan ids
  are regenerated for the new world). WebGL gates only screenshots, not logic (functional e2e is
  `data-*`/state-based), capping the risk.
- **Consequences:** `world.js`/`astar.js`/`kernel.js` are rewritten and `render.js` is replaced;
  `entities.js`, `sync-matrix.js`, `learn.js`, `seam.js`, `stores.js`, `canonical.js` are
  position-agnostic and unchanged; golden fixtures and e2e map-interaction are regenerated.
  Supersedes ADR-0006.
