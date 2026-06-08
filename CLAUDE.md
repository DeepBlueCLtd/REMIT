# CLAUDE.md

Guidance for Claude (and human contributors) working in this repository.

> This file ships with the project template. The **patterns** below — project
> memory, the spec-driven workflow, the blog pipeline, Playwright-in-cloud, and
> Pages deployment — are ready to use. Fill in the project-specific
> **placeholders** marked `TODO`.

---

## Project overview

<!-- TODO: one paragraph on what this project is and does. -->

- **Tech stack:** <!-- TODO -->
- **Build / run locally:** <!-- TODO -->
- **Key directories:** <!-- TODO -->

---

## Project memory — `docs/project_notes/`

Institutional knowledge lives in four files. Consult them before acting and update
them after acting, so context survives across sessions and contributors.

| File | Holds |
|------|-------|
| `docs/project_notes/decisions.md` | Architectural Decision Records (context + trade-offs) |
| `docs/project_notes/bugs.md` | Bugs hit and fixed, with prevention notes |
| `docs/project_notes/key_facts.md` | Config, URLs, important constants |
| `docs/project_notes/issues.md` | Work log with ticket IDs and URLs |

### Memory protocols

- **Before proposing an architectural change:** check `decisions.md`. If your
  change conflicts with an existing decision, acknowledge the conflict and explain
  why the change is warranted.
- **When you hit an error:** search `bugs.md` for the same symptom first. When you
  resolve a new bug, record the symptom, cause, fix, and prevention in `bugs.md`.
- **When you need a project value (URL, constant, config):** check `key_facts.md`
  first.
- **When you complete a piece of work:** log it in `issues.md` with the ticket ID
  and URL, and link any evidence (e.g. `specs/<feature>/evidence/`).

---

## Spec-driven workflow (spec-kit)

This project uses [GitHub spec-kit](https://github.com/github/spec-kit)
(`/speckit.specify`, `/speckit.plan`, `/speckit.tasks`, `/speckit.implement`).

### Installing spec-kit (always the newest version)

spec-kit is **not** vendored in this repo — install it fresh so you get the latest
commands and templates. Run once, when setting the project up:

```bash
# Start a new project (creates the directory):
uvx --from git+https://github.com/github/spec-kit.git specify init <project-name>

# Or initialise spec-kit inside an existing repo:
uvx --from git+https://github.com/github/spec-kit.git specify init --here
```

### Active feature resolution

spec-kit commands operate on a single spec directory, resolved in this order:

1. **`SPECIFY_FEATURE` environment variable** — a process-scoped override, e.g.
   `export SPECIFY_FEATURE=220-fix-theme`.
2. **`.specify/.active-feature`** — a file at the repo root holding a single line
   with the spec directory name. Persists across commands in the same worktree and
   is gitignored.
3. **The current git branch** — the first `NNN-` token in the branch name is used
   (e.g. `220-fix-foo`, `claude/220-fix-foo-xyz`, `feature/220-foo`).

If none resolve, the scripts list the available specs and show a recovery hint.

#### Cloud sessions (Claude Code web)

Cloud sessions run on a forced branch name like `claude/<topic>-<random>`, which
cannot carry an `NNN-` token. To work on spec `NNN-xxx`, set the active feature
once at the start of the session:

```bash
echo NNN-xxx > .specify/.active-feature
```

---

## Blog posts from specs

Each completed spec produces a short blog post, authored during development (so it
is reviewed in the feature PR) and published automatically on merge.

### During development

The post lives **under its spec**, not in the published blog structure:

```
specs/<NNN-spec-name>/
└── blog/
    ├── post.md          # the post (start from docs/blog-post-template.md)
    └── screenshots/     # images referenced as screenshots/<name>.png
```

Significant posts also open with an **"at a glance" highlight** — a one-line bold
takeaway plus the single most compelling screenshot or piece of evidence — to draw
readers in; when unsure what to feature, offer the maintainer options to choose from. Every post covers: **the problem**,
**options**, **the strategy**, **the results**, and **screenshots** (whenever the
feature is graphical). Hook points in
the spec-kit lifecycle:

- **At `/speckit.plan`:** sketch the post's structure and note which screenshots
  will be most illustrative.
- **At `/speckit.implement`:** write `post.md` and gather the screenshots.

The post doubles as a fast PR review aid — reading it summarises the problem,
approach, and results before diving into the diff.

### On merge

The deploy workflow (`.github/workflows/deploy.yml`) publishes the blog as part of
each push to `main`: it copies the `specs/*/blog/post.md` that push introduced to
`blog/_posts/YYYY-MM-DD-<spec>.md` on the `gh-pages` branch (screenshots to
`blog/assets/<spec>/`, image paths rewritten); Jekyll then renders it at
`/blog/<spec>/`. Blog publishing lives in `deploy.yml` (not a separate workflow) so
every push-to-main `gh-pages` write happens in one run — two workflows triggering on
the same merge would otherwise cancel each other on the shared concurrency group
(see `docs/project_notes/decisions.md`, ADR-0002).

**To customise:** edit the markdown template (`docs/blog-post-template.md`), the
front matter, or the blog step in `deploy.yml`. Because spec-kit is installed fresh, adapt
its `plan` / `implement` commands in your own checkout if you want the post drafted
automatically.

---

## Playwright in cloud sessions

**Cloud sessions can take real screenshots — do not skip Playwright work assuming
they cannot.** The per-feature evidence
(`specs/<feature>/evidence/screenshots/*.png`) and the blog media depend on running
these in-session.

`playwright install chromium` is blocked by a CDN 403 in cloud sessions, so the
reference wrapper uses a bundled browser instead:

```bash
# One-time dev deps (in a Node project):
npm i -D @playwright/test @sparticuz/chromium

# Run the suite (extracts bundled Chromium, starts the server, runs the tests):
node run-playwright.mjs
```

- `run-playwright.mjs` extracts `@sparticuz/chromium` to `/tmp/chromium`, sets
  `CHROMIUM_PATH` and `CLAUDE_CODE=1`, starts the static server, runs
  `playwright test`, and cleans up.
- `playwright.config.ts` reads `CLAUDE_CODE` / `CHROMIUM_PATH` and points Playwright
  at the bundled binary.

**Local fallback** — you do not need the wrapper locally:

```bash
npx playwright install chromium
npx playwright test
```

> `run-playwright.mjs`, `playwright.config.ts`, and `e2e/example.spec.ts` ship as
> **reference files** — adapt the server command, paths, and tests to this project,
> and install the two dev deps above to make them runnable.

---

## GitHub Pages deployment

The site is served from the `gh-pages` branch and has four parts:

| Path | What | Published by |
|------|------|--------------|
| `/` | Landing / navigation hub (`site/index.html`) | `deploy.yml` (push to `main`) |
| `/app/` | The built application | `deploy.yml` (push to `main`) |
| `/blog/` | Jekyll-rendered blog | `deploy.yml` (push to `main`) |
| `/pr-preview/pr-<n>/` | Per-PR preview + a PR comment with the link | `pr-preview.yml` (PR events) |

Deployment is **config-driven**: `pages.config.yml` holds the app name, build
command, dist directory, and app path, so the workflows are not coupled to any
stack. Set those values and the pipeline activates; until an app build is
configured, the workflows publish the scaffolding only.

Jekyll is constrained to `/blog/`: only blog files carry YAML front-matter, so the
app and previews are served as untouched static files (see `site/_config.yml`).

See `README.md` for the one-time GitHub settings (enable Pages from the `gh-pages`
branch; allow workflows to write).
