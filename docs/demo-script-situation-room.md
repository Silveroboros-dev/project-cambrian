# Situation Room Demo Script

Version: 0.2
Date: 2026-07-01
Audience: stakeholder, Swiss SME operator, Treuhand founder, workflow owner, advisor, or internal demo review
Target length: 10-14 minutes

## Demo Objective

This demo must convince the viewer of one practical claim:

> Project Cambrian is a controlled agent operating harness for trusted Swiss service workflows. It helps human experts handle more repetitive work with better context, safer gates, stronger traceability, and clearer follow-through than a generic chatbot or one-off agent prompt.

The active proof is Treuhand/accounting document intake and control workflows. The broader idea is not to launch a fund, sell a generic AI platform, or automate professional judgment. The near-term objective is to prove measurable operating lift in one workflow: minutes saved, faster response, fewer handoff misses, clearer evidence, and reviewer trust.

Use this script to show:

- one Treuhand workflow agent plus five control agents;
- the Situation Room as a meta-harness, not just chat;
- typed cards, work orders, approvals, trace chains, local logs, and metrics;
- human gates before client-facing, access, or memory actions;
- per-agent journeys that can be separated, tuned, and later automated where safe;
- a one-week continuity follow-up without adding production infrastructure.

## Opening Value Proposition

Start on the `Situation` tab. Say:

> Many Swiss service SMEs have loyal clients and trusted human relationships, but their back office is still too manual: document chasing, fragmented email context, review packs, missing-item checks, onboarding requests, security exceptions, handoffs, and recurring control reviews.
>
> Project Cambrian is not trying to replace the advisor. It is trying to give the advisor an AI-native back office: agents prepare the work, check completeness, route risk, leave an audit trail, and stop at human approval where trust or compliance matters.

Then make the generic-bot contrast explicit:

> A generic chatbot is useful when a human already knows what to paste, what to ask, and what to verify. The problem in operations is different. Context arrives over time, different agents own different parts of the journey, risky actions need gates, and the organization needs to reconstruct what happened later. This demo shows that operating loop.

Set the proof boundary:

> Everything here is synthetic and local. There is no Gmail polling, Slack integration, browser monitoring, IAM change, email sending, LLM call, or production database. The point is to test the operating model before asking for anonymized real Treuhand cases.

If the viewer asks whether this exact implementation is required, say:

> This is a deliberately rich local harness for demonstration. A real implementation can be simpler or more complex. A small firm might start with one workflow agent, one approval gate, and local JSON imports. A larger operator might later add private connectors, role-based access, an append-only audit store, and partial automation. The invariant is the same: context, agent work, gates, traceability, and measured value.

## Feature Overview Before Clicking

Keep this under one minute.

Show the top guide, active agents, room list, Demo conductor, pending approvals, and artifact packs.

Say:

> The Situation Room is the meta-harness. It is the surface where humans and agents coordinate, but the valuable object is not the chat message. The valuable objects are typed cards, work orders, approval gates, trace chains, local logs, and validation metrics.

Name the six active agents:

- `A-TREU-001` prepares the Treuhand intake package.
- `A-INGEST-001` normalizes incoming evidence into context packets.
- `A-SEC-001` detects sensitive content and risky instructions.
- `A-AUTH-001` handles permissions, least privilege, and approval gates.
- `A-GAP-001` watches handoffs and proposes missing skills or memory candidates.
- `A-CAD-001` performs cadence, audit, and operating review.

Then say:

> This is stronger than a generic agent because the journeys are segregated. Security does not become accounting. Authorization does not become memory. Cadence does not silently execute work. Each agent has a job, allowed actions, forbidden actions, and review boundaries. Later, if evidence proves a step is low-risk and repeatable, that step can move toward full automation. Sensitive steps stay gated.

## Setup

Run:

```bash
npm test
npm run smoke
npm run serve
```

Open:

```text
http://127.0.0.1:5173
```

The app opens on `Situation`.

Before the live demo, click `Reset demo state`.

Say:

> Reset gives us a clean local demo. The numbered acts create visible artifacts. Nothing here is being fetched from or sent to external systems.

## Presenter Rule

Use `Demo focus` as the rail for the walkthrough. After every act, read the four fields:

- `What just happened`;
- `Where to look`;
- `Why it matters`;
- `Next click`.

Then show only the highlighted blocks. This prevents the viewer from drowning in information while still proving that the artifacts exist.

## Demo Walkthrough

### Act 1: Inbound Email Intake

Click `Inbound email intake`.

Say:

> This simulates an email hitting the mailbox inside an intake window. A generic chatbot would wait until someone pasted the email and explained the workflow. Cambrian treats the event as operating input: it creates a source event, normalizes evidence, opens work, runs the Treuhand review, and blocks the draft behind human review.

Show `Demo focus`, then walk the highlighted blocks.

#### Event Source

Show:

- synthetic source;
- trigger;
- source actor;
- payload preview;
- expected agents;
- `sourceEventId`;
- local adapter boundary.

Say:

> The source event is important. We can later replace this synthetic event with a real connector, but the agent journey does not depend on a magical chat prompt. The workflow starts from an operating event.

#### Created This Act

Show:

- cards created;
- one work order;
- one approval gate;
- local log count;
- chatbot contrast;
- Cambrian contrast.

Say:

> This is where the demo becomes more than chat. The agent output is not one answer. It is a packet of work: cards, a work order, an approval, and logs.

#### Walk Every Card In This Act

Open `Artifact packs` -> `Agent cards`. Walk these cards:

1. `Inbound mailbox message received`
   - This is the raw operating event.
   - It proves the workflow can begin from an event, not only from a human prompt.

2. `Context packet created`
   - `A-INGEST-001` normalized the evidence.
   - This matters because complex context should become structured transport between agents.

3. `Security check completed`
   - `A-SEC-001` inspects the run for warnings.
   - Generic bots usually rely on the same model to notice its own risks; here the control path is separate.

4. `Treuhand intake review completed`
   - `A-TREU-001` prepares the missing-item and draft-follow-up work.
   - This is the narrow business wedge: document intake and closing prep.

5. `Human review required`
   - `A-AUTH-001` blocks the client-facing draft.
   - This is the trust model: agents propose, humans dispose.

#### Trace Chain

Show `Trace Chain`.

Say:

> The important part is the chain. If a reviewer asks "why did this happen?", we can reconstruct it: source event, work order, cards, approval gate, and logs. This is a key difference from generic agents, where the useful work often disappears inside a chat transcript.

#### Approval Gate And Follow-Through

Approve or reject the `review_before_send` gate.

Then show:

- approval status changed;
- `A-AUTH-001` remains the gate agent;
- `A-TREU-001` creates the responsible next-step proposal;
- `Pending next steps` appears;
- `Select locally` records a consequence;
- `Selected follow-through` and `Trace Chain` update.

Say:

> Approval is not the end of the loop. The responsible agent proposes the next safe local step, the human selects it, and the consequence is recorded. No email is sent. No production action happens. But the organization now has a reviewable chain.

### Act 2: Confidential Upload Attempt

Click `Confidential upload attempt`.

Say:

> This is the moment a human tries to paste confidential material into an external assistant. A generic chatbot helps only after the data has already been pasted. A control agent can catch the risky action before exposure, classify the risk, and leave an audit trail.

Show `Demo focus`, then walk the highlighted blocks.

#### Walk Every Card In This Act

Open `Artifact packs` -> `Agent cards`. Walk these cards:

1. `External assistant upload attempted`
   - This is the risky human action represented as a local synthetic event.

2. `Sensitive content detected`
   - `A-SEC-001` identifies deterministic risk signals.
   - Point out that this does not require an LLM call in the current prototype.

3. `Upload blocked locally`
   - The safe action is to use an internal redacted packet.
   - This is the confidentiality value proposition.

4. `Audit event queued`
   - `A-CAD-001` can later summarize this in the weekly control review.
   - The security event becomes operating evidence, not a forgotten warning.

Say:

> This is a good example of why agent journeys should be segregated. The security agent has a narrower job than the workflow agent. That makes it easier to tune for false positives, confidentiality policy, and audit needs.

### Act 3: Employee Onboarding

Click `Employee onboarding`.

Say:

> Now we simulate onboarding a new employee. A generic chatbot can suggest access in a paragraph. Cambrian turns it into a least-privilege plan and blocks the real access claim behind a boss approval gate.

Show `Demo focus`, then walk the highlighted blocks.

#### Walk Every Card In This Act

Open `Artifact packs` -> `Agent cards`. Walk these cards:

1. `New employee onboarding requested`
   - This is the HR/admin event entering the harness.

2. `Role policy matched`
   - `A-AUTH-001` maps the role to a local policy.

3. `Access recommendation created`
   - The recommendation is constrained: read-only case packets and draft creation; no send permission; raw payroll blocked.

4. `Boss approval required`
   - The access claim stays pending until a human boss approves or rejects.

Say:

> The important point is not that this exact onboarding flow is production-ready. The important point is that access recommendations, approval gates, and local audit records are first-class objects. In a real deployment this can be very simple or much deeper, depending on the client's systems.

### Act 4: Agent Handoff Gap

Click `Agent handoff gap`.

Say:

> This act shows why a meta-harness matters. As agents multiply, the failure mode is not only one bad answer. It is missing context between agents, duplicated assumptions, and unapproved memory. Cambrian makes those gaps visible.

Show `Demo focus`, then walk the highlighted blocks.

#### Walk Every Card In This Act

Open `Artifact packs` -> `Agent cards`. Walk these cards:

1. `Agent handoff created`
   - `A-INGEST-001` handed period text to `A-TREU-001`.

2. `Handoff context missing`
   - `A-TREU-001` lacked normalized period context.

3. `Repeated failure pattern detected`
   - `A-GAP-001` identifies that this could become recurring noise.

4. `Skill update candidate created`
   - The agent proposes period-normalization skill or memory, but does not approve it.

Say:

> This is better than generic agents because improvement is governed. A chatbot can remember something informally or hallucinate a rule. Here, a skill candidate is proposed, tied to evidence, and gated before becoming operating memory.

### Act 5: Weekly Control Audit

Click `Weekly control audit`.

Say:

> This is the operating-review layer. A generic bot cannot reliably reconstruct what happened last week from scattered prompts. `A-CAD-001` reviews local logs, pending approvals, warnings, blocked work, and token spend status in one cadence.

Show `Demo focus`, then walk the highlighted blocks.

#### Walk Every Card In This Act

Open `Artifact packs` -> `Agent cards`. Walk these cards:

1. `Weekly audit due`
   - A synthetic weekly cadence event fired locally.

2. `Agent runs summarized`
   - The cadence agent summarizes agent activity.

3. `Security findings summarized`
   - The confidential upload warning is now part of the operating review.

4. `Pending approvals summarized`
   - Open gates remain visible.

5. `Token spend summarized`
   - In this deterministic prototype, token spend is zero or not applicable.

Say:

> This is where the project starts to look like an operating system for workflow control, not a chatbot. The cadence agent can become a manager's review assistant. Some reviews may always stay human-led. Others can later become automated if the risk is low and the proof is strong.

## Show Agent Cards And Segregated Journeys

Click one active agent card in the active agents block, then close it.

Say:

> The agent card is not marketing decoration. It shows each agent's role, latest work, output count, allowed boundary, and approval requirements. A real deployment can optimize each journey separately: ingestion for recall, security for containment, authorization for least privilege, gap analysis for useful signal, cadence for operating pressure, and Treuhand for reviewer time saved.

Then say:

> This is one of the strongest reasons this is better than generic agents. Generic bots collapse the whole workflow into one conversation. Cambrian separates the workflow into inspectable responsibilities, so we can tune, test, and automate each part differently.

## Show Artifact Packs

Use the pack buttons:

- `Agent cards`;
- `Next steps`;
- `Events`;
- `Work orders`;
- `Approvals`;
- `Local logs`.

Say:

> Dense output is packed into reviewable artifact views. This prevents the Situation Room from becoming an endless wall of chat. Chat is useful for human coordination, but the business value lives in structured artifacts.

Call out fields on any card:

- `cardId`;
- `roomId`;
- `workOrderId`;
- `sourceEventId`;
- `agentId`;
- `caseId`;
- `traceId`;
- `approvalId` where relevant;
- `truth: synthetic_local`;
- local timestamps.

Say:

> These identifiers are what make review, audit, and debugging possible. If an agent makes a weak recommendation, we should know which context, rule, card, approval, and trace produced it.

## Show Metrics And Logs

Open `Local logs`, then open `Metrics`.

Show:

- room-scoped logs;
- timestamps;
- Situation Room messages;
- cards;
- work orders;
- approval decisions;
- blocked work;
- pending next steps;
- selected follow-through;
- local logs.

Say:

> The metrics are not vanity metrics. They answer whether the operating loop is alive: did agents create work, did humans review gates, did follow-through happen, did blocked work remain visible, and can we reconstruct the sequence?

Then connect to the pitch:

> The business thesis is not "AI features shipped." It is average operating lift: less repetitive admin, faster response, fewer handoff failures, lower review burden, and better documentation.

## Show Validation Boundary

Click `Validation`.

Say:

> The Situation Room shows the operating loop. Validation is where we test whether it creates real reviewer value. Fixture data proves workflow shape only. It does not prove customer value.

Show:

- sample imports;
- fixture labels;
- reviewer capture;
- failure tags;
- before/after operating memo;
- export privacy gate.

Say:

> The next proof is 3-5 anonymized Treuhand cases, then 10-20 if the first cases are useful. We need baseline manual time, checklist trust, reviewer rating, failure tags, and would-use-again evidence. If those do not hold, the broader thesis should stop or narrow.

## One-Week Follow-Up

This is part two of the demo. Keep it short. Show only one week-two card.

At the end of part one:

1. Click `Save demo snapshot`.
2. Keep the generated JSON.

One week later:

1. Open the app.
2. Paste the JSON into `Load snapshot JSON`.
3. Click `Load snapshot`.
4. Click `Advance one week`.
5. Open `Weekly Control Room`.
6. Open `Agent cards`.
7. Show only `Week 2 prior log review`.

Say:

> This is demo continuity without production infrastructure. One week later, `A-CAD-001` can review prior source events, local logs, approvals, follow-through decisions, and work orders from the imported local snapshot.

Walk the single card:

`Week 2 prior log review`

- It summarizes how many source events existed.
- It summarizes prior local logs.
- It counts approval gates.
- It counts local follow-through decisions.
- It references existing local work orders.

Say:

> This is enough for part two. We do not need to replay every artifact again. The point is that local work is portable and reviewable. If a client later needs multi-user audit guarantees, this snapshot format can become the seed for a real append-only ledger or database. For now, it keeps the demo lean and honest.

## Why This Beats Generic Agents

Use these points repeatedly during the demo:

1. **Complex context**
   Generic chatbots require humans to gather and explain context. Cambrian turns operating events into context packets, work orders, cards, approvals, and traces.

2. **Segregated agent journeys**
   Ingestion, security, authorization, gap analysis, cadence, and Treuhand review can be tested and optimized separately. This reduces hidden coupling.

3. **Human gates**
   Client-facing drafts, access grants, and memory updates stop at approval. This preserves trust in sensitive workflows.

4. **Auditability**
   Every important artifact has IDs, timestamps, source-event links, trace IDs, and local logs. The chain can be reconstructed later.

5. **Reliability before autonomy**
   The prototype is deterministic and local. That is less exciting than a generic autonomous agent, but it is easier to test, trust, and sell into sensitive SMEs.

6. **Path to automation**
   Once a step is proven low-risk, repetitive, and valuable, it can move toward automation. The system does not need all workflows to be autonomous on day one.

7. **Business measurement**
   The goal is not a clever demo. The goal is reviewer trust, time saved, lower rework, faster response, and better documentation.

## Closing Talk Track

Say:

> The practical ask is not production access. It is not real mailbox integration. It is not raw client data. The next ask is 3-5 anonymized Treuhand cases so we can test reviewer trust, time saved, failure modes, and evidence traceability.
>
> If the proof is real, we can expand to 10-20 cases and then decide what integration depth is justified. Some clients may only need a simple controlled workflow assistant. Others may need a richer operating harness with private connectors and audit infrastructure. We should earn that complexity with evidence.

Then end with:

> The core thesis is wedge first, platform later. Prove one painful workflow, measure operating lift, and only then discuss broader Swiss SME operating transformation.

## Pass Condition

A viewer should leave understanding:

- Project Cambrian is a controlled operating harness for trusted workflows, not a generic chatbot;
- the current proof is Treuhand/accounting document intake and control workflows;
- six active agents are visible and role-separated;
- the Situation Room is a meta-harness for rooms, cards, work orders, approvals, traces, logs, and metrics;
- every demo act creates visible local artifacts;
- the five act card sets can be inspected one by one;
- sensitive actions require human approval;
- human approval creates responsible-agent next-step proposals;
- selected next steps create local follow-through records only;
- trace chains reconstruct source event to work order to cards to approval to follow-through to logs;
- validation separates fixture proof from real reviewer proof;
- one-week continuity works through a local snapshot and one `A-CAD-001` follow-up card;
- the next business ask is 3-5 anonymized real Treuhand cases.

## Stop Conditions

Stop or reframe honestly if the audience asks for proof of:

- production security guarantees;
- real Gmail, Slack, Drive, browser, IAM, LLM, telemetry, or database integration;
- real customer data ingestion;
- autonomous accounting, legal, tax, investment, payment, or access decisions;
- synthetic fixtures as proof of customer value;
- acquisition or fund-formation readiness before operating proof exists.
