# AI Outreach Operations

## Current scope

The administrator Outreach screen has two AI-assisted actions:

1. Search public internet sources for potential business customers.
2. Prepare a review-only email draft for a verified, non-suppressed prospect.

Neither action sends email. Discovered results are not saved automatically. Generated
draft records are written by the server with `sendingAllowed: false`.

## Secret setup

The OpenAI API key belongs in Google Cloud Secret Manager through Firebase Functions.
It must not be placed in `.env`, `.env.local`, browser JavaScript, Realtime Database,
Hosting files, documentation, commits, issue comments, or chat messages.

Run this command from the repository root:

```bash
env -u DEBUG npx firebase functions:secrets:set OPENAI_API_KEY --project agrisolar-website
```

Paste the key only into the hidden terminal prompt. After the secret exists, deploy the
two AI Functions:

```bash
env -u DEBUG npx firebase deploy \
  --only functions:discoverProspects,functions:draftOutreachEmail \
  --project agrisolar-website
```

Database Rules and Hosting must also contain the matching administrator-only records
and interface before live testing.

## Controls

* Firebase ID token and approved administrator email required on both Functions.
* Allowed-origin checks for the development site, approved public domains, preview
  channels, and local testing.
* Managed API secret available only to the two AI Functions.
* OpenAI Responses API requests set `store: false`.
* Discovery uses hosted web search with actual returned source URLs.
* Structured JSON output with server-side length, URL, email, and source validation.
* 20 discovery requests and 50 draft requests per administrator per UTC day.
* Private per-request cost events store token counts, web-search-call counts, the model,
  and the versioned pricing snapshot used for the estimate.
* Administrator pause switch stored in `ai_settings/outreachEnabled`.
* Do-not-contact records block drafting on the server, even if browser controls are
  bypassed.
* Drafts require `verificationStatus: Verified` and stored public-source evidence.
* No automatic saving, approving, sending, or publishing.
* Firebase emulators refuse real OpenAI and SMTP calls by default. A developer must set
  `ALLOW_EMULATOR_OPENAI=true` or `ALLOW_EMULATOR_EMAIL=true` explicitly for a narrowly
  supervised external-call test; normal automated tests never set these flags.

## Cost tracking

The Responses API returns usage counts, not an authoritative dollar charge. AgriSolar
therefore calculates a clearly labeled estimate after each successful AI request and
stores it under the administrator-only `ai_cost_events` path.

The initial pricing snapshot is `openai-standard-short-2026-08-02`:

* GPT-5.6 Sol short-context input: $5.00 per million tokens
* Cached input: $0.50 per million tokens
* Cache writes: $6.25 per million tokens
* Output: $30.00 per million tokens
* Web search: $0.01 per call, plus search-content tokens at model rates

Costs are stored as integer micro-dollars. The OpenAI Usage dashboard remains the
authoritative billing source. The site does not call OpenAI's organization Cost API
because that API requires a separate organization Admin API key with broader authority
than the project API key used for generation.

When OpenAI pricing changes, add a new pricing version. Do not silently recalculate old
events using new prices.

## Review checklist

Before saving a discovered candidate:

* Open the cited source.
* Confirm the company, location, solar connection, and public contact details.
* Keep unknown details blank.
* Reject duplicates and respect do-not-contact records.

Before using a generated draft outside this development system:

* Verify every personalized statement against the cited source.
* Remove unsupported claims.
* Confirm the correct recipient and lawful outreach basis.
* Keep the opt-out sentence.
* Do not send through this feature; controlled sending is a later, separately approved
  phase.
