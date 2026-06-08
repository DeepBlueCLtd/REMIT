# Spec 001 — spec-kit activation

Make this child instance fully functional against the template's seven
capabilities by installing spec-kit and wiring up the four that were only
documented.

## Problem

Three capabilities worked (Pages deploy + PR previews, project memory, the blog
publisher); four were documented but not functional: spec-kit was uninstalled,
the `.specify/.active-feature` resolution tier was not implemented, blog
generation was not wired into the lifecycle, and Playwright had no `package.json`.

## Scope

- Install spec-kit (`specify init --here --integration claude`).
- Active-feature resolution (#7): `active-feature.sh` (tier 2 + recovery hint) +
  fenced hunks in `common.sh`.
- Blog generation (#5): `blog-scaffold.sh` + fenced steps in the `speckit-plan` /
  `speckit-implement` skills. Publisher (`deploy.yml`) unchanged.
- Playwright (#6): `package.json` with the dev deps + `test:e2e` scripts (wired up).
- Docs/memory: `CLAUDE.md`, `README.md`, ADR-0004, work-log / bugs / key-facts.

See `docs/project_notes/decisions.md` (ADR-0004) for the decision record, and
`blog/post.md` for the narrative summary.

## Out of scope

- Running Playwright / installing deps in-session.
- Any change to the blog publisher or the Pages workflows.
