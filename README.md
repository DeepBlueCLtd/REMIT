# repo_template

A reusable GitHub **repository template** that bundles the build techniques,
automation, and conventions reused across greenfield projects — so each new project
starts from a proven foundation instead of re-deriving the same patterns.

> Stack-agnostic where possible, customisable where not. Everything here is an
> adaptable example you are expected to tailor, not fixed machinery.

## What it provides

1. **GitHub Pages deployment** — the built app on `main`, plus an isolated,
   browsable preview for every PR (with a comment linking to it).
2. **Spec-kit, installed fresh** — instructions to pull the current
   `github/spec-kit` per project, so you always get the latest.
3. **Project memory** — a standard `docs/project_notes/` structure for decisions,
   bugs, key facts, and a work log.
4. **Memory-aware protocols** — the check-before / record-after rules, in
   `CLAUDE.md`.
5. **Blog on Pages** — posts authored alongside each spec and published
   automatically on merge.
6. **Playwright in the cloud** — a reference wrapper so end-to-end tests and real
   screenshots work inside Claude Code web sessions.
7. **Active feature resolution** — reliable spec selection, including a workaround
   for cloud branch names.

## Getting started

1. **Create a repo from this template** (GitHub → *Use this template*).
2. **Install spec-kit** (newest version):
   ```bash
   uvx --from git+https://github.com/github/spec-kit.git specify init --here
   ```
3. **Configure deployment** — edit `pages.config.yml` (app name, build command,
   dist directory, app path).
4. **Enable GitHub Pages** (see the checklist below), then push.

## One-time repository setup

These are GitHub settings that cannot be set from code:

- [ ] **Template repository:** Settings → check *Template repository* (if you want
      others to fork this).
- [ ] **Pages source:** Settings → Pages → *Deploy from a branch* → `gh-pages` /
      `(root)`. The `gh-pages` branch is created automatically by the first
      workflow run, so do this after the first push to `main`.
- [ ] **Workflow permissions:** Settings → Actions → General → *Workflow
      permissions* → *Read and write* (so workflows can publish to `gh-pages` and
      comment on PRs).

> **Fork PRs:** preview deployment and the preview comment are skipped on pull
> requests opened *from forks* (their `GITHUB_TOKEN` is read-only). Same-repo
> branch PRs work normally.

## Layout

```
.github/workflows/   deploy.yml · pr-preview.yml
pages.config.yml     deployment configuration (edit me)
site/                landing page, Jekyll config + layout, blog shell
docs/project_notes/  decisions · bugs · key_facts · issues
docs/blog-post-template.md
run-playwright.mjs · playwright.config.ts · e2e/   Playwright reference (cloud)
CLAUDE.md            agent + contributor guide for everything above
```

## Playwright (cloud screenshots)

Cloud sessions **can** produce real screenshots. In a Node project:

```bash
npm i -D @playwright/test @sparticuz/chromium
node run-playwright.mjs
```

Locally, run `npx playwright install chromium` once, then `npx playwright test`.
See `CLAUDE.md` → *Playwright in cloud sessions*.

## Where to look next

- **`CLAUDE.md`** — the working guide: memory protocols, the spec-kit workflow +
  active-feature resolution, the blog pattern, Playwright, and deployment.
- **`docs/project_notes/`** — this project's accumulated memory.

## License

[EPL-2.0](LICENSE).
