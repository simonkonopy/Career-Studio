# Career Studio engineering handoff

Status: September 9, 2026 · package version 0.1.0 · independent pilot foundation.

This guide is written for the engineer receiving the new product repository. Paths below are relative to that repository root. Read [README](../README.md) for the customer journey and [Operations](OPERATIONS.md) for deployment, recovery, privacy, and source requirements. The accompanying pitch deck explains the product and sales hypotheses; this guide records what the implementation actually does and what must happen next.

The repository entry point is [HANDOFF.md](../HANDOFF.md). Use [SaaS business and release plan](SAAS_BUSINESS_PLAN.md) for API setup, billing, pilot economics, and end-user delivery, and [Security instructions](SECURITY.md) for inspected controls, required hardening, verification, and incident response.

Read [Design handoff](DESIGN_HANDOFF.md) before changing the interface or deck. It preserves Fable’s 29-slide theme, the current dashboard styling, editable workflow diagrams, and reusable artwork in `docs/design/`. The latest deck already includes the any-skill interview and its updated demo screenshots.

## The accepted plan

Build a career workspace that turns a person's experience into a detailed, reviewed profile, useful resumes, explained job assessments, and a durable application tracker. Start with a controlled, unpaid pilot. Measure customer usefulness and operating costs before introducing paid plans.

The operator supplies an OpenAI API key on the server. Customers do not supply an API key or need a ChatGPT subscription. AI allowances are included in the product experience. Personal ChatGPT access is a future delivery option, not a launch dependency or a working feature. [Customer subscription delivery](CUSTOMER_SUBSCRIPTION_DELIVERY.md) now specifies a ChatGPT plugin with our own OAuth/MCP services and a separate local-companion research track. Earlier design notes about a subscription harness were superseded by this staged plan.

If subscription linking is revisited, first verify the then-current official authentication, embedding, commercial-use, and production-support position with the provider. A ChatGPT subscription is not interchangeable with general API credits. Do not create a cosmetic connect button, collect passwords/cookies/copied tokens, or reuse a developer's local credentials. A future integration needs separate product identity, official account connection, per-customer credential/runtime isolation, cancellation, disconnect, limit handling, and independent ownership enforcement. Replacing the current server adapter is not enough.

Official references checked September 9, 2026: [Authentication](https://learn.chatgpt.com/docs/auth) distinguishes subscription access from API usage billed to the Platform account. [Codex App Server](https://learn.chatgpt.com/docs/app-server) describes embedding, but labels the app-server command and WebSocket transport experimental and unsupported for production workloads. Recheck these boundaries before implementing a subscription edition.

## What a customer can do

1. **Start or import.** Register and save the one-time recovery code. Start with a blank profile, paste resume text, or upload PDF, DOCX, or UTF-8 TXT. Review the imported material; extraction and initial field detection can require correction.
2. **Explain the work.** Enter jobs, responsibilities, achievements, schooling, skills, and preferences. Record task-level ability and supporting examples. Apply this depth to every skill the customer enters or imports, including AI, accounting, programming, trades, communication, and unfamiliar tools. Ask about the exact tasks and tools, independence or assistance, recency, context, and a concrete example. Excel lookups are one illustration, not the scope of the interviewer.
3. **Interview with or without AI.** Guided mode saves answers and prepared follow-up questions for any skill without a key, AI consent, or available AI allowance. It does not change profile claims or produce proposals; add confirmed details in Your story. With explicit consent and a configured server key, the interviewer asks follow-up questions and proposes supported profile changes. The customer accepts or rejects each proposal. Accepting a suggestion makes the profile require review again.
4. **Create a document.** Confirm the profile, create a resume, edit its wording, and approve it. Approval freezes that version. Word export uses its exact approved text. Browser print supports saving as PDF; there is no separate server PDF-generation service.
5. **Assess a role.** Browse public remote listings or paste a posting. AI assesses supplied requirements against reviewed experience, gaps, and unknowns. It can draft a tailored resume for review. An assessment is not verification of an opening, eligibility, or a hiring outcome.
6. **Track the search.** Save opportunities, set stages, write notes, record follow-up dates, and attach an approved resume version. Customers apply on the employer's site themselves. There is no automated submission or outbound employer messaging.

The `/demo` route starts inside a fictional, populated account-free workspace. It simulates AI and keeps edits only in browser memory. It never creates a customer, sends API requests, or accesses customer records. Use it for a walkthrough; use real authenticated acceptance tests for production behavior. Real upload processing is outside the demo.

## Guided interview without AI

`POST /api/interview/guided` accepts a message and replay request ID, plus an optional explicit skill topic. It works for authenticated real accounts when the AI provider is unavailable, consent is off, or the account’s AI allowance is exhausted. The browser keeps both the skill chooser and answer field usable and labels this mode **Guided interview**. Responses are prepared questions generated by the shared profile rules, not model-generated analysis or simulated customer data.

The store atomically saves the customer answer, guided question, and an owner-scoped receipt containing the topic and question position. This progress survives reloads and server restarts. Replaying the same normalized input and request ID adds nothing; reusing an ID for different input or another operation fails with a conflict. Guided receipts do not consume per-account or global AI allowance. No provider call, inferred proficiency, profile change, or approval proposal is generated.

Keep an unsaved answer and its request identity when a response is lost; do not silently replay an AI attempt as a guided request. Choosing optional AI later must clearly disclose that saved interview history and new answers may be shared with the provider. Existing AI suggestions still require individual customer approval. Guided answers become resume facts only through the customer’s explicit profile edits and review.

The endpoint has a 32,000-byte JSON body limit; messages are 1–6,000 characters after a nonblank check, with null characters rejected. Request IDs contain 8–100 letters, digits, underscores, or hyphens. An optional topic is at most 200 characters and rejects control characters. A separate in-memory limiter allows 60 guided requests per account per minute, in addition to the general HTTP controls. The limiter resets on restart and is not distributed; request receipts and interview storage still require a production retention policy.

## Skill interview requirements

The skill catalog provides starting questions, not a closed list of supported skills. A customer can name any skill, select it for the interview, and add the concrete tasks they actually perform. Broad labels such as AI or programming require follow-up about the particular tools, languages, workflows, and responsibility involved. Missing information stays unknown. A name alone must never establish proficiency.

- **AI:** distinguish prompting, reviewing outputs, automating workflows, connecting APIs, and building or maintaining systems. Using AI to produce code does not automatically establish independent programming ability. Ask what the customer can explain, test, troubleshoot, and repeat.
- **Accounting:** distinguish invoicing, accounts payable/receivable, reconciliations, journal entries, financial reporting, and month-end close. Ask which software, period, business context, and level of review applied. Do not infer credentials from task experience.
- **Programming:** ask which language, what they built, which parts they wrote or changed, and how they test, debug, deploy, and maintain it. Preserve any reliance on generated code or human help.
- **Custom skills:** begin with the customer’s definition and a real example. Record their specific tasks without forcing them into an unrelated catalog category.

Changes remain proposals until approved. The resume should name supported tasks at the recorded level, with assistance clear. The scripted demo illustrates this behavior without claiming to validate real ability.

## Implementation status

| Area | Implemented | Remaining boundary |
| --- | --- | --- |
| Accounts | Password hashing, server sessions, recovery-code rotation, ownership checks, CSRF and origin checks, request throttling | Email is an unverified identifier. No email delivery/reset, MFA, or mature support identity process. |
| Career profile | Durable structured profile, original imported text, granular task levels, evidence, preferences, optimistic revision checks | Import is fallible; depth and correctness require customer review and live conversation evaluation. |
| Guided interview | Durable answers, prepared any-skill questions, owner-scoped topic progress and replay handling; no AI call or allowance use | No semantic evaluation, automatic profile claims, or generated proposals. Storage retention and distributed abuse controls remain operational work. |
| AI | Real server-side Responses adapter for interview, job assessment, tailoring; bounded requests; structured outputs; evidence checks; explicit proposal approval | Automated tests simulate the provider. Actual paid API behavior, model access, semantic accuracy, latency, and cost require validation. |
| Resumes | Editable drafts, frozen approved versions, source-profile snapshots, Word export, browser print | No universal ATS guarantee. Verify exported layout and reading order with realistic resumes. |
| Job discovery | Public Remotive feed, attribution, source links, six-hour persisted cache, user-pasted postings | Remote feed only; public feed delayed by 24 hours. No broad licensed coverage, closure verification, or complete eligibility engine. |
| Tracker | Saved/applied/screening/interview/offer/rejected/withdrawn stages, notes, dates, approved resume references | No automated application submission, notification delivery, calendar sync, or employer messaging. |
| Usage | Persistent per-account and service-wide daily attempt limits, concurrency caps, replay receipts, token counts | Attempt ceilings are not dollar ceilings. No billing, paid entitlements, checkout, refunds, or cancellation system. |
| Data control | Customer JSON export, password-confirmed live account deletion, online backup command, restoration instructions | Backup scheduling/encryption/off-host retention and deletion reconciliation are operating work, not automated services. |
| Delivery | Standalone package, lockfile, Dockerfile, GitHub checks, health endpoint | Hosted deployment, domain/proxy configuration, monitoring, and real provider validation remain operator tasks. |

## Transfer only the standalone product

Make this package the root of a **new private repository with fresh history**. Do not copy the parent personal job-search repository or its Git history. The product has no dependency on personal resumes, application trackers, generated research, or the older dashboard server.

Transfer this allowlist:

```text
server.js
lib/
public/
scripts/backup.js
tests/
docs/
.github/
package.json
package-lock.json
.env.example
.gitignore
.dockerignore
Dockerfile
README.md
HANDOFF.md
```

Exclude `.env`, all real credentials, `data/`, `backups/`, `node_modules/`, SQLite files and sidecars, browser traces, screenshots, test output, and any personal parent-project files. Inspect the staged file list and scan content for credentials and personal records before the first commit. The source ZIP is a convenience snapshot; the clean checkout and CI results are the reproducibility proof. Refresh the ZIP when source changes.

## First run and verification

Use Node.js 24 or newer. From the new repository root:

```sh
npm ci
cp .env.example .env
npm start
```

Open `http://127.0.0.1:4174/demo` for the populated walkthrough, or `/` for the authenticated product. Manual editing, guided interviews, accounts, document versions, and the tracker work without an AI key. Privately configure `OPENAI_API_KEY` and a verified `OPENAI_MODEL` on the server to enable AI; restart after configuration changes. Never put a provider key into frontend code or the repository.

Run checks from this product root, not the old parent project:

```sh
npm run check
npm run test:unit
npx playwright-core install chromium
npm run test:browser
```

The September 9, 2026 handoff suite passes 92 tests: 76 unit/server/document/feed/backup tests and 16 browser journeys, including the account-free demo, arbitrary skill interviews, custom task persistence, guided saving without AI, mode switching, and safe retries. Rerun it in the receiving environment and keep the resulting CI run with the release. The GitHub workflow installs Chromium with Linux dependencies and builds the Docker image. Test counts establish tested behavior, not security certification, model truthfulness, hosting readiness, or customer outcomes.

## Architecture and code map

```text
Browser UI
  | same-origin HTTP + private session + CSRF token
Node server.js
  |-- lib/auth.js          password/recovery/session support and throttling
  |-- lib/store.js         owner-scoped SQLite records and request allowances
  |-- lib/resume-model.js  profile model, import heuristics, task catalog, guided questions, resume text
  |-- lib/documents.js     bounded PDF/DOCX/TXT extraction and DOCX export workers
  |-- lib/ai.js            bounded server-side OpenAI Responses calls
  |-- lib/jobs.js          fixed public Remotive endpoint + shared public cache
  `-- scripts/backup.js    online consistent SQLite snapshot

public/app.js             shared customer UI and authenticated request transport
public/demo.js            isolated fictional in-memory request adapter
public/app.css            responsive visual design
```

There is no frontend build system or general-purpose agent execution runtime. The server serves an explicit static asset allowlist. The demo uses the same UI through a separate in-memory adapter; it is not an authentication bypass.

### Durable records and invariants

`lib/store.js` uses SQLite with foreign keys, WAL, transactions, and schema version 2. It upgrades the version-1 proposal table on open and rejects databases with a newer version. Keep a pre-migration backup; an older binary must not open a newer schema.

| Record | Purpose / invariant |
| --- | --- |
| `users`, `sessions` | Password/recovery hashes and hashed session tokens; server resolves the owner from the session. |
| `profiles` | One normalized JSON profile per owner plus a revision counter. Stale saves return a conflict. |
| `messages`, `proposals` | Persistent conversation and proposed changes; acceptance is bound to owner, profile revision, and proposal batch. |
| `resumes` | Draft or approved text plus source-profile snapshot and optional target job. Approved text is immutable. |
| `applications` | Owner-scoped opportunity, stage, notes, date, and approved resume reference. Duplicate saves are coalesced. |
| `requests`, `global_usage` | Daily attempts, request fingerprints, results, status, and token counts. Replaying unchanged completed input does not spend a second attempt. |
| `feed_cache` | Shared public listing cache and failure cooldown; it contains no customer resume/profile data. |

Preserve these behaviors when refactoring:

- Derive the customer owner on the server. Never trust a browser-supplied user ID.
- Require a reviewed profile before resume creation and AI assessment/tailoring.
- Treat resume uploads and job descriptions as untrusted data. The model receives no executable tools and cannot authorize actions.
- Preserve assistance levels, source evidence, role attribution, and customer corrections. Evidence checks reduce errors; they cannot prove every statement is true.
- Keep drafted AI changes separate from accepted profile facts. Recheck consent and profile revision after the provider returns. Consent revocation and deletion cancel in-flight AI work.
- Preserve approved resume versions when the master profile changes. An application can reference only an approved resume owned by that customer.
- Keep manual editing, guided answer saving, and existing records usable when AI is unavailable, consent is off, or AI quotas are exhausted. Guided saves must not invoke the provider or reserve AI allowance.
- Keep demo actions entirely local and public job listings available without sign-in.

### Important HTTP entry points

| Routes | Responsibility |
| --- | --- |
| `/`, `/builder`, `/demo`, `/health` | UI entry points, demo, process health |
| `GET /api/session`, `GET /api/jobs` | Session status and public listing feed |
| `/api/auth/register`, `/api/auth/login`, `/api/auth/recover`, `/api/auth/logout` | Account lifecycle; logout requires a session |
| `GET /api/state`, `PUT /api/profile`, `POST /api/consent` | Owner's workspace, revision-aware save, AI consent |
| `POST /api/resume/extract` | Authenticated document extraction |
| `POST /api/interview/guided` | Owner-scoped prepared questions and saved answers; no AI consent or allowance required |
| `POST /api/interview`, `POST /api/proposals/:id/accept`, `POST /api/proposals/:id/reject` | Optional AI interview and owner-approved suggestions |
| `POST /api/jobs/assess`, `POST /api/resumes` | Assessment, ordinary resume creation, optional AI tailoring |
| `PATCH /api/resumes/:id`, `GET /api/resumes/:id/docx` | Draft approval/editing and approved Word download |
| `POST /api/applications`, `PATCH /api/applications/:id` | Save and update tracker records |
| `GET /api/export`, `DELETE /api/account` | Customer data export and password-confirmed deletion |

All private APIs require a valid session. Mutations also require the exact configured origin; authenticated mutations require the session CSRF token. The host header must match `APP_ORIGIN`.

### Data leaving the application

Uploaded file bytes are parsed in bounded server workers without writing the raw file to disk. Extracted text can become part of the stored profile. Guided interview saves make no external AI request. If the customer later enables AI, the consent disclosure includes saved interview history as well as new answers; selected profile/interview/job content can then be sent to OpenAI. The adapter uses `store: false` and best-effort contact-field redaction; these settings do not constitute complete anonymization or a promise of zero provider retention.

Remotive receives a fixed public-feed request. Customer search terms, resumes, and contact information are not sent to that feed provider. Pasted posting URLs are stored as links, not fetched by the job module. User exports and backups can contain sensitive career data and require private handling.

## Hosting constraints

Deploy **one application process** with a durable local SQLite volume behind an HTTPS reverse proxy. Do not use multiple replicas, ephemeral storage, or a shared network filesystem for this release. Authentication throttles, AI concurrency, and document concurrency are process-local. Scaling requires a shared database, coordinated limits/queues/cache, migrations, and recovery design first.

Production configuration requires an HTTPS `APP_ORIGIN`, a pilot invitation code of at least 16 characters, and exact trusted proxy peer IPs. The proxy must preserve `Host` and `Origin`, overwrite forwarded client IPs, cap bodies at 12 MB, and prevent direct external access to the app port. Docker runs as a non-root user; its data volume must be writable by that user. See the complete commands and restore procedure in [Operations](OPERATIONS.md).

Current default operating limits are 40 AI attempts per account per UTC day, 400 attempts service-wide, and three simultaneous AI calls. Failed or interrupted attempts may count. These are adjustable pilot controls, not advertised paid entitlements or guaranteed dollar limits. Document extraction/export share two worker slots; individual uploads are capped at 8 MB. Load-test actual deployment resources before choosing capacity.

`/health` indicates a running process only. It does not prove a working AI key, job provider, backup, or disk health. Monitor those separately without collecting resume bodies, conversations, passwords, session cookies, or keys in routine logs.

## Ordered launch backlog

These are suggested GitHub issue scopes, in dependency order. Assign an owner and record evidence against each acceptance criterion. They are gates, not delivery-date promises.

| Order / gate | Work and likely owner | Acceptance evidence |
| --- | --- | --- |
| 1 · Handoff | Engineer: create the fresh private product repository; verify source allowlist and dependency/runtime setup. | Clean checkout installs and runs independently; CI passes all product checks and Docker build; no personal records, credentials, runtime data, or parent history are included. |
| 2 · Before pilot | Engineer + operator: configure a dedicated API project and supported model; evaluate a small fixed set of realistic conversations. | A real interview produces a pending evidence-linked proposal, acceptance updates only the intended fact, assessment distinguishes gaps/unknowns, tailoring preserves facts; record latency, token use, approximate cost, quota behavior, and interruption/retry behavior without storing secrets. |
| 3 · Before pilot | Founder/operator: choose the pilot audience, job-source scope, privacy/support commitments, and account-recovery policy. | Public feed remains openly accessible with attribution/delay notice; intended source use is reviewed; onboarding accurately describes processing, recovery-code limitations, export/deletion, backup retention, and support contact. No broad/local-search or verified-eligibility promise exceeds coverage. |
| 4 · Before pilot | Engineer + operator: deploy one HTTPS instance with persistent storage, secrets, private invitation, monitoring, backup scheduling, and a tested restore. | Two separate clients retain independent accounts across restart; forwarded-IP spoof fails; consent revocation, recovery, export, and deletion work; an encrypted off-host snapshot restores in isolation with sessions revoked and post-snapshot deletions reconciled; incident and rollback owners are named. |
| 5 · Before pilot | Engineer + product lead: review realistic resume imports/exports and matching examples; run an independent security and privacy review. | Cover AI workflows, accounting, programming, an unfamiliar custom skill, beginner and assisted Excel, incomplete education, missing credentials, and conflicting answers; correct failures; no unsupported metrics or skill inflation; exported documents have readable/selectable text and sensible order; critical review findings are resolved. |
| 6 · Controlled pilot | Product lead: invite a small defined cohort and measure usefulness with consent and minimal analytics. | Record time to first approved usable resume, corrections, interview abandonment, relevance of the first ten jobs, completed applications, user-reported interviews, support minutes, return usage, and willingness to pay. Establish a measured cost per active customer. |
| 7 · Before payments | Founder + engineer: choose pricing and licensed coverage; implement billing and entitlements; finish paid-service operations. | Documented source rights support the paid offering; checkout and signed, idempotent payment events are tested; limits, failed payments, cancellation, refunds, tax handling, support, and retention match published terms; margin assumptions use observed AI/data/support costs. |
| 8 · After evidence | Engineer + founder: scale architecture or investigate official customer-subscription connection only when demand justifies it. | Scaling passes shared ownership, quota, queue, migration, and restore tests. Subscription option has an explicitly supported deployment model and passes separate-account credential/runtime isolation, connection lifecycle, cancellation, and limit tests. |

Do not build paid checkout before the source-rights and cost decisions shape its entitlements. Do not remove invitation controls or expose a personal/local server as a shortcut to launch.

## Sales boundaries for the engineering handoff

The supported promise is: **understand your actual skills, turn them into reviewed resumes, evaluate job requirements clearly, and keep your search organized.** Show one complete journey in the fictional demo, then explain that the real product stores the customer's guided answers and approved work, with optional operator-provided AI after consent.

Treat a possible focus on operations workers or career changers as a target-audience hypothesis to validate. No customer traction, hiring improvement, market size, launch date, or price has been established by the implementation. Avoid claims of guaranteed interviews, guaranteed ATS approval, comprehensive job coverage, verified hiring eligibility, autonomous applications, unlimited AI, or included customer ChatGPT subscription linking.

The next engineer's first milestone is a reproducible private repository and an evidence-backed pilot release. The next commercial milestone is a paid offer whose customer value, source permissions, operating costs, and support commitments have been measured and documented.
