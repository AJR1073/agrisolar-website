# Production release preparation — September 28, 2026

The development site is https://agrisolar-website.web.app/. The existing public site remains https://agrisolarllc.com/. This preparation does not authorize a custom-domain cutover, DNS changes, new secrets, IAM changes, or customer emails.

## Prepared in this release

- Existing GA4 measurement ID `G-8CSJZ4PL5H` is reused on HTTPS `agrisolarllc.com` / `www.agrisolarllc.com` when the page is indexable. Existing Analytics reports stay in the same property; no new property is created.
- Page views, `quote_click`, `contact_click` (phone/email), and `generate_lead` are instrumented. A lead is counted only after Firebase confirms the quote save. Do not use a button click or GA's automatic `form_submit` as the successful-quote conversion.
- Development and preview builds queue events in local `window.dataLayer` only. They never load Google's tag or transmit staging traffic to the existing property. `window.AgriSolarAnalytics.mode` reports `preview`, `production`, or `disabled`.
- No quote answers, customer identifiers, phone/email destinations, or attachments are added to custom events. Page queries/fragments and referrer paths are excluded. Google signals and ad personalization are disabled in the tag; DNT/GPC preferences prevent tag loading.
- Native Planting and Erosion Control are removed from public pages, the quote selector, FAQ/schema, and sitemap. Their former URLs redirect to Services.
- Verified old-site routes `/About-us/`, `/Contact-Us/`, `/Solar-Vegetation-Management/`, `/Solutions/`, and `/Before-and-After/` redirect to the corresponding new pages, including slashless/index variants.
- `/Products/` (honey), `/Testimonials/`, and `/Resources/` (external industry links) have no equivalent approved new content. Leave them as genuine 404s unless the owner approves replacement content; do not redirect unrelated pages to the home page.
- Dev output stays in `dist` with HTML and HTTP `noindex`. Production output goes to `dist-production`; public pages are indexable, while admin/error/redirect pages remain `noindex`. Changed scripts/styles receive content-based cache versions.
- `firebase.production.json` requires the named Hosting target `production`. It is intentionally not bound in `.firebaserc`, so an accidental deploy cannot select the default dev site.

## Reproducible release checks

Use Node 22 when available. Run `npm ci`, `npm run check:release`, and `npm run test:form-attachment`. The browser test serves the built site locally and mocks Firebase writes/uploads; it does not create leads or send email. `CHROME_BIN` can override the Puppeteer-managed browser.

The main-branch workflow deploys only development Hosting after these checks. There is no automatic production deployment workflow.

## Hosting provisioning before the first production deployment

Firebase's service announcement supplied on September 28, 2026 states that projects created starting October 15, 2026 will not automatically receive a default Hosting site at project creation. The date comes from that announcement; the official documentation below confirms the site-list/create mechanism.

The existing `agrisolar-website` development Hosting site is already provisioned. Its successful September 28 deployment does not need site recreation. For a new production project, do not assume its default Hosting site exists.

After the production project and site IDs are approved, use this provisioning sequence before the first asset deployment:

1. Run `firebase hosting:sites:list --project <approved-project-id>` and verify the approved site belongs to that project.
2. If the approved site is absent, create it once with `firebase hosting:sites:create <approved-site-id> --project <approved-project-id>`. If the ID is unavailable, choose an approved unique ID. Stop on permission or provisioning errors; do not ignore them or treat every error as “already exists.”
3. Verify the site is now listed, then bind `firebase target:apply hosting production <approved-site-id> --project <approved-project-id>`.
4. Continue with the production configuration and the remaining backend, custom-domain, Analytics, and end-to-end launch checks.

Keep creation in initial infrastructure provisioning, with an existence check, rather than running it unconditionally on every application deployment. The provisioning identity needs permission to create sites; this preparation does not change IAM or credentials. No new Hosting site has been created as part of this checklist update.

Official references: [Hosting sites and targets](https://firebase.google.com/docs/hosting/multisites), [REST deployment and site existence checks](https://firebase.google.com/docs/hosting/api-deploy), and [projects.sites.create](https://firebase.google.com/docs/reference/hosting/rest/v1beta1/projects.sites/create).

## Remaining launch prerequisites

1. Confirm the production Firebase project and Hosting site, and whether production will use the existing backend or a separate backend. The frontend currently uses Firebase Hosting's `/__/firebase/init.js`; it connects to whichever project hosts it. A separate project requires separately approved backend/rules/secrets setup and an end-to-end check. Do not point the domain at an unprepared project.
2. Complete the Hosting provisioning check above. With explicit cutover approval, bind the `production` Hosting target to the approved site, connect/verify the custom domain and TLS, and plan the DNS change. Preserve all existing mail records and `info@agrisolarllc.com` routing.
3. Confirm access to the existing GA4 property. At launch, verify live `page_view` and a controlled successful `generate_lead` in Realtime/DebugView; mark `generate_lead` as a key event. Verify enhanced-measurement settings do not treat failed form attempts as conversions. Code tests do not prove account-side collection or reporting settings.
4. Confirm Google Search Console ownership, submit the canonical sitemap, inspect important production URLs, and check any AI-search inclusion controls in the account. Do not submit the development domain for indexing.
5. Confirm business/service-area wording, licensing/coverage details, and permission before adding identifiable customer project photos, logos, or case studies. No new customer-specific claims were published in this release.
6. After the approved production deployment, check HTTPS and www behavior, redirects, a real 404, canonical URLs, public indexing, private/admin noindex, mobile navigation, and a controlled end-to-end quote/attachment/email delivery. Confirm the recipient before sending a test notification. Record the release commit and Hosting version for rollback; keep the old site available until sign-off.

## Rollback

Use the previous Firebase Hosting release for the approved production site if application checks fail. If a domain cutover must be reversed, restore the recorded previous web DNS values with owner authorization; do not change mail records. No backend schema or data migration is included here.
