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
