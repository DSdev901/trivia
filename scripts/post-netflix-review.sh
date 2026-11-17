#!/usr/bin/env bash
# Publish the Netflix review checklist written by refresh-current-events.mjs
# (NETFLIX_REVIEW_FILE): always to the Actions run summary, and as a GitHub
# issue when the repo has issues enabled (older open reviews are closed).
set -euo pipefail

file=${1:?review file}
if [ ! -s "$file" ]; then
  echo "No Netflix review this run."
  exit 0
fi

title="Netflix review: $(date -u +%Y-%m-%d)"
if [ -n "${GITHUB_STEP_SUMMARY:-}" ]; then
  { echo "## ${title}"; echo; cat "$file"; } >> "$GITHUB_STEP_SUMMARY"
fi

if [ "$(gh repo view --json hasIssuesEnabled --jq .hasIssuesEnabled 2>/dev/null)" != "true" ]; then
  echo "Issues are disabled on this repo; review is in the run summary only."
  exit 0
fi

gh issue list --state open --limit 50 --json number,title \
  --jq '.[] | select(.title | startswith("Netflix review")) | .number' |
  while read -r n; do
    gh issue close "$n" --comment "Superseded by the latest Netflix review." >/dev/null || true
  done
gh issue create --title "$title" --body-file "$file"
