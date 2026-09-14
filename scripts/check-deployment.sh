#!/usr/bin/env bash
set -Eeuo pipefail

PROJECT_ID="${FIREBASE_PROJECT_ID:-agrisolar-website}"
EXPECTED_PROJECT_ID="agrisolar-website"
FUNCTIONS_ONLY=0

if [[ "${1:-}" == "--functions-only" ]]; then
  FUNCTIONS_ONLY=1
elif [[ $# -gt 0 ]]; then
  echo "Usage: $0 [--functions-only]" >&2
  exit 2
fi

if [[ "$PROJECT_ID" != "$EXPECTED_PROJECT_ID" ]]; then
  echo "Refusing to verify unexpected Firebase project: $PROJECT_ID" >&2
  exit 2
fi

if ! command -v firebase >/dev/null 2>&1; then
  echo "firebase CLI is required for verification." >&2
  exit 2
fi

EXPECTED_FUNCTIONS=(
  sendEmailOnNewContactSubmission
  sendReply
  discoverProspects
  draftOutreachEmail
  apiV1
)

echo "==> Checking deployed Cloud Functions"
FUNCTION_LIST="$(firebase functions:list --project "$PROJECT_ID" 2>&1)" || {
  printf '%s\n' "$FUNCTION_LIST" >&2
  exit 1
}

for function_name in "${EXPECTED_FUNCTIONS[@]}"; do
  if ! grep -q "$function_name" <<<"$FUNCTION_LIST"; then
    echo "Missing expected deployed function: $function_name" >&2
    exit 1
  fi
  echo "  OK: $function_name"
done

if [[ "$FUNCTIONS_ONLY" == "1" ]]; then
  echo "==> Function verification passed."
  exit 0
fi

if ! command -v curl >/dev/null 2>&1; then
  echo "curl is required for Hosting verification." >&2
  exit 2
fi

echo "==> Checking Firebase Hosting"
for url in \
  "https://agrisolar-website.web.app/" \
  "https://agrisolar-website.web.app/contact/" \
  "https://agrisolar-website.web.app/admin/"; do
  status="$(curl --silent --show-error --location --output /dev/null --write-out '%{http_code}' "$url")"
  if [[ "$status" != "200" ]]; then
    echo "Hosting check failed for $url (HTTP $status)" >&2
    exit 1
  fi
  echo "  OK: $url (HTTP $status)"
done

echo "==> AgriSolar deployment verification passed."
