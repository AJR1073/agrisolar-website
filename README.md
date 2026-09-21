# AgriSolar LLC Website

Production-oriented static website and Firebase backend for AgriSolar LLC.

## Local development

```bash
npm ci
npm run build:hosting
firebase emulators:start
```

## Codex-assisted deployment

Codex instructions live in `AGENTS.md`.

Normal development deployment:

```bash
./scripts/deploy-dev.sh
```

Cloud Functions only:

```bash
./scripts/deploy-functions.sh
```

Non-mutating deployment verification:

```bash
./scripts/check-deployment.sh
```

The deployment scripts target the `agrisolar-website` Firebase project and refuse to discard local changes.

## Search metadata and development indexing

The 15 visitor pages have unique titles and descriptions, canonical URLs,
Open Graph and Twitter preview metadata, and relevant JSON-LD structured data.
`sitemap.xml` lists their canonical public-domain URLs. Admin, errors, and legacy
redirects are excluded. The site also includes browser and touch icons.

Firebase development Hosting stays **noindex** through both its response header
and HTML meta tags added by `build:hosting`. `robots.txt` allows crawling so bots
can read those directives. Admin has its own source-level noindex tag as well.
Canonical URLs intentionally retain `https://agrisolarllc.com/`; publishing this
development build does not launch or enable indexing on the public domain.

Run the search-metadata checks after building:

```bash
npm run build:hosting
npm run test:seo
```

The SEO check also runs before every Firebase Hosting upload. It catches sitemap,
canonical, preview-image, structured-data, favicon, redirect, and noindex drift.
When adding a visitor page, update the sitemap and its page metadata together.

### Production launch and business listings

A public launch requires separate approval. That work must use a production
build/configuration, retain noindex on admin and error pages, check public URLs,
and submit the public sitemap in verified search-engine webmaster accounts.
Do not remove development noindex rules just to improve an SEO score.

Google Business Profile is managed separately from website metadata. Confirm the
existing listing and ownership before creating one. Link a verified profile in
business structured data only after its exact URL is known; do not invent hours,
ratings, categories, profile IDs, or street-address claims.

AI search benefits from the same readable content, internal links, accurate
business details, and crawlable production pages. Metadata does not guarantee
indexing, ranking, or AI citations. Google does not require a special AI file or
schema for its AI search features.

References: [Google noindex guidance](https://developers.google.com/search/docs/crawling-indexing/block-indexing),
[sitemaps](https://developers.google.com/search/docs/crawling-indexing/sitemaps/build-sitemap),
[AI search guidance](https://developers.google.com/search/docs/appearance/ai-features),
and [Google Business Profile guidance](https://support.google.com/business/answer/3038177).
