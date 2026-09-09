# Career Studio SaaS business and release plan

Updated September 9, 2026. This is an implementation and validation plan for the engineer and product owner. Start with [HANDOFF.md](../HANDOFF.md). Product scope and the Fable theme remain as described in the existing engineering, sales, and design guides.

## Release model

The initial service runs on the business’s infrastructure with the business’s OpenAI API account. Customers buy access to Career Studio’s career workflow, saved records, document tools, and included AI allowance. They do not provide API credentials. Begin with a controlled unpaid pilot; choose prices and paid limits after measuring usefulness and costs.

The customer-subscription edition is a separate integration specified in [Customer subscription delivery](CUSTOMER_SUBSCRIPTION_DELIVERY.md). It does not replace the current API adapter merely by adding a sign-in button. Keep product subscriptions, ChatGPT access, and API charges separate in the code, customer copy, and accounting.

## API setup and validation

1. Create dedicated development/staging and production API projects. Use a service identity with only the access this application needs. Store credentials in the deployment secret manager and give production access only to operators who need it. Keep development, CI, and customer-support environments away from production secrets and data.
2. Select a model available to the project, set `OPENAI_MODEL`, and record the tested model identifier. Validate the current structured-output contract for interview, job assessment, and tailoring before release. Do not rename or switch a model in production without evaluating the change.
3. Run a small live evaluation with consented or synthetic profiles: AI use with assisted coding, basic/advanced accounting tasks, programming with generated-code help, a custom trade skill, incomplete education, conflicting answers, and malicious instructions embedded in an uploaded resume or job posting.
4. Confirm proposed facts remain pending, quotations and role attribution are correct, unsupported abilities remain unknown, assistance is retained, cancellation works, retries do not duplicate spend, and approved resumes remain unchanged. Record latency, token use, correction rate, errors, and estimated cost. Automated mock-provider tests are not a substitute for this step.
5. Publish accurate processing and retention information. The existing adapter uses `store: false`, but this setting alone does not establish zero provider retention. Review the actual project’s applicable data controls and endpoints before making a privacy claim. [OpenAI data controls](https://developers.openai.com/api/docs/guides/your-data).

Project separation, key management, monitoring, and scale planning should follow the current [OpenAI production guidance](https://developers.openai.com/api/docs/guides/production-best-practices). These sources were checked September 9, 2026; recheck before launch.

## Product work before inviting customers

Use the launch gates in [Engineering handoff](ENGINEERING_HANDOFF.md) and the host procedures in [Operations](OPERATIONS.md). Assign an owner to each missing capability instead of treating deployment as completion.

| Workstream | Work to finish | Acceptance evidence |
| --- | --- | --- |
| Identity | For an invited pilot, disclose the unverified email identifier, require customers to save the recovery code, and define safe support identity handling. Before broad self-service launch, use a production identity provider or add verified email and usable recovery; protect privileged access. | Pilot signup, recovery-code use, revocation and two-customer isolation work on the host. Verification and email recovery must also pass before broad enrollment. |
| Onboarding | Explain the service, processing, recovery, and limits; let users start blank or import; ask a few relevant skill questions at a time. | A new user reaches a reviewed usable resume without developer help. |
| Resume quality | Evaluate realistic inputs and exported reading order; retain approved-version snapshots and assistance distinctions. | All-skill examples and corrections produce accurate, readable documents. |
| Job coverage | Validate intended source use and obtain broader licensed coverage when required. Retain public Remotive access and attribution. | The actual offering matches permitted coverage; stale/unverified listings are clearly identified. |
| Reliability | Deploy one instance, persistent private storage, health/cost/error alerts, backups, restore, and rollback. | Recorded restart, restore, cancellation, quota, and outage exercises. |
| Security/privacy | Complete the threat model and checks in the security guide; set retention/export/deletion and incident responsibilities. | Findings are resolved and operating controls work with the real host. |
| Support | Provide a contact channel, troubleshooting, recovery guidance, escalation, and response commitments the team can meet. | A support request can be handled without collecting passwords, tokens, or unnecessary resume data. |

## Pilot and economics

The existing sales playbook proposes 8–12 invited job seekers as a research cohort. This is a proposed experiment, not traction. Observe a complete profile/interview/resume/job/tracker journey. Measure time to a usable resume, unsupported-claim corrections, abandonment, saved opportunities, returning users, support minutes, and willingness to pay.

Calculate costs from actual usage rather than a guessed flat AI cost:

```text
Ordinary input tokens = total input - cache-read input - cache-write input

AI cost = sum across requests of:
          ordinary input tokens × ordinary input rate
          + cache-read input tokens × cache-read rate
          + cache-write input tokens × cache-write rate
          + output tokens × output rate
          + any separately billed features used

Contribution per customer = collected revenue
                           - AI cost
                           - job-data and infrastructure allocation
                           - payment fees
                           - direct support and other variable costs
```

Use the selected model's actual billable categories and consistent units, such as dollars per token after converting a published per-million rate. The current adapter records total input and output tokens without cache-read/write details. Add those details and price-version metadata, following the model's response schema, and reconcile estimates with provider billing. Missing fields are not proof of zero charges. Before that instrumentation exists, label costs as estimates and budget input using the highest applicable input-category rate. Do not hard-code a cache discount or assume cache writes cost the ordinary input rate. [OpenAI prompt-caching usage guidance](https://developers.openai.com/api/docs/guides/prompt-caching).

Include failed/retried work, document processing, storage growth, and high-usage customers. Compare a monthly active-search plan with a fixed-duration search package using the sales playbook. Set prices, support commitments, and quotas only after the pilot supplies evidence. Record the price schedule used for each calculation; this repository contains no price guarantee.

Current limits are 40 AI attempts per account per UTC day, 400 service-wide, and three concurrent calls. They are persistent attempt controls, not paid entitlements or strict dollar ceilings. Add an application cost budget/reservation and reconciliation design if a spend ceiling is required; preserve replay protection and concurrency admission. Alert before exhaustion and give operators an explicit way to disable AI without losing saved customer work.

## Billing implementation backlog

Billing is not currently implemented. Use a hosted payment flow so the application does not handle raw card details. Complete these application requirements with the chosen processor:

- Persist customer-to-billing-account mapping and subscription state. Define states such as trial, active, past due, canceled, and expired, including the access allowed in each.
- Verify signed payment events, process them idempotently, tolerate retries and out-of-order delivery, and reconcile against the processor. A successful browser redirect must not grant paid access by itself.
- Check entitlements on the server for every paid action, including future MCP tools. Keep public job-feed access public. Define what remains readable/exportable after paid access ends.
- Make quotas, renewal dates, cancellation timing, refunds, failed-payment handling, and account deletion versus billing cancellation explicit. Provide receipts and self-service billing management.
- Separate sandbox and production payments. Test duplicate events, failed payments, cancellations, chargebacks, refunds, and account deletion. Publish the actual offer and tax/support obligations before charging.

## Shipping the hosted product

1. Tag a reviewed release with passing CI. Build and record the container digest and dependency inventory. Keep secrets outside artifacts.
2. Deploy to staging with synthetic users. Run the release and security checks, including long resumes and any-skill interviews on desktop and mobile.
3. Configure the real domain, HTTPS, storage, trusted proxy, secrets, monitoring, backup schedule, and operator access. Create a fresh production database; do not migrate personal/demo records into it.
4. Take a pre-release backup for updates, apply tested migrations, and verify the rollback strategy. Keep the service private while validating critical flows.
5. Invite the approved pilot cohort. Deliver the HTTPS URL, onboarding, recovery guidance, privacy/support information, and visible limits. Customers should not need developer setup.
6. After pilot and paid-release gates pass, enable billing and broader enrollment in a controlled rollout. Monitor errors, unexpected spending, customer corrections, and support load. Pause enrollment or paid AI if those controls fail.

## What remains the operator’s responsibility

The operator owns domain and hosting costs, API funding, job-data permissions, payment operations, customer support, incident handling, backups, and retention. A future customer-owned ChatGPT connection changes where conversational AI runs; it does not eliminate these responsibilities. The release record must state which delivery modes work, which are planned, and which have actually passed hosted/customer validation.
