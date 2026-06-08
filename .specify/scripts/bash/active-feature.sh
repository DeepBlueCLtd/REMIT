#!/usr/bin/env bash
# active-feature.sh — REMIT addition (capability #7: active-feature resolution).
#
# Implements this project's documented 3-tier resolution ON TOP of spec-kit's own
# resolver, keeping edits to upstream code (common.sh) to two small fenced hunks.
# spec-kit does not manage this file, so it survives `specify init` re-runs; if a
# re-run overwrites common.sh, only the two fenced hunks that call these helpers
# need re-applying. See docs/project_notes/decisions.md (ADR-0004).
#
# Resolution order (see CLAUDE.md -> Active feature resolution):
#   1. SPECIFY_FEATURE env var        — honoured upstream in get_current_branch()
#   2. .specify/.active-feature file  — THIS helper (tier 2); gitignored, per-worktree;
#                                        the mechanism for cloud sessions whose forced
#                                        branch name carries no NNN- token
#   3. first NNN- token in the branch — honoured upstream in find_feature_dir_by_prefix()

# Echo the active-feature override from .specify/.active-feature, if present:
# the first non-empty, non-comment line, whitespace-trimmed. Prints nothing when
# the file is absent/empty. Always returns 0 so callers under `set -e`/pipefail
# are never aborted by a parser failure.
tmpl_read_active_feature() {
    local repo_root="$1"
    local af_file="$repo_root/.specify/.active-feature"
    [[ -f "$af_file" ]] || return 0
    local line
    line=$( { grep -vE '^[[:space:]]*(#|$)' "$af_file" 2>/dev/null || true; } | head -n1 )
    # trim leading/trailing whitespace
    line="${line#"${line%%[![:space:]]*}"}"
    line="${line%"${line##*[![:space:]]}"}"
    [[ -n "$line" ]] && printf '%s' "$line"
    return 0
}

# Print an "available specs + recovery hint" message to stderr when no active
# feature could be resolved (capability #7: "If none resolve, the scripts list the
# available specs and show a recovery hint"). Always returns 0.
tmpl_no_feature_hint() {
    local repo_root="$1"
    local specs_dir="$repo_root/specs"
    {
        echo "ERROR: could not resolve an active spec/feature."
        if [[ -d "$specs_dir" ]]; then
            echo "Available specs:"
            local d found=0
            for d in "$specs_dir"/*/; do
                [[ -d "$d" ]] || continue
                echo "  - $(basename "$d")"
                found=1
            done
            [[ "$found" -eq 0 ]] && echo "  (none yet — run /speckit-specify to create one)"
        else
            echo "  (no specs/ directory yet — run /speckit-specify to create one)"
        fi
        echo "Recovery — set one of:"
        echo "  export SPECIFY_FEATURE=NNN-name              # process-scoped override"
        echo "  echo NNN-name > .specify/.active-feature     # worktree-scoped (cloud sessions)"
        echo "  or check out a branch whose name contains an NNN- token (e.g. 220-fix-foo)"
    } >&2
    return 0
}
