#!/usr/bin/env bash
# blog-scaffold.sh — REMIT addition (capability #5: blog-from-specs generation).
#
# Scaffolds the blog folder for the ACTIVE spec so /speckit-implement can author
# the post: creates specs/<feature>/blog/{post.md,screenshots/}, seeding post.md
# from docs/blog-post-template.md when absent. Idempotent — never overwrites an
# existing post.md (so re-runs and hand edits are safe). The publish side already
# consumes this exact layout (.github/workflows/deploy.yml -> blog step), so no
# workflow change is needed. Active spec is resolved via common.sh's 3-tier order.
#
# Usage: .specify/scripts/bash/blog-scaffold.sh [--json]
set -e

SCRIPT_DIR="$(CDPATH="" cd -- "$(dirname -- "${BASH_SOURCE[0]}")" && pwd)"
source "$SCRIPT_DIR/common.sh"

JSON_MODE=false
[[ "${1:-}" == "--json" ]] && JSON_MODE=true

REPO_ROOT="$(get_repo_root)"

# Resolve the active feature directory via the shared resolver. On a miss it
# prints the available specs + a recovery hint (see common.sh) and returns 1.
_paths_output="$(get_feature_paths)" || exit 1
eval "$_paths_output"

BLOG_DIR="$FEATURE_DIR/blog"
POST="$BLOG_DIR/post.md"
SHOTS="$BLOG_DIR/screenshots"
TEMPLATE="$REPO_ROOT/docs/blog-post-template.md"

mkdir -p "$SHOTS"

CREATED=false
if [[ ! -f "$POST" ]]; then
    if [[ -f "$TEMPLATE" ]]; then
        cp "$TEMPLATE" "$POST"
    else
        # Minimal fallback if the template is missing — keep the required sections.
        printf '---\nlayout: default\ntitle: "%s"\n---\n\n## The problem\n\n## Options\n\n## The strategy\n\n## The results\n\n## Screenshots\n' \
            "$(basename "$FEATURE_DIR")" > "$POST"
    fi
    CREATED=true
fi

if [[ "$JSON_MODE" == true ]]; then
    printf '{"BLOG_DIR":"%s","POST":"%s","SCREENSHOTS":"%s","CREATED":%s}\n' \
        "$BLOG_DIR" "$POST" "$SHOTS" "$CREATED"
else
    echo "BLOG_DIR=$BLOG_DIR"
    echo "POST=$POST"
    echo "SCREENSHOTS=$SHOTS"
    echo "CREATED=$CREATED"
fi
