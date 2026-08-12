# MCP OAuth and ChatGPT Work Release Status

**Gate status:** BLOCKED — Auth0 setup and both interactive ChatGPT Work tests are pending  
**Firebase project:** `agrisolar-website` (DEV)  
**Deployed application commit:** `00a1f7644b2253e66e04251f29c4f60411f90d9e`  
**MCP revision deployment timestamp:** `2026-08-12T03:26:26.317236686Z`
(`2026-08-11 10:26:26 PM CDT`)  
**MCP revision:** `mcp-00003-qox`  
**API revision:** `apiv1-00004-gox`

## Verified Deployment State

* `https://agrisolar-website.web.app/admin/` returns HTTP `200`.
* `https://agrisolar-website.web.app/mcp` returns HTTP `503` with
  `MCP_AUTH_NOT_CONFIGURED`.
* `https://agrisolar-website.web.app/.well-known/oauth-protected-resource` returns HTTP
  `503` with `MCP_AUTH_NOT_CONFIGURED`.
* This is the required fail-closed state. The endpoint must remain locked until all
  required OAuth values are present and valid.

## Auth0 Setup Required From Aaron

Create or connect an Auth0 **development** tenant, then configure one Auth0 API with:

| Auth0 field | Exact value or action |
| --- | --- |
| API name | `AgriSolar MCP DEV` |
| API identifier/audience | `https://agrisolar-website.web.app/mcp` |
| Signing algorithm | `RS256` |
| Permission/scope | `agrisolar:mcp` |
| Issuer | Copy the exact `issuer` from the tenant's `/.well-known/openid-configuration`, including a trailing slash |
| JWKS URL | Copy the exact `jwks_uri` from that discovery document |
| Client registration | Enable Auth0's supported MCP/third-party CIMD or dynamic-client-registration path; if ChatGPT requests a pre-registered client, create it and copy its non-secret client ID |
| Redirect URL | Copy the exact `https://chatgpt.com/connector/oauth/{callback_id}` shown by ChatGPT; never guess `{callback_id}` |

Aaron may provide the non-secret issuer, JWKS URL, registration method/client ID, and
redirect URL. Do not send a client secret, access token, refresh token, password, private
key, or administrator token through chat.

## Firebase Runtime Configuration

The current MCP resource server requires these non-secret Firebase Functions variables:

```dotenv
MCP_RESOURCE_URL=https://agrisolar-website.web.app/mcp
MCP_AUTH_AUDIENCE=https://agrisolar-website.web.app/mcp
MCP_AUTH_ISSUER=https://YOUR_AUTH0_DOMAIN/
MCP_AUTH_JWKS_URL=https://YOUR_AUTH0_DOMAIN/.well-known/jwks.json
MCP_AUTH_SCOPE=agrisolar:mcp
```

Store them in the ignored, permission-restricted
`functions/.env.agrisolar-website` file. After copying the exact provider values:

```bash
chmod 600 functions/.env.agrisolar-website
npx --yes firebase-tools@15.26.0 deploy \
  --project agrisolar-website \
  --only functions:mcp,hosting
```

There are **no MCP secret variables required by the deployed resource server**. It
validates signed tokens through the public Auth0 JWKS. If a separately reviewed future
server-side flow requires a secret, first bind that exact name with Firebase Functions
`defineSecret`, then create it interactively in Secret Manager; for example:

```bash
npx --yes firebase-tools@15.26.0 functions:secrets:set AUTH0_CLIENT_SECRET \
  --project agrisolar-website
```

Do not run that example command for the current implementation because
`AUTH0_CLIENT_SECRET` is not consumed or bound. A ChatGPT OAuth client secret, if Auth0
issues one for a pre-registered client, belongs only in the Auth0 and ChatGPT connection
screens—not Firebase, GitHub, source code, release evidence, or chat.

After the first approved Auth0 login, the exact Auth0 `sub` and issuer must be mapped to
one active, DEV-only, server-controlled `agent_identities` record before MCP calls can be
authorized. This record must not be created through a public/browser database write.

## Automated Release Gate

The repository command below validates non-secret evidence from both required tests:

```bash
cp doc/mcp-e2e-evidence.template.json .mcp-e2e-evidence.json
npm run verify:mcp-release-gate
```

The command is currently and intentionally **BLOCKED** because the ignored
`.mcp-e2e-evidence.json` file does not exist. It can pass only after:

1. The installed ChatGPT Work connection calls `get_sales_pipeline` and the request,
   agent, organization, and read-audit IDs are recorded.
2. The same connection requests confirmation and calls
   `submit_opportunity_candidate` with a cited synthetic DEV candidate.
3. The record appears once as `pending_review` with source `chatgpt_work`, sends no
   email, and an administrator approves it in the AI Review Center.
4. The opportunity, approval, administrator, request, and audit IDs are recorded.

The validator rejects evidence containing credential-like fields. It validates recorded
evidence but does not replace the two interactive ChatGPT Work tests.

## Test and Change Evidence

`npm run test:full` passed locally on `2026-08-12T03:29:46Z`. This covered syntax,
business API authorization/review/audit behavior, OIDC verification, MCP contracts,
release-gate validation, AI boundaries, HTML/site structure, Firebase Database and
Storage Rules, emulator smoke tests, attachments, scheduling, outreach, and the Admin
Review Center.

This milestone added only OAuth hardening, release-gate automation, tests, and
documentation. It added no business feature, sent no email, imported no business data,
and created no Firebase business or approval record. The synthetic E2E record has not
been created because Auth0 and ChatGPT Work are not connected.
