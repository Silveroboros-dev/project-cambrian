import assert from "node:assert/strict";
import { access, readFile } from "node:fs/promises";
import { runTreuhandAgent } from "../src/agent.js";
import { createInitialStore } from "../src/demoData.js";
import { sampleCaseImports } from "../src/phase2SampleCases.js";
import {
  GUIDED_DEMO_SCENARIO_ORDER,
  createSituationDemoSnapshot,
  importSituationDemoSnapshot,
  postSituationMessage,
  runSituationDemoAct,
  runWeekTwoContinuityScenario,
  summarizeSituationMetrics,
  summarizeSituationAgentParticipation
} from "../src/situationRoom.js";
import { FAILURE_TAGS, runValidationSample } from "../src/validation.js";

await Promise.all([
  access("index.html"),
  access("src/app.js"),
  access("src/styles.css"),
  access("README.md")
]);

const html = await readFile("index.html", "utf8");
assert.match(html, /AgentOps Core/);
assert.match(html, /src\/app.js/);
assert.match(html, /Context/);
assert.match(html, /Controls/);
assert.match(html, /Validation/);
assert.match(html, /Situation/);
assert.match(html, /situation-view/);

const store = createInitialStore();
const output = runTreuhandAgent(store.cases[0]);

assert.equal(output.agent_code, "A-TREU-001");
assert.equal(output.status, "needs_review");
assert.ok(output.metrics.documents_processed >= 3);
assert.ok(output.recommendations.every((item) => item.requires_human_approval));
assert.ok(store.contextPackets.length >= 3);
assert.ok(store.controlAgentOutputs.some((item) => item.agentCode === "A-INGEST-001"));
assert.ok(store.controlAgentOutputs.some((item) => item.agentCode === "A-SEC-001"));
assert.ok(store.controlAgentOutputs.some((item) => item.agentCode === "A-CAD-001"));
assert.ok(store.validationCaseImports.length >= 2);
assert.ok(FAILURE_TAGS.some((tag) => tag.id === "checklist_mismatch"));

const actResults = GUIDED_DEMO_SCENARIO_ORDER.map((scenarioId, index) =>
  runSituationDemoAct(store, scenarioId, `2026-06-30T00:0${index}:00.000Z`)
);
const agentParticipation = summarizeSituationAgentParticipation(store);
assert.deepEqual(store.situationDemoConductor.completedActIds, GUIDED_DEMO_SCENARIO_ORDER);
assert.equal(actResults.length, 5);
assert.equal(store.situationDemoConductor.lastAct.actId, "weekly_control_audit");
assert.equal(store.situationDemoConductor.lastAct.deltas.workOrders, 1);
assert.match(store.situationDemoConductor.lastAct.cambrianContrast, /Reviews local logs/);
const routedCommand = postSituationMessage(store, {
  roomId: "room_case_march_2026",
  text: "@sec check upload",
  actorId: "human_reviewer",
  createdAt: "2026-06-30T00:10:00.000Z"
});
const situationMetrics = summarizeSituationMetrics(store);
assert.equal(agentParticipation.length, 6);
assert.equal(actResults.filter((result) => result.workOrder).length, 5);
assert.ok(store.workOrders.length >= 5);
assert.equal(store.approvalRequests.filter((approval) => approval.status === "pending").length, 3);
assert.ok(store.situationCards.some((card) => card.type === "weekly_audit_due"));
assert.ok(store.situationCards.every((card) => card.externalEffect === "none"));
assert.ok(store.workOrders.some((workOrder) => workOrder.status === "blocked"));
assert.ok(store.approvalRequests.every((approval) => approval.externalEffect === "none"));
assert.ok(agentParticipation.every((agent) => agent.totalOutputs > 0));
assert.ok(store.cadenceNudges.some((nudge) => nudge.targetType === "weekly_control_audit"));
assert.equal(routedCommand.routedScenarioId, "confidential_upload_attempt");
assert.equal(routedCommand.reused, true);
assert.equal(store.situationDemoConductor.lastAct.actId, "confidential_upload_attempt");
assert.match(routedCommand.systemMessage.text, /no duplicate artifacts created/);
assert.ok(situationMetrics.messages >= 3);
assert.ok(situationMetrics.logs >= 8);
assert.ok(situationMetrics.blockedWork >= 1);
assert.equal(situationMetrics.localStorageKey, "agentops-core-store-v1");

const snapshot = createSituationDemoSnapshot(store, {
  sessionId: "smoke_session",
  scenarioWeek: 1,
  createdAt: "2026-06-30T00:20:00.000Z"
});
const snapshotTarget = createInitialStore();
const importedSnapshot = importSituationDemoSnapshot(snapshotTarget, JSON.stringify(snapshot), "2026-07-07T00:00:00.000Z");
assert.equal(importedSnapshot.valid, true, importedSnapshot.errors.join(" "));
const weekTwo = runWeekTwoContinuityScenario(snapshotTarget, "2026-07-07T00:10:00.000Z");
assert.equal(weekTwo.scenarioWeek, 2);
assert.ok(snapshotTarget.situationCards.some((card) => card.type === "week_two_prior_log_review"));

const validationResults = sampleCaseImports.map((sample) => runValidationSample(sample));
assert.equal(validationResults.length >= 2, true);
assert.ok(validationResults.every((result) => result.validationRecord.runId === result.run.id));
assert.ok(validationResults.every((result) => result.memo.includes("Before/After Operating Memo")));

console.log("Smoke check passed: Situation Room demo conductor and Phase 2 validation samples produce review-gated local output.");
