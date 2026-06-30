import { runTreuhandAgent } from "./agent.js";
import {
  CONTROL_AGENT_CODES,
  mergeById,
  runAuthorizationAgent,
  runCadenceAgent,
  runDataIngestionAgent,
  runGapAnalyst,
  runSecurityAgent
} from "./controlAgents.js";
import { activeCase, addAuditEvent, loadStore, resetStore, saveStore } from "./state.js";

let store = loadStore();

const views = {
  workspace: document.querySelector("#workspace-view"),
  context: document.querySelector("#context-view"),
  controls: document.querySelector("#controls-view"),
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
  renderContext();
  renderControls();
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

  views.metrics.innerHTML = `
    <div class="panel-header">
      <div>
        <p class="eyebrow">Metrics</p>
        <h2>Operating proof dashboard</h2>
      </div>
    </div>
    <div class="summary-grid metric-grid">
      ${metricTile("Reviewed cases", String(reviewedCaseIds.size))}
      ${metricTile("Avg minutes saved", avgMinutesSaved === null ? "n/a" : String(avgMinutesSaved))}
      ${metricTile("Evidence coverage", avgEvidenceCoverage === null ? "n/a" : `${avgEvidenceCoverage}%`)}
      ${metricTile("Override rate", overrideRate === null ? "n/a" : `${overrideRate}%`)}
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

  const output = runTreuhandAgent(caseRecord);
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
            .map((item) => `<li><span class="${item.status === "complete" ? "ok" : "warn"}">${item.status}</span> ${escapeHtml(item.item)}</li>`)
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
