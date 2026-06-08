# Key facts

Project configuration, URLs, and important constants. Check here first when you
need a value.

| Fact | Value |
|------|-------|
| Pages site | `https://<user>.github.io/<repo>/` |
| Live app | `…/app/` |
| Blog | `…/blog/` |
| PR previews | `…/pr-preview/pr-<n>/` |
| Default branch | `main` |
| Deploy branch | `gh-pages` |
| Deploy config | `pages.config.yml` |
| spec-kit install | `uvx --from git+https://github.com/github/spec-kit.git specify init --here --integration claude --script sh --force --ignore-agent-tools` |
| spec-kit commands | `/speckit-specify` · `/speckit-plan` · `/speckit-tasks` · `/speckit-implement` (skills under `.claude/skills/`) |
| Active-feature override | `echo NNN-name > .specify/.active-feature` (gitignored, per-worktree; cloud sessions) |
| e2e tests | `npm run test:e2e` (cloud wrapper) · `npm run test:e2e:local` (after `npm install`) |
| Playwright deps | `@playwright/test ^1.60`, `@sparticuz/chromium ^149` (bundled Chromium for cloud) |

_Replace the placeholder URLs above (`<user>`/`<repo>`) with this project's real
values, and add anything else worth remembering (service URLs, IDs, constants)._
