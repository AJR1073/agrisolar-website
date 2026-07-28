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
