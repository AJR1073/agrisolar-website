# AgriSolar DEV Business API

**Status:** Implemented and emulator-tested  
**Environment:** Firebase development project `agrisolar-website`  
**Version:** `/api/v1`

## Purpose

This API is the controlled backend boundary for future AgriSolar automation and a later
ChatGPT Work MCP adapter. It currently supports organization-scoped opportunity and task
work. It does not expose email sending, contract changes, invoicing, payments, or direct
database access.

The public website and existing administrator workflows continue to operate as before.
No external AI client is connected merely by deploying these routes.

## Base URL

After DEV deployment, use the same-origin Hosting prefix:

```text
https://agrisolar-website.web.app/api/v1
```

The Functions emulator exposes the API through local Hosting at:

```text
http://127.0.0.1:5100/api/v1
```

## Authentication and Authorization

Every request requires a Firebase bearer token:

```http
Authorization: Bearer <Firebase ID token>
```

The approved owner token is matched by immutable Firebase UID (or an explicit reviewed
`admin: true` custom claim) and receives the administrative API permissions. Email
address alone never grants API access. Other
tokens must map to an active server-controlled record at
`agent_identities/{agentId}`. The record fixes the organization, environment, authority
level, capabilities, external subject, status, and optional expiration.

Agent capabilities are stored as an array because Realtime Database keys cannot contain
periods. `externalSubject` is mandatory and exact; an identity with `issuer` is also
bound to the verified token issuer:

```json
{
  "organizationId": "agrisolar",
  "externalSubject": "provider-issued-subject",
  "issuer": "https://approved-issuer.example/",
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

These records are server-written. Do not place access tokens or secrets in this record,
source control, browser code, or request bodies.

## Common Behavior

Successful responses contain a generated request ID and data:

```json
{
  "requestId": "7bd7c7f0-7a6d-4f45-a83f-08ca36ed1799",
  "data": {}
}
```

Errors use a stable code and safe message:

```json
{
  "requestId": "7bd7c7f0-7a6d-4f45-a83f-08ca36ed1799",
  "error": {
    "code": "FORBIDDEN",
    "message": "The requested action is not permitted."
  }
}
```

Mutation requests must use `Content-Type: application/json`, stay at or below 64 KiB,
and provide an idempotency key of 8–128 safe characters:

```http
Idempotency-Key: research-run-2026-08-07-001
```

The same key and body replay the original result. Reusing a key with a different body
returns `CONFLICT`. Read and mutation requests are rate-limited per identity.

## Routes

| Method and route | Capability | Authority | Result |
| --- | --- | --- | --- |
| `GET /opportunities` | `opportunity.read` | 1 | Bounded summaries and next cursor |
| `GET /opportunities/{id}` | `opportunity.read` | 1 | Organization-scoped working view |
| `POST /opportunities` | `opportunity.create` | 3 | New opportunity or duplicate candidates |
| `POST /opportunity-candidates` | `opportunity.create` | 3 | Source-backed opportunity forced into protected administrator review |
| `POST /tasks` | `task.create` | 3 | Internal task associated with an authorized record |
| `GET /analytics/sales-pipeline` | `analytics.read` | 1 | Calculated pipeline metrics |
| `GET /admin/review-center` | `opportunity.update` + owner USER | 4 | Protected review queue, sanitized agents, approvals, and audit events |
| `POST /admin/reviews` | `opportunity.update` + owner USER | 4 | Idempotent opportunity/task approval or rejection |

### Search opportunities

Supported query parameters include `status`, `state`, `city`, `company`, `site`,
`keyword`, `priority`, acreage/value bounds, deadline bounds, `contacted`, `qualified`,
`limit`, and `cursor`. Comma-separate status or priority values. `limit` must be 1–50.

Example:

```text
GET /api/v1/opportunities?state=IL&minimumAcreage=50&status=NEW,QUALIFIED&limit=25
```

### Get an opportunity

```text
GET /api/v1/opportunities/{opportunityId}
```

The route returns only an opportunity in the caller's organization. Linked company and
site records are returned only when they carry the same `organizationId`.

### Create an opportunity

```json
{
  "company": {
    "name": "Synthetic Solar Operations",
    "domain": "synthetic.example"
  },
  "site": {
    "name": "Synthetic Prairie Solar",
    "address": "100 Test Road",
    "city": "Example City",
    "state": "IL"
  },
  "estimatedAcreage": 75,
  "projectDetails": "Synthetic test opportunity for vegetation management.",
  "opportunityType": "vegetation_management",
  "estimatedContractValue": 125000,
  "deadlineOn": "2026-08-20",
  "source": {
    "type": "public_web",
    "title": "Synthetic public project page",
    "url": "https://synthetic.example/project",
    "retrievedAt": 1786078800000
  },
  "contact": {
    "name": "Test Operations Contact",
    "email": "operations@synthetic.example"
  },
  "aiResearch": {
    "summary": "Synthetic evidence indicates a possible vegetation-management need.",
    "confidence": 0.8,
    "model": "approved-model-name"
  },
  "priority": "high",
  "nextAction": "Verify the bid contact."
}
```

AI-created opportunities are saved as `pending_review`; the caller cannot override the
organization, actor, status, review state, timestamps, or audit provenance. Source URL,
company/site combinations, and addresses are checked for likely duplicates before a
new record is created. Linked company or site IDs must already belong to the same
organization.

### Submit an opportunity candidate

`POST /api/v1/opportunity-candidates` accepts the same bounded opportunity fields and
requires an `Idempotency-Key`. It always creates a `pending_review` record, including
when the approved administrator submits it from the Outreach screen. `candidateSource`
must be `chatgpt_work`, `outreach_api`, `manual`, or `import`.

The service records the submission source, actor, timestamp, and a server-generated
duplicate-check key in `candidateSubmission`. It reuses the same validation, duplicate
detection, organization checks, idempotency, and audit transaction as opportunity
creation. It has no email or other external side effect.

### Create a task

```json
{
  "title": "Verify the bid contact",
  "description": "Review the public source and confirm the correct contact.",
  "priority": "high",
  "dueOn": "2026-08-10",
  "relatedEntityType": "opportunity",
  "relatedEntityId": "generated-opportunity-id",
  "source": "AI_AGENT",
  "aiReasoning": "The bid deadline is approaching."
}
```

Current related entity types are `opportunity`, `company`, and `site`, and the referenced
record must belong to the caller's organization. AI-created tasks are `pending_review`.

### Get sales pipeline

```text
GET /api/v1/analytics/sales-pipeline?state=IL
```

Metrics are calculated from organization-scoped approved/reviewed opportunity and task
records. Pending and rejected opportunity candidates do not affect pipeline totals. The
metrics include stage counts, pipeline value, approaching bid deadlines, overdue follow-ups,
and up to five high-priority opportunities.

### Administrator review center

```text
GET /api/v1/admin/review-center?status=all&limit=100
```

`status` accepts `pending_review`, `approved`, `rejected`, or `all`; `limit` accepts
1–100. Results are organization-scoped and include reviewable opportunities and tasks,
sanitized agent status/capabilities, approval records, and recent audit events. Agent
subjects and credentials are never returned.

Review a pending record through the service rather than writing to Realtime Database:

```json
{
  "entityType": "opportunity",
  "entityId": "generated-opportunity-id",
  "decision": "approve",
  "reason": "Reviewed the cited source and verified the business facts."
}
```

Send the body to `POST /api/v1/admin/reviews` with an `Idempotency-Key`. Rejection
requires a reason. Only `pending_review` records can transition, rejected records are
retained, and the record update, approval record, audit event, and idempotency record are
written together. These routes are not MCP tools and have no email or external side
effect.

## Data and Security Boundaries

The browser rules deny writes to `organizations`, `agent_identities`, `opportunities`,
`tasks`, `approval_requests`, `audit_events`, `idempotency_records`, and
`rate_limit_counters`. Only backend services can mutate these paths. Audit records are
created for successful reads/mutations and important failed authorized actions.

The first API version intentionally has no route that sends email. Existing SMTP and AI
draft functions are separate administrator-only workflows.

## Local Verification

Run the self-contained unit suite:

```bash
npm test
```

Run the complete unit, rules, browser, and emulator suite:

```bash
env -u DEBUG npm run test:full
```

Tests use synthetic records and must not call OpenAI or send email.

## ChatGPT Work MCP Status

The thin remote MCP adapter now calls these same business operations and exposes five
narrowly described tools over Streamable HTTP. Protocol, OAuth-boundary, cryptographic
OIDC, tool-contract, validation, and no-send tests are implemented. The endpoint fails
closed until a DEV OAuth/OIDC provider and reviewed agent identity are configured.

See [`mcp-integration.md`](mcp-integration.md) for the provider requirements, activation
sequence, MCP Inspector checks, ChatGPT Developer Mode registration, and rollback plan.
