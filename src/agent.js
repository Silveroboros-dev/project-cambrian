export const AGENT_CODE = "A-TREU-001";

export const agentBacklog = [
  {
    code: "A-TREU-001",
    vertical: "Treuhand/accounting",
    name: "Client Document Intake and Closing Prep Agent",
    status: "active",
    priority: "P0",
    rice: 98,
    riskLevel: "medium",
    humanApprovalRequired: true,
    primaryMetric: "Avg admin minutes per client package"
  },
  {
    code: "A-SC-001",
    vertical: "SmartCore/payment risk",
    name: "Fraud Alert Triage and Explanation Agent",
    status: "backlog",
    priority: "P0",
    rice: 90,
    riskLevel: "medium",
    humanApprovalRequired: true,
    primaryMetric: "Avg alert triage time"
  },
  {
    code: "A-WM-001",
    vertical: "Wealth/investment",
    name: "Portfolio Review Pack Agent",
    status: "backlog",
    priority: "P0",
    rice: 84,
    riskLevel: "high",
    humanApprovalRequired: true,
    primaryMetric: "Avg review-pack prep time"
  },
  {
    code: "A-TRS-001",
    vertical: "Treasury",
    name: "Cash Position and Liquidity Forecast Agent",
    status: "backlog",
    priority: "P0",
    rice: 84,
    riskLevel: "high",
    humanApprovalRequired: true,
    primaryMetric: "Avg cash-position prep time"
  },
  {
    code: "A-PE-001",
    vertical: "PE/search/acquisition",
    name: "Target Screening and Acquisition Triage Agent",
    status: "backlog",
    priority: "P0",
    rice: 98,
    riskLevel: "medium",
    humanApprovalRequired: true,
    primaryMetric: "Avg target-screening time"
  },
  {
    code: "A-INGEST-001",
    vertical: "Harness/control",
    name: "Data Ingestion Agent",
    status: "active",
    priority: "P0",
    rice: 100,
    riskLevel: "medium",
    humanApprovalRequired: false,
    primaryMetric: "Context packet completeness"
  },
  {
    code: "A-AUTH-001",
    vertical: "Harness/control",
    name: "Permissions and Authorization Agent",
    status: "active",
    priority: "P0",
    rice: 100,
    riskLevel: "high",
    humanApprovalRequired: false,
    primaryMetric: "Unauthorized action block rate"
  },
  {
    code: "A-SEC-001",
    vertical: "Harness/control",
    name: "Security Agent",
    status: "active",
    priority: "P0",
    rice: 100,
    riskLevel: "high",
    humanApprovalRequired: true,
    primaryMetric: "Security findings reviewed"
  },
  {
    code: "A-GAP-001",
    vertical: "Harness/control",
    name: "Gap Analyst",
    status: "active",
    priority: "P0",
    rice: 100,
    riskLevel: "medium",
    humanApprovalRequired: true,
    primaryMetric: "Useful gap findings"
  },
  {
    code: "A-CAD-001",
    vertical: "Harness/control",
    name: "Cadence / Operating Agent",
    status: "active",
    priority: "P0",
    rice: 100,
    riskLevel: "low",
    humanApprovalRequired: false,
    primaryMetric: "Stale work surfaced"
  }
];

export const defaultChecklist = [
  {
    id: "bank_statement",
    label: "Bank statement for period",
    required: true,
    aliases: ["bank_statement"]
  },
  {
    id: "sales_invoice",
    label: "Sales invoices or revenue export",
    required: true,
    aliases: ["sales_invoice"]
  },
  {
    id: "purchase_invoice",
    label: "Purchase invoices and supplier receipts",
    required: true,
    aliases: ["purchase_invoice", "expense_receipt"]
  },
  {
    id: "payroll_summary",
    label: "Payroll summary",
    required: true,
    aliases: ["payroll_summary"]
  },
  {
    id: "vat_report",
    label: "VAT report or quarterly VAT note",
    required: true,
    aliases: ["vat_report"]
  }
];

const documentRules = [
  {
    type: "bank_statement",
    label: "Bank statement",
    keywords: [
      "bank statement",
      "iban",
      "opening balance",
      "closing balance",
      "camt",
      "account statement",
      "bankauszug",
      "kontoauszug"
    ]
  },
  {
    type: "sales_invoice",
    label: "Sales invoice",
    keywords: [
      "sales invoice",
      "customer invoice",
      "invoice to",
      "revenue",
      "debtor",
      "accounts receivable",
      "debitoren",
      "debitorenliste",
      "ausgangsrechnung"
    ]
  },
  {
    type: "purchase_invoice",
    label: "Purchase invoice",
    keywords: [
      "supplier invoice",
      "purchase invoice",
      "vendor",
      "creditor",
      "accounts payable",
      "bill from",
      "kreditoren",
      "kreditorenrechnung",
      "eingangsrechnung",
      "lieferantenrechnung"
    ]
  },
  {
    type: "expense_receipt",
    label: "Expense receipt",
    keywords: ["receipt", "expense", "card payment", "reimbursement", "meal", "travel", "spesen", "spesenbeleg", "quittung"]
  },
  {
    type: "payroll_summary",
    label: "Payroll summary",
    keywords: [
      "payroll",
      "salary",
      "social security",
      "ahv",
      "employee",
      "wage",
      "lohnlauf",
      "lohnabrechnung",
      "lohnjournal",
      "sozialversicherungen"
    ]
  },
  {
    type: "vat_report",
    label: "VAT report",
    keywords: [
      "vat",
      "mwst",
      "mwst-abrechnung",
      "mwst abrechnung",
      "mehrwertsteuer",
      "ust",
      "quarterly filing",
      "tax return",
      "input tax",
      "output tax"
    ]
  }
];

const promptInjectionPatterns = [
  "ignore previous instructions",
  "ignore all instructions",
  "system prompt",
  "developer message",
  "do not tell the accountant",
  "send this automatically",
  "approve without review"
];

export function classifyEvidence(evidence) {
  const haystack = `${evidence.title || ""} ${evidence.content || ""}`.toLowerCase();
  let best = { type: "unknown", label: "Unknown document", score: 0, matches: [] };

  for (const rule of documentRules) {
    const matches = rule.keywords.filter((keyword) => haystack.includes(keyword));
    if (matches.length > best.score) {
      best = {
        type: rule.type,
        label: rule.label,
        score: matches.length,
        matches
      };
    }
  }

  return {
    ...best,
    confidence: best.score === 0 ? 0.24 : Math.min(0.95, 0.55 + best.score * 0.13)
  };
}

export function extractFacts(evidence, classification) {
  const content = evidence.content || "";
  const amountMatches = [...content.matchAll(/(?:CHF|EUR|USD)\s?([0-9][0-9'.,]*)/gi)];
  const dateMatches = [...content.matchAll(/\b(20[0-9]{2}[-./][0-1][0-9][-./][0-3][0-9]|[0-3][0-9][-.\/][0-1][0-9][-.\/]20[0-9]{2})\b/g)];
  const periodMatches = [...content.matchAll(/\b(20[0-9]{2}[-./](0[1-9]|1[0-2])|Q[1-4]\s?20[0-9]{2})\b/gi)];

  const facts = [
    {
      fact_type: "document_classification",
      value: { document_type: classification.type, label: classification.label },
      confidence: classification.confidence,
      evidence_ids: [evidence.id]
    }
  ];

  if (amountMatches.length > 0) {
    facts.push({
      fact_type: "amounts_detected",
      value: { count: amountMatches.length, examples: amountMatches.slice(0, 3).map((match) => match[0]) },
      confidence: 0.82,
      evidence_ids: [evidence.id]
    });
  }

  if (dateMatches.length > 0 || periodMatches.length > 0) {
    facts.push({
      fact_type: "dates_or_periods_detected",
      value: {
        dates: dateMatches.slice(0, 3).map((match) => match[0]),
        periods: periodMatches.slice(0, 3).map((match) => match[0])
      },
      confidence: 0.78,
      evidence_ids: [evidence.id]
    });
  }

  return facts;
}

export function detectEvidenceWarnings(evidence, classification, caseRecord) {
  const warnings = [];
  const content = evidence.content || "";
  const lower = content.toLowerCase();

  if (content.trim().length < 40) {
    warnings.push({
      severity: "medium",
      message: `${evidence.title} has too little text for reliable review.`,
      evidence_ids: [evidence.id]
    });
  }

  if (classification.type === "unknown") {
    warnings.push({
      severity: "medium",
      message: `${evidence.title} could not be classified from deterministic keywords.`,
      evidence_ids: [evidence.id]
    });
  }

  if (caseRecord.period && !lower.includes(caseRecord.period.toLowerCase())) {
    warnings.push({
      severity: "low",
      message: `${evidence.title} does not explicitly mention case period ${caseRecord.period}.`,
      evidence_ids: [evidence.id]
    });
  }

  const injectionHit = promptInjectionPatterns.find((pattern) => lower.includes(pattern));
  if (injectionHit) {
    warnings.push({
      severity: "high",
      message: `Potential prompt-injection instruction found in ${evidence.title}: "${injectionHit}". Evidence treated as facts only.`,
      evidence_ids: [evidence.id]
    });
  }

  return warnings;
}

export function runTreuhandAgent(caseRecord, checklist = defaultChecklist) {
  const startedAt = new Date().toISOString();
  const evidenceItems = caseRecord.evidence || [];
  const classifications = evidenceItems.map((item) => ({
    evidence: item,
    classification: classifyEvidence(item)
  }));

  const facts = classifications.flatMap(({ evidence, classification }) => extractFacts(evidence, classification));
  const warnings = classifications.flatMap(({ evidence, classification }) =>
    detectEvidenceWarnings(evidence, classification, caseRecord)
  );

  const inventory = classifications.map(({ evidence, classification }) => ({
    evidence_id: evidence.id,
    title: evidence.title,
    source_type: evidence.type,
    document_type: classification.type,
    document_label: classification.label,
    confidence: classification.confidence,
    matched_keywords: classification.matches
  }));

  const presentTypes = new Set(inventory.map((item) => item.document_type));
  const checkedEvidenceIds = inventory.map((item) => item.evidence_id);
  const checklistOutput = checklist.map((item) => {
    const present = item.aliases.some((alias) => presentTypes.has(alias));
    const evidenceIds = inventory.filter((doc) => item.aliases.includes(doc.document_type)).map((doc) => doc.evidence_id);
    return {
      checklistItemId: item.id,
      item: item.label,
      required: item.required !== false,
      status: present ? "complete" : "open",
      owner_role: present ? "accountant" : "client_manager",
      evidence_ids: evidenceIds,
      claimSupport: {
        claimType: present ? "checklist_item_present" : "missing_checklist_item",
        checklistItemId: item.id,
        supportType: present ? "matched_evidence" : "absence_from_checked_inventory",
        checkedEvidenceIds,
        matchedEvidenceIds: evidenceIds
      }
    };
  });

  const missingItems = checklistOutput.filter((item) => item.status === "open");
  const missingChecklistItemIds = missingItems.map((item) => item.checklistItemId);
  const duplicateTitles = findDuplicateTitles(evidenceItems);

  for (const duplicateTitle of duplicateTitles) {
    warnings.push({
      severity: "low",
      message: `Possible duplicate evidence title: ${duplicateTitle}.`,
      evidence_ids: evidenceItems.filter((item) => item.title === duplicateTitle).map((item) => item.id)
    });
  }

  const completenessScore =
    checklistOutput.length === 0
      ? 0
      : Math.round((checklistOutput.filter((item) => item.status === "complete").length / checklistOutput.length) * 100);

  const draftEmail = buildReminderEmail(caseRecord, missingItems);
  const reviewPack = buildReviewPack(caseRecord, inventory, missingItems, warnings, completenessScore);
  const estimatedMinutesSaved = estimateMinutesSaved(evidenceItems.length, missingItems.length, warnings.length);

  const recommendation = {
    id: `rec_${cryptoSafeId()}`,
    type: "draft_email",
    recommendation:
      missingItems.length > 0
        ? "Send a missing-document reminder after accountant review."
        : "No missing-document reminder needed; send the case to accountant review.",
    rationale: {
      missing_items_count: missingItems.length,
      missing_checklist_item_ids: missingChecklistItemIds,
      completeness_score: completenessScore,
      warning_count: warnings.length
    },
    checklistItemIds: missingChecklistItemIds,
    confidence: missingItems.length > 0 ? 0.86 : 0.78,
    requires_human_approval: true,
    evidence_ids: inventory.map((item) => item.evidence_id)
  };

  const completedAt = new Date().toISOString();

  return {
    agent_code: AGENT_CODE,
    case_id: caseRecord.id,
    status: "needs_review",
    executive_summary: summarizeCase(caseRecord, evidenceItems.length, missingItems.length, warnings.length, completenessScore),
    facts,
    document_inventory: inventory,
    checklist: checklistOutput,
    recommendations: [recommendation],
    warnings,
    draft_outputs: {
      email_draft: draftEmail,
      review_pack_markdown: reviewPack
    },
    metrics: {
      estimated_minutes_saved: estimatedMinutesSaved,
      documents_processed: evidenceItems.length,
      missing_items_count: missingItems.length,
      completeness_score: completenessScore,
      evidence_coverage: calculateEvidenceCoverage(facts, [recommendation])
    },
    audit: {
      model: "deterministic-keyword-agent-v0",
      prompt_version: "none",
      tools_used: ["document_classifier", "fact_extractor", "checklist_builder", "email_draft_builder"],
      started_at: startedAt,
      completed_at: completedAt
    }
  };
}

function summarizeCase(caseRecord, evidenceCount, missingCount, warningCount, completenessScore) {
  const target = `${caseRecord.clientName || "Client"} ${caseRecord.period || ""}`.trim();
  return `${target}: processed ${evidenceCount} evidence items, checklist completeness ${completenessScore}%, ${missingCount} missing items, ${warningCount} warnings. Human review is required before any client action.`;
}

function buildReminderEmail(caseRecord, missingItems) {
  const client = caseRecord.clientName || "your team";
  const period = caseRecord.period || "the current period";

  if (missingItems.length === 0) {
    return `Subject: ${period} documents received\n\nHello ${client},\n\nThank you for sending the documents for ${period}. The package looks ready for accountant review. We will come back to you if the reviewer finds any open questions.\n\nBest regards`;
  }

  const lines = missingItems.map((item) => `- ${item.item}`).join("\n");

  return `Subject: Missing documents for ${period}\n\nHello ${client},\n\nThank you for sending the documents for ${period}. During the intake check, the following items still appear to be missing:\n\n${lines}\n\nCould you please send these when convenient? A human reviewer will check this before any client-facing message is sent.\n\nBest regards`;
}

function buildReviewPack(caseRecord, inventory, missingItems, warnings, completenessScore) {
  const inventoryLines = inventory
    .map((item) => `- ${item.title}: ${item.document_label} (${Math.round(item.confidence * 100)}%, ${item.evidence_id})`)
    .join("\n");
  const missingLines = missingItems.length === 0 ? "- None detected" : missingItems.map((item) => `- ${item.item}`).join("\n");
  const warningLines = warnings.length === 0 ? "- None" : warnings.map((item) => `- [${item.severity}] ${item.message}`).join("\n");

  return `# ${caseRecord.title}\n\n## Intake status\n\nCompleteness score: ${completenessScore}%\n\n## Document inventory\n\n${inventoryLines || "- No evidence uploaded"}\n\n## Missing items\n\n${missingLines}\n\n## Warnings\n\n${warningLines}\n\n## Human boundary\n\nThis pack is preparation only. It is not a tax filing decision, accounting conclusion, or client instruction.`;
}

function estimateMinutesSaved(evidenceCount, missingCount, warningCount) {
  const base = evidenceCount * 4;
  const checklistLift = Math.max(6, missingCount * 3);
  const warningPenalty = warningCount * 1;
  return Math.max(5, Math.min(45, base + checklistLift - warningPenalty));
}

function calculateEvidenceCoverage(facts, recommendations) {
  const factCoverage = facts.length === 0 ? 1 : facts.filter((fact) => fact.evidence_ids?.length > 0).length / facts.length;
  const recommendationCoverage =
    recommendations.length === 0
      ? 1
      : recommendations.filter((rec) => rec.evidence_ids?.length > 0).length / recommendations.length;
  return Math.round(((factCoverage + recommendationCoverage) / 2) * 100);
}

function findDuplicateTitles(evidenceItems) {
  const counts = new Map();
  for (const item of evidenceItems) {
    counts.set(item.title, (counts.get(item.title) || 0) + 1);
  }
  return [...counts.entries()].filter(([, count]) => count > 1).map(([title]) => title);
}

function cryptoSafeId() {
  if (globalThis.crypto?.randomUUID) {
    return globalThis.crypto.randomUUID().slice(0, 8);
  }
  return Math.random().toString(36).slice(2, 10);
}
