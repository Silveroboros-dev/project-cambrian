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
- [Phase 2 case import format](docs/phase2-case-import-format.md): versioned anonymized case format for local validation.
- [Phase 2 demo script](docs/demo-script-phase2.md): stakeholder click path, talk track, expected questions, and next-step proposal.
- [Phase 2 anonymized data request](docs/phase2-anonymized-data-request.md): one-page request for 3-5 friendly reviewer cases.
- [Phase 2 internal demo review](docs/phase2-internal-demo-review.md): template for objections and go/no-go after an internal demo run.
- [Strategic queue map](docs/strategic-queue-map.md): stakeholder-facing vertical queue structure and activation boundaries.
- [Queue evaluation rubric](docs/queue-evaluation-rubric.md): scoring tool for future queue activation.
- [First slice](docs/first-slice.md): narrow Treuhand validation plan.
- [Operator acquisition thesis](docs/operator-acquisition-thesis.md): strategic boundary for the future acquisition or holding-company option.
- [Original thesis](ai_native_operating_layer_agent_spec.md): broader strategic source document.

## Phase 2 Validation Loop

The local app includes a `Validation` tab for bundled anonymized Treuhand sample cases.

Use it to:

1. load a bundled sample case;
2. inspect the configured checklist and baseline manual time;
3. run `A-TREU-001` from the Case tab;
4. capture reviewer rating, failure tags, and trace annotation;
5. read the generated before/after operating memo.

The `Run all samples` action in the Validation tab replays the bundled sample cases locally and creates validation records and operating memos without external services.

The bundled fixtures live in [src/phase2SampleCases.js](src/phase2SampleCases.js). The validation logic lives in [src/validation.js](src/validation.js).

## Fail-Fast Validation

The next useful proof requires 10-20 anonymized Treuhand cases from a pilot accounting firm or another accounting workflow owner.

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
