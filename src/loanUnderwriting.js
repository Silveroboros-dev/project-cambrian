import { findPromptInjection } from "./rules/securityRules.js";

// A-CRED-001 — Loan Underwriting Prep Agent (sibling of A-TREU-001).
//
// Deterministic, browser-agnostic, unit-tested. It prepares a credit case for a
// HUMAN credit decision: it classifies loan documents, checks the required-document
// checklist, and computes a TRANSPARENT affordability (DSTI) indicator with reason
// codes and evidence links. It never approves, declines, or prices a loan on its own
// — every recommendation carries requires_human_approval: true. The model proposes,
// the human gate decides, and the run is fully auditable.
//
// All demo-facing labels are Russian (pilot audience: regulated UZ/CIS bank). Internal
// identifiers stay English to match the rest of the codebase.

export const LOAN_AGENT_CODE = "A-CRED-001";
export const LOAN_TRUTH_LABEL = "synthetic_local";

// Illustrative underwriting policy — deterministic assumptions used only to compute an
// explainable affordability estimate. NOT a live pricing model or a regulated score.
export const LOAN_POLICY = {
  nominalAnnualRatePct: 24,
  dstiWithinPolicyMax: 0.35,
  dstiReferMax: 0.5,
  currency: "UZS",
  currencyLabel: "сум"
};

export const AFFORDABILITY_BANDS = {
  withinPolicy: "within_policy",
  refer: "refer",
  outsidePolicy: "outside_policy",
  insufficientData: "insufficient_data"
};

export const smeLoanChecklist = [
  { id: "loan_application", label: "Кредитная заявка (подписанная)", required: true, aliases: ["кредитная заявка", "заявка на кредит", "анкета заёмщика"] },
  { id: "id_document", label: "Документ, удостоверяющий личность руководителя", required: true, aliases: ["паспорт", "удостоверение личности"] },
  { id: "financial_statements", label: "Финансовая отчётность предприятия", required: true, aliases: ["финансовая отчётность", "бухгалтерский баланс", "отчёт о прибылях"] },
  { id: "bank_statement", label: "Банковская выписка (6 месяцев)", required: true, aliases: ["банковская выписка", "выписка по счёту"] },
  { id: "obligations_statement", label: "Справка о действующих обязательствах", required: true, aliases: ["действующие обязательства", "кредитная история", "задолженность"] },
  { id: "collateral_doc", label: "Документы по обеспечению (залог)", required: false, aliases: ["залог", "обеспечение", "предмет залога"] }
];

export const consumerLoanChecklist = [
  { id: "loan_application", label: "Заявление на кредит", required: true, aliases: ["заявление на кредит", "заявка на кредит", "анкета заёмщика"] },
  { id: "id_document", label: "Паспорт / удостоверение личности", required: true, aliases: ["паспорт", "удостоверение личности"] },
  { id: "income_proof", label: "Справка о доходах", required: true, aliases: ["справка о доходах", "расчётный лист", "заработная плата"] },
  { id: "bank_statement", label: "Выписка по счёту (3 месяца)", required: true, aliases: ["банковская выписка", "выписка по счёту"] },
  { id: "obligations_statement", label: "Сведения о текущих обязательствах", required: true, aliases: ["текущие обязательства", "кредитная история", "задолженность"] }
];

const loanDocumentRules = [
  { type: "loan_application", label: "Кредитная заявка", keywords: ["кредитная заявка", "заявка на кредит", "заявление на кредит", "анкета заёмщика", "запрашиваемая сумма", "loan application"] },
  { type: "id_document", label: "Удостоверение личности", keywords: ["паспорт", "удостоверение личности", "серия паспорта", "id document", "passport"] },
  { type: "income_proof", label: "Справка о доходах", keywords: ["справка о доходах", "расчётный лист", "заработная плата", "ежемесячный доход", "income", "payslip"] },
  { type: "financial_statements", label: "Финансовая отчётность", keywords: ["финансовая отчётность", "бухгалтерский баланс", "отчёт о прибылях", "выручка", "оборот компании", "financial statements"] },
  { type: "bank_statement", label: "Банковская выписка", keywords: ["банковская выписка", "выписка по счёту", "выписка по счету", "оборот по счёту", "остаток на счёте", "bank statement", "iban"] },
  { type: "obligations_statement", label: "Сведения об обязательствах", keywords: ["действующие обязательства", "текущие обязательства", "кредитная история", "справка о задолженности", "ежемесячный платёж по кредиту", "obligations"] },
  { type: "collateral_doc", label: "Документы по обеспечению", keywords: ["залог", "обеспечение", "предмет залога", "оценка залога", "collateral", "pledge"] }
];

export function classifyLoanDocument(evidence) {
  const haystack = normalize(`${evidence.title || ""} ${evidence.content || ""}`);
  let best = { type: "unknown", label: "Неопознанный документ", score: 0, matches: [] };

  for (const rule of loanDocumentRules) {
    const matches = rule.keywords.filter((keyword) => haystack.includes(normalize(keyword)));
    if (matches.length > best.score) {
      best = { type: rule.type, label: rule.label, score: matches.length, matches };
    }
  }

  return {
    ...best,
    confidence: best.score === 0 ? 0.24 : Math.min(0.95, 0.55 + best.score * 0.13)
  };
}

export function computeAffordabilityIndicator(caseRecord, classifications) {
  const evidenceByType = {};
  for (const { evidence, classification } of classifications) {
    if (!evidenceByType[classification.type]) evidenceByType[classification.type] = evidence;
  }

  const applicationText = textForTypes(classifications, ["loan_application"]);
  const incomeText = textForTypes(classifications, ["income_proof", "financial_statements"]);
  const obligationsText = textForTypes(classifications, ["obligations_statement"]);

  const requestedAmount = extractLabeledAmount(applicationText, ["запрашиваемая сумма", "сумма кредита"]);
  const termMonths = extractLabeledInteger(applicationText, ["срок", "срок кредита"]);
  const monthlyIncome = extractLabeledAmount(incomeText, ["среднемесячный чистый денежный поток", "чистый денежный поток", "ежемесячный доход", "чистый доход", "заработная плата"]);
  const monthlyObligations = extractLabeledAmount(obligationsText, ["ежемесячные обязательства", "ежемесячный платёж", "текущие платежи"]) ?? 0;

  const reasons = [];
  const inputs = {
    requestedAmount,
    termMonths,
    monthlyIncome,
    monthlyObligations,
    annualRatePct: LOAN_POLICY.nominalAnnualRatePct,
    monthlyInstallment: null,
    dsti: null
  };

  const missing = [];
  if (requestedAmount == null || termMonths == null) missing.push("параметры кредита (сумма/срок)");
  if (monthlyIncome == null) missing.push("подтверждённый доход/денежный поток");

  if (missing.length > 0) {
    reasons.push(reason("insufficient_data", `Недостаточно данных для расчёта доступности: ${missing.join(", ")}.`, evidenceIdsForTypes(evidenceByType, ["loan_application", "income_proof", "financial_statements", "obligations_statement"])));
    return {
      band: AFFORDABILITY_BANDS.insufficientData,
      bandLabel: bandLabel(AFFORDABILITY_BANDS.insufficientData),
      inputs,
      reasons,
      requires_human_approval: true
    };
  }

  const monthlyInstallment = estimateInstallment(requestedAmount, termMonths, LOAN_POLICY.nominalAnnualRatePct);
  const dsti = (monthlyInstallment + monthlyObligations) / monthlyIncome;
  inputs.monthlyInstallment = monthlyInstallment;
  inputs.dsti = dsti;

  reasons.push(reason("income_parsed", `Ежемесячный доход/денежный поток: ${formatMoney(monthlyIncome)}.`, evidenceIdsForTypes(evidenceByType, ["income_proof", "financial_statements"])));
  reasons.push(reason("obligations_parsed", `Текущие ежемесячные обязательства: ${formatMoney(monthlyObligations)}.`, evidenceIdsForTypes(evidenceByType, ["obligations_statement"])));
  reasons.push(reason("installment_estimated", `Оценочный платёж по запросу (${formatMoney(requestedAmount)}, ${termMonths} мес., ставка ${LOAN_POLICY.nominalAnnualRatePct}% год.): ${formatMoney(monthlyInstallment)}/мес.`, evidenceIdsForTypes(evidenceByType, ["loan_application"])));
  reasons.push(reason("dsti_computed", `Коэффициент обслуживания долга к доходу (DSTI): ${Math.round(dsti * 100)}%.`, []));

  const band = classifyDsti(dsti);
  reasons.push(reason("policy_band", `Отнесение по политике: ${bandLabel(band)} (порог «в пределах политики» ≤ ${Math.round(LOAN_POLICY.dstiWithinPolicyMax * 100)}%, «на рассмотрение» ≤ ${Math.round(LOAN_POLICY.dstiReferMax * 100)}%).`, []));

  return {
    band,
    bandLabel: bandLabel(band),
    inputs,
    reasons,
    requires_human_approval: true
  };
}

export function runLoanUnderwriting(caseRecord, checklist = consumerLoanChecklist) {
  const startedAt = new Date().toISOString();
  const evidenceItems = caseRecord.evidence || [];
  const classifications = evidenceItems.map((item) => ({ evidence: item, classification: classifyLoanDocument(item) }));

  const inventory = classifications.map(({ evidence, classification }) => ({
    evidence_id: evidence.id,
    title: evidence.title,
    document_type: classification.type,
    document_label: classification.label,
    confidence: classification.confidence,
    matched_keywords: classification.matches
  }));

  const checklistOutput = checklist.map((item) => {
    const required = item.required !== false;
    const support = findChecklistSupport(classifications, item);
    const present = support.length > 0;
    return {
      checklistItemId: item.id,
      item: item.label,
      required,
      status: present ? "complete" : required ? "open" : "optional_absent",
      evidence_ids: support.map((s) => s.evidenceId)
    };
  });

  const missingItems = checklistOutput.filter((item) => item.required && item.status === "open");
  const warnings = collectWarnings(classifications, caseRecord);
  const affordability = computeAffordabilityIndicator(caseRecord, classifications);

  const proposedPath = proposeDecisionPath(affordability.band, missingItems);
  const completenessScore =
    checklistOutput.filter((i) => i.required).length === 0
      ? 0
      : Math.round((checklistOutput.filter((i) => i.required && i.status === "complete").length / checklistOutput.filter((i) => i.required).length) * 100);

  const recommendation = {
    id: `rec_${cryptoSafeId()}`,
    type: "credit_underwriting_prep",
    proposed_decision_path: proposedPath.path,
    recommendation: proposedPath.summary,
    rationale: {
      affordability_band: affordability.band,
      dsti: affordability.inputs.dsti,
      missing_checklist_item_ids: missingItems.map((i) => i.checklistItemId),
      completeness_score: completenessScore,
      warning_count: warnings.length
    },
    confidence: affordability.band === AFFORDABILITY_BANDS.insufficientData ? 0.6 : 0.82,
    requires_human_approval: true,
    evidence_ids: inventory.map((i) => i.evidence_id)
  };

  return {
    agent_code: LOAN_AGENT_CODE,
    truth_label: LOAN_TRUTH_LABEL,
    case_id: caseRecord.id,
    status: "needs_review",
    executive_summary: summarize(caseRecord, evidenceItems.length, missingItems.length, affordability, warnings.length),
    document_inventory: inventory,
    checklist: checklistOutput,
    affordability,
    warnings,
    recommendations: [recommendation],
    draft_outputs: {
      review_pack_markdown: buildReviewPack(caseRecord, inventory, checklistOutput, missingItems, affordability, warnings, completenessScore, proposedPath)
    },
    metrics: {
      documents_processed: evidenceItems.length,
      missing_items_count: missingItems.length,
      completeness_score: completenessScore,
      affordability_band: affordability.band
    },
    audit: {
      model: "deterministic-rule-underwriting-v0",
      prompt_version: "none",
      tools_used: ["loan_document_classifier", "checklist_builder", "affordability_indicator"],
      started_at: startedAt,
      completed_at: new Date().toISOString()
    }
  };
}

// Human-decision outcome artifacts (drafts only — local, never sent).

export function buildOfferDraft(caseRecord, underwriting, options = {}) {
  const a = underwriting.affordability?.inputs || {};
  const who = caseRecord.applicantName || caseRecord.clientName || "Заявитель";
  const actor = options.actor || "кредитный специалист";
  return [
    "ПРОЕКТ ОФЕРТЫ (локально, не отправлено)",
    `Заявитель: ${who}`,
    `Продукт: ${caseRecord.product || "кредит"}`,
    `Сумма: ${formatMoney(a.requestedAmount)}, срок ${a.termMonths ?? "—"} мес., ставка ${a.annualRatePct ?? LOAN_POLICY.nominalAnnualRatePct}% годовых`,
    `Оценочный ежемесячный платёж: ${formatMoney(a.monthlyInstallment)}`,
    `Показатель DSTI: ${a.dsti != null ? Math.round(a.dsti * 100) + "%" : "—"}`,
    `Основание: одобрено (${actor}); в пределах кредитной политики.`,
    "Условия: требуется подпись уполномоченного лица банка. Средства не выдаются автоматически. Это подготовленный проект, а не выдача кредита."
  ].join("\n");
}

export function buildAdverseActionNotice(caseRecord, underwriting, options = {}) {
  const a = underwriting.affordability?.inputs || {};
  const who = caseRecord.applicantName || caseRecord.clientName || "Заявитель";
  const actor = options.actor || "кредитный специалист";
  const grounds = [];
  if (a.dsti != null && underwriting.affordability?.band === AFFORDABILITY_BANDS.outsidePolicy) {
    grounds.push(`показатель DSTI ${Math.round(a.dsti * 100)}% превышает порог политики ${Math.round(LOAN_POLICY.dstiReferMax * 100)}%`);
  }
  const missing = (underwriting.checklist || []).filter((i) => i.required && i.status === "open").map((i) => i.item);
  if (missing.length) grounds.push(`не предоставлены документы: ${missing.join(", ")}`);
  if (grounds.length === 0) grounds.push("на основании оценки кредитоспособности");
  return [
    "ПРОЕКТ УВЕДОМЛЕНИЯ ОБ ОТКАЗЕ (локально, не отправлено)",
    `Заявитель: ${who}`,
    `Решение: отказано на текущих условиях (принято: ${actor}).`,
    `Основание: ${grounds.join("; ")}.`,
    "Возможные шаги: уменьшить сумму или увеличить срок; предоставить недостающие документы; повторно подать заявку.",
    "Решение принято человеком и может быть пересмотрено. Уведомление не отправлено — это подготовленный проект."
  ].join("\n");
}

// --- helpers ---

function proposeDecisionPath(band, missingItems) {
  if (missingItems.length > 0 && band !== AFFORDABILITY_BANDS.outsidePolicy) {
    return { path: "collect_missing_then_refer", summary: "Запросить недостающие документы, затем передать кредитному специалисту на решение. Автоматическое решение не выносится." };
  }
  switch (band) {
    case AFFORDABILITY_BANDS.withinPolicy:
      return { path: "refer_for_human_approval", summary: "В пределах политики. Передать кредитному специалисту для решения (одобрить/запросить/отклонить)." };
    case AFFORDABILITY_BANDS.refer:
      return { path: "refer_to_underwriter", summary: "На границе политики. Требуется рассмотрение андеррайтером — решение принимает человек." };
    case AFFORDABILITY_BANDS.outsidePolicy:
      return { path: "refer_recommend_decline", summary: "Вне политики по DSTI. Рекомендуется отклонение/пересмотр условий — окончательное решение за человеком." };
    default:
      return { path: "collect_data", summary: "Недостаточно данных. Запросить документы перед передачей на решение." };
  }
}

function collectWarnings(classifications, caseRecord) {
  const warnings = [];
  for (const { evidence, classification } of classifications) {
    const content = evidence.content || "";
    if (content.trim().length < 40) {
      warnings.push({ severity: "medium", message: `${evidence.title}: слишком мало текста для надёжной проверки.`, evidence_ids: [evidence.id] });
    }
    if (classification.type === "unknown") {
      warnings.push({ severity: "medium", message: `${evidence.title}: документ не распознан по детерминированным ключевым словам.`, evidence_ids: [evidence.id] });
    }
    const injection = findPromptInjection((content || "").toLowerCase());
    if (injection) {
      warnings.push({ severity: "high", message: `${evidence.title}: обнаружена возможная инъекция инструкций ("${injection}"). Содержимое используется только как факты.`, evidence_ids: [evidence.id] });
    }
    for (const hit of detectSensitiveData(content)) {
      warnings.push({ severity: "high", message: `${evidence.title}: обнаружены чувствительные персональные данные (${hit}). Обрабатывать по политике локального хранения данных (data residency).`, evidence_ids: [evidence.id] });
    }
  }
  return warnings;
}

export function detectSensitiveData(text) {
  const hits = [];
  const value = String(text || "");
  if (/\b\d{14}\b/.test(value)) hits.push("ПИНФЛ/ЖШШИР");
  if (/\b[A-ZА-Я]{2}\s?\d{7}\b/.test(value)) hits.push("серия и номер паспорта");
  if (/\b(?:\d[ -]?){16}\b/.test(value)) hits.push("номер карты");
  return hits;
}

function findChecklistSupport(classifications, checklistItem) {
  const terms = unique([checklistItem.id, checklistItem.label, ...(checklistItem.aliases || [])]).map(normalize).filter((t) => t.length >= 4);
  const results = [];
  for (const { evidence, classification } of classifications) {
    const haystack = normalize(`${evidence.title || ""} ${evidence.content || ""}`);
    const classificationMatch = classification.type === checklistItem.id;
    const termMatch = terms.some((t) => haystack.includes(t));
    if (classificationMatch || termMatch) results.push({ evidenceId: evidence.id });
  }
  return results;
}

function estimateInstallment(principal, termMonths, annualRatePct) {
  const r = annualRatePct / 100 / 12;
  if (r === 0) return Math.round(principal / termMonths);
  const factor = Math.pow(1 + r, -termMonths);
  return Math.round((principal * r) / (1 - factor));
}

function classifyDsti(dsti) {
  if (dsti <= LOAN_POLICY.dstiWithinPolicyMax) return AFFORDABILITY_BANDS.withinPolicy;
  if (dsti <= LOAN_POLICY.dstiReferMax) return AFFORDABILITY_BANDS.refer;
  return AFFORDABILITY_BANDS.outsidePolicy;
}

function bandLabel(band) {
  switch (band) {
    case AFFORDABILITY_BANDS.withinPolicy: return "в пределах политики";
    case AFFORDABILITY_BANDS.refer: return "на рассмотрение андеррайтеру";
    case AFFORDABILITY_BANDS.outsidePolicy: return "вне политики";
    default: return "недостаточно данных";
  }
}

function textForTypes(classifications, types) {
  return classifications.filter(({ classification }) => types.includes(classification.type)).map(({ evidence }) => evidence.content || "").join("\n");
}

function evidenceIdsForTypes(evidenceByType, types) {
  return unique(types.map((t) => evidenceByType[t]?.id).filter(Boolean));
}

function extractLabeledAmount(text, keywords) {
  const lower = normalize(text);
  for (const kw of keywords) {
    const key = normalize(kw);
    const idx = lower.indexOf(key);
    if (idx !== -1) {
      const segment = lower.slice(idx + key.length, idx + key.length + 48);
      const amount = parseAmount(segment);
      if (amount != null) return amount;
    }
  }
  return null;
}

function extractLabeledInteger(text, keywords) {
  const lower = normalize(text);
  for (const kw of keywords) {
    const key = normalize(kw);
    const idx = lower.indexOf(key);
    if (idx !== -1) {
      const segment = lower.slice(idx + key.length, idx + key.length + 24);
      const m = segment.match(/(\d{1,4})/);
      if (m) return Number(m[1]);
    }
  }
  return null;
}

function parseAmount(segment) {
  const m = segment.match(/(\d[\d\s .'’]*)\s*(млрд|млн|тыс)?/i);
  if (!m) return null;
  const digits = m[1].replace(/[\s .'’]/g, "");
  if (!digits) return null;
  let n = Number(digits);
  if (!Number.isFinite(n)) return null;
  const mult = (m[2] || "").toLowerCase();
  if (mult === "тыс") n *= 1e3;
  else if (mult === "млн") n *= 1e6;
  else if (mult === "млрд") n *= 1e9;
  return n;
}

function formatMoney(amount) {
  if (amount == null) return "—";
  return `${Math.round(amount).toLocaleString("ru-RU")} ${LOAN_POLICY.currencyLabel}`;
}

function summarize(caseRecord, evidenceCount, missingCount, affordability, warningCount) {
  const who = caseRecord.applicantName || caseRecord.clientName || "Заявитель";
  return `${who}: обработано ${evidenceCount} документов, недостающих обязательных ${missingCount}, доступность — ${affordability.bandLabel}, предупреждений ${warningCount}. Решение по кредиту принимает человек.`;
}

function buildReviewPack(caseRecord, inventory, checklistOutput, missingItems, affordability, warnings, completenessScore, proposedPath) {
  const inv = inventory.map((i) => `- ${i.title}: ${i.document_label} (${Math.round(i.confidence * 100)}%, ${i.evidence_id})`).join("\n") || "- документы не загружены";
  const check = checklistOutput.map((i) => `- [${statusLabel(i.status)}] ${i.item}`).join("\n");
  const missing = missingItems.length === 0 ? "- нет" : missingItems.map((i) => `- ${i.item}`).join("\n");
  const reasons = affordability.reasons.map((r) => `- ${r.message}`).join("\n");
  const warn = warnings.length === 0 ? "- нет" : warnings.map((w) => `- [${w.severity}] ${w.message}`).join("\n");
  return [
    `# Кредитное досье: ${caseRecord.title}`,
    ``,
    `## Полнота пакета`,
    `Оценка полноты: ${completenessScore}%`,
    ``,
    `## Опись документов`,
    inv,
    ``,
    `## Чек-лист`,
    check,
    ``,
    `## Недостающие обязательные документы`,
    missing,
    ``,
    `## Индикатор доступности (DSTI) — «модель предлагает»`,
    reasons,
    ``,
    `## Предупреждения контроля`,
    warn,
    ``,
    `## Предлагаемый маршрут (решение за человеком)`,
    `- ${proposedPath.summary}`,
    ``,
    `## Граница ответственности`,
    `Это подготовка к решению, а не кредитное решение. Агент не одобряет, не отклоняет и не устанавливает цену. Окончательное решение принимает уполномоченный сотрудник банка. Данные синтетические, обработка локальная.`
  ].join("\n");
}

function statusLabel(status) {
  if (status === "complete") return "есть";
  if (status === "open") return "нет";
  return "необязательный";
}

function reason(code, message, evidence_ids) {
  return { code, message, evidence_ids: evidence_ids || [] };
}

function normalize(value) {
  return String(value || "").toLowerCase().replace(/ /g, " ").replace(/ё/g, "е");
}

function unique(values) {
  return [...new Set(values.filter(Boolean))];
}

function cryptoSafeId() {
  if (globalThis.crypto?.randomUUID) return globalThis.crypto.randomUUID().slice(0, 8);
  return Math.random().toString(36).slice(2, 10);
}
