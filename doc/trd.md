# AgriSolar Technical Requirements and Design

**Status:** DEV API and MCP protocol implemented; OAuth provider/ChatGPT connection pending
**Updated:** August 7, 2026
**Environment in scope:** Firebase development project `agrisolar-website`
**Product requirements:** [`prd.md`](prd.md)

## 1. Purpose and Decision Gate

This document translates the controlled API and MCP product requirements into a
technical design for the existing AgriSolar application. It does not authorize a major
refactor, production deployment, live Namecheap website change, DNS change, email-system
change, or production MCP connection.

The required sequence is:

1. Inspect the existing application.
2. Present this assessment and proposed design.
3. Resolve the open decisions and receive approval.
4. Implement the smallest DEV-only vertical slice.
5. Test with synthetic development records and restricted agent identities.
6. Request separate approval before any production connection.

### 1.1 Implementation Snapshot

Milestones 1, 2, and the first Milestone 4 administrator-review slice now have a tested
DEV implementation:

* One Firebase HTTPS function serves the five `/api/v1` operations.
* Firebase ID tokens are verified server-side and mapped to the owner or a revocable
  `agent_identities` record.
* Organization, environment, capability, and authority checks run before each action.
* New opportunity, task, identity, audit, idempotency, and rate-limit paths are
  server-written; browser security rules deny client writes.
* Opportunity creation includes source provenance, duplicate checks, bounded inputs,
  unreviewed AI state, and idempotent replay.
* Tests cover authentication, cross-organization denial, capabilities, validation,
  duplicates, idempotency, audit events, rules, Hosting rewrites, and existing admin
  regressions.
* The owner-only AI Review Center lists pending opportunities/tasks, separates sourced
  facts from AI provenance, shows sanitized agent/approval/audit state, and performs
  idempotent approve/reject decisions through the backend.
* Functions, Realtime Database, and Storage recognize the administrator by immutable
  Firebase UID rather than a mutable email address.

No external agent identity or business fixture has been inserted into Firebase. No MCP
OAuth provider, ChatGPT Work connection, or email-sending AI tool is enabled. The MCP
endpoint and five tools are implemented but fail closed until OAuth is configured. See
[`business-api.md`](business-api.md) and [`mcp-integration.md`](mcp-integration.md) for
the implemented contracts and activation gate.

## 2. Current Architecture Assessment

This section records the baseline that existed before the DEV API vertical slice. The
implementation snapshot above and the later milestone statuses describe subsequent work.

### 2.1 Frontend

The public site and administrator dashboard use static HTML, CSS, and vanilla browser
JavaScript. There is no React, Vue, Angular, or server-rendered frontend framework. The
Firebase Hosting build copies an allowlisted set of public assets into `dist/` through
`scripts/build-hosting.js`.

The administrator application lives under `admin/` and includes:

* Email/password administrator login and password reset
* Quote-request review, attachment viewing, and email replies
* Annual mowing schedule, list, calendar, history, and reviewed CSV import
* Prospect evidence, suppression, AI discovery, and outreach-draft workflows
* AI usage and estimated cost display

Several admin modules read and write Firebase Realtime Database directly from the
browser. Schedule creation, schedule updates, reviewed import, manual prospect creation,
suppression changes, and the AI off switch currently contain important workflow logic in
frontend JavaScript.

### 2.2 Backend

The backend uses Node.js 22 Firebase Functions v2 with CommonJS modules.

Current server functions are:

| Function | Trigger | Purpose |
| --- | --- | --- |
| `sendEmailOnNewContactSubmission` | Realtime Database create | Sends a notification for a new quote request |
| `sendReply` | HTTPS request | Sends an authenticated administrator reply through SMTP |
| `discoverProspects` | HTTPS request | Performs administrator-only OpenAI web research and saves usage/cost information |
| `draftOutreachEmail` | HTTPS request | Creates and stores an administrator-review outreach draft |

`functions/ai-outreach.js` contains OpenAI request construction, structured-output
schemas, public-source handling, and validation. `functions/ai-cost.js` contains the
versioned OpenAI pricing estimate logic.

At assessment time there was no versioned `/api/v1` router, shared business-service
layer, repository layer, MCP server, agent authentication, organization context,
capability evaluator, approval service, or centralized audit service.

### 2.3 Firebase Services

The project currently uses:

* Firebase Hosting
* Firebase Authentication with email/password
* Firebase Realtime Database, not Firestore
* Cloud Storage for quote-request attachments
* Firebase Functions v2
* Firebase/Google Secret Manager integration for backend secrets
* Local Hosting, Realtime Database, Storage, and Functions emulators

The architecture requirement frequently uses the generic term “Firestore/database.” For
this repository, the current persistence system is Realtime Database. This design does
not propose a Firestore migration. A future migration would require a separate evidence-
based decision and approval.

### 2.4 Authentication and Authorization

Human authentication uses Firebase email/password and browser Firebase ID tokens.
HTTPS administrator functions verify bearer tokens server-side. Realtime Database and
Storage rules restrict administrative access using one approved administrator email.

This is adequate for the present single-owner development dashboard but is not an
acceptable external-agent authorization model because it lacks:

* Organization memberships
* Roles and capabilities
* Independently revocable agent identities
* Environment-specific agent grants
* Resource-level and organization-level authorization
* Authority ceilings and approval requirements

No external agent should reuse the owner's Firebase credentials.

### 2.5 Current Realtime Database Paths

The current rules define these top-level paths:

| Path | Current use |
| --- | --- |
| `contact_submissions` | Public-created quote requests; administrator read/update |
| `companies` | Administrator-managed company records |
| `solar_sites` | Permanent solar-site records |
| `service_seasons` | Annual contract/service-season records |
| `scheduled_services` | Individual mowing-cycle records |
| `prospect_candidates` | Administrator-only researched prospects |
| `prospect_sources` | Public-source evidence associated with prospects |
| `suppression_entries` | Do-not-contact and suppression history |
| `outreach_drafts` | Server-created AI outreach drafts |
| `ai_usage` | Server-written AI request usage |
| `ai_cost_events` | Server-written estimated/confirmed AI costs |
| `ai_settings` | Administrator AI off switch |
| `email_recipients` | Administrator email-distribution recipients |

The repository does not yet contain normalized opportunity, task, organization,
membership, agent-identity, approval, or centralized audit records.

### 2.6 Storage and Email

Cloud Storage accepts bounded public quote attachments at randomized paths and permits
only the approved administrator to read them. Email delivery uses server-side SMTP. The
current AI outreach workflow creates drafts but does not expose an AI endpoint that sends
outreach email.

The live Namecheap website, domain, DNS, and email configuration remain out of scope for
the API/MCP milestone.

### 2.7 Existing Security Rules and Tests

Realtime Database and Storage default to denied access, with path-specific validation.
Rules tests cover public quote submission, attachment limits, private schedule data,
schedule completion precision, permanent history, prospect evidence, suppression,
server-only AI records, and administrator access. Browser tests cover admin schedule,
attachments, and outreach.

Firebase Admin SDK operations bypass Realtime Database security rules. Every new
server-side service must therefore enforce organization, capability, validation, and
business rules before using an Admin SDK repository.

### 2.8 Reusable Foundations Already Present

The following can support the new architecture without replacing the application:

* Firebase Functions HTTPS handlers and verified Firebase ID tokens
* Server-only Firebase Admin SDK access
* Managed backend secrets
* Default-deny database and storage rules
* Firebase emulator test infrastructure
* Stable generated database identifiers
* Existing prospect source/provenance records
* Structured OpenAI outputs and server-side result validation
* AI off switch, usage records, cost records, and no-send draft boundary
* Hosting allowlist that excludes source documents, functions, secrets, and tests

### 2.9 Risks and Technical Debt

The main blockers to safe external AI access are:

1. Authorization depends primarily on one email address.
2. There is no `organizationId` isolation model.
3. Important schedule and prospect mutation logic runs in browser modules.
4. No shared service layer protects business invariants across UI, API, and MCP.
5. No dedicated opportunity or task model exists.
6. No independently revocable agent identity or capability registry exists.
7. No centralized append-only audit or reusable approval workflow exists.
8. Existing HTTP functions use individual public URLs rather than a versioned API.
9. Mutation idempotency and per-agent rate limits are absent.
10. Duplicate detection exists as workflow guidance but not as a common server service.
11. Realtime Database Admin SDK writes are not protected by client security rules.
12. Development and future production agent credentials are not yet formally isolated.

These risks require a controlled backend foundation, not a frontend-only MCP wrapper.

## 3. Recommended Target Architecture

Keep the existing static frontend, Firebase Authentication, Realtime Database, Storage,
Functions, and Hosting. Add backend layers incrementally:

```text
Web admin / future mobile / scheduled job / approved AI client
                         |
              Firebase user token or agent access token
                         |
        +----------------+----------------+
        |                                 |
  /api/v1 HTTP router              Thin MCP adapter
        |                                 |
        +------------ Auth context -------+
                         |
       capability + organization + authority policy
                         |
               reusable business services
                         |
       validation / duplicate / approval / audit
                         |
              Realtime Database repositories
```

### 3.1 Architecture Decisions

* Keep Realtime Database for the first slice; do not introduce a parallel Firestore
  source of truth.
* Use Firebase Functions v2 HTTPS for the first versioned API because the project already
  deploys and tests Functions.
* Implement the API router, MCP adapter, and web handlers as thin transports around the
  same service functions.
* Permit only backend repositories to write the new opportunity, task, identity,
  approval, idempotency, and audit paths.
* Gradually move existing browser-only business mutations behind services when their
  domains are brought into the API. Do not block current schedule work on a full rewrite.
* Keep AI-provider adapters separate from business services.
* Deploy and test the first slice only in the `agrisolar-website` development project.

### 3.2 Proposed Backend Module Boundaries

The exact names may be adjusted during implementation, but responsibilities should remain
separate:

```text
functions/
  api/
    v1-router.js
    http-response.js
    errors.js
  mcp/
    server.js
    tool-registry.js
    opportunity-tools.js
  auth/
    authenticate.js
    authorization.js
    capabilities.js
    agent-identities.js
  services/
    opportunity-service.js
    task-service.js
    pipeline-service.js
    duplicate-service.js
    approval-service.js
    audit-service.js
    idempotency-service.js
  repositories/
    opportunity-repository.js
    task-repository.js
    identity-repository.js
    approval-repository.js
    audit-repository.js
  validation/
    opportunity-schemas.js
    task-schemas.js
    common-schemas.js
  ai/
    provider-adapters.js
  index.js
```

Transport modules parse requests and serialize results. Services own business rules.
Repositories own database path operations. Authorization is called before service data
is returned or mutated. The MCP adapter may call services in-process; it must not copy
validation, duplicate, authorization, or audit logic.

## 4. Authentication Design

### 4.1 Human Users

Continue accepting Firebase ID tokens for the existing administrator and future human
users. Convert a verified token into an internal auth context containing:

```json
{
  "actorType": "USER",
  "actorId": "firebase-uid",
  "organizationId": "agrisolar",
  "roles": ["OWNER"],
  "capabilities": ["..."],
  "authorityLevel": 4,
  "environment": "DEV"
}
```

The example is conceptual. Capabilities must come from an approved server-side
membership/grant, not from arbitrary request data.

### 4.2 External Agents

Each external agent must authenticate as its own subject. The production-compatible
design should use short-lived OAuth 2.1/OIDC access tokens with audience, issuer,
expiration, and signature validation. ChatGPT custom-app compatibility and the selected
authorization server must be confirmed during the approval/design spike before coding.

For the DEV vertical slice, use the smallest provider-neutral mechanism that still gives
each agent a short-lived, independently revocable identity. Do not use a shared owner
password, put a static secret in browser code, or treat possession of a generic API key
as authorization.

An authenticated agent subject maps to a server-controlled `agent_identities` record.
Tokens do not get to add their own capabilities or organization.

### 4.3 Required Token Checks

Validate at minimum:

* Cryptographic signature
* Trusted issuer
* Intended API/MCP audience
* Expiration and not-before times
* Subject/agent identity
* Environment
* Revocation/disabled state
* Organization grant

Authentication failures return `UNAUTHORIZED`. An authenticated identity without an
applicable capability returns `FORBIDDEN`.

## 5. Authorization and Capability Model

Authorization evaluates all of the following:

```text
identity is active
AND identity environment matches the deployment
AND requested organization matches the identity grant
AND required capability is present
AND requested record belongs to that organization
AND authority level permits the operation
AND required approval exists when applicable
```

Roles are templates for human administration. Effective capabilities are explicit and
may only reduce, not exceed, the actor's approved role/agent grant.

Initial capability mapping:

| Operation | Capability | Authority |
| --- | --- | --- |
| Search/open opportunity | `opportunity.read` | 1 READ |
| Create unreviewed opportunity | `opportunity.create` | 3 INTERNAL ACTION |
| Search tasks | `task.read` | 1 READ |
| Create internal task | `task.create` | 3 INTERNAL ACTION |
| Retrieve pipeline | `analytics.read` | 1 READ |
| Draft outreach | `communication.draft` | 2 DRAFT |
| Send outreach | `communication.send` plus approval | 4 EXTERNAL ACTION |

The initial agent does not receive `communication.send`, `proposal.approve`, contract
mutation, user administration, or payment capabilities.

## 6. Agent Identity Schema

Proposed `agent_identities/{agentId}` record:

```json
{
  "organizationId": "agrisolar",
  "displayName": "AgriSolar DEV business development agent",
  "externalSubject": "provider-issued-subject",
  "issuer": "approved-issuer",
  "environment": "DEV",
  "status": "active",
  "authorityLevel": 3,
  "capabilities": [
    "opportunity.read",
    "opportunity.create",
    "task.create",
    "analytics.read"
  ],
  "expiresAt": 0,
  "createdAt": 0,
  "createdByActorId": "...",
  "updatedAt": 0,
  "revokedAt": null
}
```

Capabilities are stored as an array because Realtime Database keys cannot contain the
periods used in capability names. Store credential secrets in managed secret/identity
infrastructure, not in this record.
Only a privileged identity-management service may write agent records. Rotation should
replace credentials without changing audit history for the logical agent ID.

## 7. Organization and Membership Schemas

Proposed records:

```text
organizations/{organizationId}
organization_memberships/{organizationId}/{userId}
agent_identities/{agentId}
```

`organizations` stores stable business identity and environment-safe configuration.
`organization_memberships` stores status, role templates, explicit capability grants or
denials, and authority ceiling. Existing business paths need a reviewed migration plan
before making `organizationId` required because current records do not contain it.

All new opportunity/task records must include `organizationId` from their creation. The
caller cannot choose an organization outside its auth context.

## 8. Opportunity and Task Schemas

### 8.1 Opportunity

Proposed `opportunities/{opportunityId}` shape:

```json
{
  "organizationId": "agrisolar",
  "companyId": "company-id-or-null",
  "siteId": "site-id-or-null",
  "primaryContactId": "contact-id-or-null",
  "companyNameSnapshot": "Example Solar Company",
  "siteNameSnapshot": "Example Solar Project",
  "address": "",
  "city": "",
  "state": "IL",
  "estimatedAcreage": 60,
  "opportunityType": "vegetation_management",
  "status": "NEW",
  "priority": "high",
  "qualified": false,
  "contacted": false,
  "estimatedContractValue": null,
  "bidDeadlineOn": null,
  "nextAction": "Verify project operator",
  "notes": "",
  "source": {
    "type": "public_web",
    "title": "",
    "url": "https://example.com/project",
    "retrievedAt": 0
  },
  "aiProvenance": {
    "aiGenerated": true,
    "agentId": "agrisolar-research-agent",
    "model": "provider/model-or-null",
    "schemaVersion": "opportunity-create-v1",
    "confidence": 0.82,
    "researchSummary": ""
  },
  "reviewStatus": "pending_review",
  "reviewedByActorId": null,
  "reviewedAt": null,
  "createdAt": 0,
  "createdByActorType": "AI_AGENT",
  "createdByActorId": "...",
  "updatedAt": 0,
  "updatedByActorId": "..."
}
```

Do not store literal `null` values where Realtime Database deletion semantics make them
ambiguous; the implementation schema may omit optional properties while preserving the
same conceptual model.

### 8.2 Opportunity Status History

Use append-only `opportunity_status_events/{opportunityId}/{eventId}` records containing
organization, from/to status, actor, reason, timestamp, request ID, and approval ID when
applicable.

### 8.3 Task

Proposed `tasks/{taskId}` shape:

```json
{
  "organizationId": "agrisolar",
  "title": "Follow up with Example Solar Company",
  "description": "",
  "priority": "normal",
  "status": "open",
  "dueOn": "2026-08-10",
  "ownerUserId": null,
  "relatedEntityType": "opportunity",
  "relatedEntityId": "opportunity-id",
  "source": "AI_AGENT",
  "aiReasoning": "Deadline is within two weeks.",
  "reviewStatus": "pending_review",
  "createdAt": 0,
  "createdByActorType": "AI_AGENT",
  "createdByActorId": "...",
  "updatedAt": 0
}
```

Validate related entity type and confirm the entity exists in the same organization.

## 9. Approval Workflow Design

Proposed `approval_requests/{approvalId}` shape:

```json
{
  "organizationId": "agrisolar",
  "actionType": "communication.send",
  "status": "pending",
  "riskLevel": 4,
  "requestedByActorType": "AI_AGENT",
  "requestedByActorId": "...",
  "requestedAt": 0,
  "payloadRef": "approval_payloads/approval-id",
  "payloadDigest": "sha256:...",
  "relatedEntityType": "opportunity",
  "relatedEntityId": "...",
  "expiresAt": 0,
  "approverActorId": null,
  "approvedAt": null,
  "executedAt": null,
  "executionStatus": "pending",
  "resultCode": null
}
```

Approval payloads must be bounded and validated. After approval, execute the exact
approved payload or require reapproval if it changes. Approving and executing must be
separate auditable events. The initial five-tool slice has no external-send operation,
but the reusable model should be introduced before Level 4 tools.

## 10. Audit Model

Use server-written append-only `audit_events/{eventId}` records. Client rules deny all
direct writes and deletes. Each event includes:

```json
{
  "organizationId": "agrisolar",
  "occurredAt": 0,
  "actorType": "AI_AGENT",
  "actorId": "...",
  "action": "opportunity.create",
  "entityType": "opportunity",
  "entityId": "...",
  "source": "MCP",
  "requestId": "...",
  "approvalId": null,
  "modelOrAgent": "agrisolar-research-agent",
  "before": null,
  "after": { "bounded": "change summary" },
  "result": "success",
  "errorCode": null,
  "client": { "ipHashOrPrefix": "when appropriate" }
}
```

Audit logging is part of the mutation transaction/operation contract. A mutation must
not report success when its required audit event failed. Full secrets, bearer tokens,
private prompt bodies, and unnecessary personal information must never be logged.

Realtime Database cannot provide cryptographic immutability by itself. “Immutable-style”
means server-only append, no normal update/delete path, restrictive IAM/rules, monitoring,
and optional future export to retention-controlled logging/storage.

## 11. Idempotency, Duplicate Detection, and Rate Limits

### 11.1 Idempotency

`POST /opportunities` and `POST /tasks` require or strongly encourage an
`Idempotency-Key`. Store a bounded request digest and result reference under an
organization/actor-scoped server-only path. Replaying the same key and digest returns the
original result. Reusing the key with another digest returns `CONFLICT`.

### 11.2 Duplicate Detection

The duplicate service returns exact and likely matches before creation. Initial
opportunity checks should use normalized company/domain, site/project name, address,
linked site/customer, opportunity type, and approximate bid period. A strong match
returns `DUPLICATE_FOUND` with permitted candidate summaries. Do not expose records from
another organization.

### 11.3 Rate Limiting

Apply conservative DEV defaults per agent and organization for reads, searches, and
mutations. Enforce a maximum search limit and payload size. A mutation loop must stop
with `RATE_LIMITED`, and later bulk tools must require a preview, maximum batch size, and
approval where required.

Exact thresholds should be configuration with tested safe defaults, not client-provided
values.

## 12. API Design

### 12.1 First Endpoints

| Method and route | Business service | Capability |
| --- | --- | --- |
| `GET /api/v1/opportunities` | Search opportunities | `opportunity.read` |
| `GET /api/v1/opportunities/{opportunityId}` | Get one opportunity | `opportunity.read` |
| `POST /api/v1/opportunities` | Create unreviewed opportunity | `opportunity.create` |
| `POST /api/v1/tasks` | Create internal task | `task.create` |
| `GET /api/v1/analytics/sales-pipeline` | Summarize pipeline | `analytics.read` |

### 12.2 Common Request Context

The transport assigns a `requestId` and builds organization/actor context from the
verified identity. Do not accept effective capabilities, actor IDs, review state, or
organization authority from request bodies.

Search endpoints accept bounded filters and opaque cursor pagination. Mutation
endpoints validate `Content-Type`, payload bytes, schemas, relationships, idempotency,
duplicates, and capability before writing.

### 12.3 Response Envelope

Success:

```json
{
  "requestId": "req_...",
  "data": {},
  "page": {
    "nextCursor": null
  }
}
```

Error:

```json
{
  "requestId": "req_...",
  "error": {
    "code": "VALIDATION_ERROR",
    "message": "One or more fields are invalid.",
    "details": [
      { "field": "state", "issue": "Use a two-letter state code." }
    ]
  }
}
```

Do not return stack traces, database paths, secret names, token details, or internal
implementation errors.

## 13. First Five Tool Schemas

The following are conceptual version-1 contracts. Implementation must convert them to
strict machine-readable schemas and add tested maximum lengths and enumerations.

### 13.1 `search_opportunities`

Use when the caller needs to find known opportunities or determine whether a researched
site/company is already known.

Input:

```json
{
  "status": ["QUALIFIED"],
  "state": "IL",
  "city": "",
  "minimumAcreage": 50,
  "maximumAcreage": null,
  "minimumEstimatedValue": null,
  "maximumEstimatedValue": null,
  "company": "",
  "site": "",
  "deadlineFrom": null,
  "deadlineTo": null,
  "contacted": false,
  "qualified": true,
  "priority": ["high"],
  "keyword": "",
  "limit": 25,
  "cursor": null
}
```

Output items contain only `opportunityId`, `siteName`, `company`, authorized location,
acreage, status, estimated value, score, bid deadline, priority, and next action, plus an
opaque next cursor.

### 13.2 `get_opportunity`

Use after search when the caller needs an authorized full working view.

Input: `{ "opportunityId": "..." }`.

Output contains the opportunity, associated company/contact/site summaries, notes,
qualification analysis, communications summary, open tasks, proposal summary, important
deadlines, and recommended next action. Each nested resource is permission-filtered.

### 13.3 `create_opportunity`

Use only for a legitimate researched business opportunity. The service searches for
duplicates before creating it.

Input supports:

```json
{
  "company": { "companyId": null, "name": "", "domain": "" },
  "site": { "siteId": null, "name": "", "address": "", "city": "", "state": "IL" },
  "estimatedAcreage": null,
  "projectDetails": "",
  "opportunityType": "vegetation_management",
  "estimatedContractValue": null,
  "deadlineOn": null,
  "contact": { "contactId": null, "name": "", "email": "" },
  "source": { "type": "public_web", "title": "", "url": "https://...", "retrievedAt": 0 },
  "notes": "",
  "aiResearch": { "summary": "", "confidence": null, "model": null },
  "idempotencyKey": "..."
}
```

Output is either a created unreviewed opportunity summary or `DUPLICATE_FOUND` with
authorized likely matches. The service owns actor/provenance/audit fields.

### 13.4 `create_task`

Use for an internal follow-up or operational task associated with an authorized entity.

Input supports title, description, `low|normal|high|urgent` priority, due date, optional
owner, related entity type and ID, source, optional AI recommendation, and idempotency
key. Output contains the created task and audit request ID.

### 13.5 `get_sales_pipeline`

Use for an authorized summary of current business development.

Input supports optional as-of date, state, owner, and other bounded pipeline filters.
Output contains total opportunities, pipeline value, stage totals, 7-day and 30-day
deadlines, overdue follow-ups, and a small bounded list of high-priority opportunities.
All calculations come from organization-scoped records; no totals are hard-coded.

## 14. MCP Architecture

Implement a thin MCP-compatible adapter only after the service/API foundation is tested.
The initial registered tools are:

* `search_opportunities`
* `get_opportunity`
* `create_opportunity`
* `submit_opportunity_candidate`
* `create_task`
* `get_sales_pipeline`

Each tool definition includes:

* Guidance describing when the agent should use it
* Strict typed input and output schemas
* Required capability and authority level
* Validation and bounded results
* Audit behavior
* Stable recoverable errors

The adapter authenticates the MCP client, creates the same auth context used by the API,
and invokes the same services. It must never expose a raw database query/update tool and
must not contain independent duplicate, approval, or status-transition logic.

The initial MCP adapter excludes email sending. Future external-action tools must pass
through the reusable approval service.

### 14.1 Shared candidate submission service

`submit_opportunity_candidate` and `POST /api/v1/opportunity-candidates` call the same
business operation used by controlled opportunity creation. The operation forces
`reviewStatus: pending_review`, applies duplicate and idempotency checks, writes an audit
event, and records `candidateSubmission.source` as `chatgpt_work`, `outreach_api`,
`manual`, or `import`.

The Outreach browser no longer directly creates new records under
`prospect_candidates`; that path remains temporarily available only for legacy records
and the existing reviewed email-draft workflow. New submissions appear in the AI Review
Center. A later migration slice may retire the legacy paths after approved opportunities
can participate fully in the outreach-draft workflow.

## 15. Observability

Every API/MCP request receives a request ID shared by structured application logs and the
audit event. Record safe metrics for route/tool, status code, duration, actor type, agent
ID, organization, error code, and rate-limit outcome. Do not put secrets, access tokens,
full private prompts, or unnecessary record content in logs.

Required operational queries include:

* Actions performed by an AI agent during a time range
* AI-created records awaiting review
* Failed AI/API operations and their safe error codes
* Pending and expired approvals
* Rate-limit and authorization failures

## 16. Security Rules and Server Protections

New backend-owned paths should deny browser writes. Approved web features should call
the service API rather than receiving direct write access to these records. Client rules
remain defense in depth for permitted reads, while the Admin SDK service enforces all
authorization itself.

At minimum:

* Default deny new paths.
* Deny public and ordinary authenticated reads.
* Deny client writes to agent identities, idempotency records, audit events, approval
  execution state, and server-derived analytics.
* Validate shape and ownership for any intentionally client-readable record.
* Use separate secrets and identities per environment.
* Add rate and payload bounds at the HTTP/MCP transport.
* Verify `.env`, `.secret.local`, service accounts, and credentials remain ignored and
  absent from Hosting output.

## 17. Required Database Additions

The proposed first-slice paths are:

```text
organizations
organization_memberships
agent_identities
opportunities
opportunity_status_events
tasks
audit_events
idempotency_records
rate_limit_counters
```

`approval_requests` and optional protected approval payloads should be designed in the
foundation and may be implemented before the first Level 4 operation. Future normalized
contacts and communications must link to existing company/site identities rather than
creating a competing source of truth.

Existing records need a separate reviewed organization migration. Do not bulk-edit live
or development business records merely by adopting this document.

## 18. Files and Modules Likely to Change

Foundation implementation will likely affect:

* `functions/index.js` for API and MCP function exports
* New `functions/api/`, `functions/mcp/`, `functions/auth/`, `functions/services/`,
  `functions/repositories/`, and `functions/validation/` modules
* `database.rules.json` for new default-deny/backend-owned paths and safe indexes
* `firebase.json` only if new local emulator or routing configuration is required
* `test/` for API, capability, organization-isolation, audit, duplicate, idempotency,
  MCP contract, and negative security tests
* `doc/` for API, MCP, authorization, deployment, rollback, and operational runbooks

The public site and current annual schedule UI need no disruptive rewrite for the first
backend vertical slice.

## 19. Testing Strategy

Use synthetic organizations, agents, companies, contacts, sites, opportunities, and
tasks. Tests must cover:

* Valid and invalid authentication
* Missing, expired, revoked, wrong-audience, and wrong-environment agent tokens
* Capability allow and deny cases
* Cross-organization read and mutation denial
* Read-only and authority-level restrictions
* Input size, type, relationship, URL, date, and status validation
* Duplicate exact and likely matches
* Idempotent replay and conflicting key reuse
* Audit event success and mutation failure when required audit persistence fails
* Rate-limit enforcement
* MCP schema and API/MCP service parity
* An agent with `task.create` attempting contract mutation and receiving `FORBIDDEN`
* No first-version route or tool sending email

Run unit tests without real OpenAI calls and integration tests against Firebase
emulators. Test credentials must be DEV-only and revocable.

## 20. Delivery Milestones

### Milestone 0 — Assessment and Decisions

Review this assessment, confirm the organization identifier, choose the DEV agent token
issuer/flow, confirm opportunity status vocabulary, and approve the first-slice scope.
No MCP implementation begins before this review.

### Milestone 1 — Security and Service Foundation — Implemented in DEV

Add auth context, organization membership, capabilities, agent identity mapping, common
errors, validation, repositories, audit service, idempotency, and negative tests. Seed
only synthetic DEV identities/data through a controlled fixture process.

### Milestone 2 — Versioned API Vertical Slice — Implemented in DEV

Implement the five `/api/v1` endpoints through opportunity, task, duplicate, and pipeline
services. Confirm organization isolation, rate limits, provenance, and audit behavior.

### Milestone 3 — Thin MCP Adapter — Protocol Implemented; Provider Connection Pending

The five Streamable HTTP tools, shared-service mapping, OAuth resource-server boundary,
OIDC verification, safety annotations, and protocol contract tests are implemented. The
endpoint remains disabled until an established DEV OAuth provider and reviewed agent
identity are configured. Only then may an approved DEV client be connected.

### Milestone 4 — Admin Review Experience — Initial Slice Implemented in DEV

The administrator-only review center now shows AI-created opportunities/tasks, review
state, source and model provenance, linked audit history, sanitized agent status, and
pending approvals. Approve/reject operations are owner-only backend mutations with
organization checks, idempotency, retained rejection history, and atomic approval/audit
records. Future slices may add richer record editing and proposal/document review, but
no external sending or execution is enabled.

### Milestone 5 — Future Controlled Actions

Add draft-only proposal, document, and communication tools. External sending or contract
actions remain disabled until a separately reviewed approval workflow, compliance gate,
and production authorization are complete.

## 21. Smallest Recommended Working Slice

The smallest useful slice is one DEV organization, one independently revocable DEV agent,
the four minimum capabilities (`opportunity.read`, `opportunity.create`, `task.create`,
and `analytics.read`), the five requested operations, server-only writes, duplicate
checks, idempotent mutations, and append-only audit events.

Use a small synthetic data set to prove:

1. The agent can search qualified opportunities.
2. The agent can open one permitted opportunity.
3. The agent can create one internal follow-up task.
4. The agent can submit researched source-backed opportunity data.
5. A duplicate is returned rather than recreated.
6. The agent can retrieve an organization-scoped pipeline.
7. Cross-organization access and ungranted actions are denied.
8. Every successful or failed important action has a request ID and audit trail.

This slice can be built alongside the current website because it adds backend modules and
new protected data paths. It does not require changing the public pages, Namecheap,
production DNS/email, or the existing annual schedule interface.

## 22. Documentation Required Before Production

Before any production API/MCP activation, maintain reviewed documentation for:

1. Architecture and data flow
2. Versioned API and error contracts
3. MCP tools and tool descriptions
4. Human and agent authentication
5. Authorization, roles, and capabilities
6. Agent identity creation, expiration, rotation, and revocation
7. Approval and audit models
8. Adding a new business service, API route, and MCP tool
9. Environment and secret setup
10. Local/emulator testing
11. Deployment and post-deployment verification
12. Rollback and credential revocation

## 23. Remaining Decisions Before MCP Connection

The DEV API uses organization ID `agrisolar`, creates AI tasks as `pending_review`, uses
the documented status/priority enumerations, and applies safe default per-agent rate
limits. The following decisions remain before Milestone 3 or any production activation:

* OAuth/OIDC authorization server and token flow for the DEV ChatGPT/MCP client
* Retention period and export policy for audit events
* Whether `task.read` is also required by the first agent; it is described in the PRD's
  example grant but not required by the minimum four-capability vertical slice
* Migration and eventual retirement plan for legacy `prospect_candidates`; new
  candidate creation now uses reviewed `opportunities`
* The controlled process for creating, rotating, expiring, and revoking the first DEV
  external-agent identity

Until these decisions are approved, do not connect ChatGPT Work or another external MCP
client and do not enable production API access. Existing public and administrator
workflows may continue using the tested DEV application.
