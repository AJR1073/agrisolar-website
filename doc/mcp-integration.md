# AgriSolar ChatGPT Work MCP Integration

**Status:** OAuth/ChatGPT connection milestone in progress; feature work frozen until
the two required end-to-end tests pass
**Endpoint:** `https://agrisolar-website.web.app/mcp`
**Protected-resource metadata:**
`https://agrisolar-website.web.app/.well-known/oauth-protected-resource`

## Current Safety State

The MCP adapter implements Streamable HTTP and exposes six private business
tools:

* `search_opportunities`
* `get_opportunity`
* `create_opportunity`
* `submit_opportunity_candidate`
* `create_task`
* `get_sales_pipeline`

The endpoint fails closed with `503 MCP_AUTH_NOT_CONFIGURED` until an approved OAuth 2.1
provider is configured. It does not accept custom API keys, Firebase owner passwords,
anonymous access, or unverified bearer tokens.

There is no email-sending, contract-changing, invoicing, payment, scheduling, raw
database, or production-system tool. Creation tools add internal DEV records marked for
administrator review.

`submit_opportunity_candidate` is the preferred ChatGPT Work write tool. The older
`create_opportunity` name remains available for compatibility and uses the same protected
business service. Both perform duplicate checks, require an idempotency key, record
source evidence, and create `pending_review` records; neither sends email.

## Shared Review Queue

MCP is the secure tool doorway; it does not discover or populate records by itself.
ChatGPT Work, the AgriSolar Outreach module, a manual administrator form, or a reviewed
import must explicitly submit a candidate. New submissions use the same opportunity
review workflow and store `candidateSubmission.source` as one of:

* `chatgpt_work`
* `outreach_api`
* `manual`
* `import`

The submission metadata also stores a server-generated duplicate-check key, submitter
type/ID, and timestamp. Source URL/evidence and AI confidence/model remain in the
existing source and AI-provenance fields. Pending and rejected candidates are excluded
from sales-pipeline totals.

The Outreach screen still reads legacy `prospect_candidates` records for existing
history and email-draft workflows, but all newly saved candidates are sent through
`POST /api/v1/opportunity-candidates` and appear in **Admin → AI Review Center**.

## Architecture

```text
ChatGPT Work or MCP Inspector
  -> OAuth 2.1 authorization-code flow with PKCE
  -> signed access token for https://agrisolar-website.web.app/mcp
  -> Firebase Hosting /mcp rewrite
  -> Firebase mcp HTTPS function
  -> OIDC signature, issuer, audience, expiration, and scope verification
  -> active agent_identities mapping
  -> shared AgriSolar business operations
  -> organization/capability/authority/rate/audit enforcement
  -> Firebase Realtime Database
```

REST and MCP use the same business-operation implementation. The MCP adapter does not
copy duplicate detection, task validation, idempotency, organization filtering, rate
limits, or audit rules.

## Required OAuth Provider

Use an established OAuth/OIDC provider that supports the MCP authorization contract.
The provider must support:

* OAuth 2.1 authorization code with PKCE `S256`
* OAuth or OpenID Connect discovery metadata
* Client ID Metadata Documents, dynamic client registration, or a configured ChatGPT
  client
* The RFC 8707 `resource` value throughout authorization and token exchange
* Signed JWT access tokens with issuer, audience, expiration, subject, and scopes
* A public HTTPS JWKS endpoint
* Token revocation and short-lived access tokens

OpenAI recommends an established provider instead of implementing an authorization
server from scratch. Auth0 is one documented option, but the provider remains an owner
decision and is not created by this repository.

Firebase email/password authentication by itself is not a compliant authorization
server for this remote MCP connection. Never reuse the AgriSolar administrator password
or Firebase owner token as the ChatGPT credential.

For this milestone, use an Auth0 development tenant unless Aaron explicitly selects a
different established provider. Auth0 is included in OpenAI's current authenticated MCP
guidance and can provide discovery, API audience/scopes, signed JWT access tokens, and
ChatGPT client registration. Do not implement an authorization server inside this
repository.

The Auth0 issuer must be copied exactly from its discovery document, including a trailing
slash when present. The resource server verifies the JWT `iss` value exactly.

## DEV OAuth Values

Configure these non-secret runtime values for the `mcp` Firebase function:

```dotenv
MCP_RESOURCE_URL=https://agrisolar-website.web.app/mcp
MCP_AUTH_AUDIENCE=https://agrisolar-website.web.app/mcp
MCP_AUTH_ISSUER=https://YOUR-DEV-ISSUER.example
MCP_AUTH_JWKS_URL=https://YOUR-DEV-ISSUER.example/.well-known/jwks.json
MCP_AUTH_SCOPE=agrisolar:mcp
```

Use these exact Auth0 resource-server settings:

* **API name:** `AgriSolar MCP DEV`
* **API identifier/audience:** `https://agrisolar-website.web.app/mcp`
* **Signing algorithm:** `RS256`
* **Permission/scope name:** `agrisolar:mcp`
* **Issuer:** copy the exact `issuer` value from
  `https://YOUR_AUTH0_DOMAIN/.well-known/openid-configuration`; retain its trailing slash
* **JWKS URL:** copy the exact `jwks_uri` value from the same discovery document
* **Client registration:** enable Auth0's supported MCP/third-party client-registration
  path (Client ID Metadata Document or dynamic client registration), or create the
  confidential ChatGPT client requested by the ChatGPT connection screen
* **Redirect URL:** copy the exact URL shown by ChatGPT when adding the connection; it
  has the form `https://chatgpt.com/connector/oauth/{callback_id}`. Do not invent the
  callback ID.

The values still requiring Aaron's authorized Auth0 action are the tenant domain/issuer,
JWKS URL, client-registration choice and resulting client ID, and exact ChatGPT redirect
URL. The audience and scope above are already fixed.

For Firebase Functions v2, place only the five non-secret `MCP_*` variables above in the
ignored `functions/.env.agrisolar-website` file, then deploy from the repository root:

```bash
chmod 600 functions/.env.agrisolar-website
npx --yes firebase-tools@15.26.0 deploy \
  --project agrisolar-website \
  --only functions:mcp,hosting
```

No OAuth client secret is consumed by the current MCP resource server, so do not create
or copy one into this repository. If a later reviewed server-side change genuinely needs
an Auth0 secret, bind it with Firebase Functions `defineSecret` first and create it
interactively with:

```bash
npx --yes firebase-tools@15.26.0 functions:secrets:set AUTH0_CLIENT_SECRET \
  --project agrisolar-website
```

Never put a client secret, access token, refresh token, private key, administrator token,
or password in `functions/.env.*`, GitHub variables/secrets, source code, release evidence,
or chat. Auth0 client credentials used directly by ChatGPT belong only in the provider
and ChatGPT connection screens.

`MCP_AUTH_AUDIENCE` must exactly match `MCP_RESOURCE_URL`. Issuer, audience, and JWKS
values must use HTTPS. These identifiers are not secrets, but environment files must
remain ignored and must never contain access tokens, refresh tokens, private keys, or
client secrets.

The OAuth provider must issue:

* `sub`: stable provider subject for the approved person/agent
* `aud`: `https://agrisolar-website.web.app/mcp`
* `scope`: includes `agrisolar:mcp`
* `exp`, `iat`, and `iss`
* Optional `agent_id` or `https://agrisolarllc.com/agent_id`

If an agent ID claim is absent, the server finds the active DEV agent record by exact
`externalSubject`. An explicit agent ID avoids scanning the small identity registry and
is preferred.

## Agent Identity Mapping

OAuth proves the external identity. AgriSolar authorization still requires a
server-controlled record at `agent_identities/{agentId}`:

```json
{
  "organizationId": "agrisolar",
  "displayName": "AgriSolar ChatGPT Work DEV agent",
  "externalSubject": "provider-issued-subject",
  "issuer": "https://YOUR-DEV-ISSUER.example",
  "environment": "DEV",
  "status": "active",
  "authorityLevel": 3,
  "capabilities": [
    "opportunity.read",
    "opportunity.create",
    "task.create",
    "analytics.read"
  ],
  "expiresAt": 0
}
```

Capabilities are an array because Realtime Database keys cannot contain periods. Client
security rules deny writes to this path. Provisioning, rotation, expiration, and
revocation must use a reviewed administrator/server process; this implementation does
not seed an identity automatically.

## Verification Sequence

After selecting and configuring the provider:

1. Confirm the provider discovery document, issuer, JWKS, PKCE, and `resource` support.
2. Add the exact ChatGPT redirect URI shown by the ChatGPT app-management screen to the
   provider allowlist. Do not guess a callback identifier.
3. Deploy only the DEV `mcp` function and Hosting rewrites.
4. Fetch the protected-resource metadata and verify the resource, issuer, and scope.
5. Use MCP Inspector with Streamable HTTP at the `/mcp` URL.
6. Verify missing, expired, wrong-audience, wrong-issuer, and insufficient-scope tokens
   are rejected.
7. Verify an authenticated but inactive/unmapped subject is rejected.
8. Initialize MCP, inspect all six tools, and call them with synthetic DEV data.
9. Confirm AI-created opportunity/task records are `pending_review` and audit events use
   source `MCP`.
10. Confirm duplicate and idempotent replays behave the same through REST and MCP.
11. Confirm no email/send/raw-database tool appears.

## Mandatory End-to-End Release Gate

Do not build, merge, or deploy unrelated features until both tests below pass through the
installed AgriSolar plugin in ChatGPT Work. Synthetic DEV records are required.

### Test 1 — authenticated read

Prompt ChatGPT Work to use AgriSolar to summarize the sales pipeline. Confirm it selects
`get_sales_pipeline`, completes OAuth as the approved DEV agent, returns calculated DEV
metrics, and writes a successful organization-scoped read audit event. Record the plugin
connection ID, timestamp, request ID, agent ID, and audit-event ID.

### Test 2 — confirmed candidate write and administrator decision

Provide one synthetic, publicly cited candidate and ask ChatGPT Work to add it to
AgriSolar. Confirm ChatGPT requests write approval, calls
`submit_opportunity_candidate`, creates exactly one `pending_review` opportunity with
`candidateSubmission.source: chatgpt_work`, and sends no email. In Admin → AI Review
Center, verify the source/evidence and approve the record. Record the confirmation,
request ID, opportunity ID, approval ID, audit-event IDs, and administrator UID. Remove
or clearly label the synthetic record after evidence is captured using a reviewed,
non-destructive process.

The milestone is not complete if either test uses a direct database write, an owner
credential as the agent, a locally forged token, or an MCP Inspector call in place of
ChatGPT Work. Inspector remains a prerequisite diagnostic only.

After both interactive ChatGPT Work tests and the administrator approval are complete,
record only non-secret IDs and outcomes in the ignored `.mcp-e2e-evidence.json` file and
run:

```bash
cp doc/mcp-e2e-evidence.template.json .mcp-e2e-evidence.json
npm run verify:mcp-release-gate
```

The validator fails closed unless both tools used the same installed ChatGPT connection,
the read has a request/agent/audit trail, the write was confirmed, the synthetic record
moved from `pending_review` to `approved`, approval and audit IDs are present, and no
email was sent. It also rejects evidence containing credential-like fields. This
mechanical evidence validation supplements—rather than replaces—the required interactive
ChatGPT Work tests.

## Connect to ChatGPT Developer Mode

Once MCP Inspector passes with the configured provider:

1. In ChatGPT, open **Settings → Security and login** and enable Developer Mode.
2. Open ChatGPT Plugins and add the stable DEV MCP URL.
3. Complete OAuth linking with the approved DEV identity.
4. Scan and review the six tool schemas and annotations.
5. Run direct, indirect, invalid-input, duplicate, out-of-scope, and no-send tests.
6. Copy the technical connection ID from the ChatGPT URL. It begins with
   `plugin_asdk_app`.

Do not create `.app.json` with a placeholder identifier. After ChatGPT creates the real
connection ID, use the repository's plugin-creation workflow to generate the plugin
manifest and local marketplace entry, then review both files before installation.

## Rollback and Revocation

To disable the MCP connection without changing the website:

1. Mark the relevant `agent_identities` record `revoked` or expired.
2. Revoke provider refresh/access tokens and the provider session.
3. Remove one or more MCP environment values and redeploy the `mcp` function; it will
   return `503 MCP_AUTH_NOT_CONFIGURED`.
4. Remove or disable the ChatGPT plugin connection.
5. Preserve audit records and existing business records for review.

Do not delete audit history to perform a rollback.

## Official References

* [Build an MCP server](https://developers.openai.com/plugins/build/mcp-server)
* [Authenticate MCP users](https://developers.openai.com/plugins/build/auth)
* [Package a plugin](https://developers.openai.com/plugins/build/plugins)
* [MCP safety and write-action confirmation](https://developers.openai.com/api/docs/mcp#non-prompt-injection-related-risks)
