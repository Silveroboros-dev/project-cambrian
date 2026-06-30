import test from "node:test";
import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";
import { runTreuhandAgent } from "../src/agent.js";
import { runDataIngestionAgent, runSecurityAgent } from "../src/controlAgents.js";
import { assertSampleFailureTagsAreKnown, sampleCaseImports } from "../src/phase2SampleCases.js";
import {
  CASE_IMPORT_VERSION,
  FAILURE_TAGS,
  VALIDATION_PACKAGE_VERSION,
  createValidationPackage,
  createValidationRecord,
  getCaseChecklist,
  normalizeCaseImport,
  parseCaseImportJson,
  prepareManualCaseImport,
  runValidationSample,
  validateValidationPackagePrivacy,
  validateCaseImport
} from "../src/validation.js";

test("Phase 2 contract and import docs define required acceptance criteria", async () => {
  const contract = await readFile("docs/phase2-validation-contract.md", "utf8");
  const importDoc = await readFile("docs/phase2-case-import-format.md", "utf8");
  const app = await readFile("src/app.js", "utf8");

  for (let index = 1; index <= 21; index += 1) {
    assert.match(contract, new RegExp(`AC-P2-${index}`));
  }
  assert.match(importDoc, new RegExp(CASE_IMPORT_VERSION));
  assert.match(importDoc, new RegExp(VALIDATION_PACKAGE_VERSION));
  assert.match(importDoc, /manualPrepMinutes/);
  assert.match(importDoc, /humanMissingItemIdsCaptured/);
  assert.match(importDoc, /ratingSource/);
  assert.match(importDoc, /reviewerRating/);
  assert.match(importDoc, /traceAnnotations/);
  assert.match(importDoc, /contextPackets/);
  assert.match(app, /validation-import-form/);
  assert.match(app, /build-validation-export/);
});

test("bundled sample cases are valid anonymized Phase 2 imports", () => {
  assert.ok(sampleCaseImports.length >= 2);
  assert.equal(assertSampleFailureTagsAreKnown(), true);

  for (const sample of sampleCaseImports) {
    const validation = validateCaseImport(sample);
    assert.equal(validation.valid, true, validation.errors.join(" "));
    assert.equal(sample.importVersion, CASE_IMPORT_VERSION);
    assert.match(sample.clientName, /^Sample Client/);
    assert.equal(sample.reviewerRating.ratingSource, "fixture_seed");
    assert.ok(sample.baseline.manualPrepMinutes > 0);
    assert.equal(sample.baseline.humanMissingItemIdsCaptured ?? true, true);
    assert.ok(sample.evidence.every((item) => !item.content.includes("@")));
  }
});

test("manual JSON import validates, strips seeded ratings, and loads as manual anonymized packet", () => {
  const packet = {
    ...sampleCaseImports[0],
    sampleCaseId: "manual_packet_001",
    caseId: "case_manual_packet_001",
    sourceSystem: "phase2_fixture",
    reviewerRating: {
      ratingSource: "fixture_seed",
      overallUsefulness: 5
    }
  };

  const parsed = parseCaseImportJson(JSON.stringify(packet));
  assert.equal(parsed.valid, true, parsed.errors.join(" "));
  assert.equal(parsed.record.sourceSystem, "manual_anonymized_packet");
  assert.equal("reviewerRating" in parsed.record, false);

  const caseRecord = normalizeCaseImport(parsed.record, "2026-06-30T00:00:00.000Z");
  assert.equal(caseRecord.id, "case_manual_packet_001");
  assert.equal(caseRecord.sourceSystem, "manual_anonymized_packet");
  assert.equal(caseRecord.validation.reviewerRating, null);
});

test("manual JSON import rejects invalid JSON, invalid packets, and privacy issues", () => {
  const invalidJson = parseCaseImportJson("{");
  assert.equal(invalidJson.valid, false);
  assert.match(invalidJson.errors.join(" "), /Invalid JSON/);

  const invalidPacket = parseCaseImportJson(JSON.stringify({ importVersion: CASE_IMPORT_VERSION }));
  assert.equal(invalidPacket.valid, false);
  assert.match(invalidPacket.errors.join(" "), /caseId is required/);

  const privatePacket = {
    ...sampleCaseImports[0],
    sampleCaseId: "manual_private_packet",
    caseId: "case_manual_private_packet",
    evidence: [
      {
        ...sampleCaseImports[0].evidence[0],
        content: "Please contact owner@example.com for the March packet."
      }
    ]
  };
  const privateResult = parseCaseImportJson(JSON.stringify(privatePacket));
  assert.equal(privateResult.valid, false);
  assert.match(privateResult.errors.join(" "), /Privacy check failed/);
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
    assert.equal(result.validationRecord.reviewerRating.ratingSource, "fixture_seed");
    assert.equal(result.validationRecord.baseline.humanMissingItemIdsCaptured, true);
    assert.equal(result.validationRecord.metrics.missingItemRecall, 100);
    assert.equal(result.validationRecord.metrics.missingItemPrecision, 100);
    assert.ok(result.validationRecord.traceAnnotations[0].runId === result.run.id);
    assert.match(result.memo, /Before\/After Operating Memo/);
    assert.match(result.memo, /Evidence quality:/);
    assert.match(result.memo, /Rating source: fixture_seed/);
    assert.match(result.memo, /Missing-item scoring:/);
    assert.ok(result.output.recommendations.every((item) => item.evidence_ids.length > 0));
    assert.ok(result.output.checklist.every((item) => item.checklistItemId && item.claimSupport?.checkedEvidenceIds));
  }
});

test("validation package export includes scoped artifacts, taint, and privacy gate", () => {
  const caseRecord = normalizeCaseImport(
    prepareManualCaseImport({
      ...sampleCaseImports[1],
      sampleCaseId: "manual_export_packet",
      caseId: "case_manual_export_packet"
    }),
    "2026-06-30T00:00:00.000Z"
  );
  const output = runTreuhandAgent(caseRecord, getCaseChecklist(caseRecord));
  const run = {
    id: "run_manual_export_packet",
    caseId: caseRecord.id,
    agentCode: output.agent_code,
    status: "succeeded",
    output,
    startedAt: output.audit.started_at,
    completedAt: output.audit.completed_at
  };
  const validationRecord = createValidationRecord({
    caseRecord,
    run,
    baseline: caseRecord.validation.baseline,
    reviewerRating: {
      ratingSource: "human_capture",
      overallUsefulness: 4,
      checklistTrust: 4,
      evidenceTraceability: 5,
      timeSavedMinutes: 20,
      wouldUseAgain: true,
      failureTagIds: ["missing_context"],
      notes: "Synthetic reviewer package is exportable."
    },
    traceNote: "Synthetic reviewer checked missing sales export and management export.",
    createdAt: "2026-06-30T00:00:00.000Z"
  });
  const ingestion = runDataIngestionAgent(caseRecord, [], "2026-06-30T00:00:00.000Z");
  const security = runSecurityAgent({
    caseRecord,
    contextPackets: ingestion.contextPackets,
    agentRun: run,
    createdAt: "2026-06-30T00:00:00.000Z"
  });
  const validationPackage = createValidationPackage({
    caseRecord,
    run,
    validationRecord,
    contextPackets: ingestion.contextPackets,
    securityFindings: security.securityFindings,
    createdAt: "2026-06-30T00:00:00.000Z"
  });

  assert.equal(validationPackage.packageVersion, VALIDATION_PACKAGE_VERSION);
  assert.equal(validationPackage.case.id, caseRecord.id);
  assert.equal(validationPackage.run.id, run.id);
  assert.equal(validationPackage.validationRecord.id, validationRecord.id);
  assert.match(validationPackage.memo, /Before\/After Operating Memo/);
  assert.ok(validationPackage.contextPackets.some((packet) => packet.taint?.promptInjectionSuspected));
  assert.ok(validationPackage.securityFindings.some((finding) => finding.taint?.instructionFollowingForbidden));
  assert.equal(validateValidationPackagePrivacy(validationPackage).valid, true);

  const privatePackage = {
    ...validationPackage,
    case: {
      ...validationPackage.case,
      clientName: "Private Client"
    }
  };
  const privacy = validateValidationPackagePrivacy(privatePackage);
  assert.equal(privacy.valid, false);
  assert.ok(privacy.issues.some((issue) => issue.id === "configured_private_party_term"));
});

test("memo before reviewer capture is not labeled human_capture", () => {
  const caseRecord = normalizeCaseImport(
    {
      ...sampleCaseImports[0],
      sampleCaseId: "manual_no_capture_packet",
      caseId: "case_manual_no_capture_packet"
    },
    "2026-06-30T00:00:00.000Z"
  );
  const output = runTreuhandAgent(caseRecord, getCaseChecklist(caseRecord));
  const run = {
    id: "run_uncaptured_memo",
    caseId: caseRecord.id,
    output
  };
  const record = createValidationRecord({
    caseRecord,
    run,
    baseline: caseRecord.validation.baseline,
    reviewerRating: {},
    traceNote: "No reviewer capture yet.",
    createdAt: "2026-06-30T00:00:00.000Z"
  });

  assert.equal(record.reviewerRating.ratingSource, "not_captured");
  assert.match(record.memo, /Rating source: not_captured/);
  assert.doesNotMatch(record.memo, /Rating source: human_capture/);
});

test("missing-item scoring is unscored when human baseline is not captured", () => {
  const caseRecord = normalizeCaseImport(
    {
      ...sampleCaseImports[0],
      sampleCaseId: "manual_no_ground_truth_packet",
      caseId: "case_manual_no_ground_truth_packet",
      baseline: {
        manualPrepMinutes: 40,
        manualHandoffCount: 2
      }
    },
    "2026-06-30T00:00:00.000Z"
  );
  const output = runTreuhandAgent(caseRecord, getCaseChecklist(caseRecord));
  const run = {
    id: "run_unscored_missing_items",
    caseId: caseRecord.id,
    output
  };
  const record = createValidationRecord({
    caseRecord,
    run,
    baseline: caseRecord.validation.baseline,
    reviewerRating: {
      ratingSource: "human_capture",
      overallUsefulness: 4,
      checklistTrust: 4,
      evidenceTraceability: 4,
      timeSavedMinutes: 12,
      wouldUseAgain: true
    },
    traceNote: "Reviewer did not provide human missing item IDs.",
    createdAt: "2026-06-30T00:00:00.000Z"
  });

  assert.equal(record.baseline.humanMissingItemIdsCaptured, false);
  assert.equal(record.metrics.missingItemRecall, null);
  assert.equal(record.metrics.missingItemPrecision, null);
  assert.equal(record.metrics.missingItemComparison.scored, false);
  assert.match(record.memo, /Missing-item scoring: not scored/);
});

test("validation package export rejects non-human-captured validation records", () => {
  const result = runValidationSample(sampleCaseImports[0], "2026-06-30T00:00:00.000Z");

  assert.equal(result.validationRecord.reviewerRating.ratingSource, "fixture_seed");
  assert.throws(
    () =>
      createValidationPackage({
        caseRecord: result.caseRecord,
        run: result.run,
        validationRecord: result.validationRecord
      }),
    /human_capture/
  );
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
      humanMissingItemIds: ["vat_report"],
      humanMissingItemIdsCaptured: true
    },
    reviewerRating: {
      overallUsefulness: 5,
      checklistTrust: 4,
      evidenceTraceability: 5,
      timeSavedMinutes: 19,
      wouldUseAgain: true,
      ratingSource: "human_capture",
      failureTagIds: ["unsafe_draft"],
      notes: "Draft needs review but the packet is useful."
    },
    traceNote: "Reviewer checked run output against evidence IDs.",
    createdAt: "2026-06-30T00:00:00.000Z"
  });

  assert.equal(record.baseline.manualPrepMinutes, 41);
  assert.equal(record.reviewerRating.overallUsefulness, 5);
  assert.equal(record.reviewerRating.ratingSource, "human_capture");
  assert.equal(record.metrics.missingItemRecall, 100);
  assert.equal(record.metrics.missingItemPrecision, 100);
  assert.deepEqual(record.metrics.missingItemComparison.falsePositiveMissingItemIds, []);
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
