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

## Decision Rule

Continue if a real reviewer says:

- this would save time;
- the checklist is mostly right;
- evidence links make the output reviewable;
- the draft email is useful after edits.

Stop or pivot if:

- anonymized data is unavailable;
- reviewer distrusts the checklist;
- exceptions are too firm-specific for a reusable first product;
- manual review takes longer than starting from scratch.
