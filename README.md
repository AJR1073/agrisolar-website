# AgriSolar LLC website and operations app

This repository contains the public AgriSolar LLC marketing website and its authenticated Firebase administration tools.

## Environments

- Development site: <https://agrisolar-website.web.app/>
- Production domain: <https://agrisolarllc.com/>

The Firebase site is the development and review environment. Changes to the production domain, Namecheap, DNS, cPanel, or business email require separate owner approval.

Pull requests create temporary Firebase Hosting previews. Merges to `main` update the Firebase development site through GitHub Actions.

## Public website

- Commercial solar-farm mowing and vegetation management
- Service details
- 75-mile service area from Belleville, Illinois
- Safety and equipment planning
- Project-planning information
- Quote and site-assessment form with optional attachments
- FAQ, privacy policy, sitemap, robots file, and custom 404 page

## Administration

The `/admin/` area includes reviewed workflows for contacts, scheduling, outreach, AI cost tracking, and the business API foundation. Public submissions and private administrative records are protected by Firebase Realtime Database and Cloud Storage rules.

## Local development

```bash
npm ci
python3 -m http.server 8000
```

Open <http://localhost:8000/>.

For the Firebase-hosted build:

```bash
npm run build:hosting
```

## Validation

```bash
npm run test:html
npm run test:structure
npm run test:syntax
npm run test:business-api
```

Firebase rule tests require the Firebase emulators and Java 21 or newer.

## Content controls

Do not publish customer names, project claims, testimonials, insurance statements, equipment ownership, certifications, or photographs without verification and approval. Review `CONTENT_REVIEW_REQUIRED.md` before promoting a preview to the development site or production.
