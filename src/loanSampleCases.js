// Synthetic, local-only loan fixtures for the bank pilot demo (SME hero + consumer variant).
// All data is fabricated. Personal identifiers (passport series, ПИНФЛ) are fake and exist
// only to demonstrate the security control catching sensitive data. Amounts are in UZS (сум).

export const smeLoanCase = {
  id: "case_loan_sme_001",
  title: "Кредит для МСБ — ООО «Пример-Агро» (синтетический пример)",
  applicantName: "ООО «Пример-Агро»",
  product: "Оборотный кредит для МСБ",
  period: "2026-06",
  caseSource: "loan_fixture",
  sourceSystem: "synthetic_local",
  evidence: [
    {
      id: "ev_app_sme",
      type: "document",
      title: "Кредитная заявка",
      content:
        "Кредитная заявка (заявка на кредит) от ООО «Пример-Агро». Запрашиваемая сумма: 300 000 000 сум. Срок: 60 месяцев. Цель: пополнение оборотных средств. Дата подачи: 2026-06-02."
    },
    {
      id: "ev_id_sme",
      type: "document",
      title: "Паспорт директора",
      content:
        "Паспорт (удостоверение личности) директора. Серия паспорта: AA 1234567. ПИНФЛ: 12345678901234. Данные синтетические."
    },
    {
      id: "ev_fin_sme",
      type: "document",
      title: "Финансовая отчётность",
      content:
        "Финансовая отчётность предприятия за 2025–2026. Годовая выручка стабильна, отчёт о прибылях приложен. Среднемесячный чистый денежный поток: 40 000 000 сум."
    },
    {
      id: "ev_bank_sme",
      type: "document",
      title: "Банковская выписка (6 мес.)",
      content:
        "Банковская выписка по счёту за 6 месяцев. Оборот по счёту стабильный, остаток на счёте положительный. IBAN скрыт."
    },
    {
      id: "ev_obl_sme",
      type: "document",
      title: "Справка о задолженности",
      content:
        "Сведения о текущих обязательствах и кредитная история. Ежемесячный платёж по кредитам: 5 000 000 сум. Просрочек нет."
    },
    {
      id: "ev_coll_sme",
      type: "document",
      title: "Документы по залогу",
      content:
        "Документы по обеспечению: залог оборудования. Предмет залога описан, оценка залога приложена."
    }
  ]
};

export const consumerLoanCase = {
  id: "case_loan_consumer_001",
  title: "Потребительский кредит — Заявитель А (синтетический пример)",
  applicantName: "Заявитель А",
  product: "Потребительский кредит",
  period: "2026-06",
  caseSource: "loan_fixture",
  sourceSystem: "synthetic_local",
  evidence: [
    {
      id: "ev_app_con",
      type: "document",
      title: "Заявление на кредит",
      content:
        "Заявление на кредит (заявка на кредит) от заявителя. Запрашиваемая сумма: 120 000 000 сум. Срок: 24 месяца. Цель: ремонт жилья. Дата подачи: 2026-06-10."
    },
    {
      id: "ev_id_con",
      type: "document",
      title: "Паспорт заявителя",
      content:
        "Паспорт (удостоверение личности) заявителя. Серия паспорта: AB 7654321. ПИНФЛ: 98765432109876. Данные синтетические."
    },
    {
      id: "ev_inc_con",
      type: "document",
      title: "Справка о доходах",
      content:
        "Справка о доходах с места работы. Заработная плата стабильна. Ежемесячный доход: 9 000 000 сум."
    },
    {
      id: "ev_bank_con",
      type: "document",
      title: "Выписка по счёту (3 мес.)",
      content:
        "Банковская выписка по счёту за 3 месяца. Оборот по счёту умеренный."
    },
    {
      id: "ev_obl_con",
      type: "document",
      title: "Сведения об обязательствах",
      content:
        "Сведения о текущих обязательствах и кредитная история. Ежемесячный платёж по кредитам: 1 500 000 сум."
    }
  ]
};

export const loanSampleCases = [smeLoanCase, consumerLoanCase];
