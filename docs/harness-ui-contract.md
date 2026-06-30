# Harness UI Contract

Version: 0.1  
Date: 2026-06-30  
Scope: Phase 1 AgentOps Core prototype UI  

## Purpose

The Phase 1 UI exposes harness state for control agents. These surfaces must help a Swiss SME owner/operator, Treuhand workflow owner, or reviewer understand whether the workflow is safe, useful, and worth continuing.

The UI must not imply that advisory control-agent output is canonical truth. It must show identity keys, scope, review status, and failure states.

## Surfaces

1. **Case**  
   Shows the active Treuhand case, evidence, latest run, and audit trail.

2. **Context**  
   Shows normalized context packets created from evidence by `A-INGEST-001`.

3. **Controls**  
   Shows day-one control-agent outputs:
   - `A-INGEST-001` Data Ingestion Agent;
   - `A-AUTH-001` Permissions and Authorization Agent;
   - `A-SEC-001` Security Agent;
   - `A-GAP-001` Gap Analyst;
   - `A-CAD-001` Cadence / Operating Agent.

4. **Review**  
   Shows pending human-review items and review decision history.

5. **Metrics**  
   Shows operating-proof metrics, not production KPIs.

## Identity Keys

Every rendered governance object must include or be scoped by:

- `caseId` for case-scoped state;
- `contextPacketId` for normalized source packets;
- `runId` for agent-run outputs;
- `agentCode` for agent or control-agent outputs;
- `findingId`, `decisionId`, `nudgeId`, or `candidateId` for reviewable control output.

## Truth Labels

- Evidence text is raw source material and untrusted.
- Context packets are normalized input records.
- Security findings are advisory unless they trigger a deterministic block.
- Authorization decisions are deterministic policy outputs.
- Gap findings are advisory until accepted by a human or policy.
- Cadence nudges are operational reminders, not commands.
- Memory candidates are proposed memory, not approved memory.
- Human review decisions are the current authoritative action record in the prototype.

## Mutation Rules

Allowed local mutations:

- add evidence;
- create context packets from evidence;
- run deterministic Treuhand agent;
- create control-agent outputs;
- approve/edit/reject recommendations;
- write local audit events.

Forbidden mutations:

- send client emails;
- mark a case ready to file;
- approve memory automatically;
- modify raw evidence after creation;
- treat security/gap/cadence output as final truth;
- create external side effects.

## Acceptance Criteria

### AC-1: Swiss SME Objective

The working spec must state that the project serves Swiss SMEs and their owners/operators, and must explicitly reject building the most advanced agentic system for its own sake.

### AC-2: Context Packet Visibility

The Context surface must show context packets scoped to the active `caseId`, including `contextPacketId`, `source_type`, `source_system`, sensitivity, allowed uses, forbidden uses, and evidence IDs.

### AC-3: Control-Agent Visibility

The Controls surface must show outputs from all five day-one control agents: `A-INGEST-001`, `A-AUTH-001`, `A-SEC-001`, `A-GAP-001`, and `A-CAD-001`.

### AC-4: Security Is Advisory Or Blocking, Not Hidden

Prompt-injection or forbidden-action findings must be visible as security findings and must be associated with the relevant `caseId` and evidence or run identity.

### AC-5: Authorization Decisions Are Explicit

Running the Treuhand agent and approving a recommendation must create visible authorization decisions with allow/deny, reason, role, action, and target ID.

### AC-6: Gap Findings Do Not Mutate Truth

Gap findings may propose handoffs, skills, checklist updates, or memory candidates, but they must remain advisory and must not approve recommendations or memory.

### AC-7: Cadence Nudges Are Not Commands

Cadence output must be labeled as operational nudges and must not change case status without a user action or deterministic workflow action.

### AC-8: Stale State Boundary

Resetting demo state must clear old context packets, control-agent outputs, security findings, authorization decisions, gap findings, cadence nudges, memory candidates, and handoff requests.

### AC-9: Missing State Is Visible

If no context packets or control outputs exist for the active case, the UI must show an explicit empty state instead of silently falling back to unrelated data.

### AC-10: Tests Lock The Contract

Automated tests must assert that these acceptance criteria exist and that deterministic control-agent functions produce identity-scoped output.
