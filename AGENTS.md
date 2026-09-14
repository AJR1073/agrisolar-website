# AgriSolar Codex operating instructions

This repository is the AgriSolar LLC Firebase development site. The Firebase project used for development deployments is `agrisolar-website`.

## Normal local deployment workflow

When the user asks to **deploy AgriSolar dev**, **deploy the latest AgriSolar site**, or equivalent, Codex may perform the development deployment without asking the user to paste terminal commands one at a time.

Preferred command:

```bash
./scripts/deploy-dev.sh
```

For Cloud Functions only:

```bash
./scripts/deploy-functions.sh
```

For a non-mutating deployment check:

```bash
./scripts/check-deployment.sh
```

The scripts are designed for the clean deployment worktree, normally `/home/admx/CascadeProjects/agrisolar-deploy`. They may also run from a clean `main` checkout. Never automatically stash, discard, overwrite, or reset uncommitted user work. If the current checkout has local changes, stop and explain what is dirty. If the current branch is a feature branch, use a separate clean worktree instead of merging or rebasing it for deployment.

## Deployment rules

- Development Firebase project: `agrisolar-website` only.
- Cloud Functions runtime target is Node.js 22. If the local shell uses another Node version, prefer switching to Node 22 when available, but do not alter the user's system-wide Node installation without permission.
- Install dependencies with `npm ci`; do not run `npm audit fix --force` as part of deployment.
- Run the repository's deployment checks before a full dev deployment. Stop on the first failure.
- After deployment, run `./scripts/check-deployment.sh` and report exactly what succeeded or failed.
- Preserve the existing `info@agrisolarllc.com` website-mail routing and the existing Firebase secrets. Never print secret values.

## Actions requiring explicit user approval

Do not perform any of the following merely because the user asked for a normal development deploy:

- change Namecheap, DNS, MX, SPF, DKIM, custom-domain, or nameserver settings;
- change Firebase/Google Cloud IAM roles or service accounts;
- create, rotate, reveal, delete, or replace secrets/API keys;
- delete Firebase data, storage objects, users, projects, functions, or hosting sites;
- migrate the production/custom domain or switch `agrisolarllc.com` traffic;
- send customer email, outreach, quotes, or replies;
- run destructive Git commands against user work, including `git reset --hard`, `git clean -fd`, or forced pushes.

These require a separate, explicit instruction from the user for that specific action.

## Git behavior

- `main` is the deployment source of truth.
- A clean detached checkout of `origin/main` is acceptable for the deployment worktree.
- Never merge `main` into a dirty feature branch just to deploy.
- Deployment scripts may fetch and fast-forward/switch a clean deployment checkout to `origin/main`.

## Useful verification targets

- Public dev site: `https://agrisolar-website.web.app/`
- Admin page: `https://agrisolar-website.web.app/admin/`
- Expected functions include `sendEmailOnNewContactSubmission`, `sendReply`, `discoverProspects`, `draftOutreachEmail`, and `apiV1`.
