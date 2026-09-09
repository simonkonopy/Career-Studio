# Career Studio

An independent pilot product for building a detailed career profile, creating reviewed resumes, finding relevant jobs, and tracking applications. Customers can upload a PDF, Word document, or text resume, or start with a blank profile. The interviewer explores any skill the customer enters or imports, including AI, accounting, programming, Excel, and custom skills. It asks about specific tasks, tools, examples, recency, and what the customer can do independently or with assistance. A skill name alone never establishes proficiency.

**Receiving this in GitHub? Start with [HANDOFF.md](HANDOFF.md).** It maps the program, API-funded SaaS business plan, customer-subscription delivery specification, security instructions, and Fable theme assets.

**Chosen product model:** AI is provided through the operator's OpenAI API account and included within customer allowances. Customers do not need a ChatGPT subscription or an API key. Connecting personal ChatGPT subscriptions is outside this release. Paid plans and checkout are deferred until pilot costs and customer outcomes are measured.

This directory is designed to become the root of a **new private repository**. It does not read the personal job-search dashboard, applications, resumes, or research in the parent project. Copy only the source files described below; do not copy the parent repository or its history.

## Run locally

Install Node.js 24 or newer, then from this directory:

```sh
npm ci
cp .env.example .env
npm start
```

Open `http://127.0.0.1:4174`. Accounts, manual profile editing, guided interviews, resume versions, and the tracker work without an AI key. In a real account, choose any skill and save answers to prepared follow-up questions without AI consent or remaining AI allowance. Guided answers persist across reloads; they do not call an external AI service, consume AI allowance, or create profile claims or proposals. To enable optional AI interview follow-ups and AI job assessment/tailoring, privately configure `OPENAI_API_KEY` in `.env` and restart. Check that `OPENAI_MODEL` is available to the API project before inviting users. Never put credentials in the browser, source code, screenshots, or GitHub.

To explore the populated customer experience without signing in, open `/demo` or choose **Explore demo** on the sign-in screen. This walkthrough uses fictional profiles, jobs, applications, and scripted AI responses. Its edits stay in browser memory and reset on reload; it does not create an account, call the AI provider, or access customer records. Sample text/PDF downloads are available; real document processing remains in the authenticated product.

The server stores customer information in `data/career.sqlite` by default. That directory is private runtime data and must persist across releases. `.env`, databases, backups, and dependencies are excluded from Git and the Docker build context.

## Customer journey

1. Create an account and securely save the one-time recovery code.
2. Upload a resume or start fresh; review extracted details before using them.
3. Build the career profile with work, education, task-level skills, examples, and job preferences. Use the guided interview to save answers and work through prepared questions, then add confirmed details in Your story. Optional AI assistance requires consent and available allowance; it can use saved interview history and new answers to suggest facts for individual acceptance or rejection.
4. Review the profile and create a resume. Edit and approve the draft before Word export. Approved versions remain preserved and can be attached to applications.
5. Browse public remote listings or paste a posting. Assess requirements, supported experience, gaps, and unknowns; create a tailored resume when appropriate.
6. Save jobs and record application stages, notes, follow-up dates, and the resume used.

## Implemented boundaries

- Password accounts with private server sessions, recovery codes, customer ownership checks, and persistent profiles, conversations, resumes, applications, and AI request allowances.
- Authenticated guided interview at `POST /api/interview/guided`: prepared questions for any skill, durable answers and topic progress, and replay protection, independent of AI availability and allowance.
- Server-side AI requests with consent, a per-customer daily attempt allowance, a service-wide daily ceiling, bounded concurrency, and replay protection. Allowances reset at midnight UTC; failed or interrupted attempts can still count.
- Evidence-linked AI suggestions and approval before profile changes. AI output remains a draft for customer review; semantic truth cannot be guaranteed by automated checks.
- Server parsing for supported uploads; imported text may contain sensitive details. Known contact fields are removed from AI requests where possible, but redaction is not complete anonymization.
- Customer export and password-confirmed account deletion. Backup copies need a separate retention policy.
- Public Remotive listings with source links, attribution, and the 24-hour delay notice. Neither the listing page nor its API requires an account. Private personalization and saving require sign-in. User-pasted listings remain unverified.

This is a pilot foundation, not a completed paid SaaS launch. Email ownership is unverified; there is no email delivery, email password reset, MFA, billing, automated application submission, or employer eligibility verification. The automated AI tests use a simulated provider. A real paid API request and hosted deployment need operator verification before pilot access.

## Tests

```sh
npm run check
npm run test:unit
npx playwright-core install chromium
npm run test:browser
```

Tests use temporary customer data and simulated upstream responses; they should not require production secrets. The included GitHub workflow runs these checks and builds the Docker image when this directory is the repository root. It installs Chromium and its Linux dependencies in CI. Running the old parent repository's tests does not verify this product.

## GitHub handoff

Start with [HANDOFF.md](HANDOFF.md) for the engineer's entry point. The [product pitch and handoff deck (PowerPoint)](docs/CAREER_STUDIO_HANDOFF_2026-09-09.pptx) and [PDF edition](docs/CAREER_STUDIO_HANDOFF_2026-09-09.pdf) provide the visual overview. The written engineering and security guides also cover the newer guided-interview fix. The 29-slide deck opens with a "Start here" reading path for each audience, then three parts: what the product does (problem, origin, why it differs from general chat tools, the customer journey, fictional-demo screenshots), what is built and how to run it (built versus remaining, launch plan, AI access, system architecture, code map, rules to preserve, hosting, launch gates), and how to pilot and sell it (known risks, the first customer experiment, the demo script, packaging experiments, pilot measures). Workflows and instructions are drawn as block diagrams. Its speaker notes carry sources and presentation guidance.

The next engineer should follow [Engineering handoff](docs/ENGINEERING_HANDOFF.md), [SaaS business and release plan](docs/SAAS_BUSINESS_PLAN.md), and [Security instructions](docs/SECURITY.md). [Customer subscription delivery](docs/CUSTOMER_SUBSCRIPTION_DELIVERY.md) specifies a future ChatGPT plugin, customer onboarding, and a separate local-companion research path; none is implemented yet. The product owner can use the [Sales playbook](docs/SALES_PLAYBOOK.md) for the pitch, five-minute demo, customer discovery, pilot measurements, and accurate answers to objections. These documents supersede historical subscription-harness proposals for this release. The presentation contains approved fictional demo images; exclude unscreened screenshots and customer content from the transfer.

The [Design handoff](docs/DESIGN_HANDOFF.md) preserves Fable’s redesigned presentation theme and the current blue dashboard theme. It includes design settings, reusable cover/section artwork, screenshot guidance, and the workflow-diagram rules. Keep `docs/design/` with the handoff; the current PowerPoint is the editable presentation reference.

Copy `HANDOFF.md`, `server.js`, `lib/`, `public/`, `scripts/backup.js`, `tests/`, `docs/`, `package.json`, `package-lock.json`, `.env.example`, `.gitignore`, `.dockerignore`, `Dockerfile`, `.github/`, and this README into a fresh directory. Review the files for personal data before the first commit and create a new private repository with fresh history. Keep real customer data, `.env`, `data/`, `backups/`, `node_modules/`, browser traces, test output, and unscreened screenshots out of that transfer.

For hosting, backups, restoration, and pilot launch requirements, follow [Operations](docs/OPERATIONS.md). The Docker image runs as a non-root user and expects a single server instance, a persistent volume, an HTTPS reverse proxy, a private pilot invitation code, and a configured API key when optional AI features are enabled. Hosting and database storage, job-source rights, support, and AI usage remain operator expenses.
