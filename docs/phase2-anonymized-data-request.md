# Phase 2 Anonymized Data Request

Version: 0.1  
Date: 2026-06-30  
Audience: friendly Treuhand/accounting reviewer or pilot accounting firm contact  

## Short Ask

I am validating a local-only prototype for Treuhand document-intake preparation. I am not asking for production access, system credentials, raw client files, or identifiable data.

I need 3-5 anonymized monthly or quarterly intake cases first. If those are useful, we can expand to 10-20 cases.

## What To Send Per Case

Please provide one anonymized packet per case:

- period, such as `2026-03` or `Q1 2026`;
- current checklist used by the accountant or client manager;
- anonymized evidence text or summaries from emails/documents;
- manual preparation time before accountant review;
- number of handoffs or people involved before the case is ready;
- missing items found manually;
- short reviewer notes on what usually goes wrong.

## Evidence Types That Help

Useful anonymized examples:

- client email requesting or sending documents;
- bank statement summary;
- sales invoice export summary;
- purchase invoice or supplier receipt summary;
- payroll summary;
- VAT/MWST note or report summary;
- contract or one-off agreement summary;
- accountant/client-manager note explaining open questions.

## What Not To Send

Do not send:

- real client names;
- personal names unless replaced with roles;
- email addresses;
- phone numbers;
- bank account numbers;
- tax IDs;
- payroll details linked to identifiable people;
- unredacted contracts;
- screenshots from real systems;
- credentials, API tokens, or private links;
- raw PDFs unless separately approved and redacted.

Use placeholders such as:

- `Sample Client A`;
- `Client manager`;
- `Payroll provider`;
- `Bank statement summary`;
- rounded or fictional amounts.

## Desired Format

Plain text is enough for the first pass.

Preferred structure:

```text
Case label:
Period:
Checklist:
- ...

Manual prep time:
Manual handoffs:
Human-found missing items:

Evidence:
1. Type:
   Title:
   Text:

2. Type:
   Title:
   Text:

Reviewer notes:
```

## What I Will Test

For each case, the prototype will test whether it can:

- classify evidence;
- detect missing checklist items;
- link claims to evidence IDs;
- draft a client reminder that still requires human approval;
- capture reviewer rating and failure tags;
- produce a before/after operating memo;
- export a local validation package for follow-up review.

Preferred handoff format is a pasted `phase2.treuhand.case.v1` JSON packet, not production-system access or raw client files.

## Success Criteria

The first validation is useful only if the reviewer can answer:

- Would this save preparation time?
- Is the checklist mostly right?
- Are the evidence links reviewable?
- Does the draft create risk or reduce work?
- Would you use the workflow again on another case?

## Important Boundary

This is not production software. It does not send emails, file taxes, produce accounting conclusions, connect to systems, or use real customer data.
