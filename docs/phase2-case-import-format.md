# Phase 2 Case Import Format

Version: 0.1  
Date: 2026-06-30  
Format version: `phase2.treuhand.case.v1`

## Purpose

This format captures anonymized Treuhand/accounting validation cases for the local Phase 2 workflow.

It is not a production connector format. It is a manual, inspectable case packet for proving whether the agent reduces document-intake work while preserving evidence links and human review.

## Required Object

```json
{
  "importVersion": "phase2.treuhand.case.v1",
  "sampleCaseId": "sample_case_001",
  "caseId": "case_sample_001",
  "title": "Sample Client A - March 2026 closing prep",
  "clientName": "Sample Client A",
  "period": "2026-03",
  "owner": "Client manager",
  "sourceSystem": "phase2_fixture",
  "baseline": {
    "manualPrepMinutes": 52,
    "manualHandoffCount": 3,
    "humanMissingItemIds": ["vat_report"]
  },
  "checklist": [
    {
      "id": "bank_statement",
      "label": "Bank statement for period",
      "required": true,
      "aliases": ["bank_statement"]
    }
  ],
  "evidence": [
    {
      "id": "ev_sample_bank_001",
      "type": "document",
      "title": "Bank statement March 2026",
      "content": "Anonymized evidence text...",
      "actor": "client",
      "receivedAt": "2026-04-03T09:10:00.000Z"
    }
  ],
  "reviewerRating": {
    "ratingSource": "fixture_seed",
    "overallUsefulness": 4,
    "checklistTrust": 4,
    "evidenceTraceability": 5,
    "timeSavedMinutes": 24,
    "wouldUseAgain": true,
    "failureTagIds": [],
    "notes": "Useful after accountant review."
  },
  "traceAnnotations": [
    {
      "annotationId": "ann_sample_001",
      "note": "VAT report was intentionally absent.",
      "targetType": "case"
    }
  ]
}
```

## Required Fields

| Field | Meaning |
|---|---|
| `importVersion` | Must equal `phase2.treuhand.case.v1`. |
| `caseId` | Stable local case identity. |
| `title` | Human-readable case title. |
| `clientName` | Anonymized client label. |
| `period` | Accounting period, such as `2026-03` or `Q1 2026`. |
| `baseline.manualPrepMinutes` | Human-reported manual prep time before agent assistance. |
| `baseline.manualHandoffCount` | Human-reported manual handoffs before agent assistance. |
| `checklist` | Case-specific document checklist used by `A-TREU-001`. |
| `evidence` | Anonymized source texts. |

## Optional Fields

| Field | Meaning |
|---|---|
| `sampleCaseId` | Fixture identity when bundled in the repo. |
| `sourceSystem` | Source label such as `manual_anonymized_packet` or `phase2_fixture`. |
| `baseline.humanMissingItemIds` | Missing checklist item IDs found by a human baseline. |
| `reviewerRating` | Seeded or captured reviewer feedback. |
| `reviewerRating.ratingSource` | `fixture_seed` for bundled demo ratings, `human_capture` for ratings entered during a reviewer session. |
| `traceAnnotations` | Human notes attached to a case or run. |

Fixture ratings are useful for demonstrating the loop, but they are not evidence of business value. Metrics must keep `fixture_seed` records separate from `human_capture` records.

## Validation Metrics

Agent checklist output must preserve `checklistItemId` so the validation record can compare:

- `baseline.humanMissingItemIds`;
- agent-detected missing checklist item IDs;
- false-positive missing items;
- false-negative missing items;
- missing-item recall and precision.

Missing-item claims are supported by absence from the checked evidence inventory, not by a single positive evidence document.

## Local Import And Export

For real reviewer sessions, paste an anonymized JSON object in this format into the Validation surface. The app must validate the packet locally before loading it. Invalid JSON or missing required fields must produce explicit errors and must not change the active case.

After an agent run and `human_capture` reviewer rating are saved, the app can export a local validation package:

```json
{
  "packageVersion": "phase2.validation.package.v1",
  "case": {},
  "run": {},
  "validationRecord": {},
  "memo": "...",
  "contextPackets": [],
  "securityFindings": []
}
```

The export package is blocked if a local privacy check finds personal emails, credential-like strings, IBAN-shaped identifiers, or configured private-party terms. Prompt-injection taint markers on context packets must remain visible in the package.

## Failure Tags

The validation workflow uses these exact diagnostic tags:

- `wrong_classification`
- `weak_evidence`
- `missing_context`
- `noisy_gap_finding`
- `unsafe_draft`
- `checklist_mismatch`

Failure tags are validation labels only. They do not modify raw evidence, checklist truth, durable memory, or accounting conclusions.

## Anonymization Rules

Do not include:

- real client names;
- personal emails;
- phone numbers;
- bank account numbers from real clients;
- tax IDs;
- payroll details linked to identifiable people;
- unredacted contracts;
- credentials, API tokens, or screenshots from real systems.

Use synthetic names such as `Sample Client A` and rounded or fictional amounts. Preserve only enough structure to test document classification, checklist completeness, evidence links, and reviewer burden.
