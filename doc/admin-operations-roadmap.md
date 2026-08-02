# AgriSolar Admin Operations Roadmap

## Purpose

This roadmap translates the expanded [product requirements](prd.md) into reviewable implementation stages. The current system remains a static Firebase-hosted website with an authenticated administrator dashboard, quote submissions, email reply functionality, and the Annual Mowing Schedule foundation.

Private customer, company, contact, site, schedule, service, billing, photograph, SharePoint, and renewal information must remain administrator-only.

## Current Baseline

Completed or available for review:

* Firebase Email/Password administrator sign-in and password reset
* Existing quote-submission review and reply workflow
* Normalized company, permanent solar-site, annual service-season, and scheduled-service records
* Annual mowing grid, list, focused operational queues, and calculated totals
* Separate records for each mowing cycle
* Exact-date and month-only completion precision
* Administrator-only Realtime Database rules for the current approved account

Known security migration:

* Current rules identify the approved administrator by email.
* Before the broader operations system is enabled, authorization must migrate to an approved UID or an `admin: true` custom claim.
* The inactive Google OAuth web client is unrelated to this migration and is not needed for the current Email/Password login.

## Stage 1 — Finish Annual Schedule Operations

### 1A. Calendar and history

* Calendar of tentative and confirmed mowing dates
* All-years completed service history grouped by permanent solar site
* No invented dates for planned months or month-only completions

### 1B. Reviewed import

* Administrator-only CSV template
* Parse and validate without saving
* Flag duplicate sites, duplicate cycles, invalid statuses, ambiguous dates, and unknown year/date precision
* Require Aaron’s review and explicit import confirmation
* Keep real whiteboard data out of public source and test fixtures

### 1C. Contracts and renewals

* Full annual service-season editor
* Renewal dashboard and follow-up queue
* Reviewed copy-to-next-year workflow
* Preserve every prior year and require renewed terms to be confirmed

## Stage 2 — Authorization and Audit Foundation

This stage is required before enabling new customer-management nodes in production.

* Approved UID or Firebase custom administrator claim
* Backend verification of Firebase ID tokens and authorization
* Append-only audit events
* Emulator tests for public, ordinary authenticated, approved administrator, and future crew identities
* Exact deployment manifest for Functions, Realtime Database Rules, and Storage Rules
* No backend deployment until Aaron approves the exact branch and commit

## Stage 3 — Customer and Lead Management MVP

Deliver in small slices:

1. Admin navigation, companies, contacts, and expanded solar-site records
2. Leads linked to original quote submissions
3. Plain-text internal notes, follow-ups, overdue work, and archive behavior
4. Search and filters across administrator-only records
5. Audit events for important record and stage changes

Original quote submissions remain intact. New records link to the submission ID instead of rewriting or deleting the source.

## Stage 4 — Communications

* Timeline for outgoing email, manually recorded incoming email, calls, meetings, notes, follow-ups, and status changes
* Save drafts without sending
* Explicit send confirmation showing sender, recipients, and subject
* Existing authenticated AgriSolar SMTP sender only
* Mocked transport during tests
* No automatic customer email
* No Gmail, Outlook, IMAP, or Namecheap mailbox synchronization in the MVP

## Stage 4B — Prospecting and Promotion Assistant

This stage depends on the Stage 2 authorization/audit foundation, Stage 3 lead records,
and Stage 4 draft/communication history. Deliver it in separately reviewable slices:

Development preview status: the manual prospect-candidate, public-source evidence,
duplicate review, review-status, and do-not-contact suppression foundation is
implemented for testing on the owner-designated Firebase development project. It uses
the current approved-email authorization boundary. Promotion to a production system and
all AI/email capabilities remain blocked on the Stage 2 authorization/audit migration
and the later gates below.

1. Manual prospect candidates, public source evidence, duplicate detection, and
   do-not-contact suppression
2. Server-side OpenAI Responses API integration using managed secrets, Structured
   Outputs, `store: false`, usage limits, and synthetic tests
3. AI-assisted qualification that preserves the difference between verified facts and
   model proposals
4. Editable outreach drafts with source references and explicit administrator review
5. Administrator-reviewed promotional drafts for website, educational, case-study, and
   social content
6. Controlled sending only after compliance, suppression, audit, rate-limit, sender,
   and reputation controls are approved

AI generation must never directly send email, publish content, approve a lead, merge a
record, or bypass a suppression entry. A ChatGPT subscription is separate from the
OpenAI API project and billing configuration required by this application.

## Stage 5 — Digital Field Forms

Before implementation:

* Review AgriSolar’s existing paper/manual forms.
* Map every real field, signature, review, and revision requirement.
* Do not invent legal, pesticide, environmental, safety, certification, or contractual questions.

Then add:

* Mobile-friendly authenticated crew forms
* Draft/offline behavior for weak cellular coverage
* Completed service visits linked to scheduled services
* Supervisor review and revision history

## Stage 6 — Photograph and SharePoint Workflow

First version:

* Administrator-only photo-delivery checklist
* Pre-mow and post-mow required/taken/uploaded states
* Manually entered customer SharePoint destination and folder URL
* Documentation-complete gate before ready-for-invoicing, with a documented administrator override reason
* Configurable photograph filename convention

Later, only after separate approval:

* Authenticated crew photograph uploads with private Storage rules
* Thumbnails and retention rules
* Customer-specific Microsoft/SharePoint authorization
* Automated uploads, duplicate prevention, file-count confirmation, and audit history

Anonymous public uploads must not be restored.

## Stage 7 — Estimates and Invoices

This stage is documented but not authorized for implementation or sending in the current branch.

Future design must include:

* Customer-specific billing profiles, vendor numbers, terms, PO requirements, descriptions, and templates
* Official billing names separate from internal site names
* Rates stored with contracts and snapshotted onto invoice lines
* Integer cents for money
* Completed service-visit links for every invoice line
* Draft, review, approval, PDF preview, and separate send steps
* Immutable sent PDF and email history
* No automatic invoice creation from merely scheduled work
* No automatic invoice email after completion

## Stage 8 — Payments and Customer Portal

Future only:

* Manual payment records, partial payments, references, and balance history
* No automatic bank connection or charging without a separate review
* Strictly separated customer access to approved records and documents
* Internal notes and operational details never exposed to customers

## Review and Deployment Gates

Every stage must:

1. Use synthetic data in tests.
2. Pass syntax, HTML, browser, and Firebase Rules emulator tests as applicable.
3. Prove anonymous and unauthorized access is denied.
4. Preserve existing submissions and business history.
5. Keep private documentation and fixtures out of Firebase Hosting output.
6. Receive preview review before live Hosting deployment.
7. Receive separate approval for any Functions, Database Rules, Storage Rules, email, OAuth, SharePoint, or other backend/integration change.
