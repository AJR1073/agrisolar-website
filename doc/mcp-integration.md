# AgriSolar ChatGPT Work MCP Integration

**Status:** DEV MCP protocol implemented; OAuth provider and ChatGPT connection pending
**Endpoint:** `https://agrisolar-website.web.app/mcp`
**Protected-resource metadata:**
`https://agrisolar-website.web.app/.well-known/oauth-protected-resource`

## Current Safety State

The MCP adapter implements Streamable HTTP and exposes exactly five private business
tools:

* `search_opportunities`
* `get_opportunity`
* `create_opportunity`
* `create_task`
* `get_sales_pipeline`

The endpoint fails closed with `503 MCP_AUTH_NOT_CONFIGURED` until an approved OAuth 2.1
provider is configured. It does not accept custom API keys, Firebase owner passwords,
anonymous access, or unverified bearer tokens.

There is no email-sending, contract-changing, invoicing, payment, scheduling, raw
database, or production-system tool. Creation tools add internal DEV records marked for
administrator review.

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

## DEV OAuth Values

Configure these non-secret runtime values for the `mcp` Firebase function:

```dotenv
MCP_RESOURCE_URL=https://agrisolar-website.web.app/mcp
MCP_AUTH_AUDIENCE=https://agrisolar-website.web.app/mcp
MCP_AUTH_ISSUER=https://YOUR-DEV-ISSUER.example
MCP_AUTH_JWKS_URL=https://YOUR-DEV-ISSUER.example/.well-known/jwks.json
MCP_AUTH_SCOPE=agrisolar:mcp
```

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
8. Initialize MCP, inspect all five tools, and call them with synthetic DEV data.
9. Confirm AI-created opportunity/task records are `pending_review` and audit events use
   source `MCP`.
10. Confirm duplicate and idempotent replays behave the same through REST and MCP.
11. Confirm no email/send/raw-database tool appears.

## Connect to ChatGPT Developer Mode

Once MCP Inspector passes with the configured provider:

1. In ChatGPT, open **Settings → Security and login** and enable Developer Mode.
2. Open ChatGPT Plugins and add the stable DEV MCP URL.
3. Complete OAuth linking with the approved DEV identity.
4. Scan and review the five tool schemas and annotations.
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
