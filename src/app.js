import { runTreuhandAgent } from "./agent.js";
import {
  CONTROL_AGENT_CODES,
  mergeById,
  normalizeContextPacketTaint,
  runAuthorizationAgent,
  runCadenceAgent,
  runDataIngestionAgent,
  runGapAnalyst,
  runSecurityAgent
} from "./controlAgents.js";
import { activeCase, addAuditEvent, loadStore, resetStore, saveStore } from "./state.js";
import {
  FAILURE_TAGS,
  buildOperatingMemo,
  createValidationPackage,
  createValidationRecord,
  getCaseChecklist,
  normalizeHumanMissingBaselineCapture,
  normalizeCaseImport,
  parseCaseImportJson,
  runValidationSample,
  summarizeProofCategories,
  validateValidationPackagePrivacy,
  validateCaseImport
} from "./validation.js";
import {
  AGENT_TAGS,
  SITUATION_ARTIFACT_PACKS,
  SITUATION_ROOM_SCENARIOS,
  appendAgentNextStepProposal,
  appendTreuhandReviewNextStepProposal,
  buildSituationDemoReadinessReport,
  buildSituationTraceChain,
  exportSituationDemoSnapshot,
  importSituationDemoSnapshot,
  postSituationMessage,
  resolveAllDemoSafeApprovals,
  resolveSituationApproval,
  runSituationDemoAct,
  runWeekTwoContinuityScenario,
  selectAgentNextStep,
  selectFirstPendingNextStep,
  setSituationArtifactPack,
  summarizeSituationMetrics,
  summarizeSituationAgentParticipation
} from "./situationRoom.js";

let store = loadStore();

const views = {
  workspace: document.querySelector("#workspace-view"),
  situation: document.querySelector("#situation-view"),
  context: document.querySelector("#context-view"),
  controls: document.querySelector("#controls-view"),
  validation: document.querySelector("#validation-view"),
  agents: document.querySelector("#agents-view"),
  review: document.querySelector("#review-view"),
  metrics: document.querySelector("#metrics-view")
};

document.querySelectorAll(".rail-button").forEach((button) => {
  button.addEventListener("click", () => {
    setView(button.dataset.view);
  });
});

function setView(viewName) {
  document.querySelectorAll(".rail-button").forEach((button) => {
    button.classList.toggle("is-active", button.dataset.view === viewName);
  });

  Object.entries(views).forEach(([name, element]) => {
    element.classList.toggle("is-active", name === viewName);
  });
}

function render() {
  reconcileHarnessState();
  renderWorkspace();
  renderSituationRoom();
  renderContext();
  renderControls();
  renderValidation();
  renderAgents();
  renderReview();
  renderMetrics();
  saveStore(store);
}

function reconcileHarnessState() {
  const caseRecord = activeCase(store);
  if (!caseRecord) return;

  const contextPackets = store.contextPackets.filter((packet) => packet.caseId === caseRecord.id);
  const ingestion = runDataIngestionAgent(caseRecord, contextPackets);
  store.contextPackets = mergeById(store.contextPackets, ingestion.contextPackets);
  store.contextPackets = store.contextPackets.map(normalizeContextPacketTaint);
  store.controlAgentOutputs = mergeById(store.controlAgentOutputs, ingestion.controlAgentOutputs);

  const latestRun = latestRunForCase(caseRecord.id);
  const refreshedPackets = store.contextPackets.filter((packet) => packet.caseId === caseRecord.id);
  const security = runSecurityAgent({
    caseRecord,
    contextPackets: refreshedPackets,
    agentRun: latestRun,
    memoryCandidates: store.memoryCandidates.filter((candidate) => candidate.caseId === caseRecord.id)
  });
  store.securityFindings = mergeById(store.securityFindings, security.securityFindings);
  store.controlAgentOutputs = mergeById(store.controlAgentOutputs, security.controlAgentOutputs);

  const pendingRecommendations = store.recommendations.filter(
    (item) => item.caseId === caseRecord.id && item.reviewStatus === "pending"
  );
  const cadence = runCadenceAgent({ caseRecord, pendingRecommendations });
  store.cadenceNudges = [
    ...store.cadenceNudges.filter((nudge) => nudge.caseId !== caseRecord.id),
    ...cadence.cadenceNudges
  ];
  store.controlAgentOutputs = mergeById(store.controlAgentOutputs, cadence.controlAgentOutputs);
}

function renderWorkspace() {
  const caseRecord = activeCase(store);
  const latestRun = latestRunForCase(caseRecord.id);
  const auditEvents = store.auditEvents.filter((event) => event.caseId === caseRecord.id);

  views.workspace.innerHTML = `
    <div class="panel-header">
      <div>
        <p class="eyebrow">Case workspace</p>
        <h2>${escapeHtml(caseRecord.title)}</h2>
      </div>
      <div class="button-row">
        <button class="icon-button" id="reset-demo" title="Reset demo data">Reset</button>
        <button class="primary-button" id="run-agent" title="Run A-TREU-001">&gt; Run agent</button>
      </div>
    </div>

    <div class="summary-grid">
      ${metricTile("Status", caseRecord.status)}
      ${metricTile("Evidence", String(caseRecord.evidence.length))}
      ${metricTile("Period", caseRecord.period)}
      ${metricTile("Owner", caseRecord.owner)}
    </div>

    <div class="split">
      <section class="subpanel">
        <div class="subpanel-heading">
          <h3>Evidence</h3>
          <span>${caseRecord.evidence.length} items</span>
        </div>
        <form id="evidence-form" class="evidence-form">
          <div class="form-row">
            <label>
              Type
              <select name="type">
                <option value="document">Document</option>
                <option value="email">Email</option>
                <option value="note">Note</option>
              </select>
            </label>
            <label>
              Title
              <input name="title" placeholder="VAT report March 2026" required />
            </label>
          </div>
          <label>
            Evidence text
            <textarea name="content" rows="5" placeholder="Paste anonymized document/email text..." required></textarea>
          </label>
          <button type="submit" class="secondary-button" title="Add evidence">+ Evidence</button>
        </form>
        <div class="evidence-list">
          ${caseRecord.evidence.map(renderEvidenceItem).join("")}
        </div>
      </section>

      <section class="subpanel">
        <div class="subpanel-heading">
          <h3>Latest run</h3>
          <span>${latestRun ? latestRun.status : "not run"}</span>
        </div>
        ${latestRun ? renderRun(latestRun) : emptyState("Run the agent to create a checklist, draft email, review pack, and audit trail.")}
      </section>
    </div>

    <section class="subpanel audit-panel">
      <div class="subpanel-heading">
        <h3>Audit trail</h3>
        <span>${auditEvents.length} events</span>
      </div>
      <div class="audit-list">
        ${auditEvents.map(renderAuditEvent).join("")}
      </div>
    </section>
  `;

  document.querySelector("#run-agent").addEventListener("click", handleRunAgent);
  document.querySelector("#reset-demo").addEventListener("click", () => {
    store = resetStore();
    render();
  });
  document.querySelector("#evidence-form").addEventListener("submit", handleEvidenceSubmit);
}

function renderSituationRoom() {
  const rooms = store.situationRooms || [];
  const activeRoom = rooms.find((room) => room.id === store.activeSituationRoomId) || rooms[0];
  const roomId = activeRoom?.id;
  const roomCards = store.situationCards.filter((card) => card.roomId === roomId);
  const roomMessages = store.roomMessages.filter((message) => message.roomId === roomId);
  const roomWorkOrders = store.workOrders.filter((workOrder) => workOrder.roomId === roomId);
  const roomApprovals = store.approvalRequests.filter((approval) => approval.roomId === roomId);
  const roomSourceEvents = (store.situationSourceEvents || []).filter((event) => event.roomId === roomId);
  const roomNextSteps = store.situationCards.filter((card) => card.roomId === roomId && card.type === "agent_next_step_proposal");
  const roomFollowThroughs = (store.situationFollowThroughs || []).filter((item) => item.roomId === roomId);
  const roomLogs = (store.situationEventLog || []).filter((log) => log.roomId === roomId);
  const allPendingApprovals = store.approvalRequests.filter((approval) => approval.status === "pending");
  const allPendingNextSteps = store.situationCards.filter((card) => card.type === "agent_next_step_proposal" && card.status === "pending");
  const agentParticipation = summarizeSituationAgentParticipation(store);
  const expandedAgent = agentParticipation.find((agent) => agent.agentId === store.expandedSituationAgentId);
  const conductor = store.situationDemoConductor || {};
  const situationMetrics = summarizeSituationMetrics(store);
  const activeTraceChain = buildSituationTraceChain(store, store.situationLastAction || conductor.lastAct || {});
  const readinessReport = buildSituationDemoReadinessReport(store);
  const demoFocus = deriveDemoFocus({ conductor, lastAction: store.situationLastAction, traceChain: activeTraceChain });
  const focusTargets = new Set(demoFocus.targets || []);
  const activePack = store.activeSituationPack || "cards";
  const chatMessages = [...roomMessages].sort((a, b) => new Date(a.createdAt || 0) - new Date(b.createdAt || 0));

  views.situation.innerHTML = `
    <div class="panel-header">
      <div>
        <p class="eyebrow">Situation Room</p>
        <h2>${escapeHtml(activeRoom?.title || "Local operating room")}</h2>
      </div>
      <div class="button-row">
        <button class="primary-button" id="reset-situation-demo-state" title="Reset local state before running the demo acts">Reset demo state</button>
        <span class="status-pill">run numbered acts below</span>
      </div>
    </div>
    <div class="summary-grid metric-grid">
      ${metricTile("Rooms", String(rooms.length))}
      ${metricTile("Messages", String(situationMetrics.messages))}
      ${metricTile("Cards", String(situationMetrics.cards))}
      ${metricTile("Work orders", String(situationMetrics.workOrders))}
      ${metricTile("Reviewed gates", String(situationMetrics.reviewedApprovals))}
      ${metricTile("Next steps", String(situationMetrics.pendingNextSteps))}
      ${metricTile("Follow-throughs", String(situationMetrics.selectedFollowThroughs))}
      ${metricTile("Local logs", String(situationMetrics.logs))}
    </div>

    <div class="split situation-overview">
      <section class="subpanel demo-guide-panel">
        <div class="subpanel-heading">
          <h3>Demo guide</h3>
          <span>4-6 minutes</span>
        </div>
        <ol class="demo-steps">
          <li>State the boundary: local synthetic Situation Room, no external services.</li>
          <li>Reset demo state, then run the numbered acts one by one.</li>
          <li>Inspect typed cards, work orders, and pending approvals.</li>
          <li>Approve or reject one local gate.</li>
          <li>Open Validation.</li>
          <li>Show memo, export rules, metrics separation.</li>
          <li>Ask for 3-5 anonymized Treuhand cases.</li>
        </ol>
        ${renderDemoConductorProgress(conductor)}
        ${renderSituationDemoReadinessReport(readinessReport, focusTargets)}
      </section>

      <section class="subpanel agent-status-panel">
        <div class="subpanel-heading">
          <h3>Active agents</h3>
          <span>six built agents</span>
        </div>
        <div class="agent-status-grid">
          ${agentParticipation.map((agent) => renderSituationAgentStatus(agent, store.expandedSituationAgentId)).join("")}
        </div>
        ${expandedAgent ? renderSituationAgentOverlay(expandedAgent) : ""}
      </section>
    </div>

    <div class="situation-layout">
      <aside class="subpanel room-list-panel">
        <div class="subpanel-heading">
          <h3>Rooms</h3>
          <span>${rooms.length}</span>
        </div>
        <div class="room-list">
          ${rooms.map((room) => renderRoomButton(room, activeRoom)).join("")}
        </div>
      </aside>

      <section class="subpanel situation-main ${focusTargets.has("demo_conductor") ? "demo-focus-target" : ""}">
        <div class="subpanel-heading">
          <h3>Demo conductor</h3>
          <span>${escapeHtml(conductor.completedActIds?.length || 0)}/${SITUATION_ROOM_SCENARIOS.length} acts complete</span>
        </div>
        <div class="demo-act-grid">
          ${SITUATION_ROOM_SCENARIOS.map((scenario, index) => renderScenarioButton(scenario, index, conductor)).join("")}
        </div>
        ${renderDemoFocus(demoFocus)}
        ${renderDemoActResult(conductor.lastAct, focusTargets)}
        ${renderSituationTraceChain(activeTraceChain, focusTargets)}
        <form id="situation-message-form" class="validation-form situation-input">
          <label>
            Manual agent tag (optional)
            <input name="situationMessage" placeholder="@treu run intake review" required />
          </label>
          <button type="submit" class="secondary-button" title="Create optional manual work order">Create manual work order</button>
        </form>
        <div class="mini-meta">
          <span>tags: ${escapeHtml(Object.keys(AGENT_TAGS).join(", "))}</span>
          <span>logs: localStorage key ${escapeHtml(situationMetrics.localStorageKey)} / situationEventLog</span>
        </div>
        ${store.situationLastAction ? renderSituationLastAction(store.situationLastAction) : ""}

        <div class="room-chat-panel">
          <div class="subpanel-heading compact-heading">
            <h3>Room chat</h3>
            <span>${chatMessages.length} retained</span>
          </div>
          <div class="room-chat-feed">
            ${chatMessages.length === 0 ? emptyState("No chat messages in this room yet.") : chatMessages.map(renderRoomChatMessage).join("")}
          </div>
        </div>

        <div class="artifact-pack-panel ${focusTargets.has("artifact_packs") ? "demo-focus-target" : ""}">
          <div class="subpanel-heading compact-heading">
            <h3>Artifact packs</h3>
            <span>${escapeHtml(activePack)}</span>
          </div>
          <div class="button-row pack-buttons">
            ${SITUATION_ARTIFACT_PACKS.map((pack) => renderPackButton(pack, activePack)).join("")}
          </div>
          <div class="packed-artifact-list">
            ${renderSituationArtifactPack(activePack, { roomCards, roomWorkOrders, roomApprovals, roomSourceEvents, roomNextSteps, roomFollowThroughs, roomLogs })}
          </div>
        </div>

        <div class="snapshot-panel">
          <div class="subpanel-heading compact-heading">
            <h3>Demo persistence</h3>
            <span>local snapshot</span>
          </div>
          ${renderSituationSnapshotPanel()}
        </div>
      </section>

      <aside class="subpanel situation-side">
        <div class="subpanel-heading ${focusTargets.has("next_steps") ? "demo-focus-heading" : ""}">
          <h3>Pending next steps</h3>
          <span>${roomNextSteps.filter((card) => card.status === "pending").length}</span>
        </div>
        ${
          allPendingNextSteps.length > 0
            ? `<button class="secondary-button full-width-button" id="select-first-next-step-local" title="Select one pending next step across rooms locally for demo flow">Select first pending next step across rooms locally</button>`
            : ""
        }
        <div class="artifact-list compact-list">
          ${roomNextSteps.length === 0 ? emptyState("No responsible-agent next-step proposals in this room.") : roomNextSteps.map(renderNextStepProposal).join("")}
        </div>
        <div class="subpanel-heading stacked-heading ${focusTargets.has("follow_through") ? "demo-focus-heading" : ""}">
          <h3>Selected follow-through</h3>
          <span>${roomFollowThroughs.length}</span>
        </div>
        <div class="artifact-list compact-list">
          ${roomFollowThroughs.length === 0 ? emptyState("No local follow-through recorded in this room.") : roomFollowThroughs.map(renderFollowThroughRecord).join("")}
        </div>
        <div class="subpanel-heading stacked-heading ${focusTargets.has("approvals") ? "demo-focus-heading" : ""}">
          <h3>Pending approvals</h3>
          <span>${roomApprovals.length}</span>
        </div>
        ${
          allPendingApprovals.length > 0
            ? `<button class="secondary-button full-width-button" id="approve-all-demo-approvals" title="Record local approvals for demo-safe approval gates across rooms">Approve all demo-safe approvals across rooms</button>`
            : ""
        }
        <div class="artifact-list compact-list">
          ${roomApprovals.length === 0 ? emptyState("No approval requests in this room.") : roomApprovals.map(renderSituationApproval).join("")}
        </div>
        <div class="subpanel-heading stacked-heading">
          <h3>Work orders</h3>
          <span>${roomWorkOrders.length}</span>
        </div>
        <div class="artifact-list compact-list">
          ${roomWorkOrders.length === 0 ? emptyState("Tag an agent or run a scenario to create work orders.") : roomWorkOrders.map(renderSituationWorkOrder).join("")}
        </div>
      </aside>
    </div>
  `;

  document.querySelector("#reset-situation-demo-state").addEventListener("click", handleResetSituationDemoState);
  const approveAll = document.querySelector("#approve-all-demo-approvals");
  if (approveAll) approveAll.addEventListener("click", handleApproveAllDemoApprovals);
  const selectFirstNextStep = document.querySelector("#select-first-next-step-local");
  if (selectFirstNextStep) selectFirstNextStep.addEventListener("click", handleSelectFirstNextStep);
  document.querySelectorAll("[data-situation-agent-id]").forEach((button) => {
    button.addEventListener("click", () => handleSituationAgentToggle(button.dataset.situationAgentId));
  });
  const closeAgentOverlay = document.querySelector("#close-situation-agent-overlay");
  if (closeAgentOverlay) closeAgentOverlay.addEventListener("click", handleSituationAgentOverlayClose);
  document.querySelectorAll("[data-situation-room-id]").forEach((button) => {
    button.addEventListener("click", () => {
      store.activeSituationRoomId = button.dataset.situationRoomId;
      render();
    });
  });
  document.querySelectorAll("[data-situation-scenario-id]").forEach((button) => {
    button.addEventListener("click", () => handleSituationScenario(button.dataset.situationScenarioId));
  });
  const situationForm = document.querySelector("#situation-message-form");
  if (situationForm) situationForm.addEventListener("submit", handleSituationMessageSubmit);
  const snapshotExport = document.querySelector("#export-situation-snapshot");
  if (snapshotExport) snapshotExport.addEventListener("click", handleExportSituationSnapshot);
  const weekTwo = document.querySelector("#advance-week-two-demo");
  if (weekTwo) weekTwo.addEventListener("click", handleAdvanceWeekTwoDemo);
  const snapshotImportForm = document.querySelector("#situation-snapshot-import-form");
  if (snapshotImportForm) snapshotImportForm.addEventListener("submit", handleImportSituationSnapshot);
  document.querySelectorAll("[data-situation-pack-id]").forEach((button) => {
    button.addEventListener("click", () => {
      setSituationArtifactPack(store, button.dataset.situationPackId);
      render();
    });
  });
  document.querySelectorAll("[data-situation-approval-id]").forEach((button) => {
    button.addEventListener("click", () => handleSituationApproval(button.dataset.situationApprovalId, button.dataset.situationApprovalDecision));
  });
  document.querySelectorAll("[data-next-step-proposal-id]").forEach((button) => {
    button.addEventListener("click", () => handleSelectNextStep(button.dataset.nextStepProposalId, button.dataset.nextStepChoiceId));
  });
}

function renderContext() {
  const caseRecord = activeCase(store);
  const packets = store.contextPackets.filter((packet) => packet.caseId === caseRecord.id);

  views.context.innerHTML = `
    <div class="panel-header">
      <div>
        <p class="eyebrow">Context packets</p>
        <h2>Normalized input layer</h2>
      </div>
      <span class="status-pill">${packets.length} packets for ${escapeHtml(caseRecord.id)}</span>
    </div>
    <div class="summary-grid">
      ${metricTile("Case ID", caseRecord.id)}
      ${metricTile("Packets", String(packets.length))}
      ${metricTile("Source", caseRecord.sourceSystem || "manual")}
      ${metricTile("Boundary", "facts only")}
    </div>
    <div class="artifact-list">
      ${
        packets.length === 0
          ? emptyState("No context packets for this case. Add evidence to trigger A-INGEST-001.")
          : packets.map(renderContextPacket).join("")
      }
    </div>
  `;
}

function renderControls() {
  const caseRecord = activeCase(store);
  const outputs = store.controlAgentOutputs.filter((item) => item.caseId === caseRecord.id);
  const auth = store.authorizationDecisions.filter((item) => item.caseId === caseRecord.id);
  const security = store.securityFindings.filter((item) => item.caseId === caseRecord.id);
  const gaps = store.gapFindings.filter((item) => item.caseId === caseRecord.id);
  const nudges = store.cadenceNudges.filter((item) => item.caseId === caseRecord.id);
  const handoffs = store.handoffRequests.filter((item) => item.caseId === caseRecord.id);
  const memory = store.memoryCandidates.filter((item) => item.caseId === caseRecord.id);

  views.controls.innerHTML = `
    <div class="panel-header">
      <div>
        <p class="eyebrow">Controls</p>
        <h2>Day-one harness agents</h2>
      </div>
      <span class="status-pill">Scoped to ${escapeHtml(caseRecord.id)}</span>
    </div>
    <div class="control-grid">
      ${CONTROL_AGENT_CODES.map((code) => renderControlAgentTile(code, outputs)).join("")}
    </div>
    <div class="split controls-split">
      ${renderControlSection("Authorization decisions", auth, renderAuthorizationDecision)}
      ${renderControlSection("Security findings", security, renderSecurityFinding)}
    </div>
    <div class="split controls-split">
      ${renderControlSection("Gap findings", gaps, renderGapFinding)}
      ${renderControlSection("Cadence nudges", nudges, renderCadenceNudge)}
    </div>
    <div class="split controls-split">
      ${renderControlSection("Handoff requests", handoffs, renderHandoffRequest)}
      ${renderControlSection("Memory candidates", memory, renderMemoryCandidate)}
    </div>
    <section class="subpanel audit-panel">
      <div class="subpanel-heading">
        <h3>Historical control output trace</h3>
        <span>${outputs.length} records</span>
      </div>
      <div class="artifact-list compact-list">
        ${
          outputs.length === 0
            ? emptyState("No control-agent outputs for this case.")
            : outputs.map(renderControlOutput).join("")
        }
      </div>
    </section>
  `;
}

function renderValidation() {
  const caseRecord = activeCase(store);
  const latestRun = latestRunForCase(caseRecord.id);
  const validationRecords = store.validationRecords.filter((item) => item.caseId === caseRecord.id);
  const latestRecord = latestValidationRecordForCase(caseRecord.id);
  const baseline = latestRecord?.baseline || caseRecord.validation?.baseline || {};
  const checklist = getCaseChecklist(caseRecord);
  const exportReady = Boolean(store.validationExportPackage?.caseId === caseRecord.id);
  const memo = latestRun
    ? buildOperatingMemo({
        caseRecord,
        run: latestRun,
        validationRecord:
          latestRecord ||
          createValidationRecord({
            caseRecord,
            run: latestRun,
            reviewerRating: caseRecord.validation?.reviewerRating || {},
            baseline,
            traceNote: caseRecord.validation?.traceAnnotations?.[0]?.note || "No trace annotation captured yet."
          })
      })
    : null;

  views.validation.innerHTML = `
    <div class="panel-header">
      <div>
        <p class="eyebrow">Phase 2 validation</p>
        <h2>Treuhand operating proof kit</h2>
      </div>
      <div class="button-row">
        <button class="secondary-button" id="run-all-validation-samples" title="Run all bundled anonymized samples">Run all samples</button>
      </div>
    </div>

    <div class="summary-grid metric-grid">
      ${metricTile("Sample imports", String(store.validationCaseImports.length))}
      ${metricTile("Validation records", String(store.validationRecords.length))}
      ${metricTile("Active case", caseRecord.id)}
      ${metricTile("Rating source", latestRecord?.reviewerRating?.ratingSource || "none")}
      ${metricTile("Case source", latestRecord?.caseSource || caseRecord.validation?.caseSource || caseRecord.sourceSystem || "manual")}
    </div>

    <section class="subpanel">
      <div class="subpanel-heading">
        <h3>Paste anonymized case JSON</h3>
        <span>local import</span>
      </div>
      ${renderValidationImportPanel()}
    </section>

    <div class="split validation-split">
      <section class="subpanel">
        <div class="subpanel-heading">
          <h3>Anonymized case imports</h3>
          <span>${store.validationCaseImports.length} fixtures</span>
        </div>
        <div class="artifact-list compact-list">
          ${store.validationCaseImports.map(renderSampleImport).join("")}
        </div>
      </section>

      <section class="subpanel">
        <div class="subpanel-heading">
          <h3>Active validation case</h3>
          <span>${caseRecord.validation ? "Phase 2 import" : "demo case"}</span>
        </div>
        <div class="summary-grid two-col-grid">
          ${metricTile("Baseline minutes", baseline.manualPrepMinutes ?? "n/a")}
          ${metricTile("Manual handoffs", baseline.manualHandoffCount ?? "n/a")}
          ${metricTile("Missing baseline", baseline.humanMissingItemIdsCaptured ? "confirmed" : "not captured")}
        </div>
        <h4>Configured checklist</h4>
        <div class="artifact-list compact-list">
          ${checklist.map(renderChecklistConfigItem).join("")}
        </div>
      </section>
    </div>

    <div class="split validation-split">
      <section class="subpanel">
        <div class="subpanel-heading">
          <h3>Reviewer capture</h3>
          <span>${latestRecord ? latestRecord.validationRecordId : "not captured"}</span>
        </div>
        ${latestRun ? renderValidationCaptureForm(caseRecord, latestRun, latestRecord) : emptyState("Run the active case before capturing reviewer rating and trace annotation.")}
      </section>

      <section class="subpanel">
        <div class="subpanel-heading">
          <h3>Before/after operating memo</h3>
          <span>${memo ? "generated locally" : "needs run"}</span>
        </div>
        ${memo ? `<pre class="memo-output">${escapeHtml(memo)}</pre>` : emptyState("Load a sample case and run the agent to generate the operating memo.")}
      </section>
    </div>

    <section class="subpanel">
      <div class="subpanel-heading">
        <h3>Validation package export</h3>
        <span>${exportReady ? "ready" : "not built"}</span>
      </div>
      ${renderValidationExportPanel(caseRecord, latestRun, latestRecord)}
    </section>
  `;

  document.querySelector("#run-all-validation-samples").addEventListener("click", handleRunAllValidationSamples);
  document.querySelector("#validation-import-form").addEventListener("submit", handleValidationImportSubmit);
  document.querySelector("#build-validation-export").addEventListener("click", handleBuildValidationExport);
  const clearExport = document.querySelector("#clear-validation-export");
  if (clearExport) {
    clearExport.addEventListener("click", handleClearValidationExport);
  }
  document.querySelectorAll("[data-load-sample]").forEach((button) => {
    button.addEventListener("click", () => handleLoadSample(button.dataset.sampleCaseId));
  });
  const validationForm = document.querySelector("#validation-form");
  if (validationForm) {
    validationForm.addEventListener("submit", handleValidationSubmit);
  }
}

function renderAgents() {
  views.agents.innerHTML = `
    <div class="panel-header">
      <div>
        <p class="eyebrow">Agent log</p>
        <h2>Backlog seeded from the thesis</h2>
      </div>
    </div>
    <div class="table-shell">
      <table>
        <thead>
          <tr>
            <th>Code</th>
            <th>Agent</th>
            <th>Vertical</th>
            <th>Priority</th>
            <th>RICE</th>
            <th>Status</th>
            <th>Boundary</th>
          </tr>
        </thead>
        <tbody>
          ${store.agents
            .map(
              (agent) => `
                <tr>
                  <td><strong>${agent.code}</strong></td>
                  <td>${escapeHtml(agent.name)}</td>
                  <td>${escapeHtml(agent.vertical)}</td>
                  <td>${agent.priority}</td>
                  <td>${agent.rice}</td>
                  <td><span class="tag">${agent.status}</span></td>
                  <td>${agent.humanApprovalRequired ? "Human approval" : "Low-risk automation"}</td>
                </tr>
              `
            )
            .join("")}
        </tbody>
      </table>
    </div>
  `;
}

function renderReview() {
  const pending = store.recommendations.filter((item) => item.reviewStatus === "pending");
  const decided = store.reviewDecisions;

  views.review.innerHTML = `
    <div class="panel-header">
      <div>
        <p class="eyebrow">Human review queue</p>
        <h2>${pending.length} pending recommendation${pending.length === 1 ? "" : "s"}</h2>
      </div>
    </div>
    <div class="review-stack">
      ${
        pending.length === 0
          ? emptyState("No pending recommendation. Run the agent from the case workspace.")
          : pending.map(renderRecommendation).join("")
      }
    </div>
    <section class="subpanel">
      <div class="subpanel-heading">
        <h3>Review history</h3>
        <span>${decided.length} decisions</span>
      </div>
      <div class="audit-list">
        ${
          decided.length === 0
            ? emptyState("Review decisions will appear here.")
            : decided
                .map(
                  (decision) => `
                    <article class="audit-event">
                      <strong>${decision.decision}</strong>
                      <span>${escapeHtml(decision.comment || "No comment")}</span>
                      <time>${formatTime(decision.createdAt)}</time>
                    </article>
                  `
                )
                .join("")
        }
      </div>
    </section>
  `;

  document.querySelectorAll("[data-review-action]").forEach((button) => {
    button.addEventListener("click", () => handleReview(button.dataset.recommendationId, button.dataset.reviewAction));
  });
}

function renderMetrics() {
  const reviewedCaseIds = new Set(store.reviewDecisions.map((decision) => decision.caseId));
  const completedRuns = store.agentRuns.filter((run) => reviewedCaseIds.has(run.caseId));
  const allRuns = store.agentRuns;
  const avgMinutesSaved = average(completedRuns.map((run) => run.output.metrics.estimated_minutes_saved));
  const avgEvidenceCoverage = average(allRuns.map((run) => run.output.metrics.evidence_coverage));
  const overrideRate = calculateOverrideRate(store.reviewDecisions);
  const proof = summarizeProofCategories(store.validationRecords);
  const humanRecords = proof.humanCaptureRecords;
  const fixtureRecords = proof.fixtureSeedRecords;
  const realReviewerRecords = proof.realAnonymizedReviewerRecords;
  const avgReviewerSaved = average(realReviewerRecords.map((record) => record.metrics.reviewerEstimatedMinutesSaved));
  const wouldUseAgainRate = calculateWouldUseAgainRate(realReviewerRecords);
  const avgHumanMissingRecall = average(realReviewerRecords.map((record) => record.metrics.missingItemRecall));
  const avgFixtureMissingRecall = average(fixtureRecords.map((record) => record.metrics.missingItemRecall));
  const situationMetrics = summarizeSituationMetrics(store);

  views.metrics.innerHTML = `
    <div class="panel-header">
      <div>
        <p class="eyebrow">Metrics</p>
        <h2>Operating proof dashboard</h2>
      </div>
    </div>
    <div class="summary-grid metric-grid">
      ${metricTile("Real reviewer cases", String(realReviewerRecords.length))}
      ${metricTile("Real reviewer saved", avgReviewerSaved === null ? "n/a" : `${avgReviewerSaved} min`)}
      ${metricTile("Real missing recall", avgHumanMissingRecall === null ? "n/a" : `${avgHumanMissingRecall}%`)}
      ${metricTile("Real would use again", wouldUseAgainRate === null ? "n/a" : `${wouldUseAgainRate}%`)}
    </div>
    <div class="summary-grid metric-grid">
      ${metricTile("Human captures", String(humanRecords.length))}
      ${metricTile("Human-reviewed fixtures", String(proof.counts.humanReviewedFixture))}
      ${metricTile("Manual packet captures", String(proof.counts.manualAnonymizedHuman))}
      ${metricTile("Fixture seed records", String(fixtureRecords.length))}
    </div>
    <div class="summary-grid metric-grid">
      ${metricTile("Fixture missing recall", avgFixtureMissingRecall === null ? "n/a" : `${avgFixtureMissingRecall}%`)}
      ${metricTile("Traceability coverage", avgEvidenceCoverage === null ? "n/a" : `${avgEvidenceCoverage}%`)}
      ${metricTile("Total failure tags", String(store.validationRecords.flatMap((record) => record.failureTagIds).length))}
      ${metricTile("Reviewed cases", String(reviewedCaseIds.size))}
    </div>
    <div class="summary-grid metric-grid">
      ${metricTile("Agent saved", avgMinutesSaved === null ? "n/a" : `${avgMinutesSaved} min`)}
      ${metricTile("Override rate", overrideRate === null ? "n/a" : `${overrideRate}%`)}
      ${metricTile("Validation records", String(store.validationRecords.length))}
    </div>
    <section class="subpanel">
      <div class="subpanel-heading">
        <h3>Situation Room metrics</h3>
        <span>live local state</span>
      </div>
      <div class="summary-grid metric-grid">
        ${metricTile("Room messages", String(situationMetrics.messages))}
        ${metricTile("Situation cards", String(situationMetrics.cards))}
        ${metricTile("Work orders", String(situationMetrics.workOrders))}
        ${metricTile("Pending approvals", String(situationMetrics.pendingApprovals))}
        ${metricTile("Reviewed gates", String(situationMetrics.reviewedApprovals))}
        ${metricTile("Review actions", String(situationMetrics.reviewActions))}
        ${metricTile("Pending next steps", String(situationMetrics.pendingNextSteps))}
        ${metricTile("Follow-throughs", String(situationMetrics.selectedFollowThroughs))}
        ${metricTile("Blocked work", String(situationMetrics.blockedWork))}
        ${metricTile("Local logs", String(situationMetrics.logs))}
      </div>
      <p class="boundary-copy">Local state lives in browser localStorage key ${escapeHtml(situationMetrics.localStorageKey)} under situationEventLog, roomMessages, situationCards, workOrders, approvalRequests, situationSourceEvents, and situationFollowThroughs.</p>
      <p class="compact-copy">${escapeHtml(situationMetrics.lastAction)}</p>
    </section>
    <section class="subpanel">
      <div class="subpanel-heading">
        <h3>Validation standard</h3>
        <span>fail fast</span>
      </div>
      <ul class="plain-list">
        <li>Pass: reviewer trusts the checklist and saves time.</li>
        <li>Pass: all factual claims carry evidence IDs.</li>
        <li>Pass: draft emails always require human approval.</li>
        <li>Fail: output creates more review burden than manual intake.</li>
        <li>Fail: anonymized data cannot be obtained.</li>
      </ul>
    </section>
  `;
}

function handleEvidenceSubmit(event) {
  event.preventDefault();
  const formData = new FormData(event.currentTarget);
  const caseRecord = activeCase(store);
  const auth = runAuthorizationAgent({
    user: store.user,
    caseRecord,
    action: "add_evidence",
    targetType: "case",
    targetId: caseRecord.id
  });
  recordAuthorization(auth);
  if (auth.authorizationDecision.decision === "deny") {
    addAuditEvent(store, caseRecord.id, "authorization_denied", auth.authorizationDecision.reason);
    render();
    return;
  }

  const evidence = {
    id: `ev_${Date.now()}`,
    type: formData.get("type"),
    title: formData.get("title").trim(),
    content: formData.get("content").trim()
  };

  caseRecord.evidence.push(evidence);
  caseRecord.status = "needs_agent_run";
  caseRecord.updatedAt = new Date().toISOString();
  addAuditEvent(store, caseRecord.id, "evidence_uploaded", `Evidence added: ${evidence.title}.`);
  reconcileHarnessState();
  render();
}

function handleSituationScenario(scenarioId) {
  const result = runSituationDemoAct(store, scenarioId);
  addAuditEvent(store, activeCase(store).id, "situation_demo_act_clicked", result.actRecord.summary);
  render();
}

function handleResetSituationDemoState() {
  store = resetStore();
  store.situationLastAction = {
    status: "demo_state_reset",
    roomId: store.activeSituationRoomId,
    summary: "Demo state reset. Run the numbered conductor acts to create visible new agent work.",
    createdAt: new Date().toISOString()
  };
  addAuditEvent(store, activeCase(store).id, "situation_demo_state_reset", "Reset local Situation Room demo state.");
  render();
}

function handleSituationAgentToggle(agentId) {
  store.expandedSituationAgentId = store.expandedSituationAgentId === agentId ? null : agentId;
  render();
}

function handleSituationAgentOverlayClose() {
  store.expandedSituationAgentId = null;
  render();
}

function handleSituationMessageSubmit(event) {
  event.preventDefault();
  const formData = new FormData(event.currentTarget);
  const text = String(formData.get("situationMessage") || "").trim();
  if (!text) return;
  postSituationMessage(store, {
    roomId: store.activeSituationRoomId,
    text,
    actorId: store.user?.id || "human_reviewer"
  });
  render();
}

function handleSituationApproval(approvalId, decision) {
  resolveSituationApproval(store, approvalId, decision, store.user?.id || "human_reviewer");
  addAuditEvent(store, activeCase(store).id, "situation_approval_decision", `${approvalId} ${decision}.`);
  render();
}

function handleApproveAllDemoApprovals() {
  const resolved = resolveAllDemoSafeApprovals(store, store.user?.id || "human_reviewer");
  addAuditEvent(
    store,
    activeCase(store).id,
    "situation_demo_safe_approvals",
    `${resolved.length} local-only approval decision(s) recorded.`
  );
  render();
}

function handleSelectNextStep(proposalCardId, choiceId) {
  selectAgentNextStep(store, proposalCardId, choiceId, store.user?.id || "human_reviewer");
  addAuditEvent(store, activeCase(store).id, "situation_next_step_selected", `${proposalCardId} -> ${choiceId} recorded locally.`);
  render();
}

function handleSelectFirstNextStep() {
  const result = selectFirstPendingNextStep(store, store.user?.id || "human_reviewer");
  addAuditEvent(
    store,
    activeCase(store).id,
    "situation_demo_next_step_selected",
    result ? `${result.followThrough.id} recorded locally.` : "No pending next-step proposal available."
  );
  render();
}

function handleExportSituationSnapshot() {
  exportSituationDemoSnapshot(store, {
    sessionId: store.situationSessionId || "session_local_demo",
    scenarioWeek: store.situationScenarioWeek || 1
  });
  addAuditEvent(store, activeCase(store).id, "situation_snapshot_exported", "Built local Situation Room demo snapshot.");
  render();
}

function handleImportSituationSnapshot(event) {
  event.preventDefault();
  const formData = new FormData(event.currentTarget);
  const snapshotJson = String(formData.get("situationSnapshotJson") || "").trim();
  const result = importSituationDemoSnapshot(store, snapshotJson);

  if (!result.valid) {
    store.situationSnapshotStatus = {
      status: "error",
      message: "Snapshot was not loaded.",
      errors: result.errors,
      createdAt: new Date().toISOString()
    };
  } else {
    addAuditEvent(store, activeCase(store).id, "situation_snapshot_imported", `Loaded ${result.snapshot.snapshotId}.`);
  }
  render();
}

function handleAdvanceWeekTwoDemo() {
  const result = runWeekTwoContinuityScenario(store);
  addAuditEvent(
    store,
    activeCase(store).id,
    "situation_week_two_continuity",
    `Week ${result.scenarioWeek} continuity scenario created ${result.workOrder.id}.`
  );
  render();
}

function handleValidationImportSubmit(event) {
  event.preventDefault();
  const formData = new FormData(event.currentTarget);
  const importText = String(formData.get("caseImportJson") || "");
  const parsed = parseCaseImportJson(importText);

  if (!parsed.valid) {
    store.validationImportStatus = {
      status: "error",
      message: "Case import was not loaded.",
      errors: parsed.errors
    };
    render();
    return;
  }

  const caseRecord = normalizeCaseImport(parsed.record);
  clearCaseArtifacts(caseRecord.id);
  store.cases = [caseRecord, ...store.cases.filter((item) => item.id !== caseRecord.id)];
  store.activeCaseId = caseRecord.id;
  store.validationImportStatus = {
    status: "loaded",
    message: `${caseRecord.id} loaded as ${caseRecord.validation.caseSource}.`,
    errors: [],
    caseId: caseRecord.id
  };
  clearValidationExportState();
  addAuditEvent(store, caseRecord.id, "phase2_manual_case_imported", "Loaded anonymized case JSON locally.");
  reconcileHarnessState();
  render();
}

function handleLoadSample(sampleCaseId) {
  const sample = store.validationCaseImports.find((item) => item.sampleCaseId === sampleCaseId);
  if (!sample) return;

  const caseRecord = normalizeCaseImport(sample);
  clearCaseArtifacts(caseRecord.id);
  store.cases = [caseRecord, ...store.cases.filter((item) => item.id !== caseRecord.id)];
  store.activeCaseId = caseRecord.id;
  clearValidationExportState();
  addAuditEvent(store, caseRecord.id, "phase2_case_imported", `Loaded anonymized sample case ${sampleCaseId}.`);
  reconcileHarnessState();
  render();
}

function handleRunAllValidationSamples() {
  const results = store.validationCaseImports.map((sample) => runValidationSample(sample));

  for (const result of results) {
    clearCaseArtifacts(result.caseRecord.id);
    result.caseRecord.status = "needs_review";
    store.cases = [result.caseRecord, ...store.cases.filter((item) => item.id !== result.caseRecord.id)];
    store.agentRuns = [result.run, ...store.agentRuns.filter((item) => item.id !== result.run.id)];
    store.validationRecords = upsertById(store.validationRecords, [result.validationRecord]);

    for (const recommendation of result.output.recommendations) {
      store.recommendations.unshift({
        ...recommendation,
        caseId: result.caseRecord.id,
        runId: result.run.id,
        reviewStatus: "pending",
        draft: result.output.draft_outputs.email_draft
      });
    }

    addAuditEvent(
      store,
      result.caseRecord.id,
      "phase2_validation_sample_run",
      `${result.caseRecord.id} replayed with fixture_seed rating and operating memo.`
    );
  }

  if (results.length > 0) {
    store.activeCaseId = results[0].caseRecord.id;
  }
  clearValidationExportState();
  reconcileHarnessState();
  render();
}

function handleRunAgent() {
  const caseRecord = activeCase(store);
  const auth = runAuthorizationAgent({
    user: store.user,
    caseRecord,
    action: "run_agent",
    targetType: "case",
    targetId: caseRecord.id
  });
  recordAuthorization(auth);
  if (auth.authorizationDecision.decision === "deny") {
    addAuditEvent(store, caseRecord.id, "authorization_denied", auth.authorizationDecision.reason);
    render();
    return;
  }

  const output = runTreuhandAgent(caseRecord, getCaseChecklist(caseRecord));
  const run = {
    id: `run_${Date.now()}`,
    caseId: caseRecord.id,
    agentCode: output.agent_code,
    status: "succeeded",
    output,
    startedAt: output.audit.started_at,
    completedAt: output.audit.completed_at
  };

  store.agentRuns.unshift(run);
  clearValidationExportState();
  caseRecord.status = "needs_review";
  caseRecord.updatedAt = new Date().toISOString();

  for (const recommendation of output.recommendations) {
    store.recommendations.unshift({
      ...recommendation,
      caseId: caseRecord.id,
      runId: run.id,
      reviewStatus: "pending",
      draft: output.draft_outputs.email_draft
    });
  }

  addAuditEvent(store, caseRecord.id, "agent_run_completed", `${output.agent_code} completed with ${output.metrics.missing_items_count} missing items.`);
  const security = runSecurityAgent({
    caseRecord,
    contextPackets: store.contextPackets.filter((packet) => packet.caseId === caseRecord.id),
    agentRun: run
  });
  store.securityFindings = mergeById(store.securityFindings, security.securityFindings);
  store.controlAgentOutputs = mergeById(store.controlAgentOutputs, security.controlAgentOutputs);

  const gap = runGapAnalyst({ caseRecord, agentRun: run });
  store.gapFindings = mergeById(store.gapFindings, gap.gapFindings);
  store.handoffRequests = mergeById(store.handoffRequests, gap.handoffRequests);
  store.memoryCandidates = mergeById(store.memoryCandidates, gap.memoryCandidates);
  store.controlAgentOutputs = mergeById(store.controlAgentOutputs, gap.controlAgentOutputs);

  render();
}

function handleValidationSubmit(event) {
  event.preventDefault();
  const formData = new FormData(event.currentTarget);
  const caseRecord = activeCase(store);
  const latestRun = latestRunForCase(caseRecord.id);
  if (!latestRun) {
    addAuditEvent(store, caseRecord.id, "phase2_validation_missing_run", "Reviewer capture requires an agent run.");
    render();
    return;
  }

  const humanMissingBaseline = normalizeHumanMissingBaselineCapture({
    baselineState: formData.get("humanMissingBaselineState"),
    humanMissingItemIdsText: formData.get("humanMissingItemIds")
  });
  const baseline = {
    manualPrepMinutes: Number(formData.get("manualPrepMinutes")),
    manualHandoffCount: Number(formData.get("manualHandoffCount")),
    humanMissingItemIds: humanMissingBaseline.humanMissingItemIds,
    humanMissingItemIdsCaptured: humanMissingBaseline.humanMissingItemIdsCaptured
  };
  const reviewerRating = {
    ratingSource: "human_capture",
    overallUsefulness: Number(formData.get("overallUsefulness")),
    checklistTrust: Number(formData.get("checklistTrust")),
    evidenceTraceability: Number(formData.get("evidenceTraceability")),
    timeSavedMinutes: Number(formData.get("timeSavedMinutes")),
    wouldUseAgain: formData.get("wouldUseAgain") === "on",
    failureTagIds: formData.getAll("failureTagIds"),
    notes: String(formData.get("reviewerNotes") || "").trim()
  };

  const validationRecord = createValidationRecord({
    caseRecord,
    run: latestRun,
    reviewerRating,
    baseline,
    traceNote: String(formData.get("traceNote") || "").trim()
  });

  caseRecord.validation ||= {};
  caseRecord.validation.baseline = validationRecord.baseline;
  caseRecord.validation.reviewerRating = validationRecord.reviewerRating;
  caseRecord.validation.traceAnnotations = validationRecord.traceAnnotations;
  store.validationRecords = upsertById(store.validationRecords, [validationRecord]);
  clearValidationExportState();
  addAuditEvent(store, caseRecord.id, "phase2_reviewer_capture", `Saved ${validationRecord.validationRecordId}.`);
  appendAgentNextStepProposal(store, {
    roomId: "room_case_march_2026",
    agentId: "A-CAD-001",
    caseId: caseRecord.id,
    sourceType: "validation_record",
    sourceId: validationRecord.validationRecordId,
    summary: "Validation evidence was captured. Choose whether to inspect failure tags, build a local export, or ask for the first 3-5 anonymized real cases.",
    choices: [
      { id: "inspect_failure_tags", label: "Inspect failure tags", description: "Review captured failure modes before changing the workflow.", localConsequenceType: "inspect_failure_tags" },
      { id: "build_export", label: "Build export locally", description: "Create a local validation package if the record is human-captured.", localConsequenceType: "build_local_validation_export" },
      { id: "request_cases", label: "Request anonymized cases", description: "Use the anonymized data request for 3-5 real Treuhand cases.", localConsequenceType: "request_anonymized_cases" }
    ]
  });
  render();
}

function handleBuildValidationExport() {
  const caseRecord = activeCase(store);
  const latestRun = latestRunForCase(caseRecord.id);
  const latestRecord = latestValidationRecordForCase(caseRecord.id);

  if (!latestRun || !latestRecord) {
    store.validationExportPackage = null;
    store.validationExportStatus = {
      status: "error",
      message: "Export requires an agent run and saved validation record.",
      errors: ["Run the agent and save reviewer capture first."]
    };
    render();
    return;
  }

  if (latestRecord.reviewerRating?.ratingSource !== "human_capture") {
    store.validationExportPackage = null;
    store.validationExportStatus = {
      status: "error",
      message: "Export requires human-captured reviewer evidence.",
      errors: ["Fixture-seeded validation records cannot be exported as business-value proof."]
    };
    render();
    return;
  }

  const validationPackage = createValidationPackage({
    caseRecord,
    run: latestRun,
    validationRecord: latestRecord,
    contextPackets: store.contextPackets,
    securityFindings: store.securityFindings
  });
  const privacy = validateValidationPackagePrivacy(validationPackage);

  if (!privacy.valid) {
    store.validationExportPackage = null;
    store.validationExportStatus = {
      status: "error",
      message: "Export blocked by local privacy gate.",
      errors: privacy.issues.map((issue) => issue.message)
    };
    render();
    return;
  }

  store.validationExportPackage = validationPackage;
  store.validationExportStatus = {
    status: "ready",
    message: `${validationPackage.validationRecordId} ready for local copy/export.`,
    errors: [],
    caseId: caseRecord.id,
    runId: latestRun.id
  };
  addAuditEvent(store, caseRecord.id, "phase2_validation_package_exported", `Built ${validationPackage.validationRecordId}.`);
  render();
}

function handleClearValidationExport() {
  clearValidationExportState();
  render();
}

function handleReview(recommendationId, decision) {
  const recommendation = store.recommendations.find((item) => item.id === recommendationId);
  if (!recommendation) return;
  const caseRecord = store.cases.find((item) => item.id === recommendation.caseId);
  const auth = runAuthorizationAgent({
    user: store.user,
    caseRecord,
    action: decision === "approve" ? "approve_recommendation" : "review_recommendation",
    targetType: "recommendation",
    targetId: recommendationId
  });
  recordAuthorization(auth);
  if (auth.authorizationDecision.decision === "deny") {
    addAuditEvent(store, recommendation.caseId, "authorization_denied", auth.authorizationDecision.reason);
    render();
    return;
  }

  recommendation.reviewStatus = decision;
  const reviewDecision = {
    id: `review_${Date.now()}`,
    recommendationId,
    caseId: recommendation.caseId,
    decision,
    comment:
      decision === "approve"
        ? "Approved for controlled demo purposes."
        : decision === "edit"
          ? "Needs human edits before use."
          : "Rejected by reviewer.",
    createdAt: new Date().toISOString()
  };

  store.reviewDecisions.unshift(reviewDecision);
  addAuditEvent(store, recommendation.caseId, "review_decision", `Reviewer decision: ${decision}.`);
  appendTreuhandReviewNextStepProposal(store, {
    recommendation,
    reviewDecision,
    createdAt: reviewDecision.createdAt
  });
  render();
}

function recordAuthorization(auth) {
  store.authorizationDecisions = mergeById(store.authorizationDecisions, [auth.authorizationDecision]);
  store.controlAgentOutputs = mergeById(store.controlAgentOutputs, [auth.controlAgentOutput]);
}

function renderRoomButton(room, activeRoom) {
  const active = activeRoom?.id === room.id ? "is-active" : "";
  return `
    <button class="room-button ${active}" data-situation-room-id="${escapeHtml(room.id)}" title="${escapeHtml(room.title)}">
      <strong>${escapeHtml(room.title)}</strong>
      <span>${escapeHtml(room.type)}${room.caseId ? ` - ${escapeHtml(room.caseId)}` : ""}</span>
    </button>
  `;
}

function renderScenarioButton(scenario, index, conductor = {}) {
  const isComplete = conductor.completedActIds?.includes(scenario.id);
  const isActive = conductor.activeActId === scenario.id;
  const completed = isComplete ? "is-complete" : "";
  const active = isActive ? "is-active" : "";
  const status = isComplete ? "complete" : isActive ? "active" : "ready";
  return `
    <button class="demo-act-button ${completed} ${active}" data-situation-scenario-id="${escapeHtml(scenario.id)}" title="${escapeHtml(scenario.label)}">
      <span class="act-number">${escapeHtml(index + 1)}</span>
      <span class="demo-act-copy">
        <strong class="demo-act-title">${escapeHtml(scenario.label)}</strong>
        <small>Agent ${escapeHtml(scenario.primaryAgentId)}</small>
      </span>
      <span class="act-status">${escapeHtml(status)}</span>
    </button>
  `;
}

function renderDemoConductorProgress(conductor = {}) {
  const completed = conductor.completedActIds?.length || 0;
  const total = SITUATION_ROOM_SCENARIOS.length;
  const lastCopy = conductor.lastAct
    ? `${conductor.lastAct.label}: ${conductor.lastAct.summary}`
    : "No act has run yet. Reset only prepares the room; the numbered acts create work.";
  return `
    <div class="demo-conductor-progress">
      <div class="mini-meta">
        <span>acts complete: ${escapeHtml(completed)}/${escapeHtml(total)}</span>
        <span>mode: local synthetic</span>
        <span>external effects: none</span>
      </div>
      <p class="compact-copy">${escapeHtml(lastCopy)}</p>
    </div>
  `;
}

function deriveDemoFocus({ conductor = {}, lastAction = null, traceChain = null }) {
  if (lastAction?.status === "approval_resolved") {
    return {
      happened: "Human review resolved the approval gate.",
      look: "Pending next steps -> Trace Chain -> approval card.",
      proof: "The gate stayed local-only, and the responsible agent proposed follow-through instead of executing anything.",
      next: "Select one next-step choice locally.",
      targets: ["approvals", "next_steps", "trace_chain"]
    };
  }
  if (lastAction?.status === "local_follow_through_recorded") {
    return {
      happened: "A human selected a local consequence.",
      look: "Selected follow-through -> Trace Chain -> Demo readiness.",
      proof: "The consequence is now auditable as a local record; no external action executed.",
      next: "Run the remaining conductor acts or open Validation for proof packaging.",
      targets: ["follow_through", "trace_chain", "readiness"]
    };
  }
  if (lastAction?.status === "manual_tag_routed_demo_act" || lastAction?.status === "manual_tag_reused_demo_act") {
    return {
      happened: "Manual tag routed to a deterministic demo scenario.",
      look: "Room chat -> Created this act -> Trace Chain -> Artifact packs.",
      proof: "The command names the source event, work order, cards, and approvals without creating duplicates for completed acts.",
      next: "Inspect the highlighted artifacts or continue the numbered acts.",
      targets: ["created_act", "trace_chain", "artifact_packs"]
    };
  }
  const actFocus = conductor.lastAct?.demoFocus;
  if (actFocus) return actFocus;
  if (traceChain?.sourceEvent) {
    return {
      happened: "A local trace is selected.",
      look: "Trace Chain -> Artifact packs.",
      proof: "The current chain is reconstructed from explicit local IDs.",
      next: "Run a numbered act or resolve a pending approval.",
      targets: ["trace_chain", "artifact_packs"]
    };
  }
  return {
    happened: "No demo act has run yet.",
    look: "Demo conductor.",
    proof: "Reset only prepares a clean local state; the numbered acts create visible proof.",
    next: "Click Inbound email intake.",
    targets: ["demo_conductor"]
  };
}

function renderDemoFocus(focus) {
  return `
    <div class="demo-focus-strip">
      <div class="subpanel-heading compact-heading">
        <h3>Demo focus</h3>
        <span>guided proof path</span>
      </div>
      <div class="demo-focus-grid">
        ${demoFocusItem("What just happened", focus.happened)}
        ${demoFocusItem("Where to look", focus.look)}
        ${demoFocusItem("Why it matters", focus.proof)}
        ${demoFocusItem("Next click", focus.next)}
      </div>
    </div>
  `;
}

function demoFocusItem(label, value) {
  return `
    <div>
      <strong>${escapeHtml(label)}</strong>
      <span>${escapeHtml(value)}</span>
    </div>
  `;
}

function renderDemoActResult(act, focusTargets = new Set()) {
  if (!act) {
    return `
      <div class="demo-act-result">
        <strong>Created this act</strong>
        <p>Run act 1-5 to create visible cards, work orders, approvals, and local logs.</p>
      </div>
    `;
  }
  return `
    <div class="demo-act-result is-populated ${focusTargets.has("created_act") ? "demo-focus-target" : ""}">
      ${renderSourceEventPanel(act.sourceEvent, focusTargets)}
      <div class="subpanel-heading compact-heading">
        <h3>Created this act</h3>
        <span>${escapeHtml(act.primaryAgentId)}</span>
      </div>
      <div class="created-now-grid">
        ${metricTile("Cards", String(act.deltas.cards))}
        ${metricTile("Work orders", String(act.deltas.workOrders))}
        ${metricTile("Approvals", String(act.deltas.approvals))}
        ${metricTile("Logs", String(act.deltas.logs))}
      </div>
      <div class="contrast-grid">
        <div>
          <strong>Generic chatbot</strong>
          <p>${escapeHtml(act.chatbotContrast)}</p>
        </div>
        <div>
          <strong>Cambrian agents</strong>
          <p>${escapeHtml(act.cambrianContrast)}</p>
        </div>
      </div>
      <div class="mini-meta">
        ${renderCompactIdMeta("work order", act.createdWorkOrderIds, 1)}
        ${renderCompactIdMeta("cards", act.createdCardIds, 2)}
        ${renderCompactIdMeta("approvals", act.createdApprovalIds, 1)}
      </div>
    </div>
  `;
}

function renderSourceEventPanel(sourceEvent, focusTargets = new Set()) {
  if (!sourceEvent) {
    return `
      <div class="event-source-panel">
        <strong>Event Source</strong>
        <p>Run a conductor act to show the synthetic event before agents respond.</p>
      </div>
    `;
  }
  return `
    <div class="event-source-panel ${focusTargets.has("event_source") ? "demo-focus-target" : ""}">
      <div class="subpanel-heading compact-heading">
        <h3>Event Source</h3>
        <span>${escapeHtml(sourceEvent.sourceLabel)}</span>
      </div>
      <p>${escapeHtml(sourceEvent.payloadPreview)}</p>
      <div class="source-detail-grid">
        <div>
          <strong>Trigger</strong>
          <span>${escapeHtml(sourceEvent.triggerType)}</span>
        </div>
        <div>
          <strong>Source actor</strong>
          <span>${escapeHtml(sourceEvent.sourceActor)}</span>
        </div>
        <div>
          <strong>Adapter mode</strong>
          <span>synthetic/local only</span>
        </div>
        <div>
          <strong>External effects</strong>
          <span>${escapeHtml(sourceEvent.externalEffect || "none")}</span>
        </div>
      </div>
      <div class="mini-meta">
        <span>kind: ${escapeHtml(sourceEvent.sourceKind)}</span>
        <span>expected agents: ${escapeHtml((sourceEvent.expectedAgentIds || []).join(", "))}</span>
        ${renderCompactIdMeta("source event", [sourceEvent.id], 1)}
      </div>
      <p class="boundary-copy">${escapeHtml(sourceEvent.adapterBoundary || "Simulated/local source only; no external service integration.")}</p>
    </div>
  `;
}

function renderSituationTraceChain(chain, focusTargets = new Set()) {
  const missing = new Map((chain.missingLinks || []).map((item) => [item.link, item.label]));
  const sourceEventId = chain.sourceEvent?.id || chain.selector?.sourceEventId || "";
  const workOrderId = chain.workOrder?.id || chain.selector?.workOrderId || "";
  const approvalIds = chain.approvals.map((approval) => approval.id);
  const proposalIds = chain.nextStepProposals.map((proposal) => proposal.id);
  const followThroughIds = chain.followThroughs.map((record) => record.id);
  const logIds = chain.logs.map((log) => log.id);
  const traceId =
    chain.selector?.traceId ||
    chain.workOrder?.traceId ||
    chain.approvals[0]?.traceId ||
    chain.nextStepProposals[0]?.traceId ||
    chain.followThroughs[0]?.traceId ||
    "";

  return `
    <div class="trace-chain-panel ${focusTargets.has("trace_chain") ? "demo-focus-target" : ""}">
      <div class="subpanel-heading compact-heading">
        <h3>Trace Chain</h3>
        <span>${escapeHtml(chain.externalEffectSummary || "none")}</span>
      </div>
      <p class="boundary-copy">local synthetic trace only; no external action executed.</p>
      <div class="trace-chain-list">
        ${renderTraceChainRow("Source event", sourceEventId, missing.get("source_event"), [
          sourceEventId ? renderCompactIdMeta("sourceEventId", [sourceEventId], 1) : "",
          chain.sourceEvent?.triggerType ? `<span>trigger: ${escapeHtml(chain.sourceEvent.triggerType)}</span>` : ""
        ])}
        ${renderTraceChainRow("Work order", workOrderId, missing.get("work_order"), [
          workOrderId ? renderCompactIdMeta("workOrderId", [workOrderId], 1) : "",
          chain.workOrder?.agentId ? `<span>agent: ${escapeHtml(chain.workOrder.agentId)}</span>` : "",
          traceId ? renderCompactIdMeta("traceId", [traceId], 1) : ""
        ])}
        ${renderTraceChainRow("Agent/control cards", `${chain.cards.length} card(s)`, missing.get("agent_control_cards"), [
          renderCompactIdMeta("cards", chain.cards.map((card) => card.id), 2),
          traceId ? renderCompactIdMeta("traceId", [traceId], 1) : ""
        ])}
        ${renderTraceChainRow("Approval gate", approvalIds.length ? `${approvalIds.length} gate(s)` : "", missing.get("approval_gate"), [
          renderCompactIdMeta("approvalId", approvalIds, 1),
          chain.approvals[0]?.gateAgentId ? `<span>gate: ${escapeHtml(chain.approvals[0].gateAgentId)}</span>` : "",
          chain.approvals[0]?.responsibleAgentId ? `<span>responsible: ${escapeHtml(chain.approvals[0].responsibleAgentId)}</span>` : ""
        ])}
        ${renderTraceChainRow("Next-step proposal", proposalIds.length ? `${proposalIds.length} proposal(s)` : "", missing.get("next_step_proposal"), [
          renderCompactIdMeta("proposalCardId", proposalIds, 1),
          chain.nextStepProposals[0]?.agentId ? `<span>agent: ${escapeHtml(chain.nextStepProposals[0].agentId)}</span>` : ""
        ])}
        ${renderTraceChainRow("Selected local follow-through", followThroughIds.length ? `${followThroughIds.length} selected` : "", missing.get("selected_follow_through"), [
          renderCompactIdMeta("followThroughId", followThroughIds, 1),
          chain.followThroughs[0]?.selectedChoiceLabel ? `<span>choice: ${escapeHtml(chain.followThroughs[0].selectedChoiceLabel)}</span>` : ""
        ])}
        ${renderTraceChainRow("Logs", logIds.length ? `${logIds.length} log(s)` : "", missing.get("logs"), [
          renderCompactIdMeta("logs", logIds, 2)
        ])}
      </div>
    </div>
  `;
}

function renderTraceChainRow(label, value, missingLabel, metaItems) {
  const status = value || missingLabel || "not created yet";
  const isMissing = !value;
  return `
    <div class="trace-chain-row ${isMissing ? "is-missing" : ""}">
      <strong>${escapeHtml(label)}</strong>
      <span>${escapeHtml(status)}</span>
      <div class="mini-meta">
        ${metaItems.filter(Boolean).join("")}
      </div>
    </div>
  `;
}

function renderSituationDemoReadinessReport(report, focusTargets = new Set()) {
  return `
    <div class="demo-readiness-report ${focusTargets.has("readiness") ? "demo-focus-target" : ""}">
      <div class="subpanel-heading compact-heading">
        <h3>Demo readiness</h3>
        <span>${escapeHtml(report.completedActCount)}/${escapeHtml(report.totalActCount)} acts</span>
      </div>
      <div class="readiness-grid">
        ${readinessItem("Conductor acts", report.allConductorActsRun ? "complete" : "not complete")}
        ${readinessItem("Active agents", `${report.activeAgentsShown}/6 shown`)}
        ${readinessItem("Source events", String(report.sourceEventsCount))}
        ${readinessItem("Work orders", String(report.workOrdersCount))}
        ${readinessItem("Approval gates", String(report.approvalGatesCount))}
        ${readinessItem("Reviewed gates", String(report.reviewedApprovalsCount))}
        ${readinessItem("Pending next steps", String(report.pendingNextStepProposalsCount))}
        ${readinessItem("Follow-through", String(report.selectedFollowThroughCount))}
      </div>
      <p class="boundary-copy">real external effects: ${escapeHtml(report.realExternalEffects)}. ${escapeHtml(report.fixtureProofBoundary)}</p>
      <p class="compact-copy">next business ask: ${escapeHtml(report.nextBusinessAsk)}.</p>
    </div>
  `;
}

function readinessItem(label, value) {
  return `
    <div>
      <strong>${escapeHtml(label)}</strong>
      <span>${escapeHtml(value)}</span>
    </div>
  `;
}

function renderCompactIdMeta(label, ids = [], maxVisible = 2) {
  if (!ids.length) return "";
  const visible = ids.slice(0, maxVisible).map((id) => compactId(id));
  const remaining = ids.length - visible.length;
  const copy = `${label}: ${visible.join(", ")}${remaining > 0 ? ` +${remaining} more` : ""}`;
  return `<span class="id-chip" title="${escapeHtml(ids.join(", "))}">${escapeHtml(copy)}</span>`;
}

function compactId(id) {
  const text = String(id || "");
  if (text.length <= 34) return text;
  return `${text.slice(0, 18)}...${text.slice(-10)}`;
}

function renderSituationDemoReport(report) {
  return `
    <div class="demo-report">
      <strong>Guided demo recap</strong>
      <p>${escapeHtml(report.recapSummary || "Guided demo completed locally.")}</p>
      <div class="mini-meta">
        <span>scenarios: ${escapeHtml((report.scenarioIds || []).length)}</span>
        <span>agents shown: ${escapeHtml(report.activeAgentsShown)}</span>
        <span>truth: ${escapeHtml(report.truthLabel)}</span>
        <span>external effects: none</span>
      </div>
    </div>
  `;
}

function renderSituationAgentStatus(agent, expandedAgentId) {
  const outputCount = agent.totalOutputs || agent.cards + agent.workOrders + agent.controlOutputs + agent.approvals + agent.agentRuns;
  const active = agent.agentId === expandedAgentId ? "is-active" : "";
  return `
    <button type="button" class="agent-status-card ${active}" data-situation-agent-id="${escapeHtml(agent.agentId)}" title="Show ${escapeHtml(agent.agentId)} details">
      <span class="agent-status-summary">
        <span>
          <strong>${escapeHtml(agent.agentId)}</strong>
          <em>${escapeHtml(agent.role)}</em>
        </span>
        <span class="agent-output-count">${escapeHtml(outputCount)} outputs</span>
        <small>${escapeHtml(agent.latestAction)}</small>
      </span>
    </button>
  `;
}

function renderSituationAgentOverlay(agent) {
  const approvalCopy = agent.humanApprovalRequired ? "approval required for sensitive actions" : "no sensitive action permitted";
  return `
    <div class="agent-popover" role="dialog" aria-modal="false" aria-labelledby="agent-popover-title">
      <div class="agent-popover-header">
        <div>
          <p class="eyebrow">Expanded agent</p>
          <h3 id="agent-popover-title">${escapeHtml(agent.agentId)}</h3>
          <span>${escapeHtml(agent.role)}</span>
        </div>
        <button type="button" class="icon-button" id="close-situation-agent-overlay" title="Collapse agent detail">x</button>
      </div>
      <div class="mini-meta">
        <span>cards: ${escapeHtml(agent.cards)}</span>
        <span>work orders: ${escapeHtml(agent.workOrders)}</span>
        <span>control outputs: ${escapeHtml(agent.controlOutputs)}</span>
        <span>approvals: ${escapeHtml(agent.approvals)}</span>
        ${agent.agentRuns ? `<span>runs: ${escapeHtml(agent.agentRuns)}</span>` : ""}
      </div>
      <p class="compact-copy">${escapeHtml(agent.latestAction)}</p>
      <div class="mini-meta">
        <span>${escapeHtml(agent.demoCommand)}</span>
      </div>
      <p class="compact-copy">${escapeHtml(approvalCopy)}</p>
      <p class="boundary-copy">${escapeHtml(agent.approvalBoundary)}</p>
    </div>
  `;
}

function renderSituationLastAction(action) {
  return `
    <div class="situation-last-action">
      <strong>${escapeHtml(action.status)}</strong>
      <span>${escapeHtml(action.summary)}</span>
      <div class="mini-meta">
        ${action.roomId ? `<span>room: ${escapeHtml(action.roomId)}</span>` : ""}
        ${action.workOrderId ? renderCompactIdMeta("work order", [action.workOrderId], 1) : ""}
        ${action.sourceEventId ? renderCompactIdMeta("source event", [action.sourceEventId], 1) : ""}
        ${action.approvalId ? renderCompactIdMeta("approval", [action.approvalId], 1) : ""}
        ${action.cardIds?.length ? renderCompactIdMeta("cards", action.cardIds, 2) : ""}
        <span>${formatTime(action.createdAt)}</span>
      </div>
    </div>
  `;
}

function renderPackButton(pack, activePack) {
  const active = pack.id === activePack ? "is-active" : "";
  return `
    <button class="secondary-button pack-button ${active}" data-situation-pack-id="${escapeHtml(pack.id)}" title="${escapeHtml(pack.label)}">
      ${escapeHtml(pack.label)}
    </button>
  `;
}

function renderSituationArtifactPack(activePack, { roomCards, roomWorkOrders, roomApprovals, roomSourceEvents, roomNextSteps, roomFollowThroughs, roomLogs }) {
  if (activePack === "events") {
    const events = [
      ...roomSourceEvents,
      ...roomCards.filter((card) => card.type !== "agent_next_step_proposal"),
      ...roomLogs.filter((log) => log.eventType === "source_event_received" || log.eventType === "scenario_run" || log.eventType === "demo_command_routed")
    ].sort((a, b) => new Date(b.createdAt || 0) - new Date(a.createdAt || 0));
    return events.length === 0 ? emptyState("No local events in this room.") : events.map(renderPackedEvent).join("");
  }
  if (activePack === "work_orders") {
    return roomWorkOrders.length === 0
      ? emptyState("No work orders in this room.")
      : roomWorkOrders.map(renderPackedWorkOrder).join("");
  }
  if (activePack === "approvals") {
    return roomApprovals.length === 0
      ? emptyState("No approvals in this room.")
      : roomApprovals.map(renderPackedApproval).join("");
  }
  if (activePack === "logs") {
    return roomLogs.length === 0 ? emptyState("No local log records in this room.") : roomLogs.map(renderPackedLog).join("");
  }
  if (activePack === "next_steps") {
    const items = [
      ...roomNextSteps.map((item) => ({ ...item, artifactKind: "proposal" })),
      ...roomFollowThroughs.map((item) => ({ ...item, artifactKind: "follow_through" }))
    ].sort((a, b) => new Date(b.createdAt || 0) - new Date(a.createdAt || 0));
    return items.length === 0 ? emptyState("No next-step proposals or follow-through records in this room.") : items.map(renderPackedNextStepItem).join("");
  }
  return roomCards.length === 0 ? emptyState("No cards in this room.") : roomCards.map(renderPackedCard).join("");
}

function renderPackedCard(card) {
  const fresh = store.situationDemoConductor?.lastAct?.createdCardIds?.includes(card.id) ? "is-created-this-act" : "";
  return `
    <details class="packed-artifact severity-${escapeHtml(card.severity)} ${fresh}">
      <summary>
        <strong>${escapeHtml(card.title)}</strong>
        <span>${escapeHtml(card.type)} - ${formatTime(card.createdAt)}</span>
      </summary>
      ${renderSituationCard(card)}
    </details>
  `;
}

function renderPackedEvent(event) {
  if (event.sourceEventId && event.triggerType) {
    return `
      <details class="packed-artifact packed-event">
        <summary>
          <strong>${escapeHtml(event.sourceLabel)}</strong>
          <span>${escapeHtml(event.triggerType)} - ${formatTime(event.createdAt)}</span>
        </summary>
        ${renderSourceEventPanel(event)}
      </details>
    `;
  }
  if (event.cardId) {
    return `
      <details class="packed-artifact packed-event">
        <summary>
          <strong>${escapeHtml(event.title)}</strong>
          <span>${escapeHtml(event.type)} - agent ${escapeHtml(event.agentId)} - ${formatTime(event.createdAt)}</span>
        </summary>
        <div class="mini-meta">
          ${renderCompactIdMeta("card", [event.id], 1)}
          ${event.workOrderId ? renderCompactIdMeta("work order", [event.workOrderId], 1) : `<span>work order: none</span>`}
          ${event.sourceEventId ? renderCompactIdMeta("source event", [event.sourceEventId], 1) : ""}
          ${renderCompactIdMeta("trace", [event.traceId], 1)}
        </div>
        <p>${escapeHtml(event.summary)}</p>
      </details>
    `;
  }
  return renderPackedLog(event);
}

function renderPackedWorkOrder(workOrder) {
  const fresh = store.situationDemoConductor?.lastAct?.createdWorkOrderIds?.includes(workOrder.id) ? "is-created-this-act" : "";
  return `
    <details class="packed-artifact ${fresh}">
      <summary>
        <strong>${escapeHtml(workOrder.agentId)}</strong>
        <span>${escapeHtml(workOrder.status)} - ${formatTime(workOrder.updatedAt || workOrder.createdAt)}</span>
      </summary>
      ${renderSituationWorkOrder(workOrder)}
    </details>
  `;
}

function renderPackedApproval(approval) {
  return `
    <details class="packed-artifact">
      <summary>
        <strong>${escapeHtml(approval.actionType)}</strong>
        <span>${escapeHtml(approval.status)} - ${formatTime(approval.decidedAt || approval.createdAt)}</span>
      </summary>
      ${renderSituationApproval(approval)}
    </details>
  `;
}

function renderPackedNextStepItem(item) {
  if (item.artifactKind === "follow_through") {
    return `
      <details class="packed-artifact">
        <summary>
          <strong>${escapeHtml(item.selectedChoiceLabel)}</strong>
          <span>${escapeHtml(item.status)} - ${formatTime(item.createdAt)}</span>
        </summary>
        ${renderFollowThroughRecord(item)}
      </details>
    `;
  }
  return `
    <details class="packed-artifact">
      <summary>
        <strong>${escapeHtml(item.title)}</strong>
        <span>${escapeHtml(item.status || "pending")} - ${formatTime(item.createdAt)}</span>
      </summary>
      ${renderNextStepProposal(item)}
    </details>
  `;
}

function renderPackedLog(log) {
  return `
    <details class="packed-artifact packed-log">
      <summary>
        <strong>${escapeHtml(log.eventType)}</strong>
        <span>${formatTime(log.createdAt)}</span>
      </summary>
      <p>${escapeHtml(log.summary)}</p>
      <div class="mini-meta">
        <span>log: ${escapeHtml(log.id)}</span>
        <span>room: ${escapeHtml(log.roomId)}</span>
        ${log.sourceEventId ? renderCompactIdMeta("source event", [log.sourceEventId], 1) : ""}
        <span>${escapeHtml(log.artifactType)}: ${escapeHtml(log.artifactId)}</span>
        <span>stored: ${escapeHtml(log.storage)}</span>
      </div>
    </details>
  `;
}

function renderAdvisoryChoices(actions) {
  return `
    <div class="advisory-choice-list">
      ${actions
        .map(
          (action) => `
            <article class="advisory-choice">
              <strong>${escapeHtml(action.label)}</strong>
              <span>${escapeHtml(action.description || "Advisory only.")}</span>
            </article>
          `
        )
        .join("")}
    </div>
  `;
}

function renderNextStepProposal(card) {
  const followThrough = (store.situationFollowThroughs || []).find((item) => item.proposalCardId === card.id);
  const selected = card.status === "selected";
  return `
    <article class="artifact-item next-step-card">
      <div class="artifact-heading">
        <strong>${escapeHtml(card.status || "pending")}</strong>
        <span>${escapeHtml(card.agentId || "responsible agent")}</span>
      </div>
      <p>${escapeHtml(card.summary)}</p>
      <div class="mini-meta">
        ${renderCompactIdMeta("proposal", [card.id], 1)}
        ${card.sourceType ? `<span>source type: ${escapeHtml(card.sourceType)}</span>` : ""}
        ${card.sourceId ? renderCompactIdMeta("source", [card.sourceId], 1) : ""}
        ${card.sourceEventId ? renderCompactIdMeta("source event", [card.sourceEventId], 1) : ""}
        ${card.workOrderId ? renderCompactIdMeta("work order", [card.workOrderId], 1) : ""}
        ${card.caseId ? `<span>case: ${escapeHtml(card.caseId)}</span>` : ""}
        ${card.traceId ? renderCompactIdMeta("trace", [card.traceId], 1) : ""}
        <span>truth: ${escapeHtml(card.truthLabelText || "synthetic/local only")}</span>
        <span>external effects: ${escapeHtml(card.externalEffect || "none")}</span>
        <span>created: ${formatTime(card.createdAt)}</span>
      </div>
      ${
        selected
          ? `<div class="selected-choice">
              <strong>Selected locally: ${escapeHtml(card.selectedChoiceLabel || card.selectedChoiceId)}</strong>
              ${followThrough ? renderCompactIdMeta("follow-through", [followThrough.id], 1) : ""}
              <p class="boundary-copy">Local consequence recorded only; no external action executed.</p>
            </div>`
          : renderNextStepChoices(card)
      }
    </article>
  `;
}

function renderNextStepChoices(card) {
  return `
    <div class="advisory-choice-list next-step-choice-list">
      ${(card.actions || [])
        .map(
          (action) => `
            <article class="advisory-choice next-step-choice">
              <strong>${escapeHtml(action.label)}</strong>
              <span>${escapeHtml(action.description || "Local consequence only.")}</span>
              <div class="mini-meta">
                <span>consequence: ${escapeHtml(action.localConsequenceType || "local_record_only")}</span>
              </div>
              <button
                type="button"
                class="secondary-button"
                data-next-step-proposal-id="${escapeHtml(card.id)}"
                data-next-step-choice-id="${escapeHtml(action.id)}"
                title="Record this local-only consequence"
              >Select locally</button>
            </article>
          `
        )
        .join("")}
    </div>
  `;
}

function renderFollowThroughRecord(record) {
  return `
    <article class="artifact-item follow-through-record">
      <div class="artifact-heading">
        <strong>${escapeHtml(record.selectedChoiceLabel)}</strong>
        <span>${escapeHtml(record.status)}</span>
      </div>
      <p>${escapeHtml(record.localConsequenceSummary)}</p>
      <div class="mini-meta">
        ${renderCompactIdMeta("follow-through", [record.id], 1)}
        ${renderCompactIdMeta("proposal", [record.proposalCardId], 1)}
        ${record.sourceType ? `<span>source type: ${escapeHtml(record.sourceType)}</span>` : ""}
        ${record.sourceId ? renderCompactIdMeta("source", [record.sourceId], 1) : ""}
        ${record.sourceEventId ? renderCompactIdMeta("source event", [record.sourceEventId], 1) : ""}
        ${record.workOrderId ? renderCompactIdMeta("work order", [record.workOrderId], 1) : ""}
        ${record.caseId ? `<span>case: ${escapeHtml(record.caseId)}</span>` : ""}
        ${record.traceId ? renderCompactIdMeta("trace", [record.traceId], 1) : ""}
        <span>agent: ${escapeHtml(record.agentId)}</span>
        <span>actor: ${escapeHtml(record.actorId)}</span>
        <span>consequence: ${escapeHtml(record.localConsequenceType)}</span>
        <span>truth: ${escapeHtml(record.truthLabelText || record.truthLabel)}</span>
        <span>external effects: ${escapeHtml(record.externalEffect || "none")}</span>
        <span>created: ${formatTime(record.createdAt)}</span>
      </div>
      <p class="boundary-copy">Local consequence recorded only; no external action executed.</p>
    </article>
  `;
}

function renderSituationSnapshotPanel() {
  const snapshotJson = store.situationSnapshotExport ? JSON.stringify(store.situationSnapshotExport, null, 2) : "";
  return `
    <div class="button-row">
      <button class="secondary-button" id="export-situation-snapshot" title="Build local demo snapshot JSON">Save demo snapshot</button>
      <button class="secondary-button" id="advance-week-two-demo" title="Run week-two continuity scenario from local logs">Advance one week</button>
    </div>
    ${renderValidationStatus(store.situationSnapshotStatus)}
    ${
      snapshotJson
        ? `<label class="export-output-label">Snapshot JSON<textarea class="export-output" rows="10" readonly>${escapeHtml(snapshotJson)}</textarea></label>`
        : emptyState("Save a demo snapshot to carry this local state into demo part 2.")
    }
    <form id="situation-snapshot-import-form" class="validation-form compact-import-form">
      <label>
        Load snapshot JSON
        <textarea name="situationSnapshotJson" rows="6" placeholder='{"snapshotVersion":"situation.demo.snapshot.v1",...}'></textarea>
      </label>
      <button type="submit" class="secondary-button" title="Load local demo snapshot">Load snapshot</button>
    </form>
  `;
}

function renderTimelineItem(item) {
  if (item.cardId) return renderSituationCard(item);
  return renderRoomMessage(item);
}

function renderRoomChatMessage(message) {
  return `
    <article class="chat-message ${message.actorType === "system" ? "system-message" : ""}">
      <div>
        <strong>${escapeHtml(message.actorId)}</strong>
        <span>${escapeHtml(message.actorType)} - ${formatTime(message.createdAt)}</span>
      </div>
      <p>${escapeHtml(message.text)}</p>
      <div class="mini-meta">
        <span>message: ${escapeHtml(message.id)}</span>
        <span>room: ${escapeHtml(message.roomId)}</span>
        ${message.mentions?.length ? `<span>mentions: ${escapeHtml(message.mentions.join(", "))}</span>` : ""}
      </div>
    </article>
  `;
}

function renderRoomMessage(message) {
  return `
    <article class="situation-card message-card">
      <div class="artifact-heading">
        <strong>${escapeHtml(message.actorId)}</strong>
        <span>${escapeHtml(message.actorType)}</span>
      </div>
      <p>${escapeHtml(message.text)}</p>
      <div class="mini-meta">
        <span>${escapeHtml(message.id)}</span>
        <span>${formatTime(message.createdAt)}</span>
        ${message.mentions?.length ? `<span>mentions: ${escapeHtml(message.mentions.join(", "))}</span>` : ""}
      </div>
    </article>
  `;
}

function renderSituationCard(card) {
  if (card.type === "agent_next_step_proposal") return renderNextStepProposal(card);
  const fresh = store.situationDemoConductor?.lastAct?.createdCardIds?.includes(card.id) ? "is-created-this-act" : "";
  const blockedCopy =
    card.approvalId && card.approvalStatus === "pending"
      ? `<p class="warning-copy">Blocked until approval ${escapeHtml(card.approvalId)} is resolved.</p>`
      : card.resolutionSummary
        ? `<p class="boundary-copy">${escapeHtml(card.resolutionSummary)}</p>`
        : "";
  return `
    <article class="situation-card severity-${escapeHtml(card.severity)} ${fresh}">
      <div class="artifact-heading">
        <strong>${escapeHtml(card.title)}</strong>
        <span>${escapeHtml(card.type)}</span>
      </div>
      <p>${escapeHtml(card.summary)}</p>
      ${blockedCopy}
      <div class="mini-meta">
        <span>card: ${escapeHtml(card.id)}</span>
        <span>room: ${escapeHtml(card.roomId)}</span>
        ${card.workOrderId ? `<span>work order: ${escapeHtml(card.workOrderId)}</span>` : ""}
        ${card.sourceEventId ? renderCompactIdMeta("source event", [card.sourceEventId], 1) : ""}
        ${card.agentId ? `<span>agent: ${escapeHtml(card.agentId)}</span>` : ""}
        ${card.caseId ? `<span>case: ${escapeHtml(card.caseId)}</span>` : ""}
        ${card.runId ? `<span>run: ${escapeHtml(card.runId)}</span>` : ""}
        ${card.approvalId ? `<span>approval: ${escapeHtml(card.approvalId)}</span>` : ""}
        ${card.approvalId ? `<span>approval status: ${escapeHtml(card.approvalStatus)}</span>` : ""}
        ${card.sourceType ? `<span>source type: ${escapeHtml(card.sourceType)}</span>` : ""}
        ${card.sourceId ? renderCompactIdMeta("source", [card.sourceId], 1) : ""}
        ${card.proposalCardId ? renderCompactIdMeta("proposal", [card.proposalCardId], 1) : ""}
        ${card.followThroughId ? renderCompactIdMeta("follow-through", [card.followThroughId], 1) : ""}
        ${card.localConsequenceType ? `<span>consequence: ${escapeHtml(card.localConsequenceType)}</span>` : ""}
        <span>trace: ${escapeHtml(card.traceId)}</span>
        <span>truth: ${escapeHtml(card.truthLabelText || card.truthLabel || "synthetic/local")}</span>
        <span>external effects: ${escapeHtml(card.externalEffect || "none")}</span>
        <span>created: ${formatTime(card.createdAt)}</span>
        ${card.updatedAt ? `<span>updated: ${formatTime(card.updatedAt)}</span>` : ""}
      </div>
      ${card.evidenceIds?.length ? `<div class="mini-meta"><span>evidence: ${escapeHtml(card.evidenceIds.join(", "))}</span></div>` : ""}
      ${card.actions?.length ? renderAdvisoryChoices(card.actions) : ""}
    </article>
  `;
}

function renderSituationApproval(approval) {
  return `
    <article class="artifact-item">
      <div class="artifact-heading">
        <strong>${escapeHtml(approval.status)}</strong>
        <span>${escapeHtml(approval.actionType)}</span>
      </div>
      <p>${escapeHtml(approval.rationale)}</p>
      <div class="mini-meta">
        ${renderCompactIdMeta("approval", [approval.id], 1)}
        ${renderCompactIdMeta("work order", [approval.workOrderId], 1)}
        ${approval.sourceEventId ? renderCompactIdMeta("source event", [approval.sourceEventId], 1) : ""}
        <span>gate agent: ${escapeHtml(approval.gateAgentId || approval.controlAgentId || approval.requestedByAgentId)}</span>
        <span>control agent: ${escapeHtml(approval.controlAgentId || approval.requestedByAgentId)}</span>
        <span>responsible agent: ${escapeHtml(approval.responsibleAgentId || approval.requestedByAgentId)}</span>
        <span>approver: ${escapeHtml(approval.approverRole)}</span>
        ${renderCompactIdMeta("trace", [approval.traceId], 1)}
        <span>external effects: ${escapeHtml(approval.externalEffect || "none")}</span>
        <span>created: ${formatTime(approval.createdAt)}</span>
        ${approval.decidedAt ? `<span>decided: ${formatTime(approval.decidedAt)}</span>` : ""}
      </div>
      <p class="boundary-copy">${escapeHtml(approval.localOnlyNotice || "Local approval recorded only; no external action will run.")}</p>
      ${
        approval.status === "pending"
          ? `<div class="button-row">
              <button class="primary-button" data-situation-approval-id="${escapeHtml(approval.id)}" data-situation-approval-decision="approved" title="Approve request">Approve</button>
              <button class="danger-button" data-situation-approval-id="${escapeHtml(approval.id)}" data-situation-approval-decision="rejected" title="Reject request">Reject</button>
            </div>`
          : ""
      }
    </article>
  `;
}

function renderSituationWorkOrder(workOrder) {
  return `
    <article class="artifact-item">
      <div class="artifact-heading">
        <strong>${escapeHtml(workOrder.agentId)}</strong>
        <span>${escapeHtml(workOrder.status)}</span>
      </div>
      <p>${escapeHtml(workOrder.command)}</p>
      <div class="mini-meta">
        ${renderCompactIdMeta("work order", [workOrder.id], 1)}
        ${workOrder.sourceEventId ? renderCompactIdMeta("source event", [workOrder.sourceEventId], 1) : ""}
        <span>room: ${escapeHtml(workOrder.roomId)}</span>
        ${workOrder.caseId ? `<span>case: ${escapeHtml(workOrder.caseId)}</span>` : ""}
        ${renderCompactIdMeta("trace", [workOrder.traceId], 1)}
        <span>truth: ${escapeHtml(workOrder.truthLabel || "synthetic_local")}</span>
        <span>external effects: ${escapeHtml(workOrder.externalEffect || "none")}</span>
        ${workOrder.approvalIds?.length ? renderCompactIdMeta("approvals", workOrder.approvalIds, 1) : ""}
        <span>created: ${formatTime(workOrder.createdAt)}</span>
        ${workOrder.updatedAt ? `<span>updated: ${formatTime(workOrder.updatedAt)}</span>` : ""}
      </div>
      ${workOrder.localOnlyNotice ? `<p class="boundary-copy">${escapeHtml(workOrder.localOnlyNotice)}</p>` : ""}
      <ul class="plain-list compact-steps">
        ${workOrder.stages.map((stage) => `<li>${escapeHtml(stage)}</li>`).join("")}
      </ul>
    </article>
  `;
}

function renderEvidenceItem(item) {
  return `
    <article class="evidence-item">
      <div>
        <strong>${escapeHtml(item.title)}</strong>
        <span>${escapeHtml(item.type)} - ${escapeHtml(item.id)}</span>
      </div>
      <p>${escapeHtml(item.content).slice(0, 180)}${item.content.length > 180 ? "..." : ""}</p>
    </article>
  `;
}

function renderRun(run) {
  const output = run.output;

  return `
    <div class="run-summary">
      ${metricTile("Completeness", `${output.metrics.completeness_score}%`)}
      ${metricTile("Missing", String(output.metrics.missing_items_count))}
      ${metricTile("Saved", `${output.metrics.estimated_minutes_saved} min`)}
    </div>
    <p class="summary-copy">${escapeHtml(output.executive_summary)}</p>
    <div class="result-columns">
      <div>
        <h4>Checklist</h4>
        <ul class="plain-list">
          ${output.checklist
            .map(
              (item) =>
                `<li><span class="${item.status === "complete" ? "ok" : "warn"}">${item.status}</span> ${escapeHtml(item.item)} <small>${escapeHtml(item.claimSupport?.supportType || "unknown_support")}</small></li>`
            )
            .join("")}
        </ul>
      </div>
      <div>
        <h4>Warnings</h4>
        <ul class="plain-list">
          ${
            output.warnings.length === 0
              ? "<li>None</li>"
              : output.warnings.map((item) => `<li><span class="warn">${item.severity}</span> ${escapeHtml(item.message)}</li>`).join("")
          }
        </ul>
      </div>
    </div>
    <details>
      <summary>Draft email</summary>
      <pre>${escapeHtml(output.draft_outputs.email_draft)}</pre>
    </details>
    <details>
      <summary>Review pack</summary>
      <pre>${escapeHtml(output.draft_outputs.review_pack_markdown)}</pre>
    </details>
  `;
}

function renderRecommendation(item) {
  return `
    <article class="recommendation">
      <div class="subpanel-heading">
        <h3>${escapeHtml(item.recommendation)}</h3>
        <span>${Math.round(item.confidence * 100)}% confidence</span>
      </div>
      <p>${escapeHtml(item.type)} - evidence: ${item.evidence_ids.join(", ")}</p>
      <pre>${escapeHtml(item.draft)}</pre>
      <div class="button-row">
        <button class="primary-button" data-review-action="approve" data-recommendation-id="${item.id}" title="Approve recommendation">Approve</button>
        <button class="secondary-button" data-review-action="edit" data-recommendation-id="${item.id}" title="Mark recommendation for edits">Needs edit</button>
        <button class="danger-button" data-review-action="reject" data-recommendation-id="${item.id}" title="Reject recommendation">Reject</button>
      </div>
    </article>
  `;
}

function renderSampleImport(sample) {
  const validation = validateCaseImport(sample);
  return `
    <article class="artifact-item">
      <div class="artifact-heading">
        <strong>${escapeHtml(sample.sampleCaseId)}</strong>
        <span class="${validation.valid ? "tag" : "tag warning-tag"}">${validation.valid ? "valid" : "invalid"}</span>
      </div>
      <div class="mini-meta">
        <span>case: ${escapeHtml(sample.caseId)}</span>
        <span>period: ${escapeHtml(sample.period)}</span>
        <span>baseline: ${escapeHtml(sample.baseline.manualPrepMinutes)} min</span>
      </div>
      <p>${escapeHtml(sample.title)}</p>
      ${
        validation.valid
          ? ""
          : `<p class="warning-copy">${escapeHtml(validation.errors.join(" "))}</p>`
      }
      <button class="secondary-button" data-load-sample data-sample-case-id="${escapeHtml(sample.sampleCaseId)}" title="Load sample case">Load sample</button>
    </article>
  `;
}

function renderValidationImportPanel() {
  return `
    <form id="validation-import-form" class="validation-form">
      <label>
        Phase 2 case JSON
        <textarea name="caseImportJson" rows="8" placeholder='{"importVersion":"phase2.treuhand.case.v1","caseId":"case_anonymized_001",...}' required></textarea>
      </label>
      <button type="submit" class="primary-button" title="Validate and load anonymized case">Validate and load case</button>
    </form>
    ${renderValidationStatus(store.validationImportStatus)}
  `;
}

function renderValidationExportPanel(caseRecord, latestRun, latestRecord) {
  const packageJson =
    store.validationExportPackage?.caseId === caseRecord.id
      ? JSON.stringify(store.validationExportPackage, null, 2)
      : "";
  const canBuild = latestRun && latestRecord;
  const source = latestRecord?.reviewerRating?.ratingSource || "none";
  const caseSource = latestRecord?.caseSource || caseRecord.validation?.caseSource || caseRecord.sourceSystem || "manual";

  return `
    <div class="summary-grid metric-grid">
      ${metricTile("Case", caseRecord.id)}
      ${metricTile("Run", latestRun ? latestRun.id : "none")}
      ${metricTile("Validation", latestRecord ? latestRecord.validationRecordId : "none")}
      ${metricTile("Rating source", source)}
      ${metricTile("Case source", caseSource)}
    </div>
    <div class="button-row">
      <button class="primary-button" id="build-validation-export" title="Build validation package" ${canBuild ? "" : "disabled"}>Build export package</button>
      ${packageJson ? `<button class="secondary-button" id="clear-validation-export" title="Clear validation package output">Clear export</button>` : ""}
    </div>
    ${renderValidationStatus(store.validationExportStatus)}
    ${
      packageJson
        ? `<label class="export-output-label">Export package JSON<textarea class="export-output" rows="14" readonly>${escapeHtml(packageJson)}</textarea></label>`
        : emptyState("Save a human reviewer capture, then build a local validation package.")
    }
  `;
}

function renderValidationStatus(status) {
  if (!status) return "";
  const errors = status.errors?.length ? `<ul class="plain-list">${status.errors.map((error) => `<li>${escapeHtml(error)}</li>`).join("")}</ul>` : "";
  return `
    <div class="artifact-item ${status.status === "error" ? "severity-high" : ""}">
      <div class="artifact-heading">
        <strong>${escapeHtml(status.status)}</strong>
        <span>${escapeHtml(status.caseId || status.runId || "local")}</span>
      </div>
      <p>${escapeHtml(status.message)}</p>
      ${errors}
    </div>
  `;
}

function renderChecklistConfigItem(item) {
  return `
    <article class="artifact-item">
      <div class="artifact-heading">
        <strong>${escapeHtml(item.id)}</strong>
        <span>${item.required ? "required" : "optional"}</span>
      </div>
      <p>${escapeHtml(item.label)}</p>
      <div class="mini-meta">
        <span>aliases: ${escapeHtml(item.aliases.join(", "))}</span>
      </div>
    </article>
  `;
}

function renderValidationCaptureForm(caseRecord, latestRun, latestRecord) {
  const baseline = latestRecord?.baseline || caseRecord.validation?.baseline || {};
  const rating = latestRecord?.reviewerRating || caseRecord.validation?.reviewerRating || {};
  const selectedTags = new Set(latestRecord?.failureTagIds || rating.failureTagIds || []);
  const missingBaselineState = baseline.humanMissingItemIdsCaptured
    ? (baseline.humanMissingItemIds || []).length > 0
      ? "confirmed_ids"
      : "confirmed_none"
    : "not_captured";
  const traceNote =
    latestRecord?.traceAnnotations?.[0]?.note ||
    caseRecord.validation?.traceAnnotations?.[0]?.note ||
    "";

  return `
    <form id="validation-form" class="validation-form">
      <div class="form-row">
        <label>
          Manual prep minutes
          <input name="manualPrepMinutes" type="number" min="0" step="1" value="${escapeHtml(baseline.manualPrepMinutes ?? 0)}" required />
        </label>
        <label>
          Manual handoffs
          <input name="manualHandoffCount" type="number" min="0" step="1" value="${escapeHtml(baseline.manualHandoffCount ?? 0)}" required />
        </label>
      </div>
      <fieldset class="tag-fieldset">
        <legend>Human missing-item baseline</legend>
        <label class="checkbox-label">
          <input name="humanMissingBaselineState" type="radio" value="not_captured" ${missingBaselineState === "not_captured" ? "checked" : ""} />
          Not captured yet
        </label>
        <label class="checkbox-label">
          <input name="humanMissingBaselineState" type="radio" value="confirmed_none" ${missingBaselineState === "confirmed_none" ? "checked" : ""} />
          Confirmed: no missing checklist items
        </label>
        <label class="checkbox-label">
          <input name="humanMissingBaselineState" type="radio" value="confirmed_ids" ${missingBaselineState === "confirmed_ids" ? "checked" : ""} />
          Confirmed: listed missing checklist item IDs
        </label>
        <input name="humanMissingItemIds" value="${escapeHtml((baseline.humanMissingItemIds || []).join(", "))}" placeholder="vat_report, payroll_summary" />
      </fieldset>
      <div class="form-row">
        <label>
          Usefulness
          <input name="overallUsefulness" type="number" min="0" max="5" step="1" value="${escapeHtml(rating.overallUsefulness ?? 0)}" required />
        </label>
        <label>
          Checklist trust
          <input name="checklistTrust" type="number" min="0" max="5" step="1" value="${escapeHtml(rating.checklistTrust ?? 0)}" required />
        </label>
        <label>
          Evidence traceability
          <input name="evidenceTraceability" type="number" min="0" max="5" step="1" value="${escapeHtml(rating.evidenceTraceability ?? 0)}" required />
        </label>
      </div>
      <div class="form-row">
        <label>
          Reviewer minutes saved
          <input name="timeSavedMinutes" type="number" min="0" step="1" value="${escapeHtml(rating.timeSavedMinutes ?? 0)}" required />
        </label>
        <label class="checkbox-label">
          <input name="wouldUseAgain" type="checkbox" ${rating.wouldUseAgain ? "checked" : ""} />
          Would use again
        </label>
      </div>
      <fieldset class="tag-fieldset">
        <legend>Failure tags</legend>
        <div class="tag-grid">
          ${FAILURE_TAGS.map((tag) => renderFailureTagCheckbox(tag, selectedTags)).join("")}
        </div>
      </fieldset>
      <label>
        Reviewer notes
        <textarea name="reviewerNotes" rows="3">${escapeHtml(rating.notes || "")}</textarea>
      </label>
      <label>
        Trace annotation for ${escapeHtml(latestRun.id)}
        <textarea name="traceNote" rows="3" required>${escapeHtml(traceNote)}</textarea>
      </label>
      <button type="submit" class="primary-button" title="Save validation record">Save validation record</button>
    </form>
  `;
}

function renderFailureTagCheckbox(tag, selectedTags) {
  return `
    <label class="checkbox-label tag-checkbox">
      <input name="failureTagIds" type="checkbox" value="${escapeHtml(tag.id)}" ${selectedTags.has(tag.id) ? "checked" : ""} />
      <span>
        <strong>${escapeHtml(tag.label)}</strong>
        <small>${escapeHtml(tag.id)}</small>
      </span>
    </label>
  `;
}

function renderAuditEvent(event) {
  return `
    <article class="audit-event">
      <strong>${escapeHtml(event.eventType)}</strong>
      <span>${escapeHtml(event.message)}</span>
      <time>${formatTime(event.createdAt)}</time>
    </article>
  `;
}

function renderContextPacket(packet) {
  return `
    <article class="artifact-item">
      <div class="artifact-heading">
        <strong>${escapeHtml(packet.id)}</strong>
        <span class="tag">${escapeHtml(packet.sensitivity)}</span>
      </div>
      <div class="mini-meta">
        <span>case: ${escapeHtml(packet.caseId)}</span>
        <span>source: ${escapeHtml(packet.source_type)}</span>
        <span>system: ${escapeHtml(packet.source_system)}</span>
        <span>actor: ${escapeHtml(packet.actor)}</span>
      </div>
      <p>${escapeHtml(packet.content_text).slice(0, 220)}${packet.content_text.length > 220 ? "..." : ""}</p>
      <div class="mini-meta">
        <span>evidence: ${escapeHtml(packet.evidence_ids.join(", "))}</span>
        <span>allowed: ${escapeHtml(packet.allowed_uses.join(", "))}</span>
        <span>forbidden: ${escapeHtml(packet.forbidden_uses.join(", "))}</span>
        ${packet.taint?.promptInjectionSuspected ? `<span>taint: prompt-injection</span>` : ""}
      </div>
      ${packet.warnings.length > 0 ? `<p class="warning-copy">${escapeHtml(packet.warnings.join(" "))}</p>` : ""}
    </article>
  `;
}

function renderControlAgentTile(code, outputs) {
  const count = outputs.filter((item) => item.agentCode === code).length;
  return `
    <article class="metric-tile control-tile">
      <span>${escapeHtml(code)}</span>
      <strong>${count}</strong>
    </article>
  `;
}

function renderControlSection(title, items, renderer) {
  return `
    <section class="subpanel">
      <div class="subpanel-heading">
        <h3>${escapeHtml(title)}</h3>
        <span>${items.length} records</span>
      </div>
      <div class="artifact-list compact-list">
        ${items.length === 0 ? emptyState(`No ${title.toLowerCase()} for this case.`) : items.map(renderer).join("")}
      </div>
    </section>
  `;
}

function renderAuthorizationDecision(item) {
  return `
    <article class="artifact-item">
      <div class="artifact-heading">
        <strong>${escapeHtml(item.decision)}</strong>
        <span>${escapeHtml(item.action)}</span>
      </div>
      <div class="mini-meta">
        <span>${escapeHtml(item.id)}</span>
        <span>role: ${escapeHtml(item.role)}</span>
        <span>target: ${escapeHtml(item.targetId)}</span>
      </div>
      <p>${escapeHtml(item.reason)}</p>
    </article>
  `;
}

function renderSecurityFinding(item) {
  return `
    <article class="artifact-item severity-${escapeHtml(item.severity)}">
      <div class="artifact-heading">
        <strong>${escapeHtml(item.severity)}</strong>
        <span>${escapeHtml(item.status)}</span>
      </div>
      <div class="mini-meta">
        <span>${escapeHtml(item.id)}</span>
        <span>target: ${escapeHtml(item.targetId)}</span>
        ${item.taint?.promptInjectionSuspected ? `<span>taint: prompt-injection</span>` : ""}
      </div>
      <p>${escapeHtml(item.summary)}</p>
    </article>
  `;
}

function renderGapFinding(item) {
  return `
    <article class="artifact-item">
      <div class="artifact-heading">
        <strong>${escapeHtml(item.status)}</strong>
        <span>${escapeHtml(item.severity)}</span>
      </div>
      <div class="mini-meta">
        <span>${escapeHtml(item.id)}</span>
        <span>run: ${escapeHtml(item.runId || "none")}</span>
      </div>
      <p>${escapeHtml(item.summary)}</p>
      <p class="summary-copy">${escapeHtml(item.proposed_action)}</p>
    </article>
  `;
}

function renderCadenceNudge(item) {
  return `
    <article class="artifact-item">
      <div class="artifact-heading">
        <strong>${escapeHtml(item.status)}</strong>
        <span>${escapeHtml(item.targetType)}</span>
      </div>
      <div class="mini-meta">
        <span>${escapeHtml(item.id)}</span>
        <span>target: ${escapeHtml(item.targetId)}</span>
      </div>
      <p>${escapeHtml(item.summary)}</p>
      <p class="summary-copy">${escapeHtml(item.next_action)}</p>
    </article>
  `;
}

function renderHandoffRequest(item) {
  return `
    <article class="artifact-item">
      <div class="artifact-heading">
        <strong>${escapeHtml(item.status)}</strong>
        <span>${escapeHtml(item.to_agent)}</span>
      </div>
      <div class="mini-meta">
        <span>${escapeHtml(item.id)}</span>
        <span>from: ${escapeHtml(item.from_agent)}</span>
      </div>
      <p>${escapeHtml(item.reason)}</p>
    </article>
  `;
}

function renderMemoryCandidate(item) {
  return `
    <article class="artifact-item">
      <div class="artifact-heading">
        <strong>${escapeHtml(item.status)}</strong>
        <span>${escapeHtml(item.scope)}</span>
      </div>
      <div class="mini-meta">
        <span>${escapeHtml(item.id)}</span>
        <span>agent: ${escapeHtml(item.proposing_agent)}</span>
        <span>confidence: ${Math.round(item.confidence * 100)}%</span>
      </div>
      <p>${escapeHtml(item.proposed_statement)}</p>
    </article>
  `;
}

function renderControlOutput(item) {
  return `
    <article class="artifact-item">
      <div class="artifact-heading">
        <strong>${escapeHtml(item.agentCode)}</strong>
        <span>${escapeHtml(item.status)}</span>
      </div>
      <div class="mini-meta">
        <span>${escapeHtml(item.id)}</span>
        <span>target: ${escapeHtml(item.targetType)}:${escapeHtml(item.targetId)}</span>
      </div>
      <p>${escapeHtml(item.summary)}</p>
    </article>
  `;
}

function latestRunForCase(caseId) {
  return store.agentRuns.find((run) => run.caseId === caseId);
}

function latestValidationRecordForCase(caseId) {
  return store.validationRecords
    .filter((record) => record.caseId === caseId)
    .sort((a, b) => new Date(b.updatedAt || b.createdAt || 0) - new Date(a.updatedAt || a.createdAt || 0))[0] || null;
}

function clearCaseArtifacts(caseId) {
  store.contextPackets = store.contextPackets.filter((item) => item.caseId !== caseId);
  store.controlAgentOutputs = store.controlAgentOutputs.filter((item) => item.caseId !== caseId);
  store.securityFindings = store.securityFindings.filter((item) => item.caseId !== caseId);
  store.authorizationDecisions = store.authorizationDecisions.filter((item) => item.caseId !== caseId);
  store.gapFindings = store.gapFindings.filter((item) => item.caseId !== caseId);
  store.cadenceNudges = store.cadenceNudges.filter((item) => item.caseId !== caseId);
  store.memoryCandidates = store.memoryCandidates.filter((item) => item.caseId !== caseId);
  store.handoffRequests = store.handoffRequests.filter((item) => item.caseId !== caseId);
  store.agentRuns = store.agentRuns.filter((item) => item.caseId !== caseId);
  store.recommendations = store.recommendations.filter((item) => item.caseId !== caseId);
  store.reviewDecisions = store.reviewDecisions.filter((item) => item.caseId !== caseId);
  store.validationRecords = store.validationRecords.filter((item) => item.caseId !== caseId);
  store.auditEvents = store.auditEvents.filter((item) => item.caseId !== caseId);
}

function clearValidationExportState() {
  store.validationExportPackage = null;
  store.validationExportStatus = null;
}

function upsertById(existing = [], incoming = []) {
  const byId = new Map(existing.map((item) => [item.id, item]));
  for (const item of incoming) {
    byId.set(item.id, item);
  }
  return [...byId.values()];
}

function metricTile(label, value) {
  return `
    <article class="metric-tile">
      <span>${escapeHtml(label)}</span>
      <strong>${escapeHtml(value)}</strong>
    </article>
  `;
}

function emptyState(message) {
  return `<p class="empty-state">${escapeHtml(message)}</p>`;
}

function average(values) {
  const clean = values.filter((value) => Number.isFinite(value));
  if (clean.length === 0) return null;
  return Math.round(clean.reduce((sum, value) => sum + value, 0) / clean.length);
}

function calculateOverrideRate(decisions) {
  if (decisions.length === 0) return null;
  const overrides = decisions.filter((decision) => decision.decision === "edit" || decision.decision === "reject").length;
  return Math.round((overrides / decisions.length) * 100);
}

function calculateWouldUseAgainRate(records) {
  if (records.length === 0) return null;
  const positive = records.filter((record) => record.reviewerRating?.wouldUseAgain).length;
  return Math.round((positive / records.length) * 100);
}

function formatTime(value) {
  return new Intl.DateTimeFormat("en", {
    month: "short",
    day: "2-digit",
    hour: "2-digit",
    minute: "2-digit"
  }).format(new Date(value));
}

function escapeHtml(value) {
  return String(value)
    .replaceAll("&", "&amp;")
    .replaceAll("<", "&lt;")
    .replaceAll(">", "&gt;")
    .replaceAll('"', "&quot;")
    .replaceAll("'", "&#039;");
}

render();
