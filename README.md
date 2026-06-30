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
- No 4Trade data ingestion until anonymized samples are available.

## Project Specs

- [Working spec](docs/agentops-core-working-spec.md): current product contract for the meta-harness direction, context packets, handoffs, gap analysis, memory, and implementation sequence.
- [Harness UI contract](docs/harness-ui-contract.md): acceptance criteria and data-binding rules for context/control-agent surfaces.
- [First slice](docs/first-slice.md): narrow Treuhand validation plan.
- [Operator acquisition thesis](docs/operator-acquisition-thesis.md): strategic boundary for the future acquisition or holding-company option.
- [Original thesis](ai_native_operating_layer_agent_spec.md): broader strategic source document.

## Fail-Fast Validation

The next useful proof requires 10-20 anonymized Treuhand cases from 4Trade or another accounting workflow owner.

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
