# Uzbekistan — Banking, Data & Credit Regulation for a Governed AI Loan-Underwriting Pitch

> Reference briefing compiled 2026-07-01 from **public sources** via automated research, cross-verified. Confidence tags: **H**/**M**/**L**. "PRIMARY" = official (lex.uz / cbu.uz / gov.uz / EAG-MER). Items that could not be confirmed are marked **UNVERIFIED** — not guessed. This is decision-support for the pitch; the load-bearing claims must be re-confirmed with the bank/counsel before any commitment (see "Open questions").

**Bottom line:** favorable but nuanced for an in-country, human-in-the-loop AI underwriting pilot. Two facts reshape the pitch:
1. Uzbekistan **relaxed** its blanket data-localization rule on **27 March 2026** — so "the law forces you fully in-country" is now an **overclaim**. Honest line: in-country is the **lowest-friction, no-transfer-approval** path, and **biometric/genetic/telecom data must still stay local**.
2. Uzbekistan's **AI law (Senate-approved 1 Nov 2025)** requires **human involvement** in decisions affecting individuals' rights — bars decisions made **solely by AI**. A loan decision is exactly such a decision, so a **human-approval-gated design is compliance-by-construction.** ← strongest alignment with the demo.

---

## 1. Data localization / personal data (Law ZRU-547 + amendments)
- Base law **ZRU-547 "On Personal Data,"** adopted 2 Jul 2019, effective 1 Oct 2019. [H, PRIMARY] lex.uz/docs/4831939
- Localization added by **ZRU-666 (14 Jan 2021)** → **Art. 27-1**: personal data of Uzbek citizens must be collected/stored on databases **physically in Uzbekistan**, registered in the State Register. Effective ~15 Apr 2021. [H, PRIMARY] lex.uz/ru/docs/5220725
- **State Register registration mandatory before processing** (Cabinet Res. No. 71, 8 Feb 2020; ~15-day review). Registry reportedly moved to the **Personalization Agency under the Ministry of Justice from 1 Jan 2023**; monitoring/blocking via Uzkomnazorat. [M/H]
- **Cross-border transfer (Art. 15):** default only to "adequate protection" states; exceptions incl. consent / treaties. [H, PRIMARY]
- **Penalties** (tightened 2021→2022): admin Art. 46-2, criminal Art. 141-2 (100–150 BCU / up to 3 yrs), plus **register of violators + website blocking**. BCU = 412,000 UZS (from 1 Aug 2025). [H secondary; FX approximate]
- **CRITICAL — relaxed 27 Mar 2026** (lex.uz/docs/8099215): most personal data may now be processed **abroad** if simultaneously — adequate country / SCCs / BCRs **+** infosec requirements **+** Uzbek-authority oversight. **BUT biometric, genetic, and telecom-user data must still stay exclusively in Uzbekistan.** [M, recent secondary] kun.uz, Dentons, timesca.com

## 2. Central Bank (CBU) consumer/SME lending & underwriting
- Debt metric is **DSTI** ("показатель долговой нагрузки"), CBU **Reg. No. 3205** (in force 20 Mar 2020). [H, PRIMARY metadata]
- **Cap timeline:** first microloans only (50%); **No. 3205-3 (Feb 2024)** → hard cap **all loans 60% from 1 Jul 2024, tightened to 50% from 1 Jan 2025**. Plus LTV caps (mortgage ≤80%, auto ≤75%) and a 15%-of-portfolio carve-out. [H secondary citing CBU] gazeta.uz
- **No. 3618** (Apr 2025) consolidated macroprudential standards; **3618-1** (eff. 1 Mar 2026) added loan-size cap **≤8× documented / ≤5× estimated monthly income**. [H]
- **DSTI uses credit-bureau data; triggered when new loan + existing principal ≥ 10M UZS.** [H, PRIMARY CBU] finlit.uz
- Credit-risk classification: Reg. **2696** (2015), 5 categories; Macroprudential Framework (2023); Risk-Based Supervision Guidelines (Dec 2023). [M/H, PRIMARY]
- **No banking-specific CBU rule on AI/automated credit decisioning exists** — the binding constraint is the cross-sector AI law (§6). Govt plans an AI alt-scoring platform for entrepreneurs ~1 Dec 2026. [M]
- Consumer protection: Law "On Consumer Credit" **ZRU-33 (2006)**; 2-wk withdrawal; **nominal** annual rate disclosure mandatory (an *effective/APR* mandate is **UNVERIFIED** — do not claim); no rate caps (microloan overpayment cap 50%/yr from Jul 2025); new min-protection Reg. **3030-11** eff. 29 Jan 2026. [H, PRIMARY]

## 3. Credit bureau / credit-information system
- Law **"On the Exchange of Credit Information" ZRU-301 (2011)**, amended **ZRU-1043 (Mar 2025)** adding borrower **"self-restriction."** [H, PRIMARY]
- **Structure (correct the misconception):** **KATM / КИАЦ** ("Credit-Information Analytical Center") is **bank-owned, CBU-licensed** (not "under the CBU"); runs the **ASOKI** exchange. CBU **separately** runs its own **State Register of Credit Information**. Second private bureau **CRIF KAX** licensed Jun 2020. [H, PRIMARY]
- Lenders **must report** without consent; a bureau **releases a report only with subject consent**; one free self-report/yr; in practice all banks pull history before lending. [H, PRIMARY]
- Coverage: private-bureau ~47.8% of adults (2019); ~5M citizens with ≥1 bank loan (2025). **Gap:** non-bank/BNPL debt not fully captured. [M/H]

## 4. AML/CFT & sanctions / KYC
- Core AML law **No. 660-II (2004)**, consolidated to Apr 2025. [H, PRIMARY]
- **FIU = Dept on Combating Economic Crime (DCEC)** under the General Prosecutor's Office; **CBU is the AML supervisor for banks**; banks' Internal Control Rules approved by joint CBU+FIU resolution. [H, PRIMARY EAG-MER]
- **EAG member since 2005**; MER published 2022; **NOT on FATF grey/black list** (as of 2026 lists). [H, PRIMARY]
- **KYC/CDD (Art. 7):** risk-based ID + beneficial owners, ongoing monitoring, STRs. **PEPs:** EDD for foreign PEPs; **domestic PEPs flagged as a 2022 gap** (later addressed via ICR). **Sanctions:** screen national designated-persons list (freeze on match; a law-firm memo cites re-screening ≥ every 3 months); UN lists implemented. [H PRIMARY / M cadence]
- **Identity:** **MyID** national **biometric (Face ID)** remote ID, ~19M+ users, 31+ banks, supports online loan applications; account opening keyed to **PINFL** (MoJ reg. 3420, 2023). **MyID biometrics fall under the data that must stay in-country** (§1). [H]

## 5. Lending market & IT reality
- Scale: total loan portfolio **UZS 533.1tn (1 Jan 2025)** (individuals 177.5tn, legal 355.6tn); bank assets ~924.8tn (~$73.5B) by 1 Jan 2026. [H/M]
- **State-dominated:** ~35–36 banks; state banks ~65% assets / ~68% loans; largest NBU / Agrobank / SQB. Privatization slow. [M, PRIMARY-FSAP]
- Retail: microloans, consumer/cash, mortgage, auto, cards, fast-growing **BNPL/POS**; consumer +410% / auto +264% (2021–23) before DSTI tightening. [M]
- **SME gap ~$6B**; only ~10% small / 16% medium firms have loan access; IFI support (WB FINGROW, ADB, EBRD); national **digital SME-lending platform ~1 Jul 2026**. [H, PRIMARY-IFI]
- **IT reality (supports the FDE deployment-gap + on-prem pitch):** KPMG assesses Uzbek banks as **"outdated IT systems, weak data integration," low AI-adoption maturity**; core-banking replacements run on-prem (e.g., Colvir); 9 state banks mid-transformation. [M]
- Cybersecurity Law **ZRU-764 (2022)**; banking = "critical facility"; State Security Service is cyber regulator; CBU runs a sector CERT. **No explicit "banks must be on-prem" statute** — the on-prem norm is inferred from localization + banking secrecy + critical-infra rules. Do not assert a blanket cloud ban. [H/M; explicit rule UNVERIFIED]

## 6. Strategic — why in-country / human-gated wins (honest framing)
- **Regulatory-friction (post-Mar-2026):** cross-border now needs adequacy/SCCs/BCRs + infosec + Uzbek oversight; **in-country removes that entire approval burden and transfer risk** — lowest-friction, fastest-to-approve — **not** a blanket legal necessity. [M, reasoned]
- **Sensitive data still forces localization:** biometric (MyID), genetic, telecom data must stay in-country. Remote onboarding/underwriting runs on MyID biometrics → that leg is **legally required** to stay local. [M]
- **AI law = tailwind, not threat:** amendments (Senate 1 Nov 2025, amending Law "On Informatization") **bar decisions affecting individuals' rights from being made solely by AI — human involvement required.** A governed, **human-approval-gated** loan pipeline is **compliance-by-construction.** [M/H; effective date UNVERIFIED]
- **Supportive climate:** **AI Strategy to 2030 (PP-358, Oct 2024)** names **creditworthiness assessment** as a target use; an **AI regulatory sandbox** exists (Cabinet Res. 646, 2022) — good for a supervised pilot. Bank secrecy (Law 530-II) + CBU supervision favor controlled, auditable, in-country systems over opaque external ones.
- **Net pitch:** in-country + human-gated turns **three** legal constraints (localization of sensitive data, AI-law human-in-the-loop, DSTI/credit-bureau evidence-based underwriting) into **one coherent selling point.**

## Open questions to verify with the bank
1. Which data actually leaves the perimeter — biometric/telecom (localization-mandatory) vs. ordinary personal data (cross-border-eligible post-Mar-2026)?
2. Exact in-force date/text of the 2025 AI amendments; any CBU banking-specific automated-decisioning guidance.
3. Binding DSTI reg set (3205 vs 3618 family), the 50% DSTI + ≤8×/5× loan-size params, ≥10M-UZS trigger.
4. Which bureau(s) they use (KATM/ASOKI vs CRIF KAX vs CBU register); pull/consent workflow; BNPL visibility.
5. KYC/PEP/sanctions stack: their CBU/FIU Internal Control Rules resolution; sanctions feed + re-screening cadence; domestic-PEP handling.
6. IT/deployment: core-banking vendor, on-prem vs private-cloud, CBU software-approval needs, data-center location.
7. Penalty-exposure baseline (current BCU; their risk view) to quantify the compliance-saving value.
