# First Slice: Treuhand Intake Proof

## Hypothesis

Treuhand teams lose measurable time before accounting judgment begins: collecting documents, checking completeness, classifying evidence, chasing missing items, and preparing review notes.

If an agent prepares that intake package with evidence links and a human review gate, the team should save time without increasing compliance risk.

## Build Boundary

The first repo only implements the local operating loop:

- seeded agent backlog;
- one demo Treuhand case;
- manual evidence entry;
- deterministic classification;
- missing-document checklist;
- draft reminder email;
- review queue;
- audit events;
- simple metrics.

It intentionally excludes databases, OCR, production auth, cloud storage, LLM calls, SmartCore integration, and outbound email.

## Fastest Real-World Test

Ask 4Trade for 10 anonymized monthly or quarterly document-intake cases.

For each case:

1. record current manual prep time;
2. paste anonymized evidence text into the prototype;
3. run `A-TREU-001`;
4. have a human accountant rate the output;
5. compare missing-item detection and prep time.

## Before/After Operating Memo

The first useful artifact after Phase 2 is not a deck. It is a short operating memo:

```text
Workflow:
Manual baseline:
Agent-assisted result:
Hours or minutes saved:
Review burden created:
Evidence quality:
Recurring failure modes:
Owner/operator value:
Decision:
```

The memo must be honest enough to support a stop decision. If the agent only produces a better-looking demo without measurable operating lift, the slice has failed.

## Stakeholder Demo Narrative

Open with the demo case, not a pitch.

Show:

1. evidence items;
2. agent run output;
3. missing VAT report;
4. draft email requiring human approval;
5. audit trail;
6. metrics view;
7. what data is needed next.

Do not open with a fund, acquisition vehicle, or holding-company story. The credible stakeholder story is that the project is validating an AI-native operating playbook for Swiss service SMEs. Acquisition or co-investment discussions only make sense after measured workflow improvement.

## Decision Rule

Continue if a real reviewer says:

- this would save time;
- the checklist is mostly right;
- evidence links make the output reviewable;
- the draft email is useful after edits.
- they would use the workflow again on another real case.

Stop or pivot if:

- anonymized data is unavailable;
- reviewer distrusts the checklist;
- exceptions are too firm-specific for a reusable first product;
- manual review takes longer than starting from scratch.
- a useful demo depends on production connectors before manual context packets have proven value.
