# Career Studio: founder and sales playbook

**Handoff date:** September 9, 2026. **Status:** working pilot foundation with an account-free demo; commercial demand, pricing, hiring outcomes, and production operations still need validation.

Use this guide alongside [README](../README.md) and [Operations](OPERATIONS.md). Product behavior below is based on the current package. Audience, recruiting, pricing, and targets are **proposed experiments**, not evidence of traction or established market facts.

The full repository entry point is [HANDOFF.md](../HANDOFF.md). See [SaaS business and release plan](SAAS_BUSINESS_PLAN.md) for commercial implementation and [Customer subscription delivery](CUSTOMER_SUBSCRIPTION_DELIVERY.md) for the proposed ChatGPT plugin and customer connection flow. Describe that edition as planned until it passes its release checks.

## The promise

**One line:** Career Studio turns the details of your work into a resume you can stand behind, job reviews you can understand, and an organized search.

**Thirty-second pitch:** Your job title rarely captures everything you know. Career Studio starts with your resume or a blank page, then asks about the tasks, tools, and results behind your experience. You review the facts before they become part of your profile. From there, create and approve resume versions, examine where a job fits and where the gaps are, and track your applications in one workspace. The goal is a clearer, more credible search, with you making the decisions.

**Why the workflow matters:** A resume is a short document. The career profile can hold the fuller story: what you did, what happened, when you used a skill, and what help you needed. The product uses that detail across interviewing, resume drafts, job reviews, and application history. Describe this as the product's intended advantage; do not claim proven superiority over competitors.

## Start with one customer hypothesis

Proposed first audience: people moving between operations, inventory, purchasing support, and customer operations coordinator roles. In particular, test with people whose practical work is more detailed than their titles or current resumes suggest.

The fictional demo customer, Jamie Morgan, illustrates this hypothesis: stock records, purchase orders, supplier communication, colleague training, and everyday spreadsheets. Jamie can describe useful work without claiming to be an advanced analyst or a people manager.

This focus should shape the pilot, not become an unsupported coverage promise. The current public feed contains remote listings. It does not establish comprehensive local or on-site coverage for this audience. User-pasted postings can support early interviews while the team validates permitted, appropriate job sources.

## Show the depth for any skill

The interviewer explores any skill the customer enters or imports. Excel is one example. AI, accounting, programming, hands-on trades, communication, and unfamiliar tools all need the same evidence: what the person does, what tools they use, what help they need, when they used it, and an example they can explain.

| Skill the customer enters | Follow-up examples | Resume distinction to preserve |
| --- | --- | --- |
| AI | Which tools? What do you create or automate? How do you check the output? Can you maintain the workflow? | Writing prompts, checking output, integrating APIs, and developing a system are different capabilities. |
| Accounting | Invoices, reconciliations, journal entries, or month-end close? Which software? Who reviews your work? | Recording transactions with review does not establish ownership of financial statements or a professional credential. |
| Programming | Which language? What did you build? What did you write, test, and debug? Where did AI or a colleague help? | An AI-assisted project does not automatically prove independent programming or production maintenance. |
| Excel | Lists, formulas, lookups, or pivot tables? What report did you produce and who used it? | Basic formulas can be independent while VLOOKUP remains assisted. |
| Any custom skill | What does that skill mean in your work? Describe one task, the tool or method, your contribution, and the result. | Use the customer's actual tasks. Keep unanswered ability questions open. |

Ask a few relevant questions at a time. A first useful resume should not require an exhaustive exam in every field. Return to deeper questions when a resume claim or job requirement makes the detail useful.

Record independent work, work with help, learning, and tasks never performed separately. The customer reviews suggested facts and wording. These self-reported examples are not a practical examination or employer verification.

## Five-minute demo

Run the product and open `/demo` (locally, `http://127.0.0.1:4174/demo`). Use **Reset demo** before presenting. Do not put a prospect's real resume or personal details into a screen-shared demo.

Say first: **“This is a fictional customer workspace. The jobs and applications are examples, and the AI replies are scripted. You can explore it without an account or API key; changes reset when the page reloads.”**

| Time | Click and show | Say |
| --- | --- | --- |
| 0:00–0:40 | **Overview**: Jamie, experiences, skills, saved opportunities, resume versions, follow-ups | “This is the workspace after someone has built their story and started a search.” |
| 0:40–1:30 | **Your story → Work**, then **Skills** | “We capture responsibilities and results, then the actual tasks behind each skill. Notice that training colleagues is separate from having direct reports, and assisted VLOOKUP stays assisted.” |
| 1:30–2:20 | **Interview**: choose a skill such as AI, accounting, programming, or a custom skill; show relevant questions, then the pending sample suggestion | “Any skill can be explored. We ask what you actually do and what help you need. Suggestions become facts only after your review.” If you accept the sample suggestion, complete the next review step. Sample replies remain scripted. |
| 2:20–2:40 | **Your story → Review**: review the sample facts, select the accuracy checkbox, save | “After changes, the customer reviews the profile again before making a new resume or assessing a job.” This step prevents a demo interruption after accepting the suggestion. |
| 2:40–3:25 | **Resumes**: approved master, approved role-specific version, unapproved draft; expand or download a sample | “The detailed profile feeds shorter documents. Drafts are editable; approved versions stay preserved, so we know what was used.” The demo offers sample text/PDF output; authenticated document processing supports the real upload/Word workflow. |
| 3:25–4:15 | **Find jobs**: review **Inventory Coordinator**, then **Supply Chain Analyst** | “An inventory role connects to this experience. The analyst example exposes required SQL and advanced Excel that Jamie has not established. Relevant experience, gaps, and unknowns are visible.” These are fictional openings and simulated assessments. |
| 4:15–5:00 | **Applications**: change a stage or note, show follow-up date and **Resume used**; save | “Keep the next action and the document used together. The customer chooses where to apply; the tracker does not send applications.” Close by asking what part would help the prospect's actual search. |

If showing resume intake, do it after the main walkthrough: **Upload a resume → Load the sample resume → Import pasted text** illustrates the review path. Importing replaces the demo profile draft; reset afterward. The demo does not upload or parse a real file.

## Discovery before a pilot invitation

Ask about an actual recent search before describing features:

- Which roles are you pursuing, and what constraints make a role unsuitable?
- Show how you currently decide whether to apply and how you keep track of applications.
- What work do you know how to do that your resume fails to explain?
- What does a skill on your resume mean in practice? Which parts require help?
- Tell me about a recent resume change or job review that took longer than expected.
- What would make you trust or reject a suggested resume statement?
- Which information would you hesitate to share with an AI-assisted product?
- What would need to happen in a first session for you to come back?
- What tools or services have you actually paid for during a search? What outcome justified that spending?

Record permission to keep research notes. Summarize behavior and quotations without copying private resume content into ordinary sales notes. Separate what someone did from what they say they might do.

## Proposed first pilot

**Recruiting experiment:** personally invite 8–12 people in the initial role family through the founder's network, career coaches, or community organizations that agree to participate. This is a proposed cohort size, not an existing pipeline. Do not send outreach, promise a partnership, or claim a customer logo without authorization.

Offer a clearly described, limited pilot after the engineering launch checks pass. State its duration, included assistance, known limits, data handling, and contact for support. Do not collect payment through the current product; checkout is not built.

Run one observed session per participant. Bring either a participant-approved resume or build from scratch, capture essential facts, get to a reviewed first resume, and examine three real postings the participant cares about. Interview deeper when it changes a resume claim or a job decision. Schedule a follow-up with the participant's agreement to examine actual return use and application activity.

Review friction after the first three participants. If the interview is exhausting, shorten the first-use path. If the best-fit audience primarily wants local openings, resolve source coverage before acquiring more users with a broad job-discovery pitch.

## Pricing and economics: questions to test

**Chosen architecture:** the operator pays for server-side AI and provides customer allowances. Customers do not need a personal API key or ChatGPT subscription. Personal ChatGPT subscription linking is deferred and must not be promised as an upcoming date or available entitlement.

Test packaging after measuring pilot usage:

| Hypothesis | Experiment | Evidence needed |
| --- | --- | --- |
| A monthly plan matches an ongoing search | Show a clearly hypothetical monthly offer with a stated usage allowance and cancellation terms | Understanding of the offer, willingness to pay, repeat use, and reasons for canceling |
| A fixed-duration search package fits an episodic need | Compare a clearly hypothetical 30-day package with the monthly offer | Preference tied to actual search behavior, expected duration, support demand |
| Human onboarding adds enough value to offer separately | Test an optional guided first session | Time saved or quality improved, willingness to pay, staff time required |

Choose test prices only after estimating actual variable and fixed costs. Track AI use, job-data fees if applicable, hosting/storage, document processing, support time, payment fees when payments exist, refunds, and acquisition spending. A daily request limit is a spending control, not a known dollar cost or proof of profitability. No price, margin, conversion rate, customer count, or revenue claim is validated yet.

Before charging, implement and verify checkout, entitlements, payment-event handling, cancellations, refunds, support ownership, and understandable allowance rules. Reconfirm that job-source display and payment restrictions fit the offer.

## Measure whether the product earns a return visit

The current product does not provide a business analytics dashboard. Start with a minimal, consent-aware pilot log. Avoid recording raw resumes or full interview messages in analytics.

| Measure | Definition and use |
| --- | --- |
| First-session value | Time from starting intake to the participant approving a usable first resume; record whether it happened and why not |
| Import correction burden | Number and type of meaningful corrections needed after import; do not treat successful text extraction as accurate interpretation |
| Claim accuracy | Participant-confirmed unsupported or overstated claims in drafts; investigate every reported invented fact |
| Job-review usefulness | For a fixed set of real postings, participant marks each review useful or misleading and explains why; separately record hard eligibility unknowns |
| Return use | Whether an activated participant returns within seven days to complete a meaningful action, such as reviewing a role or updating an application |
| Search activity | Approved resumes used and applications reported as completed; the tracker itself does not verify submission |
| Outcomes | Participant-reported screens and interviews with dates and context; no claim that Career Studio caused them |
| Service cost | AI requests and costs, support minutes, source/hosting costs, and failures per active participant |
| Paid intent | Response to a concrete proposed package and price, followed later by actual paid conversion once billing is available |

Define numerical continuation criteria before a cohort starts, then report counts and denominator together. A small pilot can reveal defects and signal interest; it cannot establish guaranteed hiring outcomes or broad market demand.

## Honest objection handling

| Prospect asks | Answer |
| --- | --- |
| “Why not just use ChatGPT?” | “You can use ChatGPT directly. Career Studio puts a reviewed career profile, resume versions, job reviews, and application history in one workflow. We are testing whether that structure saves enough effort to be worth paying for.” |
| “Can I use my ChatGPT subscription?” | “The current product includes AI through the service. You do not need a subscription or API key. A future Career Studio plugin would let you work inside ChatGPT using your own supported account, but that connection has not been built or released.” |
| “Will it get me a job?” | “It helps you describe your experience, examine roles, and organize the search. Employers make hiring decisions; we do not guarantee interviews or offers.” |
| “Does it apply everywhere for me?” | “You choose and submit applications yourself. The tracker records your progress and resume version.” |
| “Are these real openings?” | “The demo openings are fictional. The authenticated product can assess public remote listings or postings you supply; availability and employer eligibility still need checking.” |
| “Will it invent my experience?” | “Suggestions are checked against supplied evidence and require review, but automated checks cannot guarantee truth. Reject inaccurate details and approve only wording you can support.” |
| “Is my resume private?” | “Real accounts store information on the service. With AI enabled and consent, relevant profile and interview information goes to the AI provider. Known contact fields are removed where possible, but that is not complete anonymization. Export and active-account deletion are implemented; hosted retention and backup policies must be finalized before pilot access.” |
| “Is it ATS certified?” | “No. We provide readable resume documents for review. Layout and parsing should be checked on representative exports; we do not promise a universal ATS score or certification.” |

## Boundaries for every pitch

Show the implemented journey and describe future work as future work. Do not claim paying customers, verified skill assessments, guaranteed job fit, comprehensive job coverage, live AI in `/demo`, automatic applications, completed billing, enterprise security certification, or a production-supported personal subscription connection.

Before an external pilot, the engineering owner must verify real API behavior, hosting and HTTPS, customer isolation, backup restoration, source rights and coverage, truthful privacy disclosures, and support ownership using the operating guide. A good demo is useful evidence of product interaction; it does not complete those launch obligations.
