#!/usr/bin/env bash
set -Eeuo pipefail

PROJECT_ID="${FIREBASE_PROJECT_ID:-agrisolar-website}"
EXPECTED_PROJECT_ID="agrisolar-website"
ROOT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")/.." && pwd)"

if [[ "$PROJECT_ID" != "$EXPECTED_PROJECT_ID" ]]; then
  echo "Refusing to deploy unexpected Firebase project: $PROJECT_ID" >&2
  exit 2
fi

cd "$ROOT_DIR"

for cmd in git npm firebase curl; do
  if ! command -v "$cmd" >/dev/null 2>&1; then
    echo "Required command not found: $cmd" >&2
    exit 2
  fi
done

if [[ -n "$(git status --porcelain)" ]]; then
  echo "Working tree is not clean. Deployment will not stash or discard user changes." >&2
  git status --short >&2
  exit 3
fi

echo "==> Syncing clean checkout with origin/main"
git fetch origin
BRANCH="$(git symbolic-ref --quiet --short HEAD || true)"
if [[ "$BRANCH" == "main" ]]; then
  git pull --ff-only origin main
elif [[ -z "$BRANCH" ]]; then
  git checkout --detach origin/main
else
  echo "Current branch is '$BRANCH'. Use a clean main/deployment worktree instead of deploying a feature branch." >&2
  exit 3
fi

NODE_MAJOR="$(node -p "process.versions.node.split('.')[0]" 2>/dev/null || echo unknown)"
if [[ "$NODE_MAJOR" != "22" ]]; then
  echo "WARNING: local Node is $(node --version 2>/dev/null || echo unavailable); Firebase Functions target Node 22."
  echo "Deployment has worked with other local Node versions, but Node 22 is preferred."
fi

echo "==> Installing exact dependencies"
npm ci
npm ci --prefix functions

if [[ "${AGRISOLAR_SKIP_TESTS:-0}" != "1" ]]; then
  echo "==> Running deployment checks"
  npm run test:syntax
  npm run test:structure
  npm run test:business-api
  npm run test:form-attachment
  npm run test:admin-attachment
  npm run test:admin-schedule
  npm run test:admin-outreach
  npm run test:ai-outreach
else
  echo "WARNING: AGRISOLAR_SKIP_TESTS=1; deployment tests were skipped."
fi

echo "==> Deploying Realtime Database and Storage rules"
firebase deploy --only database,storage --project "$PROJECT_ID"

echo "==> Deploying Cloud Functions"
firebase deploy --only functions --project "$PROJECT_ID"

echo "==> Deploying Firebase Hosting"
firebase deploy --only hosting --project "$PROJECT_ID"

echo "==> Verifying deployment"
"$ROOT_DIR/scripts/check-deployment.sh"

echo "==> AgriSolar development deployment completed successfully."
