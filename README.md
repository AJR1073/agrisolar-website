# AgriSolar LLC Website

AgriSolar's public website and Firebase-backed admin tools for solar-site vegetation management, scheduling, outreach, and quote intake.

## Local development

Install dependencies with:

```bash
npm ci
npm ci --prefix functions
```

The Firebase project used for the development site is `agrisolar-website`.

## Codex-assisted deployment

This repository includes local deployment automation intended for Codex CLI or direct terminal use.

Full development deploy:

```bash
./scripts/deploy-dev.sh
```

Cloud Functions only:

```bash
./scripts/deploy-functions.sh
```

Verify the current Firebase deployment without changing anything:

```bash
./scripts/check-deployment.sh
```

The deployment scripts refuse to discard local changes or deploy an unexpected Firebase project. See `AGENTS.md` for Codex operating and safety rules.

## Firebase development URLs

- Public site: https://agrisolar-website.web.app/
- Admin: https://agrisolar-website.web.app/admin/

## Tests

Run the core test suite with:

```bash
npm test
```

Additional focused tests are available through the scripts in `package.json`.
