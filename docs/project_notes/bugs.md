# Bug log

A running log of bugs hit and fixed, so the same thing is not debugged twice.

**Protocol:** when you hit an error, search this file for the symptom first. When
you resolve a new bug, add an entry.

Each entry records: date, symptom, root cause, fix, and how to prevent recurrence.

---

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

<!-- Add new entries above this line. -->
