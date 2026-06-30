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
  SITUATION_ROOM_SCENARIOS,
  postSituationMessage,
  resolveSituationApproval,
  runSituationScenario
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
  const timeline = [...roomCards, ...roomMessages]
    .sort((a, b) => new Date(b.createdAt || 0) - new Date(a.createdAt || 0));

  views.situation.innerHTML = `
    <div class="panel-header">
      <div>
        <p class="eyebrow">Situation Room</p>
        <h2>${escapeHtml(activeRoom?.title || "Local operating room")}</h2>
      </div>
      <span class="status-pill">local synthetic scenarios</span>
    </div>
    <div class="summary-grid metric-grid">
      ${metricTile("Rooms", String(rooms.length))}
      ${metricTile("Cards", String(roomCards.length))}
      ${metricTile("Work orders", String(roomWorkOrders.length))}
      ${metricTile("Pending approvals", String(roomApprovals.filter((approval) => approval.status === "pending").length))}
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

      <section class="subpanel situation-main">
        <div class="subpanel-heading">
          <h3>Scenario gallery</h3>
          <span>no external services</span>
        </div>
        <div class="button-row scenario-buttons">
          ${SITUATION_ROOM_SCENARIOS.map(renderScenarioButton).join("")}
        </div>
        <form id="situation-message-form" class="validation-form situation-input">
          <label>
            Agent tag
            <input name="situationMessage" placeholder="@treu run intake review" required />
          </label>
          <button type="submit" class="primary-button" title="Create tagged work order">Tag agent</button>
        </form>
        <div class="mini-meta">
          <span>tags: ${escapeHtml(Object.keys(AGENT_TAGS).join(", "))}</span>
        </div>
        <div class="situation-timeline">
          ${timeline.length === 0 ? emptyState("No messages or cards in this room yet.") : timeline.map(renderTimelineItem).join("")}
        </div>
      </section>

      <aside class="subpanel situation-side">
        <div class="subpanel-heading">
          <h3>Pending approvals</h3>
          <span>${roomApprovals.length}</span>
        </div>
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
  document.querySelectorAll("[data-situation-approval-id]").forEach((button) => {
    button.addEventListener("click", () => handleSituationApproval(button.dataset.situationApprovalId, button.dataset.situationApprovalDecision));
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
  runSituationScenario(store, scenarioId);
  addAuditEvent(store, activeCase(store).id, "situation_scenario_clicked", `Ran ${scenarioId}.`);
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

function renderScenarioButton(scenario) {
  return `
    <button class="secondary-button" data-situation-scenario-id="${escapeHtml(scenario.id)}" title="${escapeHtml(scenario.label)}">
      ${escapeHtml(scenario.label)}
    </button>
  `;
}

function renderTimelineItem(item) {
  if (item.cardId) return renderSituationCard(item);
  return renderRoomMessage(item);
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
  return `
    <article class="situation-card severity-${escapeHtml(card.severity)}">
      <div class="artifact-heading">
        <strong>${escapeHtml(card.title)}</strong>
        <span>${escapeHtml(card.type)}</span>
      </div>
      <p>${escapeHtml(card.summary)}</p>
      <div class="mini-meta">
        <span>${escapeHtml(card.id)}</span>
        ${card.agentId ? `<span>agent: ${escapeHtml(card.agentId)}</span>` : ""}
        ${card.caseId ? `<span>case: ${escapeHtml(card.caseId)}</span>` : ""}
        ${card.runId ? `<span>run: ${escapeHtml(card.runId)}</span>` : ""}
        ${card.approvalId ? `<span>approval: ${escapeHtml(card.approvalId)}</span>` : ""}
        <span>trace: ${escapeHtml(card.traceId)}</span>
      </div>
      ${card.evidenceIds?.length ? `<div class="mini-meta"><span>evidence: ${escapeHtml(card.evidenceIds.join(", "))}</span></div>` : ""}
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
        <span>${escapeHtml(approval.id)}</span>
        <span>agent: ${escapeHtml(approval.requestedByAgentId)}</span>
        <span>approver: ${escapeHtml(approval.approverRole)}</span>
      </div>
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
        <span>${escapeHtml(workOrder.id)}</span>
        ${workOrder.caseId ? `<span>case: ${escapeHtml(workOrder.caseId)}</span>` : ""}
        <span>trace: ${escapeHtml(workOrder.traceId)}</span>
      </div>
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
