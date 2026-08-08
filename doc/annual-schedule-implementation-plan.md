# Annual Mowing Schedule Implementation Plan

## Objective

Replace the private whiteboard workflow with an administrator-only annual mowing schedule while preserving permanent solar-site records, annual service-season history, and separate scheduled-service records for every mowing cycle.

This plan implements the requirements in [prd.md](prd.md). Customer, site, acreage, schedule, and renewal data must never be embedded in public Hosting assets or made readable without an approved administrator account.

## Existing Architecture

The current application uses:

* Static HTML, CSS, and JavaScript on Firebase Hosting
* Firebase Authentication for the administrator login
* Firebase Realtime Database
* Firebase Storage
* Firebase Functions for contact email
* One approved administrative account currently enforced by email-based Realtime Database and Storage rules

The scheduling foundation follows those existing patterns. The expanded PRD now requires authorization by an approved Firebase UID or an `admin: true` custom claim rather than email comparison alone. That authorization migration is a required security gate before the broader customer-management modules are enabled.

## Planning Review — July 27, 2026

The expanded [prd.md](prd.md) adds an internal customer and service-log foundation, audit history, communications, future crew and photograph workflows, and detailed future invoice requirements. The implementation order is:

1. Finish the annual schedule views using the already-approved normalized records.
2. Add safe, preview-first import and renewal workflows.
3. Migrate administrator authorization to an approved UID or custom claim and verify it in the Emulator Suite.
4. Build the internal customer/service-log foundation in small subphases.
5. Keep crew forms, photograph storage, SharePoint automation, invoices, payments, and the customer portal behind separate review and deployment gates.

The new PRD does not authorize invoice generation or sending, public uploads, mailbox synchronization, automated SharePoint access, payment processing, or a live backend deployment.

## Authentication and OAuth Decision

AgriSolar currently signs administrators in with Firebase Email/Password authentication. The inactive OAuth web client shown in Google Cloud was auto-created for browser OAuth flows and is not used by the current login or password-reset workflow.

* Do not edit or manually delete the inactive OAuth client.
* It may be retired automatically if Google Sign-In remains unused.
* Do not create artificial OAuth traffic solely to retain it.
* Re-evaluate OAuth configuration only if Google Sign-In or a Microsoft/SharePoint integration is intentionally designed and approved.
* The required UID/custom-claim authorization migration is separate from the inactive OAuth client.

## Data Model

### `companies/{companyId}`

Permanent company or customer identity:

* `name`
* `createdAt`
* `updatedAt`
* `administratorUid`

### `solar_sites/{siteId}`

Permanent solar-site identity:

* `companyId`
* `name`
* `location`
* `acreage`
* `targetVegetationHeight`
* `active`
* `createdAt`
* `updatedAt`
* `administratorUid`

### `service_seasons/{serviceSeasonId}`

One annual contract or service plan for one permanent site:

* `serviceYear`
* `companyId`
* `solarSiteId`
* Contract dates
* Planned mowing cycles and other services
* Contract acreage and vegetation-height requirement
* Contract status
* Renewal status, follow-up date, and notes
* Renewal approval identity and time when applicable
* `createdAt`
* `updatedAt`
* `administratorUid`

### `scheduled_services/{scheduledServiceId}`

One record per mowing cycle or follow-up visit:

* `serviceSeasonId`
* `serviceYear`
* `companyId`
* `solarSiteId`
* `mowingCycleNumber`
* `serviceType`
* Planning, tentative, confirmed, start, and completion values
* Month-only completion value and date precision
* Estimated and actual acreage
* Status
* Crew and equipment
* Delay, rescheduling, notes, hazards, and follow-up values
* Ready-for-invoicing indicator
* Future service-visit identifier
* `createdAt`
* `updatedAt`
* `administratorUid`

Records will use Firebase-generated stable keys. Display names are not identifiers.

## Delivery Phases

### Phase A — Scheduling Foundation

Status: implemented; Realtime Database Rules deployed with owner approval on July 27, 2026; Firebase Hosting preview reviewed and approved by the owner

* Convert the product requirements to Markdown.
* Add administrator-only database paths and validation rules.
* Add rule tests proving that public and unapproved users cannot read or write operational records.
* Add an Annual Schedule tab to the existing admin dashboard.
* Add calculated operational totals.
* Add a familiar site-by-cycle annual grid.
* Add a searchable and filterable list view.
* Add focused views for scheduling needed, ready for invoicing, and delayed or overdue work.
* Add safe administrator entry for a company, permanent site, annual season, and initial mowing cycles.
* Add an editor for each scheduled-service record.
* Keep the production database empty until an administrator enters reviewed information.

Implemented in this slice:

* Normalized `companies`, `solar_sites`, `service_seasons`, and `scheduled_services` paths
* Administrator-only validation rules and indexes
* Seven calculated operational totals
* Annual grid with Mow 1 through Mow 4 emphasized and support for later cycles
* Searchable, sortable, and status-filtered list
* Scheduling-needed, ready-for-invoicing, and overdue/delayed views
* Administrator entry for company, permanent site, annual season, and initial cycles
* Scheduled-service editor for planning, dates, acreage, crew, equipment, delays, notes, hazards, follow-up, and invoicing readiness
* Separate follow-up scheduled-service creation
* Exact-date, month-only, and unknown completion precision
* Emulator rule tests and a browser-level admin schedule test

### Phase B1 — Calendar and Site History

Status: implemented, verified, and deployed to the Firebase development Hosting site on July 27, 2026

* Add a calendar view of tentative and confirmed dates.
* Add permanent site history with completed services across years.
* Never convert a planned month or month-only completion into an invented calendar date.
* Keep calendar and history records editable through the existing scheduled-service editor.
* Add browser tests covering scheduled dates and all-years history.

### Phase B2 — Reviewed Schedule Import

Status: implemented and verified; no business data imported

* Add a reviewed CSV import template and preview screen.
* Represent exact whiteboard dates as completion dates.
* Represent month-only whiteboard entries without inventing a day.
* Add duplicate and ambiguous-record checks before import.
* Require Aaron to confirm ambiguous handwriting, dates, years, spelling, and site identity.
* Require an explicit confirmation before writing any previewed import.
* Do not put the photographed schedule or private site data in public fixtures or Hosting assets.

Implemented safeguards:

* Downloadable blank CSV template with no customer or site records
* Local CSV parsing with a 1 MB and 500-row limit
* Required-column, value-length, acreage, year, mowing-cycle, status, and real-date validation
* Separate `completed_date` and `completion_month` fields so an unknown day is never invented
* Service-year consistency checks for every date and month
* Duplicate checks within the CSV and against existing scheduled-service records
* Ambiguous company, site, location, acreage, and annual-season checks
* Read-only validation preview before the confirmation controls are enabled
* Required administrator review checkbox and a second explicit confirmation
* Revalidation against current database records immediately before the write
* One atomic multi-path update that creates stable records and never overwrites an existing record

The administrator template columns are:

`company`, `site_name`, `location`, `acres`, `height_requirement`, `service_year`,
`mow_cycle`, `service_type`, `planned_month`, `tentative_scheduled_date`,
`confirmed_scheduled_date`, `completed_date`, `completion_month`, and `status`.

Dates use `YYYY-MM-DD`; months use `YYYY-MM`. The `status` and `service_type`
columns may be left blank to use a safe status derived from the supplied dates and
the default Commercial mowing service type. No real schedule should be imported
until the administrator has reviewed every preview row.

### Phase C — Annual Contracts and Renewals

Status: not started

* Add full service-season and contract editing.
* Add the Renewal Dashboard.
* Add expiration and renewal follow-up views.
* Add a reviewed “copy previous service plan” flow.
* Preserve the prior year and require explicit review of acreage, pricing, frequency, height, and services.
* Record the approving administrator UID and approval timestamp.

### Phase D — Authorization and Audit Gate

Status: immutable administrator authorization implemented in DEV; legacy workflow audit
coverage remains incremental

* Completed: resolved the approved administrator UID and added optional reviewed
  `admin: true` API claim support.
* Completed: Realtime Database, Storage, and backend authorization no longer rely on
  email comparison.
* Keep browser authentication checks as user-interface behavior, not the security boundary.
* Completed for the controlled API and AI Review Center: append-only `audit_events`
  records use a server-validated actor UID and timestamp. Legacy schedule/customer
  mutations will move behind audited services incrementally.
* Completed for current roles: emulator tests cover anonymous, ordinary authenticated,
  same-email/wrong-UID, and approved-administrator access. Future crew access remains a
  separate role-design phase.
* Prepare an exact backend deployment plan and do not deploy it without Aaron approving the branch and commit.

### Phase E — Admin Customer and Service-Log Foundation

Status: planned from the expanded PRD; deliver as separate reviewable slices

#### Phase E1 — Records and navigation

* Add Dashboard, Leads, Companies, Contacts, Solar Sites, Communications, Service Visits, Follow-ups, and Settings navigation.
* Expand versioned company and site records without destructively rewriting existing quote submissions or schedule records.
* Add contact records and company-to-contact relationships.
* Add search and archive behavior while preserving business history.

#### Phase E2 — Leads, notes, and follow-ups

* Link an existing quote submission to a separate lead record.
* Add the required lead stages and stage-change audit events.
* Add plain-text internal notes, dated follow-ups, completion, overdue views, and archival.

#### Phase E3 — Communications

* Add communication timelines and manually recorded incoming messages.
* Add email drafts and an explicit recipient/subject/sender confirmation.
* Use mocked email transport in automated and emulator testing.
* Do not read Gmail, Outlook, IMAP, or Namecheap mailboxes.
* Do not send real customer email during development.

#### Phase E4 — Provisional service visits

* Add the provisional service-visit record described in the PRD.
* Link scheduled services to completed service visits using stable identifiers.
* Review AgriSolar’s existing manual field forms before adding legal, safety, pesticide, environmental, certification, or signature fields.

### Phase F — Crew and Documentation Connections

* Add authenticated administrator and crew roles using custom claims.
* Add digital crew forms and completed service visits.
* Add offline/draft behavior only after the manual forms are reviewed.
* Add the administrator-only SharePoint photo-delivery checklist.
* Keep SharePoint uploads manual in the first version.
* Add authenticated before-and-after photograph storage only in a separately approved stage.

### Phase G — Future Billing Design

Status: documentation only; implementation and sending are not authorized in this branch

* Preserve stable links from companies, sites, service seasons, and completed service visits to future invoices.
* Keep billing names, customer site codes, PO numbers, vendor profiles, rates, and terms customer-specific.
* Use integer cents for future currency calculations.
* Require completion, documentation readiness, administrator review, approval, and a separate send action.
* Never create an invoice from a merely scheduled service.
* Never automatically email an invoice when work is completed.

### Phase H — Future Integrations and Customer Portal

Status: future roadmap only

* Evaluate customer-specific SharePoint tenant authorization without storing Microsoft passwords.
* Add payment recording only after a separately reviewed design; do not connect bank accounts or charge customers automatically.
* Build a customer portal only after internal/customer data separation is formally designed and tested.

## Phase A User Flow

1. An approved administrator signs in.
2. The administrator opens Annual Schedule and selects a service year.
3. If the year is empty, the administrator selects Add site and season.
4. The administrator enters reviewed company, site, acreage, height, and cycle information.
5. The application atomically creates or reuses the company and creates the permanent site, annual season, and separate scheduled-service records.
6. The annual grid shows one row per site and a cell for each scheduled mowing record.
7. Opening a cell allows the administrator to update planning, operations, completion, delay, follow-up, and invoicing-readiness information.
8. Dashboard totals and focused views are recalculated from saved records.

## Security Requirements

* Default Realtime Database access remains denied.
* Only the approved administrator may read or write companies, solar sites, service seasons, and scheduled services.
* Rules validate required identifiers, statuses, types, lengths, numeric ranges, timestamps, and unexpected fields.
* Client-side hiding is not treated as authorization.
* No real 2026 names, acreage, dates, or schedules are seeded into Hosting files.
* No database rules or Functions are deployed without separate explicit approval.

## Testing and Review

For each phase:

1. Run JavaScript syntax checks.
2. Run HTML validation and structural tests.
3. Run Realtime Database rule tests in the emulator.
4. Test the administrator workflow with emulator-only sample records.
5. Confirm unauthenticated and unapproved users cannot access operational data.
6. Build Firebase Hosting and verify that internal documentation and source-only files are excluded.
7. Review desktop and mobile behavior.
8. Publish to the owner-designated Firebase development site only after approval to deploy Hosting.

For Phases D and later, also verify append-only audit behavior and test all backend authorization in the Emulator Suite before requesting deployment approval.

## Phase A Definition of Done

* The admin dashboard can create an empty annual season without hard-coded business records.
* Each mowing cycle is stored as its own scheduled-service record.
* The grid, list, and focused operational views render from database records.
* Operational totals are calculated rather than hard-coded.
* The cycle editor keeps planned, scheduled, started, and completed values separate.
* Month-only completion data can be preserved without inventing a day.
* Private operational paths reject public and unapproved access in emulator tests.
* Existing contact submission and email-distribution behavior remains intact.
