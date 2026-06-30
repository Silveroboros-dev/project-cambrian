import { defaultChecklist, runTreuhandAgent } from "./agent.js";
import { validatePrivacyForExport } from "./rules/securityRules.js";

export const CASE_IMPORT_VERSION = "phase2.treuhand.case.v1";
export const VALIDATION_PACKAGE_VERSION = "phase2.validation.package.v1";

export const FAILURE_TAGS = [
  {
    id: "wrong_classification",
    label: "Wrong classification",
    description: "The agent assigned the wrong document type to evidence."
  },
  {
    id: "weak_evidence",
    label: "Weak evidence",
    description: "The output is technically linked to evidence, but the evidence is too thin to trust."
  },
  {
    id: "missing_context",
    label: "Missing context",
    description: "The agent needed context that was absent from the case packet."
  },
  {
    id: "noisy_gap_finding",
    label: "Noisy gap finding",
    description: "The gap analyst surfaced a low-value or duplicate issue."
  },
  {
    id: "unsafe_draft",
    label: "Unsafe draft",
    description: "A draft could mislead a client or imply action without review."
  },
  {
    id: "checklist_mismatch",
    label: "Checklist mismatch",
    description: "The configured checklist does not match how the reviewer expects the workflow to run."
  }
];

const FAILURE_TAG_IDS = new Set(FAILURE_TAGS.map((tag) => tag.id));
const RATING_SOURCES = new Set(["fixture_seed", "human_capture"]);

export function validateCaseImport(record) {
  const errors = [];

  if (!record || typeof record !== "object") {
    return { valid: false, errors: ["Import record must be an object."] };
  }

  if (record.importVersion !== CASE_IMPORT_VERSION) {
    errors.push(`importVersion must be ${CASE_IMPORT_VERSION}.`);
  }
  if (!record.caseId) errors.push("caseId is required.");
  if (!record.title) errors.push("title is required.");
  if (!record.clientName) errors.push("clientName is required.");
  if (!record.period) errors.push("period is required.");
  if (!Array.isArray(record.evidence) || record.evidence.length === 0) {
    errors.push("evidence must contain at least one item.");
  }
  if (!Array.isArray(record.checklist) || record.checklist.length === 0) {
    errors.push("checklist must contain at least one item.");
  }
  if (!record.baseline || !Number.isFinite(Number(record.baseline.manualPrepMinutes))) {
    errors.push("baseline.manualPrepMinutes is required.");
  }
  if (!record.baseline || !Number.isFinite(Number(record.baseline.manualHandoffCount))) {
    errors.push("baseline.manualHandoffCount is required.");
  }

  for (const [index, item] of (record.evidence || []).entries()) {
    if (!item.id) errors.push(`evidence[${index}].id is required.`);
    if (!item.type) errors.push(`evidence[${index}].type is required.`);
    if (!item.title) errors.push(`evidence[${index}].title is required.`);
    if (!item.content) errors.push(`evidence[${index}].content is required.`);
  }

  for (const [index, item] of (record.checklist || []).entries()) {
    if (!item.id) errors.push(`checklist[${index}].id is required.`);
    if (!item.label) errors.push(`checklist[${index}].label is required.`);
    if (!Array.isArray(item.aliases) || item.aliases.length === 0) {
      errors.push(`checklist[${index}].aliases must contain at least one alias.`);
    }
  }

  for (const tagId of record.reviewerRating?.failureTagIds || []) {
    if (!FAILURE_TAG_IDS.has(tagId)) {
      errors.push(`Unknown failure tag: ${tagId}.`);
    }
  }

  if (record.reviewerRating?.ratingSource && !RATING_SOURCES.has(record.reviewerRating.ratingSource)) {
    errors.push("reviewerRating.ratingSource must be fixture_seed or human_capture.");
  }

  return { valid: errors.length === 0, errors };
}

export function parseCaseImportJson(jsonText) {
  let parsed;
  try {
    parsed = JSON.parse(String(jsonText || "").trim());
  } catch (error) {
    return {
      valid: false,
      errors: [`Invalid JSON: ${error.message}.`],
      record: null
    };
  }

  const validation = validateCaseImport(parsed);
  const privacy = validatePrivacyForExport(parsed);
  const errors = [...validation.errors, ...privacy.issues.map((issue) => `Privacy check failed: ${issue.message}`)];

  return {
    valid: errors.length === 0,
    errors,
    record: errors.length === 0 ? prepareManualCaseImport(parsed) : null
  };
}

export function prepareManualCaseImport(record) {
  const prepared = {
    ...record,
    sourceSystem: "manual_anonymized_packet"
  };
  delete prepared.reviewerRating;
  delete prepared.traceAnnotations;
  return prepared;
}

export function normalizeCaseImport(record, importedAt = new Date().toISOString()) {
  const validation = validateCaseImport(record);
  if (!validation.valid) {
    throw new Error(`Invalid Phase 2 case import: ${validation.errors.join(" ")}`);
  }

  return {
    id: record.caseId,
    title: record.title,
    clientName: record.clientName,
    period: record.period,
    status: "needs_agent_run",
    priority: record.priority || "normal",
    owner: record.owner || "Client manager",
    sourceSystem: record.sourceSystem || "manual_anonymized_packet",
    createdAt: importedAt,
    updatedAt: importedAt,
    evidence: record.evidence.map((item) => ({
      id: item.id,
      type: item.type,
      title: item.title,
      content: item.content,
      actor: item.actor || "unknown",
      receivedAt: item.receivedAt || importedAt
    })),
    checklist: normalizeChecklist(record.checklist),
    validation: {
      importVersion: record.importVersion,
      sampleCaseId: record.sampleCaseId || record.caseId,
      baseline: normalizeBaseline(record.baseline),
      reviewerRating: record.reviewerRating ? normalizeReviewerRating(record.reviewerRating) : null,
      traceAnnotations: normalizeTraceAnnotations(record.traceAnnotations || [], record.caseId, null, importedAt)
    }
  };
}

export function getCaseChecklist(caseRecord) {
  return normalizeChecklist(caseRecord?.checklist?.length ? caseRecord.checklist : defaultChecklist);
}

export function normalizeChecklist(checklist) {
  return checklist.map((item) => ({
    id: item.id,
    label: item.label,
    required: item.required !== false,
    aliases: Array.isArray(item.aliases) && item.aliases.length > 0 ? item.aliases : [item.id]
  }));
}

export function createValidationRecord({
  caseRecord,
  run,
  reviewerRating,
  baseline,
  traceNote,
  createdAt = new Date().toISOString()
}) {
  const normalizedRating = normalizeReviewerRating(reviewerRating || caseRecord.validation?.reviewerRating || {});
  const normalizedBaseline = normalizeBaseline(baseline || caseRecord.validation?.baseline || {});
  const runId = run?.id || null;
  const ratingId = `rating_${caseRecord.id}_${runId || "no_run"}`;
  const annotationNote =
    traceNote ||
    caseRecord.validation?.traceAnnotations?.[0]?.note ||
    "Reviewer has not added a trace annotation yet.";
  const traceAnnotations = normalizeTraceAnnotations(
    [
      {
        annotationId: `ann_${caseRecord.id}_${runId || "no_run"}`,
        targetType: runId ? "run" : "case",
        note: annotationNote
      }
    ],
    caseRecord.id,
    runId,
    createdAt
  );
  const validationRecordId = `val_${caseRecord.id}_${runId || "no_run"}`;

  return {
    id: validationRecordId,
    validationRecordId,
    caseId: caseRecord.id,
    sampleCaseId: caseRecord.validation?.sampleCaseId || caseRecord.id,
    runId,
    ratingId,
    baseline: normalizedBaseline,
    reviewerRating: {
      ...normalizedRating,
      ratingId
    },
    failureTagIds: normalizedRating.failureTagIds,
    traceAnnotations,
    metrics: summarizeValidationMetrics({ caseRecord, run, reviewerRating: normalizedRating, baseline: normalizedBaseline }),
    memo: buildOperatingMemo({
      caseRecord,
      run,
      validationRecord: {
        baseline: normalizedBaseline,
        reviewerRating: normalizedRating,
        failureTagIds: normalizedRating.failureTagIds,
        traceAnnotations
      }
    }),
    createdAt,
    updatedAt: createdAt
  };
}

export function createValidationPackage({
  caseRecord,
  run,
  validationRecord,
  contextPackets = [],
  securityFindings = [],
  createdAt = new Date().toISOString()
}) {
  if (!caseRecord) {
    throw new Error("Validation package requires a case.");
  }
  if (!run) {
    throw new Error("Validation package requires an agent run.");
  }
  if (!validationRecord) {
    throw new Error("Validation package requires a validation record.");
  }

  const memo =
    validationRecord.memo ||
    buildOperatingMemo({
      caseRecord,
      run,
      validationRecord
    });

  return {
    packageVersion: VALIDATION_PACKAGE_VERSION,
    exportedAt: createdAt,
    caseId: caseRecord.id,
    runId: run.id,
    validationRecordId: validationRecord.validationRecordId || validationRecord.id,
    case: caseRecord,
    run,
    validationRecord: {
      ...validationRecord,
      memo
    },
    memo,
    contextPackets: contextPackets.filter((packet) => packet.caseId === caseRecord.id),
    securityFindings: securityFindings.filter((finding) => finding.caseId === caseRecord.id)
  };
}

export function validateValidationPackagePrivacy(validationPackage) {
  return validatePrivacyForExport(validationPackage);
}

export function runValidationSample(importRecord, createdAt = new Date().toISOString()) {
  const caseRecord = normalizeCaseImport(importRecord, createdAt);
  const output = runTreuhandAgent(caseRecord, getCaseChecklist(caseRecord));
  const run = {
    id: `run_${caseRecord.id}_phase2_fixture`,
    caseId: caseRecord.id,
    agentCode: output.agent_code,
    status: "succeeded",
    output,
    startedAt: output.audit.started_at,
    completedAt: output.audit.completed_at
  };
  const validationRecord = createValidationRecord({
    caseRecord,
    run,
    reviewerRating: caseRecord.validation.reviewerRating,
    baseline: caseRecord.validation.baseline,
    traceNote: caseRecord.validation.traceAnnotations[0]?.note,
    createdAt
  });

  return {
    caseRecord,
    output,
    run,
    validationRecord,
    memo: validationRecord.memo
  };
}

export function buildOperatingMemo({ caseRecord, run, validationRecord }) {
  const output = run?.output;
  const baseline = normalizeBaseline(validationRecord?.baseline || caseRecord.validation?.baseline || {});
  const rating = normalizeReviewerRating(validationRecord?.reviewerRating || caseRecord.validation?.reviewerRating || {});
  const failureTagIds = validationRecord?.failureTagIds || rating.failureTagIds;
  const evidenceIds = output?.document_inventory?.map((item) => item.evidence_id) || caseRecord.evidence.map((item) => item.id);
  const missingItems = output?.checklist?.filter((item) => item.status === "open") || [];
  const missingComparison = compareMissingItems({
    humanMissingItemIds: baseline.humanMissingItemIds,
    agentMissingItemIds: missingItems.map((item) => item.checklistItemId).filter(Boolean)
  });
  const reviewBurden =
    rating.failureTagIds.length === 0
      ? "Low diagnostic burden captured."
      : `${rating.failureTagIds.length} failure tag(s): ${rating.failureTagIds.join(", ")}.`;

  return [
    `# Before/After Operating Memo: ${caseRecord.title}`,
    "",
    `Workflow: Treuhand document intake for ${caseRecord.period}.`,
    `Manual baseline: ${baseline.manualPrepMinutes} minutes and ${baseline.manualHandoffCount} handoff(s).`,
    output
      ? `Agent-assisted result: ${output.metrics.documents_processed} evidence item(s), ${output.metrics.completeness_score}% checklist completeness, ${output.metrics.missing_items_count} missing item(s).`
      : "Agent-assisted result: no agent run captured yet.",
    `Rating source: ${rating.ratingSource}.`,
    `Hours or minutes saved: ${rating.timeSavedMinutes} minutes estimated by reviewer.`,
    `Review burden created: ${reviewBurden}`,
    `Evidence quality: ${output?.metrics.evidence_coverage ?? 0}% positive evidence coverage; missing-item claims checked ${evidenceIds.length} evidence item(s).`,
    `Missing-item scoring: recall ${formatMetricPercent(missingComparison.missingItemRecall)}, precision ${formatMetricPercent(missingComparison.missingItemPrecision)}, false positives ${formatList(missingComparison.falsePositiveMissingItemIds)}, false negatives ${formatList(missingComparison.falseNegativeMissingItemIds)}.`,
    `Recurring failure modes: ${failureTagIds.length === 0 ? "none captured" : failureTagIds.join(", ")}.`,
    `Owner/operator value: ${rating.wouldUseAgain ? "Reviewer would use the workflow again." : "Reviewer would not use the workflow again yet."}`,
    `Decision: ${rating.overallUsefulness >= 4 && rating.wouldUseAgain ? "continue validation" : "narrow or revise before broader pilot"}.`,
    "",
    "Open checklist items:",
    missingItems.length === 0 ? "- None detected" : missingItems.map(formatMissingItem).join("\n"),
    "",
    `Evidence IDs checked: ${evidenceIds.join(", ") || "none"}.`,
    "",
    "Human boundary: this memo is a local validation artifact, not an accounting conclusion, client instruction, or acquisition memo."
  ].join("\n");
}

function normalizeBaseline(baseline) {
  return {
    manualPrepMinutes: Math.max(0, Number(baseline.manualPrepMinutes || 0)),
    manualHandoffCount: Math.max(0, Number(baseline.manualHandoffCount || 0)),
    humanMissingItemIds: Array.isArray(baseline.humanMissingItemIds) ? baseline.humanMissingItemIds : []
  };
}

function normalizeReviewerRating(rating) {
  const failureTagIds = (rating.failureTagIds || []).filter((tagId) => FAILURE_TAG_IDS.has(tagId));
  return {
    ratingSource: normalizeRatingSource(rating.ratingSource),
    overallUsefulness: clampRating(rating.overallUsefulness),
    checklistTrust: clampRating(rating.checklistTrust),
    evidenceTraceability: clampRating(rating.evidenceTraceability),
    timeSavedMinutes: Math.max(0, Number(rating.timeSavedMinutes || 0)),
    wouldUseAgain: Boolean(rating.wouldUseAgain),
    failureTagIds,
    notes: rating.notes || ""
  };
}

function normalizeTraceAnnotations(annotations, caseId, runId, createdAt) {
  return annotations.map((annotation, index) => ({
    id: annotation.annotationId || `ann_${caseId}_${index + 1}`,
    annotationId: annotation.annotationId || `ann_${caseId}_${index + 1}`,
    caseId,
    runId,
    targetType: annotation.targetType || (runId ? "run" : "case"),
    note: annotation.note || "",
    createdAt
  }));
}

function summarizeValidationMetrics({ run, reviewerRating, baseline }) {
  const estimatedSaved = Number(reviewerRating.timeSavedMinutes || 0);
  const manual = Number(baseline.manualPrepMinutes || 0);
  const reduction = manual === 0 ? 0 : Math.round((estimatedSaved / manual) * 100);
  const missingItemComparison = compareMissingItems({
    humanMissingItemIds: baseline.humanMissingItemIds,
    agentMissingItemIds:
      run?.output?.checklist
        ?.filter((item) => item.status === "open")
        .map((item) => item.checklistItemId)
        .filter(Boolean) || []
  });

  return {
    baselineMinutes: manual,
    reviewerEstimatedMinutesSaved: estimatedSaved,
    estimatedReductionPercent: reduction,
    agentEstimatedMinutesSaved: run?.output?.metrics.estimated_minutes_saved || 0,
    evidenceCoverage: run?.output?.metrics.evidence_coverage || 0,
    missingItemsCount: run?.output?.metrics.missing_items_count || 0,
    missingItemRecall: missingItemComparison.missingItemRecall,
    missingItemPrecision: missingItemComparison.missingItemPrecision,
    missingItemComparison
  };
}

function compareMissingItems({ humanMissingItemIds = [], agentMissingItemIds = [] }) {
  const human = new Set(humanMissingItemIds);
  const agent = new Set(agentMissingItemIds);
  const truePositiveMissingItemIds = [...agent].filter((itemId) => human.has(itemId));
  const falsePositiveMissingItemIds = [...agent].filter((itemId) => !human.has(itemId));
  const falseNegativeMissingItemIds = [...human].filter((itemId) => !agent.has(itemId));

  return {
    humanMissingItemIds: [...human],
    agentMissingItemIds: [...agent],
    truePositiveMissingItemIds,
    falsePositiveMissingItemIds,
    falseNegativeMissingItemIds,
    missingItemRecall: human.size === 0 ? (agent.size === 0 ? 100 : 0) : Math.round((truePositiveMissingItemIds.length / human.size) * 100),
    missingItemPrecision: agent.size === 0 ? (human.size === 0 ? 100 : 0) : Math.round((truePositiveMissingItemIds.length / agent.size) * 100)
  };
}

function normalizeRatingSource(value) {
  return RATING_SOURCES.has(value) ? value : "human_capture";
}

function formatMetricPercent(value) {
  return Number.isFinite(value) ? `${value}%` : "n/a";
}

function formatList(values) {
  return values.length === 0 ? "none" : values.join(", ");
}

function formatMissingItem(item) {
  const support = item.claimSupport;
  const checkedCount = support?.checkedEvidenceIds?.length || 0;
  const matchedCount = support?.matchedEvidenceIds?.length || 0;
  return `- ${item.checklistItemId}: ${item.item} (${support?.supportType || "unknown_support"}, checked ${checkedCount}, matched ${matchedCount})`;
}

function clampRating(value) {
  const number = Number(value || 0);
  if (!Number.isFinite(number)) return 0;
  return Math.max(0, Math.min(5, Math.round(number)));
}
