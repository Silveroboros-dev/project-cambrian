import { buildSituationTraceChain } from "./situationRoom.js";

export const WORKFLOW_KERNEL_REPORT_VERSION = "workflow.kernel.readiness.v1";

const STORAGE_NEEDS = new Set(["localStorage", "versioned_json_snapshot", "jsonl_or_sqlite", "postgres_later"]);

const PRIMITIVE_CONFIG = {
  sourceEvents: {
    label: "sourceEvents",
    nextMinimumStorageNeed: "localStorage",
    riskNote: "Current evidence is synthetic/local; it proves the event contract, not a production connector.",
    nextProofNeeded: "Replay the same source-event shape against 3-5 anonymized Treuhand packets before adding mailbox or workspace adapters."
  },
  contextPackets: {
    label: "contextPackets",
    nextMinimumStorageNeed: "localStorage",
    riskNote: "Context packets are local normalized inputs; source text must remain anonymized and evidence cannot act as instruction.",
    nextProofNeeded: "Use anonymized reviewer packets to test whether context packet fields are enough for real Treuhand review."
  },
  workOrders: {
    label: "workOrders",
    nextMinimumStorageNeed: "localStorage",
    riskNote: "Work orders are local proposed/running tasks, not autonomous production work.",
    nextProofNeeded: "Confirm reviewers can follow work-order state and statuses across real anonymized cases."
  },
  agentControlCards: {
    label: "agent/control cards",
    nextMinimumStorageNeed: "localStorage",
    riskNote: "Cards are synthetic/local review objects; they should not be treated as production audit guarantees.",
    nextProofNeeded: "Check whether reviewers can trust and scan the cards without reading raw chat."
  },
  approvalGates: {
    label: "approvalGates",
    nextMinimumStorageNeed: "localStorage",
    riskNote: "Approval gates are local records only; approval does not send, grant, file, or promote memory.",
    nextProofNeeded: "Validate that human reviewers understand where a client-facing or access-sensitive action stops."
  },
  nextStepProposals: {
    label: "nextStepProposals",
    nextMinimumStorageNeed: "localStorage",
    riskNote: "Next-step proposals are advisory local choices and do not execute external consequences.",
    nextProofNeeded: "Measure whether responsible-agent follow-through reduces review ambiguity after human decisions."
  },
  localFollowThroughs: {
    label: "localFollowThroughs",
    nextMinimumStorageNeed: "localStorage",
    riskNote: "Follow-through records are selected local consequences, not external actions.",
    nextProofNeeded: "Check that reviewers can reconstruct a human decision and selected consequence from the trace."
  },
  traceChains: {
    label: "traceChains",
    nextMinimumStorageNeed: "versioned_json_snapshot",
    riskNote: "Trace chains are reconstructed from local IDs; they are not yet immutable production audit trails.",
    nextProofNeeded: "Use anonymized cases to see whether trace reconstruction explains real reviewer disagreements."
  },
  validationRecords: {
    label: "validationRecords",
    nextMinimumStorageNeed: "localStorage",
    riskNote: "Validation records are separate proof artifacts; fixtures do not count as real reviewer operating proof.",
    nextProofNeeded: "Capture human-reviewed anonymized cases with baseline time, ratings, failure tags, and trace notes."
  },
  memoryCandidates: {
    label: "memoryCandidates",
    nextMinimumStorageNeed: "localStorage",
    riskNote: "Memory candidates remain proposed until human approval; no durable operating memory is promoted here.",
    nextProofNeeded: "Look for repeated reviewer-confirmed patterns before approving shared skills or memory."
  },
  localLogs: {
    label: "localLogs",
    nextMinimumStorageNeed: "versioned_json_snapshot",
    riskNote: "Local logs support demo reconstruction, not production audit or compliance guarantees.",
    nextProofNeeded: "Confirm local logs are enough for first reviewer sessions before adding jsonl, SQLite, or a server ledger."
  },
  snapshotContinuity: {
    label: "snapshotContinuity",
    nextMinimumStorageNeed: "versioned_json_snapshot",
    riskNote: "Snapshots are portable local continuity artifacts, not a multi-user database or append-only ledger.",
    nextProofNeeded: "Use the snapshot path for week-two demo continuity before deciding whether persistence must become stronger."
  }
};

export function buildWorkflowKernelReadinessReport(store = {}) {
  const collections = collectKernelCollections(store);
  const traceChains = buildRepresentedTraceChains(store);
  const snapshotContinuityCount = countSnapshotContinuityEvidence(store);
  const externalEffectViolations = collectExternalEffectViolations(store);
  const validationProof = summarizeValidationProof(collections.validationRecords);

  const primitives = {
    sourceEvents: primitiveReport("sourceEvents", collections.sourceEvents.length),
    contextPackets: primitiveReport("contextPackets", collections.contextPackets.length),
    workOrders: primitiveReport("workOrders", collections.workOrders.length),
    agentControlCards: primitiveReport("agentControlCards", collections.cards.length),
    approvalGates: primitiveReport("approvalGates", collections.approvalGates.length),
    nextStepProposals: primitiveReport("nextStepProposals", collections.nextStepProposals.length),
    localFollowThroughs: primitiveReport("localFollowThroughs", collections.followThroughRecords.length),
    traceChains: primitiveReport("traceChains", traceChains.length),
    validationRecords: primitiveReport("validationRecords", collections.validationRecords.length),
    memoryCandidates: primitiveReport("memoryCandidates", collections.memoryCandidates.length),
    localLogs: primitiveReport("localLogs", collections.eventLogs.length),
    snapshotContinuity: primitiveReport("snapshotContinuity", snapshotContinuityCount)
  };

  return {
    reportVersion: WORKFLOW_KERNEL_REPORT_VERSION,
    generatedFrom: "current_local_store",
    localOnly: true,
    productionConnectorRequiredNow: false,
    noExternalExecution: externalEffectViolations.length === 0,
    externalEffectSummary: externalEffectViolations.length === 0 ? "none" : "non_none_detected",
    currentLocalArchitectureEnoughForNextProof: true,
    nextProofScope: "3-5 anonymized real Treuhand cases before production connectors or stronger persistence.",
    primitives,
    traceChains,
    kernelMap: buildWorkflowKernelMap(store),
    proofSeparation: {
      situationRoomProof: {
        category: "synthetic_demo_evidence",
        sourceEvents: collections.sourceEvents.length,
        cards: collections.cards.length,
        localLogs: collections.eventLogs.length
      },
      validationProof,
      productionProof: {
        category: "not_present",
        count: 0,
        note: "No production connector, production audit guarantee, regulated conclusion, or autonomous execution is claimed."
      }
    },
    deferredFunctionality: [
      "production Gmail/Slack/Drive/browser/IAM connectors",
      "backend database or migrations",
      "production auth and multi-user permissions",
      "LLM calls or OCR",
      "autonomous client email, access grant, filing, memory promotion, or regulated conclusion",
      "new verticals or new active agents"
    ]
  };
}

export function buildWorkflowKernelMap(store = {}) {
  const collections = collectKernelCollections(store);
  const snapshotIds = collectSnapshotIds(store);

  return {
    source_events: mapEntry({
      futureCollection: "source_events",
      currentCollectionName: "situationSourceEvents",
      objects: collections.sourceEvents,
      notes: "Synthetic/local source events already carry adapter boundary, truth label, and expected agents."
    }),
    context_packets: mapEntry({
      futureCollection: "context_packets",
      currentCollectionName: "contextPackets",
      objects: collections.contextPackets,
      notes: "Context packets normalize evidence for agent use and keep taint/allowed-use boundaries."
    }),
    work_orders: mapEntry({
      futureCollection: "work_orders",
      currentCollectionName: "workOrders",
      objects: collections.workOrders,
      notes: "Work orders are governed local tasks with status, agent, room, case, and trace IDs."
    }),
    cards: mapEntry({
      futureCollection: "cards",
      currentCollectionName: "situationCards",
      objects: collections.cards,
      notes: "Cards include agent/control outputs, next-step proposals, approval records, and continuity records."
    }),
    approval_gates: mapEntry({
      futureCollection: "approval_gates",
      currentCollectionName: "approvalRequests",
      objects: collections.approvalGates,
      notes: "Approval gates separate gate/control agent from responsible follow-through agent."
    }),
    next_step_proposals: mapEntry({
      futureCollection: "next_step_proposals",
      currentCollectionName: "situationCards[type=agent_next_step_proposal]",
      objects: collections.nextStepProposals,
      notes: "Next-step proposals are cards today; a future kernel can store them as their own collection."
    }),
    follow_through_records: mapEntry({
      futureCollection: "follow_through_records",
      currentCollectionName: "situationFollowThroughs",
      objects: collections.followThroughRecords,
      notes: "Follow-through records capture human-selected local consequences."
    }),
    event_logs: mapEntry({
      futureCollection: "event_logs",
      currentCollectionName: "situationEventLog",
      objects: collections.eventLogs,
      notes: "Local logs are sufficient for the next validation loop and can later become JSONL, SQLite, or server ledger records."
    }),
    validation_records: mapEntry({
      futureCollection: "validation_records",
      currentCollectionName: "validationRecords",
      objects: collections.validationRecords,
      notes: "Validation records stay separate from synthetic Situation Room artifacts and carry proof category metadata."
    }),
    memory_candidates: mapEntry({
      futureCollection: "memory_candidates",
      currentCollectionName: "memoryCandidates",
      objects: collections.memoryCandidates,
      notes: "Memory candidates remain pending/proposed until explicitly approved."
    }),
    snapshots: {
      futureCollection: "snapshots",
      currentCollectionName: "situationSnapshotExport/situationSnapshotStatus",
      currentEvidenceCount: snapshotIds.length,
      currentObjectIds: snapshotIds,
      representedNow: snapshotIds.length > 0,
      storageNow: "versioned_json_snapshot",
      productionConnectorRequiredNow: false,
      notes: "Snapshots provide portable demo continuity without a backend or database."
    }
  };
}

function primitiveReport(key, currentEvidenceCount) {
  const config = PRIMITIVE_CONFIG[key];
  if (!config) throw new Error(`Unknown workflow kernel primitive: ${key}`);
  if (!STORAGE_NEEDS.has(config.nextMinimumStorageNeed)) {
    throw new Error(`Invalid storage need for ${key}: ${config.nextMinimumStorageNeed}`);
  }

  return {
    label: config.label,
    currentEvidenceCount,
    representedNow: currentEvidenceCount > 0,
    simpleArchitectureEnough: true,
    nextMinimumStorageNeed: config.nextMinimumStorageNeed,
    productionConnectorRequiredNow: false,
    riskNote: config.riskNote,
    nextProofNeeded: config.nextProofNeeded
  };
}

function collectKernelCollections(store) {
  const cards = asArray(store.situationCards);
  return {
    sourceEvents: asArray(store.situationSourceEvents),
    contextPackets: asArray(store.contextPackets),
    workOrders: asArray(store.workOrders),
    cards,
    approvalGates: asArray(store.approvalRequests),
    nextStepProposals: cards.filter((card) => card.type === "agent_next_step_proposal"),
    followThroughRecords: asArray(store.situationFollowThroughs),
    eventLogs: asArray(store.situationEventLog),
    validationRecords: asArray(store.validationRecords),
    memoryCandidates: asArray(store.memoryCandidates)
  };
}

function buildRepresentedTraceChains(store) {
  const selectors = [
    ...asArray(store.situationSourceEvents).map((item) => ({ sourceEventId: item.id || item.sourceEventId })),
    ...asArray(store.workOrders).map((item) => ({ workOrderId: item.id || item.workOrderId })),
    ...asArray(store.approvalRequests).map((item) => ({ approvalId: item.id || item.approvalId })),
    ...asArray(store.situationCards)
      .filter((item) => item.type === "agent_next_step_proposal")
      .map((item) => ({ proposalCardId: item.id || item.proposalCardId })),
    ...asArray(store.situationFollowThroughs).map((item) => ({ followThroughId: item.id || item.followThroughId }))
  ].filter((selector) => Object.values(selector).some(Boolean));

  const chainsByKey = new Map();
  for (const selector of selectors) {
    const chain = buildSituationTraceChain(store, selector);
    if (!chain.sourceEvent && !chain.workOrder && chain.cards.length === 0 && chain.logs.length === 0) continue;
    const key =
      chain.selector.sourceEventId ||
      chain.selector.workOrderId ||
      chain.selector.traceId ||
      chain.selector.approvalId ||
      chain.selector.proposalCardId ||
      chain.selector.followThroughId;
    if (!key || chainsByKey.has(key)) continue;
    chainsByKey.set(key, {
      traceKey: key,
      sourceEventId: chain.selector.sourceEventId,
      workOrderId: chain.selector.workOrderId,
      traceId: chain.selector.traceId,
      cards: chain.cards.length,
      approvalGates: chain.approvals.length,
      nextStepProposals: chain.nextStepProposals.length,
      localFollowThroughs: chain.followThroughs.length,
      localLogs: chain.logs.length,
      externalEffectSummary: chain.externalEffectSummary,
      truthLabel: chain.truthLabel
    });
  }
  return [...chainsByKey.values()];
}

function collectExternalEffectViolations(store) {
  const collections = collectKernelCollections(store);
  const artifacts = [
    ...collections.sourceEvents,
    ...collections.workOrders,
    ...collections.cards,
    ...collections.approvalGates,
    ...collections.nextStepProposals,
    ...collections.followThroughRecords
  ];
  return artifacts.filter((item) => item?.externalEffect && item.externalEffect !== "none");
}

function summarizeValidationProof(validationRecords) {
  const fixtureSeedRecords = validationRecords.filter((record) => record.reviewerRating?.ratingSource === "fixture_seed");
  const humanCaptureRecords = validationRecords.filter((record) => record.reviewerRating?.ratingSource === "human_capture");
  const realReviewerOperatingProofRecords = humanCaptureRecords.filter(
    (record) => record.caseSource === "real_anonymized_reviewer_case"
  );

  return {
    category: realReviewerOperatingProofRecords.length > 0 ? "real_reviewer_operating_proof" : "validation_artifacts_not_production_proof",
    records: validationRecords.length,
    fixtureSeedRecords: fixtureSeedRecords.length,
    humanCaptureRecords: humanCaptureRecords.length,
    realReviewerOperatingProofRecords: realReviewerOperatingProofRecords.length,
    separatedFromSyntheticSituationRoom: true,
    nextProofNeeded: "Add human_capture ratings on 3-5 anonymized real Treuhand reviewer cases before treating validation as operating proof."
  };
}

function countSnapshotContinuityEvidence(store) {
  return collectSnapshotIds(store).length;
}

function collectSnapshotIds(store) {
  return unique(
    [
      store.situationSnapshotExport?.snapshotId,
      store.situationSnapshotStatus?.snapshotId,
      ...asArray(store.situationEventLog)
        .filter((log) => ["demo_snapshot_exported", "demo_snapshot_imported", "week_two_continuity_run"].includes(log.eventType))
        .map((log) => log.artifactId),
      ...asArray(store.situationCards)
        .filter((card) => card.type?.startsWith("week_two_"))
        .map((card) => card.id)
    ].filter(Boolean)
  );
}

function mapEntry({ futureCollection, currentCollectionName, objects, notes }) {
  return {
    futureCollection,
    currentCollectionName,
    currentEvidenceCount: objects.length,
    currentObjectIds: objects.map(objectId).filter(Boolean).slice(0, 12),
    representedNow: objects.length > 0,
    storageNow: "localStorage",
    productionConnectorRequiredNow: false,
    notes
  };
}

function objectId(item) {
  return item?.id || item?.cardId || item?.approvalId || item?.followThroughId || item?.validationRecordId || null;
}

function asArray(value) {
  return Array.isArray(value) ? value : [];
}

function unique(values) {
  return [...new Set(values)];
}
