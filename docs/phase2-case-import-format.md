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
| `traceAnnotations` | Human notes attached to a case or run. |

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

