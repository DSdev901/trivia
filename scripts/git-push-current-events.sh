#!/usr/bin/env bash
# Commit generated current-events files and push to main, merging any
# commits that landed while this job was running.
set -euo pipefail

msg=${1:?commit message}
shift

if [ "$#" -eq 0 ]; then
  git add data/current-events/
else
  git add "$@"
fi

if git diff --cached --quiet; then
  echo "No data changes to commit."
  exit 0
fi

git commit -m "$msg"
git config pull.rebase false

for attempt in 1 2 3 4 5; do
  git fetch origin main
  if ! git merge --no-edit origin/main; then
    echo "Merge conflict — keeping this job's current-events files."
    git checkout --ours -- data/current-events/ || true
    git add data/current-events/
    git commit --no-edit || true
  fi
  if git push origin HEAD:main; then
    echo "Pushed on attempt ${attempt}."
    exit 0
  fi
  echo "Push rejected (attempt ${attempt}). Retrying..."
  sleep $((attempt * 5))
done

echo "Could not push after retries."
exit 1
