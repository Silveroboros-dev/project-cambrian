import { runTreuhandAgent } from "./agent.js";
import {
  createControlOutput,
  mergeById,
  runDataIngestionAgent,
  runGapAnalyst,
  runSecurityAgent
} from "./controlAgents.js";
import { validatePrivacyForExport } from "./rules/securityRules.js";
import { getCaseChecklist } from "./validation.js";

export const AGENT_TAGS = {
  "@treu": "A-TREU-001",
  "@ingest": "A-INGEST-001",
  "@sec": "A-SEC-001",
  "@auth": "A-AUTH-001",
  "@gap": "A-GAP-001",
  "@cad": "A-CAD-001"
};

export const SITUATION_ROOM_SCENARIOS = [
  {
    id: "inbound_email_intake",
    label: "Inbound email intake",
    roomId: "room_case_march_2026",
    primaryAgentId: "A-INGEST-001"
  },
  {
    id: "confidential_upload_attempt",
    label: "Confidential upload attempt",
    roomId: "room_security",
    primaryAgentId: "A-SEC-001"
  },
  {
    id: "employee_onboarding",
    label: "Employee onboarding",
    roomId: "room_onboarding",
    primaryAgentId: "A-AUTH-001"
  },
  {
    id: "agent_handoff_gap",
    label: "Agent handoff gap",
    roomId: "room_case_march_2026",
    primaryAgentId: "A-GAP-001"
  },
  {
    id: "weekly_control_audit",
    label: "Weekly control audit",
    roomId: "room_weekly_control",
    primaryAgentId: "A-CAD-001"
  }
];

const TAG_STAGES = {
  "A-TREU-001": ["read allowed context", "build evidence inventory", "check required documents", "draft follow-up", "request human review"],
  "A-INGEST-001": ["read inbound source", "classify source", "create context packet", "preserve evidence IDs"],
  "A-SEC-001": ["scan submitted text", "classify risk", "create warning or block", "suggest safe alternative"],
  "A-AUTH-001": ["read policy snippet", "match role", "recommend least privilege", "request boss approval"],
  "A-GAP-001": ["inspect handoff", "find missing context", "propose skill or checklist update", "request memory approval"],
  "A-CAD-001": ["collect local logs", "summarize pending reviews", "summarize warnings", "recommend next operating action"]
};

export function createInitialSituationRoomState(caseId = "case_demo_march_2026", createdAt = new Date().toISOString()) {
  return {
    situationRooms: [
      createRoom({ id: "room_general_ops", type: "general", title: "General Ops Room", allowedAgentIds: Object.values(AGENT_TAGS), createdAt }),
      createRoom({ id: "room_case_march_2026", type: "case", title: "Treuhand Case Room: March 2026", caseId, allowedAgentIds: Object.values(AGENT_TAGS), createdAt }),
      createRoom({ id: "room_security", type: "security", title: "Security Room", allowedAgentIds: ["A-SEC-001", "A-CAD-001"], createdAt }),
      createRoom({ id: "room_onboarding", type: "onboarding", title: "Onboarding Room", allowedAgentIds: ["A-AUTH-001", "A-SEC-001", "A-CAD-001"], createdAt }),
      createRoom({ id: "room_weekly_control", type: "audit", title: "Weekly Control Room", allowedAgentIds: ["A-CAD-001", "A-SEC-001", "A-AUTH-001", "A-GAP-001"], createdAt })
    ],
    activeSituationRoomId: "room_case_march_2026",
    roomMessages: [
      createRoomMessage({
        id: "msg_situation_seed",
        roomId: "room_general_ops",
        actorType: "system",
        actorId: "system",
        text: "Situation Room is local-only. Tag agents to create governed work orders; use scenarios to show the six-agent control loop.",
        createdAt
      })
    ],
    workOrders: [],
    situationCards: [],
    approvalRequests: [],
    selectedSituationCardId: null
  };
}

export function postSituationMessage(store, { roomId, text, actorId = "human_reviewer", createdAt = new Date().toISOString() }) {
  ensureSituationRoomCollections(store);
  const message = createRoomMessage({
    id: createId("msg", roomId, createdAt, store.roomMessages.length + 1),
    roomId,
    actorType: "human",
    actorId,
    text,
    mentions: extractMentions(text),
    createdAt
  });
  store.roomMessages.unshift(message);

  const parsed = parseAgentTag(text);
  if (!parsed) {
    return { message, workOrder: null, cards: [], approvalRequests: [] };
  }

  const caseRecord = activeCaseFromStore(store);
  const workOrder = createWorkOrder({
    id: createId("wo", parsed.agentId, roomId, createdAt),
    roomId,
    caseId: caseRecord?.id || null,
    requestedBy: actorId,
    agentId: parsed.agentId,
    command: text,
    status: "planned",
    createdAt
  });
  const cards = [
    createSituationCard({
      id: createId("card", workOrder.id, "requested"),
      roomId,
      type: "tagged_work_order",
      agentId: parsed.agentId,
      caseId: workOrder.caseId,
      title: `${parsed.tag} work order planned`,
      summary: `${parsed.agentId} staged ${workOrder.stages.length} local step(s).`,
      severity: "info",
      workOrderId: workOrder.id,
      traceId: workOrder.traceId,
      createdAt
    })
  ];

  store.workOrders.unshift(workOrder);
  store.situationCards.unshift(...cards);
  return { message, workOrder, cards, approvalRequests: [] };
}

export function runSituationScenario(store, scenarioId, createdAt = new Date().toISOString()) {
  ensureSituationRoomCollections(store);
  const scenario = SITUATION_ROOM_SCENARIOS.find((item) => item.id === scenarioId);
  if (!scenario) throw new Error(`Unknown situation scenario: ${scenarioId}`);

  if (scenarioId === "inbound_email_intake") return runInboundEmailScenario(store, scenario, createdAt);
  if (scenarioId === "confidential_upload_attempt") return runConfidentialUploadScenario(store, scenario, createdAt);
  if (scenarioId === "employee_onboarding") return runEmployeeOnboardingScenario(store, scenario, createdAt);
  if (scenarioId === "agent_handoff_gap") return runAgentHandoffGapScenario(store, scenario, createdAt);
  return runWeeklyControlAuditScenario(store, scenario, createdAt);
}

export function resolveSituationApproval(
  store,
  approvalId,
  decision,
  actorId = "human_boss",
  createdAt = new Date().toISOString()
) {
  ensureSituationRoomCollections(store);
  const approval = store.approvalRequests.find((item) => item.id === approvalId);
  if (!approval) throw new Error(`Unknown approval request: ${approvalId}`);
  if (approval.status !== "pending") return approval;

  approval.status = decision === "approved" ? "approved" : "rejected";
  approval.decidedBy = actorId;
  approval.decidedAt = createdAt;
  const workOrder = store.workOrders.find((item) => item.id === approval.workOrderId);
  if (workOrder) {
    workOrder.status = approval.status === "approved" ? "completed" : "failed";
    workOrder.updatedAt = createdAt;
  }

  const card = createSituationCard({
    id: createId("card", approvalId, approval.status),
    roomId: approval.roomId,
    type: "human_approval",
    agentId: approval.requestedByAgentId,
    caseId: approval.caseId,
    title: `Approval ${approval.status}`,
    summary: `${actorId} ${approval.status} ${approval.actionType}.`,
    severity: approval.status === "approved" ? "info" : "warning",
    approvalId,
    workOrderId: approval.workOrderId,
    traceId: approval.traceId,
    createdAt
  });
  store.situationCards.unshift(card);
  return approval;
}

export function parseAgentTag(text) {
  const normalized = String(text || "").toLowerCase();
  const tag = Object.keys(AGENT_TAGS).find((candidate) => normalized.includes(candidate));
  return tag ? { tag, agentId: AGENT_TAGS[tag] } : null;
}

function runInboundEmailScenario(store, scenario, createdAt) {
  const caseRecord = activeCaseFromStore(store);
  const traceId = createId("trace", scenario.id, createdAt);
  const evidenceId = createId("ev", scenario.id, "mail");
  if (!caseRecord.evidence.some((item) => item.id === evidenceId)) {
    caseRecord.evidence.push({
      id: evidenceId,
      type: "email",
      title: "Synthetic mailbox message: March 2026 Treuhand packet",
      content:
        "Synthetic inbound email received inside a 30 minute intake window. Bank statement and sales invoice export are attached for 2026-03. MWST-Abrechnung fehlt and will follow later.",
      actor: "client",
      receivedAt: createdAt
    });
  }

  const workOrder = createScenarioWorkOrder({ scenario, caseRecord, command: "@ingest process inbound email", traceId, createdAt });
  const ingestion = runDataIngestionAgent(caseRecord, store.contextPackets.filter((packet) => packet.caseId === caseRecord.id), createdAt);
  store.contextPackets = mergeById(store.contextPackets, ingestion.contextPackets);
  store.controlAgentOutputs = mergeById(store.controlAgentOutputs, ingestion.controlAgentOutputs);

  const output = runTreuhandAgent(caseRecord, getCaseChecklist(caseRecord));
  const run = {
    id: createId("run", scenario.id, caseRecord.id),
    caseId: caseRecord.id,
    agentCode: output.agent_code,
    status: "succeeded",
    output,
    startedAt: output.audit.started_at,
    completedAt: output.audit.completed_at
  };
  store.agentRuns = [run, ...store.agentRuns.filter((item) => item.id !== run.id)];

  for (const recommendation of output.recommendations) {
    store.recommendations.unshift({
      ...recommendation,
      caseId: caseRecord.id,
      runId: run.id,
      reviewStatus: "pending",
      draft: output.draft_outputs.email_draft
    });
  }

  const security = runSecurityAgent({
    caseRecord,
    contextPackets: store.contextPackets.filter((packet) => packet.caseId === caseRecord.id),
    agentRun: run,
    createdAt
  });
  store.securityFindings = mergeById(store.securityFindings, security.securityFindings);
  store.controlAgentOutputs = mergeById(store.controlAgentOutputs, security.controlAgentOutputs);

  const gap = runGapAnalyst({ caseRecord, agentRun: run, createdAt });
  store.gapFindings = mergeById(store.gapFindings, gap.gapFindings);
  store.handoffRequests = mergeById(store.handoffRequests, gap.handoffRequests);
  store.memoryCandidates = mergeById(store.memoryCandidates, gap.memoryCandidates);
  store.controlAgentOutputs = mergeById(store.controlAgentOutputs, gap.controlAgentOutputs);

  const approval = createApprovalRequest({
    id: createId("apr", scenario.id, "review_before_send"),
    roomId: scenario.roomId,
    workOrderId: workOrder.id,
    caseId: caseRecord.id,
    requestedByAgentId: "A-AUTH-001",
    approverRole: "reviewer",
    actionType: "review_before_send",
    rationale: "Client-facing draft must be reviewed before any email is sent.",
    traceId,
    createdAt
  });
  const missingCount = output.metrics.missing_items_count;
  const cards = [
    scenarioCard(scenario, traceId, "mailbox_message_received", "system", caseRecord.id, "Inbound mailbox message received", "Synthetic email arrived in the 30 minute intake window.", "info", [evidenceId], createdAt),
    scenarioCard(scenario, traceId, "context_packet_created", "A-INGEST-001", caseRecord.id, "Context packet created", `${ingestion.contextPackets.length} new packet(s) normalized from evidence.`, "info", [evidenceId], createdAt),
    scenarioCard(scenario, traceId, "security_warning", "A-SEC-001", caseRecord.id, "Security check completed", `${security.securityFindings.length} finding(s) visible in Controls.`, security.securityFindings.length > 0 ? "warning" : "info", [evidenceId], createdAt),
    scenarioCard(scenario, traceId, "agent_run", "A-TREU-001", caseRecord.id, "Treuhand intake review completed", `${missingCount} missing checklist item(s), draft follow-up created.`, missingCount > 0 ? "warning" : "info", output.recommendations[0]?.evidence_ids || [], createdAt, run.id),
    scenarioCard(scenario, traceId, "human_review", "A-AUTH-001", caseRecord.id, "Human review required", "Draft follow-up is blocked until reviewer approval.", "warning", output.recommendations[0]?.evidence_ids || [], createdAt, run.id, approval.id)
  ];
  return appendScenarioResult(store, { scenario, workOrder, cards, approvalRequests: [approval], createdAt, auditMessage: "Ran inbound email intake Situation Room scenario." });
}

function runConfidentialUploadScenario(store, scenario, createdAt) {
  const caseRecord = activeCaseFromStore(store);
  const traceId = createId("trace", scenario.id, createdAt);
  const workOrder = createScenarioWorkOrder({ scenario, caseRecord, command: "@sec check this upload attempt", traceId, createdAt });
  const syntheticUpload = {
    destination: "external_llm_upload_box",
    content: "Synthetic payroll and bank statement excerpt with AHV redacted. Do not paste into external tools."
  };
  const privacy = validatePrivacyForExport(syntheticUpload);
  const finding = {
    id: createId("sec", scenario.id, "external_upload"),
    caseId: caseRecord.id,
    agentCode: "A-SEC-001",
    targetType: "external_llm_upload_attempt",
    targetId: "external_llm_upload_box",
    severity: "high",
    status: "blocked",
    summary: "External LLM upload attempt contains payroll, bank, or client-sensitive text. Use an internal redacted packet instead.",
    evidence_ids: [],
    createdAt
  };
  store.securityFindings = mergeById(store.securityFindings, [finding]);
  store.controlAgentOutputs = mergeById(store.controlAgentOutputs, [
    createControlOutput({
      id: `ctrl_${finding.id}`,
      agentCode: "A-SEC-001",
      caseId: caseRecord.id,
      targetType: finding.targetType,
      targetId: finding.targetId,
      status: finding.status,
      summary: finding.summary,
      details: [`privacy issues: ${privacy.issues.length}`],
      createdAt
    })
  ]);
  const cards = [
    scenarioCard(scenario, traceId, "external_llm_upload_attempt", "system", caseRecord.id, "External LLM upload attempted", "Human pasted synthetic confidential text into the simulated ChatGPT/Claude box.", "warning", [], createdAt),
    scenarioCard(scenario, traceId, "sensitive_content_detected", "A-SEC-001", caseRecord.id, "Sensitive content detected", "Payroll, bank, or client-sensitive text should not leave the controlled workflow.", "high", [], createdAt),
    scenarioCard(scenario, traceId, "policy_violation_warning", "A-SEC-001", caseRecord.id, "Upload blocked locally", "A-SEC-001 recommends using an internal redacted packet.", "high", [], createdAt),
    scenarioCard(scenario, traceId, "audit_event_recorded", "A-CAD-001", caseRecord.id, "Audit event queued", "The weekly audit will summarize this security event.", "info", [], createdAt)
  ];
  return appendScenarioResult(store, { scenario, workOrder, cards, approvalRequests: [], createdAt, auditMessage: "Ran confidential upload attempt Situation Room scenario." });
}

function runEmployeeOnboardingScenario(store, scenario, createdAt) {
  const caseRecord = activeCaseFromStore(store);
  const traceId = createId("trace", scenario.id, createdAt);
  const workOrder = createScenarioWorkOrder({ scenario, caseRecord, command: "@auth onboard junior accounting assistant", traceId, createdAt });
  const approval = createApprovalRequest({
    id: createId("apr", scenario.id, "boss_access_approval"),
    roomId: scenario.roomId,
    workOrderId: workOrder.id,
    caseId: caseRecord.id,
    requestedByAgentId: "A-AUTH-001",
    approverRole: "boss",
    actionType: "grant_read_only_and_draft_access",
    rationale: "Junior assistant access should be least privilege and boss-approved.",
    traceId,
    createdAt
  });
  const decision = {
    id: createId("auth", scenario.id, "junior_assistant"),
    caseId: caseRecord.id,
    agentCode: "A-AUTH-001",
    role: "junior_accounting_assistant",
    action: "grant_read_only_and_draft_access",
    targetType: "employee",
    targetId: "synthetic_junior_assistant",
    sensitivity: "confidential",
    decision: "pending",
    reason: "Recommended read-only case packet access and draft creation; no send permission and no raw payroll access without separate approval.",
    createdAt
  };
  store.authorizationDecisions = mergeById(store.authorizationDecisions, [decision]);
  store.controlAgentOutputs = mergeById(store.controlAgentOutputs, [
    createControlOutput({
      id: `ctrl_${decision.id}`,
      agentCode: "A-AUTH-001",
      caseId: caseRecord.id,
      targetType: "employee",
      targetId: decision.targetId,
      status: "review_required",
      summary: decision.reason,
      details: ["boss approval required"],
      createdAt
    })
  ]);
  const cards = [
    scenarioCard(scenario, traceId, "employee_onboarding_request", "system", caseRecord.id, "New employee onboarding requested", "Synthetic junior accounting assistant needs Treuhand intake access.", "info", [], createdAt),
    scenarioCard(scenario, traceId, "role_policy_matched", "A-AUTH-001", caseRecord.id, "Role policy matched", "Local policy recommends least-privilege assistant access.", "info", [], createdAt),
    scenarioCard(scenario, traceId, "access_recommendation_created", "A-AUTH-001", caseRecord.id, "Access recommendation created", "Read-only case packets and draft reminders; no send permission; raw payroll blocked.", "warning", [], createdAt),
    scenarioCard(scenario, traceId, "boss_approval_required", "A-AUTH-001", caseRecord.id, "Boss approval required", "Access remains pending until a human boss approves or rejects.", "warning", [], createdAt, null, approval.id)
  ];
  return appendScenarioResult(store, { scenario, workOrder, cards, approvalRequests: [approval], createdAt, auditMessage: "Ran employee onboarding Situation Room scenario." });
}

function runAgentHandoffGapScenario(store, scenario, createdAt) {
  const caseRecord = activeCaseFromStore(store);
  const traceId = createId("trace", scenario.id, createdAt);
  const workOrder = createScenarioWorkOrder({ scenario, caseRecord, command: "@gap inspect last failed handoff", traceId, createdAt });
  const gapFinding = {
    id: createId("gap", scenario.id, "period_normalization"),
    caseId: caseRecord.id,
    runId: null,
    agentCode: "A-GAP-001",
    targetType: "agent_handoff",
    targetId: "ingest_to_treu_period",
    checklistItemId: null,
    severity: "medium",
    status: "advisory",
    summary: "Handoff context missing: A-INGEST used Maerz/March wording while A-TREU expected normalized period format.",
    proposed_action: "Add period normalization skill for März, Maerz, March, 03/2026, and Q1 wording.",
    evidence_ids: [],
    checkedEvidenceIds: [],
    createdAt
  };
  const memoryCandidate = {
    id: createId("mem", scenario.id, "period_normalization"),
    caseId: caseRecord.id,
    runId: null,
    proposing_agent: "A-GAP-001",
    scope: "workflow",
    status: "proposed",
    confidence: 0.71,
    proposed_statement: "Normalize German/English accounting period variants before Treuhand checklist scoring.",
    evidence_ids: [],
    review_due: null,
    createdAt
  };
  const approval = createApprovalRequest({
    id: createId("apr", scenario.id, "memory_candidate"),
    roomId: scenario.roomId,
    workOrderId: workOrder.id,
    caseId: caseRecord.id,
    requestedByAgentId: "A-GAP-001",
    approverRole: "reviewer",
    actionType: "approve_operating_memory_candidate",
    rationale: "Reusable period-normalization lesson must be approved before becoming operating memory.",
    traceId,
    createdAt
  });
  store.gapFindings = mergeById(store.gapFindings, [gapFinding]);
  store.memoryCandidates = mergeById(store.memoryCandidates, [memoryCandidate]);
  store.controlAgentOutputs = mergeById(store.controlAgentOutputs, [
    createControlOutput({
      id: `ctrl_${gapFinding.id}`,
      agentCode: "A-GAP-001",
      caseId: caseRecord.id,
      targetType: gapFinding.targetType,
      targetId: gapFinding.targetId,
      status: gapFinding.status,
      summary: gapFinding.summary,
      details: [gapFinding.proposed_action],
      createdAt
    })
  ]);
  const cards = [
    scenarioCard(scenario, traceId, "agent_handoff_created", "A-INGEST-001", caseRecord.id, "Agent handoff created", "A-INGEST handed period text to A-TREU.", "info", [], createdAt),
    scenarioCard(scenario, traceId, "handoff_context_missing", "A-TREU-001", caseRecord.id, "Handoff context missing", "Period text was not normalized before checklist scoring.", "warning", [], createdAt),
    scenarioCard(scenario, traceId, "repeated_failure_pattern_detected", "A-GAP-001", caseRecord.id, "Repeated failure pattern detected", "Period wording may create recurring noisy warnings.", "warning", [], createdAt),
    scenarioCard(scenario, traceId, "skill_update_candidate_created", "A-GAP-001", caseRecord.id, "Skill update candidate created", memoryCandidate.proposed_statement, "info", [], createdAt, null, approval.id)
  ];
  return appendScenarioResult(store, { scenario, workOrder, cards, approvalRequests: [approval], createdAt, auditMessage: "Ran agent handoff gap Situation Room scenario." });
}

function runWeeklyControlAuditScenario(store, scenario, createdAt) {
  const caseRecord = activeCaseFromStore(store);
  const traceId = createId("trace", scenario.id, createdAt);
  const workOrder = createScenarioWorkOrder({ scenario, caseRecord, command: "@cad run weekly control audit", traceId, createdAt });
  const pendingApprovals = store.approvalRequests.filter((item) => item.status === "pending").length;
  const nudge = {
    id: createId("cad", scenario.id, "weekly_audit"),
    caseId: caseRecord.id,
    agentCode: "A-CAD-001",
    targetType: "weekly_control_audit",
    targetId: "local_weekly_audit",
    status: "nudge",
    summary: `Weekly audit: ${store.agentRuns.length} run(s), ${store.securityFindings.length} security finding(s), ${pendingApprovals} pending approval(s).`,
    next_action: "Review pending approvals and gap candidates before asking for real anonymized cases.",
    createdAt
  };
  store.cadenceNudges = mergeById(store.cadenceNudges, [nudge]);
  store.controlAgentOutputs = mergeById(store.controlAgentOutputs, [
    createControlOutput({
      id: `ctrl_${nudge.id}`,
      agentCode: "A-CAD-001",
      caseId: caseRecord.id,
      targetType: nudge.targetType,
      targetId: nudge.targetId,
      status: nudge.status,
      summary: nudge.summary,
      details: [nudge.next_action, "token spend: not applicable in deterministic local mode"],
      createdAt
    })
  ]);
  const cards = [
    scenarioCard(scenario, traceId, "weekly_audit_due", "A-CAD-001", caseRecord.id, "Weekly audit due", "Synthetic weekly cadence event fired locally.", "info", [], createdAt),
    scenarioCard(scenario, traceId, "agent_runs_summary", "A-CAD-001", caseRecord.id, "Agent runs summarized", `${store.agentRuns.length} local agent run(s).`, "info", [], createdAt),
    scenarioCard(scenario, traceId, "security_findings_summary", "A-CAD-001", caseRecord.id, "Security findings summarized", `${store.securityFindings.length} local security finding(s).`, "info", [], createdAt),
    scenarioCard(scenario, traceId, "pending_approvals_summary", "A-CAD-001", caseRecord.id, "Pending approvals summarized", `${pendingApprovals} approval request(s) still pending.`, pendingApprovals > 0 ? "warning" : "info", [], createdAt),
    scenarioCard(scenario, traceId, "token_spend_summary", "A-CAD-001", caseRecord.id, "Token spend summarized", "Token spend: not applicable / zero in deterministic local mode.", "info", [], createdAt)
  ];
  return appendScenarioResult(store, { scenario, workOrder, cards, approvalRequests: [], createdAt, auditMessage: "Ran weekly control audit Situation Room scenario." });
}

function appendScenarioResult(store, { scenario, workOrder, cards, approvalRequests, createdAt, auditMessage }) {
  store.activeSituationRoomId = scenario.roomId;
  const auditEvent = {
    id: createId("audit", scenario.id, createdAt),
    caseId: activeCaseFromStore(store)?.id || null,
    eventType: "situation_scenario_run",
    message: auditMessage,
    createdAt
  };
  workOrder.approvalIds = approvalRequests.map((item) => item.id);
  workOrder.auditEventIds = [auditEvent.id];
  store.workOrders.unshift(workOrder);
  store.situationCards.unshift(...cards);
  store.approvalRequests.unshift(...approvalRequests);
  store.auditEvents.unshift(auditEvent);
  return { workOrder, cards, approvalRequests };
}

function createScenarioWorkOrder({ scenario, caseRecord, command, traceId, createdAt }) {
  return createWorkOrder({
    id: createId("wo", scenario.id, createdAt),
    roomId: scenario.roomId,
    caseId: caseRecord?.id || null,
    requestedBy: "scenario_gallery",
    agentId: scenario.primaryAgentId,
    command,
    status: scenario.id === "weekly_control_audit" ? "completed" : "needs_approval",
    traceId,
    createdAt
  });
}

function scenarioCard(scenario, traceId, type, agentId, caseId, title, summary, severity, evidenceIds, createdAt, runId = null, approvalId = null) {
  return createSituationCard({
    id: createId("card", scenario.id, type, traceId),
    roomId: scenario.roomId,
    type,
    agentId,
    caseId,
    title,
    summary,
    severity,
    evidenceIds,
    runId,
    approvalId,
    traceId,
    createdAt
  });
}

function createRoom({ id, type, title, caseId = null, allowedAgentIds, createdAt }) {
  return {
    id,
    roomId: id,
    type,
    title,
    caseId,
    participants: ["human_reviewer", "human_boss", "system", ...allowedAgentIds],
    allowedAgentIds,
    policyProfileId: `policy_${type}`,
    createdAt
  };
}

function createRoomMessage({ id, roomId, actorType, actorId, text, mentions = [], createdAt }) {
  return {
    id,
    messageId: id,
    roomId,
    actorType,
    actorId,
    text,
    mentions,
    createdAt
  };
}

function createWorkOrder({ id, roomId, caseId, requestedBy, agentId, command, status, traceId = null, createdAt }) {
  return {
    id,
    workOrderId: id,
    roomId,
    caseId,
    requestedBy,
    agentId,
    command,
    status,
    stages: TAG_STAGES[agentId] || ["read allowed context", "create local plan", "request human review"],
    evidenceIds: [],
    approvalIds: [],
    auditEventIds: [],
    traceId: traceId || createId("trace", id),
    createdAt,
    updatedAt: createdAt
  };
}

function createSituationCard({
  id,
  roomId,
  type,
  agentId = null,
  caseId = null,
  title,
  summary,
  severity = "info",
  evidenceIds = [],
  actions = [],
  workOrderId = null,
  approvalId = null,
  runId = null,
  traceId,
  createdAt
}) {
  return {
    id,
    cardId: id,
    roomId,
    type,
    agentId,
    caseId,
    title,
    summary,
    severity,
    evidenceIds,
    actions,
    workOrderId,
    approvalId,
    runId,
    traceId,
    approvalStatus: approvalId ? "pending" : "not_required",
    createdAt
  };
}

function createApprovalRequest({
  id,
  roomId,
  workOrderId,
  caseId,
  requestedByAgentId,
  approverRole,
  actionType,
  rationale,
  traceId,
  createdAt
}) {
  return {
    id,
    approvalId: id,
    roomId,
    workOrderId,
    caseId,
    requestedByAgentId,
    approverRole,
    actionType,
    status: "pending",
    rationale,
    traceId,
    createdAt
  };
}

function extractMentions(text) {
  const normalized = String(text || "").toLowerCase();
  return Object.keys(AGENT_TAGS).filter((tag) => normalized.includes(tag)).map((tag) => AGENT_TAGS[tag]);
}

function ensureSituationRoomCollections(store) {
  const seed = createInitialSituationRoomState(activeCaseFromStore(store)?.id || store.activeCaseId);
  store.situationRooms ||= seed.situationRooms;
  store.activeSituationRoomId ||= seed.activeSituationRoomId;
  store.roomMessages ||= seed.roomMessages;
  store.workOrders ||= [];
  store.situationCards ||= [];
  store.approvalRequests ||= [];
  store.selectedSituationCardId ||= null;
}

function activeCaseFromStore(store) {
  return store.cases?.find((item) => item.id === store.activeCaseId) || store.cases?.[0] || null;
}

function createId(...parts) {
  return parts
    .filter((part) => part !== null && part !== undefined && part !== "")
    .join("_")
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, "_")
    .replace(/^_|_$/g, "")
    .slice(0, 96);
}
