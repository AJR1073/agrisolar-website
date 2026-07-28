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
* One approved administrative account enforced by Realtime Database and Storage rules

The initial scheduling feature will follow those existing patterns. A future migration to custom administrator and crew claims can be completed without changing record identifiers.

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

Status: implemented; Realtime Database Rules deployed with owner approval on July 27, 2026; Firebase Hosting preview awaiting owner review

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

### Phase B — Calendar, History, and Import

* Add a calendar view of tentative and confirmed dates.
* Add permanent site history with completed services across years.
* Add a reviewed CSV import template and preview screen.
* Represent exact whiteboard dates as completion dates.
* Represent month-only whiteboard entries without inventing a day.
* Add duplicate and ambiguous-record checks before import.
* Require Aaron to confirm ambiguous handwriting, dates, years, spelling, and site identity.

### Phase C — Annual Contracts and Renewals

* Add full service-season and contract editing.
* Add the Renewal Dashboard.
* Add expiration and renewal follow-up views.
* Add a reviewed “copy previous service plan” flow.
* Preserve the prior year and require explicit review of acreage, pricing, frequency, height, and services.
* Record the approving administrator UID and approval timestamp.

### Phase D — Operations Connections

* Add authenticated administrator and crew roles using custom claims.
* Add digital crew forms and completed service visits.
* Add authenticated before-and-after photographs.
* Link scheduled services to customers, contracts, estimates, and service visits.
* Connect ready-for-invoicing records to a future invoice feature.
* Do not generate invoices until separately specified and approved.

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
8. Publish only to a Firebase preview channel after approval to deploy Hosting.

## Phase A Definition of Done

* The admin dashboard can create an empty annual season without hard-coded business records.
* Each mowing cycle is stored as its own scheduled-service record.
* The grid, list, and focused operational views render from database records.
* Operational totals are calculated rather than hard-coded.
* The cycle editor keeps planned, scheduled, started, and completed values separate.
* Month-only completion data can be preserved without inventing a day.
* Private operational paths reject public and unapproved access in emulator tests.
* Existing contact submission and email-distribution behavior remains intact.
