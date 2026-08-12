# MCP OAuth and ChatGPT Work Release Status

**Gate status:** PASSED — OAuth, authenticated read, confirmed write, and administrator
approval were verified end to end in DEV

**Firebase project:** `agrisolar-website` (DEV)

**Deployed application commit:** `2a6fb196451747fd5c31e5436472ce2030e50476`

**MCP revision update timestamp:** `2026-08-12T04:02:58.101236174Z`
(`2026-08-11 11:02:58 PM CDT`)

**MCP deployment completed:** `2026-08-12T04:04:23.673248135Z`

**MCP revision:** `mcp-00004-qap`

**API revision:** `apiv1-00004-gox`

## Verified Deployment State

* `https://agrisolar-website.web.app/admin/` returns HTTP `200`.
* `https://agrisolar-website.web.app/.well-known/oauth-protected-resource` returns HTTP
  `200` with the Auth0 issuer and `agrisolar:mcp` scope.
* An unauthenticated `POST https://agrisolar-website.web.app/mcp` returns HTTP `401` with
  a `WWW-Authenticate` challenge pointing to the protected-resource metadata.
* Authenticated requests require an exact active DEV mapping in `agent_identities`.
* MCP initialization, tool discovery, the required read, the confirmed candidate write,
  and administrator approval all passed without sending email.

## Auth0 Configuration

The Auth0 development tenant is configured as follows:

| Auth0 field | Exact value or action |
| --- | --- |
| API name | `AgriSolar MCP DEV` |
| API identifier/audience | `https://agrisolar-website.web.app/mcp` |
| Signing algorithm | `RS256` |
| Permission/scope | `agrisolar:mcp` |
| Issuer | `https://agrisolar-mcp-dev.us.auth0.com/` |
| JWKS URL | `https://agrisolar-mcp-dev.us.auth0.com/.well-known/jwks.json` |
| Resource Parameter Compatibility Profile | Enabled |
| Client registration | Client ID Metadata Document (CIMD) enabled; DCR disabled |
| ChatGPT connection ID | `plugin_asdk_app_6a7c00656bc4819181f3c09ee09f9d2c` |

The approved Auth0 subject is mapped to the active DEV identity
`chatgpt-work-aaron-dev`. No OAuth client secret is stored by this repository or required
by the MCP resource server.

## Firebase Runtime Configuration

The current MCP resource server requires these non-secret Firebase Functions variables:

```dotenv
MCP_RESOURCE_URL=https://agrisolar-website.web.app/mcp
MCP_AUTH_AUDIENCE=https://agrisolar-website.web.app/mcp
MCP_AUTH_ISSUER=https://agrisolar-mcp-dev.us.auth0.com/
MCP_AUTH_JWKS_URL=https://agrisolar-mcp-dev.us.auth0.com/.well-known/jwks.json
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

The identity mapping was provisioned through an authenticated server-admin transaction,
not a public/browser database write. Browser security rules continue to deny writes to
the identity registry.

## Automated Release Gate

The repository command below validates non-secret evidence from both required tests:

```bash
npm run verify:mcp-release-gate
```

The command returns **MCP RELEASE GATE: PASSED** with this verified evidence:

| Evidence | Identifier |
| --- | --- |
| ChatGPT connection | `plugin_asdk_app_6a7c00656bc4819181f3c09ee09f9d2c` |
| Read request | `87a0bd1d-d561-4597-b8c3-f0c8ec497271` |
| Read audit | `-OzoXSYSUUBx-1MIls_q` |
| DEV agent | `chatgpt-work-aaron-dev` |
| Confirmed-write request | `1215270c-53ff-4a80-a75f-f41e67ce886b` |
| Synthetic opportunity | `-OzoaY13ewr0rpZYoP86` |
| Submission audit | `-OzoaY13ewr0rpZYoP87` |
| Administrator approval | `-OzocB9WH6kENgghL3ot` |
| Approval audit | `-OzocB9WH6kENgghL3ou` |
| Approval API request | `ad1ecab3-46c6-4b8d-b2fa-b4ca96dcc3e4` |
| Approving administrator UID | `fWscNuWSoGdWmDIhyjneNqFU0r92` |

The candidate was created exactly once as `pending_review`, then changed to `approved`
through the AI Review Center at `2026-08-12T06:20:04.134Z`. Correlation found no related
task, email, external communication, email event, email draft, or email-function
invocation.

The validator rejects evidence containing credential-like fields. It validates recorded
evidence but does not replace the two interactive ChatGPT Work tests.

## Test and Change Evidence

`npm run test:full` passed locally on `2026-08-12T03:29:46Z`. This covered syntax,
business API authorization/review/audit behavior, OIDC verification, MCP contracts,
release-gate validation, AI boundaries, HTML/site structure, Firebase Database and
Storage Rules, emulator smoke tests, attachments, scheduling, outreach, and the Admin
Review Center.

`npm run verify:mcp-release-gate` passed after the authenticated read, confirmed write,
and administrator decision were correlated with Firebase request and audit records.

This milestone added OAuth hardening, release-gate automation, tests, and documentation;
it added no unrelated business feature. The release test intentionally created one
synthetic DEV opportunity and one associated approval record. It created no task, sent
no email or external communication, and imported no business data.

## Milestone Disposition

The OAuth and ChatGPT Work connection milestone is complete and stopped. Further product
feature work requires a new, separately scoped request.
