import test from "node:test";
import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";
import { createInitialStore } from "../src/demoData.js";
import {
  ACTIVE_SITUATION_AGENTS,
  AGENT_TAGS,
  GUIDED_DEMO_SCENARIO_ORDER,
  SITUATION_ARTIFACT_PACKS,
  SITUATION_SNAPSHOT_VERSION,
  SITUATION_ROOM_SCENARIOS,
  createSituationDemoSnapshot,
  exportSituationDemoSnapshot,
  importSituationDemoSnapshot,
  postSituationMessage,
  resolveAllDemoSafeApprovals,
  resolveSituationApproval,
  runSituationDemoAct,
  runGuidedSituationDemo,
  runWeekTwoContinuityScenario,
  setSituationArtifactPack,
  summarizeSituationMetrics,
  summarizeSituationAgentParticipation,
  runSituationScenario
} from "../src/situationRoom.js";

test("Situation Room contract and UI entry point exist", async () => {
  const contract = await readFile("docs/situation-room-contract.md", "utf8");
  const demoScript = await readFile("docs/demo-script-situation-room.md", "utf8");
  const html = await readFile("index.html", "utf8");
  const app = await readFile("src/app.js", "utf8");
  const styles = await readFile("src/styles.css", "utf8");
  const situationRoomSource = await readFile("src/situationRoom.js", "utf8");

  for (let index = 1; index <= 31; index += 1) {
    assert.match(contract, new RegExp(`AC-SR-${index}:`));
  }

  assert.match(contract, /roomId/);
  assert.match(contract, /workOrderId/);
  assert.match(contract, /approvalId/);
  assert.match(contract, /@treu/);
  assert.match(contract, /No External Side Effects/);
  assert.match(contract, /Demo Conductor/);
  assert.match(contract, /Source Event Model/);
  assert.match(contract, /synthetic_local/);
  assert.match(demoScript, /Event Source/);
  assert.match(demoScript, /Demo conductor|Reset demo state/);
  assert.match(demoScript, /3-5 anonymized Treuhand cases/);
  assert.match(html, /Situation Room/);
  assert.match(html, /rail-button is-active" data-view="situation"/);
  assert.match(app, /renderSituationRoom/);
  assert.match(app, /reset-situation-demo-state/);
  assert.match(app, /Demo conductor/);
  assert.match(app, /Created this act/);
  assert.match(app, /Generic chatbot/);
  assert.match(app, /Cambrian agents/);
  assert.match(app, /Manual agent tag \(optional\)/);
  assert.match(app, /demo-act-title/);
  assert.match(app, /renderCompactIdMeta/);
  assert.match(app, /is-created-this-act/);
  assert.match(app, /approve-all-demo-approvals/);
  assert.match(app, /data-situation-scenario-id/);
  assert.match(app, /Room chat/);
  assert.match(app, /Artifact packs/);
  assert.match(app, /packed-event/);
  assert.match(app, /packed-log/);
  assert.match(app, /Event Source/);
  assert.match(app, /source-detail-grid/);
  assert.match(app, /sourceEventId/);
  assert.match(app, /Situation Room metrics/);
  assert.match(app, /Save demo snapshot/);
  assert.match(app, /Advance one week/);
  assert.match(app, /data-situation-agent-id/);
  assert.match(app, /agent-popover/);
  assert.match(app, /expandedSituationAgentId === agentId \? null : agentId/);
  assert.match(styles, /position: fixed;/);
  assert.match(styles, /grid-template-columns: 1fr;/);
  assert.match(styles, /word-break: normal;/);
  assert.match(styles, /id-chip/);
  assert.match(styles, /event-source-panel/);
  assert.doesNotMatch(app, /<details class="agent-status-card"/);
  assert.match(situationRoomSource, /runSituationDemoAct/);
  assert.match(situationRoomSource, /situationSourceEvents/);
  assert.match(situationRoomSource, /source_event_received/);
  assert.match(situationRoomSource, /actRecordsById/);
  assert.match(situationRoomSource, /manual_tag_reused_demo_act/);
  assert.match(situationRoomSource, /chatbotContrast/);
  assert.match(app, /created:/);
});

test("initial store seeds Situation Room rooms and supported agent tags", () => {
  const store = createInitialStore();

  assert.ok(store.situationRooms.length >= 5);
  assert.equal(store.activeSituationRoomId, "room_case_march_2026");
  assert.equal(store.expandedSituationAgentId, null);
  assert.deepEqual(store.situationDemoConductor.completedActIds, []);
  assert.deepEqual(store.situationSourceEvents, []);
  assert.equal(ACTIVE_SITUATION_AGENTS.length, 6);
  assert.deepEqual(SITUATION_ARTIFACT_PACKS.map((pack) => pack.id), ["cards", "events", "work_orders", "approvals", "logs"]);
  assert.equal(store.activeSituationPack, "cards");
  assert.ok(store.situationEventLog.some((log) => log.storage.includes("localStorage")));
  assert.deepEqual(Object.values(AGENT_TAGS), [
    "A-TREU-001",
    "A-INGEST-001",
    "A-SEC-001",
    "A-AUTH-001",
    "A-GAP-001",
    "A-CAD-001"
  ]);
});

test("room chat is scoped and demo command replies name created artifacts", () => {
  const store = createInitialStore();
  const beforeSecurityMessages = store.roomMessages.filter((message) => message.roomId === "room_security").length;
  const result = postSituationMessage(store, {
    roomId: "room_case_march_2026",
    text: "@sec check upload",
    actorId: "human_reviewer",
    createdAt: "2026-06-30T00:00:00.000Z"
  });
  const caseMessages = store.roomMessages.filter((message) => message.roomId === "room_case_march_2026");
  const securityMessages = store.roomMessages.filter((message) => message.roomId === "room_security");

  assert.equal(result.routedScenarioId, "confidential_upload_attempt");
  assert.equal(result.systemMessage.roomId, "room_security");
  assert.equal(caseMessages.some((message) => message.id === result.message.id), true);
  assert.equal(securityMessages.length, beforeSecurityMessages + 1);
  assert.match(result.systemMessage.text, /routed "@sec check upload" to Confidential upload attempt/);
  assert.match(result.systemMessage.text, /created 4 card\(s\)/);
  assert.equal(store.situationLastAction.status, "manual_tag_routed_demo_act");
  assert.equal(store.situationLastAction.workOrderId, result.workOrder.id);
  assert.ok(store.situationEventLog.some((log) => log.eventType === "demo_command_routed" && log.artifactId === result.workOrder.id));
});

test("artifact pack selection is local state and rejects unknown packs", () => {
  const store = createInitialStore();

  assert.equal(setSituationArtifactPack(store, "work_orders"), "work_orders");
  assert.equal(store.activeSituationPack, "work_orders");
  assert.equal(setSituationArtifactPack(store, "unknown_pack"), "cards");
  assert.equal(store.activeSituationPack, "cards");
});

test("demo conductor acts create visible current-run deltas", () => {
  const store = createInitialStore();

  const result = runSituationDemoAct(store, "confidential_upload_attempt", "2026-06-30T00:00:00.000Z");

  assert.equal(store.situationDemoConductor.activeActId, "confidential_upload_attempt");
  assert.deepEqual(store.situationDemoConductor.completedActIds, ["confidential_upload_attempt"]);
  assert.equal(store.situationDemoConductor.actRecordsById.confidential_upload_attempt.actId, "confidential_upload_attempt");
  assert.equal(store.situationDemoConductor.lastAct.label, "Confidential upload attempt");
  assert.equal(store.situationDemoConductor.lastAct.deltas.cards, result.cards.length);
  assert.equal(store.situationDemoConductor.lastAct.deltas.workOrders, 1);
  assert.equal(store.situationDemoConductor.lastAct.deltas.approvals, 0);
  assert.equal(store.situationDemoConductor.lastAct.deltas.logs, 2);
  assert.equal(store.situationDemoConductor.lastAct.sourceEventId, result.sourceEvent.id);
  assert.equal(store.situationDemoConductor.lastAct.sourceEvent.triggerType, "external_llm_upload_attempt");
  assert.equal(result.workOrder.sourceEventId, result.sourceEvent.id);
  assert.ok(result.cards.every((card) => card.sourceEventId === result.sourceEvent.id));
  assert.match(store.situationDemoConductor.lastAct.chatbotContrast, /pasted/);
  assert.match(store.situationDemoConductor.lastAct.cambrianContrast, /Stops the risky upload/);
  assert.equal(store.situationLastAction.status, "demo_act_completed");
  assert.equal(store.situationLastAction.sourceEventId, result.sourceEvent.id);
  assert.equal(store.activeSituationRoomId, "room_security");
  assert.equal(store.activeSituationPack, "cards");
});

test("demo conductor reselects completed acts without duplicating artifacts", () => {
  const store = createInitialStore();
  runSituationDemoAct(store, "inbound_email_intake", "2026-06-30T00:00:00.000Z");
  const before = summarizeSituationMetrics(store);

  const repeat = runSituationDemoAct(store, "inbound_email_intake", "2026-06-30T00:01:00.000Z");
  const after = summarizeSituationMetrics(store);

  assert.equal(repeat.reused, true);
  assert.equal(repeat.cards.length, 0);
  assert.equal(repeat.approvalRequests.length, 0);
  assert.equal(after.cards, before.cards);
  assert.equal(after.workOrders, before.workOrders);
  assert.equal(after.pendingApprovals, before.pendingApprovals);
  assert.equal(store.situationLastAction.status, "demo_act_selected");
  assert.match(store.situationLastAction.summary, /no duplicate artifacts created/);
});

test("guided demo runs all five scenarios and creates a recap from clean local state", () => {
  const store = createInitialStore();
  store.situationCards.push({ id: "stale_card", cardId: "stale_card", roomId: "room_general_ops" });

  const report = runGuidedSituationDemo(store, "2026-06-30T00:00:00.000Z");

  assert.deepEqual(report.scenarioIds, GUIDED_DEMO_SCENARIO_ORDER);
  assert.equal(report.activeAgentsShown, 6);
  assert.equal(report.workOrdersCreated, 5);
  assert.equal(report.pendingApprovals, 3);
  assert.equal(report.noExternalSideEffects, true);
  assert.equal(report.truthLabel, "synthetic_local");
  assert.match(report.recapSummary, /6 active agents shown/);
  assert.match(report.recapSummary, /no external side effects/);
  assert.equal(store.situationSourceEvents.length, GUIDED_DEMO_SCENARIO_ORDER.length);
  assert.equal(new Set(store.situationSourceEvents.map((event) => event.scenarioId)).size, GUIDED_DEMO_SCENARIO_ORDER.length);
  assert.equal(store.activeSituationRoomId, "room_general_ops");
  assert.equal(store.activeSituationPack, "cards");
  assert.equal(store.situationLastAction.status, "guided_demo_completed");
  assert.match(store.situationLastAction.summary, /Guided demo created/);
  assert.match(store.situationLastAction.summary, /General Ops \/ Cards/);
  assert.equal(store.situationCards.some((card) => card.id === "stale_card"), false);
  assert.ok(store.situationCards.some((card) => card.type === "guided_demo_recap"));
  assert.ok(store.situationCards.some((card) => card.type === "mailbox_message_received"));
  assert.ok(store.situationCards.some((card) => card.type === "external_llm_upload_attempt"));
  assert.ok(store.situationCards.some((card) => card.type === "employee_onboarding_request"));
  assert.ok(store.situationCards.some((card) => card.type === "skill_update_candidate_created"));
  assert.ok(store.situationCards.some((card) => card.type === "token_spend_summary"));
});

test("all six active agents appear in Situation Room participation summary", () => {
  const store = createInitialStore();
  runGuidedSituationDemo(store, "2026-06-30T00:00:00.000Z");

  const summary = summarizeSituationAgentParticipation(store);
  assert.deepEqual(
    summary.map((agent) => agent.agentId),
    ["A-TREU-001", "A-INGEST-001", "A-SEC-001", "A-AUTH-001", "A-GAP-001", "A-CAD-001"]
  );
  assert.ok(summary.every((agent) => agent.role));
  assert.ok(summary.every((agent) => agent.latestAction !== "Waiting for local demo command"));
  assert.ok(summary.every((agent) => agent.totalOutputs > 0));
  assert.ok(summary.some((agent) => agent.agentId === "A-TREU-001" && agent.agentRuns >= 1));
  assert.ok(summary.some((agent) => agent.agentId === "A-AUTH-001" && agent.approvals >= 1));
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

test("supported demo commands route to useful local artifacts", () => {
  const examples = [
    ["@ingest process inbound email", "inbound_email_intake"],
    ["@treu run intake review", "inbound_email_intake"],
    ["@sec check upload", "confidential_upload_attempt"],
    ["@auth onboard junior accounting assistant", "employee_onboarding"],
    ["@gap inspect handoff", "agent_handoff_gap"],
    ["@cad run weekly audit", "weekly_control_audit"]
  ];

  for (const [index, [command, scenarioId]] of examples.entries()) {
    const store = createInitialStore();
    const result = postSituationMessage(store, {
      roomId: "room_case_march_2026",
      text: command,
      actorId: "human_reviewer",
      createdAt: `2026-06-30T00:0${index}:00.000Z`
    });

    assert.equal(result.routedScenarioId, scenarioId);
    assert.notEqual(result.workOrder.status, "planned");
    assert.ok(result.cards.length >= 4);
    assert.ok(result.cards.every((card) => card.workOrderId === result.workOrder.id));
    assert.ok(store.situationCards.some((card) => card.traceId === result.workOrder.traceId));
  }
});

test("manual demo tags reuse completed conductor acts without duplicate artifacts", () => {
  const store = createInitialStore();
  runSituationDemoAct(store, "weekly_control_audit", "2026-06-30T00:00:00.000Z");
  const before = summarizeSituationMetrics(store);

  const result = postSituationMessage(store, {
    roomId: "room_weekly_control",
    text: "@cad run weekly audit",
    actorId: "human_reviewer",
    createdAt: "2026-06-30T00:01:00.000Z"
  });
  const after = summarizeSituationMetrics(store);

  assert.equal(result.reused, true);
  assert.equal(result.workOrder, null);
  assert.equal(result.cards.length, 0);
  assert.equal(result.approvalRequests.length, 0);
  assert.equal(after.cards, before.cards);
  assert.equal(after.workOrders, before.workOrders);
  assert.equal(after.pendingApprovals, before.pendingApprovals);
  assert.equal(store.situationLastAction.status, "manual_tag_reused_demo_act");
  assert.match(result.systemMessage.text, /no duplicate artifacts created/);
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

test("scenario source events are local, honest, and linked to downstream artifacts", () => {
  for (const [index, scenario] of SITUATION_ROOM_SCENARIOS.entries()) {
    const store = createInitialStore();
    const result = runSituationScenario(store, scenario.id, `2026-06-30T00:0${index}:00.000Z`);
    const sourceEvent = result.sourceEvent;
    const sourceLog = store.situationEventLog.find(
      (log) => log.eventType === "source_event_received" && log.artifactId === sourceEvent.id
    );
    const sourceClaimText = [
      sourceEvent.sourceKind,
      sourceEvent.sourceLabel,
      sourceEvent.triggerType,
      sourceEvent.sourceActor,
      sourceEvent.payloadTitle,
      sourceEvent.payloadPreview
    ].join(" ");

    assert.equal(store.situationSourceEvents.length, 1);
    assert.equal(store.situationSourceEvents[0].id, sourceEvent.id);
    assert.equal(sourceEvent.sourceEventId, sourceEvent.id);
    assert.equal(sourceEvent.scenarioId, scenario.id);
    assert.equal(sourceEvent.roomId, scenario.roomId);
    assert.equal(sourceEvent.caseId, store.activeCaseId);
    assert.equal(sourceEvent.adapterMode, "synthetic_local");
    assert.equal(sourceEvent.truthLabel, "synthetic_local");
    assert.equal(sourceEvent.truthLabelText, "synthetic/local only");
    assert.equal(sourceEvent.externalEffect, "none");
    assert.deepEqual(sourceEvent.expectedAgentIds, scenario.expectedAgentIds);
    assert.match(sourceEvent.adapterBoundary, /Simulated\/local/);
    assert.doesNotMatch(sourceClaimText, /\breal Gmail\b|\bbrowser monitoring\b|\bIAM changes\b|\bSlack\b|\bDrive\b|\btelemetry backend\b|\bLLM call\b/i);
    assert.ok(sourceLog);
    assert.equal(sourceLog.artifactType, "source_event");
    assert.equal(sourceLog.sourceEventId, sourceEvent.id);
    assert.equal(result.workOrder.sourceEventId, sourceEvent.id);
    assert.ok(result.cards.length > 0);
    assert.ok(result.cards.every((card) => card.sourceEventId === sourceEvent.id));
    assert.ok(result.approvalRequests.every((approval) => approval.sourceEventId === sourceEvent.id));
  }
});

test("scenario cards carry identity fields and synthetic/local labels", () => {
  const store = createInitialStore();
  runGuidedSituationDemo(store, "2026-06-30T00:00:00.000Z");

  const scenarioCards = store.situationCards.filter((card) => card.type !== "guided_demo_recap");
  assert.ok(scenarioCards.length > 0);
  assert.ok(
    scenarioCards.every(
      (card) =>
        card.cardId &&
        card.roomId &&
        card.workOrderId &&
        card.sourceEventId &&
        card.traceId &&
        card.agentId &&
        card.truthLabel === "synthetic_local" &&
        card.externalEffect === "none"
    )
  );
  assert.ok(scenarioCards.some((card) => card.evidenceIds?.length > 0));
  assert.ok(scenarioCards.some((card) => card.approvalId && card.approvalStatus === "pending"));
});

test("confidential upload scenario is blocked and surfaces deterministic keyword risk signals", () => {
  const store = createInitialStore();
  const result = runSituationScenario(store, "confidential_upload_attempt", "2026-06-30T00:00:00.000Z");
  const finding = store.securityFindings.find((item) => item.targetType === "external_llm_upload_attempt");

  assert.equal(result.workOrder.status, "blocked");
  assert.deepEqual(result.approvalRequests, []);
  assert.notEqual(result.workOrder.status, "needs_approval");
  assert.ok(finding.riskSignals.some((signal) => signal.id === "external_llm_destination"));
  assert.ok(finding.riskSignals.some((signal) => signal.id === "payroll_keyword"));
  assert.ok(store.controlAgentOutputs.some((output) => output.details.some((detail) => detail.includes("keyword risk"))));
});

test("human approval gate resolves approval without granting hidden autonomy", () => {
  const store = createInitialStore();
  runSituationScenario(store, "employee_onboarding", "2026-06-30T00:00:00.000Z");
  const approval = store.approvalRequests.find((item) => item.actionType === "grant_read_only_and_draft_access");
  const beforeMetrics = summarizeSituationMetrics(store);

  assert.equal(approval.status, "pending");
  const resolved = resolveSituationApproval(store, approval.id, "approved", "human_boss", "2026-06-30T00:01:00.000Z");
  const workOrder = store.workOrders.find((item) => item.id === approval.workOrderId);
  const afterMetrics = summarizeSituationMetrics(store);

  assert.equal(resolved.status, "approved");
  assert.equal(resolved.externalEffect, "none");
  assert.match(resolved.localOnlyNotice, /Local approval recorded only/);
  assert.equal(workOrder.status, "local_approval_recorded");
  assert.match(workOrder.localOnlyNotice, /no email sent, access granted, or memory promoted/);
  assert.ok(
    store.situationCards.some(
      (card) =>
        card.type === "human_approval" &&
        card.approvalId === approval.id &&
        card.sourceEventId === approval.sourceEventId &&
        card.summary.includes("no external action executed")
    )
  );
  assert.ok(store.situationCards.some((card) => card.approvalId === approval.id && card.approvalStatus === "approved"));
  assert.ok(store.situationCards.some((card) => card.type === "agent_next_step_proposal" && card.sourceId === approval.id && card.sourceEventId === approval.sourceEventId));
  assert.equal(afterMetrics.reviewedApprovals, beforeMetrics.reviewedApprovals + 1);
  assert.equal(afterMetrics.reviewActions, beforeMetrics.reviewActions + 1);
  assert.ok(afterMetrics.logs > beforeMetrics.logs);
});

test("approve all helper resolves demo-safe approvals locally", () => {
  const store = createInitialStore();
  runGuidedSituationDemo(store, "2026-06-30T00:00:00.000Z");

  const resolved = resolveAllDemoSafeApprovals(store, "human_reviewer", "2026-06-30T00:10:00.000Z");

  assert.equal(resolved.length, 3);
  assert.equal(store.approvalRequests.every((approval) => approval.status === "approved"), true);
  assert.equal(store.workOrders.filter((workOrder) => workOrder.status === "local_approval_recorded").length, 3);
  assert.ok(store.situationCards.filter((card) => card.type === "human_approval").length >= 3);
});

test("situation metrics and timestamps cover current local artifacts", () => {
  const store = createInitialStore();
  runGuidedSituationDemo(store, "2026-06-30T00:00:00.000Z");
  const metrics = summarizeSituationMetrics(store);

  assert.equal(metrics.messages >= 2, true);
  assert.equal(metrics.cards, store.situationCards.length);
  assert.equal(metrics.workOrders, store.workOrders.length);
  assert.equal(metrics.pendingApprovals, 3);
  assert.equal(metrics.blockedWork, 1);
  assert.equal(metrics.logs, store.situationEventLog.length);
  assert.equal(metrics.localStorageKey, "agentops-core-store-v1");
  assert.ok(store.situationCards.every((card) => card.createdAt));
  assert.ok(store.workOrders.every((workOrder) => workOrder.createdAt && workOrder.updatedAt));
  assert.ok(store.approvalRequests.every((approval) => approval.createdAt));
  assert.ok(store.situationEventLog.every((log) => log.createdAt && log.logId && log.roomId));
});

test("demo snapshots export and import versioned local continuity state", () => {
  const source = createInitialStore();
  runGuidedSituationDemo(source, "2026-06-30T00:00:00.000Z");
  resolveAllDemoSafeApprovals(source, "human_reviewer", "2026-06-30T00:10:00.000Z");
  const { snapshot, snapshotJson } = exportSituationDemoSnapshot(source, {
    sessionId: "session_demo_part_1",
    scenarioWeek: 1,
    createdAt: "2026-06-30T00:20:00.000Z"
  });

  assert.equal(snapshot.snapshotVersion, SITUATION_SNAPSHOT_VERSION);
  assert.equal(snapshot.sessionId, "session_demo_part_1");
  assert.equal(snapshot.scenarioWeek, 1);
  assert.equal(snapshot.payload.situationSourceEvents.length, source.situationSourceEvents.length);
  assert.ok(snapshot.payload.situationSourceEvents.length > 0);
  assert.ok(snapshot.payload.situationEventLog.length > 0);
  assert.ok(snapshot.payload.roomMessages.length > 0);
  assert.equal(source.situationSnapshotStatus.status, "ready");

  const target = createInitialStore();
  const imported = importSituationDemoSnapshot(target, snapshotJson, "2026-07-07T00:00:00.000Z");

  assert.equal(imported.valid, true, imported.errors.join(" "));
  assert.equal(target.situationSessionId, "session_demo_part_1");
  assert.equal(target.situationScenarioWeek, 1);
  assert.equal(target.situationCards.length, source.situationCards.length);
  assert.equal(target.workOrders.length, source.workOrders.length);
  assert.equal(target.situationSourceEvents.length, source.situationSourceEvents.length);
  assert.ok(target.situationEventLog.some((log) => log.eventType === "demo_snapshot_imported"));
  assert.equal(importSituationDemoSnapshot(target, "{").valid, false);
  assert.equal(importSituationDemoSnapshot(target, { snapshotVersion: "wrong" }).valid, false);
});

test("week-two continuity scenario uses prior logs without backend persistence", () => {
  const store = createInitialStore();
  runGuidedSituationDemo(store, "2026-06-30T00:00:00.000Z");
  const priorLogCount = store.situationEventLog.length;
  const priorSourceEventCount = store.situationSourceEvents.length;

  const result = runWeekTwoContinuityScenario(store, "2026-07-07T00:00:00.000Z");

  assert.equal(result.scenarioWeek, 2);
  assert.equal(result.workOrder.status, "completed");
  assert.ok(result.cards.some((card) => card.type === "week_two_prior_log_review"));
  assert.ok(result.cards.some((card) => card.summary.includes(`${priorSourceEventCount} source event`)));
  assert.ok(result.cards.some((card) => card.summary.includes(`${priorLogCount} prior local log record`)));
  assert.ok(store.situationEventLog.some((log) => log.eventType === "week_two_continuity_run"));
  assert.equal(store.activeSituationRoomId, "room_weekly_control");
  assert.match(store.situationLastAction.summary, /source event/);
});
