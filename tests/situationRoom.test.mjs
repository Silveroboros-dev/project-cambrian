import test from "node:test";
import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";
import { createInitialStore } from "../src/demoData.js";
import {
  AGENT_TAGS,
  SITUATION_ROOM_SCENARIOS,
  postSituationMessage,
  resolveSituationApproval,
  runSituationScenario
} from "../src/situationRoom.js";

test("Situation Room contract and UI entry point exist", async () => {
  const contract = await readFile("docs/situation-room-contract.md", "utf8");
  const html = await readFile("index.html", "utf8");
  const app = await readFile("src/app.js", "utf8");

  for (let index = 1; index <= 10; index += 1) {
    assert.match(contract, new RegExp(`AC-SR-${index}:`));
  }

  assert.match(contract, /roomId/);
  assert.match(contract, /workOrderId/);
  assert.match(contract, /approvalId/);
  assert.match(contract, /@treu/);
  assert.match(contract, /No External Side Effects/);
  assert.match(html, /Situation Room/);
  assert.match(app, /renderSituationRoom/);
  assert.match(app, /data-situation-scenario-id/);
});

test("initial store seeds Situation Room rooms and supported agent tags", () => {
  const store = createInitialStore();

  assert.ok(store.situationRooms.length >= 5);
  assert.equal(store.activeSituationRoomId, "room_case_march_2026");
  assert.deepEqual(Object.values(AGENT_TAGS), [
    "A-TREU-001",
    "A-INGEST-001",
    "A-SEC-001",
    "A-AUTH-001",
    "A-GAP-001",
    "A-CAD-001"
  ]);
});

test("agent tag creates a governed room-scoped work order", () => {
  const store = createInitialStore();
  const result = postSituationMessage(store, {
    roomId: "room_case_march_2026",
    text: "@treu prepare the March 2026 intake review.",
    actorId: "human_reviewer",
    createdAt: "2026-06-30T00:00:00.000Z"
  });

  assert.equal(result.workOrder.agentId, "A-TREU-001");
  assert.equal(result.workOrder.roomId, "room_case_march_2026");
  assert.equal(result.workOrder.caseId, store.activeCaseId);
  assert.equal(result.workOrder.status, "planned");
  assert.ok(result.workOrder.stages.includes("request human review"));
  assert.ok(result.cards.some((card) => card.type === "tagged_work_order"));
});

test("scenario gallery creates cards and compatible local artifacts for all five scenarios", () => {
  const store = createInitialStore();

  for (const scenario of SITUATION_ROOM_SCENARIOS) {
    runSituationScenario(store, scenario.id, `2026-06-30T00:0${SITUATION_ROOM_SCENARIOS.indexOf(scenario)}:00.000Z`);
  }

  assert.ok(store.situationCards.some((card) => card.type === "mailbox_message_received"));
  assert.ok(store.situationCards.some((card) => card.type === "external_llm_upload_attempt"));
  assert.ok(store.situationCards.some((card) => card.type === "employee_onboarding_request"));
  assert.ok(store.situationCards.some((card) => card.type === "skill_update_candidate_created"));
  assert.ok(store.situationCards.some((card) => card.type === "token_spend_summary"));
  assert.ok(store.contextPackets.some((packet) => packet.id.includes("inbound_email_intake")));
  assert.ok(store.agentRuns.some((run) => run.id.includes("inbound_email_intake")));
  assert.ok(store.securityFindings.some((finding) => finding.targetType === "external_llm_upload_attempt"));
  assert.ok(store.authorizationDecisions.some((decision) => decision.targetId === "synthetic_junior_assistant"));
  assert.ok(store.gapFindings.some((finding) => finding.targetId === "ingest_to_treu_period"));
  assert.ok(store.memoryCandidates.some((candidate) => candidate.status === "proposed"));
  assert.ok(store.cadenceNudges.some((nudge) => nudge.targetType === "weekly_control_audit"));
  assert.ok(store.approvalRequests.some((approval) => approval.actionType === "review_before_send"));
  assert.ok(store.approvalRequests.some((approval) => approval.actionType === "grant_read_only_and_draft_access"));
  assert.ok(store.approvalRequests.some((approval) => approval.actionType === "approve_operating_memory_candidate"));
});

test("human approval gate resolves approval without granting hidden autonomy", () => {
  const store = createInitialStore();
  runSituationScenario(store, "employee_onboarding", "2026-06-30T00:00:00.000Z");
  const approval = store.approvalRequests.find((item) => item.actionType === "grant_read_only_and_draft_access");

  assert.equal(approval.status, "pending");
  const resolved = resolveSituationApproval(store, approval.id, "approved", "human_boss", "2026-06-30T00:01:00.000Z");
  const workOrder = store.workOrders.find((item) => item.id === approval.workOrderId);

  assert.equal(resolved.status, "approved");
  assert.equal(workOrder.status, "completed");
  assert.ok(store.situationCards.some((card) => card.type === "human_approval" && card.approvalId === approval.id));
});
