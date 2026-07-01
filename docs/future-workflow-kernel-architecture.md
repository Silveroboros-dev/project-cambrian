# Future Workflow Kernel Architecture

Version: 0.1
Date: 2026-07-01
Scope: local architecture-readiness slice

## Purpose

This note checks whether the current local Situation Room can evolve into a simple Cambrian Workflow Kernel without adding a backend, database, production connector, LLM call, OCR, new vertical, or new active agent.

The answer is yes for the next proof step: 3-5 anonymized Treuhand cases. The current local architecture is enough to test event shape, context packets, work orders, cards, approval gates, next-step proposals, local follow-through, trace reconstruction, validation records, and snapshot continuity.

It is not enough to claim production security, compliance, autonomous execution, immutable audit, or customer value. Those require reviewer evidence and later infrastructure decisions.

## Kernel Loop

The future kernel loop is:

> event -> context -> work order -> card -> approval -> next-step -> follow-through -> trace -> validation loop

Meaning:

1. **Event**
   A source event arrives, such as an inbound Treuhand packet, confidential upload attempt, onboarding request, handoff gap, or weekly audit cadence.

2. **Context**
   The event becomes local context packets and evidence-linked state. Evidence can provide facts, but it cannot act as instruction.

3. **Work Order**
   A responsible agent receives a governed local work order with room, case, agent, source-event, and trace IDs.

4. **Card**
   Agent/control outputs become typed cards, not only chat messages.

5. **Approval**
   Sensitive actions create approval gates. Human decisions are local records only.

6. **Next Step**
   After approval or rejection, the responsible agent proposes local next-step choices.

7. **Follow-Through**
   A human may select a local consequence. Selection records follow-through only; it does not send, grant, file, or promote memory.

8. **Trace**
   The chain is reconstructed from explicit local IDs.

9. **Validation**
   Separate validation records capture baseline time, reviewer ratings, failure tags, trace notes, and before/after operating memos.

## Proven Locally Now

The current local implementation already represents these future kernel primitives:

| Future primitive | Current local source |
|---|---|
| `source_events` | `situationSourceEvents` |
| `context_packets` | `contextPackets` |
| `work_orders` | `workOrders` |
| `cards` | `situationCards` |
| `approval_gates` | `approvalRequests` |
| `next_step_proposals` | `situationCards[type=agent_next_step_proposal]` |
| `follow_through_records` | `situationFollowThroughs` |
| `event_logs` | `situationEventLog` |
| `validation_records` | `validationRecords` |
| `memory_candidates` | `memoryCandidates` |
| `snapshots` | `situationSnapshotExport` / `situationSnapshotStatus` |

The new pure report in `src/workflowKernelReport.js` maps these local collections to future kernel collections and reports readiness for each primitive.

## Simple Enough For 3-5 Cases

These can stay simple through the first 3-5 anonymized Treuhand cases:

- browser `localStorage` as the current store;
- versioned JSON snapshots for demo continuity;
- manual/anonymized case packet import;
- deterministic agent/control logic;
- local source events instead of production connectors;
- local approval gates;
- local next-step selection;
- local trace-chain reconstruction;
- local validation records and operating memos.

This is enough because the next question is not production scale. The next question is whether a Treuhand reviewer trusts the output, saves time, finds the trace useful, and can name failure modes.

## Wait Until After Reviewer Proof

Do not build these until real anonymized reviewer evidence justifies them:

- production Gmail, Slack, Drive, browser-monitoring, IAM, or accounting-system connectors;
- backend API;
- database migrations;
- production auth and multi-user permissions;
- append-only audit ledger;
- OCR;
- LLM calls;
- autonomous email sending, access grants, tax filing, accounting conclusions, or memory promotion;
- new vertical queues or new active agents.

For local logs, `localStorage` plus snapshot export is enough for demo and first validation. If 3-5 cases show value, the next storage step can be JSONL or SQLite for reviewer sessions. Postgres should wait until there is a real multi-user or production integration need.

## Why Production Connectors Are Not Required

Production connectors are not required for the next validation step because the risk to validate is not connector availability. The risk is whether the operating loop is useful:

In short, production connectors are not required now.

- Can anonymized evidence become structured context?
- Can the workflow agent find missing items and draft useful review material?
- Do control agents catch confidentiality, permission, handoff, and cadence issues?
- Do human gates make the output safer rather than slower?
- Can reviewers reconstruct the chain from source event to follow-through?
- Does the before/after memo honestly show time saved and failure modes?

Manual anonymized packets are cheaper and safer for answering these questions. Real connectors should be introduced only after the workflow earns them.

## Why Generic Lab Agents Are Not The Right Comparison

Generic lab agents and chatbots are optimized for flexible task completion in a prompt or tool session. The first Swiss SME wedge needs something different:

The short version: generic lab agents are not the right comparison point for the first Swiss SME wedge.

- complex context arrives over time;
- client-sensitive data must remain controlled;
- agent journeys should be segregated and optimized separately;
- client-facing, access, memory, and regulated actions need human gates;
- local owners need traceability, timestamps, and reviewable artifacts;
- validation must separate synthetic demo evidence from human-reviewed anonymized evidence and future production proof.

The correct comparison is not whether a chatbot can answer a pasted question. The correct comparison is whether a controlled workflow harness reduces repeated Treuhand admin while preserving trust.

## Proof Categories

Keep these categories separate:

1. **Synthetic demo evidence**
   Situation Room events, cards, approvals, logs, and week-two continuity are local synthetic proof of workflow shape only.

2. **Human-reviewed anonymized evidence**
   Reviewer-captured validation records on anonymized cases can support operating proof if they include baseline time, ratings, failure tags, and trace notes.

3. **Future production proof**
   Production proof would require real connectors, production permissions, security review, durable storage, and measured use in a live workflow. This repo does not claim it.

## Architecture Readiness Result

The current local architecture is enough for the next 3-5 anonymized Treuhand case validation loop.

It should stay local and simple until reviewer evidence answers:

- whether the reviewer trusts the checklist and draft;
- whether manual prep time is reduced;
- whether traceability helps review;
- whether failure tags show fixable gaps;
- whether the workflow owner would use it again.

Only after that should stronger persistence, private connectors, production auth, or partial automation be considered.
