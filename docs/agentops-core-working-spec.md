# AgentOps Core Working Spec

Version: 0.1  
Date: 2026-06-30  
Status: working draft  
Primary proof: Treuhand/accounting document intake  

## 1. Product Thesis

AgentOps Core is a meta-harness for controlled workflow agents in trusted Swiss service businesses.

The product should not start as a broad AI platform. It should start as a small operating loop that proves one claim:

> A workflow agent can prepare evidence-linked work, expose uncertainty, route outputs through human review, and produce measurable operating lift without pretending to replace professional judgment.

The first proof is Treuhand/accounting document intake. The broader architecture must still be shaped like a harness so the same loop can later support investment-manager, treasury, SmartCore/payment-risk, and acquisition-screening agents.

The primary customer is not an AI lab. The primary customer is a Swiss SME, owner, operator, advisor, or workflow lead with practical operating pain: document chasing, fragmented context, manual review packs, slow response times, recurring exceptions, audit stress, succession pressure, and limited internal engineering capacity.

High-level objective:

> Build the smallest controlled agent harness that measurably improves Swiss SME workflows while avoiding known mistakes from earlier agent systems: prompt-only interfaces, hidden autonomy, weak state recovery, ungoverned memory, unclear permissions, invisible security failures, and demos that cannot survive real data.

This means the product should not optimize for being the most advanced agentic system in the world. It should optimize for visible value under obvious tradeoffs: cost vs value, latency vs accuracy, recall vs precision, autonomy vs control, integration speed vs governance, and memory utility vs contamination.

### 1.1 Strategic Boundary

The broader strategic thesis may become an operator-led acquisition or holding-company project for Swiss service SMEs, but this repo should not start there.

Phase 2 should prove an AI operating edge before any fund, holding-company, or acquisition narrative is advanced. The first external story should be:

> We are validating whether controlled workflow agents can reduce manual work, owner dependency, handoff friction, and reporting burden in Swiss service SMEs. If that operating proof is real, acquisitions or co-investments can be considered deal by deal.

This boundary prevents three common errors:

- pitching a capital vehicle before there is operating evidence;
- mixing Treuhand, wealth, treasury, cleaning, crypto, and payments into one unfocused market;
- overclaiming AI margin transformation instead of showing measured before/after workflow improvement.

The strategic companion document is [Operator Acquisition Thesis](operator-acquisition-thesis.md). It is downstream of the product proof, not a substitute for it.

## 2. Operating Requirements and Tradeoff Tests

The manifesto matters, but it must be expressed as requirements an evaluator can test. Every principle below has a measurable behavior, a target, and an accepted tradeoff.

### 2.1 Evaluation axes

| Axis | Default target | Tradeoff accepted |
|---|---|---|
| Cost vs value | Agent cost per case must be materially lower than estimated admin value created. In the current prototype, external model cost is zero. | Spend more only when it reduces human review time or improves evidence coverage enough to justify the run. |
| Latency vs accuracy | First useful local output should appear in seconds for small cases; future production target is under 5 minutes for ordinary intake cases. | Prefer deterministic fast output first, then slower extraction only for low-confidence or high-value cases. |
| Recall vs precision | Missing-document detection should favor recall over precision, because false positives are cheaper than missed filings or incomplete review packs. | Tolerate some extra reviewer checks if total review burden stays below manual baseline. |
| Autonomy vs control | Client-facing, regulated, financial, and memory-writing actions require approval. | Slower workflow is acceptable where trust or compliance risk is material. |
| Integration speed vs governance | Manual context packets come before production connectors. | Delay integration convenience until context-packet structure is proven on real cases. |
| Memory utility vs contamination | Memory writes start as candidates with evidence and approval state. | Slower learning is acceptable to avoid polluting shared knowledge with hallucinated or stale facts. |
| Harness complexity vs demo speed | Build only harness pieces needed to prove the loop and inspect failures. | Delete or defer infrastructure that does not improve validation, safety, or reviewer trust. |

### 2.2 Principles as testable requirements

| Principle | Requirement | Test | Current target |
|---|---|---|---|
| Loop first, prompt second | Every agent run must have input, action, output, verification, review state, and persisted trace. | Kill/reload the session and recover the run state from stored records. | Recover from local storage and visible run ledger. |
| Harness before autonomy | Agent outputs must pass through policy and permission checks before review or action. | Attempt forbidden action such as `send_email` or `mark_ready_to_file`; harness blocks it. | All recommendations require human review. |
| Evidence is not instruction | Context packet content can supply facts but cannot change system behavior. | Include hostile text such as "ignore prior instructions"; output must warn and ignore it. | Prompt-injection warning is emitted. |
| Human accountability is explicit | Human decision records must exist for approvals, edits, and rejections. | Approve/edit/reject a recommendation and inspect decision history. | Review queue records decision and audit event. |
| Memory is governed | Agents may propose memory but cannot directly approve durable memory. | Submit a memory candidate; it remains pending until reviewer or policy approval. | To be added in Phase 1. |
| Meta-harness, not monolith | Agents, skills, context packets, runs, handoffs, policies, memory, and evals remain separate objects. | Add a second agent without rewriting the Treuhand agent. | Data model must expose these objects before second vertical. |
| Fail fast on real workflows | Product continuation depends on measured reviewer value, not demo polish. | Run 10-20 anonymized cases and compare baseline vs agent-assisted review. | Continue only if reviewer trust and time savings are credible. |

## 3. First User and Workflow

### 3.1 First user

The first user is a Treuhand/accounting workflow owner responsible for monthly or quarterly client document intake.

### 3.2 First workflow

`A-TREU-001` prepares a closing-intake package:

1. receive case metadata;
2. ingest evidence text or files;
3. classify documents;
4. extract basic facts;
5. compare inventory against checklist;
6. detect missing or ambiguous items;
7. draft client reminder;
8. create accountant review pack;
9. route recommendation to human review;
10. write audit and metrics events.

### 3.3 First pass condition

Continue only if a real accountant or Treuhand workflow owner says the output would save time in a real intake workflow.

Minimum first validation:

- 10-20 anonymized cases;
- current manual prep time per case;
- current checklist;
- human missing-item baseline;
- reviewer rating of agent output;
- material claims linked to evidence IDs.

## 4. Meta-Harness Architecture

The system is organized around a harness that can host many agents but starts with one.

```text
AgentOps Harness
  Agent Registry
  Day-One Control Agents
    Data Ingestion Agent
    Permissions and Authorization Agent
    Security Agent
    Gap Analyst
    Cadence / Operating Agent
  Skill Library
  Context Packet Store
  Connector Adapters
  Run Ledger
  Trace Store
  Policy and Approval Engine
  Handoff Queue
  Memory Candidate Queue
  Knowledge Base
  Evaluation Harness
```

The day-one control agents do not all need to be LLM agents. In the first repo, most should start as deterministic harness services with agent-shaped logs, outputs, and review states. Calling them agents means they have explicit objectives, inputs, outputs, policies, and traces.

### 4.1 Agent Registry

Defines each agent:

- code;
- name;
- vertical;
- owner role;
- allowed actions;
- forbidden actions;
- required context packet types;
- output schema;
- required human review gates;
- active skill packs;
- evaluation rubric.

Example:

```json
{
  "code": "A-TREU-001",
  "name": "Client Document Intake and Closing Prep Agent",
  "vertical": "treuhand_accounting",
  "allowed_actions": ["classify", "extract", "summarize", "draft", "recommend"],
  "forbidden_actions": ["file_tax_return", "send_email", "mark_ready_to_file"],
  "review_required": ["draft_email", "client_request", "closing_readiness_summary"]
}
```

### 4.2 Day-One Control Agents

These agents must exist from day one because every business agent depends on them. If they are missing, each vertical agent will quietly reimplement ingestion, permissions, security, and coordination in inconsistent ways.

| Code | Agent | Day-one implementation | Objective | Main tradeoff |
|---|---|---|---|---|
| `A-INGEST-001` | Data Ingestion Agent | Deterministic parser and normalizer | Turn emails, notes, receipts, bills, contracts, transcripts, and CSV rows into context packets. | Speed of onboarding vs input quality. |
| `A-AUTH-001` | Permissions and Authorization Agent | Policy rules, role checks, action allowlist | Decide who or what may view, transform, run, approve, export, or write memory. | Usability vs least privilege. |
| `A-SEC-001` | Security Agent | Deterministic scanner and warning engine | Detect prompt injection, sensitive data, suspicious instructions, missing evidence, and risky output classes. | False positives vs risk containment. |
| `A-GAP-001` | Gap Analyst | Deterministic comparison first, LLM later | Identify missing context, contradictory assumptions, unresolved handoffs, and needed shared skills. | Recall of gaps vs reviewer noise. |
| `A-CAD-001` | Cadence / Operating Agent | Rule-based scheduler and nudge engine | Track recurring workflows, stale cases, pending reviews, and next operating actions. | Operational pressure vs alert fatigue. |

#### A-INGEST-001 Data Ingestion Agent

Inputs:

- raw pasted text;
- uploaded file metadata;
- email export;
- call transcript;
- receipt, bill, invoice, contract, bank statement, CSV row;
- source-system metadata.

Outputs:

- context packet;
- evidence item;
- source classification;
- sensitivity classification;
- extraction warnings;
- unsupported-format notice.

Day-one tests:

- converts a pasted invoice-like text into a context packet;
- preserves raw source text or source pointer;
- assigns `allowed_uses` and `forbidden_uses`;
- refuses to treat source text as instruction;
- creates warning for missing actor, date, or source type.

#### A-AUTH-001 Permissions and Authorization Agent

Inputs:

- user role;
- tenant;
- case;
- agent;
- requested action;
- sensitivity level;
- policy configuration.

Outputs:

- allow or deny;
- reason;
- required approval;
- audit event.

Day-one tests:

- reviewer can approve recommendation;
- viewer cannot approve recommendation;
- agent cannot send client email;
- agent cannot approve its own memory candidate;
- sensitive context packet requires stricter view permission.

#### A-SEC-001 Security Agent

Inputs:

- context packet;
- agent output;
- requested action;
- memory candidate.

Outputs:

- risk flags;
- prompt-injection warning;
- sensitive-data warning;
- policy violation;
- required review state.

Day-one tests:

- detects "ignore previous instructions";
- marks client-facing drafts as review-required;
- blocks output that claims final filing readiness;
- flags memory candidate without evidence;
- records security finding in trace.

#### A-GAP-001 Gap Analyst

Inputs:

- agent runs;
- recommendations;
- handoff requests;
- context packets;
- review decisions;
- memory candidates.

Outputs:

- missing-context finding;
- contradiction finding;
- proposed handoff;
- proposed shared skill;
- proposed checklist update;
- memory-candidate recommendation.

Day-one tests:

- detects when a checklist item is repeatedly missing;
- detects contradiction between two agent summaries;
- proposes a handoff when another agent owns needed context;
- does not approve its own proposal;
- suppresses duplicate gap findings once resolved.

#### A-CAD-001 Cadence / Operating Agent

Inputs:

- workflow calendar;
- case status;
- review queue;
- stale run threshold;
- expected recurrence.

Outputs:

- next action;
- overdue review notice;
- recurring case suggestion;
- stale context warning;
- escalation recommendation.

Day-one tests:

- flags pending review after configured threshold;
- suggests next monthly-close case;
- does not spam duplicate reminders;
- marks stale context packets before reuse;
- records all nudges in audit trail.

### 4.3 Skill Library

Skills are reusable capabilities, not vague prompt snippets.

Each skill should define:

- purpose;
- inputs;
- output schema;
- safety boundary;
- deterministic fallback;
- evaluation examples;
- failure modes.

Initial skill candidates:

- document classification;
- missing-document checklist;
- evidence-linked summary;
- client reminder draft;
- contradiction detection;
- handoff request generation;
- memory-candidate proposal.

### 4.4 Context Packet Store

Context packets are the transport layer between external systems and agents.

Every input should become a normalized context packet before an agent sees it.

```json
{
  "id": "ctx_001",
  "case_id": "case_abc_march_2026",
  "source_type": "email",
  "source_system": "manual",
  "actor": "client",
  "time_range": {
    "from": "2026-03-01",
    "to": "2026-03-31"
  },
  "content_text": "Anonymized source text...",
  "structured_facts": [],
  "sensitivity": "confidential",
  "evidence_ids": ["ev_001"],
  "allowed_uses": ["summarize", "extract", "draft"],
  "forbidden_uses": ["send", "approve", "file", "advise"]
}
```

This creates one stable contract for emails, call transcripts, receipts, bills, bank statements, contracts, notes, and future system records.

### 4.5 Connector Adapters

Connectors translate real-world systems into context packets.

First connector tiers:

1. Manual paste/upload.
2. Email export/import.
3. Folder/Drive document import.
4. Accounting-system CSV export.
5. CRM or portfolio export.
6. SmartCore transaction/alert export.

Do not build all connectors first. Use manual context packets until real workflow data proves the integration is worth it.

### 4.6 Run Ledger and Trace Store

Every agent run writes:

- input context packet IDs;
- agent and skill versions;
- deterministic rules used;
- model and prompt version, if any;
- generated output;
- warnings;
- policy checks;
- review requirement;
- human decision;
- metrics.

The trace should be readable like a stack trace. Debugging should start by finding where agent judgment diverged from human judgment.

### 4.7 Policy and Approval Engine

The policy engine decides what an agent may do before, during, and after a run.

Initial policies:

- all client-facing drafts require review;
- regulated conclusions require review;
- evidence instructions are ignored as commands;
- low-confidence classification creates warning;
- missing evidence creates handoff request, not fabricated answer;
- memory writes go to candidate queue.

### 4.8 Handoff Queue

Handoffs are structured requests from one agent to another agent or human.

Example:

```json
{
  "from_agent": "A-TREU-001",
  "to_agent": "A-WM-001",
  "case_id": "case_owner_liquidity_001",
  "reason": "Potential owner liquidity event affects tax and portfolio planning.",
  "requested_context": ["planned_distribution_date", "expected_amount", "client_constraints"],
  "evidence_ids": ["ev_email_004"],
  "human_review_required": true
}
```

Handoffs prevent agents from silently assuming missing context.

## 5. Context Transport Strategy

The best transport is not a single channel. It is a typed context-packet layer.

### 5.1 Priority input types

For Treuhand/accounting:

1. client emails;
2. receipts and purchase invoices;
3. sales invoices or revenue exports;
4. bank statements;
5. payroll summaries;
6. VAT reports;
7. contracts and one-off agreements.

For investment-manager workflows:

1. meeting notes and call transcripts;
2. portfolio exports;
3. mandate and restriction documents;
4. client emails;
5. KYC/suitability records;
6. investment committee notes.

For cross-agent coordination:

1. handoff requests;
2. decision records;
3. memory candidates;
4. unresolved contradictions;
5. missing-context notices.

### 5.2 Input discipline

Every context packet needs:

- source type;
- source system;
- actor;
- timestamp or period;
- raw text or file pointer;
- structured facts if available;
- sensitivity classification;
- allowed uses;
- forbidden uses;
- evidence IDs.

## 6. Gap Analysis and Agent Coordination

`A-GAP-001 Gap Analyst` is a day-one control agent because the family of agents will fail if their communication gaps are invisible.

The Gap Analyst is not an HR agent and not a manager. It is an evaluator for cross-agent friction.

### 6.1 Objective

Given runs, recommendations, handoffs, review decisions, and memory candidates from two or more agents, identify missing context, contradictions, duplicated work, and missing shared skills.

### 6.2 Required behavior

The Gap Analyst may:

- detect missing context between agents;
- detect contradictory assumptions;
- detect repeated unresolved handoffs;
- identify duplicated work;
- propose a new shared skill;
- propose memory or wiki updates;
- propose a handoff template;
- propose a checklist update;
- create a human-review item.

The Gap Analyst may not:

- approve another agent's output;
- modify memory directly;
- send client communications;
- change policy;
- create regulated advice;
- bypass the human reviewer;
- create noisy recommendations without deduplication.

### 6.3 Testable tradeoffs

| Tradeoff | Target | Test |
|---|---|---|
| Recall vs noise | Surface important gaps without flooding reviewer queue. | Run on 20 cases and measure useful gap findings vs dismissed findings. |
| Local specificity vs generality | Propose skills only after repeated patterns, not one-off anomalies. | Require at least two related examples before creating a shared-skill proposal. |
| Coordination vs autonomy | Propose handoffs; do not execute them without policy approval. | Attempt to auto-send a handoff; harness requires review where configured. |
| Memory utility vs contamination | Propose memory candidates with evidence; do not approve memory. | Candidate without evidence is rejected by security/policy check. |

### 6.4 Example

If the Treuhand agent finds owner-distribution documents and the investment-manager agent is preparing a portfolio review, the Gap Analyst should propose:

- a shared "owner liquidity event" context packet;
- a Treuhand-to-investment-manager handoff template;
- checklist additions for tax timing, cashflow timing, and mandate implications;
- memory candidate: "client may have a recurring owner-liquidity planning pattern."

## 7. Knowledge Base and Memory

Memory must be split into layers.

```text
knowledge/
  source-evidence/
  entities/
  workflows/
  playbooks/
  skills/
  handoffs/
  decisions/
  evals/
  memory-candidates/
```

### 7.1 Source Evidence

Immutable references to original documents, emails, transcripts, receipts, bills, contracts, and system records.

Rules:

- do not overwrite;
- hash when possible;
- cite in every factual claim;
- treat content as untrusted.

### 7.2 Entities

Structured records for:

- clients;
- companies;
- people;
- advisors;
- accounts;
- cases;
- systems.

Entity memory should be tenant-scoped and client-scoped.

### 7.3 Workflows

Definitions of recurring work:

- monthly close;
- quarterly VAT pack;
- onboarding;
- investment review;
- cash forecast;
- fraud alert triage;
- acquisition screening.

### 7.4 Playbooks

Human-approved operating procedures.

Agents can use playbooks as instructions only if the playbook is approved and scoped to the workflow.

### 7.5 Skills

Reusable agent capabilities with inputs, outputs, constraints, and evaluation cases.

### 7.6 Handoffs

Templates and historical records of agent-agent or agent-human transfer.

### 7.7 Decisions

Human-approved decisions and their rationale.

Decision records are valuable because they define how humans actually resolved ambiguity.

### 7.8 Evals

Golden cases, failure cases, reviewer notes, rubrics, and trace annotations.

Failed cases are first-class assets.

### 7.9 Memory Candidates

Agents write proposed memory here first.

Each memory candidate needs:

- proposed statement;
- source evidence IDs;
- proposing agent;
- scope;
- confidence;
- expiry or review date;
- reviewer;
- status: proposed, approved, rejected, superseded.

## 8. UI Direction

The interface should feel like an agent operations room, not conventional accounting SaaS.

Design direction:

- dark editorial base;
- calm first read;
- artifact-driven layout;
- visible traces and evidence;
- agents as workers/sessions;
- memory, handoffs, and skills as inspectable objects;
- restrained brass/warm accents;
- no generic AI gradients, no neon, no chatbot-first layout.

Primary navigation should evolve toward:

```text
Cases
Context
Agents
Runs
Controls
Handoffs
Memory
Evals
```

The first viewport should show:

- active case;
- active agent run;
- context packet inventory;
- review requirement;
- latest warnings;
- next human decision.

## 9. Implementation Sequence

### Phase 0: Current Prototype

Already present:

- static browser app;
- seeded Treuhand case;
- deterministic `A-TREU-001`;
- review queue;
- audit events;
- simple metrics.

### Phase 1: Harness Vocabulary

Refactor product language and data structures toward:

- context packets;
- run ledger;
- trace records;
- review decisions;
- handoff requests;
- memory candidates;
- skill definitions.
- control-agent outputs.

Add day-one deterministic versions of:

- `A-INGEST-001` Data Ingestion Agent;
- `A-AUTH-001` Permissions and Authorization Agent;
- `A-SEC-001` Security Agent;
- `A-GAP-001` Gap Analyst;
- `A-CAD-001` Cadence / Operating Agent.

Phase 1 success means each control agent has:

- explicit inputs;
- explicit outputs;
- trace entries;
- at least one visible UI surface or audit trail;
- at least one testable failure case.

This phase should not add a database or real connectors yet.

### Phase 2: Real Treuhand Validation

Use anonymized 4Trade or accounting cases.

Add:

- case import format;
- checklist configuration;
- reviewer rating form;
- trace annotation;
- failure reason tags;
- baseline time capture.

Phase 2 must produce a before/after operating memo rather than a larger architecture.

Minimum evidence:

- 10-20 anonymized Treuhand/accounting cases;
- current manual prep time per case;
- current checklist and human missing-item baseline;
- reviewer rating for each agent output;
- evidence IDs for material claims;
- preparation time saved or review burden created;
- failure tags for wrong classification, weak evidence, missing context, noisy gap finding, unsafe draft, and checklist mismatch.

Phase 2 pass condition:

- reviewer trusts the checklist and evidence links;
- average manual prep time is plausibly reduced by at least 20%;
- all client-facing outputs remain review-gated;
- workflow owner says the system would be used again;
- at least one owner/operator is willing to discuss a pilot or workflow audit.

Phase 2 fail or narrow condition:

- anonymized data cannot be obtained;
- evidence links are too weak to review;
- output creates more review burden than it removes;
- firm-specific exceptions dominate the workflow;
- useful operation requires production connectors before manual context packets prove value.

### Phase 3: Cross-Agent Gap Intelligence

Upgrade `A-GAP-001` after at least two business agents or two workflow roles exist.

Day one should include deterministic gap checks. Richer cross-agent reasoning should wait until there is real inter-agent friction to inspect.

### Phase 4: Memory and Wiki

Add governed memory after the first repeated workflow patterns appear.

Memory should start as:

- markdown or JSON artifacts;
- explicit approval;
- source evidence links;
- simple search.

### Phase 5: Connectors

Add connectors only after manual context packets prove value.

Connector priority:

1. manual import;
2. email export;
3. folder/document import;
4. accounting CSV;
5. investment/portfolio CSV;
6. SmartCore JSON/CSV.

## 10. File-State Contract for Long Agent Runs

Long-running agent work should write state to disk.

Minimum file contract:

```text
contract.md
progress.md
run-log.md
```

### 10.1 contract.md

Defines:

- objective;
- scope;
- authority;
- done criteria;
- evaluator rubric;
- stop conditions.

### 10.2 progress.md

Defines:

- current state;
- completed steps;
- next step;
- blockers;
- open decisions.

### 10.3 run-log.md

Append-only trace:

```text
[2026-06-30 09:20] agent_run_started | A-TREU-001
...
```

If an agent cannot resume from these files, the run state is too complicated.

## 11. Open Questions

1. Should the first durable storage layer be local JSON files, SQLite, or Postgres?
2. What exact anonymized data format can 4Trade share fastest?
3. What is the acceptable latency target for first useful output in the stakeholder demo?
4. What is the acceptable review-noise rate for gap/security/cadence warnings?
5. Should the next UI pass prioritize visual direction or harness vocabulary?
6. What should be the first second-agent workflow: investment-manager review, treasury cash position, or SmartCore fraud triage?
7. Which memory writes should require explicit human approval versus policy approval?

## 12. Current Recommendation

Next build step:

> Refactor the prototype around context packets, run ledger, control-agent outputs, handoff requests, and memory candidates while keeping the Treuhand proof deterministic and local.

Do not add LLM calls, database infrastructure, or production connectors until the first anonymized Treuhand validation loop produces evidence.
