import { agentBacklog } from "./agent.js";
import {
  mergeById,
  runCadenceAgent,
  runDataIngestionAgent,
  runSecurityAgent
} from "./controlAgents.js";
import { sampleCaseImports } from "./phase2SampleCases.js";

export function createInitialStore() {
  const caseId = "case_demo_march_2026";
  const now = new Date().toISOString();
  const demoCase = {
    id: caseId,
    title: "Client ABC - March 2026 closing prep",
    clientName: "Client ABC",
    period: "2026-03",
    status: "needs_agent_run",
    priority: "normal",
    owner: "Client manager",
    sourceSystem: "manual_upload",
    createdAt: now,
    updatedAt: now,
    evidence: [
      {
        id: "ev_bank_001",
        type: "document",
        title: "Client ABC bank statement March 2026",
        content:
          "Bank statement for period 2026-03. IBAN CH93 0076 2011 6238 5295 7. Opening balance CHF 24,100. Closing balance CHF 31,870. Transactions dated 2026-03-01 to 2026-03-31."
      },
      {
        id: "ev_sales_001",
        type: "document",
        title: "Sales invoice export March 2026",
        content:
          "Sales invoice export for 2026-03. Customer invoice INV-2041 CHF 8,200 dated 2026-03-05. Customer invoice INV-2042 CHF 3,400 dated 2026-03-18."
      },
      {
        id: "ev_payroll_001",
        type: "email",
        title: "Payroll summary note March 2026",
        content:
          "Payroll summary for 2026-03. Salary run completed for 4 employees. AHV and social security accrual included. Total payroll CHF 22,600."
      }
    ]
  };
  const ingestion = runDataIngestionAgent(demoCase, [], now);
  const security = runSecurityAgent({ caseRecord: demoCase, contextPackets: ingestion.contextPackets, createdAt: now });
  const cadence = runCadenceAgent({ caseRecord: demoCase, pendingRecommendations: [], createdAt: now });

  return {
    tenant: {
      id: "tenant_demo",
      name: "Demo Treuhand Pilot",
      vertical_default: "treuhand_accounting",
      data_region: "local"
    },
    user: {
      id: "user_reviewer",
      email: "reviewer@example.local",
      role: "reviewer"
    },
    agents: agentBacklog,
    cases: [demoCase],
    activeCaseId: caseId,
    contextPackets: ingestion.contextPackets,
    controlAgentOutputs: mergeById(
      mergeById(ingestion.controlAgentOutputs, security.controlAgentOutputs),
      cadence.controlAgentOutputs
    ),
    securityFindings: security.securityFindings,
    authorizationDecisions: [],
    gapFindings: [],
    cadenceNudges: cadence.cadenceNudges,
    memoryCandidates: [],
    handoffRequests: [],
    validationCaseImports: sampleCaseImports,
    validationRecords: [],
    agentRuns: [],
    recommendations: [],
    reviewDecisions: [],
    auditEvents: [
      {
        id: "audit_seed",
        caseId,
        eventType: "demo_seed_created",
        message: "Demo case seeded locally.",
        createdAt: now
      }
    ]
  };
}
