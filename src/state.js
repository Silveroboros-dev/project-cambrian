import { agentBacklog } from "./agent.js";
import { createInitialStore } from "./demoData.js";

const STORAGE_KEY = "agentops-core-store-v1";

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
  shaped.agentRuns ||= [];
  shaped.recommendations ||= [];
  shaped.reviewDecisions ||= [];
  shaped.auditEvents ||= [];
  shaped.cases ||= [];
  shaped.agents = agentBacklog;
  return shaped;
}
