#!/usr/bin/env bash
# Commit generated current-events files and push to main, merging any
# commits that landed while this job was running.
set -euo pipefail

msg=${1:?commit message}
shift

if [ "$#" -eq 0 ]; then
  git add data/current-events/ data/trending/
else
  git add "$@"
fi

if git diff --cached --quiet; then
  echo "No data changes to commit."
  exit 0
fi

git commit -m "$msg"
export GIT_TERMINAL_PROMPT=0
git config pull.rebase false

for attempt in 1 2 3 4 5; do
  echo "Syncing main before push (attempt ${attempt})..."
  if ! git pull --no-rebase --no-edit origin main; then
    echo "Merge conflict — keeping this job's data files."
    if [ "$#" -eq 0 ]; then
      git checkout --ours -- data/current-events/ data/trending/ || true
      git add data/current-events/ data/trending/
    else
      git checkout --ours -- "$@" || true
      git add "$@"
    fi
    git commit --no-edit || true
  fi
  if git push origin HEAD; then
    echo "Pushed on attempt ${attempt}."
    exit 0
  fi
  echo "Push rejected (attempt ${attempt}). Retrying..."
  sleep $((attempt * 5))
done

echo "Could not push after retries."
exit 1
