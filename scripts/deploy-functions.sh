#!/usr/bin/env bash
set -Eeuo pipefail

PROJECT_ID="${FIREBASE_PROJECT_ID:-agrisolar-website}"
EXPECTED_PROJECT_ID="agrisolar-website"
ROOT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")/.." && pwd)"
FUNCTIONS="sendEmailOnNewContactSubmission,sendReply,discoverProspects,draftOutreachEmail,apiV1"

if [[ "$PROJECT_ID" != "$EXPECTED_PROJECT_ID" ]]; then
  echo "Refusing to deploy unexpected Firebase project: $PROJECT_ID" >&2
  exit 2
fi

cd "$ROOT_DIR"

for cmd in npm firebase; do
  if ! command -v "$cmd" >/dev/null 2>&1; then
    echo "Required command not found: $cmd" >&2
    exit 2
  fi
done

if [[ -n "$(git status --porcelain)" ]]; then
  echo "Working tree is not clean. Function deployment will not stash or discard changes." >&2
  git status --short >&2
  exit 3
fi

echo "==> Installing exact Cloud Functions dependencies"
npm ci --prefix functions

echo "==> Checking Cloud Functions syntax"
node --check functions/index.js
node --check functions/mail-runtime.js
node --check functions/ai-outreach.js
node --check functions/business-api.js

echo "==> Deploying AgriSolar Cloud Functions"
firebase deploy \
  --only "functions:${FUNCTIONS//,/\,functions:}" \
  --project "$PROJECT_ID"

echo "==> Verifying function deployment"
"$ROOT_DIR/scripts/check-deployment.sh" --functions-only
