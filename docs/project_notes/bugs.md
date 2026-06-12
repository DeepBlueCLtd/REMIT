# Bug log

A running log of bugs hit and fixed, so the same thing is not debugged twice.

**Protocol:** when you hit an error, search this file for the symptom first. When
you resolve a new bug, add an entry.

Each entry records: date, symptom, root cause, fix, and how to prevent recurrence.

---

## 2026-06-08 — spec-kit re-init silently drops REMIT customisations

- **Symptom:** after re-running `specify init` (e.g. to upgrade spec-kit), the
  3-tier active-feature resolution and the blog hooks stop working.
- **Root cause:** `init` overwrites `.specify/scripts/bash/common.sh` and the skill
  bodies (`.claude/skills/speckit-{plan,implement}/SKILL.md`), discarding the fenced
  `REMIT addition` hunks. Upstream spec-kit does not read `.specify/.active-feature`.
- **Fix:** re-apply the fenced `REMIT addition` hunks. The helper scripts
  (`active-feature.sh`, `blog-scaffold.sh`) are not managed by `init` and survive.
- **Prevention:** avoid casual re-init; when upgrading, diff and re-apply the hunks.
  See `decisions.md` ADR-0004.

## 2026-06-08 — Example: PR preview 404s on deep links

- **Symptom:** the PR preview loaded at `/` but deep links returned 404.
- **Root cause:** the app used absolute paths that ignored the
  `/pr-preview/pr-<n>/` base path.
- **Fix:** switched the app to base-relative links / a base-aware router config.
- **Prevention:** keep app links base-relative; check a deep link in every PR
  preview.

## 2026-06-08 — Blog publish cancelled on every merge (gh-pages concurrency)

- **Symptom:** after merging to `main`, the `Publish blog on merge` run showed
  `cancelled` (0 jobs executed) while `Deploy site to GitHub Pages` succeeded.
- **Root cause:** `deploy.yml` and `publish-blog.yml` both triggered on the same
  `push` to `main` and shared `concurrency: group: gh-pages`. GitHub keeps only one
  running + one *pending* run per group; two runs created in the same instant from
  the same event leave one to be cancelled before it starts.
- **Fix:** folded blog publishing into `deploy.yml` as a step in the deploy job, so
  a merge makes a single `gh-pages` push (deploy + blog together); removed
  `publish-blog.yml`.
- **Prevention:** do not put two workflows that trigger on the *same* event in the
  same concurrency group; serialise same-event `gh-pages` writers within one run.

## 2026-06-08 — Deploy fails on merges that touch no blog post (set -e + grep)

- **Symptom:** `Deploy site to GitHub Pages` failed (exit 1) on the PR #2 merge at
  the "Add blog posts introduced by this push" step; `gh-pages` was not updated.
- **Root cause:** the change-detection pipeline `git diff … | grep … | sed … | sort`
  runs under `set -euo pipefail` (and GitHub's `bash -e`). When the push changed no
  `specs/*/blog/` file, `grep` matches nothing and exits 1; `pipefail` propagates it
  and `set -e` turns it into a step abort — so the deploy fails on nearly every merge.
- **Fix:** wrap the no-match-prone stage as `{ grep -E '…' || true; }` so an empty
  match is exit 0, while real `git`/`sed`/`sort` failures still propagate.
- **Prevention:** under `set -e`/`pipefail`, any `grep` used as a *filter* (not a
  test) must tolerate the no-match exit; always exercise the empty-input path in tests.

## 2026-06-08 — PR-preview nav links 404 (relative links assume `/app/` depth)

- **Symptom:** in a PR preview (`/pr-preview/pr-<n>/`), the demo app's "Landing" and
  "Blog" nav links 404'd, although the same links worked in the real `/app/` deploy.
- **Root cause:** the links were relative (`../`, `../blog/`) — correct for the app's
  production mount one level under root (`/<base>/app/`), but wrong in a preview, which
  sits a level deeper (`/<base>/pr-preview/pr-<n>/`), so `../` resolved to
  `/<base>/pr-preview/` instead of the site root. (The preview contains only the app,
  so there is no preview-local Landing/Blog to reach anyway.)
- **Fix:** derive the site root from `location.pathname` at runtime (strip the trailing
  `app/` or `pr-preview/pr-N/` segment) and set the hrefs from it, so the nav points at
  the live hosted pages from any mount depth — with no base path hardcoded, keeping the
  template reusable under any repo name, root site, or custom domain.
- **Prevention:** never assume a fixed mount depth for links shared between the `/app/`
  deploy and PR previews; compute the base from the URL. Click a cross-link in every
  preview.

## 2026-06-08 — Blog served raw Liquid (`.nojekyll` disabled Jekyll) + links missing base path

- **Symptom:** `/blog/` showed its template *source* — `--- layout: default ---`,
  `{% if … %}`, `{{ post.title }}` — instead of rendered HTML.
- **Root cause:** `peaceiris/actions-gh-pages` writes a root `.nojekyll` by default,
  which turns Jekyll off site-wide, so the blog's front-matter/Liquid was never
  processed. A second, latent bug: `_config.yml` set no `baseurl`, so the layout's
  `relative_url` links (`{{ '/blog/' | relative_url }}`, `{{ post.url | relative_url }}`)
  would resolve to the *domain* root and 404 even once rendered.
- **Fix (`deploy.yml`):** publish with `enable_jekyll: true` (stop writing `.nojekyll`)
  and delete the stale one once via a guarded step; derive `baseurl` from the repo at
  deploy time and inject it into `_config.yml` (project site → `/<repo>`; user/org root
  or custom-domain/CNAME → `""`), so nothing is hardcoded.
- **Prevention:** when a gh-pages deploy action is involved, confirm Jekyll is actually
  enabled (no `.nojekyll`) if any page needs rendering; for project sites always set
  `baseurl`, and *derive* it rather than hardcode so the template stays portable.

## 2026-06-09 — Maintainer stuck at Plan stage (progression affordance + silent-failure risk)

- **Symptom:** in the deployed PR preview, the maintainer could not progress past
  the Plan stage, while the e2e suite (and the same suite pointed at the live
  preview URL) passed the identical path.
- **Root cause(s):** progression relied solely on the pulsing next-stage chip in
  the left rail — easy to miss; and the app had no global error surface, so any
  browser-specific exception (e.g. during the next stage's mount) would strand
  the rail in its locked state with no message at all.
- **Fix:** (1) explicit "Continue → next stage" button injected into each panel
  at the moment its committing act completes — and injected *before* the next
  stage mounts; (2) inline ES5-safe fault banner wired to `window.onerror` +
  `unhandledrejection` (works even if the ES modules fail to load); (3)
  `mountStage` guarded so a mount failure shows in the banner and still
  re-renders the rail; (4) replaced the one `Array.at(-1)` (Safari <15.4).
- **Prevention:** e2e now walks the same continue-button path a person uses and
  asserts the fault banner stays hidden; any future stuck report should come
  with the banner's text rather than a mystery.

- **Symptom:** `npm run test:e2e` in a Claude Code cloud session failed with
  "Executable doesn't exist at /opt/pw-browsers/…" — Playwright tried its own
  managed browser instead of the bundled one.
- **Root cause:** the session exports `CLAUDECODE=1` (no underscore), but
  `run-playwright.mjs` only checked `CLAUDE_CODE`, so `isCloud` was false and the
  `@sparticuz/chromium` path was never used.
- **Fix:** the wrapper now accepts either spelling (`CLAUDE_CODE` or `CLAUDECODE`).
- **Prevention:** when gating on environment detection, log the decision
  (`[run-playwright] cloud=…` already does) and check it first when browser
  launch fails in cloud.

## 2026-06-09 — @sparticuz/chromium `executablePath('/tmp/chromium')` throws (API drift)

- **Symptom:** wrapper failed with `The input directory "/tmp/chromium" does not
  exist` from `@sparticuz/chromium`.
- **Root cause:** in current versions (v121+), `executablePath(input)` treats the
  argument as the *source* location of the brotli pack, not the extraction target.
  The template called it with the intended destination.
- **Fix:** call `chromium.executablePath()` with no argument — it extracts the
  bundled pack itself and returns `/tmp/chromium`.
- **Prevention:** treat the wrapper as version-coupled to `@sparticuz/chromium`;
  re-check its README on dependency bumps.

## 2026-06-10 — `node --test test/` treats the directory as a module (MODULE_NOT_FOUND)

- **Symptom:** `npm run test:unit` (initially wired to `node --test test/`) failed with
  `Error: Cannot find module '/home/user/REMIT/test'` / `MODULE_NOT_FOUND` before any
  test ran — yet running the file directly (`node test/kernel.golden.test.mjs`) passed.
- **Root cause:** in Node 22, `node --test <path>` does not scan a directory the way
  bare `node --test` does; a path argument is treated as a module specifier to load, and
  a directory has no resolvable entry point.
- **Fix:** point the runner at a quoted glob so Node (not the shell) expands it —
  `node --test "test/**/*.test.mjs"`; this is what `package.json` `test:unit` uses.
- **Prevention:** for node's built-in runner, discover tests with a quoted glob (or run
  bare `node --test` from the repo root); never pass a bare directory path.

## 2026-06-10 — LinkML install fails under distro pip (`install_layout`); needs a venv

- **Symptom:** `pip3 install linkml` aborts building wheels for legacy sdists
  (`antlr4-python3-runtime`, `cfgraph`, `pytest-logging`) with
  `AttributeError: install_layout` — no LinkML toolchain.
- **Root cause:** Debian's system `pip`/`setuptools` carries the `install_layout`
  patch, which breaks `setup.py`-based builds of those old transitive deps. PyPI is
  reachable; the failure is the distro setuptools, not the network.
- **Fix:** install into a clean virtualenv (`python3 -m venv` → upgrade
  pip/setuptools/wheel → `pip install linkml`). `schema/generate.sh` bootstraps this
  automatically (`LINKML_VENV`, default `/tmp/linkml-venv`).
- **Prevention:** never use the distro `pip` for LinkML here; always go through the
  venv the generate script creates.

## 2026-06-10 — LinkML generators crash on a permissible value named `self`

- **Symptom:** every generator (`gen-json-schema`/`gen-typescript`/`gen-erdiagram`)
  aborts at schema *load* with
  `TypeError: ExtendedNamespace.__init__() got multiple values for argument 'self'`.
- **Root cause:** `jsonasobj2` builds objects via `__init__(self, … **d)`; any mapping
  key literally named `self` (here an enum permissible value `self`, for own force)
  collides with the positional `self`. LinkML also forbids a permissible value whose
  `text` differs from its key, so you can't keep value `self` under a safe key either.
- **Fix:** don't model the two value sets that contain `self` (entity kind /
  data provenance) as LinkML enums — model `Entity.kind` and `DataProvenance.kind` as
  documented strings that list the allowed values (preserving the real wire value
  `self`). All other enums stay real LinkML enums. Documented in the schema.
- **Prevention:** never use `self` (or other Python-reserved/`__init__` kwarg names)
  as a permissible-value or mapping key in a LinkML schema.

## 2026-06-12 — Route approach wades across the deep estuary instead of going overland

- **Symptom:** on the sampled-estuary basemap the green **approach** line from the base to
  the OP cut straight across open deep-blue water, and the planned schedules leaned on a
  tidal "wait then ford" that looked wrong for an *approach* (you don't wade a deep wath to
  get *to* an observation post).
- **Root cause:** two compounding effects of the ADR-0017 sampling. (1) `nearestDry`
  anchored each land place to the *nearest* dry cell, but the northern OPs' nearest dry
  ground was a **water-isolated pocket** — the sampled estuary fragments the west "bank"
  into a ring, so base→OP-A/OP-C were reachable only by a ~65-step loop around the whole
  estuary. (2) The approach A* reused the exfil's `edgeMin`, so the fords (painted
  full-width across the estuary, mobility 0.55) were valid **cheap shortcuts** — the
  approach simply waded a ford rather than walk around. Forbidding fords on the approach
  alone then exposed (1): the only ford-free route was the grand tour (worse) or infeasible.
- **Fix:** (a) give the **approach/observe leg its own cost** (`approachCost` in
  `kernel.js`) that returns `Infinity` across any ford cell, so the observe leg is
  overland-only while the **exfil keeps the tide-gated ford/bridge** search; (b) **snap land
  places to dry land** in `world.js` (`nearestDry`, already present) **and reposition the
  three OPs onto the contiguous south-shore arc** (`PLACES.ops`) — the only ground a short
  dry approach reaches. Approaches are now 9–20 dry steps, ford-free, west of the river;
  the exfil detours to the all-tide causeway. Goldens regenerated.
- **Prevention:** a land place must anchor to dry ground **short-reachable from the base**,
  not merely the nearest dry cell (nearest-dry can be a disconnected pocket). The approach
  and the exfil need **different passability** — approach forbids water, exfil allows
  tide-gated fords. When repositioning places, assert in a diag that every approach is
  ford-free and stays on the start bank.

## 2026-06-12 — data-model HTML reference churns on every regen (nondeterministic)

- **Symptom:** `bash schema/generate.sh` produces a different `site/data-model/index.html`
  on every run even with no schema change (md5 differs), giving large spurious diffs; the
  generated TS / JSON Schema are stable. Two consecutive regens disagree.
- **Root cause:** `schema/build-reference.py` built the whole-model ER diagram from
  `list(class_names)` where `class_names = set(classes)`. Iterating a Python `set` is
  hash-randomised per process (PYTHONHASHSEED), so the ER entity order — and thus the file —
  varied run to run. A generated artefact must be deterministic, or "regenerate, never
  hand-edit" produces churn and CI can't diff-check it.
- **Fix:** iterate the `classes` dict (deterministic insertion/merge order) instead of the
  set: `mermaid_src(list(classes))`. Re-running now yields an identical file.
- **Prevention:** never derive *ordered output* from a `set`. When emitting generated
  artefacts, iterate an ordered structure (dict keys, a `sorted()` list) so the output is
  byte-stable across runs.

<!-- Add new entries above this line. -->
