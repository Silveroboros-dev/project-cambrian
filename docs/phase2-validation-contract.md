# Phase 2 Validation Contract

Version: 0.1  
Date: 2026-06-30  
Scope: local Treuhand validation kit  

## Purpose

Phase 2 validates whether the Treuhand intake agent creates measurable operating value on anonymized cases.

The validation surface must not imply production readiness, legal advice, accounting conclusions, tax filing readiness, or acquisition readiness. It exists to capture before/after evidence for Swiss SME Treuhand workflows.

## Surfaces

1. **Validation**
   Shows sample case imports, import validation status, baseline data, configured checklist, reviewer capture, failure tags, trace annotations, and before/after operating memo.

2. **Case**
   Runs `A-TREU-001` against the active case and its configured checklist.

3. **Metrics**
   Aggregates only local validation records, review decisions, and deterministic run output.

## Identity Keys

Every Phase 2 validation artifact must be scoped by explicit identity keys:

- `caseId` for case-scoped state;
- `sampleCaseId` for bundled anonymized fixtures;
- `validationRecordId` for captured Phase 2 reviewer/baseline records;
- `runId` for the agent run being reviewed;
- `checklistItemId` for configured checklist items;
- `ratingId` for reviewer rating records;
- `annotationId` for trace annotations;
- `failureTagId` for failure tags.

## Truth Labels

- Sample fixtures are anonymized demo inputs, not customer data.
- Imported cases are candidate validation cases, not production records.
- Baseline time is human-reported operating evidence, not measured telemetry.
- Agent outputs are deterministic recommendations requiring review.
- Reviewer ratings are human feedback for validation, not canonical accounting truth.
- Failure tags are diagnostic labels and do not mutate evidence, checklist truth, or memory.
- Trace annotations are reviewer notes attached to a case/run and are not durable memory.
- The before/after operating memo is a validation artifact, not an investor memo or external claim.

## Mutation Rules

Allowed local mutations:

- load bundled anonymized sample cases into local state;
- run `A-TREU-001` using the active case checklist;
- capture baseline manual minutes and handoff count;
- capture reviewer rating, time-saved estimate, would-use-again flag, failure tags, and trace note;
- create or update validation records in `localStorage`;
- render before/after operating memo text from captured local data.

Forbidden mutations:

- use real customer data;
- call external services;
- send emails or file tax/accounting outputs;
- approve memory automatically;
- alter raw evidence after import;
- treat reviewer ratings as accounting conclusions;
- advance acquisition, fund, or legal conclusions from validation data alone.

## Acceptance Criteria

### AC-P2-1: Case Import Format

The repo must define and document a versioned Phase 2 case import format with `caseId`, `period`, `evidence`, `checklist`, `baseline`, and optional reviewer/trace fields.

### AC-P2-2: Two Anonymized Sample Cases

The validation kit must include at least two anonymized Treuhand/accounting sample cases that can run end to end locally.

### AC-P2-3: Configured Checklist Drives Output

The Treuhand agent must use the active case's configured checklist when available. Changing checklist items must affect missing-item detection.

### AC-P2-4: Baseline Capture

The validation record must capture baseline manual preparation minutes and manual handoff count for the case.

### AC-P2-5: Reviewer Rating Capture

The validation record must capture reviewer usefulness, checklist trust, evidence traceability, time-saved estimate, would-use-again decision, and reviewer notes.

### AC-P2-6: Required Failure Tags

The validation workflow must expose the failure tags `wrong_classification`, `weak_evidence`, `missing_context`, `noisy_gap_finding`, `unsafe_draft`, and `checklist_mismatch`.

### AC-P2-7: Trace Annotation

The validation workflow must capture a trace annotation scoped to the active `caseId` and latest `runId`.

### AC-P2-8: Before/After Operating Memo

The validation workflow must produce a before/after operating memo using captured baseline data, agent output, reviewer rating, failure tags, and evidence-linked run metrics.

### AC-P2-9: Local-Only Boundary

Phase 2 validation must not require a database, LLM call, production connector, real authentication system, external service, or new dependency.

### AC-P2-10: Tests And Smoke Coverage

Automated tests and smoke checks must prove that the import format, sample cases, checklist behavior, reviewer capture, failure tags, trace annotation, operating memo, and UI entry point exist.

