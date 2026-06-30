# Phase 2 Demo Script

Version: 0.1  
Date: 2026-06-30  
Audience: stakeholder, owner/operator, advisor, or internal conviction-building review  
Target length: 4-6 minutes  

## Demo Claim

The main stakeholder demo now opens with the [Situation Room demo script](demo-script-situation-room.md). Use this Phase 2 script after the Situation Room walkthrough to show the proof package.

This validation demo does not prove customer value yet. It proves that the Phase 2 validation loop exists:

> Given an anonymized Treuhand intake case, the system can load evidence, apply a configured checklist, run a deterministic agent, require human review, capture reviewer feedback and failure tags, and produce a before/after operating memo.

The live proof still requires 3-5 real anonymized Treuhand cases first. Expand to 10-20 only after those cases show the import format, checklist scoring, and reviewer capture are useful.

## Setup

Run:

```bash
npm test
npm run smoke
npm run serve
```

Open:

```text
http://127.0.0.1:5173
```

If the browser has stale local state, click `Reset demo state` on the Situation tab and rerun the numbered Demo conductor acts, or click `Reset` on the Case tab for the older case-first flow.

## Opening Talk Track

Use this:

> This is a local prototype for Swiss Treuhand document intake. It is not production, not a tax system, not an accounting decision engine, and not connected to real client data. The purpose is to show how we will validate whether agent-assisted intake actually saves reviewer time while preserving evidence, approvals, and failure visibility.

Then set the boundary:

> The strategic thesis may later become an operator-led acquisition or co-investment thesis. Today we are not pitching that. Today we are testing whether there is a measurable operating edge in one narrow workflow.

## Click Path

### 1. Start From Situation Room Handoff

After the Situation Room Demo conductor acts, click `Validation`.

Say:

> The Situation Room is the operating loop. This Validation tab is the proof package that tests whether the loop is actually useful on anonymized Treuhand cases.

Then continue with the validation flow below.

### 2. Open Case If Needed

Show:

- local prototype;
- no LLM;
- human approval required;
- current Treuhand case;
- evidence list;
- latest run state.

Say:

> The first surface is intentionally boring: evidence, checklist output, warnings, review pack, and audit trail. The point is not autonomy. The point is reviewable preparation work.

### 3. Open Validation

Click `Validation`.

Show:

- local paste-JSON import panel;
- `Sample imports`;
- `Validation records`;
- active case ID;
- rating source;
- two bundled anonymized fixtures.

Say:

> These are synthetic/anonymized fixtures that show the shape of real pilot accounting or Treuhand cases. They are demo data, not market proof.

Also say:

> Fixture records are labeled `fixture_seed`. Only reviewer-session records labeled `human_capture` count as evidence of business value.

Also show:

> Real reviewer packets are pasted as local JSON and validated before loading. Invalid JSON, missing fields, or privacy issues do not mutate the active case.

### 4. Run All Samples

Click `Run all samples`.

Expected result:

- validation records become `2`;
- active case changes to a sample case;
- before/after operating memo appears.

Say:

> The replay simulates the validation loop over two cases. In the real test, these would be anonymized monthly or quarterly intake packets from an accountant.

### 5. Inspect Active Validation Case

Show:

- baseline manual minutes;
- manual handoff count;
- configured checklist;
- custom checklist item in the second sample.

Say:

> The checklist is case-specific. That matters because Treuhand workflows are not identical across firms or clients. If the checklist changes, missing-item detection must change.

### 6. Show Reviewer Capture

Show:

- usefulness rating;
- checklist trust;
- evidence traceability;
- reviewer minutes saved;
- would-use-again checkbox;
- required failure tags:
  - `wrong_classification`;
  - `weak_evidence`;
  - `missing_context`;
  - `noisy_gap_finding`;
  - `unsafe_draft`;
  - `checklist_mismatch`;
- trace annotation.

Say:

> This is the anti-demo-theater part. We capture not only whether the output looks good, but where it failed. The failure tags are what make the next product decision possible.

### 7. Show Validation Package Export

Show:

- export requires an agent run;
- export requires a saved `human_capture` validation record;
- fixture-seeded records are blocked from export-as-proof;
- export includes case, run, validation record, memo, context packets, and security findings;
- privacy gate blocks emails, credential-like strings, IBAN-shaped identifiers, Swiss UID-shaped identifiers, and configured private-party terms;
- prompt-injection taint remains visible on context packets and security findings.

Say:

> The package is the portable artifact for reviewer follow-up. It is still local JSON, not a production record. The privacy gate exists so we fail closed if pasted data is not properly anonymized.

### 8. Show Operating Memo

Show the memo.

Call out:

- manual baseline;
- agent-assisted result;
- minutes saved;
- review burden;
- traceability coverage;
- missing-item recall and precision;
- recurring failure modes;
- decision.

Say:

> This memo is the artifact we want after every validation case. If we cannot write this honestly after real cases, we should not pitch an acquisition thesis.

### 9. Open Metrics

Click `Metrics`.

Show:

- validation cases;
- human captures versus fixture records;
- human reviewer-estimated minutes saved;
- human and fixture missing-item recall;
- traceability coverage;
- would-use-again rate;
- failure tags.

Say:

> These are validation metrics, not production KPIs. The next proof is whether a real reviewer agrees the workflow saves time without increasing risk.

## Strongest Demo Case

Use `sample_treuhand_march_missing_vat` first.

Why:

- baseline manual prep time is clear;
- VAT report is intentionally missing;
- evidence links are easy to inspect;
- fixture-seeded rating is positive;
- generated memo has a clean continue-validation story.

## Expected Questions And Answers

**Is this real client data?**  
No. It is synthetic/anonymized fixture data. Real proof needs anonymized Treuhand cases.

**Does this send client emails?**  
No. Client-facing drafts require human review and no external side effects exist.

**Does this use an LLM?**  
No. This slice is deterministic so we can validate workflow shape, evidence links, and review capture before adding model variability.

**Is this production-ready?**  
No. It uses local storage and has no production auth, database, OCR, connectors, or deployment path.

**What would make it worth continuing?**  
A real reviewer says the output saves time, evidence links are trustworthy, checklist failures are fixable, and they would use it again.

## Stop Conditions

Stop the demo honestly if:

- the audience asks for production security guarantees;
- the audience treats synthetic cases as proof of value;
- the conversation drifts into fund formation before operating proof;
- the next required step is real customer data access.

## Recommended Next Step

Do not build more platform yet.

Next work should be:

1. commit the Phase 2 validation kit;
2. create a fresh zip snapshot;
3. run this demo once internally and record rough objections using [Phase 2 Internal Demo Review](phase2-internal-demo-review.md);
4. prepare a one-page anonymized-data request for a pilot accounting firm or a friendly Treuhand reviewer using [Phase 2 Anonymized Data Request](phase2-anonymized-data-request.md);
5. collect 3-5 real anonymized cases first, not 20;
6. use those first cases to decide whether the checklist/import format needs changes;
7. only then run the fuller 10-20 case validation.

## Data Request For A Friendly Reviewer

Ask for each anonymized case:

- period;
- current checklist;
- anonymized evidence text or summaries;
- manual prep time;
- number of handoffs;
- human-found missing items;
- reviewer notes on what usually goes wrong.

Do not ask for production system access, credentials, raw PDFs, or identifiable client data in the first validation round.
