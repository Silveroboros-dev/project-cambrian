# Goal: Phase 2 Real Validation Loop

Use this as the next `/goal` after the current fixture-demo patch is accepted.

## Objective

Turn the Phase 2 Treuhand kit from a bundled-fixture demo into a local real-case validation loop for 3-5 anonymized reviewer cases.

The outcome should prove whether the workflow creates business value for Swiss SME Treuhand/accounting operators, not whether Project Cambrian can build a broad agent platform.

## Scope

Build the smallest local workflow that lets a reviewer:

1. paste an anonymized Phase 2 case JSON packet;
2. validate the packet against `phase2.treuhand.case.v1`;
3. load the valid case into local state;
4. run `A-TREU-001`;
5. capture human reviewer rating, failure tags, and trace note;
6. export a validation package containing case, run, validation record, and memo.

## Non-Goals

- No production connectors.
- No database.
- No authentication rebuild.
- No LLM calls.
- No OCR or file upload.
- No client email sending.
- No SmartCore, wealth, treasury, or acquisition-screening implementation.
- No public claims based on `fixture_seed` records.

## Loop Conditions

For each candidate anonymized case:

1. Validate JSON.
2. If invalid, show exact missing/invalid fields and do not load it.
3. If valid, load as `manual_anonymized_packet` and preserve all checklist item IDs.
4. Run the Treuhand agent with the case checklist.
5. Capture reviewer feedback as `ratingSource: "human_capture"`.
6. Compute missing-item recall, precision, false positives, and false negatives against `baseline.humanMissingItemIds`.
7. Generate an operating memo that distinguishes positive evidence coverage from missing-item absence claims.
8. Export the validation package for reviewer/stakeholder follow-up.

Continue the loop until one of these is true:

- 3-5 valid anonymized human-reviewed cases are captured;
- the reviewer refuses to use the workflow again;
- missing-item recall or precision is materially worse than manual intake;
- evidence links are not trusted;
- import friction dominates the reviewer session;
- the task requires production data access, credentials, or external services.

## Acceptance Criteria

- Validation tab has a local paste-JSON import panel.
- Invalid JSON and invalid case packets produce clear local errors.
- Valid packets can be loaded without editing source files.
- Human-captured ratings are never confused with fixture-seeded ratings.
- Metrics dashboard separates fixture records and human records.
- Exported package includes `case`, `run`, `validationRecord`, and `memo`.
- Exported package contains no private names, emails, credentials, or unredacted customer identifiers.
- Tests cover valid import, invalid import, human rating source, export shape, and missing-item comparison.
- `npm test` and `npm run smoke` pass.

## Security Hardening For This Goal

Add a taint marker to context packets when prompt-injection text is detected:

```json
{
  "taint": {
    "promptInjectionSuspected": true,
    "instructionFollowingForbidden": true
  }
}
```

For this goal, taint can remain advisory. It must still be visible to the security agent and export package so future LLM use cannot silently treat source text as instructions.

Move duplicated deterministic rule lists into shared local modules only where it reduces drift for this loop, for example prompt-injection patterns and document classification vocabulary. Do not introduce a policy engine or new dependency.

## Stop Conditions

Pause before continuing if:

- real personal data appears in a packet;
- a named private person or firm appears in public-facing docs, fixtures, demos, or exports;
- the implementation needs a new dependency;
- the implementation needs a backend, database, cloud service, or paid/external API;
- tests cannot prove the import/export loop without manual browser-only validation.

## Evidence On Completion

Report:

- changed files;
- exact commands run;
- test and smoke results;
- whether fixture and human metrics remain separated;
- one exported validation package example using synthetic data;
- remaining risks before asking a real reviewer for cases.
