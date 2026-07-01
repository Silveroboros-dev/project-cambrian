# Situation Room Demo Script

Version: 0.1  
Date: 2026-06-30  
Audience: stakeholder, owner/operator, advisor, or internal demo review  
Target length: 4-6 minutes  

## Demo Claim

Project Cambrian is a local Situation Room for trusted Swiss Treuhand workflows. Humans tag workflow and control agents into shared rooms; agents create typed, evidence-linked cards and governed work orders; sensitive actions require human approval; validation records and metrics separate synthetic fixtures from real reviewer proof.

This is not production proof. It is a local demo of the operating model before asking for 3-5 anonymized real Treuhand cases.

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

## Opening Talk Track

Use this:

> This is not a Slack clone, not Gmail integration, not browser DLP, not IAM, and not an autonomous accounting system. It is a local operating model for testing governed agent-assisted Treuhand workflows.

Then set the proof boundary:

> Everything here is synthetic/local. The demo shows how the operating loop would work: tags become work orders, agents create typed cards, sensitive actions stop at human approval, and validation remains separate from fixture proof.

## Click Path

### 1. Situation Room Boundary

Start on `Situation`.

Show:

- local synthetic label;
- no external side effects;
- six active agents panel;
- demo guide;
- room-scoped chat;
- artifact packs.

Say:

> The Situation Room is the operating surface. The key point is not chat. The key point is that agent work becomes typed cards, work orders, approvals, and audit records.

### 2. Run Demo Conductor Acts

Click `Reset demo state`, then run the numbered `Demo conductor` acts one by one:

1. `Inbound email intake`
2. `Confidential upload attempt`
3. `Employee onboarding`
4. `Agent handoff gap`
5. `Weekly control audit`

Expected result:

- each act opens the relevant room with the `Cards` artifact pack selected;
- each act first shows an `Event Source` panel naming the synthetic source, trigger, source actor, payload preview, expected agents, `sourceEventId`, and local-only adapter boundary;
- each act updates `Created this act` with cards, work orders, approvals, and local log counts;
- each act shows why a generic chatbot is weaker than the governed Cambrian agent loop;
- all six active agents show participation;
- clicking an active-agent row opens its details in a centered pop-up; clicking the same row again collapses it without pushing lower panels down;
- cards and work orders are created;
- approval requests remain pending.

Say:

> We are not asking a chatbot a question. We are walking through operating events. Each click starts with a visible synthetic event source, then creates governed artifacts: cards, work orders, approval gates, and logs. The contrast line shows what a generic chatbot would miss.

### 3. Inspect Cards, Work Orders, Approvals

Open the relevant rooms:

- `Treuhand Case Room`;
- `Security Room`;
- `Onboarding Room`;
- `Weekly Control Room`.

Use `Artifact packs` rather than scrolling a single timeline:

- `Agent cards`;
- `Next steps`;
- `Events`;
- `Work orders`;
- `Approvals`;
- `Local logs`.

Show on expanded cards:

- `cardId`;
- `roomId`;
- `workOrderId`;
- `sourceEventId`;
- `agentId`;
- `caseId`;
- `traceId`;
- `evidenceIds` where relevant;
- `approvalId` where relevant;
- `synthetic/local only`.
- local timestamp.

Say:

> Cards are typed records, not opaque chat messages. The chat is retained per room, and dense output is packed into reviewable artifact views.

### 4. Approve Or Reject One Gate

Use one individual `Approve` or `Reject` button, or click `Approve all demo-safe approvals`.

Show:

- approval status updates;
- related work order status updates;
- approval card says local approval recorded only;
- a responsible-agent next-step proposal appears in `Pending next steps`;
- next-step choices are selected with `Select locally`;
- selected follow-through shows a local record ID;
- no email, access grant, or memory promotion occurred.

Say:

> Approval is not the end of the loop. After the human decides, the responsible agent proposes the next safe local step. The human selects it, and Cambrian records the consequence without sending emails, granting access, or changing production memory.

Then click one `Select locally` choice or use `Select first pending next step locally`.

Say:

> This is governed follow-through. The selected consequence is an auditable local record, not an external action.

### 5. Use Agent Tags

In the tag input, try one command:

```text
@sec check upload
```

Other supported local commands:

```text
@ingest process inbound email
@treu run intake review
@auth onboard junior accounting assistant
@gap inspect handoff
@cad run weekly audit
```

Say:

> These commands route to deterministic local scenarios. A system chat reply names the created work order, cards, and approval gates so it is obvious that the command produced artifacts.

### 5a. Show Logs And Metrics

Open the `Local logs` artifact pack, then open `Metrics`.

Show:

- logs are room-scoped;
- every log has `logId`, `roomId`, artifact ID, and timestamp;
- Metrics shows Situation Room messages, cards, work orders, reviewed gates, pending next steps, selected follow-through, review actions, blocked work, and logs.

Say:

> Logs are local only. They live in browser localStorage under `agentops-core-store-v1`, in `situationEventLog` plus the room message, card, work-order, and approval arrays.

### 6. Open Validation

Click `Validation`.

Show:

- sample imports;
- fixture labels;
- reviewer capture;
- before/after operating memo;
- validation package export guard.

Say:

> The Situation Room shows the operating loop. Validation is where we test whether the loop creates real reviewer value.

### 7. Show Metrics Separation

Click `Metrics`.

Show:

- fixture seed records separate from human captures;
- real reviewer cases at zero until anonymized reviewer cases exist;
- traceability coverage language.

Say:

> Fixture data proves workflow shape only. It does not count as operating proof.

### 8. Close With The Business Ask

Say:

> The next ask is 3-5 anonymized Treuhand cases. Not production access, not raw client files, not Gmail or Slack permissions. Just enough anonymized packets to test reviewer trust, time saved, and failure modes.

## Demo Part 2: One Week Later

At the end of part 1, click `Save demo snapshot` and keep the generated JSON.

One week later:

1. Open the app.
2. Paste the JSON into `Load snapshot JSON`.
3. Click `Load snapshot`.
4. Click `Advance one week`.
5. Open `Weekly Control Room`.
6. Inspect `Agent cards` and `Local logs`.

Expected result:

- prior room messages, source events, cards, work orders, approvals, next-step selections, follow-through records, validation records, and local logs are restored;
- `A-CAD-001` creates a week-two continuity work order;
- the week-two cards summarize prior source-event count, prior log count, prior local follow-through decisions, unresolved approvals, blocked work, and next business ask;
- no database, backend, or external connector is used.

Say:

> This proves demo continuity without production infrastructure. If we need multi-user audit guarantees later, the snapshot format becomes the seed for a real append-only ledger or database. For now, it keeps the proof portable and honest.

## Pass Condition For The Demo

A viewer should understand:

- there is one Treuhand workflow agent plus five active control agents;
- the Situation Room is the main operating surface;
- each active agent visibly did useful work;
- agent work became typed cards and governed work orders;
- chat is retained per thematic room;
- dense state is packed into artifact views;
- draft sending, access grants, and memory updates require human approval;
- human approval/rejection creates responsible-agent next-step proposals;
- selected next steps create local follow-through records only;
- review actions update local Situation metrics;
- logs and timestamps make the local sequence reviewable;
- demo state can be carried to part 2 with a versioned local snapshot;
- scenarios are synthetic/local;
- validation output is separate from fixture proof;
- the next business ask is 3-5 anonymized real Treuhand cases.

## Stop Conditions

Stop the demo honestly if the audience asks for:

- production security guarantees;
- real Gmail, Slack, Drive, browser, IAM, telemetry, or database integration;
- real customer data ingestion;
- autonomous accounting decisions;
- evidence that synthetic fixtures already prove customer value.
