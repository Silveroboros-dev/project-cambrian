import { test } from "node:test";
import assert from "node:assert/strict";

import {
  runLoanUnderwriting,
  buildOfferDraft,
  buildAdverseActionNotice,
  classifyLoanDocument,
  computeAffordabilityIndicator,
  detectSensitiveData,
  smeLoanChecklist,
  consumerLoanChecklist,
  AFFORDABILITY_BANDS,
  LOAN_AGENT_CODE,
  LOAN_TRUTH_LABEL
} from "../src/loanUnderwriting.js";
import { smeLoanCase, consumerLoanCase } from "../src/loanSampleCases.js";

function classificationsFor(caseRecord) {
  return (caseRecord.evidence || []).map((evidence) => ({ evidence, classification: classifyLoanDocument(evidence) }));
}

function stripVolatile(result) {
  const clone = JSON.parse(JSON.stringify(result));
  delete clone.audit.started_at;
  delete clone.audit.completed_at;
  for (const rec of clone.recommendations) delete rec.id;
  return clone;
}

test("loan document classifier recognizes Russian credit documents", () => {
  const byType = Object.fromEntries(classificationsFor(smeLoanCase).map(({ evidence, classification }) => [evidence.id, classification.type]));
  assert.equal(byType.ev_app_sme, "loan_application");
  assert.equal(byType.ev_id_sme, "id_document");
  assert.equal(byType.ev_fin_sme, "financial_statements");
  assert.equal(byType.ev_bank_sme, "bank_statement");
  assert.equal(byType.ev_obl_sme, "obligations_statement");
  assert.equal(byType.ev_coll_sme, "collateral_doc");
});

test("SME hero case lands within policy and refers to a human decision", () => {
  const result = runLoanUnderwriting(smeLoanCase, smeLoanChecklist);
  assert.equal(result.agent_code, LOAN_AGENT_CODE);
  assert.equal(result.truth_label, LOAN_TRUTH_LABEL);
  assert.equal(result.affordability.band, AFFORDABILITY_BANDS.withinPolicy);
  assert.equal(result.metrics.missing_items_count, 0);
  assert.equal(result.recommendations[0].proposed_decision_path, "refer_for_human_approval");
  assert.equal(result.recommendations[0].requires_human_approval, true);
  assert.equal(result.status, "needs_review");
  // affordability inputs are populated and explainable
  assert.ok(result.affordability.inputs.monthlyInstallment > 0);
  assert.ok(result.affordability.inputs.dsti > 0.3 && result.affordability.inputs.dsti < 0.35);
  assert.ok(result.affordability.reasons.some((r) => r.code === "dsti_computed"));
});

test("consumer case with high DSTI is routed to decline recommendation behind a human gate", () => {
  const result = runLoanUnderwriting(consumerLoanCase, consumerLoanChecklist);
  assert.equal(result.affordability.band, AFFORDABILITY_BANDS.outsidePolicy);
  assert.ok(result.affordability.inputs.dsti > 0.5);
  assert.equal(result.recommendations[0].proposed_decision_path, "refer_recommend_decline");
  assert.equal(result.recommendations[0].requires_human_approval, true);
  assert.equal(result.status, "needs_review");
});

test("affordability reasons carry evidence links back to source documents", () => {
  const affordability = computeAffordabilityIndicator(smeLoanCase, classificationsFor(smeLoanCase));
  const incomeReason = affordability.reasons.find((r) => r.code === "income_parsed");
  const installmentReason = affordability.reasons.find((r) => r.code === "installment_estimated");
  assert.ok(incomeReason.evidence_ids.includes("ev_fin_sme"));
  assert.ok(installmentReason.evidence_ids.includes("ev_app_sme"));
});

test("missing required document routes to collect-then-refer, never auto-decision", () => {
  const trimmed = { ...consumerLoanCase, evidence: consumerLoanCase.evidence.filter((e) => e.id !== "ev_obl_con") };
  // lower the request so affordability is within policy, isolating the missing-doc behavior
  trimmed.evidence = trimmed.evidence.map((e) =>
    e.id === "ev_app_con"
      ? { ...e, content: "Заявление на кредит (заявка на кредит). Запрашиваемая сумма: 20 000 000 сум. Срок: 36 месяцев." }
      : e
  );
  const result = runLoanUnderwriting(trimmed, consumerLoanChecklist);
  assert.equal(result.metrics.missing_items_count, 1);
  assert.ok(result.checklist.find((i) => i.checklistItemId === "obligations_statement").status === "open");
  assert.equal(result.recommendations[0].proposed_decision_path, "collect_missing_then_refer");
  assert.equal(result.recommendations[0].requires_human_approval, true);
});

test("insufficient data (no income evidence) yields an insufficient_data band, not a decision", () => {
  const sparse = {
    ...consumerLoanCase,
    evidence: consumerLoanCase.evidence.filter((e) => e.id === "ev_app_con" || e.id === "ev_id_con")
  };
  const result = runLoanUnderwriting(sparse, consumerLoanChecklist);
  assert.equal(result.affordability.band, AFFORDABILITY_BANDS.insufficientData);
  assert.equal(result.recommendations[0].requires_human_approval, true);
});

test("security control flags synthetic sensitive personal data (passport / PINFL)", () => {
  const result = runLoanUnderwriting(consumerLoanCase, consumerLoanChecklist);
  const sensitive = result.warnings.filter((w) => w.message.includes("чувствительные персональные данные"));
  assert.ok(sensitive.length >= 1);
  assert.ok(sensitive.some((w) => w.evidence_ids.includes("ev_id_con")));
});

test("detectSensitiveData recognizes passport, PINFL and card patterns", () => {
  assert.deepEqual(detectSensitiveData("Серия паспорта: AA 1234567").includes("серия и номер паспорта"), true);
  assert.deepEqual(detectSensitiveData("ПИНФЛ 12345678901234").includes("ПИНФЛ/ЖШШИР"), true);
  assert.deepEqual(detectSensitiveData("Карта 4111 1111 1111 1111").includes("номер карты"), true);
});

test("the agent never issues a final decision on its own", () => {
  for (const [caseRecord, checklist] of [[smeLoanCase, smeLoanChecklist], [consumerLoanCase, consumerLoanChecklist]]) {
    const result = runLoanUnderwriting(caseRecord, checklist);
    assert.equal(result.status, "needs_review");
    for (const rec of result.recommendations) {
      assert.equal(rec.requires_human_approval, true);
      assert.ok(!/approved|одобрен/i.test(rec.proposed_decision_path));
    }
  }
});

test("underwriting output is deterministic across runs", () => {
  const first = stripVolatile(runLoanUnderwriting(smeLoanCase, smeLoanChecklist));
  const second = stripVolatile(runLoanUnderwriting(smeLoanCase, smeLoanChecklist));
  assert.deepEqual(first, second);
});

test("offer draft is a local, non-sent artifact carrying the loan terms", () => {
  const uw = runLoanUnderwriting(smeLoanCase, smeLoanChecklist);
  const offer = buildOfferDraft(smeLoanCase, uw, { actor: "кредитный специалист" });
  assert.match(offer, /ПРОЕКТ ОФЕРТЫ/);
  assert.match(offer, /не отправлено/);
  assert.match(offer, /Сумма: 300/);
  assert.match(offer, /DSTI: 34%/);
});

test("adverse-action notice states the DSTI ground and remains a local draft", () => {
  const uw = runLoanUnderwriting(consumerLoanCase, consumerLoanChecklist);
  const notice = buildAdverseActionNotice(consumerLoanCase, uw);
  assert.match(notice, /ОТКАЗ/);
  assert.match(notice, /DSTI/);
  assert.match(notice, /не отправлен/);
});
