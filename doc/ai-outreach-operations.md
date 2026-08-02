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
* Administrator pause switch stored in `ai_settings/outreachEnabled`.
* Do-not-contact records block drafting on the server, even if browser controls are
  bypassed.
* Drafts require `verificationStatus: Verified` and stored public-source evidence.
* No automatic saving, approving, sending, or publishing.

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
