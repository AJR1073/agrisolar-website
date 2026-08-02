# AgriSolar LLC Website Product Requirements

You are maintaining the AgriSolar LLC website.

Repository:
https://github.com/AJR1073/agrisolar-website

Firebase project:
agrisolar-website

Firebase development URLs:
https://agrisolar-website.web.app/
https://agrisolar-website.firebaseapp.com/

Current public Namecheap website:
https://agrisolarllc.com/

## Primary Objective

Improve the AgriSolar website’s content, page structure, contact workflow, security, SEO, accessibility, and Firebase deployment process while preserving the restored Firebase website’s current visual appearance.

The previous redesign was rejected because it changed the look and feel too much. Do not redesign the site.

## Non-Negotiable Requirements

1. Preserve the existing Firebase site’s:

   * Color palette
   * Logo treatment
   * Fonts
   * Hero appearance
   * Header and navigation styling
   * Buttons
   * Card appearance
   * Image style
   * Spacing rhythm
   * Desktop and mobile character

2. Use https://agrisolarllc.com/ as a content and business reference, but do not modify, deploy to, log into, or otherwise touch:

   * Namecheap
   * cPanel
   * Site Maker
   * Namecheap email
   * DNS records
   * MX records
   * Domain registration
   * FTP accounts

3. Never invent:

   * Customers
   * Testimonials
   * Project sizes
   * Equipment ownership
   * Safety certifications
   * Insurance coverage
   * Licenses
   * Performance improvements
   * Years of experience
   * Service-area claims

4. If a business fact is uncertain, add it to a “Business facts requiring confirmation” list instead of publishing it.

5. Do not merge into main or deploy to the Firebase live channel until the owner has reviewed a Firebase preview URL and explicitly approved it.

## Verified Business Information

* Business name: AgriSolar LLC
* Location: Belleville, Illinois
* Phone: (618) 539-2098
* Public email: [info@agrisolarllc.com](mailto:info@agrisolarllc.com)
* Authenticated SMTP sender: [aaron@agrisolarllc.com](mailto:aaron@agrisolarllc.com)
* Administrative Firebase account: [aaronreifschneider@outlook.com](mailto:aaronreifschneider@outlook.com)
* Family-operated Illinois business
* Team has experience managing a 1,000-acre agricultural operation
* Team holds commercial pesticide licensing
* Primary work includes solar-farm mowing, vegetation control, native planting, erosion control, and ongoing site maintenance
* Namecheap currently handles agrisolarllc.com email and must remain unchanged

## Phase 1 — Baseline and Visual Lock

1. Pull the latest main branch.
2. Confirm that main contains the restored website and the revert commit.
3. Create a new branch named:
   improve/preserve-agrisolar-style
4. Capture desktop and mobile screenshots of:

   * Firebase homepage
   * Public Namecheap homepage
   * Existing About page
   * Existing contact form
5. Document the existing design tokens:

   * Colors
   * Fonts
   * Button styles
   * Widths
   * Breakpoints
   * Header/footer construction
   * Common section spacing
6. Do not change those design tokens without owner approval.

## Phase 2 — Content Corrections

Correct the existing Firebase About page:

* Replace every “AgriSolar Solutions” reference with “AgriSolar LLC.”
* Replace [info@agrisolarsolutions.com](mailto:info@agrisolarsolutions.com) with [info@agrisolarllc.com](mailto:info@agrisolarllc.com).
* Replace every placeholder phone number with (618) 539-2098.
* Fix navigation and CTA links so they work from standalone pages.
* Update the copyright automatically.
* Remove unsupported claims.
* Retain the current visual styling.

Review the public Namecheap pages for useful content:

* /
* /Solar-Vegetation-Management/
* /About-us/
* /Products/
* /Contact-Us/
* /Testimonials/
* /Resources/
* /Solutions/
* /Before-and-After/

Do not copy contradictory or weak content. In particular:

* Do not repeat the statement that mechanical mowing is unsuitable for large solar sites.
* Do not broadly characterize all herbicide application as environmentally harmful.
* Remove the unsourced 33% annual-growth statistic.
* Do not publish anonymous testimonials as verified customer reviews.
* Do not claim electrical solar-panel monitoring, electrical repair, or panel maintenance services unless confirmed.
* Move honey content to a secondary “Honey” or “Our Farm” page rather than keeping “Products” in the primary commercial-services navigation.

## Phase 3 — Page Structure

Create the following static pages using the existing header, footer, typography, colors, components, and image treatment:

* /services/
* /services/commercial-mowing/
* /services/vegetation-herbicide-management/
* /services/native-planting/
* /services/erosion-control/
* /services/site-maintenance-reporting/
* /about/
* /service-area/
* /projects/
* /faq/
* /contact/
* /privacy/
* /404.html

Required topics:

Commercial Mowing:

* Utility-scale solar mowing
* Under-panel and perimeter access
* Fence lines and equipment areas
* Scheduled and corrective mowing
* Avoiding damage around solar infrastructure
* Add First Time Mowint for Overgrown Sites

Vegetation and Herbicide Management:

* Licensed application
* Targeted treatment
* Invasive and noxious weeds
* Fence-line and equipment-pad control
* Integrated mechanical and chemical planning
* Compliance with labels and site requirements
* Add Herbisite Certified Operators and Certified Applicator

Native Planting:

* Native grasses and flowering species
* Pollinator habitat
* Establishment mowing
* Soil stabilization

Erosion Control:

* Bare-soil identification
* Washout and drainage observations
* Reseeding if requested
* Temporary and permanent stabilization
* Reporting problems outside AgriSolar’s contracted scope

Maintenance Reporting:

* Site observations
* Before/after photographs
* Access-condition reporting
* Vegetation problem areas
* Communication with site managers
* Do not claim electrical inspection or engineering services

Every page must have a clear Request a Quote CTA.

## Phase 4 — Contact and Email

Expand the quote form to collect:

* Name
* Company
* Email
* Phone
* Solar-site location
* Approximate acreage
* Service requested
* Desired start date or schedule
* Project description

Add:

* Accessible inline validation
* Accessible success and failure messages
* Honeypot field
* Length limits
* Duplicate-submission prevention
* Privacy Policy link
* Loading state
* Recovery if Firebase fails

Continue showing [info@agrisolarllc.com](mailto:info@agrisolarllc.com) publicly.

In the administrator reply interface, display the actual authenticated sender:
[aaron@agrisolarllc.com](mailto:aaron@agrisolarllc.com)or ryan@agrisolarllc.com](mailto:ryan@agrisolarllc.com)

Do not change Namecheap email, SMTP hosting, DNS, or MX records.

## Firebase Backend Fixes

1. Correct the Realtime Database v2 trigger:
   const submission = event.data.val();

2. Change database rules so:

   * The public can create a new contact submission.
   * The public cannot read submissions.
   * The public cannot overwrite an existing submission.
   * The public cannot delete a submission.
   * Only the approved administrator can read or update submissions.
   * Field types and maximum lengths are validated.
   * Rules are tested with the Firebase Emulator Suite before deployment.

3. Remove the unauthenticated testEmailSending HTTP endpoint.

4. Reduce SMTP/debug logging and never log:

   * Passwords
   * Tokens
   * Full submissions
   * Credential configuration

5. Keep NAMECHEAP_PASSWORD in Firebase Secrets. Never commit it.

6. Send notification email to the configured AgriSolar recipient and set replyTo to the visitor’s validated email.

7. Upgrade the Functions runtime from Node 18 to Node 22 only after updating compatible dependencies and passing emulator tests.

8. Do not deploy database rules or Functions automatically. Prepare them in the pull request and request separate approval for each backend deployment.

## Firebase Hosting Security

Update firebase.json so Hosting does not publish:

* functions/**
* database.rules.json
* package.json
* package-lock.json
* README.md
* .env files
* node_modules/**
* y/**
* internal documentation
* test files
* GitHub configuration

Add a custom 404 page and appropriate security headers.

Because agrisolarllc.com remains the primary Namecheap site, add an X-Robots-Tag noindex/nofollow header to the Firebase development site to prevent duplicate indexing. Document that this must be removed before agrisolarllc.com is moved to Firebase.

## SEO and Accessibility

* One H1 per page
* Unique page title and meta description
* Correct canonical URL plan
* ProfessionalService/LocalBusiness structured data using verified facts only
* Updated sitemap.xml
* Updated robots.txt
* Descriptive alt text
* Visible keyboard focus
* Keyboard-operable mobile navigation
* Proper labels and error associations
* Adequate contrast
* Reduced-motion support
* Clickable tel: and mailto: links
* Optimized local WebP/AVIF images
* No third-party image hotlinking

## Firebase Preview Workflow

If .github/workflows/firebase-hosting-pull-request.yml does not exist, create it.

It must:

* Run on pull_request.
* Check out the pull-request branch.
* Use FirebaseExtended/action-hosting-deploy@v0.
* Use secret FIREBASE_SERVICE_ACCOUNT_AGRISOLAR_WEBSITE.
* Use projectId agrisolar-website.
* Use the GitHub token for the preview comment.
* Omit channelId: live so it creates a temporary preview channel.
* Never deploy a pull request directly to the Firebase live channel.

The existing main-branch workflow may deploy Firebase Hosting after an approved PR is merged.

## Safe Deployment Procedure

1. Work only on improve/preserve-agrisolar-style.
2. Run HTML, CSS, JavaScript, accessibility, link, and Firebase configuration validation.
3. Run the Firebase emulators for Hosting, Realtime Database, and Functions.
4. Compare before-and-after screenshots at desktop and mobile sizes.
5. Confirm that the homepage still looks like the restored baseline.
6. Commit the changes.
7. Push the branch.
8. Open a draft pull request.
9. Wait for the Firebase preview-channel URL.
10. Report:

    * Preview URL
    * Pages added
    * Content corrected
    * Visual differences
    * Tests completed
    * Unverified business facts
    * Backend changes that still require approval
11. Stop and wait for owner approval.
12. Do not merge the pull request yourself.
13. Do not deploy to Namecheap.
14. Do not deploy Functions or database rules without separate explicit approval.

## Final Acceptance Criteria

* Existing look and feel remains recognizable and substantially unchanged.
* No invented business claims.
* Every navigation link works.
* Every page works on mobile.
* Contact submissions are protected from overwrite and deletion.
* Email sender identities are accurate.
* Firebase secrets are not exposed.
* No internal/backend source files are publicly hosted.
* Firebase preview is reviewed before main is changed.
* Namecheap website and email remain completely untouched.

## Authoritative Addendum: Administrator-Only Annual Mowing Schedule

This section defines the required replacement for AgriSolar's current whiteboard-based annual mowing schedule. If any earlier instruction conflicts with this addendum, this addendum controls.

### Current Scheduling Workflow

AgriSolar currently tracks its annual mowing schedule on a whiteboard. Each column represents a solar site and may include:

* Site or project name
* Location
* Acreage
* Vegetation-height requirement, when applicable
* Mow 1
* Mow 2
* Mow 3
* Mow 4
* A month or date
* Actual completion information

Replace this manual schedule with an administrator-only Annual Mowing Schedule. The annual grid must visually resemble the existing whiteboard because this is the workflow AgriSolar already understands.

### Normalized Data Design

Do not store Mow 1 through Mow 4 as four fixed database columns. Create a separate scheduled-service record for every mowing cycle so that additional visits can be added later.

Use stable identifiers and normalized relationships. Solar sites are permanent records. Annual service seasons or contracts and their scheduled services must reference the permanent company, customer, contact, and solar-site identifiers rather than duplicating them.

Each scheduled-service record must support:

* Stable scheduled-service identifier
* Service year
* Company
* Solar site
* Mowing-cycle number
* Service type
* Planned month
* Tentative scheduled date
* Confirmed scheduled date
* Actual start date
* Actual completion date
* Site acreage
* Estimated acres to service
* Actual acres completed
* Target vegetation height
* Status
* Assigned crew
* Assigned equipment
* Weather delay
* Rescheduling reason
* Completion notes
* Problems or hazards
* Follow-up required
* Ready-for-invoicing indicator
* Associated service-visit record
* Created timestamp
* Updated timestamp
* Administrator UID

Use these scheduled-service statuses exactly:

* Planned
* Scheduling needed
* Scheduled
* In progress
* Partially completed
* Completed
* Weather delayed
* Customer delayed
* Rescheduled
* Cancelled

### Admin Schedule Views

Create all of the following administrator-only views:

1. An annual schedule grid showing sites vertically and Mow 1 through Mow 4 horizontally. Additional cycles must remain supported even if the familiar default grid initially emphasizes Mow 1 through Mow 4.
2. A calendar view showing scheduled mowing dates.
3. A list view with search, sorting, and filtering.
4. A site-history view showing every mowing completed at that site.
5. A Scheduling needed view.
6. A Ready for invoicing view.
7. An overdue and delayed service view.

Allow an administrator to open any mowing-cycle cell and:

* Set or change the planned date
* Mark work started
* Mark work partially completed
* Mark work completed
* Enter acres completed
* Enter the assigned crew and equipment
* Record a weather delay
* Add operational notes
* Create a follow-up visit
* Mark a completed visit ready for invoicing

Do not implement invoice generation in this branch. The ready-for-invoicing indicator will later connect completed mowing records to invoices.

### Administrator Dashboard Totals

Show these administrator-only operational totals:

* Total contracted or scheduled acres
* Acres scheduled this month
* Acres completed this season
* Acres remaining
* Sites awaiting scheduling
* Visits delayed
* Visits ready for invoicing

Calculate every total from actual solar-site, service-season or contract, scheduled-service, and service-visit records. Never hard-code dashboard totals.

### Safe Data Entry and Import

Do not hard-code the photographed whiteboard schedule into public source code. Create a safe administrator-only data-entry process or a documented import template containing:

* Site name
* Location
* Acres
* Height requirement
* Mow-cycle number
* Planned date
* Completed date

Validate imported data before saving it. Do not import any entry whose handwriting, spelling, year, or date meaning has not been confirmed by Aaron.

The confirmed names and acreages listed below are reference information for administrator review. They must not be exposed in a public JavaScript bundle, public HTML, public API response, or other unauthenticated source. Do not silently seed or import them merely because they appear in this prompt.

### Future Connections

Design stable identifiers so every scheduled mowing can later connect to:

* Digital crew form
* Completed service record
* Before photographs
* After photographs
* Customer
* Contract
* Estimate
* Invoice
* Invoice email
* Payment status

Photographs will eventually be uploaded only by authenticated AgriSolar administrators or crew members. Do not restore anonymous public uploads.

### 2026 Schedule and Whiteboard Context

The photographed whiteboard represents AgriSolar's remaining mowing schedule for 2026. The current service season is 2026.

The following site names and acreages have been confirmed:

* Reif 1A — 8 acres
* Reif 1B — 18 acres
* Reif 2A — 16 acres
* Reif 2B — 18 acres
* Reif 3 — 18 acres
* Lindauer — 29 acres
* Corfee — Gillespie — 40 acres
* Horseshoe — Hillsboro — 36 acres
* McCray — Greenville — 26.8 acres
* Brighton — 60 acres
* St. Joseph 1 and 2 — 30.4 acres combined

The apparent total is 300.2 acres. Treat this total as provisional until the administrator enters and reviews the source records. Do not split the combined St. Joseph acreage between St. Joseph 1 and St. Joseph 2 without confirmation.

Some sites have an indicated 18-inch vegetation-height requirement. Store the height requirement separately for each site and each annual contract or service season. Do not assume that the 18-inch requirement applies to every site.

### Authoritative Whiteboard Date Correction

Treat every written date or month on the 2026 whiteboard as an actual completion record. Do not import any of those written values as planned, tentative, confirmed, or scheduled dates.

* Store an exact written completion date, such as 6/24 or 7/1, in completedOn with the confirmed service year.
* When only a month such as May or June is written, preserve the completion month without inventing a day.
* The data model must support month-only completion information, for example with a separate completionMonth and completionDatePrecision field, while leaving completedOn empty until an exact day is known.
* Keep planned, tentative scheduled, confirmed scheduled, started, and completed values in separate fields.
* A blank whiteboard cell means only that no completion was recorded on that board. It does not conclusively mean the work was not performed.
* Never infer a missing date, month, year, cycle, or completion state.

### Multi-Year Service-Season and Renewal Design

Solar sites must be permanent records. Do not create a duplicate solar-site record each year.

Create a separate service-season or contract record for each year. Each annual service record must support:

* Stable service-season or contract identifier
* Service year
* Customer or company
* Solar site
* Contract start date
* Contract end date
* Planned number of mowing cycles
* Planned herbicide or other services
* Contract acreage
* Vegetation-height requirement
* Contract status
* Renewal status
* Renewal follow-up date
* Renewal notes
* Linked mowing schedule
* Linked service visits
* Linked future invoices

Use these contract statuses exactly:

* Prospect
* Proposed
* Active
* Completed
* Expired
* Cancelled

Use these renewal statuses exactly:

* Not reviewed
* Renewal follow-up needed
* Customer contacted
* Renewal proposed
* Renewed
* Not renewed
* Decision pending

When a site is renewed:

1. Preserve the complete 2026 history.
2. Create a new service-season record for 2027.
3. Keep the same company, contact, and solar-site identifiers.
4. Allow an administrator to copy the previous year's service plan.
5. Require the administrator to review acreage, pricing, mowing frequency, height requirements, and services before saving.
6. Do not automatically assume that any term remains unchanged.
7. Do not automatically mark a site renewed.
8. Record the approving administrator's UID and approval timestamp.

### Renewal Dashboard

Create an administrator-only Renewal Dashboard showing:

* Contracts approaching expiration
* Sites needing renewal follow-up
* Renewal proposals sent
* Customers awaiting a decision
* Renewed acreage
* Acreage not yet renewed
* Sites not renewed

Calculate renewal totals from actual annual service-season or contract records. Do not hard-code them.

### Privacy and Access Control

Customer names, company names, contact information, solar-site details, acreages, schedules, completion history, operational notes, hazards, crew assignments, equipment assignments, contracts, and renewal information are private business data.

* Do not publish this information on the public website.
* Require authenticated administrator authorization for all scheduling, contract, renewal, and import views and operations.
* Enforce authorization in Firebase Security Rules and server-side or callable backend operations; hiding an interface element is not access control.
* Do not place private schedule or renewal data in Hosting assets or client-side seed files.
* Do not restore anonymous uploads.

### Scheduling and Renewal Acceptance Criteria

* Mowing cycles are separate scheduled-service records, not fixed Mow 1 through Mow 4 database columns.
* The annual grid remains familiar to whiteboard users while allowing more than four visits.
* Planned, tentative, confirmed, started, and completed dates remain distinct.
* Whiteboard dates and months are imported only as completion history.
* Month-only completions are preserved without an invented day.
* Blank whiteboard cells are not interpreted as proof that work was not performed.
* Permanent solar sites are not duplicated for each year.
* Annual service seasons preserve history and support reviewed renewals.
* Operational and renewal dashboard values are calculated from stored records.
* Ready for invoicing is supported, but invoice generation is not implemented in this branch.
* All scheduling, customer, contract, acreage, and renewal information remains administrator-only.

PHASE 5 — ADMIN CUSTOMER AND SERVICE-LOG FOUNDATION

Build the first secure version of an internal AgriSolar administration system. This is an MVP foundation for managing prospective customers, companies, communications, notes, solar sites, and service visits.

Do not attempt to build the complete invoicing or photograph-management system in this branch.

SECURITY REQUIREMENTS

1. All `/admin/` pages and admin APIs must require Firebase Authentication.
2. Authorization must use an approved Firebase UID or an `admin: true` custom claim.
3. Do not authorize administrators solely by comparing an email address in browser code.
4. Do not provide public account registration.
5. Every backend admin function must independently verify the Firebase ID token and admin authorization.
6. Public visitors must not be able to read, list, update, or delete customer, company, communication, note, site, or service information.
7. Add Firebase Rules tests proving public access is denied and approved administrator access works.
8. Do not put SMTP credentials, Firebase Admin credentials, API keys that must remain private, or customer data in the repository.
9. Add `noindex, nofollow` protection to admin pages, but do not treat obscurity as authentication.
10. Sanitize and validate all data on both the client and backend.
11. Store notes as plain text for this version. Do not allow raw HTML.
12. Maintain an append-only audit history for important actions.
13. Do not send real test emails to customers.
14. Use a mocked email transport during automated and emulator testing.
15. Do not deploy Functions, Database Rules, Storage Rules, or backend changes without explicit human approval. Test backend functionality with Firebase Emulator Suite first.

USE THE EXISTING ARCHITECTURE

1. Inspect the existing dashboard and Firebase data structures before designing new ones.
2. Continue using the repository’s existing Firebase database unless there is a documented technical reason to change it.
3. Do not introduce an unnecessary framework or database migration.
4. Preserve existing quote submissions.
5. Do not destructively rewrite existing customer or submission records.
6. Add versioned new collections/nodes and link them to existing quote-submission IDs.
7. Document the resulting data model.

ADMIN NAVIGATION

Add an authenticated admin navigation structure containing:

* Dashboard
* Leads
* Companies
* Contacts
* Solar Sites
* Communications
* Service Visits
* Follow-ups
* Settings

Use the current AgriSolar visual identity, but optimize the admin area for clear business use rather than marketing.

DASHBOARD

Create an admin dashboard showing:

* New quote requests
* Leads awaiting contact
* Upcoming follow-ups
* Recently contacted customers
* Active companies
* Active solar sites
* Recent notes and communications
* Recent service visits

Do not invent financial totals or operational statistics.

COMPANY RECORDS

Create company records supporting:

* Company display name
* Legal company name, when known
* Customer or prospect status
* Main phone
* General email
* Website
* Mailing address
* Billing address
* Primary contact
* Associated contacts
* Associated solar sites
* Internal tags
* Internal notes
* Date created
* Date updated
* Created by
* Updated by

Do not require unnecessary personal information.

CONTACT RECORDS

Create contact records supporting:

* First name
* Last name
* Job title or role
* Associated company
* Email address
* Phone number
* Preferred contact method
* Contact status
* Internal notes
* Created and updated timestamps

Allow one company to have multiple contacts.

LEADS AND QUOTE REQUESTS

Convert or link existing website quote requests into manageable lead records without deleting the original submission.

Support these lead stages:

* New
* Contacted
* Follow-up needed
* Qualified
* Quote being prepared
* Quote sent
* Won
* Lost
* Inactive

Each lead should support:

* Linked website submission
* Company
* Primary contact
* Solar site
* Requested services
* Estimated acreage, when provided
* Lead source
* Assigned administrator
* Current stage
* Next follow-up date
* Internal notes
* Created and updated timestamps

Record every stage change in the audit/activity history.

COMMUNICATION AND EMAIL LOG

Create a communication timeline for every lead, company, contact, and site.

Support these communication types:

* Outgoing email
* Manually recorded incoming email
* Phone call
* Meeting
* Internal note
* Follow-up
* Status change

For outgoing email:

1. Use the existing secured backend email function and Namecheap/cPanel SMTP configuration.
2. Do not change DNS, MX records, SMTP hosting, or email credentials.
3. Keep `info@agrisolarllc.com` as the public contact address.
4. Use only the authenticated, configured AgriSolar SMTP sender.
5. Require an administrator to press a clear Send button.
6. Never send messages automatically merely because a record was created or updated.
7. Show a confirmation step containing recipient, subject, and sender before sending.
8. Validate recipients and prevent header injection.
9. Save:

   * recipient
   * sender
   * subject
   * plain-text body
   * send timestamp
   * authenticated administrator UID
   * SMTP message ID when available
   * delivery attempt status
   * failure reason when applicable
10. Do not include customer-uploaded attachments.
11. Do not expose SMTP errors or credentials to the browser.
12. Allow administrators to save an email draft without sending it.

The current SMTP system cannot automatically retrieve incoming mail. For this MVP, provide a way for an administrator to manually record an incoming email or paste an important response into the communication timeline.

Document future options for securely synchronizing inbound replies, but do not attempt to read Gmail, Outlook, IMAP, or Namecheap mailboxes in this branch.

INTERNAL NOTES AND FOLLOW-UPS

Administrators must be able to:

* Add a dated internal note
* Associate it with a lead, company, contact, site, or service visit
* Set a follow-up date
* Mark a follow-up complete
* See overdue follow-ups
* See who created each note
* Edit a note while preserving an audit entry
* Archive records without permanently deleting business history

Notes must never be included in customer emails unless an administrator intentionally copies them into an email draft.

SOLAR-SITE RECORDS

Create basic solar-site records supporting:

* Site name
* Associated company
* Primary contact
* Service address
* County and state
* Approximate acreage
* Site status
* Access instructions
* General vegetation notes
* Requested services
* Internal operational notes
* Associated leads
* Associated service visits

Do not add unverified acreage, equipment, service-area, or customer claims to the public website.

SERVICE-VISIT AND MOWING LOG FOUNDATION

Create an initial Service Visits module to begin replacing manual mowing records.

A service visit can provisionally contain:

* Company
* Solar site
* Service date
* Service type
* Visit status
* Crew members
* Start and completion times
* Approximate acres serviced
* Equipment used
* Weather or site conditions
* Work performed
* Areas not completed
* Problems or hazards observed
* Vegetation observations
* Follow-up work needed
* Next anticipated service
* Internal notes
* Created and updated timestamps
* Administrator or crew member who submitted the record

Clearly mark this schema as provisional until AgriSolar’s existing paper/manual forms have been reviewed.

Do not invent legal, pesticide, safety, environmental, customer-certification, or contract fields. Create an extensible structure so the real form questions can be incorporated later.

Do not add photograph uploads in this branch.

SEARCH AND FILTERING

Provide useful admin search and filters for:

* Company name
* Contact name
* Email
* Phone
* Site name
* Site address
* Lead stage
* Follow-up date
* Service date
* Service type
* Record status

Search results must remain administrator-only.

AUDIT LOGGING

Record important administrator actions, including:

* Lead created
* Lead stage changed
* Company updated
* Contact updated
* Note added or edited
* Follow-up completed
* Email draft created
* Email send attempted
* Email successfully submitted to SMTP
* Service visit created or updated
* Record archived

Each audit entry should include:

* event type
* record type
* record ID
* authenticated administrator UID
* timestamp
* concise description

Never store passwords, tokens, SMTP credentials, or complete authentication headers in audit records.

FUTURE ROADMAP DOCUMENT

Create `doc/admin-operations-roadmap.md`.

Document these future stages without implementing them:

Stage 2 — Digital field forms

* Review AgriSolar’s existing manual forms.
* Map every existing field and signature requirement.
* Create mobile-friendly forms for crews.
* Allow drafts when cellular service is unavailable.
* Add completion and supervisor-review workflows.
* Preserve submitted records and revisions.

Stage 3 — Before-and-after photographs

* Administrator or authorized crew authentication
* Pictures linked to company, site and service visit
* Before and after classifications
* Capture date and uploader
* Optional location metadata only after owner approval
* Admin-only Storage Rules
* File-size and image-type validation
* Random storage paths
* No public reads
* No direct email attachments
* Thumbnail generation
* Retention rules
* Secure customer sharing only when specifically approved

These photographs are different from the disabled public quote-form uploads because authorized AgriSolar personnel—not anonymous visitors—will upload them after a mowing visit.

Stage 4 — Estimates and invoices

* Estimate numbers
* Customer and billing address
* Site and job reference
* Line items
* Acreage and service pricing
* Taxes, discounts and adjustments
* Estimate approval
* Invoice numbers
* Draft, sent, partially paid, paid, overdue, void and written-off states
* PDF generation
* Email delivery history
* Payment recording
* Balance history
* Export for accounting
* Audit history
* No automatic charging or payment processing without separate approval

Stage 5 — Customer portal

* Secure customer access
* Approved service records
* Before-and-after photographs
* Estimates and invoices
* Downloadable documents
* Communication history appropriate for customers
* Strict separation from internal notes

MVP ACCEPTANCE CRITERIA

The phase is complete when:

1. An authenticated administrator can manage companies, contacts, leads, sites, notes, communications, follow-ups, and provisional service visits.
2. Public and unauthenticated users cannot access any admin data.
3. Existing quote submissions remain intact.
4. A quote submission can be linked to a lead.
5. An administrator can draft an email.
6. Test mode can log a mocked email without contacting a customer.
7. An administrator can manually record an incoming communication.
8. An administrator can add notes and follow-ups.
9. An administrator can create a provisional mowing/service-visit record.
10. Important actions produce audit entries.
11. Firebase Rules emulator tests prove the required access boundaries.
12. No public file upload has been reintroduced.
13. No invoice, payment, customer portal, mailbox synchronization, or photo-upload feature has been prematurely implemented.
14. Namecheap, cPanel, DNS, MX records, existing mailboxes, agrisolarllc.com, and the default Firebase live channel remain unchanged.

PREVIEW LIMITATION

Firebase Hosting preview channels do not safely preview all deployed Functions and Rules changes.

Therefore:

1. Use Firebase Emulator Suite for backend and security-rule verification.
2. Do not connect automated browser tests to production customer data.
3. Do not send real SMTP email during testing.
4. The Firebase Hosting preview may demonstrate the admin interface, but backend functionality must remain disabled or use an explicitly safe emulator/test configuration.
5. Provide a separate backend deployment plan after review.
6. Do not deploy backend resources until Aaron explicitly approves the exact branch and commit.

CURRENT SCHEDULING WORKFLOW REQUIREMENTS

AgriSolar currently tracks its annual mowing schedule on a whiteboard. Each column represents a solar site, and each site includes:

* Site or project name
* Location
* Acreage
* Vegetation-height requirement when applicable
* Mow 1
* Mow 2
* Mow 3
* Mow 4
* Planned month or date
* Actual completion date

Replace this manual schedule with an administrator-only Annual Mowing Schedule.

DATA DESIGN

Do not store Mow 1 through Mow 4 as four fixed database columns.

Create a separate scheduled-service record for every mowing cycle so additional visits can be added later.

Each scheduled-service record should support:

* Service year
* Company
* Solar site
* Mowing-cycle number
* Service type
* Planned month
* Tentative scheduled date
* Confirmed scheduled date
* Actual start date
* Actual completion date
* Site acreage
* Estimated acres to service
* Actual acres completed
* Target vegetation height
* Status
* Assigned crew
* Assigned equipment
* Weather delay
* Rescheduling reason
* Completion notes
* Problems or hazards
* Follow-up required
* Ready-for-invoicing indicator
* Associated service-visit record
* Created and updated timestamps
* Administrator UID

Use these statuses:

* Planned
* Scheduling needed
* Scheduled
* In progress
* Partially completed
* Completed
* Weather delayed
* Customer delayed
* Rescheduled
* Cancelled

ADMIN SCHEDULE VIEWS

Create:

1. Annual schedule grid showing sites vertically and Mow 1–4 horizontally.
2. Calendar view showing scheduled mowing dates.
3. List view supporting search, sorting and filtering.
4. Site history showing every mowing completed at that site.
5. “Scheduling needed” view.
6. “Ready for invoicing” view.
7. Overdue and delayed service view.

The annual grid should visually resemble the existing whiteboard because that is the workflow AgriSolar already understands.

Allow an administrator to open any mowing-cycle cell and:

* Set or change the planned date
* Mark work started
* Mark partially completed
* Mark completed
* Enter acres completed
* Enter crew and equipment
* Record weather delays
* Add operational notes
* Create a follow-up visit
* Mark the completed visit ready for invoicing

Do not implement invoice generation in this branch. The ready-for-invoicing status will later connect completed mowing records to invoices.

DASHBOARD TOTALS

Show administrator-only operational totals:

* Total contracted or scheduled acres
* Acres scheduled this month
* Acres completed this season
* Acres remaining
* Sites awaiting scheduling
* Visits delayed
* Visits ready for invoicing

Calculate totals from actual site and service records. Never hard-code totals.

DATA IMPORT

Do not hard-code the photographed whiteboard schedule into public source code.

Create a safe administrator-only data-entry process or documented import template containing:

* Site name
* Location
* Acres
* Height requirement
* Mow-cycle number
* Planned date
* Completed date

Do not import entries whose handwriting, spelling, year or date meaning has not been confirmed by Aaron.

FUTURE CONNECTIONS

Design stable identifiers so every scheduled mowing can later connect to:

* Digital crew form
* Completed service record
* Before photographs
* After photographs
* Customer
* Contract
* Estimate
* Invoice
* Invoice email
* Payment status

Photographs will eventually be uploaded only by authenticated AgriSolar administrators or crew members. Do not restore anonymous public uploads.
2026 SCHEDULE AND RENEWAL REQUIREMENTS

The photographed whiteboard represents AgriSolar’s remaining mowing schedule for 2026.

Confirmed site names include:

* Reif 1A — 8 acres
* Reif 1B — 18 acres
* Reif 2A — 16 acres
* Reif 2B — 18 acres
* Reif 3 — 18 acres
* Lindauer — 29 acres
* Corfee — Gillespie — 40 acres
* Horseshoe — Hillsboro — 36 acres
* McCray — Greenville — 26.8 acres
* Brighton — 60 acres
* St. Joseph 1 and 2 — 30.4 acres combined

The apparent total is 300.2 acres. Treat that total as provisional until administrator entry is reviewed.

Some sites have an indicated 18-inch vegetation-height requirement. Store the height requirement separately for each site and contract rather than assuming it applies to every site.

MULTI-YEAR AND RENEWAL DESIGN

Solar sites must be permanent records. Do not create a duplicate site each year.

Create a separate service-season or contract record for each year. The current season is 2026.

Each site’s annual service record should support:

* Service year
* Customer or company
* Solar site
* Contract start date
* Contract end date
* Planned number of mowing cycles
* Planned herbicide or other services
* Contract acreage
* Vegetation-height requirement
* Contract status
* Renewal status
* Renewal follow-up date
* Renewal notes
* Linked mowing schedule
* Linked service visits
* Linked future invoices

Use these contract statuses:

* Prospect
* Proposed
* Active
* Completed
* Expired
* Cancelled

Use these renewal statuses:

* Not reviewed
* Renewal follow-up needed
* Customer contacted
* Renewal proposed
* Renewed
* Not renewed
* Decision pending

When a site is renewed:

1. Preserve the complete 2026 history.
2. Create a new service-season record for 2027.
3. Keep the same company, contact and solar-site identifiers.
4. Allow an administrator to copy the previous year’s service plan.
5. Require the administrator to review acreage, pricing, mowing frequency, height requirements and services before saving.
6. Do not automatically assume that terms remain unchanged.
7. Do not automatically mark a site renewed.
8. Record who approved the renewal and when.

Add a Renewal Dashboard showing:

* Contracts approaching expiration
* Sites needing renewal follow-up
* Renewal proposals sent
* Customers awaiting a decision
* Renewed acreage
* Acreage not yet renewed
* Sites not renewed

Do not publish these customer names, site details, acreage figures, schedules or renewal information on the public website. They are administrator-only business information.
INVOICE REQUIREMENTS BASED ON CURRENT AGRISOLAR INVOICE

Use the provided “Invoice June 2026 ESS” as the approved structural example for future invoice management.

Do not implement or send invoices in the current remediation branch unless separately authorized. Document and design the data model so this workflow can be implemented without restructuring customer, site, contract or service-visit records.

BILLING NAMES AND SITE IDENTIFIERS

Each solar site must support:

* Internal short name
* Official billing description
* Customer site code
* Customer project code
* Purchase-order number
* Contract acreage
* Billing rate
* Billing unit
* Associated customer
* Associated annual service contract

For example, an internal name such as “Reif 2A” may have the official billing name “SV CSG Reifschneider II A.”

Do not assume the public, internal and billing names are always identical.

CUSTOMER BILLING PROFILE

Each company must support a separate billing profile containing:

* Billing company name
* Billing contact
* Billing email addresses
* Billing address
* Customer-assigned vendor number
* Default payment terms
* Default currency
* Invoice-email instructions
* Customer-specific invoice requirements

The vendor number belongs to the relationship between AgriSolar and the customer. Do not assume the same vendor number applies to every customer.

INVOICE RECORD

Each invoice must contain:

* Unique invoice ID
* Human-readable invoice number
* Customer
* Billing-address snapshot
* Vendor-number snapshot
* Invoice date
* Payment terms
* Calculated due date
* Customer project reference
* Service period
* Status
* Line items
* Subtotal
* Tax, when applicable
* Adjustments
* Total
* Amount paid
* Remaining balance
* Internal notes
* Customer-visible notes
* PDF version
* Created by
* Approved by
* Sent by
* Created, approved and sent timestamps

Use integer cents for monetary calculations. Do not use floating-point values for currency.

Use these invoice statuses:

* Draft
* Awaiting review
* Approved
* Sent
* Partially paid
* Paid
* Overdue
* Voided
* Written off

Sent invoices must not be deleted or silently changed. Corrections should create a revision, credit, replacement invoice or void record while preserving history.

INVOICE LINE ITEMS

Every invoice line should link to a completed service visit and support:

* Solar site
* Official billing description
* Service year
* Service type
* Mowing-cycle number
* Service month
* Actual completion date
* Purchase-order number
* Quantity
* Billing unit
* Unit price
* Line amount
* Associated contract
* Associated completed service visit

An invoice can contain several sites and several completed mowing visits for the same customer.

The description format should support wording such as:

“SV CSG Reifschneider II A - 2026 Vegetation Season Cut #2 (June 2026)”

Do not generate a line item from a merely scheduled mowing. The associated service visit must be marked completed and ready for invoicing.

PRICING

Support pricing methods including:

* Per acre
* Flat amount per mowing
* Flat seasonal amount
* Hourly
* Per application
* Custom line item

Do not infer or change contractual rates automatically.

An administrator must review:

* Acreage
* Rate
* Quantity
* PO number
* Description
* Line amount

before approving an invoice.

Store the approved rate with the contract and copy a snapshot onto the invoice line. Later contract changes must not alter an already approved or sent invoice.

INVOICE CREATION WORKFLOW

1. Crew or administrator completes the service record.
2. Administrator reviews the work and marks it ready for invoicing.
3. The completed visit appears in the Ready for Invoicing queue.
4. Administrator selects one or more completed visits for the same customer.
5. The system creates a draft invoice.
6. The administrator verifies descriptions, PO numbers, rates and amounts.
7. The system calculates subtotal and total.
8. The administrator previews the invoice PDF.
9. A second confirmation is required before marking it approved.
10. Sending requires a separate explicit action.
11. The system records the email and PDF version that were sent.
12. The related service visits are marked invoiced.

Never automatically email an invoice merely because mowing was marked completed.

PDF REQUIREMENTS

Generate a professional letter-size PDF that preserves the current AgriSolar invoice’s general structure:

* AgriSolar logo and company information
* Invoice heading
* Invoice number and date
* Vendor number
* Bill-to section
* Payment terms
* Project reference
* Quantity
* Description
* PO number
* Amount
* Total

Support multiple pages when necessary and repeat the line-item headings on later pages.

Before an invoice is sent:

* Render the generated PDF
* Verify no clipped or overlapping text
* Verify all calculations
* Verify the correct customer and billing address
* Verify every PO number
* Verify the invoice number
* Verify the total

After sending, preserve an immutable copy of the exact PDF.

INVOICE EMAIL

Generated AgriSolar invoice PDFs may be attached to authenticated outgoing invoice emails because they are internally generated documents. This does not restore anonymous customer file uploads.

Record:

* Sender
* Recipients
* CC recipients
* Subject
* Plain-text email body
* Invoice ID
* PDF version
* SMTP message ID
* Send timestamp
* Administrator UID
* SMTP acceptance or failure status

SMTP acceptance does not prove that the customer received or opened the email. Do not label an invoice delivered unless reliable delivery information is available.

Do not send real invoice emails during development or automated testing.

PAYMENT TRACKING

Future payment tracking should support:

* Payment date
* Payment amount
* Payment method
* Reference or check number
* Administrator note
* Remaining balance
* Partial payments
* Paid-in-full date

Do not connect to bank accounts or automatically charge customers without a separately reviewed payment-integration phase.

CURRENT EXAMPLE

The June 2026 ESS example contains five line items totaling $8,544 with Net 30 terms. Use it for structural testing, but do not place actual customer billing data in public test fixtures or the Firebase Hosting output.
Hello [Customer Contact Name],

Attached is AgriSolar LLC Invoice #[Invoice Number] for vegetation-management services completed during [Service Month and Year].

Invoice total: [Invoice Total]
Payment terms: [Payment Terms]
Due date: [Due Date]

This invoice includes completed services for:

[Site and service summary]

The applicable pre-mow and post-mow photographs have been uploaded to your SharePoint site:

[SharePoint folder link]

Please let us know if you need additional documentation or have any questions about the invoice or completed work.

Thank you,

[Sender Name]
AgriSolar LLC
618-539-2098
[info@agrisolarllc.com](mailto:info@agrisolarllc.com)
[www.agrisolarllc.com](http://www.agrisolarllc.com)


CUSTOMER-SPECIFIC INVOICE AND SHAREPOINT WORKFLOW

AgriSolar sends invoices to multiple solar companies. Each company may have different:

* Billing contacts
* Billing addresses
* Vendor numbers
* Payment terms
* PO-number requirements
* Invoice-email instructions
* Invoice-description formats
* SharePoint sites
* SharePoint folder structures
* Photograph-submission requirements

Store these settings separately for each customer. Do not assume the Energy Support Services example applies to every company.

CONFIGURABLE INVOICE EMAILS

Create a default invoice-email template using placeholders for:

* Customer contact
* Invoice number
* Service month
* Invoice total
* Payment terms
* Due date
* Site and service summary
* SharePoint folder link
* Sender name

Allow administrators to:

* Maintain a default AgriSolar template
* Create customer-specific templates
* Preview the completed email
* Edit the message before sending
* Save a draft
* Confirm recipients and attachments
* Send only after explicit confirmation

Never automatically send an invoice when a mowing record is completed.

PRE-MOW AND POST-MOW PHOTOGRAPHS

AgriSolar currently uploads pre-mow and post-mow photographs to each solar company’s SharePoint site.

For the first version, do not automate SharePoint uploads.

Add an administrator-only photo-delivery checklist to every service visit containing:

* Pre-mow photographs required
* Pre-mow photographs taken
* Pre-mow photographs uploaded to SharePoint
* Post-mow photographs required
* Post-mow photographs taken
* Post-mow photographs uploaded to SharePoint
* Customer SharePoint site
* SharePoint destination folder
* SharePoint folder URL
* Date uploaded
* Uploaded by
* Number of photographs
* Customer confirmation, when available
* Internal notes
* Photo-delivery status

Use these statuses:

* Not started
* Pre-mow photos needed
* Pre-mow photos uploaded
* Post-mow photos needed
* Post-mow photos uploaded
* Complete
* Customer follow-up needed

Allow the administrator to paste the customer’s SharePoint folder URL into the service record. Keep the URL and associated details administrator-only.

Do not expose customer SharePoint links on the public website.

PHOTO NAMING CONVENTION

Document and support a consistent filename format such as:

`YYYY-MM-DD_SiteName_CutNumber_PRE_001.jpg`

`YYYY-MM-DD_SiteName_CutNumber_POST_001.jpg`

Make the naming convention configurable because some customers may require their own format.

SHAREPOINT AS CUSTOMER DELIVERY SYSTEM

For the initial system:

1. AgriSolar completes a mowing visit.
2. The service visit records the official completion date.
3. Pre-mow and post-mow photograph requirements are checked.
4. An authorized employee manually uploads photographs to the customer’s SharePoint.
5. The employee records the SharePoint folder link and upload completion.
6. The service visit is marked documentation complete.
7. The visit becomes eligible for invoicing.
8. The SharePoint link can be inserted into the editable invoice email.
9. The administrator reviews and sends the invoice.

A service visit should not be marked ready for invoicing when required customer documentation is incomplete, unless an administrator provides an override reason.

FUTURE SHAREPOINT AUTOMATION

Document, but do not implement, a future Microsoft SharePoint integration that could:

* Authenticate through Microsoft authorization
* Store no Microsoft passwords in the application
* Use customer-approved access
* Upload pre-mow and post-mow photographs
* Create folders using customer-required naming
* Record SharePoint file and folder identifiers
* Detect upload failures
* Prevent duplicate uploads
* Confirm the final uploaded file count
* Retain an audit log
* Support different SharePoint tenants for different customers

Do not assume that one authorization grants access to every customer’s SharePoint. Each solar company may control a separate Microsoft tenant and require separate permission.

PHOTO STORAGE

Customer SharePoint should remain the customer-facing document-delivery location.

If AgriSolar later temporarily stores crew photographs in Firebase:

* Require authenticated administrator or crew access
* Prohibit public reads and uploads
* Link every image to a service visit
* Separate pre-mow and post-mow images
* Record uploader and capture date
* Use randomized storage paths
* Apply retention and deletion rules
* Never attach an uncontrolled public upload to email

This authenticated crew-photo workflow is separate from the disabled anonymous quote-form upload feature.

## Authoritative Addendum: AgriSolar Prospecting and Promotion Assistant

### Objective

Add an administrator-only business-development workspace that helps AgriSolar find,
review, qualify, and contact potential commercial solar vegetation-management
customers. It should also help prepare promotional content for AgriSolar's website,
email campaigns, case studies, and social channels.

This is an AgriSolar feature inspired by useful Catalyst concepts. Do not connect the
entire Catalyst application or copy its database authority model into Firebase.

### Core Safety Boundary

Artificial intelligence may research public business information, summarize evidence,
suggest lead priority, and create drafts. It must not make the final business decision
or contact anyone without an authenticated administrator's review and explicit action.

The first version must not:

* Automatically send outreach email
* Automatically enroll a contact in a campaign or follow-up sequence
* Automatically approve, reject, or delete a prospect
* Invent a person, email address, project, acreage, contract, or service need
* Present an AI inference as a verified fact
* Scrape content behind authentication, paywalls, access controls, or technical blocks
* Use private customer notes, schedules, pricing, or service history as model input
  unless an administrator deliberately selects the minimum necessary information
* Expose the OpenAI API key or prospect records in browser code or public Hosting files

### Prospect Discovery

Allow an administrator to define a discovery request using criteria such as:

* Target state, region, or travel radius
* Solar asset owner, operator, developer, EPC, O&M provider, asset manager, or facility
  management company
* Utility-scale or commercial solar relevance
* Vegetation-management, mowing, herbicide, erosion-control, or site-maintenance need
* Minimum confidence and required evidence
* Excluded companies, domains, and contacts

Discovery results must be saved as review candidates, not automatically as approved
leads. Every candidate must preserve:

* Company name
* Website and normalized domain
* Public source URL
* Source title
* Date and time accessed
* Exact supporting excerpt or concise evidence summary
* Public business contact details, when available
* Why the result may fit AgriSolar
* AI confidence and qualification explanation
* Verification status
* Administrator review status

Respect website terms, access restrictions, and reasonable request pacing. Prefer
official company, project, procurement, and public agency sources. Do not treat a search
snippet alone as verified evidence when the source page cannot be reviewed.

### Duplicate and Identity Protection

Before a candidate can become a lead, compare it with existing companies, contacts,
quote requests, leads, prior outreach, and suppression records. Flag:

* Exact and near-matching company names
* Matching normalized domains
* Matching email addresses and telephone numbers
* Subsidiary or parent-company uncertainty
* Conflicting company or contact information
* A prior opt-out, do-not-contact decision, bounced address, or complaint

Ambiguous records require administrator resolution. Never merge or overwrite business
records automatically.

### AI-Assisted Qualification

The assistant may propose:

* Fit score and supporting reasons
* Likely service interest
* Recommended contact role
* Suggested next action
* Missing facts that require verification
* Risks or reasons not to contact

Store AI conclusions separately from verified facts. Record the model, prompt version,
generation time, source identifiers, and administrator decision. Changing source facts
must make the prior qualification visibly stale rather than silently treating it as
current.

### Outreach Drafting

For an administrator-approved prospect, generate an editable draft containing:

* Recipient and company
* Subject
* Plain-text and optional HTML body
* AgriSolar value proposition relevant to the verified prospect facts
* Suggested call to action
* Internal explanation of how the message was personalized
* Source references used for personalization
* Claims requiring administrator verification

The draft must be factual, concise, professional, and clearly identify AgriSolar. It
must not claim an existing relationship, completed work, customer endorsement,
certification, guaranteed outcome, or known site condition without verified support.

Before sending, require a separate screen that displays the sender, recipient, subject,
complete message, prior contact history, suppression status, and attachments. Sending
requires a deliberate administrator confirmation. Draft generation and email sending
must remain separate operations.

### Promotion Assistant

Allow administrators to create and revise drafts for:

* Website service-page improvements
* Search-friendly page titles and descriptions
* Educational articles about solar vegetation management
* Project summaries and case-study outlines using approved facts
* Seasonal reminders
* Social-media posts
* Sales one-sheets and capability statements
* Follow-up email drafts

All promotional content remains a draft until approved. Customer names, photographs,
results, quotes, acreage, or project details require documented permission before public
use. AI-generated search claims and factual statements must be reviewed before
publication.

### Compliance and Reputation Controls

Before enabling any outbound prospecting email, AgriSolar must approve an outreach and
privacy policy appropriate to the jurisdictions and recipients involved. The system
must support at least:

* Do-not-contact and unsubscribe suppression
* Bounce and complaint suppression
* Sender identity and business-address configuration
* Source and lawful-use review for contact data
* Frequency limits and quiet-period controls
* A complete record of drafts, approvals, sends, failures, and opt-outs
* Immediate cancellation of pending outreach when a contact is suppressed

Do not treat this product specification as legal advice. Obtain appropriate compliance
review before activating email campaigns or automated follow-ups.

### OpenAI Integration Requirements

Use the OpenAI API from trusted server-side Firebase Functions or another approved
backend. A ChatGPT subscription is not the application integration; AgriSolar will need
a separately controlled OpenAI API project, billing configuration, API credential, and
usage limits.

Implementation requirements:

* Use the OpenAI Responses API for new generation workflows.
* Store the API credential in managed secrets and never return it to the browser.
* Use Structured Outputs with strict schemas for prospect analysis and email drafts.
* Validate every model result again in application code before saving it.
* Use `store: false` for prospect and business-data requests unless a later privacy
  review explicitly approves OpenAI-managed response state.
* Minimize personal and confidential information sent to the model.
* Record model usage, latency, errors, and estimated request cost without logging secret
  values or unnecessary message content.
* Configure per-user and daily usage limits and a manual administrative off switch.
* Keep model selection configurable and evaluate output quality before changing models.
* Treat refusal, incomplete output, missing evidence, and invalid structured output as
  normal review states rather than silently retrying or fabricating a result.

### Stable Records

Design administrator-only records for:

* Discovery requests and runs
* Prospect candidates
* Prospect sources and evidence
* Verification decisions
* Qualification proposals
* Outreach drafts
* Campaigns and campaign membership
* Communications and follow-ups
* Suppression entries
* AI generation and approval audit events

Use stable generated identifiers. Link an approved prospect to the existing lead,
company, contact, communication, and follow-up records rather than creating parallel
customer identities.

### Delivery Phases

1. **Outreach foundation:** manual prospect entry, source evidence, duplicate checks,
   suppression records, and administrator review.
2. **AI qualification:** server-side structured analysis of administrator-selected
   evidence, with no email generation or sending.
3. **Draft assistant:** personalized outreach drafts with source references and explicit
   review, while sending remains disabled or mocked.
4. **Promotion assistant:** administrator-reviewed website, article, case-study, and
   social-content drafts.
5. **Controlled sending:** enable the existing authenticated email transport only after
   compliance, suppression, rate-limit, audit, and sender-reputation review.
6. **Measured follow-up:** add administrator-approved sequences only after manual sending
   is proven safe; never create open-ended autonomous campaigns.

### Acceptance Criteria

* Anonymous and ordinary authenticated users cannot read or write prospecting data.
* The OpenAI API credential is absent from browser assets, logs, and database records.
* Every discovered fact has retrievable source evidence and a verification state.
* AI-generated conclusions are visibly different from verified facts.
* Duplicate and suppressed contacts cannot proceed to sending.
* No AI request can directly send email or publish promotional content.
* Every send and publication requires a separate authenticated administrator action.
* Tests use synthetic companies, contacts, evidence, and mocked email transport.
* Usage limits, failure states, and an administrative off switch are tested.
* Private prospect data and prompt fixtures are excluded from Firebase Hosting output.
