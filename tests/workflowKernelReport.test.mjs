import test from "node:test";
import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";
import { createInitialStore } from "../src/demoData.js";
import { sampleCaseImports } from "../src/phase2SampleCases.js";
import {
  GUIDED_DEMO_SCENARIO_ORDER,
  exportSituationDemoSnapshot,
  importSituationDemoSnapshot,
  resetSituationRoomDemoState,
  resolveSituationApproval,
  runSituationDemoAct,
  runWeekTwoContinuityScenario,
  selectFirstPendingNextStep
} from "../src/situationRoom.js";
import { runValidationSample } from "../src/validation.js";
import {
  WORKFLOW_KERNEL_REPORT_VERSION,
  buildWorkflowKernelMap,
  buildWorkflowKernelReadinessReport
} from "../src/workflowKernelReport.js";

test("workflow kernel architecture doc and pure report entry points exist", async () => {
  const doc = await readFile("docs/future-workflow-kernel-architecture.md", "utf8");
  const source = await readFile("src/workflowKernelReport.js", "utf8");

  assert.match(doc, /event -> context -> work order -> card -> approval -> next-step -> follow-through -> trace -> validation loop/);
  assert.match(doc, /3-5 anonymized Treuhand cases/);
  assert.match(doc, /production connectors are not required/);
  assert.match(doc, /generic lab agents/);
  assert.match(doc, /synthetic demo evidence/);
  assert.match(doc, /human-reviewed anonymized evidence/);
  assert.match(doc, /future production proof/);
  assert.match(source, /buildWorkflowKernelReadinessReport/);
  assert.match(source, /buildWorkflowKernelMap/);
});

test("workflow kernel report represents local primitives after five conductor acts", () => {
  const store = runCleanFiveActDemo();
  const report = buildWorkflowKernelReadinessReport(store);
  const map = buildWorkflowKernelMap(store);

  assert.equal(report.reportVersion, WORKFLOW_KERNEL_REPORT_VERSION);
  assert.equal(report.localOnly, true);
  assert.equal(report.noExternalExecution, true);
  assert.equal(report.externalEffectSummary, "none");
  assert.equal(report.currentLocalArchitectureEnoughForNextProof, true);
  assert.equal(report.primitives.sourceEvents.currentEvidenceCount, store.situationSourceEvents.length);
  assert.ok(report.primitives.sourceEvents.currentEvidenceCount > 0);
  assert.ok(report.primitives.workOrders.currentEvidenceCount > 0);
  assert.ok(report.primitives.agentControlCards.currentEvidenceCount > 0);
  assert.ok(report.primitives.approvalGates.currentEvidenceCount > 0);
  assert.equal(report.primitives.traceChains.representedNow, true);
  assert.ok(report.primitives.traceChains.currentEvidenceCount > 0);
  assert.equal(report.kernelMap.source_events.currentEvidenceCount, map.source_events.currentEvidenceCount);
  assert.equal(report.kernelMap.cards.currentEvidenceCount, store.situationCards.length);
  assert.equal(report.kernelMap.approval_gates.currentEvidenceCount, store.approvalRequests.length);
  assertAllPrimitivesNeedNoProductionConnector(report);
});

test("workflow kernel report captures approval consequence without external execution", () => {
  const store = runCleanFiveActDemo();
  const approval = store.approvalRequests.find(
    (item) => item.status === "pending" && item.actionType === "review_before_send"
  );

  assert.ok(approval);
  resolveSituationApproval(store, approval.id, "approved", "human_reviewer", "2026-06-30T00:09:00.000Z");
  const selected = selectFirstPendingNextStep(store, "human_reviewer", "2026-06-30T00:09:30.000Z");
  assert.ok(selected.followThrough);

  const report = buildWorkflowKernelReadinessReport(store);

  assert.equal(report.noExternalExecution, true);
  assert.equal(report.primitives.nextStepProposals.representedNow, true);
  assert.ok(report.primitives.nextStepProposals.currentEvidenceCount > 0);
  assert.equal(report.primitives.localFollowThroughs.representedNow, true);
  assert.equal(report.primitives.localFollowThroughs.currentEvidenceCount, store.situationFollowThroughs.length);
  assert.ok(report.traceChains.some((chain) => chain.nextStepProposals > 0 && chain.localFollowThroughs > 0));
  assert.equal(report.kernelMap.follow_through_records.currentEvidenceCount, store.situationFollowThroughs.length);
  assertAllPrimitivesNeedNoProductionConnector(report);
});

test("workflow kernel report sees snapshot continuity after export import and week two", () => {
  const store = runCleanFiveActDemo();
  const exported = exportSituationDemoSnapshot(store, {
    sessionId: "kernel_readiness_session",
    scenarioWeek: 1,
    createdAt: "2026-06-30T00:20:00.000Z"
  });
  const target = createInitialStore();
  const imported = importSituationDemoSnapshot(target, exported.snapshotJson, "2026-07-07T00:00:00.000Z");
  assert.equal(imported.valid, true, imported.errors.join(" "));
  runWeekTwoContinuityScenario(target, "2026-07-07T00:10:00.000Z");

  const report = buildWorkflowKernelReadinessReport(target);

  assert.equal(report.primitives.snapshotContinuity.representedNow, true);
  assert.ok(report.primitives.snapshotContinuity.currentEvidenceCount > 0);
  assert.equal(report.primitives.snapshotContinuity.nextMinimumStorageNeed, "versioned_json_snapshot");
  assert.equal(report.kernelMap.snapshots.representedNow, true);
  assert.equal(report.noExternalExecution, true);
});

test("workflow kernel report keeps validation records separate from synthetic proof", () => {
  const store = runCleanFiveActDemo();
  const validationResult = runValidationSample(sampleCaseImports[0], "2026-06-30T00:00:00.000Z");
  store.validationRecords = [validationResult.validationRecord];

  const report = buildWorkflowKernelReadinessReport(store);

  assert.equal(report.primitives.validationRecords.representedNow, true);
  assert.equal(report.primitives.validationRecords.currentEvidenceCount, 1);
  assert.equal(report.proofSeparation.situationRoomProof.category, "synthetic_demo_evidence");
  assert.equal(report.proofSeparation.validationProof.separatedFromSyntheticSituationRoom, true);
  assert.equal(report.proofSeparation.validationProof.fixtureSeedRecords, 1);
  assert.equal(report.proofSeparation.validationProof.realReviewerOperatingProofRecords, 0);
  assert.equal(report.proofSeparation.productionProof.category, "not_present");
  assert.match(report.primitives.validationRecords.riskNote, /fixtures do not count as real reviewer operating proof/);
});

function runCleanFiveActDemo() {
  const store = createInitialStore();
  resetSituationRoomDemoState(store, "2026-06-30T00:00:00.000Z");
  GUIDED_DEMO_SCENARIO_ORDER.forEach((scenarioId, index) => {
    runSituationDemoAct(store, scenarioId, `2026-06-30T00:0${index + 1}:00.000Z`);
  });
  return store;
}

function assertAllPrimitivesNeedNoProductionConnector(report) {
  for (const [key, primitive] of Object.entries(report.primitives)) {
    assert.equal(primitive.productionConnectorRequiredNow, false, `${key} should not require production connector now`);
  }
}
