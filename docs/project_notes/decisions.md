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

<!-- Add new ADRs above this line. -->
