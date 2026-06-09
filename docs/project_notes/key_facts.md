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
| Issue tracking | GitHub Issues + a GitHub **Project** board with *Auto-add* enabled (record the Project URL here once known) |
| Org issue fields | Set via `issue_write` → `issue_fields`: **Priority** (Urgent/High/Medium/Low) · **Effort** (High/Medium/Low) · **Start date** · **Target date** |

_Pages URLs resolve once GitHub Pages is enabled (served from `gh-pages`). Add
anything else worth remembering (service URLs, IDs, constants) as it comes up._
