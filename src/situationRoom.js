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

export const SITUATION_TRUTH_LABEL = "synthetic_local";
export const SITUATION_SNAPSHOT_VERSION = "situation.demo.snapshot.v1";

export const ACTIVE_SITUATION_AGENTS = [
  {
    agentId: "A-TREU-001",
    role: "Treuhand workflow agent",
    demoCommand: "@treu run intake review",
    humanApprovalRequired: true,
    approvalBoundary: "Client-facing drafts require reviewer approval before use."
  },
  {
    agentId: "A-INGEST-001",
    role: "Evidence ingestion and context-packet agent",
    demoCommand: "@ingest process inbound email",
    humanApprovalRequired: false,
    approvalBoundary: "May normalize local evidence only; no mailbox polling."
  },
  {
    agentId: "A-SEC-001",
    role: "Security and sensitive-content control agent",
    demoCommand: "@sec check upload",
    humanApprovalRequired: true,
    approvalBoundary: "May block or warn locally; no browser or DLP integration."
  },
  {
    agentId: "A-AUTH-001",
    role: "Permissions and least-privilege control agent",
    demoCommand: "@auth onboard junior accounting assistant",
    humanApprovalRequired: true,
    approvalBoundary: "Access recommendations require boss approval; no real IAM changes."
  },
  {
    agentId: "A-GAP-001",
    role: "Gap and skill-candidate analyst",
    demoCommand: "@gap inspect handoff",
    humanApprovalRequired: true,
    approvalBoundary: "Reusable memory candidates require reviewer approval."
  },
  {
    agentId: "A-CAD-001",
    role: "Cadence, audit, and operating-review agent",
    demoCommand: "@cad run weekly audit",
    humanApprovalRequired: false,
    approvalBoundary: "May summarize local logs only; no telemetry backend."
  }
];

export const SITUATION_ROOM_SCENARIOS = [
  {
    id: "inbound_email_intake",
    label: "Inbound email intake",
    roomId: "room_case_march_2026",
    primaryAgentId: "A-INGEST-001",
    sourceKind: "synthetic_workspace_inbox",
    sourceLabel: "Synthetic Workspace/Gmail-style inbox",
    triggerType: "mailbox_message_received",
    sourceActor: "client_contact",
    payloadTitle: "March 2026 Treuhand packet",
    payloadPreview: "March 2026 Treuhand packet; bank statement and sales export attached; MWST-Abrechnung missing.",
    expectedAgentIds: ["A-INGEST-001", "A-SEC-001", "A-TREU-001", "A-AUTH-001"],
    adapterBoundary: "Simulated/local inbox event only; no real Gmail, Drive, or mailbox polling.",
    chatbotContrast: "Waits for a human to paste the email and explain context.",
    cambrianContrast: "Notices a synthetic mailbox event, normalizes evidence, opens work, and blocks the client draft behind review."
  },
  {
    id: "confidential_upload_attempt",
    label: "Confidential upload attempt",
    roomId: "room_security",
    primaryAgentId: "A-SEC-001",
    sourceKind: "simulated_external_llm_box",
    sourceLabel: "Simulated ChatGPT/Claude upload box",
    triggerType: "external_llm_upload_attempt",
    sourceActor: "human_employee",
    payloadTitle: "External LLM upload attempt",
    payloadPreview: "Payroll, bank, and client-sensitive text aimed at an external LLM.",
    expectedAgentIds: ["A-SEC-001", "A-CAD-001"],
    adapterBoundary: "Simulated/local upload box only; no browser monitoring, no DLP integration, no LLM call.",
    chatbotContrast: "Answers only after confidential text has already been pasted.",
    cambrianContrast: "Stops the risky upload locally, names deterministic risk signals, and leaves an audit trail."
  },
  {
    id: "employee_onboarding",
    label: "Employee onboarding",
    roomId: "room_onboarding",
    primaryAgentId: "A-AUTH-001",
    sourceKind: "synthetic_hr_request",
    sourceLabel: "Synthetic HR/onboarding request",
    triggerType: "employee_onboarding_request",
    sourceActor: "human_boss",
    payloadTitle: "Junior assistant access request",
    payloadPreview: "Junior accounting assistant needs Treuhand intake access.",
    expectedAgentIds: ["A-AUTH-001", "A-SEC-001", "A-CAD-001"],
    adapterBoundary: "Simulated/local HR request only; no real IAM, HRIS, Slack, or Drive changes.",
    chatbotContrast: "Suggests generic access in a chat reply.",
    cambrianContrast: "Maps the role to least-privilege access and requires boss approval before any access claim."
  },
  {
    id: "agent_handoff_gap",
    label: "Agent handoff gap",
    roomId: "room_case_march_2026",
    primaryAgentId: "A-GAP-001",
    sourceKind: "situation_room_agent_handoff",
    sourceLabel: "Situation Room agent handoff",
    triggerType: "agent_handoff_observed",
    sourceActor: "A-INGEST-001 -> A-TREU-001",
    payloadTitle: "Period normalization handoff",
    payloadPreview: "Period wording passed as März/Maerz/March while A-TREU expects normalized 2026-03.",
    expectedAgentIds: ["A-GAP-001", "A-AUTH-001"],
    adapterBoundary: "Simulated/local agent handoff only; no durable memory write without approval.",
    chatbotContrast: "Misses the operating failure unless someone asks about it.",
    cambrianContrast: "Watches agent handoff artifacts and proposes a skill update without approving durable memory."
  },
  {
    id: "weekly_control_audit",
    label: "Weekly control audit",
    roomId: "room_weekly_control",
    primaryAgentId: "A-CAD-001",
    sourceKind: "synthetic_weekly_scheduler",
    sourceLabel: "Synthetic weekly scheduler",
    triggerType: "weekly_control_audit_due",
    sourceActor: "system_scheduler",
    payloadTitle: "Weekly local operating review",
    payloadPreview: "Summarize local runs, approvals, warnings, blocked work, tool usage, and token spend.",
    expectedAgentIds: ["A-CAD-001"],
    adapterBoundary: "Simulated/local scheduler only; no telemetry backend, calendar integration, or token billing API.",
    chatbotContrast: "Cannot reliably reconstruct what happened last week from scattered prompts.",
    cambrianContrast: "Reviews local logs, approvals, warnings, and tool usage in one auditable cadence."
  }
];

export const GUIDED_DEMO_SCENARIO_ORDER = [
  "inbound_email_intake",
  "confidential_upload_attempt",
  "employee_onboarding",
  "agent_handoff_gap",
  "weekly_control_audit"
];

export const SITUATION_ARTIFACT_PACKS = [
  { id: "cards", label: "Agent cards" },
  { id: "next_steps", label: "Next steps" },
  { id: "events", label: "Events" },
  { id: "work_orders", label: "Work orders" },
  { id: "approvals", label: "Approvals" },
  { id: "logs", label: "Local logs" }
];

const TAG_STAGES = {
  "A-TREU-001": ["read allowed context", "build evidence inventory", "check required documents", "draft follow-up", "request human review"],
  "A-INGEST-001": ["read inbound source", "classify source", "create context packet", "preserve evidence IDs"],
  "A-SEC-001": ["scan submitted text", "classify risk", "create warning or block", "suggest safe alternative"],
  "A-AUTH-001": ["read policy snippet", "match role", "recommend least privilege", "request boss approval"],
  "A-GAP-001": ["inspect handoff", "find missing context", "propose skill or checklist update", "request memory approval"],
  "A-CAD-001": ["collect local logs", "summarize pending reviews", "summarize warnings", "recommend next operating action"]
};

const DEMO_COMMAND_ROUTES = [
  {
    id: "treu_intake_review",
    agentId: "A-TREU-001",
    scenarioId: "inbound_email_intake",
    requiredTerms: ["run", "intake", "review"]
  },
  {
    id: "ingest_inbound_email",
    agentId: "A-INGEST-001",
    scenarioId: "inbound_email_intake",
    requiredTerms: ["process", "inbound", "email"]
  },
  {
    id: "security_upload_check",
    agentId: "A-SEC-001",
    scenarioId: "confidential_upload_attempt",
    requiredTerms: ["check", "upload"]
  },
  {
    id: "auth_employee_onboarding",
    agentId: "A-AUTH-001",
    scenarioId: "employee_onboarding",
    requiredTerms: ["onboard", "junior", "accounting", "assistant"]
  },
  {
    id: "gap_handoff_inspection",
    agentId: "A-GAP-001",
    scenarioId: "agent_handoff_gap",
    requiredTerms: ["inspect", "handoff"]
  },
  {
    id: "cad_weekly_audit",
    agentId: "A-CAD-001",
    scenarioId: "weekly_control_audit",
    requiredTerms: ["run", "weekly", "audit"]
  }
];

const SCENARIO_WORK_ORDER_STATUS = {
  inbound_email_intake: "needs_approval",
  confidential_upload_attempt: "blocked",
  employee_onboarding: "needs_approval",
  agent_handoff_gap: "needs_approval",
  weekly_control_audit: "completed"
};

const DEMO_SAFE_APPROVAL_ACTIONS = new Set([
  "review_before_send",
  "grant_read_only_and_draft_access",
  "approve_operating_memory_candidate"
]);

export function createInitialDemoConductor(createdAt = new Date().toISOString()) {
  return {
    completedActIds: [],
    activeActId: null,
    lastAct: null,
    actRecordsById: {},
    updatedAt: createdAt
  };
}

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
    situationSourceEvents: [],
    situationFollowThroughs: [],
    selectedSituationCardId: null,
    expandedSituationAgentId: null,
    situationDemoConductor: createInitialDemoConductor(createdAt),
    situationDemoReport: null,
    activeSituationPack: "cards",
    situationLastAction: null,
    situationSessionId: "session_local_demo",
    situationScenarioWeek: 1,
    situationSnapshotStatus: null,
    situationSnapshotExport: null,
    situationEventLog: [
      createSituationLog({
        id: createId("log", "situation_seed", createdAt),
        roomId: "room_general_ops",
        eventType: "situation_seeded",
        artifactType: "system",
        artifactId: "msg_situation_seed",
        actorId: "system",
        summary: "Situation Room local store initialized.",
        createdAt
      })
    ]
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
  appendSituationLog(store, {
    roomId,
    eventType: "room_message_created",
    artifactType: "message",
    artifactId: message.id,
    actorId,
    summary: `Room message posted in ${roomId}.`,
    createdAt
  });

  const parsed = parseAgentTag(text);
  if (!parsed) {
    store.situationLastAction = {
      status: "message_posted",
      roomId,
      messageId: message.id,
      summary: "Message added to room chat.",
      createdAt
    };
    return { message, workOrder: null, cards: [], approvalRequests: [] };
  }

  const route = matchDemoCommand(text, parsed.agentId);
  if (route) {
    const scenarioResult = runSituationDemoAct(store, route.scenarioId, createdAt);
    const workOrder = scenarioResult.workOrder || null;
    if (workOrder) {
      const scenarioAgentId = workOrder.agentId;
      workOrder.requestedBy = actorId;
      workOrder.command = text;
      workOrder.sourceMessageId = message.id;
      workOrder.routedFromAgentId = parsed.agentId;
      workOrder.scenarioPrimaryAgentId = scenarioAgentId;
      workOrder.agentId = parsed.agentId;
      workOrder.stages = TAG_STAGES[parsed.agentId] || workOrder.stages;
      workOrder.demoCommandRoute = route.id;
      workOrder.collaboratingAgentIds = unique([
        ...(workOrder.collaboratingAgentIds || []),
        parsed.agentId,
        scenarioAgentId
      ]);
    }
    const reusedCopy = scenarioResult.reused ? "Reused existing completed act; no duplicate artifacts created. " : "";
    const systemMessage = appendSystemRoomMessage(store, {
      roomId: scenarioResult.actRecord.roomId,
      text: `${reusedCopy}${parsed.agentId} routed "${text}" to ${scenarioResult.actRecord.label}: ${scenarioResult.actRecord.summary}`,
      createdAt: offsetIso(createdAt, 1)
    });
    store.situationLastAction = {
      status: scenarioResult.reused ? "manual_tag_reused_demo_act" : "manual_tag_routed_demo_act",
      roomId: scenarioResult.actRecord.roomId,
      sourceMessageId: message.id,
      systemMessageId: systemMessage.id,
      workOrderId: scenarioResult.actRecord.createdWorkOrderIds[0] || null,
      cardIds: scenarioResult.actRecord.createdCardIds,
      approvalIds: scenarioResult.actRecord.createdApprovalIds,
      sourceEventId: scenarioResult.actRecord.sourceEventId,
      summary: scenarioResult.reused
        ? `${parsed.agentId} selected completed ${scenarioResult.actRecord.label}; no duplicate artifacts created.`
        : `${parsed.agentId} routed to ${scenarioResult.actRecord.label} and created local artifacts.`,
      createdAt
    };
    appendSituationLog(store, {
      roomId: scenarioResult.actRecord.roomId,
      eventType: scenarioResult.reused ? "demo_command_reused_completed_act" : "demo_command_routed",
      artifactType: scenarioResult.reused ? "demo_act" : "work_order",
      artifactId: scenarioResult.actRecord.createdWorkOrderIds[0] || scenarioResult.actRecord.actId,
      actorId,
      summary: store.situationLastAction.summary,
      createdAt
    });
    return {
      message,
      systemMessage,
      routedScenarioId: route.scenarioId,
      workOrder,
      cards: scenarioResult.cards,
      approvalRequests: scenarioResult.approvalRequests,
      reused: scenarioResult.reused || false,
      actRecord: scenarioResult.actRecord
    };
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
  const systemMessage = appendSystemRoomMessage(store, {
    roomId,
    text: `${parsed.agentId} created planned work order ${workOrder.id} and card ${cards[0].id}.`,
    createdAt: offsetIso(createdAt, 1)
  });
  store.situationLastAction = {
    status: "planned_work_order_created",
    roomId,
    sourceMessageId: message.id,
    systemMessageId: systemMessage.id,
    workOrderId: workOrder.id,
    cardIds: cards.map((card) => card.id),
    approvalIds: [],
    summary: `${parsed.agentId} created a planned local work order.`,
    createdAt
  };
  appendSituationLog(store, {
    roomId,
    eventType: "tagged_work_order_planned",
    artifactType: "work_order",
    artifactId: workOrder.id,
    actorId,
    summary: store.situationLastAction.summary,
    createdAt
  });
  return { message, systemMessage, workOrder, cards, approvalRequests: [] };
}

export function runSituationScenario(store, scenarioId, createdAt = new Date().toISOString()) {
  ensureSituationRoomCollections(store);
  const scenario = SITUATION_ROOM_SCENARIOS.find((item) => item.id === scenarioId);
  if (!scenario) throw new Error(`Unknown situation scenario: ${scenarioId}`);
  const sourceEvent = createSourceEventForScenario(scenario, activeCaseFromStore(store), createdAt);

  if (scenarioId === "inbound_email_intake") return runInboundEmailScenario(store, scenario, createdAt, sourceEvent);
  if (scenarioId === "confidential_upload_attempt") return runConfidentialUploadScenario(store, scenario, createdAt, sourceEvent);
  if (scenarioId === "employee_onboarding") return runEmployeeOnboardingScenario(store, scenario, createdAt, sourceEvent);
  if (scenarioId === "agent_handoff_gap") return runAgentHandoffGapScenario(store, scenario, createdAt, sourceEvent);
  return runWeeklyControlAuditScenario(store, scenario, createdAt, sourceEvent);
}

export function runSituationDemoAct(store, scenarioId, createdAt = new Date().toISOString()) {
  ensureSituationRoomCollections(store);
  const scenario = SITUATION_ROOM_SCENARIOS.find((item) => item.id === scenarioId);
  if (!scenario) throw new Error(`Unknown situation demo act: ${scenarioId}`);
  const existingAct = store.situationDemoConductor.actRecordsById?.[scenarioId];
  if (existingAct) {
    store.situationDemoConductor = {
      ...store.situationDemoConductor,
      activeActId: scenarioId,
      lastAct: existingAct,
      updatedAt: createdAt
    };
    store.activeSituationRoomId = existingAct.roomId;
    store.activeSituationPack = "cards";
    store.situationLastAction = {
      status: "demo_act_selected",
      roomId: existingAct.roomId,
      workOrderId: existingAct.createdWorkOrderIds[0] || null,
      cardIds: existingAct.createdCardIds,
      approvalIds: existingAct.createdApprovalIds,
      sourceEventId: existingAct.sourceEventId,
      summary: `${existingAct.label} already completed. Reset demo state to rerun the act; no duplicate artifacts created.`,
      createdAt
    };
    return { workOrder: null, cards: [], approvalRequests: [], actRecord: existingAct, reused: true };
  }
  const before = summarizeSituationMetrics(store);
  const result = runSituationScenario(store, scenarioId, createdAt);
  const after = summarizeSituationMetrics(store);
  const logDelta = Math.max(0, after.logs - before.logs);
  const messageDelta = Math.max(0, after.messages - before.messages);
  const completedActIds = unique([...(store.situationDemoConductor?.completedActIds || []), scenarioId]);
  const actRecord = {
    actId: scenario.id,
    label: scenario.label,
    roomId: scenario.roomId,
    primaryAgentId: scenario.primaryAgentId,
    createdAt,
    deltas: {
      cards: result.cards.length,
      workOrders: result.workOrder ? 1 : 0,
      approvals: result.approvalRequests.length,
      logs: logDelta,
      messages: messageDelta
    },
    createdCardIds: result.cards.map((card) => card.id),
    createdWorkOrderIds: result.workOrder ? [result.workOrder.id] : [],
    createdApprovalIds: result.approvalRequests.map((approval) => approval.id),
    sourceEventId: result.sourceEvent?.id || null,
    sourceEvent: result.sourceEvent || null,
    chatbotContrast: scenario.chatbotContrast,
    cambrianContrast: scenario.cambrianContrast,
    summary: `${scenario.label} created ${result.cards.length} card(s), ${result.workOrder ? 1 : 0} work order(s), ${result.approvalRequests.length} approval gate(s), and ${logDelta} local log record(s).`
  };
  store.situationDemoConductor = {
    completedActIds,
    activeActId: scenarioId,
    lastAct: actRecord,
    actRecordsById: {
      ...(store.situationDemoConductor?.actRecordsById || {}),
      [scenarioId]: actRecord
    },
    updatedAt: createdAt
  };
  store.activeSituationRoomId = scenario.roomId;
  store.activeSituationPack = "cards";
  store.situationLastAction = {
    status: "demo_act_completed",
    roomId: scenario.roomId,
    workOrderId: result.workOrder?.id || null,
    cardIds: actRecord.createdCardIds,
    approvalIds: actRecord.createdApprovalIds,
    sourceEventId: actRecord.sourceEventId,
    summary: actRecord.summary,
    createdAt
  };
  return { ...result, actRecord };
}

function createSourceEventForScenario(scenario, caseRecord, createdAt) {
  const id = createId("src", scenario.id, scenario.triggerType, createdAt);
  return {
    id,
    sourceEventId: id,
    scenarioId: scenario.id,
    roomId: scenario.roomId,
    caseId: caseRecord?.id || null,
    sourceKind: scenario.sourceKind,
    sourceLabel: scenario.sourceLabel,
    triggerType: scenario.triggerType,
    sourceActor: scenario.sourceActor,
    payloadTitle: scenario.payloadTitle,
    payloadPreview: scenario.payloadPreview,
    adapterMode: "synthetic_local",
    adapterBoundary: scenario.adapterBoundary,
    truthLabel: SITUATION_TRUTH_LABEL,
    truthLabelText: "synthetic/local only",
    externalEffect: "none",
    expectedAgentIds: scenario.expectedAgentIds || [scenario.primaryAgentId],
    createdAt
  };
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
  approval.externalEffect = "none";
  approval.localOnlyNotice = "Local approval recorded only; no email sent, access granted, or memory promoted.";
  const workOrder = store.workOrders.find((item) => item.id === approval.workOrderId);
  if (workOrder) {
    const relatedApprovals = store.approvalRequests.filter((item) => item.workOrderId === workOrder.id);
    const hasPending = relatedApprovals.some((item) => item.id !== approval.id && item.status === "pending");
    workOrder.status = approval.status === "approved" && !hasPending ? "local_approval_recorded" : "rejected";
    workOrder.localOnlyNotice = approval.localOnlyNotice;
    workOrder.updatedAt = createdAt;
  }

  store.situationCards = store.situationCards.map((card) => {
    if (card.approvalId !== approvalId) return card;
    return {
      ...card,
      approvalStatus: approval.status,
      blockedByApproval: false,
      resolutionSummary: approval.localOnlyNotice,
      updatedAt: createdAt
    };
  });

  const card = createSituationCard({
    id: createId("card", approvalId, approval.status),
    roomId: approval.roomId,
    type: "human_approval",
    agentId: approval.requestedByAgentId,
    caseId: approval.caseId,
    title: `Approval ${approval.status}`,
    summary: `${actorId} ${approval.status} ${approval.actionType}. Local approval recorded only; no external action executed.`,
    severity: approval.status === "approved" ? "info" : "warning",
    approvalId,
    workOrderId: approval.workOrderId,
    sourceEventId: approval.sourceEventId || null,
    traceId: approval.traceId,
    createdAt
  });
  store.situationCards.unshift(card);
  const proposal = appendAgentNextStepProposal(store, {
    roomId: approval.roomId,
    agentId: approval.requestedByAgentId,
    caseId: approval.caseId,
    workOrderId: approval.workOrderId,
    sourceType: "approval",
    sourceId: approval.id,
    sourceEventId: approval.sourceEventId || null,
    traceId: approval.traceId,
    summary: nextStepSummaryForApproval(approval),
    choices: nextStepChoicesForApproval(approval),
    createdAt: offsetIso(createdAt, 1)
  });
  approval.nextStepProposalId = proposal.id;
  appendSystemRoomMessage(store, {
    roomId: approval.roomId,
    text: `${approval.requestedByAgentId} proposed next steps after ${approval.actionType}: ${proposal.id}.`,
    sourceEventId: approval.sourceEventId || null,
    createdAt: offsetIso(createdAt, 2)
  });
  appendSituationLog(store, {
    roomId: approval.roomId,
    eventType: "approval_resolved",
    artifactType: "approval",
    artifactId: approval.id,
    actorId,
    sourceEventId: approval.sourceEventId || null,
    summary: `${approval.actionType} ${approval.status}; next-step proposal ${proposal.id} created.`,
    createdAt
  });
  store.activeSituationRoomId = approval.roomId;
  store.activeSituationPack = "next_steps";
  store.situationLastAction = {
    status: "approval_resolved",
    roomId: approval.roomId,
    approvalId: approval.id,
    workOrderId: approval.workOrderId,
    sourceEventId: approval.sourceEventId || null,
    cardIds: [card.id, proposal.id],
    summary: `Approval ${approval.status}; local-only next-step proposal created.`,
    createdAt
  };
  return approval;
}

export function resolveAllDemoSafeApprovals(store, actorId = "human_reviewer", createdAt = new Date().toISOString()) {
  ensureSituationRoomCollections(store);
  const pending = store.approvalRequests.filter(
    (approval) => approval.status === "pending" && DEMO_SAFE_APPROVAL_ACTIONS.has(approval.actionType)
  );
  return pending.map((approval, index) =>
    resolveSituationApproval(store, approval.id, "approved", actorId, offsetIso(createdAt, index + 1))
  );
}

export function resetSituationRoomDemoState(store, createdAt = new Date().toISOString()) {
  const seed = createInitialSituationRoomState(activeCaseFromStore(store)?.id || store.activeCaseId, createdAt);
  store.situationRooms = seed.situationRooms;
  store.activeSituationRoomId = seed.activeSituationRoomId;
  store.roomMessages = seed.roomMessages;
  store.workOrders = [];
  store.situationCards = [];
  store.approvalRequests = [];
  store.situationSourceEvents = [];
  store.situationFollowThroughs = [];
  store.selectedSituationCardId = null;
  store.expandedSituationAgentId = null;
  store.situationDemoConductor = createInitialDemoConductor(createdAt);
  store.situationDemoReport = null;
  store.activeSituationPack = "cards";
  store.situationLastAction = null;
  store.situationEventLog = seed.situationEventLog;
  store.situationSessionId = seed.situationSessionId;
  store.situationScenarioWeek = seed.situationScenarioWeek;
  store.situationSnapshotStatus = null;
  store.situationSnapshotExport = null;
  return store;
}

export function runGuidedSituationDemo(store, createdAt = new Date().toISOString()) {
  ensureSituationRoomCollections(store);
  resetSituationRoomDemoState(store, createdAt);

  const results = GUIDED_DEMO_SCENARIO_ORDER.map((scenarioId, index) =>
    runSituationScenario(store, scenarioId, offsetIso(createdAt, index + 1))
  );
  const reportBeforeRecap = summarizeSituationRoomDemo(store);
  const traceId = createId("trace", "guided_demo", createdAt);
  const recap = createSituationCard({
    id: createId("card", "guided_demo_recap", createdAt),
    roomId: "room_general_ops",
    type: "guided_demo_recap",
    agentId: "system",
    caseId: activeCaseFromStore(store)?.id || null,
    title: "Guided demo recap",
    summary: `6 active agents shown; ${reportBeforeRecap.cardsCreated + 1} cards created; ${reportBeforeRecap.workOrdersCreated} work orders; ${reportBeforeRecap.pendingApprovals} pending approvals; ${reportBeforeRecap.pendingNextStepProposals} pending next-step proposal(s); ${reportBeforeRecap.selectedFollowThroughs} selected follow-through(s); all consequences local-only; no external actions executed; synthetic/local only.`,
    severity: "info",
    traceId,
    createdAt: offsetIso(createdAt, GUIDED_DEMO_SCENARIO_ORDER.length + 1)
  });

  store.situationCards.unshift(recap);
  appendSituationLog(store, {
    roomId: "room_general_ops",
    eventType: "guided_demo_recap_created",
    artifactType: "card",
    artifactId: recap.id,
    actorId: "system",
    summary: recap.summary,
    createdAt: recap.createdAt
  });
  appendSystemRoomMessage(store, {
    roomId: "room_general_ops",
    text: `Guided demo completed. Recap card ${recap.id} created; local logs are stored in situationEventLog.`,
    createdAt: offsetIso(createdAt, GUIDED_DEMO_SCENARIO_ORDER.length + 2)
  });
  store.activeSituationRoomId = "room_general_ops";
  store.activeSituationPack = "cards";
  store.situationDemoReport = {
    ...summarizeSituationRoomDemo(store),
    scenarioIds: GUIDED_DEMO_SCENARIO_ORDER,
    resultWorkOrderIds: results.map((result) => result.workOrder.id),
    recapCardId: recap.id,
    recapSummary: recap.summary,
    noExternalSideEffects: true,
    truthLabel: SITUATION_TRUTH_LABEL,
    completedAt: recap.createdAt
  };
  store.situationLastAction = {
    status: "guided_demo_completed",
    summary: `Guided demo created ${store.situationDemoReport.cardsCreated} cards, ${store.situationDemoReport.workOrdersCreated} work orders, ${store.situationDemoReport.pendingApprovals} pending approvals, ${store.situationDemoReport.pendingNextStepProposals} pending next-step proposal(s), and ${store.situationDemoReport.selectedFollowThroughs} selected follow-through(s). Opened General Ops / Cards; local-only boundary preserved.`,
    roomId: "room_general_ops",
    cardIds: [recap.id],
    createdAt: offsetIso(createdAt, GUIDED_DEMO_SCENARIO_ORDER.length + 3)
  };
  return store.situationDemoReport;
}

export function summarizeSituationRoomDemo(store) {
  ensureSituationRoomCollections(store);
  const agentParticipation = summarizeSituationAgentParticipation(store);
  return {
    activeAgentsShown: agentParticipation.filter((agent) => agent.totalOutputs > 0).length,
    cardsCreated: store.situationCards.length,
    workOrdersCreated: store.workOrders.length,
    pendingApprovals: store.approvalRequests.filter((approval) => approval.status === "pending").length,
    approvalsCreated: store.approvalRequests.length,
    pendingNextStepProposals: store.situationCards.filter((card) => card.type === "agent_next_step_proposal" && card.status === "pending").length,
    selectedFollowThroughs: store.situationFollowThroughs.length,
    agentParticipation,
    noExternalSideEffects: true,
    truthLabel: SITUATION_TRUTH_LABEL
  };
}

export function setSituationArtifactPack(store, packId) {
  ensureSituationRoomCollections(store);
  const allowed = new Set(SITUATION_ARTIFACT_PACKS.map((pack) => pack.id));
  store.activeSituationPack = allowed.has(packId) ? packId : "cards";
  return store.activeSituationPack;
}

export function createSituationDemoSnapshot(
  store,
  { sessionId = store.situationSessionId || "session_local_demo", scenarioWeek = store.situationScenarioWeek || 1, createdAt = new Date().toISOString() } = {}
) {
  ensureSituationRoomCollections(store);
  const snapshotId = createId("snap", sessionId, "week", scenarioWeek, createdAt);
  return {
    snapshotVersion: SITUATION_SNAPSHOT_VERSION,
    snapshotId,
    sessionId,
    createdAt,
    scenarioWeek,
    truthLabel: SITUATION_TRUTH_LABEL,
    localOnly: true,
    storeKey: "agentops-core-store-v1",
    payload: {
      situationRooms: store.situationRooms,
      activeSituationRoomId: store.activeSituationRoomId,
      roomMessages: store.roomMessages,
      workOrders: store.workOrders,
      situationCards: store.situationCards,
      approvalRequests: store.approvalRequests,
      situationSourceEvents: store.situationSourceEvents,
      situationFollowThroughs: store.situationFollowThroughs,
      selectedSituationCardId: store.selectedSituationCardId || null,
      situationDemoConductor: store.situationDemoConductor || createInitialDemoConductor(createdAt),
      situationDemoReport: store.situationDemoReport || null,
      activeSituationPack: store.activeSituationPack || "cards",
      situationLastAction: store.situationLastAction || null,
      situationEventLog: store.situationEventLog,
      auditEvents: store.auditEvents || [],
      contextPackets: store.contextPackets || [],
      controlAgentOutputs: store.controlAgentOutputs || [],
      securityFindings: store.securityFindings || [],
      authorizationDecisions: store.authorizationDecisions || [],
      gapFindings: store.gapFindings || [],
      cadenceNudges: store.cadenceNudges || [],
      memoryCandidates: store.memoryCandidates || [],
      handoffRequests: store.handoffRequests || [],
      agentRuns: store.agentRuns || [],
      recommendations: store.recommendations || [],
      reviewDecisions: store.reviewDecisions || [],
      validationRecords: store.validationRecords || [],
      validationExportStatus: store.validationExportStatus || null,
      validationExportPackage: store.validationExportPackage || null
    }
  };
}

export function exportSituationDemoSnapshot(store, options = {}) {
  const snapshot = createSituationDemoSnapshot(store, options);
  const snapshotJson = JSON.stringify(snapshot, null, 2);
  store.situationSnapshotExport = snapshot;
  store.situationSnapshotStatus = {
    status: "ready",
    message: `${snapshot.snapshotId} ready for local copy/export.`,
    snapshotId: snapshot.snapshotId,
    sessionId: snapshot.sessionId,
    scenarioWeek: snapshot.scenarioWeek,
    errors: [],
    createdAt: snapshot.createdAt
  };
  appendSituationLog(store, {
    roomId: "room_general_ops",
    eventType: "demo_snapshot_exported",
    artifactType: "snapshot",
    artifactId: snapshot.snapshotId,
    actorId: "system",
    summary: `Exported local demo snapshot ${snapshot.snapshotId}.`,
    createdAt: snapshot.createdAt
  });
  return { snapshot, snapshotJson };
}

export function importSituationDemoSnapshot(store, snapshotInput, importedAt = new Date().toISOString()) {
  let snapshot;
  try {
    snapshot = typeof snapshotInput === "string" ? JSON.parse(snapshotInput) : snapshotInput;
  } catch (error) {
    return {
      valid: false,
      errors: [`Invalid snapshot JSON: ${error.message}.`],
      snapshot: null
    };
  }

  const validation = validateSituationDemoSnapshot(snapshot);
  if (!validation.valid) return { ...validation, snapshot: null };

  const payload = snapshot.payload;
  store.situationRooms = cloneArray(payload.situationRooms);
  store.activeSituationRoomId = payload.activeSituationRoomId || "room_general_ops";
  store.roomMessages = cloneArray(payload.roomMessages);
  store.workOrders = cloneArray(payload.workOrders);
  store.situationCards = cloneArray(payload.situationCards);
  store.approvalRequests = cloneArray(payload.approvalRequests);
  store.situationSourceEvents = cloneArray(payload.situationSourceEvents || []);
  store.situationFollowThroughs = cloneArray(payload.situationFollowThroughs || []);
  store.selectedSituationCardId = payload.selectedSituationCardId || null;
  store.expandedSituationAgentId = null;
  store.situationDemoConductor = payload.situationDemoConductor || createInitialDemoConductor(importedAt);
  store.situationDemoReport = payload.situationDemoReport || null;
  store.activeSituationPack = payload.activeSituationPack || "cards";
  store.situationLastAction = payload.situationLastAction || null;
  store.situationEventLog = cloneArray(payload.situationEventLog);
  store.auditEvents = cloneArray(payload.auditEvents);
  store.contextPackets = cloneArray(payload.contextPackets);
  store.controlAgentOutputs = cloneArray(payload.controlAgentOutputs);
  store.securityFindings = cloneArray(payload.securityFindings);
  store.authorizationDecisions = cloneArray(payload.authorizationDecisions);
  store.gapFindings = cloneArray(payload.gapFindings);
  store.cadenceNudges = cloneArray(payload.cadenceNudges);
  store.memoryCandidates = cloneArray(payload.memoryCandidates);
  store.handoffRequests = cloneArray(payload.handoffRequests);
  store.agentRuns = cloneArray(payload.agentRuns);
  store.recommendations = cloneArray(payload.recommendations);
  store.reviewDecisions = cloneArray(payload.reviewDecisions);
  store.validationRecords = cloneArray(payload.validationRecords);
  store.validationExportStatus = payload.validationExportStatus || null;
  store.validationExportPackage = payload.validationExportPackage || null;
  store.situationSessionId = snapshot.sessionId;
  store.situationScenarioWeek = snapshot.scenarioWeek;
  store.situationSnapshotExport = snapshot;
  store.situationSnapshotStatus = {
    status: "loaded",
    message: `${snapshot.snapshotId} loaded locally.`,
    snapshotId: snapshot.snapshotId,
    sessionId: snapshot.sessionId,
    scenarioWeek: snapshot.scenarioWeek,
    errors: [],
    createdAt: importedAt
  };
  appendSituationLog(store, {
    roomId: "room_general_ops",
    eventType: "demo_snapshot_imported",
    artifactType: "snapshot",
    artifactId: snapshot.snapshotId,
    actorId: "system",
    summary: `Imported local demo snapshot ${snapshot.snapshotId}.`,
    createdAt: importedAt
  });

  return { valid: true, errors: [], snapshot };
}

export function validateSituationDemoSnapshot(snapshot) {
  const errors = [];
  if (!snapshot || typeof snapshot !== "object") {
    return { valid: false, errors: ["Snapshot must be an object."] };
  }
  if (snapshot.snapshotVersion !== SITUATION_SNAPSHOT_VERSION) {
    errors.push(`snapshotVersion must be ${SITUATION_SNAPSHOT_VERSION}.`);
  }
  if (!snapshot.snapshotId) errors.push("snapshotId is required.");
  if (!snapshot.sessionId) errors.push("sessionId is required.");
  if (!Number.isFinite(Number(snapshot.scenarioWeek))) errors.push("scenarioWeek is required.");
  if (!snapshot.createdAt) errors.push("createdAt is required.");
  if (!snapshot.payload || typeof snapshot.payload !== "object") {
    errors.push("payload is required.");
  }
  const payload = snapshot.payload || {};
  for (const key of ["roomMessages", "situationEventLog", "situationCards", "workOrders", "approvalRequests"]) {
    if (!Array.isArray(payload[key])) errors.push(`payload.${key} must be an array.`);
  }
  if (payload.situationSourceEvents && !Array.isArray(payload.situationSourceEvents)) {
    errors.push("payload.situationSourceEvents must be an array.");
  }
  if (payload.situationFollowThroughs && !Array.isArray(payload.situationFollowThroughs)) {
    errors.push("payload.situationFollowThroughs must be an array.");
  }
  return { valid: errors.length === 0, errors };
}

export function summarizeSituationMetrics(store) {
  ensureSituationRoomCollections(store);
  const reviewedApprovals = store.approvalRequests.filter((approval) => approval.status !== "pending");
  const pendingApprovals = store.approvalRequests.filter((approval) => approval.status === "pending");
  const blockedWork = store.workOrders.filter((workOrder) => workOrder.status === "blocked");
  const pendingNextSteps = store.situationCards.filter((card) => card.type === "agent_next_step_proposal" && card.status === "pending");
  const reviewActions = reviewedApprovals.length + (store.reviewDecisions?.length || 0);
  return {
    rooms: store.situationRooms.length,
    messages: store.roomMessages.length,
    cards: store.situationCards.length,
    workOrders: store.workOrders.length,
    pendingApprovals: pendingApprovals.length,
    reviewedApprovals: reviewedApprovals.length,
    blockedWork: blockedWork.length,
    reviewActions,
    pendingNextSteps: pendingNextSteps.length,
    selectedFollowThroughs: store.situationFollowThroughs.length,
    logs: store.situationEventLog.length,
    lastAction: store.situationLastAction?.summary || "No Situation Room action yet.",
    localStorageKey: "agentops-core-store-v1"
  };
}

export function runWeekTwoContinuityScenario(store, createdAt = new Date().toISOString()) {
  ensureSituationRoomCollections(store);
  const caseRecord = activeCaseFromStore(store);
  const priorLogs = store.situationEventLog.length;
  const priorSourceEvents = store.situationSourceEvents.length;
  const priorFollowThroughs = store.situationFollowThroughs.length;
  const priorApprovals = store.approvalRequests.length;
  const pendingApprovals = store.approvalRequests.filter((approval) => approval.status === "pending");
  const blockedWorkOrders = store.workOrders.filter((workOrder) => workOrder.status === "blocked");
  const reviewedApprovals = store.approvalRequests.filter((approval) => approval.status !== "pending");
  const scenarioWeek = Math.max(2, Number(store.situationScenarioWeek || 1) + 1);
  const traceId = createId("trace", "week_two_continuity", createdAt);
  const workOrder = createWorkOrder({
    id: createId("wo", "week_two_continuity", createdAt),
    roomId: "room_weekly_control",
    caseId: caseRecord?.id || null,
    requestedBy: "scenario_gallery",
    agentId: "A-CAD-001",
    command: "@cad advance one week",
    status: "completed",
    traceId,
    createdAt
  });
  const cards = [
    createSituationCard({
      id: createId("card", "week_two_prior_logs", createdAt),
      roomId: "room_weekly_control",
      type: "week_two_prior_log_review",
      agentId: "A-CAD-001",
      caseId: caseRecord?.id || null,
      title: "Week 2 prior log review",
      summary: `A-CAD reviewed ${priorSourceEvents} source event(s), ${priorLogs} prior local log record(s), ${priorApprovals} approval gate(s), ${priorFollowThroughs} local follow-through decision(s), and ${store.workOrders.length} work order(s).`,
      severity: "info",
      workOrderId: workOrder.id,
      traceId,
      createdAt
    }),
    createSituationCard({
      id: createId("card", "week_two_unresolved_work", createdAt),
      roomId: "room_weekly_control",
      type: "week_two_unresolved_work",
      agentId: "A-CAD-001",
      caseId: caseRecord?.id || null,
      title: "Unresolved local work summarized",
      summary: `${pendingApprovals.length} pending approval(s), ${blockedWorkOrders.length} blocked work order(s), ${reviewedApprovals.length} reviewed approval(s).`,
      severity: pendingApprovals.length || blockedWorkOrders.length ? "warning" : "info",
      workOrderId: workOrder.id,
      traceId,
      createdAt: offsetIso(createdAt, 1)
    }),
    createSituationCard({
      id: createId("card", "week_two_next_business_ask", createdAt),
      roomId: "room_weekly_control",
      type: "week_two_next_business_ask",
      agentId: "A-CAD-001",
      caseId: caseRecord?.id || null,
      title: "Week 2 next ask",
      summary: "Continue with 3-5 anonymized real Treuhand cases before adding production infrastructure.",
      severity: "info",
      actions: [
        {
          id: "request_real_cases",
          label: "Request cases",
          description: "Use the anonymized data request and keep the workflow local."
        },
        {
          id: "review_open_gates",
          label: "Review open gates",
          description: "Resolve pending approvals before claiming continuity."
        },
        {
          id: "keep_infra_local",
          label: "Keep infra local",
          description: "Export/import snapshots instead of adding a database yet."
        }
      ],
      workOrderId: workOrder.id,
      traceId,
      createdAt: offsetIso(createdAt, 2)
    })
  ];
  workOrder.cardIds = cards.map((card) => card.id);
  store.workOrders.unshift(workOrder);
  store.situationCards.unshift(...cards);
  store.activeSituationRoomId = "room_weekly_control";
  store.situationScenarioWeek = scenarioWeek;
  store.situationLastAction = {
    status: "week_two_continuity_run",
    roomId: "room_weekly_control",
    workOrderId: workOrder.id,
    cardIds: cards.map((card) => card.id),
    summary: `Week ${scenarioWeek} continuity scenario reviewed ${priorSourceEvents} source event(s), ${priorLogs} prior log record(s), and ${priorFollowThroughs} local follow-through decision(s).`,
    createdAt
  };
  appendSystemRoomMessage(store, {
    roomId: "room_weekly_control",
    text: `Week ${scenarioWeek} continuity scenario reviewed ${priorSourceEvents} source event(s), ${priorLogs} prior log record(s), ${priorFollowThroughs} local follow-through decision(s), and created work order ${workOrder.id}.`,
    createdAt: offsetIso(createdAt, 3)
  });
  appendSituationLog(store, {
    roomId: "room_weekly_control",
    eventType: "week_two_continuity_run",
    artifactType: "work_order",
    artifactId: workOrder.id,
    actorId: "A-CAD-001",
    summary: store.situationLastAction.summary,
    createdAt
  });
  return { workOrder, cards, scenarioWeek };
}

export function summarizeSituationAgentParticipation(store) {
  ensureSituationRoomCollections(store);
  return ACTIVE_SITUATION_AGENTS.map((agent) => {
    const cards = store.situationCards.filter((card) => card.agentId === agent.agentId);
    const workOrders = store.workOrders.filter(
      (workOrder) => workOrder.agentId === agent.agentId || workOrder.collaboratingAgentIds?.includes(agent.agentId)
    );
    const controlOutputs = (store.controlAgentOutputs || []).filter((output) => output.agentCode === agent.agentId);
    const agentRuns = (store.agentRuns || []).filter((run) => run.agentCode === agent.agentId);
    const approvals = store.approvalRequests.filter((approval) => approval.requestedByAgentId === agent.agentId);
    const latest = latestDatedItem([
      ...cards.map((item) => ({ createdAt: item.createdAt, label: item.title })),
      ...workOrders.map((item) => ({ createdAt: item.updatedAt || item.createdAt, label: item.command })),
      ...controlOutputs.map((item) => ({ createdAt: item.createdAt, label: item.summary })),
      ...agentRuns.map((item) => ({ createdAt: item.completedAt || item.startedAt, label: "Treuhand intake review completed" })),
      ...approvals.map((item) => ({ createdAt: item.decidedAt || item.createdAt, label: `${item.actionType} ${item.status}` }))
    ]);

    return {
      ...agent,
      cards: cards.length,
      workOrders: workOrders.length,
      controlOutputs: controlOutputs.length,
      agentRuns: agentRuns.length,
      approvals: approvals.length,
      totalOutputs: cards.length + workOrders.length + controlOutputs.length + agentRuns.length + approvals.length,
      latestAction: latest?.label || "Waiting for local demo command"
    };
  });
}

export function appendAgentNextStepProposal(
  store,
  {
    roomId = "room_general_ops",
    agentId,
    caseId = null,
    workOrderId = null,
    sourceType,
    sourceId,
    sourceEventId = null,
    traceId = null,
    summary,
    choices = [],
    createdAt = new Date().toISOString()
  }
) {
  ensureSituationRoomCollections(store);
  const normalizedChoices = choices.map(normalizeNextStepChoice);
  const proposal = createSituationCard({
    id: createId("card", "next_step", agentId, sourceType, sourceId, createdAt),
    roomId,
    type: "agent_next_step_proposal",
    agentId,
    caseId,
    title: `${agentId} proposes next step`,
    summary,
    severity: "info",
    actions: normalizedChoices,
    workOrderId,
    sourceEventId,
    traceId: traceId || createId("trace", "next_step", sourceId),
    createdAt
  });
  proposal.sourceType = sourceType;
  proposal.sourceId = sourceId;
  proposal.proposalCardId = proposal.id;
  proposal.choices = normalizedChoices;
  proposal.status = "pending";
  proposal.selectedChoiceId = null;
  proposal.selectedBy = null;
  proposal.selectedAt = null;
  proposal.localOnlyNotice = "Pending human selection; local consequence only.";
  store.situationCards.unshift(proposal);
  appendSituationLog(store, {
    roomId,
    eventType: "agent_next_step_proposed",
    artifactType: "card",
    artifactId: proposal.id,
    actorId: agentId,
    sourceEventId,
    summary,
    createdAt
  });
  return proposal;
}

export function appendTreuhandReviewNextStepProposal(store, { recommendation, reviewDecision, createdAt = new Date().toISOString() }) {
  if (!recommendation) throw new Error("recommendation is required for review next-step proposal.");
  if (!reviewDecision) throw new Error("reviewDecision is required for review next-step proposal.");
  return appendAgentNextStepProposal(store, {
    roomId: "room_case_march_2026",
    agentId: "A-TREU-001",
    caseId: recommendation.caseId,
    workOrderId: recommendation.workOrderId || null,
    sourceType: "review_decision",
    sourceId: reviewDecision.id,
    sourceEventId: recommendation.sourceEventId || null,
    traceId: recommendation.traceId || createId("trace", "review_decision", reviewDecision.id),
    summary: nextStepSummaryForReviewDecision(reviewDecision),
    choices: nextStepChoicesForReviewDecision(reviewDecision),
    createdAt
  });
}

export function selectFirstPendingNextStep(store, actorId = "human_reviewer", createdAt = new Date().toISOString()) {
  ensureSituationRoomCollections(store);
  const proposal = store.situationCards.find((card) => card.type === "agent_next_step_proposal" && card.status === "pending");
  if (!proposal) return null;
  return selectAgentNextStep(store, proposal.id, proposal.actions[0]?.id, actorId, createdAt);
}

export function selectAgentNextStep(
  store,
  proposalCardId,
  choiceId,
  actorId = "human_reviewer",
  createdAt = new Date().toISOString()
) {
  ensureSituationRoomCollections(store);
  const proposal = store.situationCards.find((card) => card.id === proposalCardId && card.type === "agent_next_step_proposal");
  if (!proposal) throw new Error(`Unknown next-step proposal: ${proposalCardId}`);
  if (proposal.status !== "pending") {
    throw new Error(`Next-step proposal ${proposalCardId} is already ${proposal.status || "closed"}.`);
  }
  const choice = proposal.actions.find((item) => item.id === choiceId);
  if (!choice) throw new Error(`Unknown next-step choice: ${choiceId}`);

  const followThrough = createLocalFollowThrough({
    proposal,
    choice,
    actorId,
    createdAt
  });
  proposal.status = "selected";
  proposal.selectedChoiceId = choice.id;
  proposal.selectedChoiceLabel = choice.label;
  proposal.selectedBy = actorId;
  proposal.selectedAt = createdAt;
  proposal.followThroughId = followThrough.id;
  proposal.localConsequenceType = choice.localConsequenceType;
  proposal.localOnlyNotice = "Local consequence recorded only; no external action executed.";
  proposal.updatedAt = createdAt;

  store.situationFollowThroughs.unshift(followThrough);
  const card = createSituationCard({
    id: createId("card", "follow_through", followThrough.id),
    roomId: proposal.roomId,
    type: "local_follow_through_recorded",
    agentId: proposal.agentId,
    caseId: proposal.caseId,
    title: "Local follow-through recorded",
    summary: `${actorId} selected "${choice.label}" for ${proposal.agentId}. Local consequence recorded only; no external action executed.`,
    severity: "info",
    workOrderId: proposal.workOrderId,
    sourceEventId: proposal.sourceEventId || null,
    traceId: proposal.traceId,
    createdAt
  });
  card.sourceType = proposal.sourceType;
  card.sourceId = proposal.sourceId;
  card.proposalCardId = proposal.id;
  card.followThroughId = followThrough.id;
  card.selectedChoiceId = choice.id;
  card.localConsequenceType = choice.localConsequenceType;
  store.situationCards.unshift(card);

  appendSystemRoomMessage(store, {
    roomId: proposal.roomId,
    text: `${proposal.agentId} recorded local follow-through ${followThrough.id}: ${choice.label}. No external action executed.`,
    sourceEventId: proposal.sourceEventId || null,
    createdAt: offsetIso(createdAt, 1)
  });
  appendSituationLog(store, {
    roomId: proposal.roomId,
    eventType: "local_follow_through_recorded",
    artifactType: "follow_through",
    artifactId: followThrough.id,
    actorId,
    sourceEventId: proposal.sourceEventId || null,
    summary: followThrough.localConsequenceSummary,
    createdAt
  });
  store.activeSituationRoomId = proposal.roomId;
  store.activeSituationPack = "next_steps";
  store.situationLastAction = {
    status: "local_follow_through_recorded",
    roomId: proposal.roomId,
    workOrderId: proposal.workOrderId || null,
    sourceEventId: proposal.sourceEventId || null,
    cardIds: [proposal.id, card.id],
    followThroughId: followThrough.id,
    summary: `${choice.label} selected locally; no external action executed.`,
    createdAt
  };
  return { proposal, followThrough, card };
}

export function parseAgentTag(text) {
  const normalized = String(text || "").toLowerCase();
  const tag = Object.keys(AGENT_TAGS).find((candidate) => normalized.includes(candidate));
  return tag ? { tag, agentId: AGENT_TAGS[tag] } : null;
}

function matchDemoCommand(text, agentId) {
  const normalized = String(text || "").toLowerCase();
  return DEMO_COMMAND_ROUTES.find(
    (route) => route.agentId === agentId && route.requiredTerms.every((term) => normalized.includes(term))
  );
}

function runInboundEmailScenario(store, scenario, createdAt, sourceEvent) {
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
      workOrderId: workOrder.id,
      sourceEventId: sourceEvent.id,
      traceId,
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
  return appendScenarioResult(store, { scenario, sourceEvent, workOrder, cards, approvalRequests: [approval], createdAt, auditMessage: "Ran inbound email intake Situation Room scenario." });
}

function runConfidentialUploadScenario(store, scenario, createdAt, sourceEvent) {
  const caseRecord = activeCaseFromStore(store);
  const traceId = createId("trace", scenario.id, createdAt);
  const workOrder = createScenarioWorkOrder({ scenario, caseRecord, command: "@sec check this upload attempt", traceId, createdAt });
  const syntheticUpload = {
    destination: "external_llm_upload_box",
    content: "Synthetic payroll and bank statement excerpt with AHV redacted. Do not paste into external tools."
  };
  const privacy = validatePrivacyForExport(syntheticUpload);
  const riskSignals = detectUploadRiskSignals(syntheticUpload);
  const finding = {
    id: createId("sec", scenario.id, "external_upload"),
    caseId: caseRecord.id,
    agentCode: "A-SEC-001",
    targetType: "external_llm_upload_attempt",
    targetId: "external_llm_upload_box",
    severity: "high",
    status: "blocked",
    summary: `External LLM upload attempt contains sensitive keyword signal(s): ${riskSignals.map((signal) => signal.label).join(", ")}. Use an internal redacted packet instead.`,
    riskSignals,
    privacyIssueIds: privacy.issues.map((issue) => issue.id),
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
      details: [
        `privacy regex issues: ${privacy.issues.length}`,
        ...riskSignals.map((signal) => `keyword risk: ${signal.label}`)
      ],
      createdAt
    })
  ]);
  const cards = [
    scenarioCard(scenario, traceId, "external_llm_upload_attempt", "system", caseRecord.id, "External LLM upload attempted", "Human pasted synthetic confidential text into the simulated ChatGPT/Claude box.", "warning", [], createdAt),
    scenarioCard(scenario, traceId, "sensitive_content_detected", "A-SEC-001", caseRecord.id, "Sensitive content detected", `Deterministic risk signals: ${riskSignals.map((signal) => signal.label).join(", ")}.`, "high", [], createdAt),
    scenarioCard(scenario, traceId, "policy_violation_warning", "A-SEC-001", caseRecord.id, "Upload blocked locally", "A-SEC-001 recommends using an internal redacted packet.", "high", [], createdAt),
    scenarioCard(scenario, traceId, "audit_event_recorded", "A-CAD-001", caseRecord.id, "Audit event queued", "The weekly audit will summarize this security event.", "info", [], createdAt)
  ];
  return appendScenarioResult(store, { scenario, sourceEvent, workOrder, cards, approvalRequests: [], createdAt, auditMessage: "Ran confidential upload attempt Situation Room scenario." });
}

function runEmployeeOnboardingScenario(store, scenario, createdAt, sourceEvent) {
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
  return appendScenarioResult(store, { scenario, sourceEvent, workOrder, cards, approvalRequests: [approval], createdAt, auditMessage: "Ran employee onboarding Situation Room scenario." });
}

function runAgentHandoffGapScenario(store, scenario, createdAt, sourceEvent) {
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
  return appendScenarioResult(store, { scenario, sourceEvent, workOrder, cards, approvalRequests: [approval], createdAt, auditMessage: "Ran agent handoff gap Situation Room scenario." });
}

function runWeeklyControlAuditScenario(store, scenario, createdAt, sourceEvent) {
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
  return appendScenarioResult(store, { scenario, sourceEvent, workOrder, cards, approvalRequests: [], createdAt, auditMessage: "Ran weekly control audit Situation Room scenario." });
}

function appendScenarioResult(store, { scenario, sourceEvent, workOrder, cards, approvalRequests, createdAt, auditMessage }) {
  store.activeSituationRoomId = scenario.roomId;
  const auditEvent = {
    id: createId("audit", scenario.id, createdAt),
    caseId: activeCaseFromStore(store)?.id || null,
    eventType: "situation_scenario_run",
    message: auditMessage,
    createdAt
  };
  workOrder.sourceEventId = sourceEvent.id;
  const normalizedCards = cards.map((card) => ({
    ...card,
    workOrderId: card.workOrderId || workOrder.id,
    sourceEventId: sourceEvent.id,
    truthLabel: card.truthLabel || SITUATION_TRUTH_LABEL,
    truthLabelText: card.truthLabelText || "synthetic/local only"
  }));
  const normalizedApprovals = approvalRequests.map((approval) => ({
    ...approval,
    sourceEventId: sourceEvent.id
  }));
  workOrder.approvalIds = normalizedApprovals.map((item) => item.id);
  workOrder.auditEventIds = [auditEvent.id];
  workOrder.cardIds = normalizedCards.map((card) => card.id);
  workOrder.evidenceIds = unique(normalizedCards.flatMap((card) => card.evidenceIds || []));
  store.situationSourceEvents.unshift(sourceEvent);
  appendSituationLog(store, {
    roomId: scenario.roomId,
    eventType: "source_event_received",
    artifactType: "source_event",
    artifactId: sourceEvent.id,
    actorId: sourceEvent.sourceActor || "system",
    sourceEventId: sourceEvent.id,
    summary: `${sourceEvent.sourceLabel} emitted ${sourceEvent.triggerType}: ${sourceEvent.payloadTitle}.`,
    createdAt
  });
  store.workOrders.unshift(workOrder);
  store.situationCards.unshift(...normalizedCards);
  store.approvalRequests.unshift(...normalizedApprovals);
  store.auditEvents.unshift(auditEvent);
  appendSituationLog(store, {
    roomId: scenario.roomId,
    eventType: "scenario_run",
    artifactType: "work_order",
    artifactId: workOrder.id,
    actorId: scenario.primaryAgentId,
    sourceEventId: sourceEvent.id,
    summary: auditMessage,
    createdAt
  });
  return { sourceEvent, workOrder, cards: normalizedCards, approvalRequests: normalizedApprovals };
}

function createScenarioWorkOrder({ scenario, caseRecord, command, traceId, createdAt }) {
  return createWorkOrder({
    id: createId("wo", scenario.id, createdAt),
    roomId: scenario.roomId,
    caseId: caseRecord?.id || null,
    requestedBy: "scenario_gallery",
    agentId: scenario.primaryAgentId,
    command,
    status: SCENARIO_WORK_ORDER_STATUS[scenario.id] || "planned",
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
    truthLabel: SITUATION_TRUTH_LABEL,
    truthLabelText: "synthetic/local only",
    externalEffect: "none",
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
  sourceEventId = null,
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
    sourceEventId,
    traceId,
    approvalStatus: approvalId ? "pending" : "not_required",
    blockedByApproval: Boolean(approvalId),
    truthLabel: SITUATION_TRUTH_LABEL,
    truthLabelText: "synthetic/local only",
    externalEffect: "none",
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
    truthLabel: "local_approval_record_only",
    externalEffect: "none",
    localOnlyNotice: "Pending local approval only; no external action will run.",
    createdAt
  };
}

function appendSystemRoomMessage(store, { roomId, text, sourceEventId = null, createdAt = new Date().toISOString() }) {
  const message = createRoomMessage({
    id: createId("msg", roomId, "system", createdAt, store.roomMessages.length + 1),
    roomId,
    actorType: "system",
    actorId: "system",
    text,
    createdAt
  });
  store.roomMessages.unshift(message);
  appendSituationLog(store, {
    roomId,
    eventType: "system_room_message_created",
    artifactType: "message",
    artifactId: message.id,
    actorId: "system",
    sourceEventId,
    summary: text,
    createdAt
  });
  return message;
}

function appendSituationLog(
  store,
  { roomId, eventType, artifactType, artifactId, actorId, sourceEventId = null, summary, createdAt = new Date().toISOString() }
) {
  ensureSituationRoomCollections(store);
  const log = createSituationLog({
    id: createId("log", eventType, artifactType, artifactId, createdAt, store.situationEventLog.length + 1),
    roomId,
    eventType,
    artifactType,
    artifactId,
    actorId,
    sourceEventId,
    summary,
    createdAt
  });
  store.situationEventLog.unshift(log);
  return log;
}

function createSituationLog({ id, roomId, eventType, artifactType, artifactId, actorId, sourceEventId = null, summary, createdAt }) {
  return {
    id,
    logId: id,
    roomId,
    eventType,
    artifactType,
    artifactId,
    actorId,
    sourceEventId,
    summary,
    storage: "localStorage:agentops-core-store-v1.situationEventLog",
    createdAt
  };
}

function createLocalFollowThrough({ proposal, choice, actorId, createdAt }) {
  return {
    id: createId("follow", proposal.id, choice.id, createdAt),
    followThroughId: createId("follow", proposal.id, choice.id, createdAt),
    proposalCardId: proposal.id,
    roomId: proposal.roomId,
    agentId: proposal.agentId,
    caseId: proposal.caseId || null,
    workOrderId: proposal.workOrderId || null,
    sourceType: proposal.sourceType,
    sourceId: proposal.sourceId,
    sourceEventId: proposal.sourceEventId || null,
    selectedChoiceId: choice.id,
    selectedChoiceLabel: choice.label,
    localConsequenceType: choice.localConsequenceType,
    localConsequenceSummary: `${choice.label}: ${choice.description || "Local consequence recorded only."}`,
    status: "recorded_local_only",
    actorId,
    traceId: proposal.traceId,
    truthLabel: SITUATION_TRUTH_LABEL,
    truthLabelText: "synthetic/local only",
    externalEffect: "none",
    createdAt
  };
}

function normalizeNextStepChoice(choice, index) {
  return {
    id: choice.id || createId("choice", index + 1, choice.label),
    label: choice.label,
    description: choice.description,
    localConsequenceType: choice.localConsequenceType || choice.id || createId("local_consequence", index + 1, choice.label),
    effect: "local_consequence_only"
  };
}

function nextStepSummaryForApproval(approval) {
  const statusCopy = approval.status === "approved" ? "approved" : "rejected";
  if (approval.actionType === "review_before_send") {
    return `Draft review was ${statusCopy}. Choose the next safe local consequence before any client use.`;
  }
  if (approval.actionType === "grant_read_only_and_draft_access") {
    return `Onboarding access recommendation was ${statusCopy}. Choose the next local access-planning consequence; no IAM change will run.`;
  }
  if (approval.actionType === "approve_operating_memory_candidate") {
    return `Memory candidate review was ${statusCopy}. Choose the next local backlog consequence; no durable memory promotion will run.`;
  }
  return `Choose the next local-only review step after ${approval.actionType} was ${statusCopy}.`;
}

function nextStepChoicesForApproval(approval) {
  const status = approval.status === "approved" ? "approved" : "rejected";
  const choicesByAction = {
    review_before_send: {
      approved: [
        choice("inspect_draft_before_use", "Inspect draft before use", "Review draft wording and evidence links locally before any client use.", "inspect_local_draft"),
        choice("keep_draft_blocked_for_edit", "Keep draft blocked for edit", "Record that the draft stays blocked while a human edits it locally.", "keep_draft_blocked"),
        choice("move_to_validation_capture", "Move to Validation capture", "Open the validation workflow and capture reviewer feedback.", "capture_validation_feedback")
      ],
      rejected: [
        choice("mark_draft_not_usable", "Mark draft not usable", "Record that this draft should not be used in the demo flow.", "mark_local_draft_not_usable"),
        choice("request_revised_draft", "Request revised draft", "Ask A-TREU to prepare a revised local draft for human review.", "request_local_revised_draft"),
        choice("ask_for_missing_client_documents", "Ask for missing client documents", "Record a local follow-up request for missing packet items.", "request_missing_documents")
      ]
    },
    grant_read_only_and_draft_access: {
      approved: [
        choice("record_least_privilege_plan", "Record local least-privilege plan", "Keep the access recommendation as a local planning record only.", "record_local_access_plan"),
        choice("tighten_scope_before_real_iam", "Tighten scope before real IAM", "Reduce the recommended scope before any future production access request.", "tighten_access_scope"),
        choice("schedule_access_review", "Schedule access review", "Record a local review reminder for the access plan.", "schedule_local_access_review")
      ],
      rejected: [
        choice("prepare_narrower_access_request", "Prepare narrower access request", "Draft a narrower local access request for boss review.", "prepare_narrower_access_request"),
        choice("close_onboarding_packet", "Close onboarding packet", "Record the onboarding packet as closed locally.", "close_local_onboarding_packet"),
        choice("ask_boss_for_role_clarification", "Ask boss for role clarification", "Record a local clarification request about the employee role.", "request_role_clarification")
      ]
    },
    approve_operating_memory_candidate: {
      approved: [
        choice("keep_candidate_local_backlog", "Keep candidate in local memory backlog", "Keep the candidate as proposed local backlog, not promoted memory.", "keep_local_memory_backlog"),
        choice("revise_skill_wording_before_promotion", "Revise skill wording before promotion", "Record a local rewrite step before any future memory promotion review.", "revise_skill_wording"),
        choice("wait_for_real_anonymized_cases", "Wait for real anonymized cases", "Defer action until anonymized cases repeat the pattern.", "wait_for_real_cases")
      ],
      rejected: [
        choice("archive_candidate", "Archive candidate", "Record the candidate as archived locally.", "archive_local_memory_candidate"),
        choice("rewrite_from_reviewer_notes", "Rewrite from reviewer notes", "Record a local rewrite task grounded in reviewer notes.", "rewrite_from_reviewer_notes"),
        choice("wait_for_repeated_evidence", "Wait for repeated evidence", "Keep the finding dormant until repeated evidence appears.", "wait_for_repeated_evidence")
      ]
    }
  };
  return choicesByAction[approval.actionType]?.[status] || [
    choice("record_only", "Record only", "Keep the decision as a local audit record.", "record_local_only"),
    choice("review_later", "Review later", "Leave follow-up for a human reviewer.", "defer_human_review")
  ];
}

function nextStepSummaryForReviewDecision(reviewDecision) {
  if (reviewDecision.decision === "approve") {
    return "Recommendation was approved. Choose the next safe local step before any client-facing use.";
  }
  if (reviewDecision.decision === "edit") {
    return "Recommendation needs edits. Choose the next local revision or checklist step.";
  }
  return "Recommendation was rejected. Choose the next local learning or gap-analysis step.";
}

function nextStepChoicesForReviewDecision(reviewDecision) {
  if (reviewDecision.decision === "approve") {
    return [
      choice("inspect_evidence_links", "Inspect evidence links", "Review the cited evidence IDs before any client-facing use.", "inspect_evidence_links"),
      choice("keep_draft_local_review", "Keep draft in local review", "Keep the draft in the local review queue.", "keep_draft_local_review"),
      choice("capture_validation_feedback", "Capture validation feedback", "Move to Validation and capture reviewer feedback.", "capture_validation_feedback")
    ];
  }
  if (reviewDecision.decision === "edit") {
    return [
      choice("revise_draft_locally", "Revise draft locally", "Record that the draft needs local human edits.", "revise_draft_locally"),
      choice("add_reviewer_note", "Add reviewer note", "Attach reviewer guidance to the local record.", "add_reviewer_note"),
      choice("rerun_after_checklist_update", "Re-run after checklist update", "Record a local rerun after checklist changes.", "rerun_after_checklist_update")
    ];
  }
  return [
    choice("mark_recommendation_not_usable", "Mark recommendation not usable", "Record that this recommendation should not be used.", "mark_recommendation_not_usable"),
    choice("inspect_false_positive_cause", "Inspect false-positive cause", "Review why the agent produced an unusable recommendation.", "inspect_false_positive_cause"),
    choice("create_gap_candidate", "Create gap candidate for A-GAP review", "Record a local candidate for A-GAP review.", "create_gap_candidate")
  ];
}

function choice(id, label, description, localConsequenceType) {
  return { id, label, description, localConsequenceType };
}

function detectUploadRiskSignals(upload) {
  const text = `${upload.destination || ""} ${upload.content || ""}`.toLowerCase();
  const candidates = [
    { id: "external_llm_destination", label: "external LLM destination", terms: ["external_llm", "chatgpt", "claude"] },
    { id: "payroll_keyword", label: "payroll keyword", terms: ["payroll", "salary", "lohn"] },
    { id: "bank_keyword", label: "bank statement keyword", terms: ["bank statement", "bankauszug", "kontoauszug"] },
    { id: "client_sensitive_keyword", label: "client-sensitive text", terms: ["client", "confidential", "do not paste"] },
    { id: "ahv_keyword", label: "AHV/social security keyword", terms: ["ahv", "social security"] }
  ];

  return candidates.filter((candidate) => candidate.terms.some((term) => text.includes(term)));
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
  store.situationSourceEvents ||= [];
  store.situationFollowThroughs ||= [];
  store.selectedSituationCardId ||= null;
  store.expandedSituationAgentId ||= null;
  store.situationDemoConductor ||= createInitialDemoConductor();
  store.situationDemoConductor.completedActIds ||= [];
  store.situationDemoConductor.actRecordsById ||= {};
  store.situationDemoReport ||= null;
  store.activeSituationPack ||= "cards";
  store.situationLastAction ||= null;
  store.situationEventLog ||= seed.situationEventLog;
  store.situationSessionId ||= seed.situationSessionId;
  store.situationScenarioWeek ||= seed.situationScenarioWeek;
  store.situationSnapshotStatus ||= null;
  store.situationSnapshotExport ||= null;
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

function offsetIso(createdAt, offsetSeconds) {
  const base = new Date(createdAt);
  if (Number.isNaN(base.getTime())) return new Date().toISOString();
  return new Date(base.getTime() + offsetSeconds * 1000).toISOString();
}

function unique(values) {
  return [...new Set(values.filter(Boolean))];
}

function cloneArray(value) {
  return Array.isArray(value) ? value.map((item) => ({ ...item })) : [];
}

function latestDatedItem(items) {
  return items
    .filter((item) => item.createdAt)
    .sort((a, b) => new Date(b.createdAt) - new Date(a.createdAt))[0] || null;
}
