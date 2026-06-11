<!--
Sync Impact Report
- Version change: (unversioned template) → 1.0.0
- Ratification: initial adoption (2026-06-10)
- Principles defined:
  I. LinkML Is the Data-Model Source of Truth
  II. No-Build Static App
  III. Spec-Driven Workflow
  IV. Durable Project Memory
  V. The Repository Is the Canonical Home
- Sections added: Technology & Deployment Constraints; Development Workflow & Quality
  Gates; Governance
- Templates reviewed:
  ✅ .specify/templates/plan-template.md (Constitution Check gate — compatible; no
     principle removed, no change required)
  ✅ .specify/templates/spec-template.md (no mandatory section added/removed)
  ✅ .specify/templates/tasks-template.md (no new principle-driven task category)
  ✅ .claude/skills/speckit-*/SKILL.md (generic guidance; no outdated references)
- Deferred TODOs: none
- Source of principles: CLAUDE.md and docs/project_notes/decisions.md (ADR-0005,
  ADR-0010/0011/0012) and the register (DEC-37/44/57/58).
-->

# REMIT Constitution

REMIT models a mission as a small set of immutable, attributed, content-addressed
objects, shipped as a no-build static demo plus the reusable template toolchain.
These principles are non-negotiable defaults; deviations must be justified and
recorded as an ADR in `docs/project_notes/decisions.md`.

## Core Principles

### I. LinkML Is the Data-Model Source of Truth (NON-NEGOTIABLE)

The serialisable object core is defined **once**, in `schema/remit.yaml`
(DEC-57). TypeScript and JSON Schema — and later Pydantic — are **generated, never
hand-written** (`schema/generate.sh`). You MUST NOT hand-author a type the schema
could generate, and MUST NOT re-list a source type's fields by hand at a boundary;
subset types MUST be structural (`Pick`/`Omit`/`Partial` or a schema-derived
validator). *Rationale:* re-listing fields keeps compiling while silently dropping
any field the source later grows — derivation turns that silent drop into a build
error. The check is a **writing-time habit** (before declaring a non-trivial shared
shape in `app/js`, import the generated type).

Carve-outs and scope: UI-only, single-class discrete types are **exempt** (view /
display shapes used in one place stay hand-written). LinkML models **data, not
behaviour** — function-valued fields (`Channel.values`, `MovementModel.cost_speed`,
`Aspect.value`) and service endpoints live in the seam contract, not the schema.
The schema MUST stay reconciled with the app's real object shapes (schema ≡ code).
Generated artefacts (`schema/gen/`, `site/data-model/`) MUST NOT be hand-edited.

### II. No-Build Static App

The app ships as plain ES modules under `app/js/`, typed with `// @ts-check` + JSDoc,
with **no bundler or build step** (ADR-0005); the deploy and preview pipelines publish
`app/` verbatim. Type discipline is advisory (`ts-check`), not enforced at runtime.
Introducing a build step is a constitution-level change (record the trade-off as an
ADR) — the live PR demo must not be coupled to new build machinery casually.

### III. Spec-Driven Workflow

Non-trivial features flow through spec-kit: `/speckit-specify` → `/speckit-plan` →
`/speckit-tasks` → `/speckit-implement` (DEC-44). The active feature resolves via
`SPECIFY_FEATURE` → `.specify/.active-feature` → the branch `NNN-` token. Each
completed spec produces a short **blog post authored during development** (under
`specs/<spec>/blog/`) so it is reviewed in the feature PR and published on merge.

### IV. Durable Project Memory

Institutional knowledge lives in `docs/project_notes/`: `decisions.md` (ADRs),
`bugs.md`, `key_facts.md`, `issues.md`. You MUST consult them before acting (check
`decisions.md` before an architectural change; search `bugs.md` for a symptom before
debugging; check `key_facts.md` for a value) and MUST update them after acting
(record new ADRs, bugs with prevention notes, facts, and a work-log entry per
completed piece of work).

### V. The Repository Is the Canonical Home

The GitHub repo is the canonical home for the doc-set, code, the LinkML schema and
its generated artefacts (DEC-58). The Discussion Register stays **Doc-owned** and is
the upstream source of truth (DEC-37); implementation status lives in the tracker —
GitHub issues / PRs. Versioned objects are immutable: a change is a new version with
lineage, never a mutation.

## Technology & Deployment Constraints

- **Stack:** static HTML/CSS/JS app (no build); Node.js + Playwright
  (`@sparticuz/chromium` for cloud screenshots) for e2e; Jekyll for the blog on
  `gh-pages`; GitHub Actions for deploy/preview; spec-kit for the workflow.
- **Deployment is config-driven** via `pages.config.yml`; workflows are not coupled to
  any stack. Jekyll is constrained to `/blog/` — only blog files carry front-matter,
  so the app, the data-model reference and previews are served as untouched static
  files.
- **PR previews publish the whole static site** (welcome + `/data-model/` + `/app/`),
  so site/docs changes are reviewable per-PR (ADR-0010); the blog renders only on the
  merged site (Jekyll needs the gh-pages root).
- **Data-model toolchain:** LinkML must be installed in a virtualenv (the distro `pip`
  fails); `schema/generate.sh` bootstraps it. Pydantic generation is omitted until a
  Python consumer exists.

## Development Workflow & Quality Gates

- **Tests:** `npm run test:unit` (node's runner; golden kernel fixtures with pinned
  plan ids — regenerate deliberately) and `npm run test:e2e` (cloud wrapper) /
  `:local`. e2e runs on every PR and push to `main`.
- **Evidence:** graphical features capture screenshots under
  `specs/<feature>/evidence/`; cloud sessions CAN take real screenshots and MUST NOT
  skip Playwright work assuming otherwise.
- **Review aid:** the spec's blog post doubles as a fast PR review summary (problem,
  options, strategy, results, screenshots).
- **Deferred data-model hardening** (planned, not yet enforced): a regen-no-diff CI
  check + `GENERATED` banners on derived files, and a golden-fixtures adherence test
  validating the app's real instances against the generated JSON Schema.

## Governance

This constitution supersedes ad-hoc practice. Amendments MUST be made by editing this
file via `/speckit-constitution`, recorded with a version bump and an ADR in
`decisions.md`, and propagated to dependent templates (`plan`/`spec`/`tasks`) in the
same change.

Versioning follows semantic versioning of the governance itself: **MAJOR** for a
backward-incompatible principle removal or redefinition, **MINOR** for a new principle
or materially expanded section, **PATCH** for clarifications. PRs and reviews SHOULD
verify compliance with these principles; any deviation MUST be justified in the PR and
captured as an ADR. Use `CLAUDE.md` for day-to-day runtime development guidance; where
it and this constitution disagree, this constitution wins and `CLAUDE.md` is corrected.

**Version**: 1.0.0 | **Ratified**: 2026-06-10 | **Last Amended**: 2026-06-10
