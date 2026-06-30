import test from "node:test";
import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";
import { runTreuhandAgent } from "../src/agent.js";
import { assertSampleFailureTagsAreKnown, sampleCaseImports } from "../src/phase2SampleCases.js";
import {
  CASE_IMPORT_VERSION,
  FAILURE_TAGS,
  createValidationRecord,
  getCaseChecklist,
  normalizeCaseImport,
  runValidationSample,
  validateCaseImport
} from "../src/validation.js";

test("Phase 2 contract and import docs define required acceptance criteria", async () => {
  const contract = await readFile("docs/phase2-validation-contract.md", "utf8");
  const importDoc = await readFile("docs/phase2-case-import-format.md", "utf8");

  for (let index = 1; index <= 10; index += 1) {
    assert.match(contract, new RegExp(`AC-P2-${index}`));
  }
  assert.match(importDoc, new RegExp(CASE_IMPORT_VERSION));
  assert.match(importDoc, /manualPrepMinutes/);
  assert.match(importDoc, /reviewerRating/);
  assert.match(importDoc, /traceAnnotations/);
});

test("bundled sample cases are valid anonymized Phase 2 imports", () => {
  assert.ok(sampleCaseImports.length >= 2);
  assert.equal(assertSampleFailureTagsAreKnown(), true);

  for (const sample of sampleCaseImports) {
    const validation = validateCaseImport(sample);
    assert.equal(validation.valid, true, validation.errors.join(" "));
    assert.equal(sample.importVersion, CASE_IMPORT_VERSION);
    assert.match(sample.clientName, /^Sample Client/);
    assert.ok(sample.baseline.manualPrepMinutes > 0);
    assert.ok(sample.evidence.every((item) => !item.content.includes("@")));
  }
});

test("sample cases run end to end and produce validation records and operating memos", () => {
  const results = sampleCaseImports.map((sample) => runValidationSample(sample, "2026-06-30T00:00:00.000Z"));

  assert.ok(results.length >= 2);
  for (const result of results) {
    assert.equal(result.run.status, "succeeded");
    assert.equal(result.validationRecord.caseId, result.caseRecord.id);
    assert.equal(result.validationRecord.runId, result.run.id);
    assert.ok(result.validationRecord.baseline.manualPrepMinutes > 0);
    assert.ok(result.validationRecord.reviewerRating.ratingId);
    assert.ok(result.validationRecord.traceAnnotations[0].runId === result.run.id);
    assert.match(result.memo, /Before\/After Operating Memo/);
    assert.match(result.memo, /Evidence quality:/);
    assert.ok(result.output.recommendations.every((item) => item.evidence_ids.length > 0));
  }
});

test("configured checklist affects missing-item detection", () => {
  const customSample = sampleCaseImports.find((sample) =>
    sample.checklist.some((item) => item.id === "management_accounts_export")
  );
  assert.ok(customSample);

  const customResult = runValidationSample(customSample, "2026-06-30T00:00:00.000Z");
  assert.ok(
    customResult.output.checklist.some(
      (item) => item.item === "Management accounts export" && item.status === "open"
    )
  );

  const withoutCustomChecklist = {
    ...customSample,
    checklist: customSample.checklist.filter((item) => item.id !== "management_accounts_export")
  };
  const caseRecord = normalizeCaseImport(withoutCustomChecklist, "2026-06-30T00:00:00.000Z");
  const output = runTreuhandAgent(caseRecord, getCaseChecklist(caseRecord));

  assert.equal(output.checklist.some((item) => item.item === "Management accounts export"), false);
});

test("validation record captures baseline, reviewer rating, failure tags, and trace annotation", () => {
  const caseRecord = normalizeCaseImport(sampleCaseImports[0], "2026-06-30T00:00:00.000Z");
  const output = runTreuhandAgent(caseRecord, getCaseChecklist(caseRecord));
  const run = {
    id: "run_validation_capture_test",
    caseId: caseRecord.id,
    output
  };
  const record = createValidationRecord({
    caseRecord,
    run,
    baseline: {
      manualPrepMinutes: 41,
      manualHandoffCount: 2,
      humanMissingItemIds: ["vat_report"]
    },
    reviewerRating: {
      overallUsefulness: 5,
      checklistTrust: 4,
      evidenceTraceability: 5,
      timeSavedMinutes: 19,
      wouldUseAgain: true,
      failureTagIds: ["unsafe_draft"],
      notes: "Draft needs review but the packet is useful."
    },
    traceNote: "Reviewer checked run output against evidence IDs.",
    createdAt: "2026-06-30T00:00:00.000Z"
  });

  assert.equal(record.baseline.manualPrepMinutes, 41);
  assert.equal(record.reviewerRating.overallUsefulness, 5);
  assert.deepEqual(record.failureTagIds, ["unsafe_draft"]);
  assert.equal(record.traceAnnotations[0].caseId, caseRecord.id);
  assert.equal(record.traceAnnotations[0].runId, run.id);
  assert.match(record.memo, /Reviewer would use the workflow again/);
});

test("required Phase 2 failure tags are exposed", () => {
  assert.deepEqual(
    FAILURE_TAGS.map((tag) => tag.id),
    [
      "wrong_classification",
      "weak_evidence",
      "missing_context",
      "noisy_gap_finding",
      "unsafe_draft",
      "checklist_mismatch"
    ]
  );
});

