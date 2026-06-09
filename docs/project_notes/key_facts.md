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
| Issue tracking | GitHub Issues + a GitHub **Project** board — **Auto-add covers all new issues** (no label filter needed) |
| Org issue fields | Set via `issue_write` → `issue_fields`: **Priority** (Urgent/High/Medium/Low) · **Effort** (High/Medium/Low) · **Start date** · **Target date** |
| Walking skeleton | `app/` (no build step, ES modules under `app/js/`) — spec + evidence in `specs/002-walking-skeleton/` |
| Skeleton scenario | AO "Kara Crossing" 28×18 @ 500 m · base (2,15) · OP-A (21,3) · window H+30..H+120 · dwell 45 min · band unit 20 min · seed 1337 · kernel `mock-0.1` |
| e2e CI | `.github/workflows/e2e.yml` — Playwright suite on every PR / push to main |

_Pages URLs resolve once GitHub Pages is enabled (served from `gh-pages`). Add
anything else worth remembering (service URLs, IDs, constants) as it comes up._
