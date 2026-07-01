# AgentOps Core

Controlled workflow-agent prototype for Swiss Treuhand/accounting operations.

This first repo is intentionally small. It is built to test one concrete claim:

> A deterministic workflow agent can reduce repetitive Treuhand document-intake work by preparing a case inventory, missing-item checklist, draft client follow-up, review queue item, audit trail, and simple operating metrics.

## Current Slice

- Vertical: Treuhand/accounting
- First agent: `A-TREU-001` Client Document Intake and Closing Prep Agent
- Runtime: static browser app plus pure JavaScript agent logic
- Storage: browser `localStorage`
- External services: none
- LLM usage: none
- Install step: none

## Run

```bash
npm test
npm run smoke
npm run serve
```

Then open:

```text
http://127.0.0.1:5173
```

## What It Proves

The prototype proves the operating loop, not production readiness:

1. Create or open a Treuhand closing case.
2. Add document, email, or note evidence.
3. Run `A-TREU-001`.
4. Review document inventory, missing items, warnings, draft email, and review pack.
5. Approve, edit, or reject the recommendation.
6. Inspect audit events and metrics.

## What It Does Not Do Yet

- No tax filing.
- No accounting conclusions.
- No client email sending.
- No OCR.
- No real file upload.
- No authentication.
- No database.
- No LLM calls.
- No pilot accounting firm data ingestion until anonymized samples are available.

## Project Specs

- [Working spec](docs/agentops-core-working-spec.md): current product contract for the meta-harness direction, context packets, handoffs, gap analysis, memory, and implementation sequence.
- [Harness UI contract](docs/harness-ui-contract.md): acceptance criteria and data-binding rules for context/control-agent surfaces.
- [Phase 2 validation contract](docs/phase2-validation-contract.md): acceptance criteria and identity/mutation rules for the Treuhand validation kit.
- [Situation Room contract](docs/situation-room-contract.md): local agent-tag, work-order, scenario-card, approval, and audit rules for the six-agent control loop.
- [Situation Room demo script](docs/demo-script-situation-room.md): opening stakeholder click path for the local six-agent Situation Room demo.
- [Future workflow kernel architecture](docs/future-workflow-kernel-architecture.md): architecture-readiness note mapping current local artifacts to a simple future workflow kernel.
- [Phase 2 case import format](docs/phase2-case-import-format.md): versioned anonymized case format for local validation.
- [Phase 2 demo script](docs/demo-script-phase2.md): stakeholder click path, talk track, expected questions, and next-step proposal.
- [Phase 2 anonymized data request](docs/phase2-anonymized-data-request.md): one-page request for 3-5 friendly reviewer cases.
- [Phase 2 internal demo review](docs/phase2-internal-demo-review.md): template for objections and go/no-go after an internal demo run.
- [Phase 2 real validation loop goal](docs/goal-phase2-real-validation-loop.md): next `/goal` for paste-JSON import, human reviewer capture, export package, and loop stop conditions.
- [Strategic queue map](docs/strategic-queue-map.md): stakeholder-facing vertical queue structure and activation boundaries.
- [Queue evaluation rubric](docs/queue-evaluation-rubric.md): scoring tool for future queue activation.
- [First slice](docs/first-slice.md): narrow Treuhand validation plan.
- [Operator acquisition thesis](docs/operator-acquisition-thesis.md): strategic boundary for the future acquisition or holding-company option.
- [Original thesis](ai_native_operating_layer_agent_spec.md): broader strategic source document.

## Phase 2 Validation Loop

The local app includes a `Validation` tab for bundled anonymized Treuhand sample cases and pasted anonymized reviewer packets.

Use it to:

1. load a bundled sample case;
2. paste and validate a `phase2.treuhand.case.v1` JSON packet;
3. inspect the configured checklist and baseline manual time;
4. run `A-TREU-001` from the Case tab;
5. capture reviewer rating, failure tags, and trace annotation;
6. read the generated before/after operating memo;
7. build a local validation package export after human capture.

The `Run all samples` action in the Validation tab replays the bundled sample cases locally and creates validation records and operating memos without external services.

Bundled sample ratings are marked as `fixture_seed`. Reviewer-session ratings are marked as `human_capture`, and the metrics dashboard separates the two so demo fixtures do not count as proof of business value.

The export package is local JSON containing `case`, `run`, `validationRecord`, `memo`, context packets, and security findings. Export is blocked by a local privacy gate if the package contains email addresses, credential-like text, IBAN-shaped identifiers, Swiss UID-shaped identifiers, or configured private-party terms.

The bundled fixtures live in [src/phase2SampleCases.js](src/phase2SampleCases.js). The validation logic lives in [src/validation.js](src/validation.js).

## Situation Room Prototype

The local app now opens on the `Situation` tab. This is the demo spine for the active operating model: one Treuhand workflow agent plus five control agents working in shared local rooms.

Click `Reset demo state`, then run the numbered `Demo conductor` acts one by one:

1. inbound email intake;
2. confidential upload attempt;
3. employee onboarding;
4. agent handoff gap;
5. weekly control audit.

Each act should first show an `Event Source` panel with the synthetic source, trigger, source actor, payload preview, expected agents, `sourceEventId`, and local-only adapter boundary. Then the `Created this act` panel shows new card, work-order, approval, and local-log counts, plus a contrast between a generic chatbot and the governed Cambrian agent loop. The adjacent `Trace Chain` panel reconstructs the active chain from source event to work order, cards, approval gate, next-step proposal, selected local follow-through, and logs. The demo should show six active agents, typed cards, work orders, pending approvals, no external side effects, and `synthetic/local` truth labels.

After a human approves or rejects a gate, the responsible agent creates a pending next-step proposal. The human selects a consequence with `Select locally`, and the app records a local follow-through artifact. This does not send email, grant access, promote memory, call external APIs, or execute production actions.

The approval gate agent and responsible follow-through agent are distinct where needed. For the Treuhand draft review, `A-AUTH-001` remains the local approval/control gate while `A-TREU-001` proposes the post-review follow-through. Onboarding access follow-through stays with `A-AUTH-001`; operating-memory candidate follow-through stays with `A-GAP-001`.

The `Demo readiness` report in the Situation guide summarizes the five conductor acts, six active agents, source events, work orders, approval gates, reviewed gates, pending next steps, selected follow-through records, real external effects, fixture/proof boundary, and the next business ask: 3-5 anonymized real Treuhand cases.

Each thematic room has its own retained local chat. Agent commands append a human message, create local artifacts when supported, and add a system reply naming the created work order/cards/approval gates. Dense output is packed into switchable `Agent cards`, `Next steps`, `Events`, `Work orders`, `Approvals`, and `Local logs` views so the demo does not require scanning one giant timeline.

Demo-useful tags also run local deterministic scenarios:

- `@ingest process inbound email`;
- `@treu run intake review`;
- `@sec check upload`;
- `@auth onboard junior accounting assistant`;
- `@gap inspect handoff`;
- `@cad run weekly audit`.

This is not a Slack clone, Gmail integration, browser DLP tool, IAM system, or autonomous accounting system. It is a local operating model for testing governed agent-assisted Treuhand workflows.

After the Situation Room walkthrough, open `Validation` to show the proof package: anonymized case import, reviewer capture, before/after memo, export privacy gate, and fixture-versus-human proof separation.

Local Situation Room state lives in browser `localStorage` under the app store key `agentops-core-store-v1`, specifically in `situationSourceEvents`, `situationFollowThroughs`, `situationEventLog`, `roomMessages`, `situationCards`, `workOrders`, and `approvalRequests`. The Metrics tab includes live Situation Room counts for messages, cards, work orders, approvals, pending next steps, selected follow-through, blocked work, review actions, and local logs.

For a second demo a week later, use `Save demo snapshot` to create a versioned local JSON snapshot, then `Load snapshot` on another browser/session to restore the state. `Advance one week` runs a synthetic continuity scenario where `A-CAD-001` reviews prior source events, local follow-through decisions, local logs, unresolved approvals, blocked work, and next business steps. This is portable demo persistence, not a production database or audit ledger.

## Fail-Fast Validation

The next useful proof requires 3-5 anonymized Treuhand cases from a friendly reviewer, pilot accounting firm, or another accounting workflow owner. If those cases show reviewer trust and measurable lift, expand to 10-20 cases.

For each case, collect:

- client and period metadata;
- current document checklist;
- anonymized document/email text or summaries;
- current manual intake time;
- missing items found by humans;
- reviewer rating of agent output.

Pass condition for the first stakeholder demo:

- at least 80% useful document classification on sample cases;
- all material claims linked to evidence IDs;
- every client-facing draft requires human approval;
- average manual prep time plausibly reduced by 20% or more;
- reviewer says the output would save time in a real workflow;
- workflow owner would use the process again on another case.

Fail condition:

- reviewer cannot trust the checklist;
- evidence links are too weak;
- output creates more review burden than it removes;
- anonymized data cannot be obtained;
- the story depends on acquisition/fund formation before operating proof exists.
