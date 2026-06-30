import { agentBacklog } from "./agent.js";
import { createInitialStore } from "./demoData.js";
import { sampleCaseImports } from "./phase2SampleCases.js";
import { createInitialSituationRoomState } from "./situationRoom.js";
import { normalizeCaseSource } from "./validation.js";

const STORAGE_KEY = "agentops-core-store-v1";
const FIXTURE_SAMPLE_CASE_IDS = new Set(sampleCaseImports.map((item) => item.sampleCaseId));

export function loadStore() {
  const serialized = localStorage.getItem(STORAGE_KEY);
  if (!serialized) {
    return ensureStoreShape(createInitialStore());
  }

  try {
    return ensureStoreShape(JSON.parse(serialized));
  } catch {
    return ensureStoreShape(createInitialStore());
  }
}

export function saveStore(store) {
  localStorage.setItem(STORAGE_KEY, JSON.stringify(ensureStoreShape(store)));
}

export function resetStore() {
  const store = ensureStoreShape(createInitialStore());
  saveStore(store);
  return store;
}

export function activeCase(store) {
  return store.cases.find((item) => item.id === store.activeCaseId) || store.cases[0];
}

export function addAuditEvent(store, caseId, eventType, message) {
  store.auditEvents.unshift({
    id: `audit_${Date.now()}_${Math.random().toString(36).slice(2, 6)}`,
    caseId,
    eventType,
    message,
    createdAt: new Date().toISOString()
  });
}

export function ensureStoreShape(store) {
  const shaped = store || createInitialStore();
  shaped.contextPackets ||= [];
  shaped.controlAgentOutputs ||= [];
  shaped.securityFindings ||= [];
  shaped.authorizationDecisions ||= [];
  shaped.gapFindings ||= [];
  shaped.cadenceNudges ||= [];
  shaped.memoryCandidates ||= [];
  shaped.handoffRequests ||= [];
  shaped.validationCaseImports = sampleCaseImports;
  shaped.validationRecords ||= [];
  shaped.validationRecords = shaped.validationRecords.map(normalizeValidationRecordShape);
  shaped.validationImportStatus ||= null;
  shaped.validationExportStatus ||= null;
  shaped.validationExportPackage ||= null;
  const situationSeed = createInitialSituationRoomState(shaped.activeCaseId || shaped.cases?.[0]?.id);
  shaped.situationRooms ||= situationSeed.situationRooms;
  shaped.activeSituationRoomId ||= situationSeed.activeSituationRoomId;
  shaped.roomMessages ||= situationSeed.roomMessages;
  shaped.workOrders ||= [];
  shaped.situationCards ||= [];
  shaped.approvalRequests ||= [];
  shaped.situationSourceEvents ||= situationSeed.situationSourceEvents;
  shaped.selectedSituationCardId ||= null;
  shaped.expandedSituationAgentId ||= null;
  shaped.situationDemoConductor ||= situationSeed.situationDemoConductor;
  shaped.situationDemoReport ||= null;
  shaped.activeSituationPack ||= situationSeed.activeSituationPack;
  shaped.situationLastAction ||= null;
  shaped.situationEventLog ||= situationSeed.situationEventLog;
  shaped.situationSessionId ||= "session_local_demo";
  shaped.situationScenarioWeek ||= 1;
  shaped.situationSnapshotStatus ||= null;
  shaped.situationSnapshotExport ||= null;
  shaped.agentRuns ||= [];
  shaped.recommendations ||= [];
  shaped.reviewDecisions ||= [];
  shaped.auditEvents ||= [];
  shaped.cases ||= [];
  shaped.cases = shaped.cases.map(normalizeCaseRecordShape);
  shaped.agents = agentBacklog;
  return shaped;
}

function normalizeValidationRecordShape(record) {
  const fixtureLike =
    FIXTURE_SAMPLE_CASE_IDS.has(record.sampleCaseId) ||
    String(record.runId || "").endsWith("_phase2_fixture");

  return {
    ...record,
    caseSource: normalizeCaseSource(record.caseSource || (fixtureLike ? "phase2_fixture" : "manual_anonymized_packet")),
    baseline: record.baseline
      ? {
          ...record.baseline,
          humanMissingItemIdsCaptured: record.baseline.humanMissingItemIdsCaptured === true
        }
      : record.baseline,
    reviewerRating: {
      ...(record.reviewerRating || {}),
      ratingSource: record.reviewerRating?.ratingSource || (fixtureLike ? "fixture_seed" : "human_capture")
    }
  };
}

function normalizeCaseRecordShape(caseRecord) {
  if (!caseRecord?.validation) return caseRecord;
  const fixtureLike = FIXTURE_SAMPLE_CASE_IDS.has(caseRecord.validation.sampleCaseId);
  return {
    ...caseRecord,
    validation: {
      ...caseRecord.validation,
      caseSource: normalizeCaseSource(caseRecord.validation.caseSource || (fixtureLike ? "phase2_fixture" : caseRecord.sourceSystem)),
      baseline: caseRecord.validation.baseline
        ? {
            ...caseRecord.validation.baseline,
            humanMissingItemIdsCaptured: caseRecord.validation.baseline.humanMissingItemIdsCaptured === true
          }
        : caseRecord.validation.baseline
    }
  };
}
