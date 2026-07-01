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
  appendTreuhandReviewNextStepProposal,
  buildSituationDemoReadinessReport,
  buildSituationTraceChain,
  createSituationDemoSnapshot,
  exportSituationDemoSnapshot,
  importSituationDemoSnapshot,
  postSituationMessage,
  resolveAllDemoSafeApprovals,
  resolveSituationApproval,
  runSituationDemoAct,
  runGuidedSituationDemo,
  runWeekTwoContinuityScenario,
  selectAgentNextStep,
  selectFirstPendingNextStep,
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

  for (let index = 1; index <= 39; index += 1) {
    assert.match(contract, new RegExp(`AC-SR-${index}:`));
  }

  assert.match(contract, /roomId/);
  assert.match(contract, /workOrderId/);
  assert.match(contract, /approvalId/);
  assert.match(contract, /@treu/);
  assert.match(contract, /No External Side Effects/);
  assert.match(contract, /Demo Conductor/);
  assert.match(contract, /Source Event Model/);
  assert.match(contract, /Human Review Consequence Model/);
  assert.match(contract, /No External Execution After Approval/);
  assert.match(contract, /Responsible-Agent Follow-Through Semantics/);
  assert.match(contract, /Situation Trace Chain/);
  assert.match(contract, /Demo Readiness Report/);
  assert.match(contract, /Trace Chain Has No External Effects/);
  assert.match(contract, /synthetic_local/);
  assert.match(demoScript, /Event Source/);
  assert.match(demoScript, /Approval is not the end of the loop/);
  assert.match(demoScript, /The important part is the chain/);
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
  assert.match(app, /Pending next steps/);
  assert.match(app, /Trace Chain/);
  assert.match(app, /local synthetic trace only; no external action executed/);
  assert.match(app, /buildSituationTraceChain/);
  assert.match(app, /buildSituationDemoReadinessReport/);
  assert.match(app, /Demo readiness/);
  assert.match(app, /Select first pending next step across rooms locally/);
  assert.match(app, /Approve all demo-safe approvals across rooms/);
  assert.match(app, /Select locally/);
  assert.match(app, /selectAgentNextStep/);
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
  assert.match(situationRoomSource, /situationFollowThroughs/);
  assert.match(situationRoomSource, /selectAgentNextStep/);
  assert.match(situationRoomSource, /buildSituationTraceChain/);
  assert.match(situationRoomSource, /buildSituationDemoReadinessReport/);
  assert.match(situationRoomSource, /responsibleAgentId/);
  assert.match(situationRoomSource, /gateAgentId/);
  assert.match(situationRoomSource, /controlAgentId/);
  assert.match(situationRoomSource, /source_event_received/);
  assert.match(situationRoomSource, /actRecordsById/);
  assert.match(situationRoomSource, /manual_tag_reused_demo_act/);
  assert.match(situationRoomSource, /chatbotContrast/);
  assert.match(app, /created:/);
  assert.doesNotMatch(app, /real Gmail|Slack|IAM|browser DLP|Drive|telemetry|email sending|access grant|memory promotion|LLM execution/i);
  assert.doesNotMatch(situationRoomSource, /real Gmail|Slack|IAM|browser DLP|Drive|telemetry|email sent|access granted|memory promoted|LLM execution/i);
});

test("initial store seeds Situation Room rooms and supported agent tags", () => {
  const store = createInitialStore();

  assert.ok(store.situationRooms.length >= 5);
  assert.equal(store.activeSituationRoomId, "room_case_march_2026");
  assert.equal(store.expandedSituationAgentId, null);
  assert.deepEqual(store.situationDemoConductor.completedActIds, []);
  assert.deepEqual(store.situationSourceEvents, []);
  assert.deepEqual(store.situationFollowThroughs, []);
  assert.equal(ACTIVE_SITUATION_AGENTS.length, 6);
  assert.deepEqual(SITUATION_ARTIFACT_PACKS.map((pack) => pack.id), ["cards", "next_steps", "events", "work_orders", "approvals", "logs"]);
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
  assert.equal(store.situationLastAction.status, "manual_tag_routed_demo_act");
  assert.equal(store.situationLastAction.workOrderId, result.workOrder.id);
  assert.match(result.systemMessage.text, /workOrderId/);
  assert.match(result.systemMessage.text, /sourceEventId/);
  assert.match(result.systemMessage.text, /cards 4/);
  assert.match(result.systemMessage.text, /approvals 0/);
  assert.ok(
    store.situationEventLog.some(
      (log) =>
        log.eventType === "demo_command_routed" &&
        log.artifactId === result.workOrder.id &&
        log.sourceEventId === store.situationLastAction.sourceEventId
    )
  );
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
  assert.match(report.recapSummary, /pending next-step proposal/);
  assert.match(report.recapSummary, /selected follow-through/);
  assert.match(report.recapSummary, /no external actions executed/);
  assert.equal(report.pendingNextStepProposals, 0);
  assert.equal(report.selectedFollowThroughs, 0);
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
  const proposal = store.situationCards.find((card) => card.type === "agent_next_step_proposal" && card.sourceId === approval.id);
  const afterMetrics = summarizeSituationMetrics(store);

  assert.equal(resolved.status, "approved");
  assert.equal(resolved.externalEffect, "none");
  assert.match(resolved.localOnlyNotice, /Local approval recorded only/);
  assert.equal(resolved.gateAgentId, "A-AUTH-001");
  assert.equal(resolved.controlAgentId, "A-AUTH-001");
  assert.equal(resolved.responsibleAgentId, "A-AUTH-001");
  assert.equal(workOrder.status, "local_approval_recorded");
  assert.match(workOrder.localOnlyNotice, /no external side effect executed/);
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
  assert.equal(proposal.status, "pending");
  assert.equal(proposal.agentId, "A-AUTH-001");
  assert.equal(proposal.sourceType, "approval");
  assert.equal(proposal.sourceEventId, approval.sourceEventId);
  assert.equal(proposal.workOrderId, approval.workOrderId);
  assert.ok(proposal.choices.every((choice) => choice.localConsequenceType));
  assert.ok(proposal.choices.some((choice) => choice.label === "Record local least-privilege plan"));
  assert.equal(store.activeSituationPack, "next_steps");
  assert.equal(afterMetrics.reviewedApprovals, beforeMetrics.reviewedApprovals + 1);
  assert.equal(afterMetrics.reviewActions, beforeMetrics.reviewActions + 1);
  assert.equal(afterMetrics.pendingNextSteps, 1);
  assert.ok(afterMetrics.logs > beforeMetrics.logs);
});

test("review-before-send approval keeps A-AUTH gate but creates A-TREU follow-through proposal", () => {
  const { store, approval, proposal } = resolveApprovalAndFindProposal("inbound_email_intake", "review_before_send", "approved");
  const humanApprovalCard = store.situationCards.find((card) => card.type === "human_approval" && card.approvalId === approval.id);

  assert.equal(approval.gateAgentId, "A-AUTH-001");
  assert.equal(approval.controlAgentId, "A-AUTH-001");
  assert.equal(approval.requestedByAgentId, "A-AUTH-001");
  assert.equal(approval.responsibleAgentId, "A-TREU-001");
  assert.equal(humanApprovalCard.agentId, "A-AUTH-001");
  assert.equal(proposal.agentId, "A-TREU-001");
  assert.equal(proposal.sourceType, "approval");
  assert.equal(proposal.sourceId, approval.id);
  assert.equal(approval.nextStepProposalId, proposal.id);
  assert.equal(store.situationLastAction.proposalCardId, proposal.id);
});

test("approval next-step choices are decision-aware across responsible agents", () => {
  const approvedDraft = resolveApprovalAndFindProposal("inbound_email_intake", "review_before_send", "approved");
  const rejectedDraft = resolveApprovalAndFindProposal("inbound_email_intake", "review_before_send", "rejected");
  const approvedAccess = resolveApprovalAndFindProposal("employee_onboarding", "grant_read_only_and_draft_access", "approved");
  const rejectedAccess = resolveApprovalAndFindProposal("employee_onboarding", "grant_read_only_and_draft_access", "rejected");
  const approvedMemory = resolveApprovalAndFindProposal("agent_handoff_gap", "approve_operating_memory_candidate", "approved");
  const rejectedMemory = resolveApprovalAndFindProposal("agent_handoff_gap", "approve_operating_memory_candidate", "rejected");

  assert.deepEqual(approvedDraft.proposal.choices.map((choice) => choice.label), [
    "Inspect draft before use",
    "Keep draft blocked for edit",
    "Move to Validation capture"
  ]);
  assert.deepEqual(rejectedDraft.proposal.choices.map((choice) => choice.label), [
    "Mark draft not usable",
    "Request revised draft",
    "Ask for missing client documents"
  ]);
  assert.equal(approvedDraft.approval.gateAgentId, "A-AUTH-001");
  assert.equal(approvedDraft.approval.responsibleAgentId, "A-TREU-001");
  assert.equal(approvedDraft.proposal.agentId, "A-TREU-001");
  assert.ok(approvedAccess.proposal.choices.some((choice) => choice.label === "Record local least-privilege plan"));
  assert.ok(rejectedAccess.proposal.choices.some((choice) => choice.label === "Prepare narrower access request"));
  assert.equal(approvedAccess.approval.responsibleAgentId, "A-AUTH-001");
  assert.equal(approvedAccess.proposal.agentId, "A-AUTH-001");
  assert.ok(approvedMemory.proposal.choices.some((choice) => choice.label === "Keep candidate in local memory backlog"));
  assert.ok(rejectedMemory.proposal.choices.some((choice) => choice.label === "Archive candidate"));
  assert.equal(approvedMemory.approval.responsibleAgentId, "A-GAP-001");
  assert.equal(approvedMemory.proposal.agentId, "A-GAP-001");
  for (const { proposal } of [approvedDraft, rejectedDraft, approvedAccess, rejectedAccess, approvedMemory, rejectedMemory]) {
    assert.equal(proposal.externalEffect, "none");
    assert.equal(proposal.truthLabel, "synthetic_local");
    assert.ok(proposal.choices.every((choice) => choice.localConsequenceType));
    assert.doesNotMatch(nextStepText(proposal), /send email|grant access|promote memory|slack|gmail|drive|browser action|llm execution|execute/i);
  }
});

test("selecting a next-step choice records local follow-through and preserves trace chain", () => {
  const { store, approval, proposal } = resolveApprovalAndFindProposal("inbound_email_intake", "review_before_send", "approved");
  const choice = proposal.choices.find((item) => item.id === "inspect_draft_before_use");
  const beforeMessages = store.roomMessages.length;
  const beforeLogs = store.situationEventLog.length;

  assert.throws(
    () => selectAgentNextStep(store, proposal.id, "not_a_choice", "human_reviewer", "2026-06-30T00:02:00.000Z"),
    /Unknown next-step choice/
  );

  const result = selectAgentNextStep(store, proposal.id, choice.id, "human_reviewer", "2026-06-30T00:02:00.000Z");
  const selectedProposal = store.situationCards.find((card) => card.id === proposal.id);
  const followThrough = result.followThrough;
  const followThroughCard = store.situationCards.find((card) => card.type === "local_follow_through_recorded" && card.followThroughId === followThrough.id);

  assert.equal(selectedProposal.status, "selected");
  assert.equal(selectedProposal.selectedChoiceId, choice.id);
  assert.equal(selectedProposal.selectedBy, "human_reviewer");
  assert.equal(selectedProposal.followThroughId, followThrough.id);
  assert.equal(followThrough.proposalCardId, proposal.id);
  assert.equal(followThrough.sourceType, "approval");
  assert.equal(followThrough.sourceId, approval.id);
  assert.equal(followThrough.sourceEventId, approval.sourceEventId);
  assert.equal(followThrough.workOrderId, approval.workOrderId);
  assert.equal(followThrough.caseId, approval.caseId);
  assert.equal(followThrough.agentId, proposal.agentId);
  assert.equal(followThrough.traceId, approval.traceId);
  assert.equal(followThrough.externalEffect, "none");
  assert.equal(followThrough.status, "recorded_local_only");
  assert.ok(followThroughCard);
  assert.equal(followThroughCard.sourceEventId, approval.sourceEventId);
  assert.equal(store.roomMessages.length, beforeMessages + 1);
  assert.ok(store.roomMessages.some((message) => message.text.includes(followThrough.id)));
  assert.equal(store.situationEventLog.length, beforeLogs + 2);
  assert.ok(store.situationEventLog.some((log) => log.eventType === "local_follow_through_recorded" && log.artifactId === followThrough.id && log.sourceEventId === approval.sourceEventId));
  assert.equal(store.situationLastAction.followThroughId, followThrough.id);
  assert.equal(store.activeSituationPack, "next_steps");
  assert.throws(
    () => selectAgentNextStep(store, proposal.id, choice.id, "human_reviewer", "2026-06-30T00:03:00.000Z"),
    /already selected/
  );
});

test("trace chain rebuilds source event through selected follow-through from every supported identity", () => {
  const { store, approval, proposal } = resolveApprovalAndFindProposal("inbound_email_intake", "review_before_send", "approved");
  const selected = selectAgentNextStep(store, proposal.id, proposal.actions[0].id, "human_reviewer", "2026-06-30T00:02:00.000Z");
  const workOrder = store.workOrders.find((item) => item.id === approval.workOrderId);
  const selectors = [
    { sourceEventId: approval.sourceEventId },
    { workOrderId: approval.workOrderId },
    { approvalId: approval.id },
    { proposalCardId: proposal.id },
    { followThroughId: selected.followThrough.id }
  ];

  for (const selector of selectors) {
    const chain = buildSituationTraceChain(store, selector);

    assert.equal(chain.sourceEvent.id, approval.sourceEventId);
    assert.equal(chain.workOrder.id, workOrder.id);
    assert.ok(chain.cards.length >= 5);
    assert.ok(chain.approvals.some((item) => item.id === approval.id));
    assert.ok(chain.nextStepProposals.some((item) => item.id === proposal.id));
    assert.ok(chain.followThroughs.some((item) => item.id === selected.followThrough.id));
    assert.ok(chain.logs.some((log) => log.sourceEventId === approval.sourceEventId));
    assert.equal(chain.externalEffectSummary, "none");
    assert.equal(chain.truthLabel, "synthetic_local");
    assert.equal(chain.missingLinks.some((link) => link.link === "selected_follow_through"), false);
  }
});

test("trace chain reports waiting states before approval and follow-through", () => {
  const store = createInitialStore();
  const result = runSituationDemoAct(store, "inbound_email_intake", "2026-06-30T00:00:00.000Z");

  const chain = buildSituationTraceChain(store, { sourceEventId: result.sourceEvent.id });
  const nextStepMissing = chain.missingLinks.find((link) => link.link === "next_step_proposal");
  const followThroughMissing = chain.missingLinks.find((link) => link.link === "selected_follow_through");

  assert.equal(chain.sourceEvent.id, result.sourceEvent.id);
  assert.equal(chain.workOrder.id, result.workOrder.id);
  assert.ok(chain.approvals.some((approval) => approval.status === "pending"));
  assert.equal(nextStepMissing.label, "waiting for human review");
  assert.equal(followThroughMissing.label, "waiting for human review");
  assert.equal(chain.externalEffectSummary, "none");
});

test("demo-readiness report summarizes chain prerequisites and next business ask", () => {
  const store = createInitialStore();
  for (const [index, scenarioId] of GUIDED_DEMO_SCENARIO_ORDER.entries()) {
    runSituationDemoAct(store, scenarioId, `2026-06-30T00:0${index}:00.000Z`);
  }
  const approval = store.approvalRequests.find((item) => item.actionType === "review_before_send");
  resolveSituationApproval(store, approval.id, "approved", "human_reviewer", "2026-06-30T00:10:00.000Z");
  selectFirstPendingNextStep(store, "human_reviewer", "2026-06-30T00:11:00.000Z");

  const report = buildSituationDemoReadinessReport(store);

  assert.equal(report.completedActCount, 5);
  assert.equal(report.allConductorActsRun, true);
  assert.equal(report.activeAgentsShown, 6);
  assert.equal(report.allActiveAgentsShown, true);
  assert.equal(report.sourceEventsCount, 5);
  assert.equal(report.workOrdersCount, 5);
  assert.equal(report.approvalGatesCount, 3);
  assert.equal(report.reviewedApprovalsCount, 1);
  assert.equal(report.pendingNextStepProposalsCount, 0);
  assert.equal(report.selectedFollowThroughCount, 1);
  assert.equal(report.realExternalEffects, "none");
  assert.match(report.fixtureProofBoundary, /Synthetic\/local fixture only/);
  assert.match(report.nextBusinessAsk, /3-5 anonymized real Treuhand cases/);
});

test("demo helper selects the first pending next step locally", () => {
  const { store, proposal } = resolveApprovalAndFindProposal("employee_onboarding", "grant_read_only_and_draft_access", "approved");

  const result = selectFirstPendingNextStep(store, "human_reviewer", "2026-06-30T00:03:00.000Z");

  assert.ok(result.followThrough);
  assert.equal(result.proposal.id, proposal.id);
  assert.equal(store.situationFollowThroughs.length, 1);
  assert.equal(store.situationCards.find((card) => card.id === proposal.id).status, "selected");
  assert.equal(selectFirstPendingNextStep(store, "human_reviewer", "2026-06-30T00:04:00.000Z"), null);
});

test("Treuhand review decisions create A-TREU next-step proposals", () => {
  const expectedLabels = {
    approve: ["Inspect evidence links", "Keep draft in local review", "Capture validation feedback"],
    edit: ["Revise draft locally", "Add reviewer note", "Re-run after checklist update"],
    reject: ["Mark recommendation not usable", "Inspect false-positive cause", "Create gap candidate for A-GAP review"]
  };

  for (const [decision, labels] of Object.entries(expectedLabels)) {
    const store = createInitialStore();
    runSituationScenario(store, "inbound_email_intake", "2026-06-30T00:00:00.000Z");
    const recommendation = store.recommendations.find((item) => item.sourceEventId);
    const reviewDecision = {
      id: `review_${decision}`,
      recommendationId: recommendation.id,
      caseId: recommendation.caseId,
      decision,
      comment: `${decision} locally`,
      createdAt: "2026-06-30T00:01:00.000Z"
    };

    const proposal = appendTreuhandReviewNextStepProposal(store, { recommendation, reviewDecision, createdAt: reviewDecision.createdAt });

    assert.equal(proposal.agentId, "A-TREU-001");
    assert.equal(proposal.sourceType, "review_decision");
    assert.equal(proposal.sourceId, reviewDecision.id);
    assert.equal(proposal.sourceEventId, recommendation.sourceEventId);
    assert.equal(proposal.workOrderId, recommendation.workOrderId);
    assert.equal(proposal.traceId, recommendation.traceId);
    assert.deepEqual(proposal.choices.map((choice) => choice.label), labels);
  }
});

test("approve all helper resolves demo-safe approvals locally", () => {
  const store = createInitialStore();
  runGuidedSituationDemo(store, "2026-06-30T00:00:00.000Z");

  const resolved = resolveAllDemoSafeApprovals(store, "human_reviewer", "2026-06-30T00:10:00.000Z");

  assert.equal(resolved.length, 3);
  assert.equal(store.approvalRequests.every((approval) => approval.status === "approved"), true);
  assert.equal(store.workOrders.filter((workOrder) => workOrder.status === "local_approval_recorded").length, 3);
  assert.ok(store.situationCards.filter((card) => card.type === "human_approval").length >= 3);
  assert.equal(store.situationCards.filter((card) => card.type === "agent_next_step_proposal" && card.status === "pending").length, 3);
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
  assert.equal(metrics.pendingNextSteps, 0);
  assert.equal(metrics.selectedFollowThroughs, 0);
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
  const selected = selectFirstPendingNextStep(source, "human_reviewer", "2026-06-30T00:15:00.000Z");
  const { snapshot, snapshotJson } = exportSituationDemoSnapshot(source, {
    sessionId: "session_demo_part_1",
    scenarioWeek: 1,
    createdAt: "2026-06-30T00:20:00.000Z"
  });

  assert.equal(snapshot.snapshotVersion, SITUATION_SNAPSHOT_VERSION);
  assert.equal(snapshot.sessionId, "session_demo_part_1");
  assert.equal(snapshot.scenarioWeek, 1);
  assert.equal(snapshot.payload.situationSourceEvents.length, source.situationSourceEvents.length);
  assert.equal(snapshot.payload.situationFollowThroughs.length, source.situationFollowThroughs.length);
  assert.ok(snapshot.payload.situationCards.some((card) => card.id === selected.proposal.id && card.status === "selected"));
  assert.ok(snapshot.payload.situationSourceEvents.length > 0);
  assert.ok(snapshot.payload.situationFollowThroughs.length > 0);
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
  assert.equal(target.situationFollowThroughs.length, source.situationFollowThroughs.length);
  assert.ok(target.situationCards.some((card) => card.id === selected.proposal.id && card.status === "selected"));
  const importedChain = buildSituationTraceChain(target, { followThroughId: selected.followThrough.id });
  assert.equal(importedChain.sourceEvent.id, selected.followThrough.sourceEventId);
  assert.equal(importedChain.workOrder.id, selected.followThrough.workOrderId);
  assert.ok(importedChain.nextStepProposals.some((proposal) => proposal.id === selected.proposal.id));
  assert.ok(importedChain.followThroughs.some((record) => record.id === selected.followThrough.id));
  assert.equal(importedChain.externalEffectSummary, "none");
  assert.ok(target.situationEventLog.some((log) => log.eventType === "demo_snapshot_imported"));
  assert.equal(importSituationDemoSnapshot(target, "{").valid, false);
  assert.equal(importSituationDemoSnapshot(target, { snapshotVersion: "wrong" }).valid, false);
});

test("week-two continuity scenario uses prior logs without backend persistence", () => {
  const store = createInitialStore();
  runGuidedSituationDemo(store, "2026-06-30T00:00:00.000Z");
  resolveAllDemoSafeApprovals(store, "human_reviewer", "2026-06-30T00:10:00.000Z");
  selectFirstPendingNextStep(store, "human_reviewer", "2026-06-30T00:15:00.000Z");
  const priorLogCount = store.situationEventLog.length;
  const priorSourceEventCount = store.situationSourceEvents.length;
  const priorFollowThroughCount = store.situationFollowThroughs.length;

  const result = runWeekTwoContinuityScenario(store, "2026-07-07T00:00:00.000Z");

  assert.equal(result.scenarioWeek, 2);
  assert.equal(result.workOrder.status, "completed");
  assert.ok(result.cards.some((card) => card.type === "week_two_prior_log_review"));
  assert.ok(result.cards.some((card) => card.summary.includes(`${priorSourceEventCount} source event`)));
  assert.ok(result.cards.some((card) => card.summary.includes(`${priorLogCount} prior local log record`)));
  assert.ok(result.cards.some((card) => card.summary.includes(`${priorFollowThroughCount} local follow-through decision`)));
  assert.ok(store.situationEventLog.some((log) => log.eventType === "week_two_continuity_run"));
  assert.equal(store.activeSituationRoomId, "room_weekly_control");
  assert.match(store.situationLastAction.summary, /source event/);
  assert.match(store.situationLastAction.summary, /follow-through/);
  const activeWeekTwoChain = buildSituationTraceChain(store, store.situationLastAction);
  assert.equal(activeWeekTwoChain.workOrder.id, result.workOrder.id);
  assert.ok(activeWeekTwoChain.cards.some((card) => card.workOrderId === result.workOrder.id));
  assert.equal(activeWeekTwoChain.externalEffectSummary, "none");
});

function resolveApprovalAndFindProposal(scenarioId, actionType, decision) {
  const store = createInitialStore();
  runSituationScenario(store, scenarioId, "2026-06-30T00:00:00.000Z");
  const approval = store.approvalRequests.find((item) => item.actionType === actionType);
  assert.ok(approval, `${actionType} approval exists`);
  resolveSituationApproval(store, approval.id, decision, "human_reviewer", "2026-06-30T00:01:00.000Z");
  const proposal = store.situationCards.find((card) => card.type === "agent_next_step_proposal" && card.sourceId === approval.id);
  assert.ok(proposal, `${actionType} proposal exists`);
  return { store, approval, proposal };
}

function nextStepText(proposal) {
  return proposal.choices.map((choice) => `${choice.label} ${choice.description}`).join(" ");
}
